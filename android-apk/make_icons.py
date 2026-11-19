#!/usr/bin/env python3
"""Generate launcher icons that mirror assets/icon.svg (green circle + sheet)."""
from pathlib import Path

from PIL import Image, ImageDraw

BASE = 192
SCALE = 4
SIZE = BASE * SCALE
HERE = Path(__file__).resolve().parent

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)


def s(value):
    return int(round(value * SCALE))


# Brand green circle
draw.ellipse([0, 0, SIZE - 1, SIZE - 1], fill="#0C7B66")

# White document sheet
draw.rounded_rectangle(
    [s(56), s(44), s(136), s(156)],
    radius=s(12),
    fill="#FFFFFF",
)

# Folded corner (kept subtle so it reads on the white sheet)
draw.line(
    [(s(104), s(44)), (s(104), s(76)), (s(136), s(76))],
    fill="#D8E6E1",
    width=s(5),
    joint="curve",
)

# Green text lines
for y, x2 in ((92, 124), (112, 108), (132, 116)):
    draw.line(
        [(s(68), s(y)), (s(x2), s(y))],
        fill="#0C7B66",
        width=s(5),
    )

DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

for density, px in DENSITIES.items():
    folder = HERE / "res" / ("mipmap-" + density)
    folder.mkdir(parents=True, exist_ok=True)
    icon = img.resize((px, px), Image.LANCZOS)
    icon.save(folder / "ic_launcher.png", "PNG", optimize=True)
    print(folder / "ic_launcher.png", px)
