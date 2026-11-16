#!/usr/bin/env python3
"""BargainHuntrs app-icon generator — the fox mark (assets/fox-mark.png).

Owner-supplied mark (2026-11-15): the fox head PNG dropped into
bargain-web/public/icons/icon-fox-192.png, copied here as the canonical
source. Green-toned fox on transparency → ships on the dark #09090b canvas
(the app is dark-only).

Run:  /Volumes/Os_Sites/Prime/prime-mobile/.venv-emblem/bin/python \
        scripts/gen_app_icons.py   (from bargain-mobile/; any python3 with
      Pillow works)

Outputs (assets/):
  icon.png                     — 1024x1024 full-bleed #09090b + fox (iOS + legacy Android)
  android-icon-foreground.png  — 1024x1024 transparent, fox inside safe zone
  android-icon-background.png  — 1024x1024 solid #09090b
  android-icon-monochrome.png  — 1024x1024 white fox silhouette on transparent
  splash-icon.png              — 512x512 transparent fox mark (splash plugin)
  favicon.png                  — 64x64 dark tile + fox
"""
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.path.join(ROOT, 'assets')
FOX_SRC = os.path.join(OUT, 'fox-mark.png')

INK = (9, 9, 11, 255)            # #09090b — app background
WHITE = (255, 255, 255, 255)


def load_fox():
    """Fox mark cropped to its alpha bounding box."""
    im = Image.open(FOX_SRC).convert('RGBA')
    return im.crop(im.getbbox())


def scaled(mark, width_px, height_px=None):
    "Resize proportionally to width_px (or exact w×h if height given)."
    if height_px is None:
        height_px = round(mark.height * width_px / mark.width)
    return mark.resize((width_px, height_px), Image.LANCZOS)


def paste_center(base, mark, width_px):
    m = scaled(mark, width_px)
    base.alpha_composite(m, ((base.width - m.width) // 2,
                             (base.height - m.height) // 2))
    return base


def white_silhouette(mark, width_px):
    "Alpha-mask silhouette of the fox filled solid white."""
    m = scaled(mark, width_px)
    sil = Image.new('RGBA', m.size, WHITE)
    sil.putalpha(m.getchannel('A'))
    return sil


def rounded_tile(size, radius_frac=28 / 128, color=INK):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    from PIL import ImageDraw
    ImageDraw.Draw(img).rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=int(size * radius_frac), fill=color)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    fox = load_fox()

    # icon.png — full-bleed near-black, fox ~58% wide
    icon = Image.new('RGBA', (1024, 1024), INK)
    paste_center(icon, fox, round(1024 * 0.58))
    icon.save(os.path.join(OUT, 'icon.png'))

    # android adaptive foreground — transparent, fox inside the ~66% safe zone
    fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    paste_center(fg, fox, round(1024 * 0.60))
    fg.save(os.path.join(OUT, 'android-icon-foreground.png'))

    # android adaptive background — solid app-bg ink
    Image.new('RGBA', (1024, 1024), INK).save(
        os.path.join(OUT, 'android-icon-background.png'))

    # android monochrome — white fox silhouette, safe-zone sized
    mono = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    sil = white_silhouette(fox, round(1024 * 0.55))
    mono.alpha_composite(sil, ((1024 - sil.width) // 2,
                               (1024 - sil.height) // 2))
    mono.save(os.path.join(OUT, 'android-icon-monochrome.png'))

    # splash-icon.png — transparent canvas, fox mark centered
    splash = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    paste_center(splash, fox, round(512 * 0.62))
    splash.save(os.path.join(OUT, 'splash-icon.png'))

    # favicon.png — 64px dark rounded tile + fox
    fav = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    fav.alpha_composite(rounded_tile(64), (0, 0))
    inner = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    paste_center(inner, fox, round(64 * 0.60))
    fav.alpha_composite(inner)
    fav.save(os.path.join(OUT, 'favicon.png'))

    for f in sorted(os.listdir(OUT)):
        if f.endswith('.png'):
            print('wrote', f)


if __name__ == '__main__':
    main()
