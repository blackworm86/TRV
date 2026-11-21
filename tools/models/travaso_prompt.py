"""One-off transfer (2026-11-21, design/art/modelli-strutturati.md §20): writes the production rules
(data/trv/modelli/regole.json) and one production sheet per model of today (data/trv/modelli/<id>.json),
copying the prompts word for word out of the old design/art/*-prompts.md files. Run once from the
repository root, before those files are deleted; kept as the record of how the sheets were born."""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/trv/modelli'


def blocks(name):
    """The fenced code blocks of a prompt file, in order, word for word."""
    text = (ROOT / 'design/art' / name).read_text(encoding='utf-8')
    return [b.strip('\n') for b in re.findall(r'```\n(.*?)```', text, re.S)]


RIG, MOTO, WRECK, RAMP = (blocks(f) for f in ('big-rig-prompts.md', 'moto-pilota-prompts.md', 'wreck-prompts.md', 'carnage-ramp-prompts.md'))
assert (len(RIG), len(MOTO), len(WRECK), len(RAMP)) == (19, 6, 6, 2), (len(RIG), len(MOTO), len(WRECK), len(RAMP))

STYLE = ("Photorealistic 3D render of a physical scale model miniature, like a studio product photo. Matte painted metal "
         "with chipped paint, light rust, visible weld seams, rivets and bolts. Seamless light grey studio backdrop, soft "
         "overhead lighting, soft contact shadow under the model. Exactly the same rendering style, materials and lighting "
         "as the attached style reference image. Not a drawing, not an illustration, no outlines, no cartoon shading, no "
         "labels, no text. One single object, nothing else in the picture.")

