"""Loopback Expo manifest for the isolated, development-only native trust entry.

Start Metro normally on 8096, run this, reverse ports 8096/8102 with ADB,
force-stop the development client, then open its URL at http://127.0.0.1:8102.
The harness never changes app routes, source records, approvals or the catalog.
"""

import argparse
import http.server
import json
import urllib.parse
import urllib.request
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metro-port", type=int, default=8096)
    parser.add_argument("--port", type=int, default=8102)
    args = parser.parse_args()
    if any(not 1024 <= port <= 65535 for port in (args.metro_port, args.port)):
        parser.error("Use unprivileged local ports from 1024 to 65535.")
    request = urllib.request.Request(
        f"http://127.0.0.1:{args.metro_port}",
        headers={"expo-platform": "android", "accept": "application/expo+json"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        manifest = json.load(response)
    asset_url = urllib.parse.urlsplit(manifest["launchAsset"]["url"])
    if asset_url.hostname != "127.0.0.1" or asset_url.port != args.metro_port:
        raise ValueError("Run Metro in localhost mode before using this harness.")
    manifest["id"] = str(uuid.uuid4())
    manifest["launchAsset"]["url"] = urllib.parse.urlunsplit(
        (
            asset_url.scheme,
            asset_url.netloc,
            "/apps/mobile/src/testing/parking-trust-harness.bundle",
            asset_url.query,
            "",
        )
    )
    content = json.dumps(manifest).encode()

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "application/expo+json")
            self.send_header("expo-protocol-version", "0")
            self.send_header("expo-sfv-version", "0")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, *_args):
            pass

    print(f"Native synthetic QA manifest: http://127.0.0.1:{args.port}", flush=True)
    with http.server.HTTPServer(("127.0.0.1", args.port), Handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
