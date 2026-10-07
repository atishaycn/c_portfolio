#!/usr/bin/env python3
"""Read-only thumbnail comparison. Requires Pillow; never uses Drive write APIs."""
import concurrent.futures
import html
import io
import json
import math
import os
from pathlib import Path
import urllib.parse
import urllib.request
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
LOCAL = ROOT / '.drive-migration.local'
REVIEW = LOCAL / 'review'


def signature(image):
    image = ImageOps.exif_transpose(image).convert('RGB')
    small = image.resize((9, 8), Image.Resampling.LANCZOS).convert('L')
    pixels = list(small.getdata())
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1])
    color = list(image.resize((16, 16), Image.Resampling.LANCZOS).getdata())
    return {'hash': bits, 'color': color, 'ratio': image.width / image.height}


def distance(a, b):
    hamming = bin(a['hash'] ^ b['hash']).count('1')
    mse = sum((x - y) ** 2 for p, q in zip(a['color'], b['color']) for x, y in zip(p, q)) / (256 * 3 * 255 ** 2)
    ratio_delta = abs(math.log(a['ratio'] / b['ratio']))
    return {'hashDistance': hamming, 'colorMse': round(mse, 6), 'aspectDelta': round(ratio_delta, 6),
            'score': round(hamming + mse * 100 + min(ratio_delta, 1) * 20, 4)}


def fetch_thumbnail(file):
    file_id = file['id']
    if not file_id or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in file_id):
        return file_id, None, 'Invalid Drive ID'
    path = REVIEW / 'thumbs' / f'drive-{file_id}.jpg'
    try:
        if path.exists():
            data = path.read_bytes()
        else:
            url = file.get('thumbnailLink', '')
            parsed = urllib.parse.urlsplit(url)
            if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.googleusercontent.com'):
                raise ValueError('Unexpected thumbnail host')
            # These are public photo thumbnails. No OAuth token is sent to the image host.
            request = urllib.request.Request(url, headers={'User-Agent': 'Portfolio-migration-review/1.0'})
            with urllib.request.urlopen(request, timeout=20) as response:
                data = response.read(5_000_001)
            if len(data) > 5_000_000:
                raise ValueError('Thumbnail exceeded size limit')
        with Image.open(io.BytesIO(data)) as image:
            sig = signature(image)
            if not path.exists():
                ImageOps.exif_transpose(image).convert('RGB').save(path, 'JPEG', quality=90)
                os.chmod(path, 0o600)
        return file_id, sig, None
    except Exception as error:
        # Do not print signed thumbnail URLs or response content.
        return file_id, None, type(error).__name__


def main():
    plan = json.loads((LOCAL / 'plan.json').read_text())
    inventory = json.loads((LOCAL / 'drive-inventory.json').read_text())
    (REVIEW / 'thumbs').mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(REVIEW, 0o700)
    files = {f['id']: f for f in inventory['files'] if f['mimeType'].startswith('image/')}
    signatures = {}
    errors = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for index, (file_id, sig, error) in enumerate(pool.map(fetch_thumbnail, files.values())):
            if error:
                errors[file_id] = error
            else:
                signatures[file_id] = sig
            if (index + 1) % 100 == 0:
                print(f'Thumbnails checked: {index + 1}/{len(files)}', flush=True)

    results = []
    exact_calibration = []
    for album in plan['albums']:
        for entry in album['entries']:
            with Image.open(entry['backupPath']) as image:
                source_sig = signature(image)
                photo_id = entry['photo']['id']
                if not photo_id or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in photo_id):
                    raise ValueError('Unsafe photo ID')
                source_name = f'site-{photo_id}.jpg'
                source_path = REVIEW / 'thumbs' / source_name
                output = ImageOps.exif_transpose(image).convert('RGB')
                output.thumbnail((320, 320))
                output.save(source_path, 'JPEG', quality=90)
                os.chmod(source_path, 0o600)
            match = entry['match']
            if match['status'] == 'exact':
                target_id = match['driveFileId']
                if target_id in signatures:
                    exact_calibration.append(distance(source_sig, signatures[target_id]))
                candidates = [{'id': target_id, 'path': match['drivePath'], 'byteExact': True}]
                status = 'Byte-exact match'
            else:
                # Compare cheap hashes first, then rank the closest 30 with color and aspect ratio.
                nearest = sorted(signatures, key=lambda fid: bin(source_sig['hash'] ^ signatures[fid]['hash']).count('1'))[:30]
                candidates = sorted(({'id': fid, 'path': files[fid]['path'], **distance(source_sig, signatures[fid])}
                                     for fid in nearest), key=lambda c: c['score'])[:3]
                best = candidates[0] if candidates else None
                strong = best and best['hashDistance'] <= 8 and best['colorMse'] <= 0.025 and best['aspectDelta'] <= 0.05
                status = 'Visual candidate, needs approval' if strong else 'No close visual match found'
            results.append({'album': album['name'], 'photoId': entry['photo']['id'], 'position': entry['position'],
                            'printEnabled': bool(entry['photo'].get('printEnabled')), 'sourceThumbnail': f'thumbs/{source_name}',
                            'status': status, 'candidates': candidates})

    report = {'version': 1, 'dryRun': True, 'sourceRevision': plan['sourceRevision'],
              'contentSha256': plan['contentSha256'], 'scannedImages': len(files), 'thumbnailsRead': len(signatures),
              'thumbnailErrors': errors, 'exactCalibration': exact_calibration, 'results': results}
    result_path = LOCAL / 'visual-matches.json'
    result_path.write_text(json.dumps(report, indent=2) + '\n')
    os.chmod(result_path, 0o600)
    write_review(plan, report)
    print(json.dumps({'byteExact': sum(r['status'] == 'Byte-exact match' for r in results),
                      'visualCandidates': sum(r['status'].startswith('Visual candidate') for r in results),
                      'noCloseMatch': sum(r['status'].startswith('No close') for r in results),
                      'thumbnailErrors': len(errors)}), flush=True)
    print('Review saved to .drive-migration.local/review/index.html. No Drive writes occurred.', flush=True)


