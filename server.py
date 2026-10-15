#!/usr/bin/env python3
"""Serves the slider and lists files dropped into ./images, ./audio, and ./fonts."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IMAGES = ROOT / "images"
AUDIO = ROOT / "audio"
FONTS = ROOT / "fonts"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"}
AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".ogg"}
FONT_EXTS = {".ttf", ".otf", ".woff", ".woff2"}
PORT = 8765


def list_files(folder, exts):
    if not folder.is_dir():
        return []
    return sorted(
        p.name
        for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in exts and not p.name.startswith(".")
    )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        listing = {
            "/api/images": (IMAGES, IMAGE_EXTS),
            "/api/audio": (AUDIO, AUDIO_EXTS),
            "/api/fonts": (FONTS, FONT_EXTS),
        }.get(path)
        if listing:
            body = json.dumps(list_files(*listing)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()


if __name__ == "__main__":
    IMAGES.mkdir(exist_ok=True)
    AUDIO.mkdir(exist_ok=True)
    FONTS.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Eyes slider at http://127.0.0.1:{PORT}")
    print(f"Images: {IMAGES}")
    print(f"Audio:  {AUDIO}")
    print(f"Font:   {FONTS}")
    server.serve_forever()
