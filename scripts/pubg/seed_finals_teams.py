"""
seed_finals_teams.py
────────────────────
Popula Person + PlayerAccount + Roster para os times das Finals PEC e PAS.

- Idempotente: skipa Person que já existe pelo display_name.
- Subs identificados nos playoffs (HOWL_odunmavisi, WIT_marcis) já excluídos.
- display_name = parte do nome após o primeiro '_' (canonical PUBG API name).

Uso:
    # Dry-run para conferir sem gravar
    python scripts/pubg/seed_finals_teams.py --pec-stage-id 24 --pas-stage-id 18 --dry-run

    # Gravar
    python scripts/pubg/seed_finals_teams.py --pec-stage-id 24 --pas-stage-id 18

Argumentos:
    --pec-stage-id   ID da stage das Finals PEC no banco (obrigatório)
    --pas-stage-id   ID da stage das Finals PAS no banco (obrigatório)
    --dry-run        Simula sem gravar nada
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.database import SessionLocal
from app.models.person import Person
from app.models.player_account import PlayerAccount
from app.models.roster import Roster

# ── Dados — extraídos de docs/finals_teams_from_api.txt ───────────────────────
# Formato: tag, nome_time, [nomes_completos_api]
# display_name = nome_completo.split("_", 1)[1]

PEC_TEAMS_RAW = [
    ("ACE",  "Acend",                ["ACE_ItzzChrizZ", "ACE_KILYAKAi", "ACE_Ketter", "ACE_TeaBone"]),
    ("BAL",  "Baldinini",            ["BAL_MrShimada", "BAL_caydel-", "BAL_sunfloweeeee", "BAL_taBl"]),
    ("BORZ", "BORZ",                 ["BORZ_HalloSenpai", "BORZ_Luu4iikk-", "BORZ_Marchel", "BORZ_h1xs"]),
    ("BW",   "Bushido Wildcats",     ["BW_Celtik", "BW_Metebey", "BW_codemarco", "BW_crossberk"]),
    ("EVER", "Everlong",             ["EVER_Verstory", "EVER_fantasia", "EVER_rinazxc", "EVER_saintxd"]),
    ("GN",   "GoNext Esports",       ["GN_Acaliptos", "GN_F1Nee", "GN_MAXXX", "GN_Paidaros2"]),
    ("GTG",  "Ghetto Gang",          ["GTG_Apr1l", "GTG_anybodezz", "GTG_iamf1ve", "GTG_imSancho"]),
    ("HIVE", "HiVE",                 ["HiVE_DaNte", "HiVE_Mogore", "HiVE_r0xxx", "HiVE_shengen"]),
    ("HOWL", "exhowl",               ["HOWL_FLORYZ", "HOWL_Nailqop13", "HOWL_Shiplest", "HOWL_TheMad"]),
    # HOWL_odunmavisi — SUB, excluído
    ("JB",   "Joga Bonito",          ["JB_Nod1", "JB_S1mon", "JB_kHRysTaLNi", "JB_slqven"]),
    ("NAVI", "Natus Vincere",        ["NAVI_Feyerist", "NAVI_Hakatory", "NAVI_boost1k-", "NAVI_spyrro"]),
    ("NMSS", "Team Nemesis",         ["NMSS_DIFX", "NMSS_Mellman", "NMSS_SoseD", "NMSS_Staed"]),
    ("NOT",  "No Tag Team",          ["NOT_Doffy", "NOT_Makiintosh", "NOT_OConnell", "NOT_rappha"]),
    ("PBRU", "PBRU",                 ["PBRU_Nabat", "PBRU_h0pejj", "PBRU_quintx", "PBRU_xreyzer1"]),
    ("PGG",  "PGG",                  ["PGG_Presenti", "PGG_SL0YJACKET", "PGG_Salik", "PGG_Zubila"]),
    ("RL",   "Redline",              ["RL_DYNNO", "RL_ZEKO", "RL_ivas", "RL_karxx"]),
    ("S2G",  "S2G Esports",          ["S2G_BARON", "S2G_CCINEXT", "S2G_Quetpa", "S2G_Shilla"]),
    ("S8UL", "S8UL Esports",         ["S8UL_ADOUZ1E", "S8UL_Bestoloch", "S8UL_Molodoct", "S8UL_f1lfirst"]),
    ("SLCK", "noslack",              ["SLCK_Kova1evy", "SLCK_S4TTA", "SLCK_SkaV", "SLCK_iExE"]),
    ("SQU",  "STORM ON REQUEST",     ["SQU_210", "SQU_Vezyv1y", "SQU_pozyyan", "SQU_xisooo"]),
    ("STS",  "Starry SKY",           ["STS_Momme", "STS_N1tro", "STS_SILERZZ", "STS_vazo"]),
    ("TMO",  "The Myth of",          ["TMO_Himan", "TMO_Justus", "TMO_Myca", "TMO_ares"]),
    ("TWIS", "Twisted Minds",        ["TWIS_BatulinS", "TWIS_Lu", "TWIS_Perfect1ks", "TWIS_xmpl"]),
    ("VIS",  "Vis",                  ["VIS_Ar2n", "VIS_PaiinZ", "VIS_habibi", "VIS_stratos"]),
    ("VIT",  "Team Vitality",        ["VIT_Gedrox", "VIT_Lev4nte", "VIT_QWZYYY", "VIT_hallomybad"]),
    ("VP",   "Virtus.pro",           ["VP_Beami", "VP_Lukarux", "VP_NIXZYEE", "VP_curexi"]),
    ("VPX",  "Vuptrox",              ["VPX_Bjoernter", "VPX_Blissed", "VPX_Mikzenn", "VPX_Vorix"]),
    ("WORK", "Construction Workers", ["WORK_Fexx", "WORK_Naylup", "WORK_PiXeL1K", "WORK_vard"]),
    ("YO",   "YOOO",                 ["YO_K4pii", "YO_jeemzz", "YO_mykLe", "YO_pwddddddddd"]),
]

PAS_TEAMS_RAW = [
    ("55PD", "55 e-Sports",       ["55PD_KerakTMz", "55PD_OhNytavoN", "55PD_gabriehw", "55PD_gloock77"]),
    ("AKA",  "Also known as",     ["AKA_Falconn", "AKA_LIP7", "AKA_daanshin", "AKA_zDarkCastle"]),
    ("BO",   "IAM BOLIVIA",       ["BO_C4MB4", "BO_Imsfck1ngbd", "BO_Neyzhera", "BO_V-I-R-I"]),
    ("BST",  "BESTIA",            ["BST_FROGMAN1", "BST_PIPAA", "BST_beNjA", "BST_v1n1zxz"]),
    ("CLR",  "Collector",         ["CLR_4EARTH", "CLR_Dreamzz", "CLR_MIKSUU-", "CLR_RedRyderNA"]),
    ("DOTS", "Dots",              ["DOTS_OtosakaYu-", "DOTS_TheSpectro", "DOTS_sKZ974", "DOTS_shanedoe"]),
    ("DUEL", "DUEL",              ["DUEL_Kein", "DUEL_Sharpshot4K", "DUEL_Woo1y", "DUEL_pentalol"]),
    ("FATE", "Team FATE",         ["FATE_DadBuff", "FATE_Tater", "FATE_TimFee", "FATE_fl8nkr"]),
    ("FE",   "Athletes of Christ",["FE_Haven", "FE_Tny7", "FE_fana", "FE_lfp1"]),
    ("FLC",  "Team Falcons",      ["FLC_Gustav", "FLC_Kickstart", "FLC_Shrimzy", "FLC_TGLTN"]),
    ("FN",   "For Nothing",       ["FN_Lyel", "FN_MAURILIO1", "FN_gmoo", "FN_sweezy"]),
    ("FR",   "RENT FREE",         ["FR_Bizzler", "FR_HoneyBadger", "FR_J4M", "FR_gats"]),
    ("FUR",  "FURIA",             ["FUR_Dr4FTk1NG", "FUR_bielmtcalmo", "FUR_possa", "FUR_zkraken"]),
    ("INJ",  "Injected",          ["INJ_Plushiee", "INJ_Stokeley", "INJ_choppy-_-", "INJ_s1mplicityy"]),
    ("INSK", "Chupinsky's",       ["INSK_0racle_", "INSK_Luizeer4", "INSK_gabudo", "INSK_tuuruuruu"]),
    ("NA",   "Newgen Allstars",   ["NA_Balefrost", "NA_Shinboi", "NA_ega", "NA_f1nna"]),
    ("NVM",  "NEVERMIND",         ["NVM_LOST", "NVM_Linguinha", "NVM_WotulinS", "NVM_skatasxtico"]),
    ("NW",   "No Way",            ["NW_ZxLopes", "NW_dnL", "NW_gladiador", "NW_slabyy"]),
    ("ONE",  "Dream One",         ["ONE_LiiPeeXx", "ONE_XH44444", "ONE_demonfrost", "ONE_vps1-"]),
    ("PEST", "Pest Control",      ["PEST_HotNSpicy", "PEST_JoShY-_-", "PEST_Kaymind", "PEST_conf"]),
    ("ROC",  "ROC Esports",       ["ROC_cauan7zin", "ROC_rbN777", "ROC_sparkingg", "ROC_sxntastico"]),
    ("AFi",  "Affinity",          ["AFi_Ghowst", "AFi_Mizbo", "AFi_NDucky", "AFi_Zalody"]),
    ("LxB",  "Last Breath",       ["LxB_Blazr", "LxB_andreww", "LxB_arv10", "LxB_danitw"]),
    ("TL",   "Team Liquid",       ["TL_CowBoi", "TL_PurdyKurty", "TL_aLOW", "TL_luke12"]),
    ("TMP",  "Tempest",           ["TMP_HUGHLIGAN", "TMP_K1lawi", "TMP_abdou", "TMP_xQnn"]),
    ("TOYO", "TOYO Esports",      ["TOYO_Capitan", "TOYO_Emi", "TOYO_Fakezin77", "TOYO_SOLDZZZZ93"]),
    ("WIT",  "What It Takes",     ["WIT_Luciid", "WIT_Maurnzz", "WIT_SneakAttack", "WIT_enzito"]),
    # WIT_marcis — SUB, excluído
    ("WOLF", "Copenhagen Wolves", ["WOLF_Fludd", "WOLF_Snakers", "WOLF_Vox", "WOLF_hwinn"]),
    ("X10",  "EUFAREIX10",        ["X10_FranXzz", "X10_Kalniixx", "X10_San71Hero1", "X10_kl4uZeera"]),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_display_name(api_name: str) -> str:
    """
    'BAL_caydel-'    → 'caydel-'
    'INJ_choppy-_-'  → 'choppy-_-'
    'INSK_0racle_'   → '0racle_'
    'HiVE_DaNte'     → 'DaNte'
    """
    if "_" in api_name:
        return api_name.split("_", 1)[1]
    return api_name


def build_teams(raw: list) -> list[dict]:
    return [
        {
            "tag":      tag,
            "nome_time": nome,
            "jogadores": [extract_display_name(n) for n in api_names],
        }
        for tag, nome, api_names in raw
    ]


def insert_team(db, stage_id: int, team: dict, dry_run: bool) -> int:
    tag       = team["tag"]
    nome_time = team["nome_time"]
    inserted  = 0

    for display_name in team["jogadores"]:
        # 1. Verifica se Person já existe pelo display_name
        person = db.query(Person).filter(Person.display_name == display_name).first()
        if person:
            print(f"  [SKIP] Person já existe: {display_name} (id={person.id})")
        else:
            person = Person(display_name=display_name, is_active=True)
            if not dry_run:
                db.add(person)
                db.flush()
            print(f"  [NEW]  Person: {display_name}" + ("" if dry_run else f" (id={person.id})"))

        if dry_run or not person.id:
            inserted += 1
            continue

        # 2. PlayerAccount
        existing_pa = db.query(PlayerAccount).filter(
            PlayerAccount.person_id == person.id
        ).first()
        if existing_pa:
            print(f"         PlayerAccount já existe: alias={existing_pa.alias} shard={existing_pa.shard}")
        else:
            pa = PlayerAccount(
                person_id=person.id,
                alias=display_name,
                account_id=f"PENDING_{display_name}",
                shard="pc-tournament",
            )
            db.add(pa)
            db.flush()
            print(f"         PlayerAccount criado: alias={display_name} (PENDING)")

        # 3. Roster
        existing_r = db.query(Roster).filter(
            Roster.stage_id == stage_id,
            Roster.person_id == person.id,
        ).first()
        if existing_r:
            print(f"         Roster já existe para stage {stage_id}")
        else:
            r = Roster(
                stage_id=stage_id,
                person_id=person.id,
                team_name=nome_time,
                fantasy_cost=15.00,
                is_available=True,
            )
            db.add(r)
            db.flush()
            print(f"         Roster criado: stage={stage_id} team={nome_time}")
            inserted += 1

    return inserted


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Popula Person + PlayerAccount + Roster para as Finals PEC e PAS"
    )
    parser.add_argument("--pec-stage-id", type=int, required=True, help="ID da stage das Finals PEC")
    parser.add_argument("--pas-stage-id", type=int, required=True, help="ID da stage das Finals PAS")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar no banco")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN — nenhuma alteração será gravada ===\n")

    pec_teams = build_teams(PEC_TEAMS_RAW)
    pas_teams = build_teams(PAS_TEAMS_RAW)

    db = SessionLocal()
    try:
        total = 0

        print(f"\n{'━'*60}")
        print(f"  PEC Finals — stage {args.pec_stage_id}  ({len(pec_teams)} times)")
        print(f"{'━'*60}")
        for team in pec_teams:
            print(f"\n[{team['tag']}] {team['nome_time']}")
            total += insert_team(db, args.pec_stage_id, team, args.dry_run)

        print(f"\n{'━'*60}")
        print(f"  PAS Finals — stage {args.pas_stage_id}  ({len(pas_teams)} times)")
        print(f"{'━'*60}")
        for team in pas_teams:
            print(f"\n[{team['tag']}] {team['nome_time']}")
            total += insert_team(db, args.pas_stage_id, team, args.dry_run)

        if not args.dry_run:
            db.commit()
            print(f"\n[OK] Commit realizado. {total} entradas de roster criadas.")
        else:
            print(f"\n[DRY RUN] {total} entradas de roster seriam criadas.")

        print(f"\n  PEC: {len(pec_teams)} times × 4 = {len(pec_teams)*4} jogadores")
        print(f"  PAS: {len(pas_teams)} times × 4 = {len(pas_teams)*4} jogadores")
        print(f"  Total: {len(pec_teams)*4 + len(pas_teams)*4} jogadores")

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