def write_review(plan, report):
    escape = html.escape
    cards = []
    # The four strongest visual candidates need the user's attention first.
    priority = {'Visual candidate, needs approval': 0, 'No close visual match found': 1, 'Byte-exact match': 2}
    rows = sorted(report['results'], key=lambda r: (priority[r['status']], r['album'], r['position']))
    for row in rows:
        candidates = []
        for candidate in row['candidates']:
            name = f'thumbs/drive-{candidate["id"]}.jpg'
            score = 'Identical original bytes' if candidate.get('byteExact') else f'Hash distance {candidate["hashDistance"]}, color error {candidate["colorMse"]}, aspect difference {candidate["aspectDelta"]}'
            link = 'https://drive.google.com/file/d/' + urllib.parse.quote(candidate['id'], safe='') + '/view'
            candidates.append(f'<div><img loading="lazy" src="{escape(name)}" alt="Drive candidate"><p>{escape(candidate["path"])}</p><small>{escape(score)}</small><p><a href="{escape(link)}" target="_blank" rel="noreferrer">Open original in Drive</a></p></div>')
        cards.append(f'<article><h2>{escape(row["album"])} · {row["position"] + 1:03d}</h2><p class="status">{escape(row["status"])}{", print enabled" if row["printEnabled"] else ""}</p><p><code>{escape(row["photoId"])}</code></p><div class="images"><div><img loading="lazy" src="{escape(row["sourceThumbnail"])}" alt="Current live photo"><p>Current website original</p></div>{"".join(candidates)}</div></article>')
    document = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drive photo mapping review</title>
<style>body{{font:16px system-ui;background:#f5f2eb;color:#25251f;margin:0;padding:24px}}main{{max-width:1300px;margin:auto}}h1{{font-size:32px}}h2{{font-size:20px}}article{{background:white;padding:20px;margin:22px 0;border:1px solid #ddd}}.images{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}}img{{width:100%;height:240px;object-fit:contain;background:#eee}}p{{overflow-wrap:anywhere}}small,code{{font-size:12px}}.status{{font-weight:600}}@media(max-width:700px){{.images{{grid-template-columns:repeat(2,minmax(0,1fr))}}img{{height:180px}}}}</style>
<main><h1>Drive photo mapping review</h1><p>Read-only dry run for live revision {plan['sourceRevision']}. No Drive or website changes.</p><p>{plan['summary']['photos']} photos. {plan['summary']['exact']} byte-exact matches in the initial scan. Visual matches need approval and do not prove identical crops or edits. {len(report['thumbnailErrors'])} thumbnails could not be read. Unmatched photos may still exist among those images.</p><p>Visual candidates appear first, then unresolved photos, then exact matches. The closest images shown for unresolved photos are search results, not approved matches. Each row keeps the current photo ID, album position, and print setting.</p>{''.join(cards)}</main></html>'''
    path = REVIEW / 'index.html'
    path.write_text(document)
    os.chmod(path, 0o600)


if __name__ == '__main__':
    main()
