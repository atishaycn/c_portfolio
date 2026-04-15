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

while IFS='|' read -r folder public_base local_dir; do
  while IFS= read -r -d '' file; do
    base="$(basename "$file")"
    public_id="${base%.*}"
    upload_file "$file" "$public_id" "$public_base"
  done < <(find "$local_dir" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) -print0 | sort -z)
done <<'EOF'
California|place/california|Place/California
San Francisco|place/california/san-francisco|Place/California/San Francisco
EOF

echo "Done."
