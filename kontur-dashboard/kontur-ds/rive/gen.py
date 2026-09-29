#!/usr/bin/env python3
"""Generator for the three Kontur DS Rive projects (sync, success, empty).

Writes <name>/rive.yaml and <name>/scene.rml next to this tools/ folder.
RML is the source of truth; this script only keeps the verbose parts
(view-model conditions, sampled keyframes) consistent. Re-run after edits:

    python3 tools/gen.py
"""
import math
import os

ROOT = os.path.dirname(os.path.abspath(__file__))  # папка rive в пакете Контур DS
FPS = 60

# Kontur DS 1.3 motion tokens (all control points inside 0..1, no overshoot)
EASE_OUT = (0.2, 0.8, 0.2, 1.0)     # --ease-out: entrances (fades, scale)
EASE_IN = (0.4, 0.0, 1.0, 1.0)      # --ease-in: exits
EASE_STD = (0.4, 0.0, 0.2, 1.0)     # --ease-std: in-place changes
DRAW = (0.0, 0.0, 0.58, 1.0)        # CSS ease-out: stroke draw-on
LATE = (1.0, 0.0, 1.0, 0.0)         # holds ~0 then finishes: hides a layer that is already covered

# Default (light) theme, ARGB
COLORS = [
    ("ink", "FF16191E"),
    ("muted", "FF5A616C"),
    ("accent", "FF3561C9"),
    ("ok", "FF0D7049"),
    ("crit", "FFB3261E"),
]

# Kontur icon stroke: 1.7 on a 20 grid
def stroke_for(size):
    return round(1.7 * size / 20.0, 2)


def f(ms):
    """milliseconds -> frame at 60 fps"""
    return int(round(ms * FPS / 1000.0))


def interp(e):
    return '<CubicEaseInterpolator x1="%g" y1="%g" x2="%g" y2="%g"/>' % e


def kf(value, frame, ease="linear"):
    """KeyFrameDouble. ease: 'linear' | 'hold' | (x1,y1,x2,y2)"""
    if isinstance(ease, tuple):
        return ('<KeyFrameDouble value="%g" frame="%d" interpolationType="cubic">%s</KeyFrameDouble>'
                % (value, frame, interp(ease)))
    return '<KeyFrameDouble value="%g" frame="%d" interpolationType="%s"/>' % (value, frame, ease)


def keyed(obj_id, prop_key, frames):
    return ('<KeyedObject objectId="%s"><KeyedProperty propertyKey="%d">%s</KeyedProperty></KeyedObject>'
            % (obj_id, prop_key, "".join(frames)))


def keyed_multi(obj_id, props):
    """props: list of (propertyKey, [keyframes])"""
    inner = "".join('<KeyedProperty propertyKey="%d">%s</KeyedProperty>' % (k, "".join(fr)) for k, fr in props)
    return '<KeyedObject objectId="%s">%s</KeyedObject>' % (obj_id, inner)


def anim(aid, name, duration, body, loop=None):
    lv = ' loopValue="%s"' % loop if loop else ""
    return ('<LinearAnimation%s fps="60" duration="%d" name="%s" id="%s">%s</LinearAnimation>'
            % (lv, max(1, duration), name, aid, body))


# property keys
OPACITY, ROTATION, SCALE_X, SCALE_Y = 18, 15, 16, 17
TRIM_END = 115
COLOR = 37


def num_cond(path, op, value):
    return ('<TransitionViewModelCondition opValue="%s">'
            '<TransitionPropertyViewModelComparator><BindablePropertyNumber>'
            '<DataBindContext sourcePathIds="%s" propertyKey="636"/>'
            '</BindablePropertyNumber></TransitionPropertyViewModelComparator>'
            '<TransitionValueNumberComparator value="%g"/>'
            '</TransitionViewModelCondition>' % (op, path, value))


