#!/usr/bin/env python3
"""
BargainHuntrs TikTok "deal card" video generator (draft tool — not shipped).

Renders 1080x1920 (9:16) ~16s mp4s from live /api/v1/arbitrage/deals/public data:
  scene 1: hook text            scene 2: product card
  scene 3: price flip card      scene 4: follow/end card

Usage:
  .venv/bin/python gen.py --out ~/dev-tmp/tiktok-vids/batch1 --n 5
  .venv/bin/python gen.py --out <dir> --asins B001RQ0G3M,B0HMFLDWTT,...
"""
import argparse, io, json, math, os, re, subprocess, sys, tempfile
import urllib.request
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
API = "https://api.bargainhuntrs.com/api/v1/arbitrage/deals/public?limit=100"

# Brand palette (from bargain-web: emerald accent + amber secondary on near-black)
BG_TOP    = (10, 14, 12)      # #0A0E0C
BG_BOT    = (5, 7, 6)         # near black
EMERALD   = (52, 211, 153)    # emerald-400
EMERALD_D = (6, 95, 70)       # emerald-800-ish pill fill
AMBER     = (251, 191, 36)    # amber-400
WHITE     = (245, 245, 245)
MUTED     = (156, 163, 175)   # gray-400
CARD_BG   = (18, 24, 21)      # panel

F_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
F_BOLD  = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
F_REG   = "/System/Library/Fonts/Supplemental/Arial.ttf"

@lru_cache(maxsize=64)
def font(path, size):
    return ImageFont.truetype(path, size)

def tw(d, s, f):
    return d.textlength(s, font=f)

def draw_center(d, y, s, f, fill, x=W // 2, stroke=0, stroke_fill=(0, 0, 0)):
    d.text((x - tw(d, s, f) / 2, y), s, font=f, fill=fill,
           stroke_width=stroke, stroke_fill=stroke_fill)

def draw_center_runs(d, y, runs, x=W // 2):
    """runs = [(text, font, fill), ...] drawn as one centered line."""
    total = sum(tw(d, s, f) for s, f, _ in runs)
    cx = x - total / 2
    for s, f, fill in runs:
        d.text((cx, y), s, font=f, fill=fill)
        cx += tw(d, s, f)

def autofit(d, text, path, max_w, start, minimum=40):
    s = start
    while s > minimum and tw(d, text, font(path, s)) > max_w:
        s -= 4
    return font(path, s)

def wrap(d, text, f, max_w, max_lines=2):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if tw(d, t, f) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
            if len(lines) == max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines and tw(d, lines[-1], f) > 0 and " ".join(words) != " ".join(lines):
        while lines[-1] and tw(d, lines[-1] + "…", f) > max_w:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip(" ,;:-–—") + "…"
    return lines

def rr(d, box, r, **kw):
    d.rounded_rectangle(box, radius=r, **kw)

# ---------- background ----------

def base_canvas(glow=True):
    # vertical gradient via 1-px-wide strip resized up (fast)
    strip = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / H
        strip.putpixel((0, y), tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t)
                                     for i in range(3)))
    img = strip.resize((W, H))
    if glow:
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        od.ellipse((-300, -420, 900, 500), fill=EMERALD + (46,))    # top glow
        od.ellipse((500, 1500, 1500, 2300), fill=EMERALD + (30,))   # bottom glow
        ov = ov.filter(ImageFilter.GaussianBlur(180))
        img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    # thin emerald frame accent
    fd = ImageDraw.Draw(img)
    fd.rectangle((14, 14, W - 14, H - 14), outline=(28, 40, 35), width=3)
    return img

def pill(d, cx, y, text, f, fg, bg=None, pad_x=34, pad_y=14, outline=None):
    w = tw(d, text, f)
    x0, y0 = cx - w / 2 - pad_x, y
    x1, y1 = cx + w / 2 + pad_x, y + f.size + pad_y * 2
    if bg:
        rr(d, (x0, y0, x1, y1), (y1 - y0) / 2, fill=bg)
    if outline:
        rr(d, (x0, y0, x1, y1), (y1 - y0) / 2, outline=outline, width=4)
    d.text((cx - w / 2, y0 + pad_y - 2), text, font=f, fill=fg)
    return y1

TIER_LABEL = {"glitch": "PRICE GLITCH", "clearance": "CLEARANCE FIND",
              "arbitrage": "ARBITRAGE FLIP", "coupon": "COUPON STACK"}