REGOLE = {
    "_note": "Production rules of the 3D models (design/art/modelli-strutturati.md, approved 2026-11-21). Metres at real scale unless a name says mm, px or degrees. Read by the admin inspector (src/admin/produzione.ts), by the unit tests and, from phase C, by tools/models. Every number is a starting value until the table check says otherwise.",
    "schema": 1,
    "documento": "design/art/modelli-strutturati.md",
    "scala": {"_doc": "§16.2", "rapporto": 125, "mm_per_metro": 8, "casella_mm": 46, "margine_mm": 2, "larghezza_casella_mm": None,
              "nota": "La larghezza della casella va misurata sulla griglia prima di fissare le larghezze dei veicoli."},
    "figura": {
        "_doc": "§15",
        "misure": {"altezza": 1.75, "altezza_con_casco": 1.82, "anche_da_terra": 0.94, "busto": 0.50, "collo_testa": 0.31,
                   "spalle": 0.40, "ingombro_spalle": 0.50, "anche": 0.20, "ingombro_bacino": 0.36, "braccio": 0.31,
                   "avambraccio": 0.27, "mano": 0.07, "coscia": 0.44, "stinco": 0.42, "caviglia": 0.08, "piede": 0.26},
        "nomi_misure": {"altezza": "Altezza", "altezza_con_casco": "Altezza con il casco", "anche_da_terra": "Altezza delle anche da terra",
                        "busto": "Busto: dalle anche alle spalle", "collo_testa": "Collo e testa", "spalle": "Larghezza delle spalle",
                        "ingombro_spalle": "Ingombro con le braccia", "anche": "Larghezza delle anche", "ingombro_bacino": "Ingombro del bacino",
                        "braccio": "Braccio (spalla-gomito)", "avambraccio": "Avambraccio (gomito-polso)", "mano": "Mano: dal polso alla presa",
                        "coscia": "Coscia (anca-ginocchio)", "stinco": "Stinco (ginocchio-caviglia)", "caviglia": "Caviglia: altezza sulla suola",
                        "piede": "Piede: lunghezza"},
        "capsule": {"busto": 0.13, "testa": 0.12, "braccio": 0.05, "coscia": 0.08, "stinco": 0.06},
        "portata": {"min": 0.55, "max": 0.92},
        "tolleranza_ossa": 0.10,
        "ossa": ["hips", "spine", "chest", "neck", "head", "upper_arm_L", "upper_arm_R", "lower_arm_L", "lower_arm_R", "hand_L", "hand_R",
                 "thigh_L", "thigh_R", "shin_L", "shin_R", "foot_L", "foot_R"],
        "nomi_meshy": {"_doc": "Bones of the Meshy rig seen on pilota_1 (2026-11-20). chest and neck: to be read off the next figure.",
                       "hips": "Hips", "spine": "Spine01", "head": "Head", "upper_arm_L": "LeftArm", "upper_arm_R": "RightArm",
                       "lower_arm_L": "LeftForeArm", "lower_arm_R": "RightForeArm", "hand_L": "LeftHand", "hand_R": "RightHand",
                       "thigh_L": "LeftUpLeg", "thigh_R": "RightUpLeg", "shin_L": "LeftLeg", "shin_R": "RightLeg",
                       "foot_L": "LeftFoot", "foot_R": "RightFoot"},
        "riposo": "In piedi, braccia ad A (45° dal busto), gambe appena divaricate, palmi verso le cosce, dita chiuse. Guarda verso +X, Y in alto, origine a terra tra i piedi.",
        "limiti_gradi": [
            ["Gomito", "flessione", 5, 145], ["Ginocchio", "flessione", 5, 140], ["Spalla", "in avanti / indietro", -40, 160],
            ["Spalla", "apertura di lato", 0, 120], ["Anca", "flessione", -10, 115], ["Anca", "apertura di lato", 0, 40],
            ["Schiena", "in avanti / indietro", -15, 45], ["Schiena", "di lato", -20, 20], ["Schiena", "torsione", -35, 35],
            ["Collo e testa", "su e giù", -35, 35], ["Collo e testa", "di lato", -25, 25], ["Collo e testa", "rotazione", -70, 70],
            ["Polso", "ogni verso", -45, 45], ["Caviglia", "punta su / giù", -20, 40]],
        "versi": {"gomiti": "in basso e in fuori, mai verso l'interno del busto né verso l'alto",
                  "ginocchia": "in avanti e appena in fuori; a cavalcioni stringono il serbatoio"},
    },
    "posti": {
        "_doc": "§16.1: rispetto all'origine del posto (le anche), avanti +X, in alto +Y. [min, max]; null: non si applica.",
        "nomi": {"sit": "seduto in auto", "ride": "a cavalcioni", "stand": "in piedi all'arma"},
        "misure": [
            ["Prese delle mani: avanti", [0.35, 0.55], [0.35, 0.55], [0.30, 0.50]],
            ["Prese delle mani: in alto", [0.20, 0.40], [0.15, 0.40], [0.25, 0.45]],
            ["Prese delle mani: distanza tra loro", [0.30, 0.40], [0.55, 0.75], [0.15, 0.35]],
            ["Appoggi dei piedi: avanti", [0.50, 0.75], [-0.15, 0.20], [0, 0]],
            ["Appoggi dei piedi: in basso", [0.15, 0.40], [0.40, 0.60], [0.94, 0.94]],
            ["Appoggi dei piedi: distanza tra loro", [0.20, 0.40], [0.40, 0.55], [0.25, 0.45]],
            ["Larghezza del sedile tra le cosce (massimo)", None, [0, 0.32], None],
            ["Spazio libero sopra le anche (minimo)", [0.90, None], [0.95, None], [0.90, None]],
            ["Spazio libero di lato (minimo)", [0.55, None], [0.60, None], [0.70, None]],
            ["Schienale: inclinazione all'indietro (gradi)", [5, 25], None, None],
            ["Altezza della sella da terra", None, [0.70, 0.85], None]],
        "arma_manuale": {"impugnature_dal_pavimento": [1.20, 1.40], "pavimento_piano_m": [0.5, 0.5]},
    },
    "classi": {
        "_doc": "§16.3: misure vere in metri, a veicolo scarico e senza arma. Sul tavolo: lunghezza × 8 mm.",
        "car_s": {"nome": "Auto piccola (Doom Buggy)", "sagoma": "piccola e corta", "lunghezza": 3.0, "altezza": 1.5, "larghezza": 1.6, "ruota": 0.36, "posti": ["pilota"]},
        "car_m": {"nome": "Auto media (Avenger)", "sagoma": "bassa e lunga", "lunghezza": 4.8, "altezza": 1.2, "larghezza": 1.9, "ruota": 0.36, "posti": ["pilota", "artigliere"]},
        "car_l": {"nome": "Auto grande (Eliminator)", "sagoma": "lunga, alta e tozza", "lunghezza": 5.2, "altezza": 2.3, "larghezza": 2.3, "ruota": 0.50, "posti": ["pilota", "copilota", "artigliere"]},
        "bike": {"nome": "Moto", "sagoma": "stretta", "lunghezza": 2.1, "altezza": 1.1, "larghezza": 0.75, "ruota": 0.32, "posti": ["pilota"]},
        "rig": {"nome": "Big Rig, ogni sezione", "sagoma": "la più alta del tavolo", "lunghezza": 5.6, "altezza": 3.2, "larghezza": 2.5, "ruota": 0.55, "posti": []},
        "chopper": {"nome": "Elicottero", "sagoma": "da fissare con la sua dima", "lunghezza": None, "altezza": None, "larghezza": None, "ruota": None, "posti": ["pilota"]},
        "wreck": {"nome": "Relitto", "sagoma": "le misure del veicolo da cui viene", "lunghezza": None, "altezza": None, "larghezza": None, "ruota": None, "posti": []},
        "figure": {"nome": "Persona dell'equipaggio", "sagoma": "figura standard", "lunghezza": None, "altezza": 1.75, "larghezza": 0.50, "ruota": None, "posti": []},
        "prop": {"nome": "Ostacolo o elemento della mappa", "sagoma": "—", "lunghezza": None, "altezza": None, "larghezza": None, "ruota": None, "posti": []},
    },
    "parti_mobili": {
        "_doc": "§4.2",
        "ruote_auto": {"corsa_sospensione": [-0.08, 0.12], "sterzo_max_gradi": 32},
        "armi": {"mitragliatrice_alzo_gradi": [-10, 35], "cannone_alzo_gradi": [-5, 25]},
        "moto": {"sterzo_max_gradi": 35, "inclinazione_forcella_gradi": [25, 30], "piega_max_gradi": 45, "piega_curva_stretta_gradi": 50, "derapata_max_gradi": 30},
    },
    "vernice": {"_doc": "§7.1", "quota_vernice": [0.30, 0.50], "quota_usura": [0.15, 0.35]},
    "collaudo": {"_doc": "§18", "proporzioni": 0.08, "punti_posti_m": 0.05, "compenetrazione_m": 0.02, "lunghezza_montaggio": 0.05},
    "budget": {
        "_doc": "§8: triangoli, lato della texture, materiali. Per veicolo intero.",
        "auto": {"triangoli": 8000, "texture": 1024, "materiali": 6}, "elicottero": {"triangoli": 7000, "texture": 1024, "materiali": 5},
        "moto": {"triangoli": 4000, "texture": 1024, "materiali": 5}, "big_rig": {"triangoli": 18000, "texture": 1024, "materiali": 6},
        "relitto": {"triangoli": 5000, "texture": 1024, "materiali": 2}, "persona": {"triangoli": 1500, "texture": 512, "materiali": 3},
    },
    "lod": {
        "_doc": "§8.2: valori di partenza NON misurati, da verificare al tavolo col selettore della qualità grafica. Fino ad allora il collaudo li riporta come avviso.",
        "verificato": False,
        "veicoli": [
            {"id": "V0", "nome": "Primo piano", "px": [200, None], "triangoli": 1.0, "texture": 1024},
            {"id": "V1", "nome": "Tavolo da vicino", "px": [80, 200], "triangoli": 0.4, "texture": 512},
            {"id": "V2", "nome": "Tavolo intero", "px": [30, 80], "triangoli": 0.1, "texture": 0},
            {"id": "V3", "nome": "Lontano e vista mappa", "px": [0, 30], "triangoli_max": 150, "texture": 0}],
        "isteresi": 0.15, "qualita": 0.30, "livello_minimo_in_azione": "V1", "sagoma_rinforzata_max": 0.15,
        "tavolo_intero_triangoli": 25000, "vista_mappa_triangoli": 5000,
        "regola": "A ogni distanza resta il modello: nessun segno, icona o simbolo lo sostituisce o lo accompagna (decisione dell'utente, 2026-11-21).",
    },
    "passi": [
        {"n": 1, "nome": "Scheda", "chi": "Claude scrive, l'utente approva", "cancello": "approvazione dell'utente"},
        {"n": 2, "nome": "Dima", "chi": "script", "cancello": "i posti della dima passano il collaudo"},
        {"n": 3, "nome": "Prompt", "chi": "script, dai blocchi condivisi", "cancello": "—"},
        {"n": 4, "nome": "Concept", "chi": "utente, con Gemini", "cancello": "l'utente lo approva a occhio contro la dima"},
        {"n": 5, "nome": "3D", "chi": "utente, con Meshy", "cancello": "—"},
        {"n": 6, "nome": "Collaudo dimensionale", "chi": "script", "cancello": "tutte le tolleranze rispettate"},
        {"n": 7, "nome": "Montaggio", "chi": "script; l'utente ritocca se serve", "cancello": "controllo automatico"},
        {"n": 8, "nome": "Alleggerimento", "chi": "script", "cancello": "budget"},
        {"n": 9, "nome": "Gioco", "chi": "Claude", "cancello": "prove sul banco, immagini conservate"},
        {"n": 10, "nome": "Approvazione", "chi": "utente", "cancello": "—"}],
    "esiti": {"bozza": "Bozza: da approvare", "da_fare": "Da fare", "in_lavorazione": "In lavorazione", "in_pausa": "In pausa",
              "in_gioco": "Nel gioco", "approvato": "Approvato", "scartato": "Scartato"},
    "regimi": {"precedenti": "Nato prima della specifica: nel gioco con le misure di oggi, da ridisegnare", "specifica": "Segue la specifica del 2026-11-21"},
    "tipi": {"carrozzeria": "Carrozzeria", "telaio": "Telaio della moto", "avantreno": "Avantreno della moto", "ruota": "Ruota",
             "arma_base": "Base dell'arma", "arma": "Arma", "figura": "Figura", "accessorio": "Accessorio", "intero": "Modello intero (prima della specifica)"},
    "blocchi": {
        "_doc": "§20.3. Un prompt per Gemini = stile + camera + tipo + dima (se il pezzo ha posti) + specifico + colore (se il pezzo è tinto). Un prompt per Meshy = specifico + coda. Cambiare un blocco cambia i prompt dei pezzi non ancora generati; quelli usati restano scritti nei tentativi.",
        "stile": STYLE,
        "camera": "Camera three-quarter view from the front-left, looking down from above.",
        "colore": ("Paint and weathering: every painted panel is one single flat neutral light grey, the same grey everywhere, with no "
                   "other paint colour, no stripes, no logos, no numbers. About one third to one half of the visible surface is painted. "
                   "Weathering keeps its own colours and is never grey paint: orange-brown rust, bare scratched steel where the paint "
                   "is chipped, black burn marks, dry mud, dark oil stains. Repair plates are unpainted bare or rusty metal, welded or "
                   "bolted on. Everything that is not a painted panel (frame, wheels, weapons, exhausts, mechanics) is dark iron."),
        "dima": ("Use the attached grey block-out image as the exact template of proportions: the same length, width and height, the "
                 "same position of seats, steering wheel or handlebars, footrests and wheel centres. The translucent human figure in "
                 "the template is only a measure of scale: do not draw any person."),
        "tipo": {
            "carrozzeria": "This picture shows only the body of the vehicle. No wheels: empty wheel arches. No weapons: a flat round mounting plate where each weapon goes. Open or visible cockpit with its seats and steering wheel, and no person in it.",
            "telaio": "This picture shows only the frame of the motorcycle with its engine, tank, seat, footrests and rear swingarm. No front fork, no handlebars, no front mudguard, no headlight: the steering head tube at the front is empty. No wheels: the swingarm ends in an empty hub. No rider.",
            "avantreno": "This picture shows only the front end of the motorcycle, alone: the fork with its two legs, the handlebars with their grips, the front mudguard and the headlight, as one piece. No wheel: the fork ends in an empty hub. No frame, no rider.",
            "ruota": "This picture shows only one wheel, alone, standing upright, its hub exactly in the centre.",
            "arma_base": "This picture shows only the fixed base of the weapon, alone: a round rotating mount with a mounting ring underneath and a pin on top where the gun sits. No gun on it.",
            "arma": "This picture shows only the gun, alone, without its base: barrel horizontal and pointing to the right, its pivot pin underneath, its handles visible if a person aims it by hand.",
            "figura": "This picture shows one human figure alone, standing upright, arms held straight and 45 degrees away from the body, legs slightly apart, hands closed in soft fists and empty, looking forward. Realistic adult proportions, 1.75 m tall. No weapon in the hands, nothing that sticks out far from the body. Front view, full body, feet on the ground.",
            "accessorio": "This picture shows only this object, alone."},
        "meshy": {
            "_doc": "Le impostazioni vanno verificate dall'utente sull'interfaccia di Meshy di oggi.",
            "coda": "Realistic painted metal scale model look, chipped paint, weld seams and rivets, single object.",
            "modo": "Image to 3D dalla tavola del concept",
            "impostazioni": {
                "carrozzeria": {"topology": "Triangle", "symmetry": "On", "texture": 1024},
                "telaio": {"topology": "Triangle", "symmetry": "On", "texture": 1024},
                "avantreno": {"topology": "Triangle", "symmetry": "On", "texture": 512},
                "ruota": {"topology": "Triangle", "symmetry": "On", "texture": 512},
                "arma_base": {"topology": "Triangle", "symmetry": "On", "texture": 512},
                "arma": {"topology": "Triangle", "symmetry": "Off", "texture": 512},
                "figura": {"topology": "Triangle", "symmetry": "On", "texture": 512, "rig": "scheletro automatico, senza animazioni"},
                "accessorio": {"topology": "Triangle", "symmetry": "Off", "texture": 512}},
            "esportazione": "GLB, un oggetto per file, in assets/sorgenti/. La scala non conta: la fissa il collaudo."},
        "regole_gemini": ["Allega sempre il riferimento di stile (un concept già approvato) e, se il pezzo ha posti, la vista della dima.",
                          "Una sola vista per immagine. Le altre viste si chiedono dopo, una per volta.",
                          "Mai le parole drawing, sheet, concept art, illustration, hand-painted: portano al disegno piatto.",
                          "Un pezzo per immagine, nella stessa conversazione, così lo stile resta uguale."],
    },
}

