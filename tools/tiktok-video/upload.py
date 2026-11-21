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

CDP = "http://localhost:9226"  # /tmp/tt-fresh-profile (bargain.huntrs session)
UPLOAD_URLS = ["https://www.tiktok.com/tiktokstudio/upload",
               "https://www.tiktok.com/upload"]

FILE_INPUT = 'input[type="file"]'
CAPTION_SELS = [
    'div.public-DraftEditor-content[contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]',
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
            for attempt in range(2):  # Studio SPA can boot slowly — one reload retry
                try:
                    if attempt:
                        page.reload(wait_until="domcontentloaded")
                    else:
                        page.goto(url, wait_until="domcontentloaded")
                    page.wait_for_selector(FILE_INPUT, state="attached", timeout=60000)
                    break
                except Exception:
                    continue
            else:
                continue
            break
        else:
            shot(page, args.out, "00-fail-no-upload-page")
            raise SystemExit("upload page didn't present a file input — session may be logged out")

        page.wait_for_timeout(3000)
        shot(page, args.out, "01-upload-page")

        page.set_input_files(FILE_INPUT, f)
        print("  file attached:", os.path.basename(f))
        for sel in CAPTION_SELS:
            try:
                page.wait_for_selector(sel, timeout=60000)
                break
            except Exception:
                continue
        else:
            shot(page, args.out, "02-fail-no-caption")
            raise SystemExit("uploaded but caption editor never appeared")
        # the "Turn on automatic content checks?" modal appears AFTER upload
        # processing — give it a moment to pop before dismissing
        try:
            page.wait_for_selector('.TUXModal', timeout=15000)
        except Exception:
            pass
        # (modal-scoped only — a bare page "Cancel" could discard the upload)
        for sel in ['.TUXModal button:has-text("Turn on")',
                    '.TUXModal button:has-text("Cancel")',
                    'button:has-text("Got it")']:
            el = page.query_selector(sel)
            if el and el.is_visible():
                try:
                    el.click(timeout=4000)
                    page.wait_for_timeout(800)
                except Exception:
                    pass
        page.wait_for_timeout(3000)
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
            page.keyboard.press("Backspace")  # Draft.js needs an explicit delete —
            page.keyboard.press("Meta+a")     # select-all alone can leave residue
            page.keyboard.press("Backspace")
            page.keyboard.type(caption, delay=8)
            page.wait_for_timeout(1500)
            shot(page, args.out, "03-caption")

        def real_post_btn():
            # exact-text "Post" outside the sidebar — :has-text substring-
            # matches the "Posts" nav item (clicking it discards the upload)
            return page.evaluate("""() => {
                const b=[...document.querySelectorAll('button,div[role=button]')]
                  .filter(e=>e.innerText.trim()==='Post'&&e.offsetWidth
                            &&!e.closest('nav')&&!e.closest('[class*=sidebar]'));
                return b.length}""") > 0

        def click_exact(txt):
            return page.evaluate("""(txt) => {
                const b=[...document.querySelectorAll('button,div[role=button]')]
                  .filter(e=>e.innerText.trim()===txt&&e.offsetWidth
                            &&!e.closest('nav')&&!e.closest('[class*=sidebar]'));
                if(b.length){b[b.length-1].click();return true} return false}""", txt)

        def click_modal(txt):
            # strictly inside a TUX dialog — never the form's own buttons
            return page.evaluate("""(txt) => {
                const m=[...document.querySelectorAll('.TUXModal,[role=dialog]')];
                for(const d of m){
                  const b=[...d.querySelectorAll('button,div[role=button]')]
                    .find(e=>e.innerText.trim()===txt&&e.offsetWidth);
                  if(b){b.click();return true}} return false}""", txt)

        if not real_post_btn():
            shot(page, args.out, "04-fail-no-post-button")
            raise SystemExit("post button not found/enabled")

        if not args.post:
            shot(page, args.out, "04-ready-DRY-RUN")
            print("DRY RUN — everything staged, Post NOT clicked.")
            print("re-run with --post once the owner approves this video.")
            return

        click_exact("Post")
        page.wait_for_timeout(3000)
        # post-click dialogs: "Continue to post?" → Post now;
        # accidental nav guard "Are you sure you want to exit?" → Cancel + retry
        for _ in range(3):
            if click_modal("Post now"):
                page.wait_for_timeout(3000)
                continue
            if click_modal("Cancel"):
                page.wait_for_timeout(1500)
                click_exact("Post")
                page.wait_for_timeout(3000)
                continue
            break
        # verify: success = nav away from /upload (to /content)
        for _ in range(20):
            if "upload" not in page.url:
                break
            page.wait_for_timeout(3000)
        shot(page, args.out, "05-after-post")
        if "upload" in page.url:
            raise SystemExit("Post click never navigated — post NOT confirmed")
        print("POSTED — verify on profile:", page.url)


if __name__ == "__main__":
    main()
