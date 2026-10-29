"""Atomically prepare the validated public snapshot and its private manifest."""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
from capture import make_capture, merge_capture
from expected_skus import registry


def prepare(analytics, prices, catalog_count, legacy, day, captured_at, phase, run_dir, previous=None, now=None):
    analytics, prices, run_dir = Path(analytics), Path(prices), Path(run_dir)
    if catalog_count <= 0:
        raise ValueError('Visible catalog count required')
    files = {'analytics': analytics, 'prices': prices}
    before = {k: hashlib.sha256(p.read_bytes()).hexdigest() for k, p in files.items()}
    old = json.loads(Path(previous).read_text()) if previous and Path(previous).exists() else None
    expected = registry(prices, catalog_count, legacy, day, old)
    fresh = make_capture(analytics, expected, captured_at, phase, now)
    if fresh['day'] != day:
        raise ValueError('Requested/source date mismatch')
    payload = merge_capture(old, fresh)
    after = {k: hashlib.sha256(p.read_bytes()).hexdigest() for k, p in files.items()}
    if before != after:
        raise ValueError('Input changed during validation')
    public_text = json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n'
    manifest = {'version':1,'company':'GENGLASS','day':day,'phase':phase,'captured_at':captured_at,
                'source_sha256':before,'public_sha256':hashlib.sha256(public_text.encode()).hexdigest(),
                'catalog_count':catalog_count,'scope':fresh['scope'],
                'ready_for_summary_publication':True,'ready_for_legacy_replacement':False}
    run_dir.mkdir(parents=True,exist_ok=True)
    target = run_dir/'prepared'
    if target.exists():
        if json.loads((target/'manifest.json').read_text()) != manifest or (target/'cabinet_capture.json').read_text() != public_text:
            raise ValueError('Run directory already contains another package')
        return target
    with tempfile.TemporaryDirectory(dir=run_dir) as temp:
        tmp=Path(temp)
        (tmp/'cabinet_capture.json').write_text(public_text)
        (tmp/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        # Readiness appears last, inside the directory that is installed atomically.
        (tmp/'READY.json').write_text(json.dumps({'sha256':manifest['public_sha256'],'status':fresh['scope']['status']})+'\n')
        tmp.rename(target)
    return target


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['analytics','prices','legacy','day','captured-at','phase','run-dir']:p.add_argument('--'+name,required=True)
    p.add_argument('--catalog-count',required=True,type=int)
    p.add_argument('--previous')
    a=p.parse_args()
    print(prepare(a.analytics,a.prices,a.catalog_count,a.legacy,a.day,a.captured_at,a.phase,a.run_dir,a.previous))
