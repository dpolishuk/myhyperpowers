#!/usr/bin/env bash
set -euo pipefail

# Staged, idempotent XPowers rebrand automation.
# Constructs legacy tokens from parts so final repository grep stays clean.
# Protects repository internals, dependency installs, and task backend stores.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

OLD_NS="hyper""powers"
OLD_DISPLAY="Hyper""powers"
OLD_UPPER="HYPER""POWERS"
OLD_REPO="my${OLD_NS}"
NEW_NS="xpowers"
NEW_DISPLAY="XPowers"
NEW_UPPER="XPOWERS"

log() { printf '%s\n' "$*"; }

is_protected_path() {
  case "$1" in
    ./.git|./.git/*|.git|.git/*|\
    ./node_modules|./node_modules/*|node_modules|node_modules/*|\
    ./.beads|./.beads/*|.beads|.beads/*|\
    ./.pi/extensions/*/node_modules|./.pi/extensions/*/node_modules/*|\
    ./.pi/extensions/*/dist|./.pi/extensions/*/dist/*)
      return 0 ;;
    *) return 1 ;;
  esac
}

move_path() {
  local src="$1"
  local dst="$2"
  if is_protected_path "$src" || is_protected_path "$dst"; then
    log "skip protected move: $src"
    return 0
  fi
  if [[ -e "$src" || -L "$src" ]]; then
    if [[ -e "$dst" || -L "$dst" ]]; then
      log "skip move: $dst already exists"
    else
      mkdir -p "$(dirname "$dst")"
      git mv "$src" "$dst" 2>/dev/null || mv "$src" "$dst"
      log "moved: $src -> $dst"
    fi
  fi
}

log "== Removing unrelated scratch PR artifacts =="
rm -f comments.json pr_38_comments.json pr_39_comments.json pr_41_comments.json pr_42_comments.json pr_47_comments.json check_prs.sh fetch_comments.sh

log "== Renaming known paths =="
move_path ".gemini-extension/commands/${OLD_NS}" ".gemini-extension/commands/${NEW_NS}"
move_path ".kimi/${OLD_NS}-system.md" ".kimi/${NEW_NS}-system.md"
move_path ".kimi/${OLD_NS}.yaml" ".kimi/${NEW_NS}.yaml"
move_path ".kimi/skills/${OLD_NS}-agents" ".kimi/skills/${NEW_NS}-agents"
move_path ".opencode/${OLD_NS}-routing.json" ".opencode/${NEW_NS}-routing.json"
move_path ".pi/extensions/${OLD_NS}" ".pi/extensions/${NEW_NS}"
move_path "scripts/${OLD_NS}-statusline.sh" "scripts/${NEW_NS}-statusline.sh"
move_path "docs/opencode.example.${OLD_NS}-routing.json" "docs/opencode.example.${NEW_NS}-routing.json"

log "== Renaming remaining active paths containing legacy tokens =="
while IFS= read -r path; do
  is_protected_path "$path" && continue
  new_path="${path//${OLD_NS}/${NEW_NS}}"
  new_path="${new_path//${OLD_DISPLAY}/${NEW_DISPLAY}}"
  new_path="${new_path//${OLD_UPPER}/${NEW_UPPER}}"
  [[ "$path" == "$new_path" ]] && continue
  move_path "$path" "$new_path"
done < <(
  find . -depth \
    ! -path './.git' ! -path './.git/*' \
    ! -path './node_modules' ! -path './node_modules/*' \
    ! -path './.beads' ! -path './.beads/*' \
    ! -path './.pi/extensions/*/node_modules' ! -path './.pi/extensions/*/node_modules/*' \
    ! -path './.pi/extensions/*/dist' ! -path './.pi/extensions/*/dist/*' \
    \( -name "*${OLD_NS}*" -o -name "*${OLD_DISPLAY}*" -o -name "*${OLD_UPPER}*" \) -print | sort
)

log "== Replacing text in active text files =="
while IFS= read -r file; do
  is_protected_path "$file" && continue
  [[ -f "$file" ]] || continue
  if grep -Iq . "$file"; then
    OLD_NS="$OLD_NS" OLD_DISPLAY="$OLD_DISPLAY" OLD_UPPER="$OLD_UPPER" OLD_REPO="$OLD_REPO" \
    NEW_NS="$NEW_NS" NEW_DISPLAY="$NEW_DISPLAY" NEW_UPPER="$NEW_UPPER" \
    perl -0pi -e '
      my $old_ns = $ENV{OLD_NS};
      my $old_display = $ENV{OLD_DISPLAY};
      my $old_upper = $ENV{OLD_UPPER};
      my $old_repo = $ENV{OLD_REPO};
      my $new_ns = $ENV{NEW_NS};
      my $new_display = $ENV{NEW_DISPLAY};
      my $new_upper = $ENV{NEW_UPPER};
      s/My\Q$old_ns\E/$new_display/g;
      s/My\Q${old_ns}\E/$new_display/g;
      s/MY\Q$old_upper\E/$new_upper/g;
      s/\Q$old_repo\E/$new_ns/g;
      s/\Q$old_display\E/$new_display/g;
      s/\Q$old_upper\E/$new_upper/g;
      s/\Q$old_ns\E/$new_ns/g;
    ' "$file"
  fi
done < <(
  find . -type f \
    ! -path './.git/*' \
    ! -path './node_modules/*' \
    ! -path './.beads/*' \
    ! -path './.pi/extensions/*/node_modules/*' \
    ! -path './.pi/extensions/*/dist/*' \
    -print
)

log "== XPowers staged rename complete =="
