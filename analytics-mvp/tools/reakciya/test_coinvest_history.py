import json
from pathlib import Path
import tempfile
import unittest
import subprocess

import pandas as pd
from coinvest_history import load_history, complete_window, effect_window_ready


class CoinvestHistoryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = Path(self.tmp.name)
        self.now = pd.Timestamp('2026-10-27')
        self.legacy = pd.DataFrame([
            {'art': 'A', 'd': pd.Timestamp('2026-09-18'), 'coinv': 44.3},
            {'art': 'A', 'd': pd.Timestamp('2026-09-19'), 'coinv': 99.0}])

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, rows):
        (self.data/'gap_daily.ndjson').write_text('\n'.join(map(json.dumps, rows)))

    def row(self, day, value=50, **kw):
        return dict(date=day, art='A', gap_pct=value, oa_used=False, src='prices_raw', **kw)

    def load(self):
        return load_history(self.legacy, self.data, self.now)[0]

    def test_frozen_pickle_is_extended_without_changing_closed_history(self):
        self.write([self.row('2026-09-18', 12), self.row('2026-09-19', 51), self.row('2026-10-27', 47)])
        actual = self.load()
        self.assertEqual(list(actual.coinv), [44.3, 51, 47])
        self.assertEqual(actual.d.max(), self.now)
        pd.testing.assert_frame_equal(actual, self.load())

    def test_missing_prices_and_card_price_do_not_become_zero(self):
        rows = [self.row('2026-10-24', 50), self.row('2026-10-25', 0, no_site=True),
                {**self.row('2026-10-26', 60), 'oa_used': True}, self.row('2026-10-27', 49)]
        self.write(rows)
        self.assertEqual(list(self.load().coinv), [44.3, 50, 49])

    def test_manual_missing_and_honest_zero_use_common_reader(self):
        self.write([self.row('2026-10-24', 50), self.row('2026-10-25', 0), self.row('2026-10-26', 0)])
        (self.data/'gap_manual.ndjson').write_text(json.dumps(dict(date='2026-10-26', art='A', reason='test')))
        self.assertEqual(list(self.load().coinv), [44.3, 50, 0])

    def test_same_day_correction_uses_shared_dedup_rule(self):
        self.write([self.row('2026-10-25', 50), self.row('2026-10-25', 49)])
        self.assertEqual(list(self.load().coinv), [44.3, 49])

    def test_future_is_not_added(self):
        self.write([self.row('2026-10-27', 47), self.row('2026-10-28', 65)])
        self.assertEqual(list(self.load().coinv), [44.3, 47])

    def test_invalid_input_fails_before_output(self):
        for rows in ([self.row('2026-10-25', None)], [self.row('2026-10-25', 101)],
                     [self.row('2026-02-30')]):
            with self.subTest(rows=rows):
                self.write(rows)
                with self.assertRaises(subprocess.CalledProcessError): self.load()

    def test_absent_source_fails_instead_of_claiming_fresh_history(self):
        with self.assertRaises(subprocess.CalledProcessError): self.load()

    def test_empty_or_unusable_modern_history_fails(self):
        for rows in ([], [self.row('2026-10-27', 0, no_site=True)],
                     [{**self.row('2026-10-27'), 'oa_used': True}],
                     [self.row('2026-09-18')], [self.row('2026-10-28')]):
            with self.subTest(rows=rows):
                self.write(rows)
                with self.assertRaises(ValueError): self.load()

    def test_partial_zero_day_warning_survives_bridge(self):
        rows = []
        for i in range(50):
            rows.extend([{**self.row('2026-10-25', 50), 'art': str(i)},
                         {**self.row('2026-10-26', 0 if i < 20 else 50), 'art': str(i)}])
        self.write(rows)
        history, source = load_history(self.legacy, self.data, self.now)
        self.assertEqual(source['warn_days'], ['2026-10-26'])
        self.assertEqual(len(history[(history.d==pd.Timestamp('2026-10-26')) & (history.coinv==0)]), 20)

    def test_windows_require_exact_calendar_days(self):
        start = self.now - pd.Timedelta(days=7)
        end = self.now - pd.Timedelta(days=1)
        p = pd.DataFrame({1: [50]*7}, index=pd.date_range(start, end))
        self.assertTrue(complete_window(p, [1], start, end))
        self.assertFalse(complete_window(p.drop(p.index[3]), [1], start, end))
        self.assertFalse(complete_window(p, [2], start, end))
        p.iloc[3, 0] = float('nan')
        self.assertFalse(complete_window(p, [1], start, end))

    def test_effect_waits_for_closed_complete_window(self):
        day = self.now - pd.Timedelta(days=7)
        p = pd.DataFrame({1: [50]*15}, index=pd.date_range(day-pd.Timedelta(days=7), self.now))
        self.assertTrue(effect_window_ready(p, [1], day, 1, self.now))
        self.assertTrue(effect_window_ready(p, [1], day, 3, self.now))
        self.assertFalse(effect_window_ready(p, [1], day, 7, self.now))
        self.assertTrue(effect_window_ready(p, [1], day, 7, self.now+pd.Timedelta(days=1)))
        self.assertFalse(effect_window_ready(p.drop(day+pd.Timedelta(days=2)), [1], day, 3, self.now))

    def test_closed_archive_effects_are_not_revised(self):
        self.assertTrue(effect_window_ready(pd.DataFrame(), [], pd.Timestamp('2026-09-11'), 7, self.now))


if __name__ == '__main__': unittest.main()
