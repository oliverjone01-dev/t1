import copy
import importlib.util
import pathlib
import json
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('repair', pathlib.Path(__file__).with_name('repair-realization-20261021.py'))
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)

class RepairTests(unittest.TestCase):
    def setUp(self):
        self.base = [dict(ym='2026-05', sku='S', sold=2, ret=1, amount=500)]
        self.bad = [dict(ym='2026-04', sku='A', sold=10, ret=0, amount=3000),
                    dict(ym='2026-05', sku='S', sold=5, ret=2, amount=400)]
        self.orders = [dict(ym='2026-05', sku='S', order='1', role='delivered', count=3),
                       dict(ym='2026-05', sku='S', order='2', role='returned', count=1)]

    def test_known_layer_removed_and_unrelated_month_preserved(self):
        before = copy.deepcopy(self.bad)
        fixed = repair.subtract_layer(self.bad, self.base)
        repair.check_counts(fixed, self.orders)
        self.assertEqual(fixed[0], before[0])
        self.assertEqual(fixed[1]['amount'], -100)  # legitimate return can exceed sales
        self.assertEqual(self.bad, before)

    def test_broken_and_amount_only_reordered_data_do_not_bypass_count_gate(self):
        for rows in [self.bad, list(reversed(self.bad))]:
            with self.assertRaisesRegex(ValueError, 'REALIZATION_COUNTS_CONFLICT'):
                repair.check_counts(rows, self.orders)

    def test_negative_units_and_missing_baseline_key_rejected(self):
        with self.assertRaises(ValueError):
            repair.subtract_layer(self.bad, [dict(ym='2026-05', sku='S', sold=20, ret=0, amount=0)])
        with self.assertRaises(ValueError):
            repair.subtract_layer(self.bad, [dict(ym='2026-05', sku='UNKNOWN', sold=1, ret=0, amount=0)])

    def test_duplicate_order_keys_rejected(self):
        with self.assertRaisesRegex(ValueError, 'order-level key'):
            repair.check_counts(repair.subtract_layer(self.bad, self.base), self.orders + self.orders)

    def test_cli_unknown_hash_and_publication_conflict_never_write(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            monthly = root / 'realization_monthly.ndjson'
            monthly.write_text(''.join(json.dumps(r) + '\n' for r in self.bad))
            (root / 'realization_orders.ndjson').write_text(''.join(json.dumps(r) + '\n' for r in self.orders))
            before = {p.name: p.read_bytes() for p in root.iterdir()}
            script = str(pathlib.Path(repair.__file__))
            for args in [[], ['--check-only']]:
                result = subprocess.run([sys.executable, script, '--data-dir', d, *args], capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(before, {p.name: p.read_bytes() for p in root.iterdir()})

if __name__ == '__main__':
    unittest.main()
