#!/usr/bin/env python3
"""
Social Card Maker — brand via env vars

Renders a branded 1200x630 PNG card for every item in content_queue.json.
Cards carry the post's hook line (or an optional `card_title` override),
so text-only posts get a scroll-stopping visual on every platform.

Card lookup order per queue item:
  1. item["image"] — explicit path relative to tools/social/
  2. item["card_title"] — rendered card with this headline
  3. auto-derived headline — first sentence/line of item["text"]

Output: tools/social/cards/<date>.png  (committed; the poster picks them up)

Usage:
  python card_maker.py            # render all missing cards
  python card_maker.py --force    # re-render everything
  python card_maker.py --date 2026-09-23  # one item only
"""

import argparse
import json
import os
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
QUEUE_FILE = HERE / "content_queue.json"
CARDS_DIR = HERE / "cards"
FONTS_DIR = HERE / "fonts"

W, H = 1200, 630

# Branding via env vars so the same file ports to every project.
def _hex(name: str, default: str) -> tuple:
    import os
    h = os.environ.get(name, default).lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

BG_TOP = _hex('CARD_BG_TOP', '09090b')        # zinc-950
BG_BOTTOM = _hex('CARD_BG_BOTTOM', '064e3b')  # emerald-900
ACCENT = _hex('CARD_ACCENT', '10b981')        # emerald-500 (BargainHuntrs brand)
ACCENT_DEEP = _hex('CARD_ACCENT_DEEP', '047857')
TEXT = _hex('CARD_TEXT', 'f8fafc')
TEXT_DIM = _hex('CARD_TEXT_DIM', 'a1a1aa')    # zinc-400
BRAND_KICKER = os.environ.get('CARD_KICKER', 'BARGAINHUNTRS')
BRAND_WORD1 = os.environ.get('CARD_WORD1', 'Bargain')
BRAND_WORD2 = os.environ.get('CARD_WORD2', 'Huntrs')
BRAND_URL = os.environ.get('CARD_URL', 'bargainhuntrs.com')


def _font(weight: int, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS_DIR / f"Inter-{weight}.ttf"), size)


_BASE: Image.Image | None = None


def _gradient() -> Image.Image:
    """Vertical navy -> deep blue gradient with a subtle cyan glow.
    Rendered once and cached — identical for every card."""
    global _BASE
    if _BASE is not None:
        return _BASE.copy()
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / H
        row = [int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)]
        # faint radial glow from top-right — varies per-row only in the
        # vertical term's max contribution; cheap row-level approximation
        glow = max(0.0, 1.0 - (abs(y - H * 0.1) / H) * 1.6) * 0.18
        px_row = tuple(min(255, int(c + ACCENT_DEEP[i] * glow)) for i, c in enumerate(row))
        for x in range(W):
            px[x, y] = px_row
    _BASE = img
    return _BASE.copy()


def _tint(rgb: tuple, alpha: float) -> tuple:
    """Blend a motif color into the card bg at low alpha."""
    return tuple(int(BG_BOTTOM[i] + (rgb[i] - BG_BOTTOM[i]) * alpha) for i in range(3))


# --- Topic motifs: drawn in muted cyan between gradient and text. -------------
# Each returns nothing; draws on `d` at low emphasis so text stays readable.

def _motif_parking(d: ImageDraw.ImageDraw) -> None:
    """Parking-lot stall stripes — right half, above the footer."""
    c = _tint(ACCENT, 0.22)
    for i in range(6):
        x = 640 + i * 95
        d.line([(x, H - 170), (x + 52, H - 270)], fill=c, width=7)
    d.line([(610, H - 160), (W - 60, H - 160)], fill=c, width=5)


def _motif_route(d: ImageDraw.ImageDraw) -> None:
    """Dashed route polyline with endpoint pins."""
    c = _tint(ACCENT, 0.30)
    pts = [(W - 420, 180), (W - 300, 320), (W - 380, 430), (W - 180, 500)]
    d.line(pts, fill=c, width=6, joint="curve")
    for (cx, cy) in (pts[0], pts[-1]):
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], outline=c, width=6)
        d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=c)


def _motif_gear(d: ImageDraw.ImageDraw) -> None:
    """Ghost gear silhouette, right side."""
    import math
    cx, cy, r = W - 220, 380, 120
    c = _tint(ACCENT, 0.18)
    teeth = []
    for i in range(24):
        a = i * math.tau / 24
        rr = r * (1.18 if i % 2 == 0 else 1.0)
        teeth.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(teeth, outline=c, width=8)
    d.ellipse([cx - 55, cy - 55, cx + 55, cy + 55], outline=c, width=8)


def _motif_bars(d: ImageDraw.ImageDraw) -> None:
    """Ascending chart bars along the bottom edge."""
    c = _tint(ACCENT, 0.22)
    heights = (90, 140, 110, 190, 160, 240)
    for i, h in enumerate(heights):
        x = W - 140 - (len(heights) - i) * 85
        d.rounded_rectangle([x, H - 60 - h, x + 56, H - 60], radius=6, fill=c)


def _motif_clock(d: ImageDraw.ImageDraw) -> None:
    """Clock ring with hands — for timeclock / HOS topics."""
    cx, cy, r = W - 200, 400, 110
    c = _tint(ACCENT, 0.22)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=10)
    d.line([(cx, cy), (cx, cy - 70)], fill=c, width=10)
    d.line([(cx, cy), (cx + 48, cy + 30)], fill=c, width=10)


