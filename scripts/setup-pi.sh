#!/usr/bin/env bash
set -euo pipefail

printf 'setup-pi.sh is deprecated. Use: curl -fsSL https://raw.githubusercontent.com/dpolishuk/xpowers/main/scripts/install.sh | bash -s -- --hosts pi --yes\n' >&2

exec bash "$(dirname "$0")/install.sh" --hosts pi "$@"
