#!/usr/bin/env python3
"""
notify-relay.py — Host-side notification relay for opencode containers.

Listens on 127.0.0.1:<port> for POST requests from the notify.ts plugin running
inside a container.  When a request arrives it fires the appropriate native
desktop notification command for the host OS.

Started automatically by oc.sh; killed when oc.sh exits.

Usage:
    python3 notify-relay.py [port]   (default port: 19944)
"""

import json
import platform
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer


class RelayHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # silence default access log
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
            title = data.get("title", "OpenCode")
            message = data.get("message", "")
            _notify(title, message)
            self.send_response(200)
        except Exception:
            self.send_response(400)
        self.end_headers()


def _notify(title: str, message: str) -> None:
    os_name = platform.system()
    try:
        if os_name == "Darwin":
            script = f'display notification "{message}" with title "{title}"'
            subprocess.run(["osascript", "-e", script], check=False)
        elif os_name == "Linux":
            subprocess.run(["notify-send", title, message], check=False)
    except FileNotFoundError:
        pass  # notification tool not available — silently skip


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 19944
    server = HTTPServer(("0.0.0.0", port), RelayHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
