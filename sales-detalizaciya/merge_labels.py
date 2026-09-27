"""Сводит разметку пачек в data/labels.jsonl и проверяет её.

Берёт data/labeling/batch*.out.jsonl и pilot2.out.jsonl, чистит коды вне словаря,
убирает дубли, печатает покрытие и что не так.
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent
LAB = ROOT / "data/labeling"

ENUMS = {
    "segment": {"b2c", "b2b", "non_client", "unclear"},
    "category": {"portrait", "stela", "flowerbed_fence", "stand_frame", "turnkey_stone", "wholesale", "other_product", "info_only", "none"},
    "price_reaction": {"accepted", "negotiates", "expensive", "compares", "thinking", "silent", "no_price_given", "not_applicable"},
    "lost_reason": {"price", "stone_not_included", "delivery", "durability", "competitor", "not_now", "mismatch", "silent", "no_followup", "unknown", None},
}
LISTS = {
    "questions": {"price", "size_options", "glass_type", "durability_fading", "mounting_install", "delivery_region", "location_visit", "lead_time",
                  "layout_design", "payment_contract", "catalog_examples", "double_sided", "weight", "wholesale_terms", "other"},
    "objections": {"expensive", "cheaper_elsewhere", "stone_not_included", "far_delivery", "durability_doubt", "lead_time_long", "prepayment",
                   "think_consult", "not_now", "product_mismatch"},
    "mgr_issues": {"ignored_question", "no_concrete_price", "no_next_step", "argues", "wrong_or_confusing", "promised_not_done"},
}
FALLBACK = {"segment": "unclear", "category": "none", "price_reaction": "not_applicable", "lost_reason": "unknown"}


def main():
    ids_expected = set()
    for f in sorted(LAB.glob("*.txt")):
        for line in f.open():
            if line.startswith("=== CHAT "):
                ids_expected.add(line.split()[2])
    files = sorted(LAB.glob("batch*.out.jsonl")) + [LAB / "pilot2.out.jsonl"]
    out, fixes, bad = {}, Counter(), 0
    for f in files:
        if not f.exists():
            print("нет файла", f.name)
            continue
        for line in f.open():
            line = line.strip()
            if not line:
                continue
            try:
                x = json.loads(line)
            except json.JSONDecodeError:
                bad += 1
                continue
            if x.get("id") not in ids_expected:
                fixes["чужой id"] += 1
                continue
            for k, allowed in ENUMS.items():
                if x.get(k) not in allowed:
                    fixes[f"{k}={x.get(k)}"] += 1
                    x[k] = FALLBACK[k]
            for k, allowed in LISTS.items():
                v = [i for i in (x.get(k) or []) if i in allowed]
                if len(v) != len(x.get(k) or []):
                    fixes[f"{k} вне словаря"] += 1
                x[k] = v
            try:
                x["stage"] = max(0, min(5, int(x.get("stage") or 0)))
            except (TypeError, ValueError):
                x["stage"] = 0
            mods = []
            for m in x.get("success_modules") or []:
                if isinstance(m, dict) and m.get("manager"):
                    try:
                        m["stage_after"] = int(m.get("stage_after") or x["stage"])
                    except (TypeError, ValueError):
                        m["stage_after"] = x["stage"]
                    mods.append(m)
            x["success_modules"] = mods[:2]
            out[x["id"]] = x
    missing = ids_expected - set(out)
    with open(ROOT / "data/labels.jsonl", "w") as fh:
        for x in out.values():
            fh.write(json.dumps(x, ensure_ascii=False) + "\n")
    print(f"размечено {len(out)} из {len(ids_expected)}, битых строк {bad}, без разметки {len(missing)}")
    if fixes:
        print("поправлено:", dict(fixes.most_common(12)))
    return missing


if __name__ == "__main__":
    main()
