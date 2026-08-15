#!/usr/bin/env python3
# 尼采数字分身 · 本地服务（静态托管 + AI 代理 + 反馈存储）
# 密钥仅从环境变量 DEEPSEEK_KEY 读取，绝不落前端。
import os, json, time, urllib.request, urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ARCHIVE = HERE / "archive"
KEY = os.environ.get("DEEPSEEK_KEY", "")
PORT = int(os.environ.get("PORT", "8080"))
HOST = os.environ.get("HOST", "0.0.0.0")  # 部署到公网必须监听 0.0.0.0
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ARCHIVE), **k)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def _send_json(self, obj, status=200):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        p = self.path.split("?")[0].rstrip("/")
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0
        body = self.rfile.read(length) if length else b""

        if p == "/api/twin":
            if not KEY:
                self._send_json({"ok": False, "error": "no-key-configured"})
                return
            try:
                payload = json.loads(body or b"{}")
            except Exception:
                self._send_json({"ok": False, "error": "bad-json"}, 400)
                return
            req = urllib.request.Request(
                DEEPSEEK_URL,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json",
                         "Authorization": "Bearer " + KEY},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=150) as r:
                    raw = r.read().decode("utf-8", "replace")
                self._send_json({"ok": True, "raw": raw})
            except urllib.error.HTTPError as e:
                self._send_json({"ok": False, "error": "deepseek-http-%s" % e.code})
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)[:200]})
            return

        if p == "/api/feedback":
            try:
                data = json.loads(body or b"{}")
            except Exception:
                self._send_json({"ok": False, "error": "bad-json"}, 400)
                return
            data["_t"] = time.time()
            path = ARCHIVE / "feedback.json"
            arr = []
            if path.exists():
                try:
                    arr = json.loads(path.read_text("utf-8"))
                except Exception:
                    arr = []
            arr.append(data)
            try:
                path.write_text(json.dumps(arr, ensure_ascii=False, indent=1), "utf-8")
            except Exception:
                pass
            self._send_json({"ok": True, "count": len(arr)})
            return

        self.send_error(404)

    def do_GET(self):
        p = self.path.split("?")[0].rstrip("/")
        if p == "/api/feedback":
            path = ARCHIVE / "feedback.json"
            arr = []
            if path.exists():
                try:
                    arr = json.loads(path.read_text("utf-8"))
                except Exception:
                    arr = []
            self._send_json(arr)
            return
        return super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"[serve] archive={ARCHIVE}")
    print(f"[serve] http://{HOST}:{PORT}  (DEEPSEEK_KEY={'SET' if KEY else 'MISSING'})")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
