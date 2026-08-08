#!/usr/bin/env python3
"""dialogs.jsonl -> msgs.jsonl: нормализованные реплики с направлением in/out/unknown.

Направление определяется по трём сигналам в порядке убывания надёжности:
  1. Системная пометка Wazzup «Отправлено X» (исходящее) / «Принято X» (входящее).
  2. Имя отправителя совпадает с кем-то из ростера менеджеров (в любом порядке слов).
     Сверяем со ВСЕМ ростером, а не только с владельцем сделки: коллега, написавший
     в чужую сделку, это всё равно наша сторона, а не клиент.
  3. Отправитель «Телефон» - служебная подпись Wazzup для контакта без имени.
     Встречается в 311 сделках из 689 и содержит реплики обеих сторон, надёжно
     не разделяется. Помечаем unknown и исключаем из метрик, зависящих от направления.
"""
import json, re, sys, unicodedata
from datetime import datetime

WAZZ = re.compile(r'^https://static\.wazzup24\.com/images/bitrix/(\w+)\.png\s+(.{1,80}?):\s*(.*)$', re.S)
SENT = re.compile(r'^Отправлено\s+(Изображение|Файл|Видео|Аудио|Документ|Голосовое)', re.I)
RECV = re.compile(r'^Принято\s+(Изображение|Файл|Видео|Аудио|Документ|Голосовое)', re.I)
SYSWZ = re.compile(r'^===\s*SYSTEM WZ\s*===')
AMBIGUOUS_SENDERS = {"телефон"}

def toks(s):
    s = unicodedata.normalize("NFC", s or "").lower().replace("ё", "е")
    return [t for t in re.split(r'[^а-яa-z]+', s) if len(t) > 1]

def main(src, dst):
    rows = [json.loads(l) for l in open(src, encoding='utf-8')]

    # Ростер: множества токенов имён всех менеджеров из выгрузки.
    roster = []
    for nm in {r['mgr'] for r in rows if r['mgr']}:
        t = set(toks(nm))
        if len(t) >= 2:
            roster.append(t)

    def is_staff(sender):
        st = set(toks(sender))
        return any(len(st & r) >= 2 for r in roster)

    out = open(dst, 'w', encoding='utf-8')
    stats = {"msg": 0, "in": 0, "out": 0, "unknown": 0}
    for r in rows:
        ch, txt = r['channel'], r['text']
        sender = app = None
        body, kind = txt, None

        if ch == 'Комментарий':
            m = WAZZ.match(txt)
            if m:
                app, sender, body = m.group(1), m.group(2).strip(), m.group(3).strip()
                kind = 'msg'
            else:
                kind = 'note'
        elif ch in ('Дело', 'Задача'):
            kind = 'task'
        elif ch == 'Звонок':
            kind = 'call'
        elif ch == 'Email':
            kind = 'email'
        else:
            kind = 'other'

        sysmsg = bool(SYSWZ.match(body or ''))
        attach = None
        if kind == 'msg':
            if SENT.match(body):
                direction, attach = 'out', 'sent'
            elif RECV.match(body):
                direction, attach = 'in', 'received'
            elif (sender or '').strip().lower() in AMBIGUOUS_SENDERS:
                direction = 'unknown'
            elif is_staff(sender):
                direction = 'out'
            else:
                direction = 'in'
            stats["msg"] += 1
            stats[direction] += 1
        elif kind in ('note', 'task'):
            direction = 'internal'
        else:
            direction = 'out'   # звонок/email из CRM - наша сторона

        try:
            ts = datetime.strptime(f"{r['date']} {r['time'] or '00:00'}", "%d.%m.%Y %H:%M")
        except ValueError:
            ts = None

        out.write(json.dumps({
            'ts': ts.isoformat() if ts else None,
            'date': r['date'], 'time': r['time'],
            'dealId': r['dealId'], 'stage': r['stage'], 'stageSense': r['stageSense'],
            'mgr': r['mgr'], 'clientType': r['clientType'], 'itemType': r['itemType'],
            'amount': float(r['amount']) if r['amount'] else 0.0,
            'channel': ch, 'kind': kind, 'app': app, 'sender': sender,
            'direction': direction, 'attach': attach, 'sysmsg': sysmsg,
            'text': body or '',
        }, ensure_ascii=False) + '\n')
    out.close()
    print(f"реплик: {len(rows)}; сообщений: {stats['msg']} "
          f"(исходящих {stats['out']}, входящих {stats['in']}, неопределённых {stats['unknown']})")

main(sys.argv[1], sys.argv[2])