def tier_pill(d, tier, y):
    label = TIER_LABEL.get((tier or "").lower(), "DEAL ALERT")
    return pill(d, W // 2, y, label, font(F_BOLD, 44), AMBER, outline=EMERALD)

# ---------- data helpers ----------

JUNK_PREFIX = re.compile(r"^(sold? ?out quickly!|will sell out!|selling fast!|hurry!)\s*", re.I)
JUNK_TAIL   = re.compile(r"\s*[|\u2013\u2014-]\s*[^|]*$")

def clean_title(t):
    t = JUNK_PREFIX.sub("", t or "").strip()
    t = re.sub(r"\s*\(newest model\)", "", t, flags=re.I)
    if len(t) > 80:
        t = JUNK_TAIL.sub("", t)
    t = re.sub(r"\s+", " ", t).strip(" ,;:-–—|")
    return t[:90]

def money(v, cents=True):
    return f"${v:,.2f}" if cents else f"${round(v):,}"

def profit(d):
    return d["sell_price"] - d["buy_price"]

def mult(d):
    return d["sell_price"] / d["buy_price"]

def usable(d):
    return (d.get("is_profitable") and d.get("image_url")
            and "/placeholder/" not in d["image_url"]
            and d.get("buy_price") and d.get("sell_price")
            and d["sell_price"] > d["buy_price"]
            and "+1 colors" not in (d.get("title") or "")
            and "+ colors" not in (d.get("title") or ""))

# ---------- scenes ----------

def scene_hook(deal):
    img = base_canvas()
    d = ImageDraw.Draw(img)
    tier_pill(d, deal.get("deal_tier"), 560)
    buy_s, sell_s = money(deal["buy_price"], False), money(deal["sell_price"], False)

    f_this = autofit(d, f"THIS {buy_s} ITEM", F_BLACK, W - 160, 150)
    y = 760
    draw_center_runs(d, y, [("THIS ", f_this, WHITE), (buy_s, f_this, AMBER),
                            (" ITEM", f_this, WHITE)])
    f_flip = font(F_BLACK, 118)
    draw_center(d, y + f_this.size + 60, "FLIPS FOR", f_flip, WHITE)
    f_sell = autofit(d, sell_s, F_BLACK, W - 160, 320)
    draw_center(d, y + f_this.size + 60 + f_flip.size + 70, sell_s, f_sell, EMERALD)
    return img

def product_card(canvas, d, img_art, cx, cy, cw, ch, pad=44):
    """White rounded card containing the product image, returns card box."""
    x0, y0, x1, y1 = cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2
    rr(d, (x0 + 8, y0 + 14, x1 + 8, y1 + 14), 48, fill=(4, 6, 5))       # shadow
    rr(d, (x0, y0, x1, y1), 48, fill=(250, 250, 250), outline=EMERALD, width=5)
    aw, ah = cw - pad * 2, ch - pad * 2
    iw, ih = img_art.size
    s = min(aw / iw, ah / ih)
    art = img_art.resize((max(1, int(iw * s)), max(1, int(ih * s))), Image.LANCZOS)
    canvas.paste(art, (int(cx - art.width / 2), int(cy - art.height / 2)))
    return (x0, y0, x1, y1)

def scene_product(deal, art):
    img = base_canvas()
    d = ImageDraw.Draw(img)
    d._image = img
    title = clean_title(deal["title"])
    f_t = font(F_BOLD, 58)
    lines = wrap(d, title, f_t, W - 180, max_lines=2)
    y = 300
    for ln in lines:
        draw_center(d, y, ln, f_t, WHITE)
        y += 74
    product_card(img, d, art, W // 2, 1040, 880, 780)
    tier_pill(d, deal.get("deal_tier"), 1560)
    return img

def scene_price(deal, art):
    img = base_canvas()
    d = ImageDraw.Draw(img)
    product_card(img, d, art, W // 2, 560, 720, 560)

    # price panel
    px0, py0, px1, py1 = 80, 960, W - 80, 1360
    rr(d, (px0, py0, px1, py1), 44, fill=CARD_BG, outline=(40, 55, 48), width=3)
    f_lab, f_val = font(F_BOLD, 54), font(F_BLACK, 84)
    d.text((px0 + 70, py0 + 78), "BUY", font=f_lab, fill=MUTED)
    bv = money(deal["buy_price"])
    d.text((px1 - 70 - tw(d, bv, f_val), py0 + 52), bv, font=f_val, fill=WHITE)
    d.line((px0 + 60, py0 + 200, px1 - 60, py0 + 200), fill=(45, 60, 53), width=3)
    d.text((px0 + 70, py0 + 268), "SELL", font=f_lab, fill=MUTED)
    sv = money(deal["sell_price"])
    d.text((px1 - 70 - tw(d, sv, f_val), py0 + 242), sv, font=f_val, fill=EMERALD)
    # arrow between rows
    ar = font(F_BOLD, 70)
    d.text((W / 2 - tw(d, "↓", ar) / 2, py0 + 148), "↓", font=ar, fill=AMBER)

    p, m = profit(deal), mult(deal)
    y = pill(d, W // 2, 1470, f"+{money(p)} PROFIT", font(F_BLACK, 72),
             (6, 20, 14), bg=EMERALD, pad_x=48, pad_y=20)
    pill(d, W // 2, y + 34, f"{m:.1f}X RETURN", font(F_BOLD, 52), AMBER, outline=AMBER)
    return img

def scene_end():
    img = base_canvas()
    d = ImageDraw.Draw(img)
    f_logo = autofit(d, "BARGAINHUNTRS", F_BLACK, W - 140, 130)
    draw_center_runs(d, 640, [("BARGAIN", f_logo, WHITE), ("HUNTRS", f_logo, EMERALD)])
    f_sub = font(F_BOLD, 62)
    draw_center(d, 860, "FOLLOW", f_sub, MUTED)
    f_h = autofit(d, "@bargain.huntrs", F_BLACK, W - 140, 120)
    draw_center(d, 960, "@bargain.huntrs", f_h, WHITE)
    draw_center(d, 960 + f_h.size + 50, "for daily flips", font(F_BOLD, 58), MUTED)

    url = "bargainhuntrs.com"
    f_u = font(F_BOLD, 64)
    uy = 1330
    draw_center(d, uy, url, f_u, AMBER)
    uw = tw(d, url, f_u)
    d.line((W / 2 - uw / 2, uy + f_u.size + 16, W / 2 + uw / 2, uy + f_u.size + 16),
           fill=AMBER, width=4)
    draw_center(d, 1760, "Deals may earn us a commission · #ad",
                font(F_REG, 34), MUTED)
    return img

# ---------- images / video ----------

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def hires_url(u):
    """Amazon image URLs accept size tokens — bump SR/preview sizes to SL1200."""
    if "media-amazon.com" in u and "_AC_" in u:
        return re.sub(r"\._AC_[A-Z0-9,]+_", "._AC_SL1200_", u)
    return u

def get_art(deal, cache):
    u = deal["image_url"]
    path = os.path.join(cache, re.sub(r"[^A-Za-z0-9]", "_", u)[:80] + ".img")
    if not os.path.exists(path):
        for cand in [hires_url(u), u]:
            try:
                data = fetch(cand)
                Image.open(io.BytesIO(data)).verify()
                open(path, "wb").write(data)
                break
            except Exception:
                continue
    try:
        art = Image.open(path).convert("RGB")
        return art, art.size
    except Exception:
        return None, None

def build_video(scenes, out_path, ffmpeg="ffmpeg"):
    durs = [3.0, 5.5, 5.5, 3.6]
    xf = 0.35
    with tempfile.TemporaryDirectory() as td:
        for i, s in enumerate(scenes):
            s.save(os.path.join(td, f"s{i}.png"))
        cmd = [ffmpeg, "-y"]
        for i, d_ in enumerate(durs):
            frames = int(d_ * 30)
            cmd += ["-loop", "1", "-framerate", "30", "-t", str(d_),
                    "-i", os.path.join(td, f"s{i}.png")]
        cmd += ["-f", "lavfi", "-t", str(sum(durs)), "-i", "anullsrc=r=44100:cl=stereo"]
        fc = []
        for i in range(4):
            frames = int(durs[i] * 30)
            fc.append(f"[{i}:v]scale=2160:3840,"
                      f"zoompan=z='1+0.10*on/{frames}':x='iw/2-(iw/zoom/2)':"
                      f"y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1[v{i}]")
        off, total = 0.0, 0.0
        acc = "[v0]"
        for i in range(1, 4):
            total += durs[i - 1]
            off = total - i * xf
            out = f"[x{i}]" if i < 3 else "[vout]"
            fc.append(f"{acc}[v{i}]xfade=transition=fade:duration={xf}:offset={off:.2f}{out}")
            acc = out
        dur_total = sum(durs) - 3 * xf
        cmd += ["-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "4:a",
                "-t", f"{dur_total:.2f}", "-c:v", "libx264", "-preset", "medium",
                "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
                "-movflags", "+faststart", out_path]
        subprocess.run(cmd, check=True, capture_output=True)
    return dur_total

# ---------- selection ----------

def select(deals, n, asins=None):
    ok = [d for d in deals if usable(d)]
    if asins:
        picks = []
        for a in asins:
            m = next((d for d in ok if a.lower() in str(d.get("asin", "")).lower()
                      or a.lower() in (d.get("title") or "").lower()), None)
            if m:
                picks.append(m)
        return picks[:n]
    # auto: dedupe near-identical titles, spread tiers, prefer high profit
    seen, picks = set(), []
    for d in sorted(ok, key=profit, reverse=True):
        key = re.sub(r"\W+", "", clean_title(d["title"]).lower())[:22]
        if key in seen:
            continue
        seen.add(key)
        picks.append(d)
        if len(picks) == n:
            break
    return picks

CAPTIONS = {
    "hook": ["This {b} find flips for {s}.",
             "{b} in, {s} out — the flip is real.",
             "Buy at {b}, sell at {s}. Daily finds like this, every day."],
}
DISCLOSURE = "Deals may earn us a commission #ad #reseller #arbitrage #sidehustle"
CTA = "Follow for daily flips — bargainhuntrs.com"

def caption(deal, i):
    b, s = money(deal["buy_price"], False), money(deal["sell_price"], False)
    hook = CAPTIONS["hook"][i % 3].format(b=b, s=s)
    p = profit(deal)
    return f"{hook} +{money(p)} profit ({mult(deal):.1f}x). {CTA}. {DISCLOSURE}"

# ---------- main ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--n", type=int, default=5)
    ap.add_argument("--asins", default="")
    ap.add_argument("--deals-json", default="", help="use cached deals json")
    ap.add_argument("--scenes-only", action="store_true")
    args = ap.parse_args()

    out = os.path.expanduser(args.out)
    assets = os.path.join(out, "assets")
    scenes_dir = os.path.join(out, "scenes")
    os.makedirs(assets, exist_ok=True)
    os.makedirs(scenes_dir, exist_ok=True)

    if args.deals_json and os.path.exists(args.deals_json):
        deals = json.load(open(args.deals_json))
    else:
        deals = json.loads(fetch(API))
        json.dump(deals, open(os.path.join(assets, "deals-cache.json"), "w"))

    asins = [a.strip() for a in args.asins.split(",") if a.strip()]
    picks = select(deals, args.n, asins or None)
    print(f"selected {len(picks)} deals")

    manifest = ["BARGAINHUNTRS TIKTOK DEAL-CARD VIDEOS — DRAFT BATCH 1",
                "Rendered: draft only — DO NOT POST without owner review", ""]
    for i, deal in enumerate(picks, 1):
        name = f"deal-{i:02d}"
        art, size = get_art(deal, assets)
        if not art:
            print(f"  !! {name}: image failed, skipping")
            continue
        scenes = [scene_hook(deal), scene_product(deal, art),
                  scene_price(deal, art), scene_end()]
        sp = os.path.join(scenes_dir, name)
        os.makedirs(sp, exist_ok=True)
        for j, s in enumerate(scenes, 1):
            s.save(os.path.join(sp, f"{j}.png"))
        mp4 = os.path.join(out, f"{name}.mp4")
        if not args.scenes_only:
            dur = build_video(scenes, mp4)
        else:
            dur = sum([3.0, 5.5, 5.5, 3.6]) - 3 * 0.35
        title = clean_title(deal["title"])
        print(f"  {name}: {title[:60]}  ${deal['buy_price']}→${deal['sell_price']}  img={size}")
        manifest += [
            f"=== {name}.mp4 (~{dur:.1f}s) ===",
            f"title : {title}",
            f"tier  : {deal.get('deal_tier')} | retailer: {deal.get('retailer')}",
            f"buy   : {money(deal['buy_price'])}  sell: {money(deal['sell_price'])}"
            f"  profit: +{money(profit(deal))}  ({mult(deal):.1f}x return)",
            f"asin  : {deal.get('asin')} | source img: {size[0]}x{size[1]}px",
            f"buy   : {deal.get('buy_url')}",
            f"caption (DRAFT):",
            f"  {caption(deal, i)}",
            "",
        ]
    mf = os.path.join(out, "batch1-manifest.txt")
    open(mf, "w").write("\n".join(manifest))
    print("manifest ->", mf)

if __name__ == "__main__":
    main()
