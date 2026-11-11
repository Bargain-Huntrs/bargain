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
        tools/social/cards/<date>.mp4  (1080x1920 TikTok/Reels card video —
        the poster prefers it for Buffer `tiktok` service channels)

Usage:
  python card_maker.py            # render all missing cards
  python card_maker.py --force    # re-render everything
  python card_maker.py --date 2026-09-23  # one item only
  python card_maker.py --format 9:16      # static vertical PNGs (<date>-9x16.png)
  python card_maker.py --video            # cards/<date>.mp4 for each queue item
  python card_maker.py --video out.mp4 --date 2026-09-23   # one file
  python card_maker.py --video out.mp4 --title "Headline"  # ad-hoc, no queue item

Video mode requires ffmpeg: PATH first, then ~/runtime/bin/ffmpeg (the
opsbox static-build convention used by the cron boxes).
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

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


_BASES: dict[tuple[int, int], Image.Image] = {}


def _gradient(w: int = W, h: int = H) -> Image.Image:
    """Vertical dark -> accent-tinted gradient with a subtle glow.
    Cached per canvas size — identical for every card. Built as a 1-px
    column and stretched: every output row is a uniform color, so the
    resize is lossless (no per-pixel x loop — fast even at video sizes)."""
    key = (w, h)
    if key in _BASES:
        return _BASES[key].copy()
    col = Image.new("RGB", (1, h))
    px = col.load()
    for y in range(h):
        t = y / h
        row = [int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)]
        # faint radial glow from top-right — cheap row-level approximation
        glow = max(0.0, 1.0 - (abs(y - h * 0.1) / h) * 1.6) * 0.18
        px[0, y] = tuple(min(255, int(c + ACCENT_DEEP[i] * glow)) for i, c in enumerate(row))
    img = col.resize((w, h))
    _BASES[key] = img
    return img.copy()


def _tint(rgb: tuple, alpha: float) -> tuple:
    """Blend a motif color into the card bg at low alpha."""
    return tuple(int(BG_BOTTOM[i] + (rgb[i] - BG_BOTTOM[i]) * alpha) for i in range(3))


# --- Topic motifs: drawn in muted accent between gradient and text. ---------
# Each returns nothing; draws on `d` at low emphasis so text stays readable.
# (w, h) is the actual canvas — motifs anchor to its right/bottom edges.

def _motif_parking(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Parking-lot stall stripes — right half, above the footer."""
    c = _tint(ACCENT, 0.22)
    for i in range(6):
        x = 640 + i * 95
        d.line([(x, h - 170), (x + 52, h - 270)], fill=c, width=7)
    d.line([(610, h - 160), (w - 60, h - 160)], fill=c, width=5)


def _motif_route(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Dashed route polyline with endpoint pins."""
    c = _tint(ACCENT, 0.30)
    pts = [(w - 420, 180), (w - 300, 320), (w - 380, 430), (w - 180, 500)]
    d.line(pts, fill=c, width=6, joint="curve")
    for (cx, cy) in (pts[0], pts[-1]):
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], outline=c, width=6)
        d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=c)


