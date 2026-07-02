#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${CLOUDINARY_URL:-}" ]]; then
  if [[ -n "${CLOUDINARY_API_KEY:-}" && -n "${CLOUDINARY_API_SECRET:-}" && -n "${CLOUDINARY_CLOUD_NAME:-}" ]]; then
    export CLOUDINARY_URL="cloudinary://${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}@${CLOUDINARY_CLOUD_NAME}"
  else
    echo "CLOUDINARY_URL is required" >&2
    exit 1
  fi
fi

read -r CLOUD_NAME API_KEY API_SECRET < <(python3 - <<'PY'
from urllib.parse import urlparse
import os

url = urlparse(os.environ["CLOUDINARY_URL"])
print(url.hostname or "", url.username or "", url.password or "")
PY
)

if [[ -z "$CLOUD_NAME" || -z "$API_KEY" || -z "$API_SECRET" ]]; then
  echo "Could not parse CLOUDINARY_URL" >&2
  exit 1
fi

upload_file() {
  local file_path="$1" public_id="$2" timestamp signature response tmp_file=""
  timestamp="$(date +%s)"
  signature="$(PUBLIC_ID="$public_id" TIMESTAMP="$timestamp" API_SECRET="$API_SECRET" python3 - <<'PY'
import hashlib
import os

payload = f"overwrite=true&public_id={os.environ['PUBLIC_ID']}&timestamp={os.environ['TIMESTAMP']}{os.environ['API_SECRET']}"
print(hashlib.sha1(payload.encode()).hexdigest())
PY
)"

  if [[ $(stat -f%z "$file_path") -gt 10485760 ]]; then
    tmp_file="$(mktemp /tmp/cloudinary-commissioned.XXXXXX).jpg"
    for quality in 80 70 60 50 40; do
      sips -s format jpeg -s formatOptions "$quality" "$file_path" --out "$tmp_file" >/dev/null
      [[ $(stat -f%z "$tmp_file") -le 10485760 ]] && break
    done
    if [[ $(stat -f%z "$tmp_file") -gt 10485760 ]]; then
      echo "Could not reduce $file_path below Cloudinary's 10 MB limit" >&2
      rm -f "$tmp_file"
      return 1
    fi
    file_path="$tmp_file"
  fi

  response="$(curl -sS "https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload" \
    -F "file=@${file_path}" \
    -F "public_id=${public_id}" \
    -F "overwrite=true" \
    -F "timestamp=${timestamp}" \
    -F "api_key=${API_KEY}" \
    -F "signature=${signature}")"
  [[ -z "$tmp_file" ]] || rm -f "$tmp_file"

  RESPONSE="$response" EXPECTED="$public_id" python3 - <<'PY'
import json
import os

asset = json.loads(os.environ["RESPONSE"])
if "error" in asset:
    raise SystemExit(f'Cloudinary rejected {os.environ["EXPECTED"]}: {asset["error"]["message"]}')
assert asset["public_id"] == os.environ["EXPECTED"], asset
print(f'{asset["public_id"]}\t{asset["width"]}x{asset["height"]}\t{asset["bytes"]}\t{asset["secure_url"]}')
PY
}

while IFS= read -r file_path; do
  number="$(basename "$file_path" .jpg)"
  upload_file "$file_path" "commissioned-work/$number"
done < <(find "Commissioned Work" -maxdepth 1 -type f -name '*.jpg' | sort -t/ -k3,3n)