def trig_cond(path):
    return ('<TransitionViewModelCondition>'
            '<TransitionPropertyViewModelComparator><BindablePropertyTrigger>'
            '<DataBindContext sourcePathIds="%s" propertyKey="686"/>'
            '</BindablePropertyTrigger></TransitionPropertyViewModelComparator>'
            '<TransitionValueTriggerComparator/>'
            '</TransitionViewModelCondition>' % path)


def trans(to, duration=0, ease=None, conds=(), exit_pct=None):
    attrs = 'stateToId="%s" duration="%d"' % (to, duration)
    inner = ""
    if ease is not None and duration > 0:
        attrs += ' interpolationType="cubic"'
        inner += interp(ease)
    if exit_pct is not None:
        attrs += ' enableExitTime="true" exitTimeIsPercetange="true" exitTime="%d"' % exit_pct
    inner += "".join(conds)
    return "<StateTransition %s>%s</StateTransition>" % (attrs, inner)


def bound_color(vm, prop_id):
    return ('<SolidColor colorValue="%s" name="Color"><DataBindContext sourcePathIds="%s-%s" propertyKey="37"/></SolidColor>'
            % (dict(COLORS)[vm["names"][prop_id]], vm["id"], prop_id))


def stroke(vm, prop_id, width, trim_id=None, trim_end=None, extra=""):
    trim = ""
    if trim_id is not None:
        trim = '<TrimPath start="0" end="%g" modeValue="sequential" name="Trim" id="%s"/>' % (trim_end, trim_id)
    return ('<Stroke thickness="%g" cap="round" join="round" name="Stroke">%s%s%s</Stroke>'
            % (width, bound_color(vm, prop_id), trim, extra))


def fill(vm, prop_id):
    return '<Fill name="Fill">%s</Fill>' % bound_color(vm, prop_id)


def polyline(points, pid=None):
    idattr = ' id="%s"' % pid if pid else ""
    verts = "".join('<StraightVertex x="%g" y="%g"/>' % p for p in points)
    return '<PointsPath isClosed="false" name="Path"%s>%s</PointsPath>' % (idattr, verts)


def view_model(name, vm, extra_props, extra_values):
    props = "".join(extra_props)
    vals = "".join(extra_values)
    for i, (cname, cval) in enumerate(COLORS):
        pid = vm["color_ids"][cname]
        props += '<ViewModelPropertyColor name="%s" id="%s"/>' % (cname, pid)
        vals += '<ViewModelInstanceColor propertyValue="%s" viewModelPropertyId="%s"/>' % (cval, pid)
    return ('<ViewModel defaultInstanceId="%s" name="%s" id="%s">%s'
            '<ViewModelInstance exports="true" name="Default" id="%s">%s</ViewModelInstance>'
            '</ViewModel>' % (vm["inst"], name, vm["id"], props, vm["inst"], vals))


def make_vm(extra_names):
    vm = {"id": "0:500", "inst": "0:501", "color_ids": {}, "names": {}}
    n = 511
    for cname, _ in COLORS:
        pid = "0:%d" % n
        vm["color_ids"][cname] = pid
        vm["names"][pid] = cname
        n += 1
    return vm


def layer(lid, name, entry_to, states_xml, base):
    """base: numeric id base for any/exit/entry states"""
    return ('<StateMachineLayer name="%s" id="%s">'
            '<AnyState x="760" y="-120" id="0:%d"/>'
            '<ExitState x="920" y="-120" id="0:%d"/>'
            '<EntryState x="0" y="0" id="0:%d">%s</EntryState>'
            '%s</StateMachineLayer>'
            % (name, lid, base, base + 1, base + 2, trans(entry_to), states_xml))


def astate(sid, anim_id, x, y, transitions="", name=None, reset=False):
    extra = ' stateName="%s"' % name if name else ""
    if reset:
        extra += ' reset="true"'
    return ('<AnimationState x="%d" y="%d" animationId="%s"%s id="%s">%s</AnimationState>'
            % (x, y, anim_id, extra, sid, "".join(transitions)))


