#!/usr/bin/env python3
"""
TikTok web upload — attaches to the logged-in Brave automation session.

The session lives in a cloned profile launched with
--remote-debugging-port=9224 (see si-agent-ops). We attach over CDP,
drive tiktok.com's official upload page, and STOP before clicking Post
unless --post is passed. Default mode is a full dry run that verifies
every step up to the post button and screenshots each stage.

Usage:
  .venv/bin/python upload.py --file deal-01.mp4 --caption-file cap.txt
  .venv/bin/python upload.py --file deal-01.mp4 --caption "..." --post

Safety:
  - never launches/quits a browser, only attaches
  - --post is required for the final submit (owner pre-approval gate)
  - screenshots land in <out>/ so every run is auditable
"""
import argparse, os, sys, time
from playwright.sync_api import sync_playwright

CDP = "http://localhost:9224"
UPLOAD_URLS = ["https://www.tiktok.com/tiktokstudio/upload",
               "https://www.tiktok.com/upload"]

FILE_INPUT = 'input[type="file"]'
CAPTION_SELS = [
    'div[contenteditable="true"][data-placeholder]',
    'div.public-DraftEditor-content[contenteditable="true"]',
    'div[contenteditable="true"]',
]
POST_SELS = [
    'button:has-text("Post")',
    'div[role="button"]:has-text("Post")',
]


def shot(page, out, name):
    p = os.path.join(out, f"{name}.png")
    page.screenshot(path=p)
    print("  shot:", p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--caption", default="")
    ap.add_argument("--caption-file", default="")
    ap.add_argument("--post", action="store_true",
                    help="actually click Post (owner-approved only)")
    ap.add_argument("--cdp", default=CDP)
    ap.add_argument("--out", default=os.path.expanduser("~/dev-tmp/tiktok-vids/upload-shots"))
    args = ap.parse_args()

    caption = args.caption
    if args.caption_file:
        caption = open(os.path.expanduser(args.caption_file)).read().strip()
    f = os.path.expanduser(args.file)
    assert os.path.exists(f), f"missing {f}"
    os.makedirs(args.out, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.connect_over_cdp(args.cdp)
        ctx = browser.contexts[0]
        page = ctx.new_page()
        page.set_default_timeout(45000)
        for url in UPLOAD_URLS:
            try:
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_selector(FILE_INPUT, state="attached", timeout=15000)
                break
            except Exception:
                continue
        else:
            shot(page, args.out, "00-fail-no-upload-page")
            raise SystemExit("upload page didn't present a file input — session may be logged out")

        page.wait_for_timeout(3000)
        shot(page, args.out, "01-upload-page")

        page.set_input_files(FILE_INPUT, f)
        print("  file attached:", os.path.basename(f))
        page.wait_for_selector(CAPTION_SELS[0], timeout=60000)
        page.wait_for_timeout(4000)
        shot(page, args.out, "02-uploaded")

        if caption:
            editor = None
            for sel in CAPTION_SELS:
                editor = page.query_selector(sel)
                if editor:
                    break
            if not editor:
                raise SystemExit("caption editor not found")
            editor.click()
            page.keyboard.press("Meta+a")
            page.keyboard.type(caption, delay=8)
            page.wait_for_timeout(1500)
            shot(page, args.out, "03-caption")

        post = None
        for sel in POST_SELS:
            post = page.query_selector(sel)
            if post and post.is_visible():
                break
            post = None
        if not post:
            shot(page, args.out, "04-fail-no-post-button")
            raise SystemExit("post button not found/enabled")

        if not args.post:
            shot(page, args.out, "04-ready-DRY-RUN")
            print("DRY RUN — everything staged, Post NOT clicked.")
            print("re-run with --post once the owner approves this video.")
            return
        post.click()
        page.wait_for_timeout(6000)
        shot(page, args.out, "05-after-post")
        print("POSTED — verify on profile:", page.url)


if __name__ == "__main__":
    main()
