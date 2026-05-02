#!/usr/bin/env bash
set -euo pipefail

printf 'setup-pi.sh is deprecated. Use: curl -fsSL https://raw.githubusercontent.com/dpolishuk/xpowers/main/scripts/install.sh | bash -s -- --hosts pi --yes\n' >&2

SCRIPT_SOURCE="${BASH_SOURCE[0]-}"
SCRIPT_DIR=""
if [[ -n "$SCRIPT_SOURCE" && -f "$SCRIPT_SOURCE" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
fi

if [[ -z "$SCRIPT_DIR" ]]; then
  printf 'setup-pi.sh: cannot determine script location when piped. Use the universal installer instead.\n' >&2
  exit 1
fi

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

exec bash "${SCRIPT_DIR}/install.sh" --hosts pi "${forward_args[@]}"
