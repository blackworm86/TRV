"""Draws the icons of the Big Rig's own commands (Part 2: The Big Rig and the Final Five), asked by
the user on 2026-11-18 for the Big Rig board: as on the other boards, the icon sits on the command
and its name and effect show in a pop-up on hover. Same manner as tools/art/make_command_icons.py
(one colour, currentColor; the second tone the same colour at 40 %; a see-through gap between a
piece and the one behind it), reusing its helpers and the parts traced from the official dice.

Writes assets/big_rig/icone/comandi/<id>.svg (100 x 100) and design/art/icone-comandi/big-rig.html,
the sheet to review them beside the base commands' icons. The Big Rig's Airstrike and Repair use
the base icons.

Usage: python tools/art/make_big_rig_icons.py, then node tools/art/center_command_icons.mjs, then
python tools/art/make_big_rig_icons.py --sheet (the sheet from the centred files on disk)
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from make_command_icons import CSS, OUT, arc_arrow, arrow, circ, cycle, ink, knock, part, poly, rrect, shade  # noqa: E402

C = 'currentColor'


def rot(pts, cx, cy, deg):
    """The points turned by `deg` degrees round (cx, cy)."""
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def tyre(cx, cy, r, n=12):
    """A tyre seen from the side: blocky treads round the rim, a ring and a hub inside (holes)."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        step = 2 * math.pi / n
        pts += [(cx + r * math.cos(a - step * .22), cy + r * math.sin(a - step * .22)),
                (cx + r * math.cos(a + step * .22), cy + r * math.sin(a + step * .22)),
                (cx + r * .86 * math.cos(a + step * .3), cy + r * .86 * math.sin(a + step * .3)),
                (cx + r * .86 * math.cos(a + step * .7), cy + r * .86 * math.sin(a + step * .7))]
    return poly(pts) + circ(cx, cy, r * .6) + circ(cx, cy, r * .42) + circ(cx, cy, r * .2)


def big_rig_icons() -> dict[str, str]:
    """The Big Rig's own commands' icons, one colour (currentColor)."""
    I = {}
    # Hazard Dispenser: the trailer's back drops a face-down hazard (the "!" token) behind it.
    trailer = rrect(42, 10, 52, 46, 4) + 'M48,17H88V23H48Z M48,29H88V35H48Z M48,41H88V47H48Z'
    token = circ(28, 72, 20) + 'M25,58H31V76H25Z M25,80H31V86H25Z'
    I['hazard_dispenser'] = (ink(trailer) + shade(circ(54, 64, 7) + circ(82, 64, 7))
                             + knock('hazard', arrow(44, 36, 30, 50, C, 7, 13), ink(token), 4.5))
    # Targeting Computer: a screen with the shooting die's crosshair, and the roll-again arrows.
    screen = rrect(6, 10, 62, 48, 5) + rrect(12, 16, 50, 36, 3)
    sight = circ(37, 34, 12) + circ(37, 34, 8) + 'M35,18H39V26H35Z M35,42H39V50H35Z M21,32H29V36H21Z M45,32H53V36H45Z'
    I['targeting_computer'] = knock('target', ink(screen + 'M30,58H44V66H30Z M20,66H54V71H20Z') + ink(sight),
                                    cycle(72, 72, 16, C, 7), 5)
    # Traction Drive: the big tyre on the ground, pushing ahead (the road die's move).
    I['traction_drive'] = (part('bar', 4, 88, w=92, fill=C) + ink(tyre(40, 50, 34))
                           + shade('M80,30H96V36H80Z M84,44H98V50H84Z M80,58H96V64H80Z'))
    # Missile Launcher: a missile flying up and ahead, its flame behind it.
    tilt = lambda pts: poly(rot(pts, 50, 50, -35))
    missile = (tilt([(20, 42), (70, 42), (92, 50), (70, 58), (20, 58)]) + tilt([(58, 42), (63, 42), (63, 58), (58, 58)])
               + tilt([(20, 42), (34, 42), (24, 28), (12, 28)]) + tilt([(20, 58), (34, 58), (24, 72), (12, 72)]))
    I['missile_launcher'] = ink(missile) + shade(tilt([(14, 44), (-4, 38), (4, 50), (-4, 62), (14, 56)]))
    # Cow Catcher: the slatted plow on the cab's nose throws the car ahead aside.
    cab = 'M4,40H30L38,52V80H4Z M10,46H26L31,54H10Z'
    plow = 'M40,48H52L62,82H40Z M44,56H53V60H44Z M44,66H56V70H44Z M44,74H58V77H44Z'
    I['cow_catcher'] = (part('bar', 2, 88, w=64, fill=C) + ink(cab) + ink(plow)
                        + part('car', 58, 8, w=38, fill=C, extra='opacity=".4"')
                        + arc_arrow(54, 44, 62, 26, 86, 30, C, 7, 14))
    # Hydraulic Steering: the wheel, and the lanes it lets the Big Rig change.
    rim = circ(50, 62, 30) + circ(50, 62, 21)
    spokes = 'M28,59H44V65H28Z M56,59H72V65H56Z M47,68H53V84H47Z' + circ(50, 62, 8)
    I['hydraulic_steering'] = (ink(rim) + ink(spokes)
                               + arrow(38, 28, 14, 6, C, 7, 13) + arrow(62, 28, 86, 6, C, 7, 13))
    return I


