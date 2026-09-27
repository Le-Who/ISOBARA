from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
MAX_EDGE = 384


def convert(asset: str):
    source = HERE / f"{asset}-repair-source.png"
    target = HERE / f"{asset}-candidate.webp"
    original = Image.open(source).convert("RGBA")
    width, height = original.size
    scale = min(1.0, MAX_EDGE / max(width, height))
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    resized = original.resize(size, Image.Resampling.LANCZOS) if size != original.size else original
    resized.save(target, "WEBP", lossless=True, method=6, exact=True)
    check = Image.open(target).convert("RGBA")
    if check.size != size:
        raise RuntimeError(f"Unexpected WebP dimensions: {target} {check.size} != {size}")
    if check.getchannel("A").getextrema() != resized.getchannel("A").getextrema():
        raise RuntimeError(f"Unexpected alpha extrema change: {target}")
    return {
        "source": str(source),
        "candidate": str(target),
        "source_dimensions": [width, height],
        "candidate_dimensions": list(size),
        "webp_lossless": True,
        "resized_whole_canvas_without_crop": True,
    }


if __name__ == "__main__":
    result = {asset: convert(asset) for asset in ("cloak", "rotor")}
    (HERE / "conversion.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
