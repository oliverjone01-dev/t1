"""Review/install the narrow hook in the existing local cabinet publisher after merge."""
import argparse
import difflib
from pathlib import Path
import shutil

IMPORT = '''# FBS tariff cabinet source -> sanitized persistent dashboard data.
if [ -f tools/problems/import_fbs_tariff.py ]; then
  python3 -B tools/problems/import_fbs_tariff.py --source-dir "$OZ/data-cabinet" || fail "FBS tariff import"
fi
'''
FILES = '[ -f data/fbs_tariff.json ] && FILES="$FILES data/fbs_tariff.json"\n'


def patch(text):
    anchor = 'cd "$A"\n'
    files_anchor = '[ -f data/cabinet_orders_check.ndjson ] && FILES="$FILES data/cabinet_orders_check.ndjson"\n'
    if text.count(anchor) != 1 or text.count(files_anchor) != 1:
        raise ValueError('Publisher layout changed; review required')
    if 'tools/problems/import_fbs_tariff.py' in text:
        if IMPORT not in text or FILES not in text:
            raise ValueError('Incomplete pre-existing tariff hook')
        return text
    return text.replace(anchor, anchor + IMPORT).replace(files_anchor, files_anchor + FILES)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--deploy-script', required=True)
    p.add_argument('--apply', action='store_true')
    args = p.parse_args()
    path = Path(args.deploy_script)
    old = path.read_text(); new = patch(old)
    print(''.join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), fromfile=str(path), tofile=str(path))))
    if args.apply and old != new:
        backup = path.with_name(path.name + '.before-fbs-tariff')
        if backup.exists():
            raise ValueError('Backup already exists; review before overwriting')
        shutil.copy2(path, backup)
        path.write_text(new)


if __name__ == '__main__':
    main()