NAMES = [('hydraulic_steering', 'Sterzo idraulico', 'Cabina', 'Primo turno del round: quante volte il Big Rig può spostarsi avanti a sinistra o a destra.'),
         ('hazard_dispenser', 'Hazard Dispenser', 'Sezione posteriore', 'Dopo il movimento: un pericolo coperto in una casella vuota dell’arco posteriore.'),
         ('targeting_computer', 'Targeting Computer', 'Sezione posteriore', 'Questo turno si può ritirare il dado sparo.'),
         ('traction_drive', 'Traction Drive', 'Sezione centrale', 'Questo turno il Big Rig usa il dado strada.'),
         ('missile_launcher', 'Missile Launcher', 'Sezione anteriore', 'Dopo il movimento, dal 2° round: dado sparo su 2 caselle avanti e le adiacenti.'),
         ('cow_catcher', 'Cow Catcher', 'Sezione anteriore', 'Il primo veicolo incontrato va avanti a sinistra o a destra.')]
OTHERS = [('airstrike', 'Attacco aereo'), ('nitro', 'Nitro'), ('drift', 'Drift'), ('repair', 'Riparazione'),
          ('bump', 'Bump!'), ('called_shot', 'Called Shot'), ('tinker', 'Tinker'), ('flamethrower', 'Flamethrower')]


def main() -> None:
    folder = Path('assets/big_rig/icone/comandi')
    if '--sheet' not in sys.argv:
        folder.mkdir(parents=True, exist_ok=True)
        for k, body in big_rig_icons().items():
            (folder / f'{k}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{body}</svg>\n', encoding='utf8')
        print('icons written: centre them, then run again with --sheet')
        return
    files = [f for d in ('assets/base', 'assets/choppe_shoppe', 'assets/big_rig') for f in Path(d, 'icone/comandi').glob('*.svg')]
    inner = lambda t: t[t.index('>') + 1:t.rindex('</svg>')]
    symbols = ''.join(f'<symbol id="i-{f.stem}" viewBox="0 0 100 100">{inner(f.read_text(encoding="utf8"))}</symbol>' for f in files)

    def use(k, cls=''):
        return f'<svg class="ico {cls}"><use href="#i-{k}"/></svg>'

    def card(k, name, who, text):
        return (f'<figure class="card" tabindex="0"><div class="pair"><span class="org">{use(k, "big")}</span><span class="dark">{use(k, "big")}</span></div>'
                f'<div class="sizes"><span class="tan">{use(k)}</span><span class="org">{use(k, "sm")}</span><span class="dark">{use(k, "xs")}</span></div>'
                f'<figcaption><b>{name}</b><small>{who}</small></figcaption><div class="tip"><b>{name}</b><small>{who}</small><p>{text}</p></div></figure>')

    row = ''.join(f'<span class="dark" title="{n}">{use(k)}</span>' for k, n in OTHERS)
    html = f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Icone Big Rig</title>
<link href="https://fonts.googleapis.com/css2?family=League+Gothic&family=Barlow+Condensed:ital,wght@0,500;0,700;1,500&display=swap" rel="stylesheet">
<style>{CSS} .others {{ display:flex; gap:8px; margin:8px 0 0; }} .others span {{ padding:6px; border-radius:8px; }} .others .ico {{ width:40px; height:40px; }}</style></head><body>
<svg width="0" height="0" style="position:absolute">{symbols}</svg>
<h1>Icone dei comandi del Big Rig</h1>
<p class="lead">Stesso stile delle icone dei comandi: un solo colore, secondo tono al 40 %, stacco trasparente tra i pezzi sovrapposti. Attacco aereo e Riparazione del Big Rig usano le icone base.</p>
<p class="sub">Per confronto, le icone già nel gioco:</p><div class="others">{row}</div>
<h2>Comandi del Big Rig</h2><p class="sub">Passa sopra un'icona per la spiegazione.</p>
<div class="grid">{''.join(card(*n) for n in NAMES)}</div>
</body></html>
'''
    (OUT / 'big-rig.html').write_text(html, encoding='utf8')
    print('sheet written')


if __name__ == '__main__':
    main()
