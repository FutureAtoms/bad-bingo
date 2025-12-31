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

MODE="all"
for arg in "$@"; do
  case "$arg" in
    --env-only) MODE="env" ;;
    --files-only) MODE="files" ;;
    *) ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_ENV="${OUT_ENV:-${ROOT_DIR}/.env.local}"
GOOGLE_SERVICES_JSON_OUT="${GOOGLE_SERVICES_JSON_OUT:-${ROOT_DIR}/android/app/google-services.json}"
FIREBASE_ADMIN_JSON_OUT="${FIREBASE_ADMIN_JSON_OUT:-${ROOT_DIR}/secrets/firebase-adminsdk.json}"
EDGE_ENV_OUT="${EDGE_ENV_OUT:-${ROOT_DIR}/secrets/edge.env}"

fetch_secret() {
  local name="$1"
  gcloud secrets versions access latest --secret="$name" --project "$PROJECT_ID" --quiet
}

if [[ "$MODE" == "all" || "$MODE" == "env" ]]; then
  SUPABASE_URL="$(fetch_secret "bad-bingo-supabase-url")"
  SUPABASE_ANON_KEY="$(fetch_secret "bad-bingo-supabase-anon-key")"
  GEMINI_API_KEY="$(fetch_secret "bad-bingo-gemini-api-key")"

  printf "VITE_SUPABASE_URL=%s\n" "$SUPABASE_URL" > "$OUT_ENV"
  printf "VITE_SUPABASE_ANON_KEY=%s\n" "$SUPABASE_ANON_KEY" >> "$OUT_ENV"
  printf "VITE_GEMINI_API_KEY=%s\n" "$GEMINI_API_KEY" >> "$OUT_ENV"

  chmod 600 "$OUT_ENV"
  echo "Wrote ${OUT_ENV}"
fi

if [[ "$MODE" == "all" || "$MODE" == "files" ]]; then
  mkdir -p "$(dirname "$GOOGLE_SERVICES_JSON_OUT")"
  mkdir -p "$(dirname "$FIREBASE_ADMIN_JSON_OUT")"

  fetch_secret "bad-bingo-google-services-json" > "$GOOGLE_SERVICES_JSON_OUT"
  fetch_secret "bad-bingo-firebase-adminsdk-json" > "$FIREBASE_ADMIN_JSON_OUT"

  chmod 600 "$GOOGLE_SERVICES_JSON_OUT" "$FIREBASE_ADMIN_JSON_OUT"
  echo "Wrote ${GOOGLE_SERVICES_JSON_OUT}"
  echo "Wrote ${FIREBASE_ADMIN_JSON_OUT}"

  if command -v python3 >/dev/null 2>&1; then
    SUPABASE_SERVICE_ROLE_KEY="$(fetch_secret "bad-bingo-supabase-service-role-key")"
    GEMINI_API_KEY="$(fetch_secret "bad-bingo-gemini-api-key")"

    {
      printf "SUPABASE_SERVICE_ROLE_KEY=%s\n" "$SUPABASE_SERVICE_ROLE_KEY"
      if [[ -n "$GEMINI_API_KEY" ]]; then
        printf "GEMINI_API_KEY=%s\n" "$GEMINI_API_KEY"
      fi
      python3 - <<'PY' "$FIREBASE_ADMIN_JSON_OUT"
import json
import sys

path = sys.argv[1]
data = json.load(open(path, "r", encoding="utf-8"))
project_id = data.get("project_id", "")
client_email = data.get("client_email", "")
private_key = data.get("private_key", "")
private_key = private_key.replace("\\", "\\\\").replace("\n", "\\n")

if project_id:
    print(f"FIREBASE_PROJECT_ID={project_id}")
if client_email:
    print(f"FIREBASE_CLIENT_EMAIL={client_email}")
if private_key:
    print(f"FIREBASE_PRIVATE_KEY=\"{private_key}\"")
PY
    } > "$EDGE_ENV_OUT"

    chmod 600 "$EDGE_ENV_OUT"
    echo "Wrote ${EDGE_ENV_OUT}"
  else
    echo "python3 not found; skipping ${EDGE_ENV_OUT} generation"
  fi
fi
