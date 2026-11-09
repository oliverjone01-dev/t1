"""Idempotent submission of a prepared public capture, using existing gh auth.

Only sanitized JSON leaves the machine. A durable receipt precedes dispatch;
an ambiguous response is reconciled with Actions, never blindly resubmitted.
"""
import argparse
import base64
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from accept_capture import accept

REPO = 'oliverjone01-dev/t1'
WORKFLOW = 'ozon-cabinet-publish.yml'


def api(endpoint, payload=None):
    cmd = ['gh', 'api', f'repos/{REPO}/{endpoint}']
    if payload is not None:
        cmd += ['--method', 'POST', '--input', '-']
    r = subprocess.run(cmd, input=json.dumps(payload) if payload is not None else None,
                       text=True, capture_output=True, check=True, timeout=60)
    return json.loads(r.stdout) if r.stdout.strip() else None


def save(path, receipt):
    receipt['updated_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as out:
        json.dump(receipt, out, indent=2); out.write('\n'); out.flush(); os.fsync(out.fileno())
        tmp = out.name
    os.replace(tmp, path)
    return receipt


def validate(path):
    subprocess.run(['node', '--import', 'tsx', 'src/scripts/ozon/validate-cabinet-capture.ts', str(path)],
                   cwd=Path(__file__).resolve().parents[2], check=True, timeout=90)


def submit(prepared, now=None, retry_failed=False, backfill_since=None):
    prepared = prepared.resolve()
    raw = (prepared/'cabinet_capture.json').read_bytes()
    manifest = json.loads((prepared/'manifest.json').read_text())
    ready = json.loads((prepared/'READY.json').read_text())
    digest = hashlib.sha256(raw).hexdigest()
    if len(raw) > 32_000_000 or digest != manifest['public_sha256'] or digest != ready['sha256'] or manifest['ready_for_summary_publication'] is not True:
        raise ValueError('Prepared package is not ready or changed')
    validate(prepared/'cabinet_capture.json')  # before any public upload
    incoming = json.loads(raw)
    receipt_path = prepared.parent/'submission.json'
    receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else {}
    current = api('contents/analytics-mvp/data/cabinet_capture.json?ref=main')
    content = current if current.get('encoding') == 'base64' else api(f"git/blobs/{current['sha']}")
    previous = json.loads(base64.b64decode(content['content']))
    # Includes partial packages: if every included row is already current, no upload or dispatch.
    old = {(r['day'], r['phase']): r for r in previous['snapshots']}
    if all(old.get((r['day'], r['phase'])) == r for r in incoming['snapshots']) and all(previous.get(k) == incoming[k] for k in ['catalogs', 'competitors', 'cpo'] if k in incoming):
        return save(receipt_path, {'state': 'data_in_main', 'public_sha256': digest,
                                  'data_committed': True, 'published': False,
                                  'note': 'Still verify Pages and live source date'})
    runs = api(f'actions/workflows/{WORKFLOW}/runs?branch=main&per_page=100')['workflow_runs']
    retry_allowed = False
    if receipt.get('public_sha256') == digest and receipt.get('state') in ['dispatching', 'submitted', 'unknown', 'server_running', 'server_failed']:
        matches = [r for r in runs if r.get('display_title') == receipt.get('run_name')
                   and r['id'] > receipt.get('previous_run_id', 0)]
        if matches:
            run = max(matches, key=lambda r: r['id'])
            receipt.update(run_id=run['id'], run_url=run.get('html_url'), conclusion=run['conclusion'],
                           state='server_running' if run['status'] != 'completed' else 'server_failed')
            if run['status'] == 'completed' and run['conclusion'] == 'success':
                # A successful older run cannot prove the currently requested data are in main.
                receipt['note'] = 'Run succeeded but requested data are no longer current; reprepare from main'
        else:
            receipt.update(state='unknown', note='Dispatch outcome unknown; reconcile before any retry')
        save(receipt_path, receipt)
        retry_allowed = bool(retry_failed and matches and run['status'] == 'completed'
                             and run['conclusion'] in ['failure', 'timed_out']
                             and receipt.get('attempt', 1) < 2)
        if not retry_allowed:
            return receipt
    # Fail stale/conflicting input before upload. The server repeats this against current main.
    accept(previous, incoming, now, backfill_since)
    if any(r['status'] != 'completed' for r in runs):
        raise RuntimeError('Cabinet publication already active; await it and reprepare against main')
    blob = api('git/blobs', {'content': raw.decode('utf-8'), 'encoding': 'utf-8'})
    run_name = f"cabinet-{blob['sha']}-{current['sha']}"
    # Recover across a lost local receipt too, as long as the server run is visible.
    matches = [r for r in runs if r.get('display_title') == run_name]
    if matches and not retry_allowed:
        raise RuntimeError('This exact submission already has a server run; inspect it before reprepare')
    previous_run_id = run['id'] if retry_allowed else 0
    attempt = receipt.get('attempt', 1) + 1 if retry_allowed else 1
    receipt = {'state': 'dispatching', 'previous_run_id': previous_run_id, 'attempt': attempt, 'submitted': False, 'blob_sha': blob['sha'],
               'base_sha': current['sha'], 'run_name': run_name,
               'public_sha256': digest, 'published': False}
    save(receipt_path, receipt)
    try:
        api(f'actions/workflows/{WORKFLOW}/dispatches',
            {'ref': 'main', 'inputs': {'blob_sha': blob['sha'], 'base_sha': current['sha'], 'backfill_since': backfill_since or ''}})
    except (subprocess.SubprocessError, OSError):
        receipt['state'] = 'unknown'
        save(receipt_path, receipt)
        raise
    receipt.update(state='submitted', submitted=True)
    return save(receipt_path, receipt)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('prepared', type=Path)
    p.add_argument('--backfill-since', help='Explicit earliest historical source day to restore')
    p.add_argument('--retry-failed', action='store_true', help='One retry only after a confirmed failed server run; never an unknown dispatch')
    a = p.parse_args()
    # Nonblocking process-wide lock, shared by different package paths on this Mac.
    lockpath = Path(tempfile.gettempdir())/f'ozon-cabinet-submit-{os.getuid()}.lock'
    with lockpath.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        receipt = submit(a.prepared, retry_failed=a.retry_failed, backfill_since=a.backfill_since)
    print(json.dumps(receipt))
    if receipt['state'] in ['unknown', 'server_failed']:
        raise SystemExit(2)


if __name__ == '__main__':
    main()
