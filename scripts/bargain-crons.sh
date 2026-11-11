#!/bin/bash
# bargain-crons.sh — local social-posting cron (launchd-driven).
# Usage: bargain-crons.sh <job>
#
#   social-daily      daily → cards → poster → commit state
#
# Posting model: X/IG go through Buffer (BUFFER_* in tools/social/.env);
# Bluesky/Mastodon/FB/etc post direct when their creds exist. Platforms
# without creds are skipped, not failed — the job only alerts when
# NOTHING posts at all.
#
# NOTE: the oracle pm2 proc `bargain-social` is a different pipeline — it
# scrapes Impact deals and posts live deals to Buffer 3x/day via the API.
# This job posts curated marketing content once daily. They coexist.
#
# Secrets: tools/social/.env in the repo checkout (never committed).
# Runs in ~/bargain-deploy (clean clone — keeps the working tree untouched).

set -uo pipefail
JOB="$1"
CLONE=/Users/obdulreid/bargain-deploy
ENV="$CLONE/tools/social/.env"
ENV_CACHE="$CLONE/.social-env.cache"
LOG=/tmp/bargain-crons.log
PY=/Volumes/Os_Sites/Prime/tools/.venv/bin/python3

# launchd gives a minimal env; HOME may be unset — recover it before anything uses it
HOME="${HOME:-$(dscl . -read "/Users/${USER:-$(id -un)}" NFSHomeDirectory 2>/dev/null | awk '{print $2}')}"
export HOME

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
NODE_BIN="$(ls -d "$NVM_DIR"/versions/node/v24*/bin 2>/dev/null | tail -1)"
[ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"
command -v node >/dev/null 2>&1 || export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

LOCK="/tmp/bargain-cron-$JOB.lock"
shlock -f "$LOCK" -p $$ || exit 0
trap 'rm -f "$LOCK"' EXIT

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [$JOB] $*" >>"$LOG"; }

if head -1 "$ENV" >/dev/null 2>&1; then
  set -a && . "$ENV" && set +a
  cp "$ENV" "$ENV_CACHE" 2>/dev/null || true
elif [ -f "$ENV_CACHE" ]; then
  log "WARN: $ENV missing/unreadable — using cached env"
  set -a && . "$ENV_CACHE" && set +a
else
  log "ALERT: env file missing and no cache — creds-dependent steps will fail"
fi

cd "$CLONE" || exit 1
git fetch -q origin main >>"$LOG" 2>&1
git rebase origin/main -q >>"$LOG" 2>&1 || { git rebase --abort >/dev/null 2>&1; git merge --ff-only origin/main >>"$LOG" 2>&1; }

commit_state() {
  git config user.name "bargain-social-bot"
  git config user.email "bot@bargainhuntrs.com"
  git add tools/social/posted_state.json tools/social/content_queue.json 2>/dev/null
  git diff --cached --quiet || git commit -qm "chore(cron): $JOB state [skip ci]" && git push -q origin main >>"$LOG" 2>&1
}

case "$JOB" in
  social-daily)
    PY_BIN="$PY"; [ -x "$PY_BIN" ] || PY_BIN="$(command -v python3 || true)"
    [ "$PY_BIN" = "$PY" ] || log "WARN: venv python missing — using $PY_BIN"
    "$PY_BIN" tools/social/card_maker.py >>"$LOG" 2>&1
    POST_OUT="$("$PY_BIN" tools/social/social_poster.py 2>&1)"; echo "$POST_OUT" >>"$LOG"
    POSTED="$(echo "$POST_OUT" | grep -oE 'Done: [0-9]+ posted' | grep -oE '[0-9]+' | head -1)"
    if [ "${POSTED:-0}" -eq 0 ]; then
      log "ALERT: social-daily published 0 posts — check creds/queue"
    fi
    commit_state && log "done" || log "commit_state failed"
    ;;
  *) echo "unknown job: $JOB" >&2; exit 1 ;;
esac
