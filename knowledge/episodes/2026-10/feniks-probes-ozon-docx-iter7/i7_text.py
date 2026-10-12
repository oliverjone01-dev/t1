# ФЕНИКС iter7: diff текста docx между ревизиями, тире, стоп-слова в новых абзацах.
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-docx-iter7/i7_text.py [старая] [новая]
# По умолчанию b5cef71 -> 20b2d08 (голова после замены абзаца «Сколько даёт акция»).
import subprocess,zipfile,io,re,html,sys
R='/home/user/t1'; P='sessions/OZON-testy-itogi-2026-10-12.docx'
old=sys.argv[1] if len(sys.argv)>1 else 'b5cef71'; new=sys.argv[2] if len(sys.argv)>2 else '20b2d08'
def paras(rev):
    b=subprocess.run(['git','-C',R,'show',f'{rev}:{P}'],capture_output=True,check=True).stdout
    x=zipfile.ZipFile(io.BytesIO(b)).read('word/document.xml').decode('utf-8')
    return x,[html.unescape(''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>',p,flags=re.S))) for p in re.findall(r'<w:p[ >].*?</w:p>',x,flags=re.S)]
xo,po=paras(old); xn,pn=paras(new)
add=[(i,t) for i,t in enumerate(pn) if t not in set(po)]; rem=[t for t in po if t not in set(pn)]
print(old,'->',new,': абзацев',len(po),'->',len(pn),'добавлено',len(add),'удалено',len(rem))
for i,t in add: print(i,t)
for t in rem: print('УДАЛЁН:',t[:120])
print('U+2014 во всём документе',xn.count('—'),'U+2013',xn.count('–'))
stop=['уникальн','инновацион','революцион','выстрел','удвоит','взорв','идеальн','высокое качество','выглядит хорошо','отлично подойд','индивидуальный подход','не секрет','позволяет']
for i,t in add: print('стоп-слова в новом абзаце:',[s for s in stop if s in t.lower()])
