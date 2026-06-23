#!/usr/bin/env bash
# Auto-sync: pull → commit mọi thay đổi → push branch → merge vào main → push main.
# Giữ GitHub luôn ở phiên bản mới nhất. Chạy được không cần tương tác (dùng credential đã lưu).
set -uo pipefail

REPO="C:/Users/Admin/Mkt-piprline"
BRANCH="claude/friendly-ramanujan-ibd7ah"
cd "$REPO" || { echo "Khong vao duoc repo"; exit 1; }

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*"; }

log "=== Auto-sync bat dau ==="

# 1) Ve dung branch lam viec
git checkout "$BRANCH" >/dev/null 2>&1

# 2) Keo ban moi nhat ve (rebase, tu cat tam neu dang sua do)
git pull --rebase --autostash origin "$BRANCH" 2>&1 | sed 's/^/  pull: /'

# 3) Commit moi thay doi (neu co)
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "chore: auto-sync $(ts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" 2>&1 | sed 's/^/  commit: /'
else
  log "Khong co thay doi moi de commit."
fi

# 4) Push branch
git push origin "$BRANCH" 2>&1 | sed 's/^/  push-branch: /'

# 5) Cap nhat main = branch moi nhat
git checkout main >/dev/null 2>&1
git pull --rebase --autostash origin main 2>&1 | sed 's/^/  pull-main: /'
git merge "$BRANCH" --no-edit 2>&1 | sed 's/^/  merge: /'
git push origin main 2>&1 | sed 's/^/  push-main: /'

# 6) Quay lai branch lam viec
git checkout "$BRANCH" >/dev/null 2>&1

log "=== Auto-sync xong ==="
