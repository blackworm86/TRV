"""Saves the cut upgrade cards under their data ids, at card size, for the game.

Reads the cards cut by tools/art/extract_cards.py and the map tools/art/upgrade_cards.json, and
writes assets/licensed/cards/upgrades/<id>.jpg at 630 x 880 (63 x 88 mm, 10 px per mm).
The game draws the Italian name and text over the card's black panel (see cardHtml in main.ts).

Usage: python tools/art/save_upgrade_cards.py <folder of cut cards>
"""
import json
import sys
from pathlib import Path

from PIL import Image

OUT = Path('assets/licensed/cards/upgrades')


def main() -> None:
    cut = Path(sys.argv[1])
    names = {k: v for k, v in json.loads(Path('tools/art/upgrade_cards.json').read_text(encoding='utf8')).items() if not k.startswith('_')}
    OUT.mkdir(parents=True, exist_ok=True)
    for key, card_id in names.items():
        im = Image.open(cut / f'{key}.png').convert('RGB').resize((630, 880), Image.LANCZOS)
        im.save(OUT / f'{card_id}.jpg', quality=86, optimize=True)
        print(card_id)


if __name__ == '__main__':
    main()
