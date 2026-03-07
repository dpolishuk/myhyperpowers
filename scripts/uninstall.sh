#!/usr/bin/env bash
# Thin wrapper that delegates to install.sh --uninstall
exec "$(dirname "$0")/install.sh" --uninstall "$@"
