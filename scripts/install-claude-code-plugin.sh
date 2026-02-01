#!/usr/bin/env bash
set -euo pipefail

# Hyperpowers Claude Code Plugin Install Script
# Installs the hyperpowers plugin for Claude Code CLI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Claude Code directories
CLAUDE_DIR="${HOME}/.claude"
SKILLS_DIR="${CLAUDE_DIR}/skills"
AGENTS_DIR="${CLAUDE_DIR}/agents"
COMMANDS_DIR="${CLAUDE_DIR}/commands"
HOOKS_DIR="${CLAUDE_DIR}/hooks"
VERSION_FILE="${CLAUDE_DIR}/.hyperpowers-version"
BACKUP_DIR="${CLAUDE_DIR}/.hyperpowers-backup"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step() { echo -e "${BLUE}==>${NC} $*"; }
ask() { echo -e "${CYAN}[???]${NC} $*"; }

# Get current version from plugin.json
get_current_version() {
    if [[ -f "${PROJECT_ROOT}/.claude-plugin/plugin.json" ]]; then
        grep -o '"version":\s*"[^"]*"' "${PROJECT_ROOT}/.claude-plugin/plugin.json" | cut -d'"' -f4
    else
        echo "unknown"
    fi
}

# Get installed version
get_installed_version() {
    if [[ -f "$VERSION_FILE" ]]; then
        cat "$VERSION_FILE"
    else
        echo "none"
    fi
}

# Check if plugin is installed
is_installed() {
    [[ -f "$VERSION_FILE" ]]
}

# Backup existing installation
backup_installation() {
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    step "Backing up existing installation..."
    mkdir -p "$backup_path"

    # Backup hyperpowers skills
    if [[ -d "$SKILLS_DIR" ]]; then
        mkdir -p "$backup_path/skills"
        for skill_dir in "$SKILLS_DIR"/*/; do
            if [[ -d "$skill_dir" ]]; then
                cp -r "$skill_dir" "$backup_path/skills/" 2>/dev/null || true
            fi
        done
    fi

    # Backup agents
    if [[ -d "$AGENTS_DIR" ]]; then
        mkdir -p "$backup_path/agents"
        cp "$AGENTS_DIR"/*.md "$backup_path/agents/" 2>/dev/null || true
    fi

    # Backup commands
    if [[ -d "$COMMANDS_DIR" ]]; then
        mkdir -p "$backup_path/commands"
        cp "$COMMANDS_DIR"/*.md "$backup_path/commands/" 2>/dev/null || true
    fi

    # Backup hooks
    if [[ -d "$HOOKS_DIR" ]]; then
        mkdir -p "$backup_path/hooks"
        cp -r "$HOOKS_DIR"/* "$backup_path/hooks/" 2>/dev/null || true
    fi

    # Save version info
    get_installed_version > "${backup_path}/version"

    info "Backup created: $backup_path"
    echo "$backup_name"
}

# Cleanup old backups (keep last 3)
cleanup_old_backups() {
    if [[ -d "$BACKUP_DIR" ]]; then
        local count
        count=$(ls -1t "$BACKUP_DIR" 2>/dev/null | wc -l)
        if [[ $count -gt 3 ]]; then
            step "Cleaning up old backups (keeping last 3)..."
            ls -1t "$BACKUP_DIR" | tail -n +4 | while read -r old_backup; do
                rm -rf "${BACKUP_DIR}/${old_backup}"
                info "Removed old backup: $old_backup"
            done
        fi
    fi
}

# Install skills
install_skills() {
    step "Installing skills..."
    mkdir -p "$SKILLS_DIR"

    for skill_dir in "${PROJECT_ROOT}/skills"/*/; do
        if [[ -d "$skill_dir" ]] && [[ -f "${skill_dir}/SKILL.md" ]]; then
            skill_name=$(basename "$skill_dir")
            target_dir="${SKILLS_DIR}/${skill_name}"
            mkdir -p "$target_dir"
            cp "${skill_dir}/SKILL.md" "$target_dir/"
            info "  Installed skill: $skill_name"
        fi
    done
}

