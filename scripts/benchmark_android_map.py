"""Local API 35 emulator benchmark; never a physical/release performance claim."""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import quote, urlparse


def percentile(values, quantile):
    if not 0 < quantile <= 1:
        raise ValueError("quantile must be in (0, 1]")
    if not values:
        return None
    if any(not math.isfinite(value) or value < 0 for value in values):
        raise ValueError("timings must be finite and nonnegative")
    return sorted(values)[math.ceil(len(values) * quantile) - 1]


def summarize(values):
    return {
        "count": len(values),
        "p50": percentile(values, 0.5),
        "p95": percentile(values, 0.95),
        "method": "nearest rank; no failed samples discarded",
    }


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", default="emulator-5556")
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--timeout", type=float, default=45)
    parser.add_argument("--metro-url", default="http://127.0.0.1:8096")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--allow-dirty", action="store_true", help="diagnostic runs only")
    args = parser.parse_args()
    if not 1 <= args.samples <= 100 or not 1 <= args.timeout <= 120:
        parser.error("use 1–100 samples and a 1–120 second timeout")
    url = urlparse(args.metro_url)
    if (
        url.scheme != "http"
        or url.hostname not in ["localhost", "127.0.0.1"]
        or not url.port
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.path not in ["", "/"]
    ):
        parser.error("Metro must be an explicit local HTTP origin without credentials")
    root = Path(__file__).resolve().parent.parent
    source_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    dirty = subprocess.check_output(
        ["git", "status", "--porcelain", "--", "apps/mobile"], cwd=root, text=True
    ).strip()
    if dirty and not args.allow_dirty:
        parser.error("commit mobile source before a gate benchmark; --allow-dirty is diagnostic only")
    adb_path = Path(os.environ["LOCALAPPDATA"]) / "Android/Sdk/platform-tools/adb.exe"

    def adb(*command, timeout=15):
        result = subprocess.run(
            [str(adb_path), "-s", args.serial, *command],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout,
        )
        result.check_returncode()
        return result.stdout

    if adb("shell", "getprop", "ro.kernel.qemu").strip() != "1":
        parser.error("this benchmark operates only on an emulator")
    if adb("shell", "getprop", "ro.build.version.sdk").strip() != "35":
        parser.error("API 35 is required for comparable local runs")
    abi = adb("shell", "getprop", "ro.product.cpu.abi").strip()
    if abi != "x86_64":
        parser.error("x86_64 is required for this local protocol")
    package = "com.parkey.discovery"
    adb("reverse", f"tcp:{url.port}", f"tcp:{url.port}")
    deep_link = (
        "parkey://expo-development-client/?url=" + quote(args.metro_url, safe="")
        + "&disableOnboarding=1&disableFab=1&disableAutoLaunch=1"
        + "&__expo_disable_onboarding=1&__expo_disable_fab=1&__expo_disable_auto_launch=1"
    )

    def pss():
        match = re.search(r"TOTAL PSS:\s*(\d+)", adb("shell", "dumpsys", "meminfo", package))
        return int(match[1]) if match else None

    def activity_fields(output):
        return {
            key: int(match.group(1)) if (match := re.search(rf"{key}:\s*(\d+)", output)) else None
            for key in ["TotalTime", "WaitTime", "ThisTime"]
        }

    cold, warm, failures = [], [], []
    for index in range(args.samples):
        try:
            adb("shell", "am", "force-stop", package)
            adb("logcat", "-c")
            started = time.monotonic()
            output = adb(
                "shell", f"am start -W -a android.intent.action.VIEW -d '{deep_link}' {package}",
                timeout=args.timeout,
            )
            pid = adb("shell", "pidof", package).strip().split()[0]
            ready = None
            logs = ""
            while time.monotonic() - started < args.timeout:
                logs = adb("logcat", "-d", "--pid", pid, "-s", "ReactNativeJS:I", "AndroidRuntime:E")
                ready = re.search(r"PARKEY_LOCAL_MAP_READY (\d+)", logs)
                if ready:
                    break
                time.sleep(0.25)
            if not ready:
                raise RuntimeError("fully-rendered local map event timed out")
            observed_ms = round((time.monotonic() - started) * 1000, 2)
            # Allow async renderer diagnostics to arrive before validating this sample.
            time.sleep(0.2)
            logs = adb("logcat", "-d", "--pid", pid, "-s", "ReactNativeJS:I", "AndroidRuntime:E")
            bad = bool(re.search(
                r"Failed to load glyph range|Unknown expression|Unknown operator|Failed to load source|FATAL EXCEPTION",
                logs, re.IGNORECASE,
            ))
            sample = {
                "index": index, "launch_to_observed_fully_rendered_ms": observed_ms,
                "map_mount_to_fully_rendered_ms": int(ready.group(1)),
                "activity": activity_fields(output), "pss_kb": pss(), "renderer_error": bad,
            }
            cold.append(sample)
            if bad:
                failures.append({"phase": "cold", "index": index, "error": "renderer diagnostics present"})
            print("cold", index + 1, observed_ms, "ms", "renderer error" if bad else "ok", flush=True)
        except (OSError, subprocess.SubprocessError, RuntimeError, IndexError) as error:
            failures.append({"phase": "cold", "index": index, "error": str(error)})
            print("cold", index + 1, "failed:", str(error), flush=True)

    before = pss() if cold else None
    warm_pid = adb("shell", "pidof", package).strip() if cold else None
    for index in range(args.samples):
        try:
            adb("shell", "input", "keyevent", "KEYCODE_HOME")
            time.sleep(0.3)
            started = time.monotonic()
            output = adb("shell", "am", "start", "-W", "-n", package + "/.MainActivity")
            if warm_pid and adb("shell", "pidof", package).strip() != warm_pid:
                raise RuntimeError("app process restarted during warm resume")
            warm.append({"index": index, "activity_command_wall_ms": round((time.monotonic()-started)*1000,2), "activity": activity_fields(output)})
        except (OSError, subprocess.SubprocessError, RuntimeError) as error:
            failures.append({"phase": "warm", "index": index, "error": str(error)})
    after = pss() if cold else None
    memory_ok = (
        before is not None and after is not None
        and all(sample["pss_kb"] is not None for sample in cold)
        and max([before, after] + [sample["pss_kb"] for sample in cold]) <= 512 * 1024
        and after - before <= 64 * 1024
    )
    report = {
        "schema_version": 1, "source_commit": source_commit, "dirty_mobile_source": bool(dirty),
        "apk_sha256": sha256(args.apk), "platform": "Android 15/API 35 x86_64 emulator",
        "serial": args.serial, "dataset": args.dataset,
        "protocol": "Cold process with app data/assets/tile caches preserved; single-worker Metro debug JS. Warm timing is activity-command completion, NOT map GPU readiness. Cold readiness observed through bounded ADB polling includes bridge/poll overhead.",
        "local_flag_required": "EXPO_PUBLIC_LOCAL_MAP_BENCHMARK=true in development Metro",
        "samples_requested": args.samples, "cold": cold, "warm": warm, "failures": failures,
        "readiness_scope": "First fully rendered basemap; may precede remote records/markers. Dataset label is operator supplied, not loaded-record evidence.",
        "cold_launch_to_observed_map_ms": summarize([s["launch_to_observed_fully_rendered_ms"] for s in cold]),
        "cold_map_phase_ms": summarize([s["map_mount_to_fully_rendered_ms"] for s in cold]),
        "warm_activity_command_ms": summarize([s["activity_command_wall_ms"] for s in warm]),
        "memory": {"before_warm_pss_kb": before, "after_warm_pss_kb": after, "limit_pss_kb": 512*1024, "limit_growth_kb": 64*1024, "passed": memory_ok},
        "engineering_eligible": not dirty and args.samples >= 20 and len(cold)==args.samples and len(warm)==args.samples and not failures and memory_ok,
        "physical_device_or_release_claim": False,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"cold":report["cold_launch_to_observed_map_ms"],"warm":report["warm_activity_command_ms"],"memory":report["memory"],"failures":len(failures),"engineering_eligible":report["engineering_eligible"]}), flush=True)
    return 0 if not failures and memory_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
