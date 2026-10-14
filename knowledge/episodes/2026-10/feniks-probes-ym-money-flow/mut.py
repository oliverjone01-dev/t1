# Мутационная проба нового кода блока 3а в песочнице (scratch). Каждый мутант: правка -> vitest двух файлов -> откат.
import subprocess, sys, pathlib
SB = pathlib.Path("/tmp/claude-0/-home-user-t1/bf8da627-8182-59b8-a23c-b2eb02fe1be2/scratchpad/feniks-flow/sb/analytics-mvp")
VT = "/root/.npm/_npx/69c381f8ad94b576/node_modules/.bin/vitest"
DL = SB / "src/scripts/ym/derive-lib.ts"
RP = SB / "src/scripts/ym/report-page-ym.ts"
M = [
    ("M0 без мутации", DL, "", ""),
    ("M1 отмены в деньги", DL, "    if (nettingCancelled(r)) continue;\n    const st = String(r.status", "    const st = String(r.status"),
    ("M2 баллы в деньги", DL, "    if (/^справочно/i.test(st)) continue;\n", ""),
    ("M3 po и nopo местами", DL, "if (String(r.po || \"\").trim()) x[5]! += a; else x[6]! += a;", "if (String(r.po || \"\").trim()) x[6]! += a; else x[5]! += a;"),
    ("M4 заказные строки в удержания", DL, "    if (r.order && String(r.order).trim()) continue;\n    const src = String(r.src", "    const src = String(r.src"),
    ("M5 граница accTo включительно выкинута", DL, "for (const r of netting) {\n    const d = String(r.d || \"\"); if (!d || d > accTo) continue;", "for (const r of netting) {\n    const d = String(r.d || \"\"); if (!d || d >= accTo) continue;"),
    ("M6 flBad без К выплате", RP, "if(Math.abs(da)>tl||Math.abs(dm)>tl)flBad=", "if(Math.abs(da)>tl)flBad="),
    ("M7 flChk без условия ns", RP, "flChk:grand&&fl.all.ns===0&&Math.abs", "flChk:grand&&Math.abs"),
    ("M8 нет данных снято", RP, "if(NS[k]&&x.ns)return null;", ""),
    ("M9 Всего списал без удержаний", RP, "x.spis=x.fee+x.acct;", "x.spis=x.fee;"),
    ("M10 все строки в зеркала", RP, "r[1]===REPY.cab.mir?'mir':r[1]===REPY.cab.fur?'fur':null", "'mir'"),
    ("M11 пустой статус в деньги", DL, "    if (!st) { x[7]! += 1; continue; }\n", ""),
    ("M12 flChk допуск 1e9", RP, "Math.abs(fl.all.tot-fl.all.po-fl.all.nopo)>2?", "Math.abs(fl.all.tot-fl.all.po-fl.all.nopo)>1e9?"),
]
orig = {DL: DL.read_text(encoding="utf-8"), RP: RP.read_text(encoding="utf-8")}
for name, f, a, b in M:
    src = orig[f]
    if a:
        if src.count(a) != 1:
            print(name, "SKIP: шаблон найден", src.count(a), "раз"); continue
        f.write_text(src.replace(a, b), encoding="utf-8")
    p = subprocess.run([VT, "run", "src/scripts/ym/derive-lib.test.ts", "src/scripts/ym/report-page-ym.test.ts"], cwd=SB, capture_output=True, text=True, timeout=300)
    f.write_text(src, encoding="utf-8")
    tail = [l for l in (p.stdout + p.stderr).splitlines() if "Tests" in l or "Test Files" in l]
    print(name, "exit", p.returncode, "|", " / ".join(x.strip() for x in tail))
for f, s in orig.items():
    assert f.read_text(encoding="utf-8") == s
print("откат проверен")
