import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import watchdog as w

NOW = dt.datetime(2026, 11, 10, 11, tzinfo=dt.timezone.utc)


def run(status='completed', conclusion='success', created='2026-11-10T07:00:00Z', **kw):
    return dict(id=1, status=status, conclusion=conclusion, created_at=created,
                head_branch='main', run_attempt=1, **kw)


class RecoveryTests(unittest.TestCase):
    def decision(self, rows, problems=(), now=NOW, delivery=()):
        return w.plan({w.COLLECTOR: rows, 'ym-delivery-sync.yml': delivery}, list(problems), now)['action']

    def test_missed_schedule_dispatches(self):
        self.assertEqual(self.decision([run(created='2026-11-09T16:47:59Z')], ['stale']), 'dispatch')

    def test_fresh_success_skips(self):
        self.assertEqual(self.decision([run()]), 'ok')

    def test_green_with_old_sources_retries(self):
        self.assertEqual(self.decision([run()], ['catalog stale']), 'dispatch')

    def test_failed_once_retries(self):
        self.assertEqual(self.decision([run(conclusion='failure')]), 'dispatch')

    def test_two_attempts_stop(self):
        self.assertEqual(self.decision([run(conclusion='failure'), run(conclusion='failure')]), 'attention')
        row = run(conclusion='failure'); row['run_attempt'] = 2
        self.assertEqual(self.decision([row]), 'attention')

    def test_active_not_cancelled_or_duplicated(self):
        for status in ('queued', 'in_progress', 'pending'):
            self.assertEqual(self.decision([run(status=status, conclusion=None, created='2026-11-10T10:30:00Z')]), 'wait')
        self.assertEqual(self.decision([], delivery=[run(status='in_progress', created='2026-11-10T10:30:00Z')]), 'wait')

    def test_blocked_and_overdue_alert(self):
        self.assertEqual(self.decision([run(status='waiting')]), 'attention')
        self.assertEqual(self.decision([run(status='in_progress')]), 'attention')

    def test_before_deadline_waits(self):
        self.assertEqual(self.decision([], now=NOW.replace(hour=7, minute=44)), 'wait')
        self.assertEqual(self.decision([], now=NOW.replace(hour=7, minute=45)), 'dispatch')

    def test_moscow_day_and_run_start(self):
        # UTC yesterday 22:00 is today in Moscow; counted towards the daily cap.
        rows = [run(created='2026-11-09T22:00:00Z', conclusion='failure') for _ in range(2)]
        self.assertEqual(self.decision(rows), 'attention')
        row = run(created='2026-11-09T18:00:00Z', run_started_at='2026-11-10T07:00:00Z')
        self.assertEqual(self.decision([row]), 'ok')

    def test_other_branch_not_evidence(self):
        row = run(); row['head_branch'] = 'other'
        self.assertEqual(self.decision([row]), 'dispatch')

    def test_source_coverage_and_zero_sales(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'_probe').mkdir()
            sources = {'_probe/orders.json': {'at': NOW.isoformat()},
                       'catalog.json': {'generated_at': NOW.isoformat()},
                       'netting_state.json': {'at': NOW.isoformat(), 'months_done': ['1023124/2026-11', '74986385/2026-11']},
                       'ads_periods.json': {p: {'dateTo': '2026-11-09'} for p in ('p7','p30','p90')}}
            def write():
                for name, data in sources.items(): (root/name).write_text(json.dumps(data))
            write()
            # No order rows at all: a valid zero-sales day is not stale.
            self.assertEqual(w.freshness(root, NOW), [])
            sources['netting_state.json']['months_done'].pop(); write()
            self.assertTrue(any('business/month' in p for p in w.freshness(root, NOW)))
            sources['catalog.json']['generated_at'] = '2026-11-11T01:00:00Z'; write()
            self.assertTrue(any('catalog' in p for p in w.freshness(root, NOW)))
            (root/'_probe/orders.json').write_text('not json')
            self.assertTrue(any('orders' in p for p in w.freshness(root, NOW)))
            for bad in ({'at': None}, {'at': 42}, [], None, {'at': '2026-11-10T11:00:00'}):
                (root/'_probe/orders.json').write_text(json.dumps(bad))
                self.assertTrue(any('orders' in p for p in w.freshness(root, NOW)))

    def test_api_read_failure_cannot_dispatch(self):
        with patch.dict('os.environ', {'GITHUB_REPOSITORY': 'owner/repo', 'GH_TOKEN': 'test'}), \
             patch('urllib.request.urlopen', side_effect=OSError('unavailable')) as request:
            with self.assertRaises(OSError): w.main()
            self.assertEqual(request.call_count, 1)
            self.assertEqual(request.call_args.args[0].get_method(), 'GET')


if __name__ == '__main__':
    unittest.main()