# Install agents
install_agents() {
    step "Installing agents..."
    mkdir -p "$AGENTS_DIR"

    for agent_file in "${PROJECT_ROOT}/agents"/*.md; do
        if [[ -f "$agent_file" ]] && [[ "$(basename "$agent_file")" != "CLAUDE.md" ]]; then
            cp "$agent_file" "$AGENTS_DIR/"
            info "  Installed agent: $(basename "$agent_file")"
        fi
    done
}

# Install commands
install_commands() {
    step "Installing commands..."
    mkdir -p "$COMMANDS_DIR"

    for cmd_file in "${PROJECT_ROOT}/commands"/*.md; do
        if [[ -f "$cmd_file" ]]; then
            cp "$cmd_file" "$COMMANDS_DIR/"
            info "  Installed command: $(basename "$cmd_file")"
        fi
    done
}

# Install hooks
install_hooks() {
    step "Installing hooks..."
    mkdir -p "$HOOKS_DIR"

    if [[ -d "${PROJECT_ROOT}/hooks" ]]; then
        for hook_file in "${PROJECT_ROOT}/hooks"/*; do
            if [[ -f "$hook_file" ]]; then
                cp "$hook_file" "$HOOKS_DIR/"
                info "  Installed hook: $(basename "$hook_file")"
            fi
        done
    else
        info "  No hooks to install"
    fi
}

# Main installation
main() {
    info "Hyperpowers Claude Code Plugin Installer"
    echo

    local current_version
    current_version=$(get_current_version)
    local installed_version
    installed_version=$(get_installed_version)

    info "Source: $PROJECT_ROOT"
    info "Target: $CLAUDE_DIR"
    info "Current version: $current_version"
    info "Installed version: $installed_version"
    echo

    # Check if already installed with same version
    if is_installed && [[ "$installed_version" == "$current_version" ]]; then
        info "Version $current_version is already installed."
        ask "Reinstall anyway? (y/N)"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            info "Installation cancelled."
            exit 0
        fi
        warn "Reinstalling version $current_version..."
    fi

    # Backup if already installed
    if is_installed; then
        backup_installation
    fi

    # Create directories
    step "Creating Claude Code directories..."
    mkdir -p "$SKILLS_DIR" "$AGENTS_DIR" "$COMMANDS_DIR" "$HOOKS_DIR"

    # Install components
    install_skills
    install_agents
    install_commands
    install_hooks

    # Save version
    echo "$current_version" > "$VERSION_FILE"

    # Cleanup old backups
    cleanup_old_backups

    echo
    info "Hyperpowers Claude Code plugin v${current_version} installed successfully!"
    echo
    info "Components installed to:"
    info "  Skills:   $SKILLS_DIR"
    info "  Agents:   $AGENTS_DIR"
    info "  Commands: $COMMANDS_DIR"
    info "  Hooks:    $HOOKS_DIR"
    echo
    info "Next steps:"
    info "  1. Restart Claude Code or start a new session"
    info "  2. Use /hyperpowers:execute-ralph to run autonomous execution"
    info "  3. Use /hyperpowers:brainstorm to start brainstorming"
    echo
    info "Or use local dev mode: claude --plugin-dir $PROJECT_ROOT"
}

# Uninstall function
uninstall() {
    info "Uninstalling Hyperpowers Claude Code plugin..."

    # Remove skills
    if [[ -d "$SKILLS_DIR" ]]; then
        for skill_dir in "$SKILLS_DIR"/*/; do
            if [[ -d "$skill_dir" ]]; then
                rm -rf "$skill_dir"
                info "  Removed skill: $(basename "$skill_dir")"
            fi
        done
    fi

    # Remove agents (be careful not to remove user agents)
    for agent in review-quality review-implementation review-testing review-simplification review-documentation autonomous-reviewer code-reviewer codebase-investigator internet-researcher test-runner test-effectiveness-analyst; do
        if [[ -f "$AGENTS_DIR/${agent}.md" ]]; then
            rm "$AGENTS_DIR/${agent}.md"
            info "  Removed agent: ${agent}.md"
        fi
    done

    # Remove commands
    for cmd in execute-ralph execute-plan brainstorm write-plan review-implementation analyze-tests; do
        if [[ -f "$COMMANDS_DIR/${cmd}.md" ]]; then
            rm "$COMMANDS_DIR/${cmd}.md"
            info "  Removed command: ${cmd}.md"
        fi
    done

    # Remove version file
    rm -f "$VERSION_FILE"

    info "Uninstall complete!"
}

# Parse arguments
case "${1:-}" in
    --uninstall|-u)
        uninstall
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --uninstall, -u   Uninstall the plugin"
        echo "  --help, -h        Show this help message"
        echo
        echo "Without options, installs the Hyperpowers plugin for Claude Code."
        ;;
    *)
        main
        ;;
esac
