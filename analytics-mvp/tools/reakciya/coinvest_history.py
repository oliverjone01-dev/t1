"""History for Reaction. Ordinary storefront price; no card-price substitutions."""
import json
import os
from pathlib import Path
import subprocess

import pandas as pd

CUTOVER = pd.Timestamp('2026-09-19')


def load_history(legacy, data_dir, now):
    bridge = Path(__file__).with_name('gap-history.mjs')
    result = subprocess.run(
        [os.environ.get('REAKCIYA_NODE', 'node'), str(bridge),
         str(Path(data_dir) / 'gap_daily.ndjson')],
        check=True, capture_output=True, text=True, timeout=60)
    source = json.loads(result.stdout)
    recent = pd.DataFrame(source['rows'], columns=['art', 'date', 'gap_pct'])
    recent = recent.rename(columns={'date': 'd', 'gap_pct': 'coinv'})
    recent['d'] = pd.to_datetime(recent['d'])
    recent = recent[(recent['d'] >= CUTOVER) & (recent['d'] <= now)]
    if recent.empty:
        raise ValueError('No usable daily coinvest history since 2026-09-19')
    history = pd.concat([legacy[legacy['d'] < CUTOVER], recent[['art', 'd', 'coinv']]],
                        ignore_index=True).sort_values(['d', 'art'])
    if history.duplicated(['art', 'd']).any():
        raise ValueError('Duplicate coinvest day/article')
    return history, source


def complete_window(pivot, skus, start, end):
    """Every calendar day must have an observation for the selected group."""
    cols = [s for s in skus if s in pivot.columns]
    if not cols:
        return False
    days = pd.date_range(start, end, freq='D')
    return bool(len(days) and pivot.reindex(days)[cols].notna().any(axis=1).all())


def effect_window_ready(pivot, skus, day, horizon, now):
    end = day + pd.Timedelta(days=horizon)
    if end < CUTOVER:
        return True  # Do not revise archived effects in this repair.
    return (end < now and
            complete_window(pivot, skus, day-pd.Timedelta(days=7), day-pd.Timedelta(days=1)) and
            complete_window(pivot, skus, day+pd.Timedelta(days=1), end))
