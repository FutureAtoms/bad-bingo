#!/usr/bin/env bash
set -euo pipefail

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd gcloud

PROJECT_ID="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "GCP project not set. Set GCP_PROJECT or run: gcloud config set project <id>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Optional: load .env.local to pick up VITE_* values without exporting manually.
if [[ -f "${ROOT_DIR}/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env.local"
  set +a
fi

GOOGLE_SERVICES_JSON="${GOOGLE_SERVICES_JSON:-${ROOT_DIR}/android/app/google-services.json}"
FIREBASE_ADMIN_JSON="${FIREBASE_ADMIN_JSON:-${HOME}/Downloads/bad-bingo-firebase-adminsdk-fbsvc-eb1eaa8df2.json}"

create_or_update_secret_file() {
  local name="$1"
  local file_path="$2"

  if [[ ! -f "$file_path" ]]; then
    echo "Missing file for secret ${name}: ${file_path}"
    return 1
  fi

  if gcloud secrets describe "$name" --project "$PROJECT_ID" --quiet >/dev/null 2>&1; then
    gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file="$file_path" --quiet >/dev/null
  else
    gcloud secrets create "$name" --project "$PROJECT_ID" --replication-policy="automatic" --data-file="$file_path" --quiet >/dev/null
  fi

  echo "Uploaded secret: ${name}"
}

create_or_update_secret_value() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    echo "Skipped secret ${name} (no value provided)"
    return 0
  fi

  if gcloud secrets describe "$name" --project "$PROJECT_ID" --quiet >/dev/null 2>&1; then
    printf "%s" "$value" | gcloud secrets versions add "$name" --project "$PROJECT_ID" --data-file=- --quiet >/dev/null
  else
    printf "%s" "$value" | gcloud secrets create "$name" --project "$PROJECT_ID" --replication-policy="automatic" --data-file=- --quiet >/dev/null
  fi

  echo "Uploaded secret: ${name}"
}

create_or_update_secret_file "bad-bingo-google-services-json" "$GOOGLE_SERVICES_JSON"
create_or_update_secret_file "bad-bingo-firebase-adminsdk-json" "$FIREBASE_ADMIN_JSON"

create_or_update_secret_value "bad-bingo-supabase-url" "${VITE_SUPABASE_URL:-}"
create_or_update_secret_value "bad-bingo-supabase-anon-key" "${VITE_SUPABASE_ANON_KEY:-}"
create_or_update_secret_value "bad-bingo-gemini-api-key" "${VITE_GEMINI_API_KEY:-}"
create_or_update_secret_value "bad-bingo-supabase-service-role-key" "${SUPABASE_SERVICE_ROLE_KEY:-}"
