"""Static file server + API proxy for Hermes Dashboard."""
import http.server
import socket
import socketserver
import threading
import urllib.request
import json
from pathlib import Path

PORT = 8901
STATIC_DIR = str(Path(__file__).parent / "out")
ADMIN_API = "http://localhost:9101"

# Known admin API path prefixes (dashboard calls these WITHOUT /api/ prefix)
# Include both bare paths and slash-prefixed variants so /config matches /config/
ADMIN_API_PREFIXES = (
    "/health",
    "/cron",
    "/cron/",
    "/memory",
    "/memory/",
    "/config",
    "/config/",
    "/system",
    "/system/",
    "/terminal",
    "/terminal/",
    "/watchdog",
    "/watchdog/",
    "/news-site",
    "/news-site/",
    "/models",
    "/models/",
    "/gateway",
    "/gateway/",
    "/sessions",
    "/sessions/",
)


def is_api_path(path):
    """Check if a path should be proxied to the admin API backend."""
    return path.startswith("/api/") or any(path.startswith(p) for p in ADMIN_API_PREFIXES)


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    """Serve static files AND proxy /api/* requests to admin server."""

    def do_GET(self):
        path = self.path.split("?")[0]

        # Redirect index.html to the page itself for proper routing
        if path == "/":
            return self._send_html(Path(STATIC_DIR) / "index.html")

        if is_api_path(path):
            return self._proxy_api("GET", path)

        # Serve static file — try with .html extension fallback
        filepath = Path(STATIC_DIR) / (path.lstrip("/") or "index.html")
        if not filepath.exists():
            html_path = Path(STATIC_DIR) / (path.lstrip("/") + ".html")
            if html_path.exists():
                filepath = html_path
            else:
                self.send_error(404, f"File not found: {path}")
                return

        # If the path is a directory, serve its index.html
        if filepath.is_dir():
            index_in_dir = filepath / "index.html"
            if index_in_dir.exists():
                filepath = index_in_dir
            else:
                self.send_error(404, f"Index not found in: {path}")
                return

        content_type = "text/html"
        ext = Path(filepath).suffix.lower()
        ct_map = {".css": "text/css", ".js": "application/javascript"}
        if ext in ct_map:
            content_type = ct_map[ext]

        try:
            with open(filepath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

    def do_POST(self):
        path = self.path.split("?")[0]

        if is_api_path(path):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b""
            return self._proxy_api("POST", path, body=body)

        self.send_error(405, "Method not allowed")

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_PUT(self):
        path = self.path.split("?")[0]
        if is_api_path(path):
            return self._proxy_api("PUT", path)
        self.send_error(405, "Method not allowed")

    def _proxy_api(self, method, path, body=None):
        """Forward request to admin server on :9101, stripping the /api/ prefix."""
        try:
            backend_path = path[len("/api/"):] if path.startswith("/api/") else path
            url = ADMIN_API + "/" + backend_path
            req = urllib.request.Request(url, data=body or None, method=method)
            if body and isinstance(body, bytes):
                req.add_header("Content-Type", "application/json")

            resp = urllib.request.urlopen(req, timeout=15)
            data = resp.read()

            self.send_response(resp.status)
            content_type = resp.headers.get("Content-Type", "application/json")
            self.send_header("Content-Type", content_type)
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            error_body = json.dumps({"error": str(e)}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(error_body)

    def log_message(self, format, *args):
        pass  # Suppress default logging

    def _send_html(self, filepath):
        """Serve a single HTML file."""
        try:
            with open(filepath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, str(e))

class ThreadingProxyHandler(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    print("=" * 60)
    print("Hermes Dashboard Server")
    print("=" * 60)
    print(f"  Static files: {STATIC_DIR}")
    print(f"  API proxy -> {ADMIN_API}")
    print(f"  URL: http://localhost:{PORT}/")
    print("=" * 60)

    server = ThreadingProxyHandler(("", PORT), ProxyHandler)
    server.serve_forever()

PYEOF