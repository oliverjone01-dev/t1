# ФЕНИКС iter7: diff текста docx b5cef71 -> 65a6f6f, тире, стоп-слова в новом абзаце.
# Запуск: python3 -I knowledge/episodes/2026-10/feniks-probes-ozon-docx-iter7/i7_text.py
import subprocess,zipfile,io,re,html
R='/home/user/t1'; P='sessions/OZON-testy-itogi-2026-10-12.docx'
def paras(rev):
    b=subprocess.run(['git','-C',R,'show',f'{rev}:{P}'],capture_output=True,check=True).stdout
    x=zipfile.ZipFile(io.BytesIO(b)).read('word/document.xml').decode('utf-8')
    return x,[html.unescape(''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>',p,flags=re.S))) for p in re.findall(r'<w:p[ >].*?</w:p>',x,flags=re.S)]
xo,po=paras('b5cef71'); xn,pn=paras('65a6f6f')
add=[(i,t) for i,t in enumerate(pn) if t not in set(po)]; rem=[t for t in po if t not in set(pn)]
print('абзацев',len(po),'->',len(pn),'добавлено',len(add),'удалено',len(rem))
for i,t in add: print(i,t)
print('U+2014 во всём документе',xn.count('—'),'U+2013',xn.count('–'))
stop=['уникальн','инновацион','революцион','выстрел','удвоит','взорв','идеальн','высокое качество','выглядит хорошо','отлично подойд','индивидуальный подход','не секрет','позволяет']
for i,t in add: print('стоп-слова в новом абзаце:',[s for s in stop if s in t.lower()])
