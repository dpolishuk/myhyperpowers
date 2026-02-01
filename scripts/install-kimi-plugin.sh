#!/usr/bin/env bash
set -euo pipefail

# Hyperpowers Kimi CLI Plugin Install Script
# Installs the hyperpowers plugin for Kimi CLI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
KIMI_DIR="${PROJECT_ROOT}/.kimi"

# XDG Base Directory Specification
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
CONFIG_DIR="$XDG_CONFIG_HOME/agents"
KIMI_CONFIG_DIR="$XDG_CONFIG_HOME/kimi"
VERSION_FILE="${CONFIG_DIR}/.hyperpowers-version"
SKILLS_DIR="$CONFIG_DIR/skills"
AGENTS_DIR="$CONFIG_DIR"
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
    [[ -f "$VERSION_FILE" ]] && [[ -d "$SKILLS_DIR" ]]
}

# Check if Kimi CLI is installed
check_kimi() {
    if command -v kimi &> /dev/null; then
        info "Found kimi: $(kimi --version 2>/dev/null || echo 'installed')"
        return 0
    else
        warn "Kimi CLI not found. Plugin will be installed but kimi command is not available."
        warn "Install Kimi CLI from: https://github.com/MoonshotAI/kimi-cli"
        return 0  # Don't fail, just warn
    fi
}

# Backup existing installation
backup_installation() {
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="${BACKUP_DIR}/${backup_name}"

    step "Backing up existing installation..."
    mkdir -p "$backup_path"

    # Backup skills
    if [[ -d "$SKILLS_DIR" ]]; then
        mkdir -p "$backup_path/skills"
        for skill in analyzing-test-effectiveness brainstorming building-hooks debugging-with-tools \
                     dispatching-parallel-agents execute-ralph executing-plans finishing-a-development-branch \
                     fixing-bugs managing-bd-tasks refactoring-safely review-implementation root-cause-tracing \
                     skills-auto-activation sre-task-refinement test-driven-development testing-anti-patterns \
                     using-hyper verification-before-completion writing-plans writing-skills common-patterns; do
            if [[ -d "$SKILLS_DIR/$skill" ]]; then
                cp -r "$SKILLS_DIR/$skill" "$backup_path/skills/" 2>/dev/null || true
            fi
        done
    fi

    # Backup agents
    for agent in codebase-investigator code-reviewer test-effectiveness-analyst internet-researcher \
                 autonomous-reviewer test-runner hyperpowers; do
        if [[ -f "$AGENTS_DIR/${agent}.yaml" ]]; then
            cp "$AGENTS_DIR/${agent}.yaml" "$backup_path/" 2>/dev/null || true
        fi
        if [[ -f "$AGENTS_DIR/${agent}-system.md" ]]; then
            cp "$AGENTS_DIR/${agent}-system.md" "$backup_path/" 2>/dev/null || true
        fi
    done

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

    # Remove skills
    for skill in analyzing-test-effectiveness brainstorming building-hooks debugging-with-tools \
                 dispatching-parallel-agents execute-ralph executing-plans finishing-a-development-branch \
                 fixing-bugs managing-bd-tasks refactoring-safely review-implementation root-cause-tracing \
                 skills-auto-activation sre-task-refinement test-driven-development testing-anti-patterns \
                 using-hyper verification-before-completion writing-plans writing-skills common-patterns; do
        rm -rf "$SKILLS_DIR/$skill" 2>/dev/null || true
    done

    # Remove agents
    for agent in codebase-investigator code-reviewer test-effectiveness-analyst internet-researcher \
                 autonomous-reviewer test-runner; do
        rm -f "$AGENTS_DIR/${agent}.yaml" 2>/dev/null || true
        rm -f "$AGENTS_DIR/${agent}-system.md" 2>/dev/null || true
    done

    # Remove main agent
    rm -f "$AGENTS_DIR/hyperpowers.yaml" 2>/dev/null || true
    rm -f "$AGENTS_DIR/hyperpowers-system.md" 2>/dev/null || true
}

# Merge MCP config (add our servers without overwriting user's)
merge_mcp_config() {
    local user_mcp="$KIMI_CONFIG_DIR/mcp.json"
    local our_mcp="$KIMI_DIR/mcp.json"

    if [[ ! -f "$our_mcp" ]]; then
        return 0
    fi

    step "Merging MCP configuration..."
    mkdir -p "$KIMI_CONFIG_DIR"

    if [[ -f "$user_mcp" ]]; then
        # User has existing config - merge using jq if available, otherwise warn
        if command -v jq &> /dev/null; then
            local merged
            merged=$(jq -s '.[0] * .[1]' "$user_mcp" "$our_mcp" 2>/dev/null) || {
                warn "Failed to merge MCP configs. Manual merge may be needed."
                return 0
            }
            echo "$merged" > "$user_mcp"
            info "MCP config merged successfully"
        else
            warn "jq not installed. Cannot merge MCP configs automatically."
            warn "Please manually add context7 to $user_mcp"
            cat "$our_mcp"
        fi
    else
        # No existing config - just copy ours
        cp "$our_mcp" "$user_mcp"
        info "MCP config created: $user_mcp"
    fi
}