def _motif_road(d: ImageDraw.ImageDraw) -> None:
    """Default: perspective road lines converging right."""
    c = _tint(ACCENT, 0.20)
    vx, vy = W - 120, 140
    for bx in range(100, W - 200, 180):
        d.line([(bx, H - 60), (vx, vy)], fill=c, width=6)
    d.line([(vx - 40, vy), (vx + 40, vy)], fill=c, width=6)


TOPIC_MOTIFS: list[tuple[tuple[str, ...], callable]] = [
    (("parking", "yard", "storage", "trailer", "lot", "stall"), _motif_parking),
    (("dispatch", "route", "map", "track", "delivery", "trip", "job"), _motif_route),
    (("maintenance", "inspection", "repair", "dvir", "service"), _motif_gear),
    (("cost", "margin", "price", "invoice", "revenue", "save", "fuel", "insurance"), _motif_bars),
    (("time", "clock", "hours", "hos", "shift", "schedule"), _motif_clock),
]


def derive_headline(text: str) -> str:
    """First line/sentence of the post, trimmed to card length. Strips the
    'New on the <brand> blog:' prefix — the card IS the blog promo."""
    line = text.strip().split("\n")[0].strip()
    line = re.sub(r"^new on the (?:\w+ )?blog:\s*", "", line, flags=re.I)
    sentence = re.split(r"(?<=[.!?])\s", line)[0]
    return (sentence or line)[:90]


def _wrap(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        trial = f"{cur} {w_}".strip()
        if font.getlength(trial) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


BG_DIR = HERE / "backgrounds"


def _photo_base(topic_idx: int | None) -> Image.Image | None:
    """If tools/social/backgrounds/ has a photo for this topic slot, use it
    under a dark scrim. Falls back to gradient. Drop e.g. parking.jpg,
    route.jpg, gear.jpg, bars.jpg, clock.jpg, road.jpg in that dir —
    Unsplash/Pexels license allows committed reuse."""
    names = ["parking", "route", "gear", "bars", "clock", "road"]
    cand = [BG_DIR / f"{names[topic_idx]}.jpg"] if topic_idx is not None else []
    cand += [BG_DIR / f"{n}.jpg" for n in names] + [BG_DIR / "default.jpg"]
    for f in cand:
        if f.exists():
            img = Image.open(f).convert("RGB").resize((W, H))
            scrim = Image.new("RGB", (W, H), (5, 10, 20))
            return Image.blend(img, scrim, 0.62)  # ~62% dark scrim for text legibility
    return None


TOPIC_NAMES = ("parking", "route", "gear", "bars", "clock", "road")


def make_card(headline: str, out_path: Path, kicker: str = "", body_text: str = "") -> None:
    # Score every topic by keyword hits; highest score wins. Headline hits
    # count double so a generic word in the body can't steal the motif.
    lowered_h, lowered_b = headline.lower(), body_text.lower()
    best, best_i, best_score = _motif_road, TOPIC_NAMES.index("road"), 0
    for i, (keywords, fn) in enumerate(TOPIC_MOTIFS):
        score = sum(2 * lowered_h.count(k) + lowered_b.count(k) for k in keywords)
        if score > best_score:
            best, best_i, best_score = fn, i, score
    motif, topic_idx = best, best_i

    photo = _photo_base(topic_idx)
    img = photo if photo is not None else _gradient()
    d = ImageDraw.Draw(img)
    if photo is None and motif:
        motif(d)  # motif only on gradient cards — photos carry their own interest

    # accent bar, top-left
    d.rounded_rectangle([80, 96, 200, 104], radius=4, fill=ACCENT)
    d.text((80, 128), kicker or BRAND_KICKER, font=_font(700, 26), fill=ACCENT)

    # headline — shrink until it fits 4 lines
    size = 72
    while size > 40:
        font = _font(800, size)
        lines = _wrap(headline, font, W - 160)
        if len(lines) <= 4:
            break
        size -= 4
    y = 200
    for ln in lines:
        d.text((80, y), ln, font=font, fill=TEXT)
        y += int(size * 1.15)

    # footer: wordmark + url
    if BRAND_WORD1:
        d.text((80, H - 96), BRAND_WORD1, font=_font(800, 34), fill=TEXT)
        wmark_w = d.textlength(BRAND_WORD1, font=_font(800, 34))
        if BRAND_WORD2:
            d.text((80 + wmark_w + 10, H - 96), BRAND_WORD2, font=_font(400, 34), fill=TEXT_DIM)
    url_f = _font(400, 26)
    url = BRAND_URL
    d.text((W - 80 - url_f.getlength(url), H - 92), url, font=url_f, fill=TEXT_DIM)

    img.save(out_path, "PNG")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true")
    p.add_argument("--date", help="Render only this queue date (YYYY-MM-DD)")
    args = p.parse_args()

    CARDS_DIR.mkdir(exist_ok=True)
    queue = json.loads(QUEUE_FILE.read_text())

    made = 0
    for item in queue:
        if item.get("image"):
            continue  # explicit image wins; no card needed
        if args.date and item["date"] != args.date:
            continue
        out = CARDS_DIR / f"{item['date']}.png"
        if out.exists() and not args.force:
            continue
        headline = item.get("card_title") or derive_headline(item["text"])
        make_card(headline, out, body_text=item["text"])
        print(f"  card {item['date']}: {headline[:60]}")
        made += 1

    print(f"{made} card(s) rendered -> {CARDS_DIR}")


if __name__ == "__main__":
    main()
