#!/bin/sh
# CI: fail if any commit in RANGE has an author or committer email other than the
# one in .identity (bots allowed). Usage: check-commit-authors.sh <base>..<head>
set -eu
. "$(git rev-parse --show-toplevel)/.identity"
bad=$(git log --format='%h %ae %ce' "$1" | while read -r sha author committer; do
  for email in "$author" "$committer"; do
    case "$email" in
      "$COMMIT_EMAIL" | noreply@github.com | *"[bot]@users.noreply.github.com") ;;
      *) echo "$sha $email" ;;
    esac
  done
done)
if [ -n "$bad" ]; then
  echo "commits with an unexpected email:" >&2
  echo "$bad" >&2
  exit 1
fi
echo "all commit emails match .identity"