OWNER = {"origine": "ai", "strumento": "Meshy, da concept generati con Gemini", "fonte": "il proprietario del progetto"}


def sheet(id, nome, gioco, classe, scopo, passo, esito, dal, nota, pezzi, **more):
    d = {"schema": 1, "id": id, "nome": nome, "gioco": gioco, "classe": classe, "scopo": scopo, "regime": "precedenti",
         "stato": {"passo": passo, "esito": esito, "dal": dal, "nota": nota}, "pezzi": pezzi,
         "collaudi": [], "decisioni": [], "provenienza": {**OWNER, "data": dal}}
    d.update(more)
    return d


def pezzo(id, nome, tipo, file, **more):
    d = {"id": id, "nome": nome, "tipo": tipo, "file": file}
    d.update(more)
    return d


def usato(gemini=(), meshy=(), correzioni=(), impostazioni=None, fonte=''):
    d = {"fonte": fonte, "gemini": [{"titolo": t, "testo": x} for t, x in gemini], "meshy": [{"titolo": t, "testo": x} for t, x in meshy]}
    if correzioni: d["correzioni"] = [{"quando": q, "testo": x} for q, x in correzioni]
    if impostazioni: d["impostazioni"] = impostazioni
    return d


NO_PROMPT = "Prompt non conservato: il modello è stato generato dall'utente prima che i prompt fossero registrati."
SHEETS = []
OLD = {'car_s': 'Car_Small', 'car_m': 'Car_Medium', 'car_l': 'Car_Large'}