install_plugin() {
    local mode="${1:-copy}"
    local force="${2:-false}"
    local current_version
    local installed_version

    current_version="$(get_current_version)"
    installed_version="$(get_installed_version)"

    step "Creating Kimi CLI config directories..."
    mkdir -p "$SKILLS_DIR"
    mkdir -p "$AGENTS_DIR"
    mkdir -p "$KIMI_CONFIG_DIR"

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
        info "Installing hyperpowers Kimi CLI plugin v$current_version..."
    fi

    info "Config dir: $CONFIG_DIR"
    info "Mode: $mode"

    # Install skills
    if [[ "$mode" == "symlink" ]]; then
        info "Symlinking skills for development..."
        for skill_dir in "$KIMI_DIR/skills"/*; do
            if [[ -d "$skill_dir" ]]; then
                local skill_name
                skill_name=$(basename "$skill_dir")
                ln -sf "$skill_dir" "$SKILLS_DIR/$skill_name"
            fi
        done
    else
        info "Copying skills..."
        for skill_dir in "$KIMI_DIR/skills"/*; do
            if [[ -d "$skill_dir" ]]; then
                cp -r "$skill_dir" "$SKILLS_DIR/"
            fi
        done
    fi

    # Install agents
    if [[ "$mode" == "symlink" ]]; then
        info "Symlinking agents..."
        for agent in "$KIMI_DIR/agents"/*.yaml; do
            if [[ -f "$agent" ]]; then
                ln -sf "$agent" "$AGENTS_DIR/"
            fi
        done
        for prompt in "$KIMI_DIR/agents"/*-system.md; do
            if [[ -f "$prompt" ]]; then
                ln -sf "$prompt" "$AGENTS_DIR/"
            fi
        done
    else
        info "Copying agents..."
        cp "$KIMI_DIR/agents"/*.yaml "$AGENTS_DIR/" 2>/dev/null || true
        cp "$KIMI_DIR/agents"/*-system.md "$AGENTS_DIR/" 2>/dev/null || true
    fi

    # Install main hyperpowers agent
    if [[ "$mode" == "symlink" ]]; then
        info "Symlinking main agent..."
        ln -sf "$KIMI_DIR/hyperpowers.yaml" "$AGENTS_DIR/"
        ln -sf "$KIMI_DIR/hyperpowers-system.md" "$AGENTS_DIR/"
    else
        info "Copying main agent..."
        cp "$KIMI_DIR/hyperpowers.yaml" "$AGENTS_DIR/"
        cp "$KIMI_DIR/hyperpowers-system.md" "$AGENTS_DIR/"
    fi

    # Merge MCP config
    merge_mcp_config

    # Save version
    echo "$current_version" > "$VERSION_FILE"

    if [[ "$installed_version" != "none" ]] && [[ "$installed_version" != "$current_version" ]]; then
        info "Upgrade complete: $installed_version → $current_version"
    else
        info "Hyperpowers Kimi CLI plugin v$current_version installed successfully!"
    fi
}

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Install or upgrade the hyperpowers plugin for Kimi CLI.

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
    1. Use kimi with: kimi --agent-file ~/.config/agents/hyperpowers.yaml
    2. Or set as default agent in your kimi config
    3. Skills available via /skill:name

PLUGIN LOCATIONS:
    Skills:   $SKILLS_DIR
    Agents:   $AGENTS_DIR
    MCP:      $KIMI_CONFIG_DIR/mcp.json
EOF
}

show_version() {
    local current_version
    local installed_version

    current_version="$(get_current_version)"
    installed_version="$(get_installed_version)"

    echo "Hyperpowers Kimi CLI Plugin Version:"
    echo "  Current:   $current_version"
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
        local skill_count agent_count
        skill_count=$(find "$SKILLS_DIR" -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        agent_count=$(ls "$AGENTS_DIR"/*.yaml 2>/dev/null | wc -l | tr -d ' ')

        echo ""
        echo "Installed Items:"
        echo "  Skills: $((skill_count - 1))"  # Subtract 1 for the directory itself
        echo "  Agents: $agent_count"

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

    info "Hyperpowers Kimi CLI Plugin Installer"
    echo

    check_kimi
    install_plugin "$mode" "$force"

    echo
    info "Next steps:"
    info "  1. Run: kimi --agent-file ~/.config/agents/hyperpowers.yaml"
    info "  2. Or add to your shell alias: alias kimi-hyper='kimi --agent-file ~/.config/agents/hyperpowers.yaml'"
    info "  3. Use /skill:brainstorm to start brainstorming"
    info "  4. Use /skill:write-plan to create implementation plans"
    info "  5. Use /skill:execute-ralph for autonomous execution"
}

main "$@"
