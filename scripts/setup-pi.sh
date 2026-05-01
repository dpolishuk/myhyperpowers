#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# XPowers Pi Quick Installer
# One-command setup for macOS & Linux:
# curl -fsSL https://raw.githubusercontent.com/dpolishuk/xpowers/main/scripts/setup-pi.sh | bash
# ---------------------------------------------------------------------------

# Colors and formatting
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  CYAN='\033[0;36m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' BOLD='' CYAN='' RESET=''
fi

info()    { echo -e "${BLUE}i${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*" >&2; }
error()   { echo -e "${RED}✗${RESET} $*" >&2; }

header() {
  echo -e "${BOLD}╭─────────────────────────────────────────╮${RESET}"
  printf  "${BOLD}│${RESET}  XPowers Pi Installer ${CYAN}v%-13s${RESET} ${BOLD}│${RESET}\n" "latest"
  echo -e "${BOLD}╰─────────────────────────────────────────╯${RESET}"
  echo
}

header

# ---------------------------------------------------------------------------
# Prerequisites Check
# ---------------------------------------------------------------------------

info "Checking system requirements..."

# 1. Check for Pi
if ! command -v pi >/dev/null 2>&1; then
  error "Pi is not installed or not in PATH."
  echo -e "Please install Pi first: ${CYAN}https://github.com/mariozechner/pi-coding-agent${RESET}"
  exit 1
fi
success "Pi is installed."

# 2. Check for Git
if ! command -v git >/dev/null 2>&1; then
  error "Git is required to download XPowers."
  exit 1
fi
success "Git is installed."

# 3. Check for Bun or npm
PM=""
if command -v bun >/dev/null 2>&1; then
  PM="bun"
  success "Bun is installed."
elif command -v npm >/dev/null 2>&1; then
  PM="npm"
  success "npm is installed."
else
  error "Either 'bun' or 'npm' is required to install Pi extension dependencies."
  echo -e "Install Bun: ${CYAN}curl -fsSL https://bun.sh/install | bash${RESET}"
  exit 1
fi

# ---------------------------------------------------------------------------
# Download & Install
# ---------------------------------------------------------------------------

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

info "Downloading latest XPowers release..."
cd "$TMP_DIR"
git clone --depth 1 https://github.com/dpolishuk/xpowers.git . >/dev/null 2>&1

if [[ "$PM" == "bun" ]]; then
  info "Running Bun interactive installer for Pi..."
  # Just run the native bun installer in Pi mode
  bun scripts/install.ts --yes --hosts pi
else
  info "Running manual setup via npm..."
  PI_EXT_DIR="$HOME/.pi/agent/extensions/xpowers"
  
  # Clean old install
  rm -rf "$PI_EXT_DIR"
  mkdir -p "$PI_EXT_DIR"
  
  # Copy files
  cp -r .pi/extensions/xpowers/* "$PI_EXT_DIR/"
  cp -r skills "$PI_EXT_DIR/"
  cp -r commands "$PI_EXT_DIR/"
  
  # Inject AGENTS.md
  if [[ -f "$HOME/.pi/agent/AGENTS.md" ]]; then
    if ! grep -q "<!-- BEGIN XPOWERS PI -->" "$HOME/.pi/agent/AGENTS.md"; then
      echo "" >> "$HOME/.pi/agent/AGENTS.md"
      cat .pi/AGENTS.md >> "$HOME/.pi/agent/AGENTS.md"
    fi
  else
    mkdir -p "$HOME/.pi/agent"
    cp .pi/AGENTS.md "$HOME/.pi/agent/AGENTS.md"
  fi
  
  # Install dependencies
  info "Installing extension dependencies..."
  cd "$PI_EXT_DIR"
  npm install --silent >/dev/null 2>&1
  
  # Build the extension (requires Bun)
  if command -v bun >/dev/null 2>&1; then
    info "Building Pi extension..."
    bun build index.ts --target=node --format=esm --packages=external --outfile=dist/index.js >/dev/null 2>&1
    if [[ ! -f "dist/index.js" ]]; then
      error "Build failed: dist/index.js was not created."
      exit 1
    fi
  else
    error "Bun is required to build the Pi extension (npm install is sufficient for dependencies, but build requires Bun)."
    exit 1
  fi
  
  success "Pi extension installed via npm!"
fi

# ---------------------------------------------------------------------------
# Completion
# ---------------------------------------------------------------------------

echo
echo -e "${GREEN}${BOLD}✨ Setup Complete!${RESET}"
echo
echo -e "You can now start ${CYAN}pi${RESET} and use your new xpowers:"
echo -e "  ${BOLD}/routing-settings${RESET}  — Configure models and effort levels"
echo -e "  ${BOLD}/execute-ralph${RESET}     — Autonomous epic execution"
echo -e "  ${BOLD}/brainstorm${RESET}        — Interactive design planning"
echo -e "  ${BOLD}/review-parallel${RESET}   — Multi-agent parallel review"
echo
echo -e "For full documentation: ${CYAN}https://github.com/dpolishuk/xpowers/blob/main/docs/pi.md${RESET}"
echo