def car(id, nome, classe, oggi_m, oggi_mm, src_dir, files, fase, extra):
    t = [{"data": "2026-11-20", "strumento": "Meshy", "prompt": NO_PROMPT, "esito": "in_gioco"}]
    cut = "Tagliata dal modello intero dell'arma (tools/art/split_gun.py)."
    pezzi = [pezzo(f"{id}_body", "Carrozzeria", "carrozzeria", f"assets/base/modelli/{id}_body.glb", sorgente=f"assets/sorgenti/{src_dir}/{files[0]}", tentativi=t),
             pezzo(f"{id}_gun_mount", "Base della mitragliatrice", "arma_base", f"assets/base/modelli/{id}_gun_mount.glb", sorgente=f"assets/sorgenti/{src_dir}/{files[1]}", nota=cut, tentativi=t),
             pezzo(f"{id}_gun_barrel", "Mitragliatrice", "arma", f"assets/base/modelli/{id}_gun_barrel.glb", sorgente=f"assets/sorgenti/{src_dir}/{files[1]}", nota=cut, tentativi=[])] + extra
    SHEETS.append(sheet(id, nome, "base", classe, "Auto delle squadre, con ruote, sospensioni, sterzo e mitragliatrice mobili.", 9, "in_gioco", "2026-11-20",
                        f"Nel gioco con le misure di oggi. Da ridisegnare sulla dima alla scala unica (fase {fase}).", pezzi,
                        misure_oggi={"lunghezza": oggi_m, "tavolo_mm": oggi_mm}, montaggio=[f"assets/base/modelli/schede/{id}.json"],
                        precedente=[f"assets/archivio/base/modelli/{OLD[id]}.glb"]))


