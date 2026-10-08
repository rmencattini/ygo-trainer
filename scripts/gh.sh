#!/bin/sh
# Runs gh only after the identity check passes: `npm run gh -- pr create ...`
set -eu
sh "$(git rev-parse --show-toplevel)/scripts/check-identity.sh" --gh
exec gh "$@"