def write_project(name, rml):
    d = os.path.join(ROOT, name)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "rive.yaml"), "w") as fh:
        fh.write("name: %s\nmain: %s\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n" % (name, name))
    with open(os.path.join(d, "scene.rml"), "w") as fh:
        fh.write(rml)


def doc(artboard_xml, vm_xml):
    import xml.etree.ElementTree as ET
    root = ET.fromstring('<Rive version="1" kind="fragment">%s%s</Rive>' % (artboard_xml, vm_xml))
    ET.indent(root, space="    ")
    return ET.tostring(root, encoding="unicode") + "\n"


# ---------------------------------------------------------------------------
# 1. sync 24x24
# ---------------------------------------------------------------------------
def build_sync():
    S = 24
    W = stroke_for(S)            # 2.04
    D = 18                       # ring diameter (r = 9)
    vm = make_vm([])
    VM = vm["id"]
    STATE = "0:510"
    P = "%s-%s" % (VM, STATE)
    c = vm["color_ids"]

    ring = ('<Shape name="ring" id="0:10"><Ellipse width="%g" height="%g" name="Path"/>%s</Shape>'
            % (D, D, stroke(vm, c["muted"], W)))
    arc = ('<Node name="arcSpin" id="0:20">'
           '<Shape opacity="0" name="arc" id="0:21"><Ellipse width="%g" height="%g" name="Path"/>%s</Shape>'
           '</Node>' % (D, D, stroke(vm, c["accent"], W, "0:22", 0)))
    check_pts = [(-3.3, 0.0), (-1.1, 2.2), (3.3, -2.2)]
    done = ('<Node opacity="0" name="done" id="0:30">'
            '<Shape name="check" id="0:31">%s%s</Shape>'
            '<Shape opacity="0" name="okRing" id="0:33"><Ellipse width="%g" height="%g" name="Path"/>%s</Shape>'
            '</Node>' % (polyline(check_pts), stroke(vm, c["ok"], W, "0:32", 0), D, D, stroke(vm, c["ok"], W)))
    err = ('<Node opacity="0" name="error" id="0:40">'
           '<Shape name="bang" id="0:41">%s%s</Shape>'
           '<Shape y="4.1" opacity="0" name="bangDot" id="0:43"><Ellipse width="2.3" height="2.3" name="Path"/>%s</Shape>'
           '<Shape opacity="0" name="critRing" id="0:44"><Ellipse width="%g" height="%g" name="Path"/>%s</Shape>'
           '</Node>' % (polyline([(0, -4.6), (0, 0.4)]), stroke(vm, c["crit"], W, "0:42", 0),
                        fill(vm, c["crit"]), D, D, stroke(vm, c["crit"], W)))
    # draw order: first declared is on top
    art = '<Node x="12" y="12" name="icon" id="0:5">%s%s%s%s</Node>' % (err, done, arc, ring)

    anims = []
    # ring layer
    anims.append(anim("0:200", "ring idle", 1, keyed("0:10", OPACITY, [kf(1, 0)])))
    anims.append(anim("0:201", "ring track", 1, keyed("0:10", OPACITY, [kf(0.22, 0)])))
    anims.append(anim("0:202", "ring off", 1, keyed("0:10", OPACITY, [kf(0, 0)])))
    # arc layer
    anims.append(anim("0:210", "arc hidden", 1,
                      keyed("0:21", OPACITY, [kf(0, 0)]) + keyed("0:22", TRIM_END, [kf(0, 0)])))
    anims.append(anim("0:211", "arc loading", 1,
                      keyed("0:21", OPACITY, [kf(1, 0)]) + keyed("0:22", TRIM_END, [kf(0.3, 0)])))
    anims.append(anim("0:212", "arc close", f(400),
                      keyed("0:22", TRIM_END, [kf(0.3, 0, DRAW), kf(1, f(250))]) +
                      keyed("0:21", OPACITY, [kf(1, 0, "hold"), kf(0, f(370))])))
    # spin layer: the only loop, 900 ms per turn
    anims.append(anim("0:220", "spin off", 1, ""))
    anims.append(anim("0:221", "spin", f(900),
                      keyed("0:20", ROTATION, [kf(0, 0, "linear"), kf(6.2831855, f(900))]), loop="loop"))
    # done layer
    anims.append(anim("0:230", "done hidden", 1, keyed("0:30", OPACITY, [kf(0, 0)])))
    anims.append(anim("0:231", "done after loading", f(460),
                      keyed("0:30", OPACITY, [kf(1, 0)]) +
                      keyed("0:33", OPACITY, [kf(0, 0, "hold"), kf(0, f(200), EASE_OUT), kf(1, f(350))]) +
                      keyed("0:32", TRIM_END, [kf(0, 0, "hold"), kf(0, f(230), DRAW), kf(1, f(460))])))
    anims.append(anim("0:232", "done direct", f(420),
                      keyed("0:30", OPACITY, [kf(1, 0)]) +
                      keyed("0:33", OPACITY, [kf(0, 0, EASE_OUT), kf(1, f(220))]) +
                      keyed("0:32", TRIM_END, [kf(0, 0, "hold"), kf(0, f(150), DRAW), kf(1, f(420))])))
    # error layer
    anims.append(anim("0:240", "error hidden", 1, keyed("0:40", OPACITY, [kf(0, 0)])))
    anims.append(anim("0:241", "error", f(400),
                      keyed("0:40", OPACITY, [kf(1, 0)]) +
                      keyed("0:44", OPACITY, [kf(0, 0, EASE_OUT), kf(1, f(200))]) +
                      keyed("0:42", TRIM_END, [kf(0, 0, "hold"), kf(0, f(150), DRAW), kf(1, f(330))]) +
                      keyed("0:43", OPACITY, [kf(0, 0, "hold"), kf(0, f(300), EASE_OUT), kf(1, f(400))])))

    eq = lambda v: num_cond(P, "equal", v)
    ne = lambda v: num_cond(P, "notEqual", v)
    ge = lambda v: num_cond(P, "greaterThanOrEqual", v)
    le = lambda v: num_cond(P, "lessThanOrEqual", v)
    lt = lambda v: num_cond(P, "lessThan", v)

    # ring layer: idle 1.0, loading 0.22 (track), done/error 0 (hidden once covered)
    ring_layer = layer("0:101", "ring", "0:113", "".join([
        astate("0:113", "0:200", 160, 0, [trans("0:114", 200, EASE_STD, [eq(1)]),
                                          trans("0:115", 260, LATE, [ge(2)])], "idle"),
        astate("0:114", "0:201", 160, 120, [trans("0:113", 200, EASE_STD, [le(0)]),
                                            trans("0:115", 300, EASE_STD, [ge(2)])], "track"),
        astate("0:115", "0:202", 160, 240, [trans("0:113", 0, None, [le(0)]),
                                            trans("0:114", 0, None, [eq(1)])], "off"),
    ]), 110)
    arc_layer = layer("0:102", "arc", "0:123", "".join([
        astate("0:123", "0:210", 160, 0, [trans("0:124", 200, EASE_OUT, [eq(1)])], "hidden"),
        astate("0:124", "0:211", 160, 120, [trans("0:125", 0, None, [eq(2)]),
                                            trans("0:123", 200, EASE_IN, [ne(1), ne(2)])], "loading"),
        astate("0:125", "0:212", 160, 240, [trans("0:124", 200, EASE_OUT, [eq(1)]),
                                            trans("0:123", 150, EASE_IN, [ne(1), ne(2)])], "close"),
    ]), 120)
    spin_layer = layer("0:103", "spin", "0:133", "".join([
        astate("0:133", "0:220", 160, 0, [trans("0:134", 0, None, [eq(1)])], "still"),
        # keep turning while the arc fades or closes, then stop where it is
        astate("0:134", "0:221", 160, 120, [trans("0:133", 300, None, [ne(1)])], "spin"),
    ]), 130)
    done_layer = layer("0:104", "done", "0:143", "".join([
        astate("0:143", "0:230", 160, 0, [trans("0:144", 0, None, [eq(1)]),
                                          trans("0:146", 0, None, [eq(2)])], "hidden"),
        astate("0:144", "0:230", 160, 120, [trans("0:145", 0, None, [eq(2)]),
                                            trans("0:143", 0, None, [ne(1), ne(2)])], "hidden (loading)"),
        astate("0:145", "0:231", 400, 120, [trans("0:144", 200, EASE_IN, [eq(1)]),
                                            trans("0:143", 200, EASE_IN, [ne(1), ne(2)])], "done after loading"),
        astate("0:146", "0:232", 400, 0, [trans("0:144", 200, EASE_IN, [eq(1)]),
                                          trans("0:143", 200, EASE_IN, [ne(1), ne(2)])], "done direct"),
    ]), 140)
    err_layer = layer("0:105", "error", "0:153", "".join([
        astate("0:153", "0:240", 160, 0, [trans("0:154", 0, None, [ge(3)])], "hidden"),
        astate("0:154", "0:241", 160, 120, [trans("0:153", 200, EASE_IN, [lt(3)])], "error"),
    ]), 150)
    sm = ('<StateMachine name="sync" id="0:100">%s%s%s%s%s</StateMachine>'
          % (ring_layer, arc_layer, spin_layer, done_layer, err_layer))

    artboard = ('<Artboard defaultStateMachineId="0:100" viewModelId="0:500" viewModelInstanceId="0:501" '
                'styleId="0:3" width="%d" height="%d" name="sync" id="0:2">'
                '<LayoutComponentStyle name="Artboard Style" id="0:3"/>%s%s%s</Artboard>'
                % (S, S, art, "".join(anims), sm))
    vm_xml = view_model("Sync", vm,
                        ['<ViewModelPropertyNumber name="state" id="%s"/>' % STATE],
                        ['<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="%s"/>' % STATE])
    write_project("sync", doc(artboard, vm_xml))