def wheel(id, src):
    return pezzo(f"{id}_wheel", "Ruota", "ruota", f"assets/base/modelli/{id}_wheel.glb", sorgente=src,
                 tentativi=[{"data": "2026-11-20", "strumento": "Meshy", "prompt": NO_PROMPT, "esito": "in_gioco"}])


car("car_s", "Auto piccola (Doom Buggy)", "car_s", 3.6, 22, "doom_buggy_2026-11-20", ["DoomBuggy_Chassis.glb", "DoomBuggy_MachineGun.glb"], "F",
    [wheel("car_s", "assets/sorgenti/doom_buggy_2026-11-20/DoomBuggy_Wheel.glb")])
car("car_m", "Auto media (Avenger)", "car_m", 4.5, 33, "avenger_2026-11-20", ["PostApocalypticCarBod.glb", "MountedMachineGun.glb"], "D",
    [wheel("car_m", "assets/sorgenti/avenger_2026-11-20/PostApocalypticWheel.glb")])
car("car_l", "Auto grande (Eliminator)", "car_l", 6.0, 44, "eliminator_2026-11-20", ["Eliminator_Chassis.glb", "Eliminator_MachineGun.glb"], "F",
    [pezzo("car_l_wheel", "Ruota (quella del Big Rig)", "ruota", "assets/big_rig/modelli/big_rig_wheel.glb", nota="Riusa la ruota del Big Rig.", tentativi=[])])

# The Avenger redesigned on the single scale: the first sheet that follows the specification (phase D).
SHEETS.append({
    "schema": 1, "id": "car_m_v2", "nome": "Auto media (Avenger) ridisegnata", "gioco": "base", "classe": "car_m",
    "scopo": "Prova completa del flusso nuovo (fase D): Avenger alla scala unica, con il pilota al volante.",
    "regime": "specifica",
    "stato": {"passo": 1, "esito": "bozza", "dal": "2026-11-21", "nota": "Scheda in bozza: le parti specifiche dei prompt sono da approvare. La dima arriva con la fase C; senza dima non si genera nulla."},
    "posti": [{"id": "seat_driver", "posa": "sit", "ruolo": "pilota"}, {"id": "seat_gunner", "posa": "stand", "ruolo": "artigliere", "nota": "fase E"}],
    "pezzi": [
        pezzo("car_m_v2_body", "Carrozzeria", "carrozzeria", None, tinto=True, posti=True, triangoli=5000,
              allegati=["riferimento di stile", "dima: carrozzeria, tre quarti"],
              specifico={"gemini": "The model: the Avenger, a low and long post-apocalyptic muscle car for a desert racing board game. Long flat hood, low roofline, wide stance, an open cockpit behind a low armoured windscreen with one driver seat and a steering wheel, a standing platform for a gunner at the back. Welded armour plates, side exhausts, a ram bar at the front.",
                         "meshy": "Low poly game-ready body of a low and long post-apocalyptic muscle car, long flat hood, low roofline, open cockpit with one seat and a steering wheel, standing platform at the back, welded armour plates, side exhausts, front ram bar. No wheels, empty wheel arches. No weapons, a flat round mounting plate at the back. Neutral light grey painted panels, dark iron frame."},
              tentativi=[]),
        pezzo("car_m_v2_wheel", "Ruota", "ruota", None, triangoli=500, allegati=["riferimento di stile"],
              specifico={"gemini": "The model: a wide muscle car wheel, a fat road tyre with a worn tread on a dark steel rim with five bolts.",
                         "meshy": "Low poly game-ready muscle car wheel, fat worn road tyre, dark steel rim with a centred hub and five bolts."},
              tentativi=[]),
        pezzo("car_m_v2_gun_mount", "Base della mitragliatrice", "arma_base", None, triangoli=300, allegati=["riferimento di stile"],
              specifico={"gemini": "The model: the pintle mount of a heavy machine gun, a short thick steel post on a round rotating base.",
                         "meshy": "Low poly game-ready pintle mount for a heavy machine gun, short thick steel post on a round rotating base, dark rusty iron."},
              tentativi=[]),
        pezzo("car_m_v2_gun", "Mitragliatrice", "arma", None, triangoli=700, posti=True,
              allegati=["riferimento di stile", "dima: arma, di lato"],
              specifico={"gemini": "The model: a heavy machine gun aimed by hand, with an ammunition belt and box, a small armoured gun shield and two rear spade grips.",
                         "meshy": "Low poly game-ready heavy machine gun with ammunition belt and box, small armoured gun shield, two rear spade grips, dark rusty iron."},
              tentativi=[]),
    ],
    "collaudi": [],
    "decisioni": [{"data": "2026-11-21", "testo": "Scala unica 1:125: Avenger lunga 4,8 m (38 mm sul tavolo), alta 1,2 m, bassa e lunga."},
                  {"data": "2026-11-21", "testo": "Vernice in un solo grigio neutro; ruggine, piastre di riparazione e sporco non prendono il colore del giocatore."}],
    "provenienza": {"origine": "ai", "strumento": "da generare: Gemini e Meshy", "fonte": "il proprietario del progetto", "data": None},
})

