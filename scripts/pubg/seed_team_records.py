"""
seed_team_records.py
────────────────────
Cria Team + TeamMember para todos os times das Finals PEC e PAS.
Usa os mesmos dados do seed_finals_teams.py como fonte de verdade.

- Idempotente: skipa Team já existente por tag, skipa TeamMember já existente.
- Person é encontrado por display_name (parte após o primeiro '_' do nome da API).
- Se a Person não existe no banco, ela é reportada em aviso (não cria Person aqui).

Uso:
    python scripts/pubg/seed_team_records.py --dry-run   # conferir
    python scripts/pubg/seed_team_records.py             # gravar
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
from app.models.team import Team
from app.models.team_member import TeamMember

# ── Dados (mesma fonte que seed_finals_teams.py) ──────────────────────────────

PEC_TEAMS_RAW = [
    ("ACE",  "Acend",                "PEC", ["ACE_ItzzChrizZ", "ACE_KILYAKAi", "ACE_Ketter", "ACE_TeaBone"]),
    ("BAL",  "Baldinini",            "PEC", ["BAL_MrShimada", "BAL_caydel-", "BAL_sunfloweeeee", "BAL_taBl"]),
    ("BORZ", "BORZ",                 "PEC", ["BORZ_HalloSenpai", "BORZ_Luu4iikk-", "BORZ_Marchel", "BORZ_h1xs"]),
    ("BW",   "Bushido Wildcats",     "PEC", ["BW_Celtik", "BW_Metebey", "BW_codemarco", "BW_crossberk"]),
    ("EVER", "Everlong",             "PEC", ["EVER_Verstory", "EVER_fantasia", "EVER_rinazxc", "EVER_saintxd"]),
    ("GN",   "GoNext Esports",       "PEC", ["GN_Acaliptos", "GN_F1Nee", "GN_MAXXX", "GN_Paidaros2"]),
    ("GTG",  "Ghetto Gang",          "PEC", ["GTG_Apr1l", "GTG_anybodezz", "GTG_iamf1ve", "GTG_imSancho"]),
    ("HIVE", "HiVE",                 "PEC", ["HiVE_DaNte", "HiVE_Mogore", "HiVE_r0xxx", "HiVE_shengen"]),
    ("HOWL", "exhowl",               "PEC", ["HOWL_FLORYZ", "HOWL_Nailqop13", "HOWL_Shiplest", "HOWL_TheMad"]),
    ("JB",   "Joga Bonito",          "PEC", ["JB_Nod1", "JB_S1mon", "JB_kHRysTaLNi", "JB_slqven"]),
    ("NAVI", "Natus Vincere",        "PEC", ["NAVI_Feyerist", "NAVI_Hakatory", "NAVI_boost1k-", "NAVI_spyrro"]),
    ("NMSS", "Team Nemesis",         "PEC", ["NMSS_DIFX", "NMSS_Mellman", "NMSS_SoseD", "NMSS_Staed"]),
    ("NOT",  "No Tag Team",          "PEC", ["NOT_Doffy", "NOT_Makiintosh", "NOT_OConnell", "NOT_rappha"]),
    ("PBRU", "PBRU",                 "PEC", ["PBRU_Nabat", "PBRU_h0pejj", "PBRU_quintx", "PBRU_xreyzer1"]),
    ("PGG",  "PGG",                  "PEC", ["PGG_Presenti", "PGG_SL0YJACKET", "PGG_Salik", "PGG_Zubila"]),
    ("RL",   "Redline",              "PEC", ["RL_DYNNO", "RL_ZEKO", "RL_ivas", "RL_karxx"]),
    ("S2G",  "S2G Esports",          "PEC", ["S2G_BARON", "S2G_CCINEXT", "S2G_Quetpa", "S2G_Shilla"]),
    ("S8UL", "S8UL Esports",         "PEC", ["S8UL_ADOUZ1E", "S8UL_Bestoloch", "S8UL_Molodoct", "S8UL_f1lfirst"]),
    ("SLCK", "noslack",              "PEC", ["SLCK_Kova1evy", "SLCK_S4TTA", "SLCK_SkaV", "SLCK_iExE"]),
    ("SQU",  "STORM ON REQUEST",     "PEC", ["SQU_210", "SQU_Vezyv1y", "SQU_pozyyan", "SQU_xisooo"]),
    ("STS",  "Starry SKY",           "PEC", ["STS_Momme", "STS_N1tro", "STS_SILERZZ", "STS_vazo"]),
    ("TMO",  "The Myth of",          "PEC", ["TMO_Himan", "TMO_Justus", "TMO_Myca", "TMO_ares"]),
    ("TWIS", "Twisted Minds",        "PEC", ["TWIS_BatulinS", "TWIS_Lu", "TWIS_Perfect1ks", "TWIS_xmpl"]),
    ("VIS",  "Vis",                  "PEC", ["VIS_Ar2n", "VIS_PaiinZ", "VIS_habibi", "VIS_stratos"]),
    ("VIT",  "Team Vitality",        "PEC", ["VIT_Gedrox", "VIT_Lev4nte", "VIT_QWZYYY", "VIT_hallomybad"]),
    ("VP",   "Virtus.pro",           "PEC", ["VP_Beami", "VP_Lukarux", "VP_NIXZYEE", "VP_curexi"]),
    ("VPX",  "Vuptrox",              "PEC", ["VPX_Bjoernter", "VPX_Blissed", "VPX_Mikzenn", "VPX_Vorix"]),
    ("WORK", "Construction Workers", "PEC", ["WORK_Fexx", "WORK_Naylup", "WORK_PiXeL1K", "WORK_vard"]),
    ("YO",   "YOOO",                 "PEC", ["YO_K4pii", "YO_jeemzz", "YO_mykLe", "YO_pwddddddddd"]),
]

PAS_TEAMS_RAW = [
    ("55PD", "55 e-Sports",       "PAS", ["55PD_KerakTMz", "55PD_OhNytavoN", "55PD_gabriehw", "55PD_gloock77"]),
    ("AKA",  "Also known as",     "PAS", ["AKA_Falconn", "AKA_LIP7", "AKA_daanshin", "AKA_zDarkCastle"]),
    ("BO",   "IAM BOLIVIA",       "PAS", ["BO_C4MB4", "BO_Imsfck1ngbd", "BO_Neyzhera", "BO_V-I-R-I"]),
    ("BST",  "BESTIA",            "PAS", ["BST_FROGMAN1", "BST_PIPAA", "BST_beNjA", "BST_v1n1zxz"]),
    ("CLR",  "Collector",         "PAS", ["CLR_4EARTH", "CLR_Dreamzz", "CLR_MIKSUU-", "CLR_RedRyderNA"]),
    ("DOTS", "Dots",              "PAS", ["DOTS_OtosakaYu-", "DOTS_TheSpectro", "DOTS_sKZ974", "DOTS_shanedoe"]),
    ("DUEL", "DUEL",              "PAS", ["DUEL_Kein", "DUEL_Sharpshot4K", "DUEL_Woo1y", "DUEL_pentalol"]),
    ("FATE", "Team FATE",         "PAS", ["FATE_DadBuff", "FATE_Tater", "FATE_TimFee", "FATE_fl8nkr"]),
    ("FE",   "Athletes of Christ","PAS", ["FE_Haven", "FE_Tny7", "FE_fana", "FE_lfp1"]),
    ("FLC",  "Team Falcons",      "PAS", ["FLC_Gustav", "FLC_Kickstart", "FLC_Shrimzy", "FLC_TGLTN"]),
    ("FN",   "For Nothing",       "PAS", ["FN_Lyel", "FN_MAURILIO1", "FN_gmoo", "FN_sweezy"]),
    ("FR",   "RENT FREE",         "PAS", ["FR_Bizzler", "FR_HoneyBadger", "FR_J4M", "FR_gats"]),
    ("FUR",  "FURIA",             "PAS", ["FUR_Dr4FTk1NG", "FUR_bielmtcalmo", "FUR_possa", "FUR_zkraken"]),
    ("INJ",  "Injected",          "PAS", ["INJ_Plushiee", "INJ_Stokeley", "INJ_choppy-_-", "INJ_s1mplicityy"]),
    ("INSK", "Chupinsky's",       "PAS", ["INSK_0racle_", "INSK_Luizeer4", "INSK_gabudo", "INSK_tuuruuruu"]),
    ("NA",   "Newgen Allstars",   "PAS", ["NA_Balefrost", "NA_Shinboi", "NA_ega", "NA_f1nna"]),
    ("NVM",  "NEVERMIND",         "PAS", ["NVM_LOST", "NVM_Linguinha", "NVM_WotulinS", "NVM_skatasxtico"]),
    ("NW",   "No Way",            "PAS", ["NW_ZxLopes", "NW_dnL", "NW_gladiador", "NW_slabyy"]),
    ("ONE",  "Dream One",         "PAS", ["ONE_LiiPeeXx", "ONE_XH44444", "ONE_demonfrost", "ONE_vps1-"]),
    ("PEST", "Pest Control",      "PAS", ["PEST_HotNSpicy", "PEST_JoShY-_-", "PEST_Kaymind", "PEST_conf"]),
    ("ROC",  "ROC Esports",       "PAS", ["ROC_cauan7zin", "ROC_rbN777", "ROC_sparkingg", "ROC_sxntastico"]),
    ("AFi",  "Affinity",          "PAS", ["AFi_Ghowst", "AFi_Mizbo", "AFi_NDucky", "AFi_Zalody"]),
    ("LxB",  "Last Breath",       "PAS", ["LxB_Blazr", "LxB_andreww", "LxB_arv10", "LxB_danitw"]),
    ("TL",   "Team Liquid",       "PAS", ["TL_CowBoi", "TL_PurdyKurty", "TL_aLOW", "TL_luke12"]),
    ("TMP",  "Tempest",           "PAS", ["TMP_HUGHLIGAN", "TMP_K1lawi", "TMP_abdou", "TMP_xQnn"]),
    ("TOYO", "TOYO Esports",      "PAS", ["TOYO_Capitan", "TOYO_Emi", "TOYO_Fakezin77", "TOYO_SOLDZZZZ93"]),
    ("WIT",  "What It Takes",     "PAS", ["WIT_Luciid", "WIT_Maurnzz", "WIT_SneakAttack", "WIT_enzito"]),
    ("WOLF", "Copenhagen Wolves", "PAS", ["WOLF_Fludd", "WOLF_Snakers", "WOLF_Vox", "WOLF_hwinn"]),
    ("X10",  "EUFAREIX10",        "PAS", ["X10_FranXzz", "X10_Kalniixx", "X10_San71Hero1", "X10_kl4uZeera"]),
]


def display_name(api_name: str) -> str:
    return api_name.split("_", 1)[1] if "_" in api_name else api_name


def seed(db, teams_raw: list, dry_run: bool) -> dict:
    stats = {"teams_created": 0, "teams_skipped": 0, "members_added": 0, "members_skipped": 0, "persons_missing": []}

    for tag, name, region, api_names in teams_raw:
        # 1. Team
        team = db.query(Team).filter(Team.tag == tag).first()
        if team:
            print(f"  [SKIP] Team já existe: [{tag}] {team.name}")
            stats["teams_skipped"] += 1
        else:
            team = Team(tag=tag, name=name, region=region, is_active=True)
            if not dry_run:
                db.add(team)
                db.flush()
            print(f"  [NEW]  Team: [{tag}] {name} ({region})" + (" (dry)" if dry_run else f" id={team.id}"))
            stats["teams_created"] += 1

        if dry_run:
            continue

        # 2. TeamMember
        for api_name in api_names:
            pname = display_name(api_name)
            person = db.query(Person).filter(Person.display_name == pname).first()
            if not person:
                print(f"         ⚠  Person não encontrado: {pname} (api: {api_name})")
                stats["persons_missing"].append(pname)
                continue

            existing = db.query(TeamMember).filter(
                TeamMember.team_id == team.id,
                TeamMember.person_id == person.id,
                TeamMember.left_at.is_(None),
            ).first()
            if existing:
                print(f"         [SKIP] Membro já existe: {pname}")
                stats["members_skipped"] += 1
            else:
                db.add(TeamMember(team_id=team.id, person_id=person.id))
                print(f"         [ADD]  {pname}")
                stats["members_added"] += 1

    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN ===\n")

    db = SessionLocal()
    try:
        all_teams = PEC_TEAMS_RAW + PAS_TEAMS_RAW
        print(f"\n{'━'*60}")
        print(f"  {len(all_teams)} times  |  PEC={len(PEC_TEAMS_RAW)}  PAS={len(PAS_TEAMS_RAW)}")
        print(f"{'━'*60}\n")

        stats = seed(db, all_teams, args.dry_run)

        if not args.dry_run:
            db.commit()

        print(f"\n{'━'*60}")
        print(f"  Teams criados:    {stats['teams_created']}")
        print(f"  Teams skipados:   {stats['teams_skipped']}")
        print(f"  Membros adicionados: {stats['members_added']}")
        print(f"  Membros skipados:    {stats['members_skipped']}")
        if stats["persons_missing"]:
            print(f"  ⚠  Persons não encontrados ({len(stats['persons_missing'])}):")
            for p in stats["persons_missing"]:
                print(f"     - {p}")
        print(f"{'━'*60}")
        if not args.dry_run:
            print("  [OK] Commit realizado.")

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
