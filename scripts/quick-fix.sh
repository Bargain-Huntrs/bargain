#!/bin/bash
# Quick auto-fix for pre-commit: eslint --fix staged TS files + typecheck.
# Blocks the commit only on real TypeScript errors — lint issues are autofixed.

set -e
cd "$(git rev-parse --show-toplevel)"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔧 Running quick auto-fix..."

# Clean macOS metadata files that sneak onto network/external volumes
find . -name '._*' -type f -delete 2>/dev/null || true

# Toolchain paths — hooks run with a minimal PATH
export PATH="/Volumes/Os_Sites/tools/bin:$PATH"
NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/v24.*/bin "$HOME"/.nvm/versions/node/v22.*/bin 2>/dev/null | sort -V | tail -1)"
[ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"

# ESLint --fix on staged TS/TSX files (auto-heal before checking)
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' || true)
if [ -n "$STAGED_TS" ] && [ -x bargain-web/node_modules/.bin/eslint ]; then
  echo "$STAGED_TS" | grep '^bargain-web/' | while read -r f; do
    (cd bargain-web && ./node_modules/.bin/eslint --fix "../${f#bargain-web/}" 2>/dev/null) || true
  done
  # Re-stage files eslint fixed
  echo "$STAGED_TS" | xargs git add 2>/dev/null || true
fi

HAS_ERRORS=false

# TypeScript check on bargain-web (fastest reliable gate)
if [ -x bargain-web/node_modules/.bin/tsc ]; then
  echo "🔍 Typechecking bargain-web..."
  (cd bargain-web && ./node_modules/.bin/tsc --noEmit 2>&1) | tee /tmp/bargain-tsc.log || true
  if grep -q "error TS" /tmp/bargain-tsc.log 2>/dev/null; then
    echo -e "${RED}❌ TypeScript errors found${NC}"
    HAS_ERRORS=true
  fi
fi

# Python syntax check on staged API files
STAGED_PY=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true)
if [ -n "$STAGED_PY" ]; then
  echo "🐍 Checking Python syntax..."
  for f in $STAGED_PY; do
    if ! python3 -m py_compile "$f" 2>/tmp/bargain-py.log; then
      echo -e "${RED}❌ Python syntax error in $f${NC}"
      cat /tmp/bargain-py.log
      HAS_ERRORS=true
    fi
  done
fi

if [ "$HAS_ERRORS" = true ]; then
  echo -e "${RED}❌ Fix the errors above before committing${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Quick auto-fix passed${NC}"