def _motif_gear(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Ghost gear silhouette, right side."""
    import math
    cx, cy, r = w - 220, 380, 120
    c = _tint(ACCENT, 0.18)
    teeth = []
    for i in range(24):
        a = i * math.tau / 24
        rr = r * (1.18 if i % 2 == 0 else 1.0)
        teeth.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(teeth, outline=c, width=8)
    d.ellipse([cx - 55, cy - 55, cx + 55, cy + 55], outline=c, width=8)


def _motif_bars(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Ascending chart bars along the bottom edge."""
    c = _tint(ACCENT, 0.22)
    heights = (90, 140, 110, 190, 160, 240)
    for i, hh in enumerate(heights):
        x = w - 140 - (len(heights) - i) * 85
        d.rounded_rectangle([x, h - 60 - hh, x + 56, h - 60], radius=6, fill=c)


def _motif_clock(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Clock ring with hands — for timeclock / HOS topics."""
    cx, cy, r = w - 200, 400, 110
    c = _tint(ACCENT, 0.22)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=10)
    d.line([(cx, cy), (cx, cy - 70)], fill=c, width=10)
    d.line([(cx, cy), (cx + 48, cy + 30)], fill=c, width=10)


def _motif_road(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Default: perspective road lines converging right."""
    c = _tint(ACCENT, 0.20)
    vx, vy = w - 120, 140
    for bx in range(100, w - 200, 180):
        d.line([(bx, h - 60), (vx, vy)], fill=c, width=6)
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


def _photo_base(topic_idx: int | None, w: int = W, h: int = H,
                cover: bool = False) -> Image.Image | None:
    """If tools/social/backgrounds/ has a photo for this topic slot, use it
    under a dark scrim. Falls back to gradient. Drop e.g. parking.jpg,
    route.jpg, gear.jpg, bars.jpg, clock.jpg, road.jpg in that dir —
    Unsplash/Pexels license allows committed reuse. `cover` crops-to-fill
    (used for the 9:16 vertical canvas so photos don't stretch)."""
    names = ["parking", "route", "gear", "bars", "clock", "road"]
    cand = [BG_DIR / f"{names[topic_idx]}.jpg"] if topic_idx is not None else []
    cand += [BG_DIR / f"{n}.jpg" for n in names] + [BG_DIR / "default.jpg"]
    for f in cand:
        if f.exists():
            img = Image.open(f).convert("RGB")
            img = ImageOps.fit(img, (w, h)) if cover else img.resize((w, h))
            scrim = Image.new("RGB", (w, h), (5, 10, 20))
            return Image.blend(img, scrim, 0.62)  # ~62% dark scrim for text legibility
    return None


TOPIC_NAMES = ("parking", "route", "gear", "bars", "clock", "road")


def render_card(headline: str, w: int = W, h: int = H, kicker: str = "",
                body_text: str = "") -> Image.Image:
    """Compose the card at any canvas size. At (1200, 630) the output is
    pixel-identical to the classic card; taller canvases (h > w) get the
    vertical layout — kicker top, headline centered, footer bottom."""
    # Score every topic by keyword hits; highest score wins. Headline hits
    # count double so a generic word in the body can't steal the motif.
    lowered_h, lowered_b = headline.lower(), body_text.lower()
    best, best_i, best_score = _motif_road, TOPIC_NAMES.index("road"), 0
    for i, (keywords, fn) in enumerate(TOPIC_MOTIFS):
        score = sum(2 * lowered_h.count(k) + lowered_b.count(k) for k in keywords)
        if score > best_score:
            best, best_i, best_score = fn, i, score
    motif, topic_idx = best, best_i

    vert = h > w
    photo = _photo_base(topic_idx, w, h, cover=vert)
    img = photo if photo is not None else _gradient(w, h)
    d = ImageDraw.Draw(img)
    if photo is None and motif:
        motif(d, w, h)  # motif only on gradient cards — photos carry their own interest

    k = w / 1200.0          # all design metrics scale with card width
    mx = int(80 * k)        # side margin

    # accent bar + kicker
    bar_y = int(h * 0.14) if vert else int(96 * k)
    kick_y = bar_y + int(40 * k) if vert else int(128 * k)
    d.rounded_rectangle([mx, bar_y, mx + int(120 * k), bar_y + max(4, int(8 * k))],
                        radius=max(2, int(4 * k)), fill=ACCENT)
    d.text((mx, kick_y), kicker or BRAND_KICKER,
           font=_font(700, int(26 * k)), fill=ACCENT)

    # headline — shrink until it fits the line budget
    size = int(72 * k)
    max_lines = 9 if vert else 4
    while size > int(40 * k):
        font = _font(800, size)
        lines = _wrap(headline, font, w - 2 * mx)
        if len(lines) <= max_lines:
            break
        size -= max(2, int(4 * k))
    if vert:
        # vertically center the headline block in the free middle band
        block = len(lines) * int(size * 1.15)
        y = max(int(h * 0.24), (h - block) // 2)
    else:
        y = int(200 * k)
    for ln in lines:
        d.text((mx, y), ln, font=font, fill=TEXT)
        y += int(size * 1.15)

    # footer: wordmark + url
    foot_y = h - int(96 * k)
    if BRAND_WORD1:
        wf = _font(800, int(34 * k))
        d.text((mx, foot_y), BRAND_WORD1, font=wf, fill=TEXT)
        wmark_w = d.textlength(BRAND_WORD1, font=wf)
        if BRAND_WORD2:
            d.text((mx + wmark_w + int(10 * k), foot_y), BRAND_WORD2,
                   font=_font(400, int(34 * k)), fill=TEXT_DIM)
    url_f = _font(400, int(26 * k))
    url = BRAND_URL
    d.text((w - mx - url_f.getlength(url), foot_y + int(4 * k)), url,
           font=url_f, fill=TEXT_DIM)

    return img


def make_card(headline: str, out_path: Path, kicker: str = "",
              body_text: str = "", size: tuple[int, int] | None = None) -> None:
    w, h = size or (W, H)
    img = render_card(headline, w, h, kicker=kicker, body_text=body_text)
    img.save(out_path, "PNG")


# --- TikTok-ready vertical video --------------------------------------------
# 9:16 MP4 (1080x1920, ~6s, H.264 + silent AAC — Buffer/TikTok wants an audio
# stream, silence is accepted). The card is rendered once on an overscan
# canvas, then ffmpeg's crop filter (x/y/w/h are evaluated per output frame)
# does the Ken Burns push-in + drift and scales down — one ffmpeg call,
# no frame sequence, ~15s total.

VIDEO_W, VIDEO_H = 1080, 1920
VIDEO_FPS = 25
VIDEO_SECONDS = 6.0
OVERSCAN = 1.35  # canvas > frame so the Ken Burns crop never shows edges


def _ffmpeg_bin() -> str | None:
    """ffmpeg from PATH, else the opsbox static-build convention
    (~/runtime/bin/ffmpeg) used by the cron boxes."""
    hit = shutil.which("ffmpeg")
    if hit:
        return hit
    cand = Path.home() / "runtime" / "bin" / "ffmpeg"
    return str(cand) if cand.is_file() else None


def make_video(headline: str, out_path: Path, kicker: str = "",
               body_text: str = "", seconds: float = VIDEO_SECONDS) -> None:
    ff = _ffmpeg_bin()
    if not ff:
        raise SystemExit("ffmpeg required for --video — not on PATH and "
                         "~/runtime/bin/ffmpeg missing (static build lives "
                         "there on the cron boxes)")
    ow, oh = int(VIDEO_W * OVERSCAN), int(VIDEO_H * OVERSCAN)
    card = render_card(headline, ow, oh, kicker=kicker, body_text=body_text)

    frames = max(2, int(VIDEO_FPS * seconds))
    t = f"(n/{frames - 1})"
    e = f"({t}*{t}*(3-2*{t}))"   # smoothstep ease-in/out, 0 -> 1
    vf = (
        # crop window shrinks 100% -> ~91% (1.10x push-in) and drifts
        # ~4% right / ~3% down; canvas is 9:16 so w/h stay in ratio
        f"crop=w='iw/(1+0.10*{e})':h='ih/(1+0.10*{e})'"
        f":x='(iw-ow)/2+({e}-0.5)*iw*0.04'"
        f":y='(ih-oh)/2+({e}-0.5)*ih*0.03'"
        f",scale={VIDEO_W}:{VIDEO_H}:flags=lanczos"
    )
    tmp = Path(tempfile.mkstemp(suffix=".png")[1])
    try:
        card.save(tmp, "PNG")
        rc = subprocess.call(
            [ff, "-hide_banner", "-loglevel", "error", "-y",
             "-loop", "1", "-framerate", str(VIDEO_FPS), "-i", str(tmp),
             "-f", "lavfi", "-t", str(seconds), "-i", "anullsrc=r=44100:cl=stereo",
             "-vf", vf, "-t", str(seconds),
             "-c:v", "libx264", "-preset", "medium", "-crf", "21",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
             "-shortest", "-movflags", "+faststart", str(out_path)]
        )
    finally:
        tmp.unlink(missing_ok=True)
    if rc != 0:
        raise SystemExit(f"ffmpeg failed rendering {out_path}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true")
    p.add_argument("--date", help="Render only this queue date (YYYY-MM-DD)")
    p.add_argument("--format", choices=["16:9", "9:16"], default="16:9",
                   help="PNG aspect — 16:9 = 1200x630 (default); 9:16 renders "
                        "1080x1920 vertical cards as cards/<date>-9x16.png")
    p.add_argument("--video", nargs="?", const="-", metavar="OUT.mp4",
                   help="Bare: render cards/<date>.mp4 for each queue item. "
                        "With a path: render one MP4 (pair with --date or --title)")
    p.add_argument("--title", help="Ad-hoc headline for a single --video render")
    args = p.parse_args()

    CARDS_DIR.mkdir(exist_ok=True)
    queue = json.loads(QUEUE_FILE.read_text())

    def headline_for(item: dict) -> str:
        return item.get("card_title") or derive_headline(item["text"])

    # Single ad-hoc video: --video out.mp4 [--date D | --title T]
    if args.video and args.video != "-":
        if args.title:
            headline, body = args.title, ""
        else:
            item = next((i for i in queue if i["date"] == args.date), None)
            if item is None:
                raise SystemExit("--video PATH needs --date <queued date> "
                                 "or --title 'headline'")
            headline, body = headline_for(item), item["text"]
        make_video(headline, Path(args.video), body_text=body)
        print(f"video -> {args.video}")
        return

    vertical = args.format == "9:16"
    suffix = "-9x16" if vertical else ""
    made = 0
    for item in queue:
        if item.get("image"):
            continue  # explicit image wins; no card needed
        if args.date and item["date"] != args.date:
            continue
        headline = headline_for(item)
        if args.video == "-":
            out = CARDS_DIR / f"{item['date']}.mp4"
            if out.exists() and not args.force:
                continue
            make_video(headline, out, body_text=item["text"])
            print(f"  video {item['date']}: {headline[:60]}")
        else:
            out = CARDS_DIR / f"{item['date']}{suffix}.png"
            if out.exists() and not args.force:
                continue
            make_card(headline, out, body_text=item["text"],
                      size=(VIDEO_W, VIDEO_H) if vertical else (W, H))
            print(f"  card {item['date']}: {headline[:60]}")
        made += 1

    print(f"{made} asset(s) rendered -> {CARDS_DIR}")


if __name__ == "__main__":
    main()