SHEETS.append(sheet("chopper", "Elicottero", "base", "chopper", "Elicottero delle squadre.", 9, "in_gioco", "2026-11-15",
                    "Modello intero, senza parti separate. Misure da fissare con la sua dima (fase G).",
                    [pezzo("chopper", "Elicottero intero", "intero", "assets/base/modelli/Chopper.glb",
                           tentativi=[{"data": "2026-11-15", "strumento": "Meshy", "prompt": NO_PROMPT, "esito": "in_gioco"}])],
                    misure_oggi={"lunghezza": None, "tavolo_mm": 50}))

WRECK_RULES = "Regole comuni (wreck-prompts.md): Image to 3D dal concept, Triangle, circa 5.000 triangoli, texture 1024, oggetto unico, base piatta. Stile dipinto a mano, precedente al blocco di stile unico."
for n, nome, g, m_ in [(1, "Relitto 1", None, None), (2, "Relitto 2 (carro armato)", WRECK[0], WRECK[1]), (3, "Relitto 3 (muscle car)", WRECK[4], None),
                       (4, "Relitto 4 (scuolabus)", WRECK[3], None), (5, "Relitto 5 (pick-up)", WRECK[2], None)]:
    day = "2026-11-15" if n == 1 else "2026-11-17"
    p = pezzo(f"wreck_{n}", "Relitto intero", "intero", f"assets/base/modelli/wreck_{n}.glb",
              tentativi=[{"data": day, "strumento": "Meshy", "prompt": "Quello qui sopra." if g else NO_PROMPT, "esito": "in_gioco"}])
    if g:
        p["usato"] = usato([("Concept", g)], [("Testo, se serve", m_)] if m_ else [], impostazioni={"topology": "Triangle", "triangoli": 5000, "texture": 1024}, fonte="design/art/wreck-prompts.md")
    SHEETS.append(sheet(f"wreck_{n}", nome, "base", "wreck", "Relitto sul tavolo: occupa una casella e conta come un'auto piccola.", 9, "in_gioco", day,
                        "Nel gioco con le misure di oggi (22 mm). Con la scala unica prende le misure del veicolo da cui viene (fase G).", [p],
                        misure_oggi={"lunghezza": None, "tavolo_mm": 22}, note=[WRECK_RULES] if g else []))
SHEETS.append(sheet("wreck_cisterna", "Relitto: rimorchio-cisterna", "base", "wreck", "Sesta variante di relitto, mai generata.", 3, "da_fare", "2026-11-17",
                    "Prompt scritto, modello mai generato. Va riscritto con i blocchi nuovi prima di generarlo.",
                    [pezzo("wreck_6", "Relitto intero", "intero", None, tentativi=[],
                           usato=usato([("Concept", WRECK[5])], fonte="design/art/wreck-prompts.md"))], note=[WRECK_RULES]))


def rig_set(tri, tex):
    return {"topology": "Triangle", "symmetry": "On", "triangoli": tri, "texture": tex}


def t20(src):
    return [{"data": "2026-11-20", "strumento": "Meshy", "prompt": "Quello qui sopra.", "esito": "in_gioco", "sorgente": f"assets/sorgenti/big_rig_2026-11-20/{src}"}]


