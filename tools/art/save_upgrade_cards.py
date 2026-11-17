"""Saves cut cards under their data ids, at card size, for the game.

Reads the cards cut by tools/art/extract_cards.py and a map (cut name -> data id, ':180' when the
cut is upside down; '_size' the card size in px, 10 px per mm) and writes <out>/<id>.jpg.
The game draws the Italian name and text over the card's panel (src/view/cards.ts).

Usage: python tools/art/save_upgrade_cards.py <folder of cut cards> [<map json> <out folder>]
Defaults: tools/art/upgrade_cards.json and assets/choppe_shoppe/carte/potenziamenti (63 x 88 mm).
"""
import json
import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    cut = Path(sys.argv[1])
    table = json.loads(Path(sys.argv[2] if len(sys.argv) > 2 else 'tools/art/upgrade_cards.json').read_text(encoding='utf8'))
    out = Path(sys.argv[3] if len(sys.argv) > 3 else 'assets/choppe_shoppe/carte/potenziamenti')
    size = tuple(table.get('_size', [630, 880]))
    out.mkdir(parents=True, exist_ok=True)
    for key, value in table.items():
        if key.startswith('_'):
            continue
        card_id, _, turn = value.partition(':')
        im = Image.open(cut / f'{key}.png').convert('RGB')
        if turn:
            im = im.rotate(int(turn), expand=True)
        im.resize(size, Image.LANCZOS).save(out / f'{card_id}.jpg', quality=86, optimize=True)
        print(card_id)


if __name__ == '__main__':
    main()
