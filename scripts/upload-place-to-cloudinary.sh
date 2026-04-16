#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env" ]]; then
  # Load local environment variables for Cloudinary uploads.
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${CLOUDINARY_URL:-}" ]]; then
  if [[ -n "${CLOUDINARY_API_KEY:-}" && -n "${CLOUDINARY_API_SECRET:-}" && -n "${CLOUDINARY_CLOUD_NAME:-}" ]]; then
    CLOUDINARY_URL="cloudinary://${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}@${CLOUDINARY_CLOUD_NAME}"
  else
    echo "CLOUDINARY_URL is required" >&2
    echo "Set it directly or add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to .env" >&2
    exit 1
  fi
fi

CLOUD_NAME="$(python3 - <<'PY'
from urllib.parse import urlparse
import os
u = urlparse(os.environ['CLOUDINARY_URL'])
print(u.hostname or '')
PY
)"
API_KEY="$(python3 - <<'PY'
from urllib.parse import urlparse
import os
u = urlparse(os.environ['CLOUDINARY_URL'])
print(u.username or '')
PY
)"
API_SECRET="$(python3 - <<'PY'
from urllib.parse import urlparse
import os
u = urlparse(os.environ['CLOUDINARY_URL'])
print(u.password or '')
PY
)"

if [[ -z "$CLOUD_NAME" || -z "$API_KEY" || -z "$API_SECRET" ]]; then
  echo "Could not parse CLOUDINARY_URL" >&2
  exit 1
fi

upload_file() {
  local file_path="$1"
  local public_id="$2"
  local folder="$3"
  local timestamp signature upload_path tmp_file=""
  timestamp="$(date +%s)"
  signature="$(PUBLIC_ID="$public_id" FOLDER="$folder" TIMESTAMP="$timestamp" API_SECRET="$API_SECRET" python3 - <<'PY'
import hashlib, os
payload = f"folder={os.environ['FOLDER']}&overwrite=true&public_id={os.environ['PUBLIC_ID']}&timestamp={os.environ['TIMESTAMP']}{os.environ['API_SECRET']}"
print(hashlib.sha1(payload.encode()).hexdigest())
PY
)"

  upload_path="$file_path"
  if [[ $(stat -f%z "$file_path") -gt 10485760 ]]; then
    tmp_file="$(mktemp /tmp/cloudinary-upload.XXXXXX).jpg"
    for quality in 80 70 60 50 40; do
      sips -s format jpeg -s formatOptions "$quality" "$file_path" --out "$tmp_file" >/dev/null
      if [[ $(stat -f%z "$tmp_file") -le 10485760 ]]; then
        break
      fi
    done
    upload_path="$tmp_file"
  fi

  echo "Uploading $file_path -> $folder/$public_id"
  curl -fsS "https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload" \
    -F "file=@${upload_path}" \
    -F "public_id=${public_id}" \
    -F "folder=${folder}" \
    -F "overwrite=true" \
    -F "timestamp=${timestamp}" \
    -F "api_key=${API_KEY}" \
    -F "signature=${signature}" \
    >/dev/null

  if [[ -n "$tmp_file" ]]; then
    rm -f "$tmp_file"
  fi
}

SERIES_CATALOG=$(cat <<'EOF'
california|California|place/california|Place/California
san-francisco|San Francisco|place/california/san-francisco|Place/California/San Francisco
india|India|place/india|Place/India
EOF
)

usage() {
  cat <<'EOF'
Usage:
  ./scripts/upload-place-to-cloudinary.sh [series-key ...]

Examples:
  ./scripts/upload-place-to-cloudinary.sh                 # upload all configured place series
  ./scripts/upload-place-to-cloudinary.sh india california # upload only selected series
  PARALLEL=4 ./scripts/upload-place-to-cloudinary.sh california san-francisco india

Series keys:
  california
  san-francisco
  india
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

PARALLEL="${PARALLEL:-1}"
if ! [[ "$PARALLEL" =~ ^[0-9]+$ ]] || [[ "$PARALLEL" -lt 1 ]]; then
  echo "PARALLEL must be a positive integer" >&2
  exit 1
fi

selected=("$@")
should_upload() {
  local key="$1"
  if [[ ${#selected[@]} -eq 0 ]]; then
    return 0
  fi
  local wanted
  for wanted in "${selected[@]}"; do
    [[ "$wanted" == "$key" ]] && return 0
  done
  return 1
}

upload_series() {
  local key="$1"
  local label="$2"
  local public_base="$3"
  local local_dir="$4"

  if [[ ! -d "$local_dir" ]]; then
    echo "Skipping $label: missing directory $local_dir" >&2
    return 1
  fi

  echo "Starting series: $label ($key)"
  while IFS= read -r -d '' file; do
    base="$(basename "$file")"
    public_id="${base%.*}"
    upload_file "$file" "$public_id" "$public_base"
  done < <(find "$local_dir" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) -print0 | sort -z)
  echo "Finished series: $label ($key)"
}

matched=0
parallel_keys=()
parallel_labels=()
parallel_bases=()
parallel_dirs=()

while IFS='|' read -r key label public_base local_dir; do
  should_upload "$key" || continue
  matched=1
  if [[ "$PARALLEL" -gt 1 ]]; then
    parallel_keys+=("$key")
    parallel_labels+=("$label")
    parallel_bases+=("$public_base")
    parallel_dirs+=("$local_dir")
  else
    upload_series "$key" "$label" "$public_base" "$local_dir"
  fi
done <<< "$SERIES_CATALOG"

if [[ "$matched" -eq 0 ]]; then
  echo "No matching series keys selected." >&2
  usage >&2
  exit 1
fi

if [[ "$PARALLEL" -gt 1 ]]; then
  count=${#parallel_keys[@]}
  i=0
  while [[ "$i" -lt "$count" ]]; do
    pids=()
    j=0
    while [[ "$j" -lt "$PARALLEL" && $((i + j)) -lt "$count" ]]; do
      idx=$((i + j))
      upload_series "${parallel_keys[$idx]}" "${parallel_labels[$idx]}" "${parallel_bases[$idx]}" "${parallel_dirs[$idx]}" &
      pids+=("$!")
      j=$((j + 1))
    done
    for pid in "${pids[@]}"; do
      wait "$pid"
    done
    i=$((i + PARALLEL))
  done
fi

echo "Done."
