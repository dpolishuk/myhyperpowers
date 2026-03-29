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
    linear) printf '%s\n' 'Linear-native backend option (not yet implemented)' ;;
    *) return 1 ;;
  esac
}

tm_backend_capabilities() {
  case "${1:-}" in
    bd) printf '%s\n' 'local-tracker' 'follow-on-linear-sync' 'backend-config-fallback' ;;
    br) printf '%s\n' 'local-tracker' 'flush-only-sync' 'backend-config-fallback' ;;
    tk) printf '%s\n' 'local-tracker' 'backend-config-fallback' ;;
    linear) printf '%s\n' 'remote-tracker' 'capability-gated' 'planned-backend' ;;
    *) return 1 ;;
  esac
}

tm_backend_has_capability() {
  local backend="${1:-}"
  local needle="${2:-}"
  local capability
  while IFS= read -r capability; do
    if [[ "$capability" == "$needle" ]]; then
      return 0
    fi
  done < <(tm_backend_capabilities "$backend")
  return 1
}

tm_backend_help_lines() {
  local backend
  for backend in "${TM_SUPPORTED_BACKENDS[@]}"; do
    printf '  %-7s %s\n' "$backend" "$(tm_backend_description "$backend")"
  done
}
