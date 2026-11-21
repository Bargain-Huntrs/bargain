#!/usr/bin/env python3
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
                names = {c["name"] for c in b.contexts[0].cookies(
                    "https://www.tiktok.com")}
                return "sessionid" in names
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
    item["status"] = "posted"
    item["posted_at"] = time.strftime("%Y-%m-%d %H:%M")
    with open(QUEUE, "w") as f:
        json.dump(q, f, indent=2)
    print(f"posted {os.path.basename(item['file'])}")


if __name__ == "__main__":
    main()
