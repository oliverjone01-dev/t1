"""Разовая утилита: из CSS гибрида собирает package/ds/kx.css.
Убирает правила трёх витринных направлений, переименовывает классы вариантов
в смысловые и ограничивает все компоненты контейнером .kx (токены и тема остаются глобальными)."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DROP = re.compile(r"\.(gx|gx-top|gx-intro|vpick|vp|stage|va|va-head|steps|stp|va-ins|vb|vb-meta|vb-cols|vb-fig|vb-side|vc-top|vc-side|vc-say|vc-cards|rc|hero-say)(?![\w-])|view-transition|\.ds > header")
RENAME = [("va-grid", "grid12"), ("vb-quote", "dialog"), ("vb-three", "steps3"), ("sm-mult", "minis"), ("sm1", "mini"), ("act-l", "acts"), ("act-i", "act")]
GLOBAL = (":root", "html", "body", "[data-theme")


def rename(t):
    for a, b in RENAME:
        t = re.sub(r"(?<![\w-])" + re.escape(a) + r"(?![\w-])", b, t)
    return t


def split_top(css):
    """Делит CSS на элементы верхнего уровня: комментарии, правила, at-блоки."""
    out, i, n = [], 0, len(css)
    while i < n:
        if css[i].isspace():
            i += 1
            continue
        if css.startswith("/*", i):
            j = css.index("*/", i) + 2
            out.append(("c", css[i:j]))
            i = j
            continue
        j = css.index("{", i)
        depth, k = 1, j + 1
        while depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        out.append(("r", css[i:j].strip(), css[j + 1:k - 1]))
        i = k
    return out


def scope_sel(sel):
    parts = [p.strip() for p in re.split(r",(?![^()]*\))", sel)]
    keep = [p for p in parts if not DROP.search(p)]
    if not keep:
        return None
    return ", ".join(p if p.startswith(GLOBAL) else ".kx " + p for p in keep)


def walk(css, ind=""):
    res = []
    for it in split_top(css):
        if it[0] == "c":
            res.append(ind + it[1])
            continue
        head, body = it[1], it[2]
        if head.startswith("@keyframes"):
            if re.search(r"vtout|vtin", head):
                continue
            res.append(ind + head + "{" + body + "}")
        elif head.startswith("@"):
            inner = walk(body, ind + "  ")
            if inner.strip():
                res.append(ind + head + "{\n" + inner + "\n" + ind + "}")
        else:
            s = scope_sel(head)
            if s:
                res.append(ind + s + "{" + body + "}")
    return "\n".join(res)


if __name__ == "__main__":
    h = (ROOT / "drafts/hybrid_body.html").read_text()
    css = h[h.index("<style>") + 7:h.index("</style>")]
    out = walk(rename(css))
    (ROOT / "package/ds/kx.css").write_text(out + "\n")
    print(len(css), "->", len(out))
