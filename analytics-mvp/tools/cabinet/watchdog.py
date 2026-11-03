"""Bounded recovery for the existing Ozon -> Pages workflow chain."""
import datetime as dt
import json
import os
import urllib.request

WORKFLOWS = ['orders-backfill.yml', 'ozon-snapshots.yml', 'deploy-pages.yml', 'ozon-cabinet-publish.yml']


def stamp(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))


def plan(runs, now):
    # GitHub emits skipped Pages runs for unrelated unsuccessful workflows.
    # Those never deploy and must not hide the last actual publication.
    runs = {name: sorted((r for r in runs.get(name, [])
                         if r.get('head_branch', 'main') == 'main' and r.get('conclusion') != 'skipped'),
                        key=lambda r: stamp(r['created_at']), reverse=True) for name in WORKFLOWS}
    active = [(name, r) for name, rows in runs.items() for r in rows if r['status'] != 'completed']
    limits = {'orders-backfill.yml': 210, 'ozon-snapshots.yml': 390,
              'deploy-pages.yml': 90, 'ozon-cabinet-publish.yml': 45}
    stuck = [{'workflow': name, 'run_id': r['id'], 'status': r['status']}
             for name, r in active
             if now-stamp(r.get('run_started_at') or r['created_at']) > dt.timedelta(minutes=limits[name])
             or r['status'] in ['waiting', 'action_required']]
    if stuck:
        return {'action': 'attention', 'stuck': stuck, 'reason': 'Workflow blocked or exceeded expected duration; do not cancel automatically'}
    # Never evict pending ozon-data / Pages work through another dispatch.
    if active:
        return {'action': 'wait', 'reason': 'Existing collection/publication is active'}
    latest = {k: v[0] if v else None for k, v in runs.items()}
    orders = latest['orders-backfill.yml']
    if not orders or now-stamp(orders['created_at']) >= dt.timedelta(hours=12):
        return {'action': 'dispatch', 'workflow': 'orders-backfill.yml', 'reason': 'No API collection attempt in twelve hours'}
    snapshots = latest['ozon-snapshots.yml']
    # Retry the same failed run once; never repeatedly dispatch a broken run.
    for name in WORKFLOWS[:2]:
        run = latest[name]
        if name == 'ozon-snapshots.yml' and (not run or stamp(run['created_at']) < stamp(orders['created_at'])):
            continue
        if run and run['conclusion'] in ['failure', 'timed_out'] and run.get('run_attempt', 1) < 2:
            return {'action': 'rerun', 'run_id': run['id'], 'workflow': name, 'reason': 'One recovery attempt after failure'}
    if not snapshots or stamp(snapshots['created_at']) < stamp(orders['created_at']):
        return {'action': 'dispatch', 'workflow': 'ozon-snapshots.yml', 'reason': 'Continue after completed orders collection'}
    pages = latest['deploy-pages.yml']
    cabinet = latest['ozon-cabinet-publish.yml']
    source_time = max([stamp(snapshots['updated_at'])] +
                      ([stamp(cabinet['updated_at'])] if cabinet and cabinet['conclusion'] == 'success' else []))
    if not pages or stamp(pages['created_at']) < source_time:
        return {'action': 'dispatch', 'workflow': 'deploy-pages.yml', 'reason': 'Publish after completed source update'}
    if pages['conclusion'] in ['failure', 'timed_out'] and pages.get('run_attempt', 1) < 2:
        return {'action': 'rerun', 'run_id': pages['id'], 'workflow': 'deploy-pages.yml', 'reason': 'One recovery attempt for publication'}
    failed = [name for name in WORKFLOWS if latest[name] and latest[name]['conclusion'] != 'success']
    return {'action': 'attention' if failed else 'ok', 'failed': failed,
            'reason': 'Retry limit reached' if failed else 'API collection and publication completed'}


def main():
    repo = os.environ['GITHUB_REPOSITORY']
    token = os.environ['GH_TOKEN']
    def api(path, body=None):
        req = urllib.request.Request(f'https://api.github.com/repos/{repo}/{path}',
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json',
                     'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'})
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    runs = {name: api(f'actions/workflows/{name}/runs?branch=main&per_page=30')['workflow_runs'] for name in WORKFLOWS}
    result = plan(runs, dt.datetime.now(dt.timezone.utc))
    if result['action'] == 'dispatch':
        api(f"actions/workflows/{result['workflow']}/dispatches", {'ref': 'main'})
    elif result['action'] == 'rerun':
        api(f"actions/runs/{result['run_id']}/rerun-failed-jobs", {})
    print(json.dumps(result))
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
        f.write('Ozon recovery: '+json.dumps(result, ensure_ascii=False)+'\n')
    if result['action'] == 'attention':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
