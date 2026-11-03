"""Publish exactly one validated capture from the commit used for staged checks.

Fast-forward-only ref update rejects any main change during validation; an
optimistic check of only cabinet_capture.json would miss changed API inputs.
"""
import argparse
import base64
import json
from pathlib import Path
import os
import subprocess

PATH = 'analytics-mvp/data/cabinet_capture.json'


def api(endpoint, payload=None, method='POST'):
    cmd = ['gh', 'api', f"repos/{os.environ['GITHUB_REPOSITORY']}/{endpoint}"]
    if payload is not None:
        cmd += ['--method', method, '--input', '-']
    r = subprocess.run(cmd, input=json.dumps(payload) if payload is not None else None,
                       text=True, capture_output=True, check=True, timeout=60)
    return json.loads(r.stdout) if r.stdout.strip() else None


def publish(checked_head, raw, previous):
    if json.loads(raw) == previous:
        return {'changed': False}
    if api('git/ref/heads/main')['object']['sha'] != checked_head:
        raise ValueError('Main changed during checks; reprepare and validate current inputs')
    parent = api(f'git/commits/{checked_head}')
    blob = api('git/blobs', {'content': base64.b64encode(raw).decode(), 'encoding': 'base64'})
    tree = api('git/trees', {'base_tree': parent['tree']['sha'], 'tree': [
        {'path': PATH, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']}]})
    commit = api('git/commits', {'message': 'data: validated scheduled Ozon cabinet capture',
                               'tree': tree['sha'], 'parents': [checked_head]})
    # If main advanced after the read above, this is not a fast-forward and GitHub rejects it.
    api('git/refs/heads/main', {'sha': commit['sha'], 'force': False}, method='PATCH')
    return {'changed': True, 'commit': commit['sha']}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('checked_head'); p.add_argument('incoming'); p.add_argument('previous')
    a = p.parse_args()
    print(json.dumps(publish(a.checked_head, Path(a.incoming).read_bytes(), json.loads(Path(a.previous).read_text()))))
