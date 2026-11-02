# Needs Human
- ~~2026-10-25~~ | **RESOLVED 2026-11-02** — SCRAPE_CRON_SECRET generated, set on opsbox bargain-api env + gh secret on Bargain-Huntrs/bargain; verified 403/200 end-to-end. | ref: arbitrage.py
- 2026-10-25 | Sec-audit collision: ~9 bargain-web WIP files (devin-legal-docs work) were dropped from the worktree during concurrent commit churn | needs: recover via `git checkout 7c9164c -- bargain-web/src/...` if that work is still wanted (orphan commit holds the eslint-fixed snapshot) | ref: git reflog, commits 7c9164c/f54776a
