"""Draws the icons of the commands on the command board: the four base commands and the crew
leaders' own commands (Choppe Shoppe). Proposal for the new interface, asked by the user on
2026-11-17: icons on the board, name and effect in a pop-up on hover. The leaders' powers keep
being explained in words, so they get no icon. Not used by the game yet.

Third version (the user: icons only for the commands; one colour, at most with transparency).
The icons are in one colour (currentColor, so the interface picks it); the second tone is the
same colour at 40 %, as the faded car of the slam die. The pieces come from the official dice
(tools/art/trace_icon_parts.py: the slam die's cars and ground bar, the shooting die's crosshair,
the stunt die's bars and numbers); the rest is drawn to match them: flat, blocky shapes with
small chamfers, a piece in front kept apart from the one behind by a see-through gap (a mask).

Writes the icons where the game reads them (src/view/vector/art.ts, commandIcon):
assets/base/icone/comandi/<id>.svg for the base commands, assets/choppe_shoppe/icone/comandi/<id>.svg
for the crew leaders' (100 x 100, currentColor), and design/art/icone-comandi/index.html, the sheet
to review them.

Usage: python tools/art/trace_icon_parts.py, then python tools/art/make_command_icons.py,
then node tools/art/center_command_icons.mjs (centres each drawing in its box)
"""
import json
import math
import re
from pathlib import Path

OUT = Path('design/art/icone-comandi')
PARTS = json.loads((OUT / 'parts.json').read_text(encoding='utf8'))