# ---------------------------------------------------------------------------
# 2. success 48x48
# ---------------------------------------------------------------------------
def build_success():
    S = 48
    W = stroke_for(S)            # 4.08
    D = 36                       # circle diameter (r = 18)
    vm = make_vm([])
    VM = vm["id"]
    PLAY = "0:510"
    c = vm["color_ids"]
    check_pts = [(-6.6, 0.0), (-2.2, 4.4), (6.6, -4.4)]
    art = ('<Node x="24" y="24" name="mark" id="0:5">'
           '<Shape name="check" id="0:31">%s%s</Shape>'
           '<Shape name="circle" id="0:33"><Ellipse width="%g" height="%g" name="Path"/>%s</Shape>'
           '</Node>' % (polyline(check_pts), stroke(vm, c["ok"], W, "0:32", 0),
                        D, D, stroke(vm, c["ok"], W, "0:34", 0)))
    anims = [
        anim("0:200", "draw", f(480),
             keyed("0:5", OPACITY, [kf(1, 0)]) +
             keyed("0:34", TRIM_END, [kf(0, 0, DRAW), kf(1, f(350))]) +
             keyed_multi("0:5", [(SCALE_X, [kf(0.96, 0, EASE_OUT), kf(1, f(350))]),
                                 (SCALE_Y, [kf(0.96, 0, EASE_OUT), kf(1, f(350))])]) +
             keyed("0:32", TRIM_END, [kf(0, 0, "hold"), kf(0, f(230), DRAW), kf(1, f(480))])),
        anim("0:201", "fade out", f(150),
             keyed("0:5", OPACITY, [kf(1, 0, EASE_IN), kf(0, f(150))])),
    ]
    trig = trig_cond("%s-%s" % (VM, PLAY))
    lay = ('<StateMachineLayer name="main" id="0:101">'
           '<AnyState x="160" y="-120" id="0:110">%s</AnyState>'
           '<ExitState x="520" y="-120" id="0:111"/>'
           '<EntryState x="0" y="0" id="0:112">%s</EntryState>'
           '%s%s</StateMachineLayer>'
           % (trans("0:114", 0, None, [trig]), trans("0:113"),
              astate("0:113", "0:200", 160, 0, [], "draw"),
              astate("0:114", "0:201", 360, 0, [trans("0:113", 0, None, [], exit_pct=100)], "fade out")))
    sm = '<StateMachine name="success" id="0:100">%s</StateMachine>' % lay
    artboard = ('<Artboard defaultStateMachineId="0:100" viewModelId="0:500" viewModelInstanceId="0:501" '
                'styleId="0:3" width="%d" height="%d" name="success" id="0:2">'
                '<LayoutComponentStyle name="Artboard Style" id="0:3"/>%s%s%s</Artboard>'
                % (S, S, art, "".join(anims), sm))
    vm_xml = view_model("Success", vm,
                        ['<ViewModelPropertyTrigger name="play" id="%s"/>' % PLAY],
                        ['<ViewModelInstanceTrigger viewModelPropertyId="%s"/>' % PLAY])
    write_project("success", doc(artboard, vm_xml))


