import copy
import datetime as dt
import unittest
from accept_capture import accept
from watchdog import WORKFLOWS, plan

NOW = dt.datetime(2026, 11, 3, 7, 30, tzinfo=dt.timezone.utc)


def run(hour=6, status='completed', conclusion='success', attempt=1):
    stamp = NOW.replace(hour=hour).isoformat()
    return {'id': hour+1, 'status': status, 'conclusion': conclusion,
            'created_at': stamp, 'updated_at': stamp, 'run_attempt': attempt}


class Recovery(unittest.TestCase):
    def base(self):
        return dict(zip(WORKFLOWS, [[run(4)], [run(5)], [run(6)], []]))

    def test_active_work_is_not_evicted(self):
        rows = self.base(); rows[WORKFLOWS[0]] = [run(status='queued', conclusion=None)]
        self.assertEqual(plan(rows, NOW)['action'], 'wait')

    def test_no_changes_no_new_work(self):
        self.assertEqual(plan(self.base(), NOW)['action'], 'ok')

    def test_missing_schedule_recovers(self):
        rows = self.base(); rows[WORKFLOWS[0]] = []
        self.assertEqual(plan(rows, NOW)['workflow'], WORKFLOWS[0])

    def test_midnight_age_uses_elapsed_time(self):
        rows = self.base(); rows[WORKFLOWS[0]][0]['created_at'] = '2026-11-02T18:00:00+00:00'
        self.assertEqual(plan(rows, NOW)['workflow'], WORKFLOWS[0])

    def test_only_one_retry(self):
        rows = self.base(); rows[WORKFLOWS[1]] = [run(5, conclusion='failure')]
        self.assertEqual(plan(rows, NOW)['action'], 'rerun')
        rows[WORKFLOWS[1]][0]['run_attempt'] = 2
        self.assertEqual(plan(rows, NOW)['action'], 'attention')

    def test_missing_chain_continues(self):
        rows = self.base(); rows[WORKFLOWS[1]] = []
        self.assertEqual(plan(rows, NOW)['workflow'], WORKFLOWS[1])

    def test_new_capture_needs_publication(self):
        rows = self.base(); rows[WORKFLOWS[3]] = [run(7)]
        self.assertEqual(plan(rows, NOW)['workflow'], WORKFLOWS[2])

    def test_rejected_capture_is_not_silently_healthy_or_retried(self):
        for conclusion in ['failure', 'cancelled', 'timed_out']:
            rows = self.base(); rows[WORKFLOWS[3]] = [run(7, conclusion=conclusion)]
            result = plan(rows, NOW)
            self.assertEqual(result['action'], 'attention')
            self.assertIn(WORKFLOWS[3], result['failed'])

    def test_skipped_deploy_does_not_hide_real_success(self):
        rows = self.base(); rows[WORKFLOWS[2]].insert(0, run(7, conclusion='skipped'))
        self.assertEqual(plan(rows, NOW)['action'], 'ok')
        rows[WORKFLOWS[3]] = [run(7)]
        self.assertEqual(plan(rows, NOW)['workflow'], WORKFLOWS[2])

    def test_stuck_or_approval_blocked_is_attention_not_permanent_wait(self):
        for status, when in [('waiting', NOW), ('in_progress', NOW-dt.timedelta(hours=9))]:
            rows = self.base(); r = run(status=status, conclusion=None)
            r['created_at'] = when.isoformat(); rows[WORKFLOWS[0]] = [r]
            result = plan(rows, NOW)
            self.assertEqual(result['action'], 'attention'); self.assertTrue(result['stuck'])

    def test_rerun_start_time_not_original_creation_controls_timeout(self):
        rows = self.base(); r = run(status='in_progress', conclusion=None, attempt=2)
        r['created_at'] = (NOW-dt.timedelta(days=1)).isoformat(); r['run_started_at'] = NOW.isoformat()
        rows[WORKFLOWS[0]] = [r]
        self.assertEqual(plan(rows, NOW)['action'], 'wait')

    def test_non_main_active_run_and_out_of_order_results_are_ignored(self):
        rows = self.base(); r = run(status='queued', conclusion=None); r['head_branch'] = 'feature'
        rows[WORKFLOWS[2]].append(r)
        self.assertEqual(plan(rows, NOW)['action'], 'ok')


class Accept(unittest.TestCase):
    def row(self, day='2026-11-02', stamp='2026-11-03T07:00:00Z'):
        return {'day': day, 'phase': 'утро', 'captured_at': stamp,
                'day_in_progress': False, 'items': [{'sku': '123', 'scheme': 'FBS'}]}

    def test_preserves_history_missing_in_incoming(self):
        old = {'snapshots': [self.row('2026-11-01', '2026-11-02T07:00:00Z')], 'version': 1, 'company': 'GENGLASS'}
        result, changed = accept(old, {'snapshots': [self.row()]}, NOW)
        self.assertEqual(len(result['snapshots']), 2)
        self.assertEqual(len(changed), 1)

    def test_stale_new_capture_rejected(self):
        with self.assertRaises(ValueError):
            accept({'snapshots': []}, {'snapshots': [self.row(stamp='2026-11-02T07:00:00Z')]}, NOW)

    def test_idempotent_and_conflicting_timestamp(self):
        row = self.row(); old = {'snapshots': [row]}
        self.assertEqual(accept(old, old, NOW)[1], [])
        other = copy.deepcopy(row); other['items'][0]['sku'] = '456'
        with self.assertRaises(ValueError):
            accept(old, {'snapshots': [other]}, NOW)

    def test_previous_measured_skus_cannot_disappear(self):
        old = {'version': 1, 'company': 'GENGLASS', 'snapshots': [self.row(stamp='2026-11-03T06:00:00Z')]}
        newer = self.row(); newer['items'][0]['sku'] = '456'
        with self.assertRaises(ValueError):
            accept(old, {'snapshots': [newer]}, NOW)

    def test_partial_day_flag_is_checked(self):
        with self.assertRaises(ValueError):
            accept({'snapshots': []}, {'snapshots': [self.row(day='2026-11-03')]}, NOW)

    def test_equivalent_timezones_compare_instants_not_strings(self):
        old = {'version': 1, 'company': 'GENGLASS', 'snapshots': [self.row(stamp='2026-11-03T09:00:00+03:00')]}
        result, changed = accept(old, {'snapshots': [self.row()]}, NOW)
        self.assertEqual(len(changed), 1)
        self.assertEqual(result['snapshots'][0]['captured_at'], '2026-11-03T07:00:00Z')
        with self.assertRaises(ValueError):
            accept(result, old, NOW)


if __name__ == '__main__':
    unittest.main()
