"""Recover a missed YM collection, without mutating marketplace settings or Ozon."""
import datetime as dt
import json
import os
from pathlib import Path
import urllib.request
from zoneinfo import ZoneInfo

MSK = ZoneInfo('Europe/Moscow')
COLLECTOR = 'ym-snapshots.yml'
WORKFLOWS = (COLLECTOR, 'ym-delivery-sync.yml')
ROOT = Path(__file__).resolve().parents[3]


def stamp(value):
    if not isinstance(value, str):
        raise ValueError('Timestamp must be a string')
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timestamp must include timezone')
    return parsed


def freshness(data_dir, now):
    """Observation timestamps are not max(order date): zero sales is a valid day."""
    today = now.astimezone(MSK).date()
    problems = []
    for filename, key in (('_probe/orders.json', 'at'), ('catalog.json', 'generated_at'),
                          ('netting_state.json', 'at')):
        try:
            data = json.loads((data_dir / filename).read_text())
            observed = stamp(data[key])
            if observed.astimezone(MSK).date() != today or observed > now + dt.timedelta(minutes=5):
                problems.append(filename + ': stale/future observation')
            if filename == 'netting_state.json':
                expected = {business + '/' + today.strftime('%Y-%m')
                            for business in ('1023124', '74986385')}
                if not expected.issubset(set(data.get('months_done', []))):
                    problems.append(filename + ': missing business/month')
        except (OSError, ValueError, KeyError, TypeError):
            problems.append(filename + ': missing/invalid metadata')
    try:
        periods = json.loads((data_dir / 'ads_periods.json').read_text())
        yesterday = (today - dt.timedelta(days=1)).isoformat()
        if any(periods[key]['dateTo'] != yesterday for key in ('p7', 'p30', 'p90')):
            problems.append('ads_periods.json: closed-day window is stale')
    except (OSError, ValueError, KeyError, TypeError):
        problems.append('ads_periods.json: missing/invalid periods')
    return problems


def plan(runs, problems, now):
    local = now.astimezone(MSK)
    rows = [r for r in runs.get(COLLECTOR, []) if r.get('head_branch') == 'main']
    active = [r for name in WORKFLOWS for r in runs.get(name, [])
              if r.get('head_branch') == 'main' and r['status'] != 'completed']
    if active:
        stuck = [r['id'] for r in active if r['status'] in ('waiting', 'action_required')
                 or now - stamp(r.get('run_started_at') or r['created_at']) > dt.timedelta(minutes=135)]
        return {'action': 'attention' if stuck else 'wait', 'run_ids': [r['id'] for r in active],
                'reason': 'Active YM workflow blocked/overdue' if stuck else 'YM already running; no duplicate'}
    # Allow the normal 09:40 MSK job to complete before recovery.
    if (local.hour, local.minute) < (10, 45):
        return {'action': 'wait', 'reason': 'Before daily recovery deadline 10:45 MSK'}
    today = [r for r in rows if stamp(r.get('run_started_at') or r['created_at']).astimezone(MSK).date() == local.date()]
    if any(r['conclusion'] == 'success' for r in today) and not problems:
        return {'action': 'ok', 'reason': 'Successful collection today and fresh source metadata'}
    # Count rerun attempts too. Never spin on unavailable reports or expired credentials.
    attempts = sum(r.get('run_attempt', 1) for r in today)
    if attempts >= 2:
        return {'action': 'attention', 'reason': 'Daily limit reached; investigate instead of repeating',
                'attempts': attempts, 'source_problems': problems}
    return {'action': 'dispatch', 'workflow': COLLECTOR, 'reason': 'Missing successful fresh daily collection',
            'attempts': attempts, 'source_problems': problems}


def main():
    repo, token = os.environ['GITHUB_REPOSITORY'], os.environ['GH_TOKEN']
    def api(path, body=None):
        req = urllib.request.Request(f'https://api.github.com/repos/{repo}/{path}',
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json',
                     'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'})
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    # A failed read raises before any dispatch (never treat API errors as no runs).
    runs = {name: api(f'actions/workflows/{name}/runs?branch=main&per_page=100')['workflow_runs']
            for name in WORKFLOWS}
    now = dt.datetime.now(dt.timezone.utc)
    result = plan(runs, freshness(ROOT / 'analytics-mvp/data-ym', now), now)
    if result['action'] == 'dispatch':
        api(f'actions/workflows/{COLLECTOR}/dispatches', {'ref': 'main'})
    message = json.dumps(result, ensure_ascii=False)
    print(message)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as out:
            out.write('YM recovery: ' + message + '\n')
    if result['action'] == 'attention':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
