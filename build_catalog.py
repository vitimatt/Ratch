#!/usr/bin/env python3
"""Writes catalog.json from the images, audio, and fonts folders."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GROUPS = {
    "images": {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"},
    "audio": {".mp3", ".m4a", ".wav", ".ogg"},
    "fonts": {".ttf", ".otf", ".woff", ".woff2"},
}


def listed(folder, exts):
    path = ROOT / folder
    if not path.is_dir():
        return []
    return sorted(
        item.name
        for item in path.iterdir()
        if item.is_file() and item.suffix.lower() in exts and not item.name.startswith(".")
    )


catalog = {name: listed(name, exts) for name, exts in GROUPS.items()}
(ROOT / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n")
print(json.dumps(catalog, indent=2))
