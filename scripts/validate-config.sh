#!/usr/bin/env bash
#
# validate-config.sh - Validates required configuration before build
#
# This script ensures all required environment variables and files
# are present before attempting to build the app.
#
# Usage: ./scripts/validate-config.sh [--fix]
#   --fix: Attempt to fetch missing secrets from Google Cloud
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"
ERRORS=0
WARNINGS=0

log_error() {
  echo -e "${RED}ERROR:${NC} $1"
  ((ERRORS++))
}

log_warning() {
  echo -e "${YELLOW}WARNING:${NC} $1"
  ((WARNINGS++))
}

log_success() {
  echo -e "${GREEN}OK:${NC} $1"
}

echo "============================================"
echo "Bad Bingo Configuration Validator"
echo "============================================"
echo ""

# Check for .env.local file
echo "Checking environment file..."
if [[ ! -f "$ENV_FILE" ]]; then
  log_error ".env.local file not found!"
  echo "  Create it with:"
  echo "    VITE_SUPABASE_URL=https://your-project.supabase.co"
  echo "    VITE_SUPABASE_ANON_KEY=your-anon-key"
  echo "    VITE_GEMINI_API_KEY=your-gemini-key"
  echo ""
  echo "  Or fetch from Google Cloud:"
  echo "    ./scripts/gcloud-secrets-fetch.sh"
else
  log_success ".env.local file exists"

  # Source the env file
  set -a
  source "$ENV_FILE"
  set +a

  # Check required variables
  echo ""
  echo "Checking required environment variables..."

  if [[ -z "${VITE_SUPABASE_URL:-}" ]]; then
    log_error "VITE_SUPABASE_URL is not set"
  elif [[ ! "$VITE_SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
    log_error "VITE_SUPABASE_URL format is invalid (should be https://xxx.supabase.co)"
  else
    log_success "VITE_SUPABASE_URL is configured"
  fi

  if [[ -z "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
    log_error "VITE_SUPABASE_ANON_KEY is not set"
  elif [[ ! "$VITE_SUPABASE_ANON_KEY" =~ ^eyJ ]]; then
    log_error "VITE_SUPABASE_ANON_KEY format is invalid (should be a JWT starting with eyJ)"
  else
    log_success "VITE_SUPABASE_ANON_KEY is configured"
  fi

  if [[ -z "${VITE_GEMINI_API_KEY:-}" ]]; then
    log_warning "VITE_GEMINI_API_KEY is not set (AI features will be limited)"
  elif [[ ! "$VITE_GEMINI_API_KEY" =~ ^AIza ]]; then
    log_warning "VITE_GEMINI_API_KEY format looks incorrect (should start with AIza)"
  else
    log_success "VITE_GEMINI_API_KEY is configured"
  fi
fi

# Check for required files
echo ""
echo "Checking required files..."

if [[ -f "${ROOT_DIR}/android/app/google-services.json" ]]; then
  log_success "google-services.json exists"
else
  log_warning "google-services.json not found (push notifications will not work)"
fi

if [[ -f "${ROOT_DIR}/package.json" ]]; then
  log_success "package.json exists"
else
  log_error "package.json not found!"
fi

if [[ -f "${ROOT_DIR}/capacitor.config.ts" ]]; then
  log_success "capacitor.config.ts exists"
else
  log_error "capacitor.config.ts not found!"
fi

# Check node_modules
echo ""
echo "Checking dependencies..."

if [[ -d "${ROOT_DIR}/node_modules" ]]; then
  log_success "node_modules exists"
else
  log_error "node_modules not found - run 'npm install'"
fi

# Summary
echo ""
echo "============================================"
echo "Validation Summary"
echo "============================================"

if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}FAILED:${NC} $ERRORS error(s), $WARNINGS warning(s)"
  echo ""
  echo "Fix the errors above before building."

  # Offer to fetch from Google Cloud
  if [[ "${1:-}" == "--fix" ]]; then
    echo ""
    echo "Attempting to fetch secrets from Google Cloud..."
    if "${ROOT_DIR}/scripts/gcloud-secrets-fetch.sh"; then
      echo -e "${GREEN}Secrets fetched successfully!${NC}"
      echo "Run this script again to verify."
    else
      echo -e "${RED}Failed to fetch secrets.${NC}"
      echo "Ensure you're authenticated: gcloud auth login"
    fi
  else
    echo ""
    echo "Tip: Run with --fix to attempt automatic configuration:"
    echo "  ./scripts/validate-config.sh --fix"
  fi

  exit 1
else
  if [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}PASSED with warnings:${NC} $WARNINGS warning(s)"
  else
    echo -e "${GREEN}PASSED:${NC} All checks passed!"
  fi
  echo ""
  echo "Ready to build: npm run build"
  exit 0
fi