VISTE = [("Altra vista: di lato", RIG[9]), ("Altra vista: dall'alto", RIG[10])]
SRC = "design/art/big-rig-prompts.md §1.4, §1.5"
SHEETS.append(sheet(
    "big_rig", "Big Rig", "big_rig", "rig", "Il camion a tre sezioni dell'espansione The Big Rig and the Final Five.", 9, "in_gioco", "2026-11-20",
    "Nel gioco a pezzi separati dal 2026-11-20. Sezioni lunghe 6,0 m (46 mm): con la scala unica diventano 5,6 m (fase G).",
    [pezzo("big_rig_intero", "Camion intero (solo concept)", "intero", None,
           usato=usato([("Camion intero", RIG[1])], correzioni=[
               ("esce ancora un disegno", "this must look like a photo of a real painted metal miniature, the same as the style reference image"),
               ("sezioni di misura diversa", "make the three bodies exactly the same length, width and roof height"),
               ("corpi troppo lunghi o attaccati", "shorter bodies, wider gaps, only the thin tow bar crosses the gap"),
               ("pianali vuoti", "closed armoured box bodies with a roof, no open flatbed"),
               ("troppo colore", "all body panels pale off-white grey, no red or yellow paint on the body")], fonte="design/art/big-rig-prompts.md §1.3"),
           nota="Allegati: il concept di riferimento per lo stile e la foto del modellino originale per le proporzioni. Da questa immagine si ricavano i pezzi.", tentativi=[]),
     pezzo("big_rig_front_body", "Carrozzeria della motrice", "carrozzeria", "assets/big_rig/modelli/big_rig_front_body.glb",
           usato=usato([("Passo 1: isolare la motrice", RIG[2]), ("Passo 2: togliere ruote e armi", RIG[3])] + VISTE, [("Testo", RIG[11])], [
               ("più lunga o più bassa del concept", "too long and too low: make it as short and as tall as the tractor in the road train image"),
               ("pianale dietro la cabina", "remove the flat deck behind the cab, the cab rear wall is the end of the body"),
               ("porta aperta o interni in vista", "close the door, small dark windows, interior not visible")], rig_set(4500, 1024), SRC),
           nota="In due passi: chiesto tutto insieme, Gemini ridisegna il pezzo e lo allunga.", tentativi=t20("armoured_truck_tracto.glb")),
     pezzo("big_rig_mid_body", "Carrozzeria della sezione centrale", "carrozzeria", "assets/big_rig/modelli/big_rig_mid_body.glb",
           usato=usato([("Concept", RIG[4])] + VISTE, [("Testo", RIG[12])], impostazioni=rig_set(4500, 1024), fonte=SRC),
           nota="Se un rimorchio esce con il muso della motrice: conversazione nuova, allegare solo il camion intero, oppure generare i rimorchi prima della motrice.",
           tentativi=t20("armoured_trailer_wago.glb")),
     pezzo("big_rig_rear_body", "Carrozzeria della sezione posteriore", "carrozzeria", "assets/big_rig/modelli/big_rig_rear_body.glb",
           usato=usato([("Concept", RIG[5])] + VISTE, [("Testo", RIG[13])], impostazioni=rig_set(4500, 1024), fonte=SRC),
           tentativi=t20("armoured_radar_traile.glb")),
     pezzo("big_rig_wheel", "Ruota", "ruota", "assets/big_rig/modelli/big_rig_wheel.glb",
           usato=usato([("Concept", RIG[6])], [("Testo", RIG[14])], impostazioni=rig_set(400, 512), fonte=SRC), tentativi=t20("offroad_truck_wheel.glb")),
     pezzo("big_rig_launcher", "Lanciamissili", "arma", "assets/big_rig/modelli/big_rig_launcher.glb",
           usato=usato([("Concept", RIG[7])], [("Testo", RIG[15])], impostazioni=rig_set(800, 512), fonte=SRC), tentativi=t20("missile_launcher.glb")),
     pezzo("big_rig_gun", "Mitragliatrice (davanti e dietro)", "arma", "assets/big_rig/modelli/big_rig_gun_barrel.glb",
           usato=usato([("Concept", RIG[8])], [("Testo", RIG[16])], impostazioni=rig_set(600, 512), fonte=SRC),
           nota="Tagliata in base (big_rig_gun_mount.glb) e arma (big_rig_gun_barrel.glb) da tools/art/split_gun.py.", tentativi=t20("heavy_machine_gun.glb"))],
    misure_oggi={"lunghezza": 6.0, "tavolo_mm": 46},
    montaggio=["assets/big_rig/modelli/schede/big_rig_front.json", "assets/big_rig/modelli/schede/big_rig_mid.json", "assets/big_rig/modelli/schede/big_rig_rear.json"],
    precedente=["assets/archivio/big_rig/modelli/big_rig.glb"],
    note=["Stile: blocco di stile unico (ora in regole.json, blocchi.stile), nato qui il 2026-11-19.",
          "Forma: tre sezioni piene della stessa lunghezza, larghezza e altezza; corpo lungo tre quarti di casella, largo circa 18 mm, alto circa 16 mm; estremità smussate a 45°; timone con occhiello e gancio a perno verticale; ruote dentro la larghezza del corpo.",
          "Sistemi: motrice con lanciamissili, rostro, mitragliatrice anteriore; centrale con vano motore, piazzola per l'elicottero, gru; posteriore con scivolo dei pericoli, radar, mitragliatrice posteriore (dai comandi della plancia, data/trv/big_rig_final_five.json).",
          "Via corta, scartata: generare le sezioni intere con ruote e armi attaccate (le ruote non girano, le armi non ruotano)."]))
SHEETS[-1]["decisioni"] = [{"data": "2026-11-19", "testo": "Big Rig ridisegnato: il primo modello aveva rimorchi a pianale vuoto e sezioni di misura diversa che in curva sconfinavano nelle caselle vicine."}]

SHEETS.append(sheet("motorcycle", "Moto delle Final Five (pezzo unico)", "big_rig", "bike", "La moto delle Final Five com'è oggi nel gioco: moto e pilota fusi in un pezzo.", 9, "in_gioco", "2026-11-18",
                    "Nel gioco finché la moto a pezzi non è pronta. Lunga 24 mm: con la scala unica diventa 17 mm.",
                    [pezzo("motorcycle", "Moto con pilota", "intero", "assets/big_rig/modelli/motorcycle.glb",
                           usato=usato([("Concept", RIG[17])], [("Testo, se serve", RIG[18])], [("troppo sottile per leggersi sul tavolo", "chunkier, wider tyres and bigger armour plates")],
                                       {"topology": "Triangle", "symmetry": "On", "triangoli": 4000, "texture": 1024}, "design/art/big-rig-prompts.md §2"),
                           nota="I fianchi del serbatoio restano lisci e chiari: lì il gioco mette il simbolo della moto.",
                           tentativi=[{"data": "2026-11-18", "strumento": "Meshy", "prompt": "Quello qui sopra.", "esito": "in_gioco"}])],
                    misure_oggi={"lunghezza": None, "tavolo_mm": 24}))


def m(text):
    return MOTO[0] + "\n" + text


def ms(tri, tex, sym="On"):
    return {"topology": "Triangle", "symmetry": sym, "triangoli": tri, "texture": tex}


def tp(src):
    return [{"data": "2026-11-20", "strumento": "Meshy", "prompt": "Quello qui sopra.", "esito": "in_pausa", "sorgente": f"assets/sorgenti/moto_1_2026-11-20/{src}"}]


