#!/usr/bin/env bash
# ============================================================
# prod-siem — Pre-commit cleanup
# ============================================================
# Removes generated files, secrets, and scaffolding scripts
# that should NOT be committed.
#
# Usage:
#   ./cleanup.sh           # DRY RUN — shows what would be removed
#   ./cleanup.sh --apply   # actually delete the files
# ============================================================

set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLU}[INFO]${NC}  $*"; }
ok()    { echo -e "${GRN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YLW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

cd "$( dirname "${BASH_SOURCE[0]}" )"

echo ""
if $APPLY; then
  warn "APPLY MODE — files will be deleted."
  read -rp "Continue? (y/N) " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || fail "Aborted."
else
  info "DRY RUN — nothing will be deleted. Use --apply to actually clean."
fi
echo ""

# Targets to remove (each line: a path that may or may not exist)
TARGETS=(
  # Python build/cache
  "venv"
  ".venv"
  "__pycache__"
  ".pytest_cache"
  ".mypy_cache"
  ".ruff_cache"

  # Node
  "node_modules"
  "frontend/node_modules"
  "frontend/dist"
  "frontend/.vite"
  "package-lock.json"          # root-level (should only live in frontend/)

  # Logs & runtime
  "setup.log"
  "logs"

  # Generated reports & memory dumps (regen on demand)
  "test_reports"

  # Platform internals (not for public repo)
  ".emergent"

  # One-shot scaffolding scripts (huge generators, not actual app code)
  "add_features.sh"
  "create_all_files.sh"
  "create_frontend.sh"

  # Local-only test artifacts
  "test_result.md"
  "backend_test.py"            # keep if you want; this is a one-shot smoke test
)

# Recursively prune __pycache__ everywhere
info "Scanning for __pycache__ directories anywhere in the tree..."
mapfile -t PYCACHE < <(find . -type d -name '__pycache__' -not -path './venv/*' 2>/dev/null)
for d in "${PYCACHE[@]}"; do TARGETS+=("$d"); done

# Process each target
removed=0
skipped=0
for path in "${TARGETS[@]}"; do
  if [ -e "$path" ] || [ -L "$path" ]; then
    if $APPLY; then
      rm -rf "$path"
      ok "Removed: $path"
    else
      echo "  would remove: $path"
    fi
    removed=$((removed+1))
  else
    skipped=$((skipped+1))
  fi
done

echo ""
info "Summary: $removed targets present, $skipped not found"

# Critical security check: warn if .env still exists
if [ -f .env ]; then
  echo ""
  warn ".env file is present in the repo root."
  warn "It is gitignored, but VERIFY before pushing:"
  warn "  grep -F '.env' .gitignore  # should match"
  warn "  git status .env            # should show as ignored, not tracked"
  echo ""
  if grep -qE "^GROQ_API_KEY=gsk_[A-Za-z0-9]" .env 2>/dev/null; then
    warn "  Your .env contains a real-looking Groq key. Confirm it's a fresh key,"
    warn "  not the one previously exposed."
  fi
fi

echo ""
if $APPLY; then
  ok "Cleanup complete. Next step: git add . && git status to review."
else
  info "Re-run with --apply to actually delete these files."
fi
