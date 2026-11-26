"""Локальный сервер лаборатории: раздаёт файлы и принимает PUT /out/<имя> для готовых роликов."""
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'out')
os.makedirs(OUT, exist_ok=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_PUT(self):
        m = re.fullmatch(r'/out/([A-Za-z0-9._-]{1,80})', self.path)
        if not m:
            self.send_error(400)
            return
        n = int(self.headers.get('Content-Length', 0))
        if n <= 0 or n > 200_000_000:
            self.send_error(413)
            return
        with open(os.path.join(OUT, m.group(1)), 'wb') as f:
            left = n
            while left:
                chunk = self.rfile.read(min(left, 1 << 20))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
        self.send_response(201)
        self.end_headers()


http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), Handler).serve_forever()
