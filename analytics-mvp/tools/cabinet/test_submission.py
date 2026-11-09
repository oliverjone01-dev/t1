import base64
import copy
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import submit_capture as client
import publish_capture as publisher

NOW = dt.datetime(2026, 11, 3, 7, 30, tzinfo=dt.timezone.utc)
ROW = {'day': '2026-11-02', 'phase': 'утро', 'captured_at': '2026-11-03T07:00:00Z',
       'day_in_progress': False, 'items': [{'sku': '123', 'scheme': 'FBS'}]}


class Submission(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.prepared = Path(self.tmp.name)/'prepared'; self.prepared.mkdir()
        self.incoming = {'version': 1, 'company': 'GENGLASS', 'snapshots': [copy.deepcopy(ROW)]}
        self.previous = {'version': 1, 'company': 'GENGLASS', 'snapshots': []}
        self.calls = []; self.runs = []; self.fail_dispatch = False
        self.write_package()
        self.validator = patch.object(client, 'validate').start()
        self.addCleanup(patch.stopall)
        patch.object(client, 'api', side_effect=self.api).start()

    def write_package(self):
        raw = json.dumps(self.incoming).encode(); sha = hashlib.sha256(raw).hexdigest()
        (self.prepared/'cabinet_capture.json').write_bytes(raw)
        (self.prepared/'manifest.json').write_text(json.dumps({'public_sha256': sha, 'ready_for_summary_publication': True}))
        (self.prepared/'READY.json').write_text(json.dumps({'sha256': sha}))

    def api(self, endpoint, payload=None):
        self.calls.append((endpoint, payload))
        if endpoint.startswith('contents/'):
            return {'sha': 'base', 'encoding': 'base64', 'content': base64.b64encode(json.dumps(self.previous).encode()).decode()}
        if endpoint.endswith('per_page=100'):
            return {'workflow_runs': self.runs}
        if endpoint == 'git/blobs':
            return {'sha': 'blob'}
        if endpoint.endswith('/dispatches'):
            # Must be on disk before remote side effect, including timeout.
            self.assertEqual(json.loads((self.prepared.parent/'submission.json').read_text())['state'], 'dispatching')
            if self.fail_dispatch:
                raise subprocess.TimeoutExpired('gh', 60)
            return None
        raise AssertionError(endpoint)

    def test_valid_dispatch_receipt_and_repeat_do_not_duplicate(self):
        result = client.submit(self.prepared, NOW)
        self.assertEqual(result['state'], 'submitted')
        second = client.submit(self.prepared, NOW)
        self.assertEqual(second['state'], 'unknown')  # API indexing can lag
        self.assertEqual(sum(e.endswith('/dispatches') for e, _ in self.calls), 1)

    def test_timeout_is_persisted_and_never_blindly_retried(self):
        self.fail_dispatch = True
        with self.assertRaises(subprocess.TimeoutExpired): client.submit(self.prepared, NOW)
        self.assertEqual(json.loads((self.prepared.parent/'submission.json').read_text())['state'], 'unknown')
        result = client.submit(self.prepared, NOW, retry_failed=True)
        self.assertEqual(result['state'], 'unknown')
        self.assertEqual(sum(e.endswith('/dispatches') for e, _ in self.calls), 1)

    def test_reconcile_visible_run(self):
        result = client.submit(self.prepared, NOW)
        self.runs = [{'id': 9, 'display_title': result['run_name'], 'status': 'in_progress', 'conclusion': None}]
        self.assertEqual(client.submit(self.prepared, NOW)['run_id'], 9)
        self.assertEqual(sum(e.endswith('/dispatches') for e, _ in self.calls), 1)

    def test_confirmed_failure_gets_only_one_explicit_retry(self):
        result = client.submit(self.prepared, NOW)
        self.runs = [{'id': 9, 'display_title': result['run_name'], 'status': 'completed', 'conclusion': 'failure'}]
        self.assertEqual(client.submit(self.prepared, NOW)['state'], 'server_failed')
        self.assertEqual(client.submit(self.prepared, NOW, retry_failed=True)['attempt'], 2)
        self.runs[0]['id'] = 10
        self.assertEqual(client.submit(self.prepared, NOW, retry_failed=True)['state'], 'server_failed')
        self.assertEqual(sum(e.endswith('/dispatches') for e, _ in self.calls), 2)

    def test_existing_capture_does_not_mean_live_published(self):
        self.previous = copy.deepcopy(self.incoming)
        result = client.submit(self.prepared, NOW)
        self.assertTrue(result['data_committed']); self.assertFalse(result['published'])
        self.assertFalse(any(payload is not None for _, payload in self.calls))

    def test_old_partial_package_with_same_rows_preserves_unrelated_history(self):
        self.previous = copy.deepcopy(self.incoming)
        old = copy.deepcopy(ROW); old['day'] = '2026-10-31'; self.previous['snapshots'].append(old)
        self.assertEqual(client.submit(self.prepared, NOW)['state'], 'data_in_main')

    def test_changed_cpo_is_not_mistaken_for_already_published_funnel(self):
        self.previous = copy.deepcopy(self.incoming)
        self.incoming['cpo']={'from':'2026-11-01','to':'2026-11-02','captured_at':NOW.isoformat(),'settings':{'captured_at':NOW.isoformat()}}
        self.write_package()
        result=client.submit(self.prepared,NOW)
        self.assertEqual(result['state'],'submitted')
        self.assertEqual(sum(e.endswith('/dispatches') for e, _ in self.calls),1)

    def test_stale_package_rejected_before_upload(self):
        self.incoming['snapshots'][0]['captured_at'] = '2026-11-02T07:00:00Z'; self.write_package()
        with self.assertRaises(ValueError): client.submit(self.prepared, NOW)
        self.assertFalse(any(payload is not None for _, payload in self.calls))

    def test_other_active_publication_is_not_evicted(self):
        self.runs = [{'id': 11, 'display_title': 'other', 'status': 'queued', 'conclusion': None}]
        with self.assertRaises(RuntimeError): client.submit(self.prepared, NOW)
        self.assertFalse(any(payload is not None for _, payload in self.calls))

    def test_schema_failure_and_changed_manifest_prevent_network(self):
        self.validator.side_effect = ValueError('schema')
        with self.assertRaises(ValueError): client.submit(self.prepared, NOW)
        self.assertEqual(self.calls, [])
        self.validator.side_effect = None
        (self.prepared/'READY.json').write_text('{"sha256":"bad"}')
        with self.assertRaises(ValueError): client.submit(self.prepared, NOW)
        self.assertEqual(self.calls, [])


class Publication(unittest.TestCase):
    def test_main_change_before_commit_is_rejected(self):
        with patch.object(publisher, 'api', return_value={'object': {'sha': 'moved'}}) as api:
            with self.assertRaises(ValueError): publisher.publish('checked', b'{"snapshots":[1]}', {'snapshots': []})
            self.assertEqual(api.call_count, 1)

    def test_single_path_parent_and_nonforce_update(self):
        calls = []
        def api(endpoint, payload=None, method='POST'):
            calls.append((endpoint, payload, method))
            if endpoint == 'git/ref/heads/main': return {'object': {'sha': 'checked'}}
            if endpoint == 'git/commits/checked': return {'tree': {'sha': 'oldtree'}}
            return {'sha': endpoint.split('/')[-1]}
        with patch.object(publisher, 'api', side_effect=api):
            publisher.publish('checked', b'{"snapshots":[1]}', {'snapshots': []})
        tree = next(p for e, p, _ in calls if e == 'git/trees')
        self.assertEqual(len(tree['tree']), 1); self.assertEqual(tree['tree'][0]['path'], publisher.PATH)
        self.assertEqual(next(p for e, p, _ in calls if e == 'git/commits')['parents'], ['checked'])
        self.assertEqual(calls[-1], ('git/refs/heads/main', {'sha': 'commits', 'force': False}, 'PATCH'))

    def test_unchanged_data_never_mutates_remote(self):
        with patch.object(publisher, 'api') as api:
            self.assertFalse(publisher.publish('checked', b'{"snapshots":[]}', {'snapshots': []})['changed'])
            api.assert_not_called()


if __name__ == '__main__': unittest.main()