def bbox(d: str) -> tuple[float, float, float, float]:
    nums = [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', d)]
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def part(name: str, x: float, y: float, w: float | None = None, h: float | None = None, fill: str = '',
         flip: bool = False, rot: float = 0, extra: str = '') -> str:
    """A traced piece, its box moved to (x, y) and scaled to width `w` (or height `h`)."""
    d = PARTS[name]
    x0, y0, x1, y1 = bbox(d)
    s = w / (x1 - x0) if w else h / (y1 - y0)
    W, H = (x1 - x0) * s, (y1 - y0) * s
    t = f'translate({x + (W if flip else 0):.2f} {y:.2f}) scale({-s if flip else s:.4f} {s:.4f}) translate({-x0:.2f} {-y0:.2f})'
    if rot:
        t = f'rotate({rot} {x + W / 2:.2f} {y + H / 2:.2f}) ' + t
    return f'<path d="{d}" fill="{fill}" fill-rule="evenodd" transform="{t}" {extra}/>'


def circ(cx, cy, r):
    return f'M{cx - r:.2f},{cy:.2f}a{r},{r} 0 1 0 {2 * r},0a{r},{r} 0 1 0 {-2 * r},0Z'


def rrect(x, y, w, h, r):
    return (f'M{x + r},{y}H{x + w - r}L{x + w},{y + r}V{y + h - r}L{x + w - r},{y + h}'
            f'H{x + r}L{x},{y + h - r}V{y + r}Z')  # chamfered, like the cars' corners


def poly(pts):
    return 'M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + 'Z'


def burst(cx, cy, r1, r2, n=9, turn=0.0):
    return poly([(cx + (r1 if i % 2 == 0 else r2) * math.cos(turn + i * math.pi / n),
                  cy + (r1 if i % 2 == 0 else r2) * math.sin(turn + i * math.pi / n)) for i in range(n * 2)])


def star(cx, cy, R, r, n=5):
    return burst(cx, cy, R, r, n, -math.pi / 2)


def p(d, fill, extra=''):
    return f'<path d="{d}" fill="{fill}" fill-rule="evenodd" {extra}/>'


def arrow(x1, y1, x2, y2, fill, t=7, head=13, extra=''):
    """A blocky arrow: a bar and a chevron head (as the direction die's)."""
    a = math.atan2(y2 - y1, x2 - x1)
    L = math.hypot(x2 - x1, y2 - y1)
    pts = [(0, -t / 2), (L - head * .8, -t / 2), (L - head, -head * .75), (L, 0), (L - head, head * .75), (L - head * .8, t / 2), (0, t / 2)]
    c, s = math.cos(a), math.sin(a)
    return p(poly([(x1 + u * c - v * s, y1 + u * s + v * c) for u, v in pts]), fill, extra)


def arc_arrow(x1, y1, cx, cy, x2, y2, fill, t=7, head=13, extra=''):
    """A thick curved arrow along a quadratic curve, with a chevron head at its end."""
    a = math.atan2(y2 - cy, x2 - cx)
    bx, by = x2 - head * .8 * math.cos(a), y2 - head * .8 * math.sin(a)
    body = f'<path d="M{x1},{y1}Q{cx},{cy} {bx:.1f},{by:.1f}" fill="none" stroke="{fill}" stroke-width="{t}" stroke-linecap="butt" {extra}/>'
    h = poly([(x2, y2), (x2 - head * math.cos(a - .6), y2 - head * math.sin(a - .6)), (x2 - head * math.cos(a + .6), y2 - head * math.sin(a + .6))])
    return body + p(h, fill)


def cycle(cx, cy, r, fill, t=7):
    """Two blocky arrows round a circle: roll again, draw again."""
    out = ''
    for a0, a1 in ((200, 320), (20, 140)):
        pts = lambda deg, rr: (cx + rr * math.cos(math.radians(deg)), cy + rr * math.sin(math.radians(deg)))
        arc = [pts(a0 + (a1 - a0) * i / 12, r + t / 2) for i in range(13)] + [pts(a1 - (a1 - a0) * i / 12, r - t / 2) for i in range(13)]
        tip = pts(a1 + 22, r)
        hd = [pts(a1, r + t * 1.25), tip, pts(a1, r - t * 1.25)]
        out += p(poly(arc), fill) + p(poly(hd), fill)
    return out


def wrench(transform, fill, extra=''):
    """A wrench, 80 long along x from 0, centred on y = 0, then placed by `transform`."""
    d = ('M0,-11L8,-17L22,-17L30,-8L76,-8L82,-2L82,2L76,8L30,8L22,17L8,17L0,11L10,5L16,5L16,-5L10,-5Z')
    return f'<path d="{d}" fill="{fill}" transform="{transform}" {extra}/>'


def tongue(cx, base, h, w, lean, fill, extra=''):
    """A flame tongue in the fire die's manner: a round foot and a tip curling over."""
    d = (f'M{cx - w / 2:.1f},{base:.1f}C{cx - w / 2 - 2:.1f},{base - h * .45:.1f} {cx + lean - w * .35:.1f},{base - h * .55:.1f} {cx + lean:.1f},{base - h:.1f}'
         f'C{cx + lean + w * .05:.1f},{base - h * .7:.1f} {cx + w / 2 + 3:.1f},{base - h * .55:.1f} {cx + w / 2:.1f},{base:.1f}Z')
    return p(d, fill, extra)


CHOPPER = ('M27,13H93V17H27Z M57,17H63V23H57Z'  # rotor and mast
           'M42,24H70L83,32L85,41L79,47H44L38,41L38,34L20,32L16,26H11V43H18L22,38L38,40Z'  # cabin and tail
           'M70,27.5L80,33.5L81,38.5H70Z'  # window (a hole)
           'M46,50H51V47H55V50H68V47H72V50H82L84,53H44Z')  # skids


INK = 'fill="currentColor"'
SHADE = 'fill="currentColor" opacity=".4"'


def ink(d, extra=''):
    return f'<path d="{d}" {INK} fill-rule="evenodd" {extra}/>'


def shade(d, extra=''):
    return f'<path d="{d}" {SHADE} fill-rule="evenodd" {extra}/>'


def knock(key: str, back: str, front: str, w: float = 4.5) -> str:
    """`front` over `back` with a gap cut round it (a mask, so the gap is see-through on any background)."""
    m = f'k-{key}'
    return (f'<mask id="{m}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120"><rect x="-10" y="-10" width="120" height="120" fill="#fff"/>'
            f'<g color="#000" stroke="#000" stroke-width="{w}" stroke-linejoin="round">{front}</g></mask>'
            f'<g mask="url(#{m})">{back}</g>{front}')


def icons() -> dict[str, str]:
    """The commands' icons: one colour (currentColor), the second tone as the same colour at 40%."""
    C = 'currentColor'
    I = {}
    # Base commands (rulebook: Airstrike, Nitro, Drift, Repair).
    I['airstrike'] = (ink(CHOPPER, 'transform="translate(-6 2)"') + shade('M44,58L48,58L44,66L40,66Z M66,58L70,58L74,66L70,66Z')
                      + part('crosshair', 37, 60, w=32, fill=C))
    I['nitro'] = (part('bars', 16, 76, w=70, fill=C) + shade('M34,41L16,33L22,42L4,47L22,52L12,61L34,56Z')
                  + part('car', 30, 33, w=62, fill=C))
    I['drift'] = (knock('drift', part('car', 6, 50, w=58, fill=C, extra='opacity=".4"'), part('car', 34, 28, w=58, fill=C), 5)
                  + ink('M8,28H26V33H8Z M4,38H22V43H4Z'))
    I['repair'] = knock('repair', part('car', 12, 60, w=76, fill=C, extra='opacity=".4"'),
                        wrench('translate(16 64) rotate(-38) scale(.95)', C), 5)
    # The crew leaders' own commands (Choppe Shoppe).
    I['bump'] = (part('bar', 6, 84, w=88, fill=C)
                 + knock('bump', part('car', 56, 56, w=40, fill=C, extra='opacity=".4"'), part('slam_car', 2, 50, w=56, fill=C), 3.5)
                 + arrow(58, 34, 94, 34, C, 8, 15))
    I['pain_transfer'] = (part('car', 4, 68, w=40, fill=C) + part('car', 56, 68, w=40, fill=C, extra='opacity=".4"')
                          + knock('pain', arc_arrow(22, 62, 50, 6, 80, 62, C, 7, 15), ink(burst(50, 33, 13, 6.5, 8, .2)), 5))
    I['need_for_speed'] = (part('stunt_4', 8, 20, h=58, fill=C)
                           + part('stunt_4', 70, 8, h=32, fill=C, extra='opacity=".4"') + part('stunt_4', 70, 58, h=32, fill=C, extra='opacity=".4"')
                           + arrow(44, 42, 64, 28, C, 7, 13) + arrow(44, 58, 64, 72, C, 7, 13))
    # The shooting die's crosshair, drawn bigger: its ring and arms, a hit in the middle.
    I['called_shot'] = (ink(circ(50, 50, 33) + circ(50, 50, 25))
                        + ink('M46.5,6H53.5V20H46.5Z M46.5,80H53.5V94H46.5Z M6,46.5H20V53.5H6Z M80,46.5H94V53.5H80Z')
                        + ink(burst(50, 50, 19, 8.5, 9, .2)))
    I['tinker'] = knock('tinker', ink(rrect(14, 10, 44, 60, 6) + rrect(20, 16, 32, 26, 3) + 'M20,48H46V53H20Z M20,58H38V63H20Z'),
                        cycle(68, 68, 19, C, 7), 5)
    I['show_time'] = knock('show', tongue(30, 64, 32, 16, -6, C) + tongue(50, 62, 50, 20, 8, C) + tongue(70, 64, 30, 14, 6, C),
                           part('car', 14, 58, w=72, fill=C), 4.5)
    core = 'M50,47L64,44L72,40L78,46L86,50L78,54L72,60L64,56L50,53Z'
    I['flamethrower'] = (ink('M4,40H30L34,44V56L30,60H18V70H10V60H4Z M34,46H40V54H34Z')
                         + ink('M42,45L58,37L64,24L72,35L82,26L84,40L97,38L88,50L97,62L84,60L82,74L72,65L64,76L58,63L42,55Z' + core)
                         + shade(core, 'transform="translate(69 50) scale(.7) translate(-69 -50)"'))
    return I


BASE = [('airstrike', 'Attacco aereo', 'Piazza l’elicottero su una casella vuota. Dal 2° round spara.'),
        ('nitro', 'Nitro', 'Aggiungi il dado al movimento dell’auto.'),
        ('drift', 'Drift', 'Attraversa il primo veicolo che incontri, senza slam.'),
        ('repair', 'Riparazione', 'Togli un danno da una tua auto.')]
OWN = [('bump', 'Bump!', 'Bumpo the Clown', 'Al primo slam del turno solo dado direzione: si muove l’altra auto.'),
       ('pain_transfer', 'Pain Transfer', 'Vince Vamp', 'Sposta un danno da una tua auto a un’altra.'),
       ('need_for_speed', 'Need for Speed', 'Cris Crass', 'I dadi non assegnati prendono il valore di questo dado.'),
       ('called_shot', 'Called Shot', 'Madame Boudreaux', 'In questo turno colpisci automaticamente.'),
       ('tinker', 'Tinker', 'Ms. Betty', 'Scarta un potenziamento di una tua auto e pescane un altro.'),
       ('show_time', 'Show Time', 'Emberco', 'Una tua auto operativa prende fuoco.'),
       ('flamethrower', 'Flamethrower', 'Emberco', 'In questo turno chi colpisci prende fuoco.')]
CSS = '''
:root { --ink:#26232b; --org:#ec9230; --cream:#f3e6d0; --bg:#1b1410; --card:#2a221c; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--cream); font:500 16px/1.35 'Barlow Condensed',sans-serif; padding:28px 32px 60px; }
h1,h2 { font-family:'League Gothic',Impact,sans-serif; font-weight:400; letter-spacing:.5px; margin:0; }
h1 { font-size:46px; } h2 { font-size:30px; margin:34px 0 4px; color:var(--org); }
.lead { max-width:920px; opacity:.8; margin:6px 0 0; } .sub { opacity:.65; margin:0 0 14px; }
.ref { display:flex; gap:10px; margin:12px 0 0; align-items:center; } .ref img { width:64px; height:64px; border-radius:8px; } .ref span { opacity:.6; font-size:14px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:16px; }
.card { position:relative; margin:0; background:var(--card); border-radius:14px; padding:14px; display:flex; flex-direction:column; align-items:center; gap:10px; outline:none; }
.ico { display:block; }
.pair { display:flex; gap:8px; }
.pair span, .sizes span { display:grid; place-items:center; border-radius:12px; }
.org { background:var(--org); color:var(--ink); } .dark { background:var(--ink); color:var(--cream); } .tan { background:#e3d4ba; color:var(--ink); }
.pair span { padding:10px; } .big { width:96px; height:96px; }
.sizes { display:flex; gap:8px; align-items:center; } .sizes span { padding:6px; border-radius:8px; }
.sizes .ico { width:40px; height:40px; } .sizes .sm { width:28px; height:28px; } .sizes .xs { width:20px; height:20px; }
figcaption { text-align:center; } figcaption b { display:block; font:400 22px/1 'League Gothic',Impact,sans-serif; letter-spacing:.4px; text-transform:uppercase; }
figcaption small, .tip small { display:block; opacity:.6; text-transform:uppercase; letter-spacing:1px; font-size:12px; }
.tip { position:absolute; left:50%; bottom:calc(100% - 22px); transform:translate(-50%,6px); width:250px; background:var(--cream); color:var(--ink); border-radius:12px;
  padding:10px 14px 12px; box-shadow:0 12px 28px rgba(0,0,0,.6); opacity:0; pointer-events:none; transition:opacity .15s, transform .15s; z-index:5; }
.tip b { display:block; font:400 26px/1 'League Gothic',Impact,sans-serif; text-transform:uppercase; letter-spacing:.4px; }
.tip p { margin:6px 0 0; font-size:17px; line-height:1.25; }
.tip::after { content:''; position:absolute; left:50%; bottom:-8px; margin-left:-8px; border:8px solid transparent; border-bottom:0; border-top-color:var(--cream); }
.card:hover .tip, .card:focus .tip, .q:hover .tip, .q:focus .tip, .tip.show { opacity:1; transform:translate(-50%,0); }
.board { display:inline-grid; grid-template-columns:1fr 1fr; background:var(--org); color:var(--ink); padding:20px; border-radius:26px; border:14px solid var(--ink); margin-top:70px; }
.q { position:relative; width:180px; height:140px; display:grid; place-items:center; outline:none; cursor:help; }
.q:nth-child(1), .q:nth-child(2) { border-bottom:3px solid rgba(38,35,43,.35); } .q:nth-child(odd) { border-right:3px solid rgba(38,35,43,.35); }
.q .qi { width:92px; height:92px; transition:transform .15s; } .q:hover .qi { transform:scale(1.08); }
.q .slot { position:absolute; top:8px; left:10px; font:400 22px 'League Gothic',sans-serif; font-style:normal; opacity:.75; }
.q:nth-child(even) .slot { left:auto; right:10px; }
.q .tip { bottom:calc(100% - 26px); }
.note { margin-top:40px; opacity:.6; font-size:14px; max-width:900px; }
'''


def main() -> None:
    I = icons()
    base = {k for k, _, _ in BASE}
    for k, body in I.items():
        folder = Path('assets/base/icone/comandi' if k in base else 'assets/choppe_shoppe/icone/comandi')
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f'{k}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{body}</svg>\n', encoding='utf8')
    symbols = ''.join(f'<symbol id="i-{k}" viewBox="0 0 100 100">{b}</symbol>' for k, b in I.items())

    def use(k, cls=''):
        return f'<svg class="ico {cls}"><use href="#i-{k}"/></svg>'

    def card(k, name, who, text):
        whom = f'<small>{who}</small>' if who else ''
        return (f'<figure class="card" tabindex="0"><div class="pair"><span class="org">{use(k, "big")}</span><span class="dark">{use(k, "big")}</span></div>'
                f'<div class="sizes"><span class="tan">{use(k)}</span><span class="org">{use(k, "sm")}</span><span class="dark">{use(k, "xs")}</span></div>'
                f'<figcaption><b>{name}</b>{whom}</figcaption><div class="tip"><b>{name}</b>{whom}<p>{text}</p></div></figure>')

    board = [('airstrike', 'Attacco aereo', '1-6', BASE[0][2]), ('nitro', 'Nitro', '1-2', BASE[1][2]),
             ('drift', 'Drift', '2-4', BASE[2][2]), ('pain_transfer', 'Pain Transfer', '6', OWN[1][3])]
    quads = ''.join(f'<div class="q" tabindex="0"><i class="slot">{sl}</i>{use(k, "qi")}'
                    f'<div class="tip{" show" if k == "nitro" else ""}"><b>{n}</b><small>dado {sl}</small><p>{tx}</p></div></div>'
                    for k, n, sl, tx in board)
    html = f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Icone comandi</title>
