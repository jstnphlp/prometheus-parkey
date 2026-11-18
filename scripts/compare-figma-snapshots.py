"""Create reviewable Figma/app/overlay boards from actual 430 x 932 captures.

Requires Pillow. Original exports and application PNGs remain untouched.
The overlay alone masks OS bars and explicitly declared dynamic data regions.
It is review evidence, not a pixel-parity pass/fail score.
"""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SIZE = (430, 932)
OS_REGIONS = [(0, 0, 430, 44), (0, 898, 430, 932)]


def comparison_regions(screen_id):
    """Return data-only masks and UI controls to retain inside map masks."""
    if screen_id == "22":
        return [(0, 150, 430, 744)], [
            (25, 664, 85, 726),
            (102, 664, 162, 726),
            (179, 664, 239, 726),
        ]
    if screen_id == "23":
        return [(0, 150, 430, 826), (41, 612, 390, 657)], [
            (94, 473, 154, 534),
            (171, 473, 231, 534),
            (248, 473, 308, 534),
            (24, 554, 406, 813),
        ]
    if screen_id == "25":
        return [(0, 44, 430, 308), (25, 338, 405, 392)], []
    if screen_id == "21":
        return [(28, 198, 403, 225)] + [
            (106, y + 16, 391, y + 87) for y in [246, 360, 474, 588]
        ], []
    if screen_id == "16":
        return [(113, 117, 404, 182)], []
    if screen_id in ["28", "29", "30"]:
        # The prototype map/route is illustrative; app maps use actual data.
        bounds = {
            "28": (20, 283, 409, 696),
            "29": (0, 121, 430, 779),
            "30": (0, 90, 430, 849),
        }
        return [bounds[screen_id]], []
    return [], []


def overlay_inputs(reference, application, screen_id):
    masks, retain = comparison_regions(screen_id)
    result = []
    for original in [reference, application]:
        masked = original.copy()
        draw = ImageDraw.Draw(masked)
        for region in masks:
            draw.rectangle(region, fill="#BDBDBD")
        for region in retain:
            masked.paste(original.crop(region), region[:2])
        # Text inside a retained preview is still record-specific.
        if screen_id == "23":
            ImageDraw.Draw(masked).rectangle((41, 612, 390, 657), fill="#BDBDBD")
        for region in OS_REGIONS:
            ImageDraw.Draw(masked).rectangle(region, fill="#BDBDBD")
        result.append(masked)
    return result, masks, retain


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", choices=["browser", "pilot"], default="browser")
    args = parser.parse_args()
    reference_root = ROOT / "design-reference"
    evidence_root = ROOT / "docs/evidence/figma-exact"
    output = evidence_root / "comparisons" / args.runtime
    output.mkdir(parents=True, exist_ok=True)
    index = json.loads((reference_root / "mcp-index.json").read_text())
    receipt = []
    for entry in index["entries"]:
        application_path = evidence_root / args.runtime / f"{entry['theme']}-{entry['id']}.png"
        if not application_path.is_file():
            continue
        reference = Image.open(reference_root / entry["screenshot"]).convert("RGB")
        application = Image.open(application_path).convert("RGB")
        if reference.size != SIZE or application.size != SIZE:
            raise ValueError(f"{application_path}: expected actual 430 x 932 captures, got {application.size}")
        (masked_reference, masked_application), masks, retain = overlay_inputs(reference, application, entry["id"])
        board = Image.new("RGB", (SIZE[0] * 3, SIZE[1] + 28), "white")
        for column, (label, capture) in enumerate([
            (f"Figma {entry['nodeId']}", reference),
            (f"App: {args.runtime} / {entry['theme']}", application),
            ("Overlay: OS/data masks only; no parity score", Image.blend(masked_reference, masked_application, 0.5)),
        ]):
            board.paste(capture, (SIZE[0] * column, 28))
            ImageDraw.Draw(board).text((SIZE[0] * column + 8, 8), label, fill="black")
        target = output / f"{entry['theme']}-{entry['id']}.jpg"
        board.save(target, quality=88)
        receipt.append({
            "screen": entry["id"], "theme": entry["theme"], "figmaNodeId": entry["nodeId"],
            "appCapture": str(application_path.relative_to(ROOT)).replace("\\", "/"),
            "comparison": str(target.relative_to(ROOT)).replace("\\", "/"),
            "maskedOsRegions": OS_REGIONS, "maskedDataRegions": masks, "retainedMapControls": retain,
        })
    (output / "index.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(f"Created {len(receipt)} actual reference/app comparison boards for {args.runtime}.")


if __name__ == "__main__":
    main()
