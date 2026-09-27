from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from analyze_assets import components

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "assets" / "equipment-repair"
EVIDENCE = Path(__file__).resolve().parent
THRESHOLD = 16


def measure(path: Path):
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    width, height = image.size
    values = alpha.tobytes()
    bbox = alpha.point(lambda value: 255 if value >= THRESHOLD else 0).getbbox()
    margins = None if not bbox else {
        "left": bbox[0], "top": bbox[1], "right": width - bbox[2], "bottom": height - bbox[3]
    }
    edge_counts = {
        "top": sum(values[x] >= THRESHOLD for x in range(width)),
        "right": sum(values[y * width + width - 1] >= THRESHOLD for y in range(height)),
        "bottom": sum(values[(height - 1) * width + x] >= THRESHOLD for x in range(width)),
        "left": sum(values[y * width] >= THRESHOLD for y in range(height)),
    }
    comps = components(values, width, height)
    partial_bright_chroma = 0
    partial_red_or_green = 0
    rgba = image.tobytes()
    for i in range(0, len(rgba), 4):
        r, g, b, a = rgba[i:i + 4]
        if 0 < a < 255 and max(r, g, b) >= 200 and max(r, g, b) - min(r, g, b) >= 100:
            partial_bright_chroma += 1
            if (r >= 200 and g <= 160 and b <= 160) or (g >= 200 and r <= 160 and b <= 160):
                partial_red_or_green += 1
    pixel_count = width * height
    record = {
        "file": path.name,
        "size": [width, height],
        "alpha_extrema": list(alpha.getextrema()),
        "alpha_percent": {
            "fully_transparent": round(100 * values.count(0) / pixel_count, 3),
            "partially_transparent": round(100 * sum(0 < value < 255 for value in values) / pixel_count, 3),
            "fully_opaque": round(100 * values.count(255) / pixel_count, 3),
        },
        "bbox_alpha_ge_16_xyxy": list(bbox) if bbox else None,
        "margins_alpha_ge_16_px": margins,
        "edge_pixels_alpha_ge_16": edge_counts,
        "components_8_neighbor_alpha_ge_16": {
            "count": len(comps),
            "largest": comps[0] if comps else None,
            "next_components": comps[1:6],
        },
        "partial_bright_chroma_pixels": partial_bright_chroma,
        "partial_bright_red_or_green_pixels": partial_red_or_green,
    }
    return image, record


def main():
    files = sorted([*OUT.glob("*-repair-source.png"), *OUT.glob("*-candidate.webp")])
    preview_files = sorted(OUT.glob("*-candidate.webp")) or sorted(OUT.glob("*-repair-source.png"))
    records = []
    font = ImageFont.load_default()
    panel_width, panel_height = 440, 440
    gap = 8
    sheet = Image.new("RGB", (panel_width * 2 + gap, max(1, len(preview_files)) * (panel_height + gap)), "#d4d4ce")
    draw = ImageDraw.Draw(sheet)
    measurements = {}
    for path in files:
        image, record = measure(path)
        records.append(record)
        measurements[path.name] = (image, record)
    for row, path in enumerate(preview_files):
        image, _ = measurements[path.name]
        thumb = image.copy()
        thumb.thumbnail((panel_width - 16, panel_height - 32), Image.Resampling.LANCZOS)
        y = row * (panel_height + gap)
        for col, (label, color) in enumerate((("light", "#f5f3ec"), ("dark", "#202630"))):
            x = col * (panel_width + gap)
            panel = Image.new("RGBA", (panel_width, panel_height), color)
            panel.alpha_composite(thumb, ((panel_width - thumb.width) // 2, 25 + (panel_height - 32 - thumb.height) // 2))
            sheet.paste(panel.convert("RGB"), (x, y))
            draw.text((x + 8, y + 7), f"{path.name} — {label}", fill="#b00000" if label == "light" else "#ffffff", font=font)
    payload = {
        "threshold_alpha_ge": THRESHOLD,
        "component_connectivity": "8-neighbor",
        "files": records,
    }
    (OUT / "candidate-measurements.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if preview_files:
        sheet.save(OUT / "candidates-light-dark.png")
    print(json.dumps({"files": len(records), "measurement_path": str(OUT / 'candidate-measurements.json'), "qa_sheet_path": str(OUT / 'candidates-light-dark.png')}, ensure_ascii=False))


if __name__ == "__main__":
    main()
