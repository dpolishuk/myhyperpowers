#!/usr/bin/env bash
set -euo pipefail

# Hyperpowers OpenCode Plugin Install Script
# Installs the hyperpowers plugin for OpenCode CLI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCODE_DIR="${PROJECT_ROOT}/.opencode"

# XDG Base Directory Specification
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
CONFIG_DIR="$XDG_CONFIG_HOME/opencode"
VERSION_FILE="${CONFIG_DIR}/.hyperpowers-version"
PLUGIN_DIR="$CONFIG_DIR/plugins"
SKILLS_DIR="$CONFIG_DIR/skills"
AGENTS_DIR="$CONFIG_DIR/agents"
COMMANDS_DIR="$CONFIG_DIR/commands"
BACKUP_DIR="${CONFIG_DIR}/.hyperpowers-backup"

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

# Check if plugin is already installed
is_installed() {
    [[ -f "$VERSION_FILE" ]] && [[ -d "$PLUGIN_DIR" ]] && [[ -f "$PLUGIN_DIR/hyperpowers-skills.ts" ]]
}

# Backup existing installation
backup_installation() {
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    step "Backing up existing installation..."
    mkdir -p "$backup_path"

    # Backup plugins, skills, agents, commands
    if [[ -d "$PLUGIN_DIR" ]]; then
        cp -r "$PLUGIN_DIR" "$backup_path/" 2>/dev/null || true
    fi
    if [[ -d "$SKILLS_DIR" ]]; then
        mkdir -p "$backup_path/skills"
        cp -r "$SKILLS_DIR"/hyperpowers-* "$backup_path/skills/" 2>/dev/null || true
    fi
    if [[ -d "$AGENTS_DIR" ]]; then
        cp -r "$AGENTS_DIR" "$backup_path/" 2>/dev/null || true
    fi
    if [[ -d "$COMMANDS_DIR" ]]; then
        cp -r "$COMMANDS_DIR" "$backup_path/" 2>/dev/null || true
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

# Remove existing installation files
remove_existing_installation() {
    step "Removing existing installation files..."

    # Remove plugins
    rm -f "$PLUGIN_DIR/hyperpowers-skills.ts"
    rm -f "$PLUGIN_DIR/cass-memory.ts"
    rm -f "$PLUGIN_DIR/hyperpowers-safety.ts"

    # Remove skills
    find "$SKILLS_DIR" -name "hyperpowers-*" -type d -exec rm -rf {} + 2>/dev/null || true

    # Remove agents (only if they're from hyperpowers)
    # We'll be conservative here - agents might be user-added
    # Just remove our known agents
    for agent in code-reviewer test-runner internet-researcher codebase-investigator test-effectiveness-analyst; do
        rm -f "$AGENTS_DIR/${agent}.md" 2>/dev/null || true
    done

    # Remove commands (only if they're from hyperpowers)
    for cmd in brainstorm write-plan execute-plan analyze-tests review-implementation beads-triage hyperpowers-version; do
        rm -f "$COMMANDS_DIR/${cmd}.md" 2>/dev/null || true
    done
}

check_bun() {
    if ! command -v bun &> /dev/null; then
        error "bun is not installed. Install from https://bun.sh/"
    fi
    info "Found bun: $(bun --version)"
}

install_plugin() {
    local mode="${1:-copy}"
    local force="${2:-false}"
    local current_version
    local installed_version

    current_version="$(get_current_version)"
    installed_version="$(get_installed_version)"

    step "Creating OpenCode config directories..."
    mkdir -p "$PLUGIN_DIR"
    mkdir -p "$SKILLS_DIR"
    mkdir -p "$AGENTS_DIR"
    mkdir -p "$COMMANDS_DIR"

    # Check for existing installation
    if is_installed; then
        if [[ "$current_version" == "$installed_version" ]]; then
            info "Version $current_version is already installed."
            if [[ "$force" != "true" ]]; then
                ask "Reinstall anyway? (y/N)"
                read -r response
                if [[ ! "$response" =~ ^[Yy]$ ]]; then
                    info "Installation cancelled."
                    return 0
                fi
            fi
            warn "Reinstalling version $current_version..."
        else
            info "Upgrading from version $installed_version to $current_version..."
            backup_installation
            remove_existing_installation
            cleanup_old_backups
        fi
    else
        info "Installing hyperpowers OpenCode plugin v$current_version..."
    fi

    info "Config dir: $CONFIG_DIR"
    info "Mode: $mode"

    # Install plugins
    if [[ "$mode" == "symlink" ]]; then
        info "Creating symlinks for development..."
        ln -sf "$OPENCODE_DIR/plugins/hyperpowers-skills.ts" "$PLUGIN_DIR/"
        ln -sf "$OPENCODE_DIR/plugins/cass-memory.ts" "$PLUGIN_DIR/"
        ln -sf "$OPENCODE_DIR/plugins/hyperpowers-safety.ts" "$PLUGIN_DIR/"
    else
        info "Copying plugin files..."
        cp "$OPENCODE_DIR/plugins/hyperpowers-skills.ts" "$PLUGIN_DIR/"
        cp "$OPENCODE_DIR/plugins/cass-memory.ts" "$PLUGIN_DIR/"
        cp "$OPENCODE_DIR/plugins/hyperpowers-safety.ts" "$PLUGIN_DIR/"
    fi

    # Install skills (use symlinks in dev mode for live reload)
    if [[ "$mode" == "symlink" ]]; then
        info "Symlinking skills for development..."
        for skill_dir in "$OPENCODE_DIR/skills"/*; do
            if [[ -d "$skill_dir" ]]; then
                ln -sf "$skill_dir" "$SKILLS_DIR/"
            fi
        done
    else
        info "Copying skills..."
        cp -r "$OPENCODE_DIR/skills"/* "$SKILLS_DIR/"
    fi

    # Install agents
    if [[ "$mode" == "symlink" ]]; then
        info "Symlinking agents..."
        for agent in "$OPENCODE_DIR/agents"/*; do
            ln -sf "$agent" "$AGENTS_DIR/"
        done
    else
        info "Copying agents..."
        cp "$OPENCODE_DIR/agents"/* "$AGENTS_DIR/"
    fi

    # Install commands
    if [[ "$mode" == "symlink" ]]; then
        info "Symlinking commands..."
        for cmd in "$OPENCODE_DIR/commands"/*; do
            ln -sf "$cmd" "$COMMANDS_DIR/"
        done
    else
        info "Copying commands..."
        cp "$OPENCODE_DIR/commands"/* "$COMMANDS_DIR/"
    fi

    # Install dependencies in the config directory
    step "Installing plugin dependencies..."
    cd "$CONFIG_DIR"
    bun install

    # Save version
    echo "$current_version" > "$VERSION_FILE"

    if [[ "$installed_version" != "none" ]] && [[ "$installed_version" != "$current_version" ]]; then
        info "Upgrade complete: $installed_version → $current_version"
    else
        info "Hyperpowers OpenCode plugin v$current_version installed successfully!"
    fi
}

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Install or upgrade the hyperpowers plugin for OpenCode CLI.

OPTIONS:
    -h, --help          Show this help message
    -s, --symlink       Use symlinks for development (live reload)
    -c, --copy          Copy files (default, for production)
    -f, --force         Force reinstallation without prompting
    -v, --version       Show current and installed versions
    --status            Show installation status

ENVIRONMENT VARIABLES:
    XDG_CONFIG_HOME     Config directory (default: ~/.config)

EXAMPLES:
    # Install via copying (production)
    $(basename "$0")

    # Install via symlinks (development)
    $(basename "$0") --symlink

    # Force reinstall same version
    $(basename "$0") --force

    # Check version and status
    $(basename "$0") --version
    $(basename "$0") --status

UPGRADE NOTES:
    - When a new version is detected, existing files are backed up
    - Backups are stored in: $BACKUP_DIR
    - Last 3 backups are kept automatically

AFTER INSTALLATION:
    1. Restart OpenCode or run: opencode reload
    2. Skills will be available in the OpenCode TUI
    3. Use /<skill-name> to invoke skills

PLUGIN LOCATIONS:
    Plugins:  $PLUGIN_DIR
    Skills:   $SKILLS_DIR
    Agents:   $AGENTS_DIR
    Commands: $COMMANDS_DIR
EOF
}

show_version() {
    local current_version
    local installed_version

    current_version="$(get_current_version)"
    installed_version="$(get_installed_version)"

    echo "Hyperpowers OpenCode Plugin Version:"
    echo "  Current:  $current_version"
    echo "  Installed: $installed_version"

    if [[ "$installed_version" != "none" ]]; then
        if [[ "$current_version" == "$installed_version" ]]; then
            echo "  Status: Up to date"
        else
            echo "  Status: Update available!"
        fi
    else
        echo "  Status: Not installed"
    fi
}

show_status() {
    local current_version
    local installed_version

    current_version="$(get_current_version)"
    installed_version="$(get_installed_version)"

    echo "Installation Status:"
    echo "===================="

    if is_installed; then
        echo "Installed: Yes"
        echo "Version: $installed_version"
        echo "Config dir: $CONFIG_DIR"

        if [[ "$current_version" == "$installed_version" ]]; then
            echo "Update: Up to date"
        else
            echo "Update: Available (v$installed_version → v$current_version)"
        fi

        # Count installed items
        local skill_count agent_count command_count
        skill_count=$(find "$SKILLS_DIR" -name "hyperpowers-*" -type d 2>/dev/null | wc -l | tr -d ' ')
        agent_count=$(ls "$AGENTS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
        command_count=$(ls "$COMMANDS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')

        echo ""
        echo "Installed Items:"
        echo "  Skills: $skill_count"
        echo "  Agents: $agent_count"
        echo "  Commands: $command_count"

        # Show backup info
        if [[ -d "$BACKUP_DIR" ]]; then
            local backup_count
            backup_count=$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l | tr -d ' ')
            if [[ $backup_count -gt 0 ]]; then
                echo "  Backups: $backup_count (latest: $(ls -1t "$BACKUP_DIR" | head -1))"
            fi
        fi
    else
        echo "Installed: No"
        echo "Available version: $current_version"
        echo ""
        echo "Run '$(basename "$0")' to install."
    fi
}

main() {
    local mode="copy"
    local force="false"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -s|--symlink)
                mode="symlink"
                shift
                ;;
            -c|--copy)
                mode="copy"
                shift
                ;;
            -f|--force)
                force="true"
                shift
                ;;
            -v|--version)
                show_version
                exit 0
                ;;
            --status)
                show_status
                exit 0
                ;;
            *)
                error "Unknown option: $1. Use --help for usage."
                ;;
        esac
    done

    info "Hyperpowers OpenCode Plugin Installer"
    echo

    check_bun
    install_plugin "$mode" "$force"

    echo
    info "Next steps:"
    info "  1. Restart OpenCode or run: opencode reload"
    info "  2. Use /brainstorm to start brainstorming"
    info "  3. Use /write-plan to create implementation plans"
}

main "$@"