PAUSA = "File sul ramo locale moto-in-pausa, non in questo."
SHEETS.append(sheet(
    "moto_1", "Moto 1 a pezzi", "big_rig", "bike", "La prima moto a pezzi separati, banco prova dei piloti.", 6, "in_pausa", "2026-11-20",
    "In pausa: il pilota siede male, si compenetra con la moto e piega le articolazioni in versi innaturali. Cause e rimedi nel §1.1 della specifica. Si rifà sulla dima (fase G); il lavoro è sul ramo locale moto-in-pausa.",
    [pezzo("moto_1_body", "Moto senza ruote, pilota e arma", "intero", None, altrove="assets/big_rig/modelli/moto_1_body.glb",
           usato=usato([("Concept", m(MOTO[1]))], impostazioni=ms(4000, 1024), fonte="design/art/moto-pilota-prompts.md §1.1"),
           nota="Forcella e manubrio fusi con il telaio: per questo lo sterzo non poteva ruotare. La specifica chiede telaio e avantreno come due pezzi. " + PAUSA, tentativi=tp("moto_body.glb")),
     pezzo("moto_1_wheel", "Ruota tassellata", "ruota", None, altrove="assets/big_rig/modelli/moto_1_wheel.glb",
           usato=usato([("Concept", m(MOTO[2]))], impostazioni=ms(800, 512), fonte="design/art/moto-pilota-prompts.md §1.2"), nota=PAUSA, tentativi=tp("moto_wheel.glb")),
     pezzo("moto_1_gun", "Mitragliatrice montata", "arma", None, altrove="assets/big_rig/modelli/moto_1_gun.glb",
           usato=usato([("Concept", m(MOTO[3]))], impostazioni=ms(1200, 512, "Off"), fonte="design/art/moto-pilota-prompts.md §1.3"), nota=PAUSA, tentativi=tp("moto_gun.glb")),
     pezzo("uzi", "Uzi", "accessorio", None, altrove="assets/big_rig/modelli/uzi.glb",
           usato=usato([("Concept", m(MOTO[4]))], impostazioni=ms(600, 512, "Off"), fonte="design/art/moto-pilota-prompts.md §1.4"),
           nota="Nella mano sinistra del pilota mentre spara. " + PAUSA, tentativi=tp("uzi.glb"))],
    misure_oggi={"lunghezza": 2.2, "tavolo_mm": 24}))
SHEETS[-1]["decisioni"] = [{"data": "2026-11-20", "testo": "Moto messa in pausa: prima vanno definiti i parametri dimensionali dei piloti."},
                           {"data": "2026-11-21", "testo": "Avantreno (forcella, manubrio, parafango, faro) come pezzo separato; la moto deve sterzare, piegare fino a 45-50° e derapare."}]

SHEETS.append(sheet(
    "pilota_1", "Pilota 1", "big_rig", "figure", "Il primo pilota, con lo scheletro di Meshy.", 6, "in_pausa", "2026-11-20",
    "In pausa con la moto 1. Va collaudato come figura (§15.4): ossa, lunghezze entro il 10%, posa di riposo. Generato in posa a T; la specifica chiede braccia ad A.",
    [pezzo("pilota_1", "Pilota in piedi", "figura", None, altrove="assets/big_rig/modelli/pilota_1.glb",
           usato=usato([("Concept, di fronte", m(MOTO[5])), ("Concept, di schiena", "The same rider, seen from behind.")], impostazioni={**ms(5000, 1024), "rig": "automatico, senza animazioni"},
                       fonte="design/art/moto-pilota-prompts.md §1.5"),
           nota="La schiena della giacca ha un pannello liscio e chiaro per la decalcomania della moto; spalle o casco chiari per il colore della squadra. 5.000 triangoli: oltre il budget di una persona (1.500). " + PAUSA,
           tentativi=tp("rider_rigged.glb"))]))

SHEETS.append(sheet("ramp", "Rampa di lancio", "carnage", "prop", "La rampa di Carnage at Devil's Run: occupa una casella, si salta solo in avanti.", 9, "in_gioco", "2026-11-17",
                    "Nel gioco. Lunga una casella (46 mm); proporzioni: lunghezza 1, larghezza 0,8, altezza 0,45 all'estremità alta.",
                    [pezzo("ramp", "Rampa", "intero", "assets/carnage/modelli/Ramp.glb",
                           usato=usato([("Concept", RAMP[0])], [("Testo, se serve", RAMP[1])],
                                       [("troppo realistico", "cartoon style, flat colours, thick shapes"), ("la freccia non si vede", "the yellow arrow covers most of the deck and is clearly visible")],
                                       {"topology": "Triangle", "symmetry": "On", "triangoli": 5000, "texture": 1024}, "design/art/carnage-ramp-prompts.md"),
                           tentativi=[{"data": "2026-11-17", "strumento": "Meshy", "prompt": "Quello qui sopra.", "esito": "in_gioco"}])],
                    misure_oggi={"lunghezza": None, "tavolo_mm": 46}, note=["Stile dipinto a mano, precedente al blocco di stile unico."]))

SHEETS.append(sheet("sand_worm", "Verme delle sabbie", "carnage", "prop", "Il verme di Carnage at Devil's Run, che inghiotte un'auto.", 9, "in_gioco", "2026-11-18",
                    "Nel gioco. Messo in posa dal codice (src/view/worm.ts).",
                    [pezzo("sand_worm", "Verme", "intero", "assets/carnage/modelli/sand_worm.glb",
                           tentativi=[{"data": "2026-11-18", "strumento": "Meshy", "prompt": "Prompt non conservato. Modello Meshy \"Mawstone Mimic\" con la sua texture.", "esito": "in_gioco"}])]))


def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


OUT.mkdir(parents=True, exist_ok=True)
dump(OUT / 'regole.json', REGOLE)
for s in SHEETS:
    dump(OUT / f"{s['id']}.json", s)
print(len(SHEETS), 'schede:', ' '.join(s['id'] for s in SHEETS))
