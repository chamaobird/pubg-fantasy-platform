"""
rename_persons_canonical.py
───────────────────────────
Atualiza display_name das Persons para o nome canônico da PUBG API.

Casos tratados:
  1. Prefixo de time: '55PD_KerakTMz' → 'KerakTMz'
  2. Variações conhecidas: 'Apr1l-' → 'Apr1l', 'vjeemzz' → 'jeemzz', etc.

Após rodar este script, execute seed_team_records.py para criar os Teams e
TeamMembers. Persons ainda faltantes serão criadas lá.

Uso:
    python scripts/pubg/rename_persons_canonical.py --dry-run
    python scripts/pubg/rename_persons_canonical.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.models.person import Person

# ── Mapeamento explícito: display_name atual → display_name canônico ──────────
# Inclui: remoção de prefixo de time + variações de nome

RENAMES: dict[str, str] = {
    # ── 55PD ──────────────────────────────────────────────────────────────────
    "55PD_KerakTMz":       "KerakTMz",
    "55PD_OhNytavoN":      "OhNytavoN",
    "55PD_gabriehw":       "gabriehw",
    "55PD_gloock77":       "gloock77",

    # ── AFi ───────────────────────────────────────────────────────────────────
    "AFi_Ghowst":          "Ghowst",
    "AFi_Mizbo":           "Mizbo",
    "AFi_NDucky":          "NDucky",
    "AFi_Zalody":          "Zalody",

    # ── AKA ───────────────────────────────────────────────────────────────────
    "AKA_Falconn":         "Falconn",
    "AKA_daanshin":        "daanshin",
    "AKA_zDarkCastle":     "zDarkCastle",
    # AKA_nahnouh → LIP7 (troca de roster — tratado como novo player no seed)

    # ── BAL ───────────────────────────────────────────────────────────────────
    "caydel":              "caydel-",
    "taBl-":               "taBl",

    # ── BORZ ──────────────────────────────────────────────────────────────────
    "Marchel-":            "Marchel",

    # ── BST ───────────────────────────────────────────────────────────────────
    "BST_FROGMAN1":        "FROGMAN1",
    "BST_PIPAA":           "PIPAA",
    "BST_beNjAkaponi":     "beNjA",
    "BST_v1n1zxz":        "v1n1zxz",

    # ── CLR ───────────────────────────────────────────────────────────────────
    "CLR_4EARTH":          "4EARTH",
    "CLR_Dreamzz":         "Dreamzz",
    "CLR_RedRyderNA":      "RedRyderNA",

    # ── DOTS ──────────────────────────────────────────────────────────────────
    "DOTS_OtosakaYu-":     "OtosakaYu-",
    "DOTS_TheSpectro":     "TheSpectro",
    "DOTS_sKZ974":         "sKZ974",
    "DOTS_shanedoe":       "shanedoe",
    "shane_doe":           "shanedoe",  # variante sem underscore

    # ── DUEL ──────────────────────────────────────────────────────────────────
    "DUEL_Kein":           "Kein",
    "DUEL_Sharpshot4K":    "Sharpshot4K",
    "DUEL_Woo1y":          "Woo1y",
    "DUEL_pentalol":       "pentalol",

    # ── FATE ──────────────────────────────────────────────────────────────────
    "FATE_DadBuff":        "DadBuff",
    "FATE_Tater":          "Tater",
    "FATE_TimFee":         "TimFee",
    "FATE_fl8nkr":         "fl8nkr",

    # ── FE ────────────────────────────────────────────────────────────────────
    "FE_Haven-":           "Haven",
    "FE_Tny7":             "Tny7",
    "FE_fanafps":          "fana",
    "FE_lfp1s2A":          "lfp1",

    # ── FLC ───────────────────────────────────────────────────────────────────
    "FLC_Gustav":          "Gustav",
    "FLC_Kickstart":       "Kickstart",
    "FLC_Shrimzy":         "Shrimzy",
    "FLC_TGLTN":           "TGLTN",

    # ── FN ────────────────────────────────────────────────────────────────────
    "gmoo-":               "gmoo",

    # ── FR ────────────────────────────────────────────────────────────────────
    "FR_Bizzler":          "Bizzler",
    "FR_HoneyBadger":      "HoneyBadger",
    "FR_J4M":              "J4M",

    # ── FUR ───────────────────────────────────────────────────────────────────
    "FUR_Dr4FTk1NG":       "Dr4FTk1NG",
    "FUR_bielmtcalmo":     "bielmtcalmo",
    "FUR_possa":           "possa",
    "FUR_zKraken":         "zkraken",

    # ── GTG ───────────────────────────────────────────────────────────────────
    "Apr1l-":              "Apr1l",
    "iamf1ve-":            "iamf1ve",
    # Blazor- → anybodezz: troca de jogador, não renomeação — tratado no seed

    # ── INSK ──────────────────────────────────────────────────────────────────
    "INSK_0racle_":        "0racle_",
    "INSK_Luizeer4":       "Luizeer4",
    "INSK_gabudo":         "gabudo",
    "INSK_tuuruuruu":      "tuuruuruu",

    # ── INJ ───────────────────────────────────────────────────────────────────
    "INJ_Stokeley":        "Stokeley",
    "INJ_choppy-_-":       "choppy-_-",   # mesmo nome, mas entrada com prefixo
    "INJ_s1mplicityy":     "s1mplicityy",
    # INJ_Plushiee já pode estar correto — checado pelo seed

    # ── LxB ───────────────────────────────────────────────────────────────────
    "LB_Blazr":            "Blazr",
    "LB_andriu-":          "andreww",
    "LB_AleeRv":           "arv10",
    "LB_danitw":           "danitw",

    # ── NA ────────────────────────────────────────────────────────────────────
    "NA_Balefrost":        "Balefrost",
    "NA_Shinboi":          "Shinboi",
    "NA_ega":              "ega",
    "NA_f1nna-":           "f1nna",

    # ── NOT ───────────────────────────────────────────────────────────────────
    "Donquixote_Doffy":    "Doffy",
    "Mak":                 "Makiintosh",

    # ── NVM ───────────────────────────────────────────────────────────────────
    "NVM_Linguinha":       "Linguinha",
    "NVM_WotulinS":        "WotulinS",
    "NVM_skatasxtico":     "skatasxtico",
    # NVM_DrausioVrau → LOST: troca de jogador

    # ── NW ────────────────────────────────────────────────────────────────────
    "NW_DuduGladiador":    "gladiador",
    "NW_ZxLopes":          "ZxLopes",
    "NW_dnL1":             "dnL",
    "NW_slabyy-":          "slabyy",

    # ── ONE ───────────────────────────────────────────────────────────────────
    "ONE_LiiPeeXx":        "LiiPeeXx",
    "ONE_XH44444":         "XH44444",
    "ONE_demonfrost":      "demonfrost",

    # ── PEST ──────────────────────────────────────────────────────────────────
    "PEST_HotNSpicy-":     "HotNSpicy",
    "PEST_JoShY-_-":       "JoShY-_-",   # mesmo nome, mas entrada com prefixo
    "PEST_Kaymind":        "Kaymind",
    "PEST_conf2031":       "conf",

    # ── PGG ───────────────────────────────────────────────────────────────────
    "Salik-":              "Salik",
    "Zub1la":              "Zubila",

    # ── ROC ───────────────────────────────────────────────────────────────────
    "ROC_cauan7zin":       "cauan7zin",
    "ROC_rbN777":          "rbN777",
    "ROC_sparkingg":       "sparkingg",
    "ROC_sxntastico":      "sxntastico",

    # ── SQU ───────────────────────────────────────────────────────────────────
    "gt210kz":             "210",
    "Vezyv1y-":            "Vezyv1y",

    # ── STS ───────────────────────────────────────────────────────────────────
    "vaaazooo":            "vazo",

    # ── TL ────────────────────────────────────────────────────────────────────
    "TL_CowBoi":           "CowBoi",
    "TL_PurdyKurty":       "PurdyKurty",
    "TL_aLOW":             "aLOW",
    "TL_luke12":           "luke12",

    # ── TMP ───────────────────────────────────────────────────────────────────
    "TMP_HUGHLIGAN":       "HUGHLIGAN",
    "TMP_K1lawi":          "K1lawi",
    "TMP_abdou":           "abdou",
    "TMP_xQnn":            "xQnn",

    # ── TOYO ──────────────────────────────────────────────────────────────────
    "TOYO_Capitan":        "Capitan",
    "TOYO_Emi":            "Emi",
    "TOYO_Fakezin77":      "Fakezin77",
    "TOYO_soldzzzz93":     "SOLDZZZZ93",

    # ── WIT ───────────────────────────────────────────────────────────────────
    "WIT_Luciid_oO":       "Luciid",
    "WIT_Maurnzz":         "Maurnzz",
    "WIT_SneakAttack":     "SneakAttack",
    "WIT_enzito":          "enzito",

    # ── WOLF ──────────────────────────────────────────────────────────────────
    "WOLF_Fludd":          "Fludd",
    "WOLF_Snakers":        "Snakers",
    "WOLF_Vox":            "Vox",
    "WOLF_hwinn":          "hwinn",

    # ── X10 ───────────────────────────────────────────────────────────────────
    "X10_FranXzz":         "FranXzz",
    "X10_Kalniixx":        "Kalniixx",
    "X10_San71Hero1":      "San71Hero1",
    "X10_kl4uZeera":       "kl4uZeera",

    # ── YO ────────────────────────────────────────────────────────────────────
    "vjeemzz":             "jeemzz",
    "pw9d":                "pwddddddddd",
    "TwitchTV_mykLe":      "mykLe",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN ===\n")

    db = SessionLocal()
    try:
        renamed = 0
        skipped_not_found = 0
        skipped_conflict = 0

        for old_name, new_name in RENAMES.items():
            if old_name == new_name:
                continue

            person = db.query(Person).filter(Person.display_name == old_name).first()
            if not person:
                print(f"  [--]   Não encontrado: '{old_name}' (já renomeado ou não existe)")
                skipped_not_found += 1
                continue

            # Verifica conflito: já existe person com o novo nome?
            conflict = db.query(Person).filter(Person.display_name == new_name).first()
            if conflict:
                print(f"  [CONF] '{old_name}' → '{new_name}' — conflito com id={conflict.id}, pulando")
                skipped_conflict += 1
                continue

            print(f"  [REN]  id={person.id:<5} '{old_name}' → '{new_name}'" + (" (dry)" if args.dry_run else ""))
            if not args.dry_run:
                person.display_name = new_name
            renamed += 1

        if not args.dry_run:
            db.commit()

        print(f"\n{'━'*60}")
        print(f"  Renomeados:          {renamed}")
        print(f"  Não encontrados:     {skipped_not_found}  (já corretos ou inexistentes)")
        print(f"  Conflitos (pulados): {skipped_conflict}")
        if not args.dry_run:
            print("  [OK] Commit realizado.")
        print(f"{'━'*60}")
        print("\nPróximo passo: python scripts/pubg/seed_team_records.py")

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
