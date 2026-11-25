#!/Volumes/Os_Sites/Bargain/tools/tiktok-video/.venv/bin/python3
"""Post the next queued v2 deal video to @bargain.huntrs.

Reads ~/dev-tmp/tiktok-vids/queue.json, posts the first item with
status "pending", marks it posted on success. Exits non-zero if the
TikTok session is not logged in (caller should alert, not retry).

Ensures the automation Brave instance (tt-fresh-profile, CDP :9226)
is running first; launches it if not — it is an isolated clone, never
the owner's live browser.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

QUEUE = os.path.expanduser("~/dev-tmp/tiktok-vids/queue.json")
CDP = "http://localhost:9226"
BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
PROFILE = "/tmp/tt-fresh-profile"
HERE = os.path.dirname(os.path.abspath(__file__))


def cdp_up() -> bool:
    try:
        urllib.request.urlopen(CDP + "/json/version", timeout=3)
        return True
    except Exception:
        return False


def ensure_browser():
    if cdp_up():
        return
    subprocess.Popen(
        [BRAVE, f"--user-data-dir={PROFILE}", "--remote-debugging-port=9226",
         "--disable-crashpad", "--no-first-run", "--no-default-browser-check"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(20):
        time.sleep(1.5)
        if cdp_up():
            return
    sys.exit("error: Brave automation instance did not come up")


def logged_in() -> bool:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        for _ in range(3):
            try:
                b = pw.chromium.connect_over_cdp(CDP, timeout=20000)
                ctx0 = b.contexts[0]
                cj = os.environ.get("TT_COOKIE_JSON", "/tmp/tt-cookies-bargain.json")
                if os.path.exists(cj):
                    try:
                        cc = json.load(open(cj))
                        for c in cc:
                            if c.get("expires") == -1:
                                c.pop("expires", None)
                            c.setdefault("sameSite", "Lax")
                        ctx0.add_cookies(cc)
                    except Exception:
                        pass
                names = {c["name"] for c in ctx0.cookies(
                    "https://www.tiktok.com")}
                if "sessionid" in names:
                    return True
                pg = b.contexts[0].pages[0] if b.contexts[0].pages else b.contexts[0].new_page()
                try:
                    pg.goto("https://www.tiktok.com/tiktokstudio/upload",
                            wait_until="domcontentloaded", timeout=60000)
                    pg.wait_for_timeout(6000)
                except Exception:
                    pass
                if pg.query_selector('input[type="file"]'):
                    return True
                    return True
            except Exception:
                time.sleep(5)
    return False


def main():
    with open(QUEUE) as f:
        q = json.load(f)
    item = next((i for i in q if i["status"] == "pending"), None)
    if not item:
        print("queue empty — nothing to post")
        return
    ensure_browser()
    if not logged_in():
        sys.exit("error: TikTok session not logged in — needs re-auth, stopping")
    venv_py = os.path.join(HERE, ".venv", "bin", "python")
    r = subprocess.run(
        [venv_py, os.path.join(HERE, "upload.py"), "--file", item["file"],
         "--caption", item["caption"], "--post"],
        capture_output=True, text=True, timeout=600)
    print(r.stdout[-1500:])
    if r.returncode != 0 or "POSTED" not in r.stdout:
        sys.exit(f"error: upload failed\n{r.stdout[-800:]}\n{r.stderr[-800:]}")
    # verify: post must appear in Studio Posts list — silent drops happen
    ok = False
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        for _ in range(4):
            try:
                b = pw.chromium.connect_over_cdp(CDP, timeout=20000)
                pg = b.contexts[0].new_page()
                pg.goto("https://www.tiktok.com/tiktokstudio/content",
                        wait_until="domcontentloaded", timeout=60000)
                pg.wait_for_timeout(9000)
                txt = pg.evaluate("document.body.innerText")
                frag = item["caption"].split(".")[0][:20]
                if frag in txt:
                    ok = True
                pg.close()
                break
            except Exception:
                time.sleep(10)
    item["status"] = "posted" if ok else "pending"
    item["posted_at"] = time.strftime("%Y-%m-%d %H:%M") if ok else None
    if not ok:
        sys.exit("error: post submitted but not visible in Studio — held or dropped")
    with open(QUEUE, "w") as f:
        json.dump(q, f, indent=2)
    print(f"posted + verified {os.path.basename(item['file'])}")


if __name__ == "__main__":
    main()