<link href="https://fonts.googleapis.com/css2?family=League+Gothic&family=Barlow+Condensed:ital,wght@0,500;0,700;1,500&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<svg width="0" height="0" style="position:absolute">{symbols}</svg>
<h1>Icone dei comandi — terza versione</h1>
<p class="lead">Solo i comandi (i poteri dei capisquadra restano spiegati a parole). Icone in un solo colore, scelto dall'interfaccia: il secondo tono è lo stesso colore al 40 %, come l'auto sbiadita del dado slam; dove un pezzo sta davanti a un altro, uno stacco trasparente li separa. Auto, barra, mirino, barre e numero dello stunt sono ricalcati dai dadi ufficiali. Ogni icona è mostrata sull'arancio della plancia e su fondo scuro, poi a 40, 28 e 20 px.</p>
<h2>Prova sulla plancia</h2>
<p class="sub">La plancia di Vince Vamp con le icone al posto dei testi (la finestrella di Nitro è aperta come esempio): passa sopra un comando.</p>
<div class="board">{quads}</div>
<h2>Comandi base</h2><p class="sub">Su ogni plancia comandi.</p>
<div class="grid">{''.join(card(k, n, '', tx) for k, n, tx in BASE)}</div>
<h2>Comandi dei capisquadra</h2><p class="sub">Choppe Shoppe: il comando che un caposquadra ha al posto di uno dei quattro base.</p>
<div class="grid">{''.join(card(k, n, w, tx) for k, n, w, tx in OWN)}</div>
<p class="note">Bozza generata da tools/art/trace_icon_parts.py e tools/art/make_command_icons.py; le icone del gioco sono in assets/base/icone/comandi e assets/choppe_shoppe/icone/comandi (100 × 100, currentColor).</p>
</body></html>
'''
    (OUT / 'index.html').write_text(html, encoding='utf8')
    print(len(I), 'icons')


if __name__ == '__main__':
    main()
