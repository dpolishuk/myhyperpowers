#!/usr/bin/env bash

TM_SUPPORTED_BACKENDS=(bd br tk linear)

tm_backend_ids() {
  printf '%s\n' "${TM_SUPPORTED_BACKENDS[@]}"
}

tm_backend_is_supported() {
  local needle="${1:-}"
  local backend
  for backend in "${TM_SUPPORTED_BACKENDS[@]}"; do
    if [[ "$backend" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

tm_backend_valid_list() {
  local joined=""
  local backend
  for backend in "${TM_SUPPORTED_BACKENDS[@]}"; do
    if [[ -n "$joined" ]]; then
      joined+=", "
    fi
    joined+="$backend"
  done
  printf '%s\n' "$joined"
}

tm_backend_description() {
  case "${1:-}" in
    bd) printf '%s\n' 'Local beads task manager (default)' ;;
    br) printf '%s\n' 'Local beads_rust task manager' ;;
    tk) printf '%s\n' 'Ticket git-backed markdown task manager' ;;
    linear) printf '%s\n' 'Linear-native backend preview (core commands only)' ;;
    *) return 1 ;;
  esac
}

tm_backend_sync_mode() {
  case "${1:-}" in
    br) printf '%s\n' 'flush-only' ;;
    bd|tk|linear) printf '%s\n' 'direct' ;;
    *) return 1 ;;
  esac
}

tm_backend_supports_follow_on_linear_sync() {
  [[ "${1:-}" == "bd" ]]
}

tm_backend_should_translate_create_design() {
  [[ "${1:-}" == "br" ]]
}

tm_backend_help_lines() {
  local backend
  for backend in "${TM_SUPPORTED_BACKENDS[@]}"; do
    printf '  %-7s %s\n' "$backend" "$(tm_backend_description "$backend")"
  done
}
