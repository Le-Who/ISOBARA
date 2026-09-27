from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "public" / "assets"
OUT_DIR = Path(__file__).resolve().parent
THRESHOLD = 16


def components(alpha: bytes, width: int, height: int, threshold: int = THRESHOLD):
    active = bytearray(1 if a >= threshold else 0 for a in alpha)
    seen = bytearray(width * height)
    found = []
    for start, is_active in enumerate(active):
        if not is_active or seen[start]:
            continue
        seen[start] = 1
        q = deque([start])
        count = 0
        min_x = width
        min_y = height
        max_x = max_y = 0
        while q:
            idx = q.popleft()
            x, y = idx % width, idx // width
            count += 1
            min_x, min_y = min(min_x, x), min(min_y, y)
            max_x, max_y = max(max_x, x), max(max_y, y)
            for dy in (-1, 0, 1):
                ny = y + dy
                if ny < 0 or ny >= height:
                    continue
                row = ny * width
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx = x + dx
                    if nx < 0 or nx >= width:
                        continue
                    ni = row + nx
                    if active[ni] and not seen[ni]:
                        seen[ni] = 1
                        q.append(ni)
        found.append({"area_px": count, "bbox_xyxy": [min_x, min_y, max_x + 1, max_y + 1]})
    return sorted(found, key=lambda c: c["area_px"], reverse=True)


def bbox_for_threshold(alpha_img: Image.Image, threshold: int):
    return alpha_img.point(lambda p: 255 if p >= threshold else 0).getbbox()


def main():
    files = sorted(ASSET_DIR.glob("*.webp"), key=lambda p: p.name.lower())
    records = []
    cell_w, cell_h = 390, 225
    columns = 3
    rows = (len(files) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "#d9d8d2")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 17)
    except OSError:
        font = ImageFont.load_default()

    for pos, path in enumerate(files):
        original = Image.open(path).convert("RGBA")
        width, height = original.size
        alpha_img = original.getchannel("A")
        alpha = alpha_img.tobytes()
        values = list(alpha)
        bbox16 = bbox_for_threshold(alpha_img, THRESHOLD)
        bbox128 = bbox_for_threshold(alpha_img, 128)
        if bbox16:
            left, top, right, bottom = bbox16
            margins16 = {"left": left, "top": top, "right": width - right, "bottom": height - bottom}
        else:
            margins16 = None
        edge_counts = {
            "top": sum(1 for x in range(width) if alpha[x] >= THRESHOLD),
            "right": sum(1 for y in range(height) if alpha[y * width + width - 1] >= THRESHOLD),
            "bottom": sum(1 for x in range(width) if alpha[(height - 1) * width + x] >= THRESHOLD),
            "left": sum(1 for y in range(height) if alpha[y * width] >= THRESHOLD),
        }
        comps = components(alpha, width, height)
        n = len(values)
        hist = {
            "transparent_0_pct": round(100 * sum(a == 0 for a in values) / n, 3),
            "partial_1_254_pct": round(100 * sum(0 < a < 255 for a in values) / n, 3),
            "opaque_255_pct": round(100 * sum(a == 255 for a in values) / n, 3),
        }
        record = {
            "file": path.name,
            "dimensions": [width, height],
            "alpha": {"min": min(values), "max": max(values), **hist},
            "bbox_alpha_ge_16_xyxy": list(bbox16) if bbox16 else None,
            "bbox_alpha_ge_128_xyxy": list(bbox128) if bbox128 else None,
            "margins_alpha_ge_16_px": margins16,
            "nontransparent_edge_pixels_alpha_ge_16": edge_counts,
            "connected_components_8_neighbor_alpha_ge_16": {
                "count": len(comps),
                "largest": comps[0] if comps else None,
                "next_components": comps[1:6],
            },
        }
        records.append(record)

        x0 = (pos % columns) * cell_w
        y0 = (pos // columns) * cell_h
        draw.rectangle((x0, y0, x0 + cell_w - 1, y0 + cell_h - 1), fill="#eeede8", outline="#898982")
        draw.text((x0 + 12, y0 + 8), path.name, fill="#111111", font=font)
        draw.text((x0 + 18, y0 + 34), "светлый", fill="#383838", font=font)
        draw.text((x0 + 215, y0 + 34), "тёмный", fill="#383838", font=font)
        preview = original.copy()
        preview.thumbnail((165, 165), Image.Resampling.LANCZOS)
        light = Image.new("RGBA", (170, 165), "#f6f4ed")
        light.alpha_composite(preview, ((170 - preview.width) // 2, (165 - preview.height) // 2))
        dark = Image.new("RGBA", (170, 165), "#202630")
        dark.alpha_composite(preview, ((170 - preview.width) // 2, (165 - preview.height) // 2))
        sheet.paste(light.convert("RGB"), (x0 + 8, y0 + 53))
        sheet.paste(dark.convert("RGB"), (x0 + 205, y0 + 53))

    data = {
        "source_directory": "public/assets",
        "analysis_threshold_alpha_ge": THRESHOLD,
        "component_connectivity": "8-neighbor",
        "files_audited": len(records),
        "records": records,
    }
    (OUT_DIR / "measurements.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    sheet.save(OUT_DIR / "contact-sheet-light-dark.png")
    print(json.dumps({"count": len(records), "report": str(OUT_DIR / "measurements.json"), "contact_sheet": str(OUT_DIR / "contact-sheet-light-dark.png")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