# ---------------------------------------------------------------------------
# 3. empty 160x96
# ---------------------------------------------------------------------------
def bezier_progress(e, x):
    """y of a CSS cubic-bezier at time fraction x"""
    x1, y1, x2, y2 = e
    lo, hi = 0.0, 1.0
    for _ in range(60):
        t = (lo + hi) / 2
        bx = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
        if bx < x:
            lo = t
        else:
            hi = t
    t = (lo + hi) / 2
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3


def plen(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def build_empty():
    S_W, S_H = 160, 96
    W = 1.7
    vm = make_vm([])
    VM = vm["id"]
    PLAY = "0:510"
    c = vm["color_ids"]

    left = [(20, 58), (36, 47), (50, 52), (64, 39)]
    right = [(96, 45), (110, 35), (124, 40), (138, 27)]
    # the dashed piece stops short of both solid ends so the break stays visible
    (gx0, gy0), (gx1, gy1) = left[-1], right[0]
    glen = math.dist(left[-1], right[0])
    ux, uy = (gx1 - gx0) / glen, (gy1 - gy0) / glen
    INSET = 4.0
    gap = [(round(gx0 + ux * INSET, 2), round(gy0 + uy * INSET, 2)),
           (round(gx1 - ux * INSET, 2), round(gy1 - uy * INSET, 2))]
    L1, LG, L2 = plen(left), glen, plen(right)
    total = L1 + LG + L2
    T_LINE = 560                 # ms for the whole line, left to right
    b1, b2 = L1 / total, (L1 + LG) / total

    # sample the global ease-out every 2 frames, split it over the three pieces
    n = f(T_LINE)
    samples = [(fr, bezier_progress(DRAW, fr / n)) for fr in range(0, n + 1, 2)]
    if samples[-1][0] != n:
        samples.append((n, 1.0))

    def piece(lo, hi):
        out = []
        for fr, p in samples:
            v = min(1.0, max(0.0, (p - lo) / (hi - lo)))
            out.append((fr, v))
        # drop redundant repeats at the start and end
        comp = []
        for i, (fr, v) in enumerate(out):
            prev = out[i - 1][1] if i else None
            nxt = out[i + 1][1] if i + 1 < len(out) else None
            if prev is not None and nxt is not None and v == prev == nxt:
                continue
            comp.append((fr, v))
        return [kf(round(v, 4), fr, "linear") for fr, v in comp]

    axis_y, grid1, grid2 = 72.5, 48.5, 24.5
    x0, x1 = 12, 148

    def hline(name, sid, y, width, op, prop):
        return ('<Shape opacity="%g" name="%s" id="%s">%s%s</Shape>'
                % (op, name, sid, polyline([(x0, y), (x1, y)]), stroke(vm, c[prop], width)))

    dash = ('<DashPath name="Dashes"><Dash length="2.2" name="On"/><Dash length="3.8" name="Off"/></DashPath>')
    art = ('<Node opacity="1" name="series" id="0:5">'
           '<Shape opacity="0" name="endDot" id="0:40" x="%g" y="%g">'
           '<Ellipse width="5" height="5" name="Path"/>%s</Shape>'
           '<Shape name="lineRight" id="0:30">%s%s</Shape>'
           '<Shape name="lineLeft" id="0:20">%s%s</Shape>'
           '<Shape name="gap" id="0:25">%s%s</Shape>'
           '</Node>'
           '%s%s%s'
           % (right[-1][0], right[-1][1], fill(vm, c["accent"]),
              polyline(right), stroke(vm, c["accent"], W, "0:31", 0),
              polyline(left), stroke(vm, c["accent"], W, "0:21", 0),
              polyline(gap), stroke(vm, c["muted"], W, "0:26", 0, dash),
              hline("axis", "0:50", axis_y, 1.2, 0.55, "muted"),
              hline("grid1", "0:51", grid1, 1, 0.22, "muted"),
              hline("grid2", "0:52", grid2, 1, 0.22, "muted")))

    dot_in = f(470)
    anims = [
        anim("0:200", "draw", f(600),
             keyed("0:5", OPACITY, [kf(1, 0)]) +
             keyed("0:21", TRIM_END, piece(0, b1)) +
             keyed("0:26", TRIM_END, piece(b1, b2)) +
             keyed("0:31", TRIM_END, piece(b2, 1)) +
             keyed("0:40", OPACITY, [kf(0, 0, "hold"), kf(0, dot_in, EASE_OUT), kf(1, f(600))]) +
             keyed_multi("0:40", [(SCALE_X, [kf(0.5, 0, "hold"), kf(0.5, dot_in, EASE_OUT), kf(1, f(600))]),
                                  (SCALE_Y, [kf(0.5, 0, "hold"), kf(0.5, dot_in, EASE_OUT), kf(1, f(600))])])),
        anim("0:201", "fade out", f(150),
             keyed("0:5", OPACITY, [kf(1, 0, EASE_IN), kf(0, f(150))])),
    ]
    trig = trig_cond("%s-%s" % (VM, PLAY))
    lay = ('<StateMachineLayer name="main" id="0:101">'
           '<AnyState x="160" y="-120" id="0:110">%s</AnyState>'
           '<ExitState x="520" y="-120" id="0:111"/>'
           '<EntryState x="0" y="0" id="0:112">%s</EntryState>'
           '%s%s</StateMachineLayer>'
           % (trans("0:114", 0, None, [trig]), trans("0:113"),
              astate("0:113", "0:200", 160, 0, [], "draw"),
              astate("0:114", "0:201", 360, 0, [trans("0:113", 0, None, [], exit_pct=100)], "fade out")))
    sm = '<StateMachine name="empty" id="0:100">%s</StateMachine>' % lay
    artboard = ('<Artboard defaultStateMachineId="0:100" viewModelId="0:500" viewModelInstanceId="0:501" '
                'styleId="0:3" width="%d" height="%d" name="empty" id="0:2">'
                '<LayoutComponentStyle name="Artboard Style" id="0:3"/>%s%s%s</Artboard>'
                % (S_W, S_H, art, "".join(anims), sm))
    vm_xml = view_model("Empty", vm,
                        ['<ViewModelPropertyTrigger name="play" id="%s"/>' % PLAY],
                        ['<ViewModelInstanceTrigger viewModelPropertyId="%s"/>' % PLAY])
    write_project("empty", doc(artboard, vm_xml))


if __name__ == "__main__":
    build_sync()
    build_success()
    build_empty()
    print("written:", ", ".join(os.path.join(ROOT, n) for n in ("sync", "success", "empty")))
