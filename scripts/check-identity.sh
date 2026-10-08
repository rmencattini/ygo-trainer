#!/bin/sh
# Fails if this repo would commit, push or call gh under any identity other than
# the one in .identity (personal GitHub, never a work email).
# Usage: check-identity.sh [--gh]   (--gh also checks the gh CLI login; needs network)
set -eu
root=$(git rev-parse --show-toplevel)
. "$root/.identity"

fail() {
  echo "identity check FAILED: $1" >&2
  echo "expected: login=$GITHUB_LOGIN email=$COMMIT_EMAIL remote=$REMOTE_URL" >&2
  exit 1
}

for email in "$(git config user.email || true)" "${GIT_AUTHOR_EMAIL:-$COMMIT_EMAIL}" "${GIT_COMMITTER_EMAIL:-$COMMIT_EMAIL}"; do
  [ "$email" = "$COMMIT_EMAIL" ] || fail "commit email is '$email'"
done

remote=$(git remote get-url origin 2>/dev/null || true)
[ -z "$remote" ] || [ "$remote" = "$REMOTE_URL" ] || fail "origin is '$remote'"

if [ "${1:-}" = "--gh" ]; then
  login=$(gh api user --jq .login 2>/dev/null || true)
  [ "$login" = "$GITHUB_LOGIN" ] || fail "gh is logged in as '$login'"
fi
