#!/usr/bin/env bash
set -euo pipefail

printf 'setup-pi.sh is deprecated. Use: curl -fsSL https://raw.githubusercontent.com/dpolishuk/xpowers/main/scripts/install.sh | bash -s -- --hosts pi --yes\n' >&2

# Strip --hosts and its argument from forwarded args to avoid duplication/conflict
forward_args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hosts)
      shift
      [[ $# -gt 0 ]] && shift
      ;;
    --yes|--dry-run|--force|--uninstall|--allow-conflicts|--purge)
      forward_args+=("$1")
      shift
      ;;
    *)
      shift
      ;;
  esac
done

exec bash "$(dirname "$0")/install.sh" --hosts pi "${forward_args[@]}"
