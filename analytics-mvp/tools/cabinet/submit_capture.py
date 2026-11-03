"""Submit one prepared sanitized capture to the server-side publication gate.

Uses existing gh authentication. Does not read browser credentials or change
Ozon. Raw XLSX and manifests remain local. No direct write to main.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

REPO = 'oliverjone01-dev/t1'


def api(endpoint, payload=None):
    cmd = ['gh', 'api', f'repos/{REPO}/{endpoint}']
    if payload is not None:
        cmd += ['--method', 'POST', '--input', '-']
    r = subprocess.run(cmd, input=json.dumps(payload) if payload is not None else None,
                       text=True, capture_output=True, check=True)
    return json.loads(r.stdout) if r.stdout.strip() else None


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('prepared', type=Path)
    a = p.parse_args()
    raw = (a.prepared/'cabinet_capture.json').read_bytes()
    manifest = json.loads((a.prepared/'manifest.json').read_text())
    ready = json.loads((a.prepared/'READY.json').read_text())
    digest = hashlib.sha256(raw).hexdigest()
    if digest != manifest['public_sha256'] or digest != ready['sha256'] or not manifest['ready_for_summary_publication']:
        raise ValueError('Prepared package is not ready or changed')
    root = Path(__file__).resolve().parents[2]
    # Fail before uploading anything outside the established public schema.
    subprocess.run(['node', '--import', 'tsx', 'src/scripts/ozon/validate-cabinet-capture.ts',
                    str((a.prepared/'cabinet_capture.json').resolve())], cwd=root, check=True)
    current = api('contents/analytics-mvp/data/cabinet_capture.json?ref=main')
    blob = api('git/blobs', {'content': raw.decode('utf-8'), 'encoding': 'utf-8'})
    api('actions/workflows/ozon-cabinet-publish.yml/dispatches',
        {'ref': 'main', 'inputs': {'blob_sha': blob['sha'], 'base_sha': current['sha']}})
    receipt = {'submitted': True, 'blob_sha': blob['sha'], 'base_sha': current['sha'],
               'public_sha256': digest, 'published': False}
    (a.prepared.parent/'submission.json').write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
