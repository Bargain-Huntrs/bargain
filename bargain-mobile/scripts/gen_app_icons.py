#!/usr/bin/env python3
"""BargainHuntrs app-icon generator — the "B⚡H" mark from bargain-web/public/logo.svg.

The site's dark-mode logo is an emerald (#10b981) tile carrying a dark
(#09090b) B + lightning bolt + H lockup. The app is dark-only, so every
surface uses that colorway.

Run:  /tmp/iconenv/bin/python scripts/gen_app_icons.py   (from bargain-mobile/)
      (any python with Pillow works — `python3 -m venv /tmp/iconenv &&
       /tmp/iconenv/bin/pip install Pillow`)

Outputs (assets/):
  icon.png                     — 1024x1024 full-bleed emerald (iOS + legacy Android)
  android-icon-foreground.png  — 1024x1024 transparent, tile inside safe zone
  android-icon-background.png  — 1024x1024 solid #09090b
  android-icon-monochrome.png  — 1024x1024 white mark on transparent
  splash-icon.png              — 512x512 transparent, tile mark (splash plugin)
  favicon.png                  — 64x64 tile mark
"""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.path.join(ROOT, 'assets')

EMERALD = (16, 185, 129, 255)    # #10b981 — brand tile
INK = (9, 9, 11, 255)            # #09090b — glyph on emerald / app bg
WHITE = (250, 250, 250, 255)

FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
if not os.path.exists(FONT):
    FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
if not os.path.exists(FONT):
    raise SystemExit('no heavy system font found')

# Logo geometry in the SVG's 128x128 viewbox.
GRID = 128
SS = 16  # supersample factor — compose at 2048, downscale for crisp edges
B_X, H_X, MID_Y = 38, 92, 64
FONT_SIZE = 48
BOLT = [(64, 28), (54, 62), (62, 62), (58, 100), (74, 58), (66, 58), (70, 28)]
TILE_RADIUS = 28


def render_mark(fg, scale=SS):
    """Draw the B+bolt+H lockup on a transparent canvas, cropped to ink."""
    size = GRID * scale
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, FONT_SIZE * scale)
    for ch, cx in (('B', B_X), ('H', H_X)):
        d.text((cx * scale, MID_Y * scale), ch, font=font, fill=fg, anchor='mm')
    d.polygon([(x * scale, y * scale) for x, y in BOLT], fill=fg)
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def rounded_tile(size, radius_frac=TILE_RADIUS / GRID, color=EMERALD):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_frac), fill=color)
    return img


def paste_center(base, mark, width_frac):
    w = int(base.width * width_frac)
    h = int(mark.height * (w / mark.width))
    m = mark.resize((w, h), Image.LANCZOS)
    base.alpha_composite(m, ((base.width - w) // 2, (base.height - h) // 2))
    return base


def main():
    os.makedirs(OUT, exist_ok=True)
    dark_mark = render_mark(INK)
    white_mark = render_mark(WHITE)

    # icon.png — full-bleed emerald, dark mark ~62% wide
    icon = Image.new('RGBA', (1024, 1024), EMERALD)
    paste_center(icon, dark_mark, 0.62)
    icon.save(os.path.join(OUT, 'icon.png'))

    # android adaptive foreground — tile + mark inside the 66% safe zone
    fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    tile = rounded_tile(int(1024 * 0.66))
    fg.alpha_composite(tile, ((1024 - tile.width) // 2, (1024 - tile.width) // 2))
    inner = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    paste_center(inner, dark_mark, 0.40)
    fg.alpha_composite(inner)
    fg.save(os.path.join(OUT, 'android-icon-foreground.png'))

    # android adaptive background — solid app-bg ink
    Image.new('RGBA', (1024, 1024), INK).save(os.path.join(OUT, 'android-icon-background.png'))

    # android monochrome — white mark on transparent, safe-zone sized
    mono = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    paste_center(mono, white_mark, 0.55)
    mono.save(os.path.join(OUT, 'android-icon-monochrome.png'))

    # splash-icon.png — transparent canvas, tile mark centered
    splash = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    tile = rounded_tile(512)
    splash.alpha_composite(tile, (0, 0))
    inner = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    paste_center(inner, dark_mark, 0.58)
    splash.alpha_composite(inner)
    splash.save(os.path.join(OUT, 'splash-icon.png'))

    # favicon.png — 64px tile mark
    fav = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    tile = rounded_tile(64)
    fav.alpha_composite(tile, (0, 0))
    inner = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    paste_center(inner, dark_mark, 0.58)
    fav.alpha_composite(inner)
    fav.save(os.path.join(OUT, 'favicon.png'))

    for f in sorted(os.listdir(OUT)):
        if f.endswith('.png'):
            print('wrote', f)


if __name__ == '__main__':
    main()
