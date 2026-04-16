"""
find_pas_matches.py
───────────────────
Encontra partidas custom da PAS no shard Steam comparando os matches
recentes dos jogadores do roster com os que aparecem em múltiplos jogadores.

Estratégia:
  1. Carrega do banco todos os jogadores do roster da stage com account_id válido
  2. Para cada jogador, busca os últimos matches via PUBG API
  3. Conta sobreposição: match_id que aparece em N+ jogadores → candidato PAS
  4. Para cada candidato, busca o match completo e exibe todos os participantes
  5. Cruza participantes com o banco → identifica aliases novos/desconhecidos

Pré-requisitos:
  pip install requests python-dotenv sqlalchemy psycopg2-binary

Variáveis de ambiente necessárias (.env ou shell):
  PUBG_API_KEY=...
  DATABASE_URL=postgresql://...

Uso básico:
  python find_pas_matches.py --stage-id 15

Com filtro de data (recomendado no dia do evento):
  python find_pas_matches.py --stage-id 15 --date 2026-04-17

Polling automático (roda a cada N minutos):
  python find_pas_matches.py --stage-id 15 --date 2026-04-17 --watch 5

Ajustar overlap mínimo (padrão: 5 jogadores):
  python find_pas_matches.py --stage-id 15 --date 2026-04-17 --min-overlap 8
"""

import argparse
import json
import os
import sys
import time
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import requests
    from dotenv import load_dotenv
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
except ImportError:
    sys.exit("pip install requests python-dotenv sqlalchemy psycopg2-binary")

# ── Config ─────────────────────────────────────────────────────────────────────

load_dotenv()

API_KEY      = os.getenv("PUBG_API_KEY") or os.getenv("PUBG_API_TOKEN") or os.getenv("PUBG_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")

if not API_KEY:
    sys.exit("❌  PUBG_API_KEY não encontrada. Defina no .env ou no shell.")
if not DATABASE_URL:
    sys.exit("❌  DATABASE_URL não encontrada. Defina no .env ou no shell.")

BASE_URL = "https://api.pubg.com"
HEADERS  = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept":        "application/vnd.api+json",
}

engine = create_engine(DATABASE_URL)

# ── PUBG API helpers ───────────────────────────────────────────────────────────

_last_request_at = 0.0

def _throttle():
    """Garante no mínimo 0.7s entre requests (respeita ~10 req/min do plano free)."""
    global _last_request_at
    elapsed = time.time() - _last_request_at
    if elapsed < 0.7:
        time.sleep(0.7 - elapsed)
    _last_request_at = time.time()


def api_get(url: str, params: dict = None) -> dict:
    """GET com rate limit e retry em 429."""
    _throttle()
    resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
    if resp.status_code == 429:
        print("  ⏳ Rate limit — aguardando 10s...")
        time.sleep(10)
        resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def get_player_matches(account_id: str, shard: str) -> list[str]:
    """Retorna lista de match IDs recentes de um jogador (até 14)."""
    url = f"{BASE_URL}/shards/{shard}/players/{account_id}"
    try:
        data = api_get(url)
        rels = data.get("data", {}).get("relationships", {}).get("matches", {}).get("data", [])
        return [m["id"] for m in rels]
    except requests.HTTPError as e:
        if e.response.status_code == 404:
            return []   # jogador não encontrado no shard
        raise


def get_match_details(match_id: str, shard: str) -> dict | None:
    """Busca dados completos de uma partida."""
    url = f"{BASE_URL}/shards/{shard}/matches/{match_id}"
    try:
        return api_get(url)
    except requests.HTTPError as e:
        if e.response.status_code == 404:
            return None
        raise


# ── DB helpers ─────────────────────────────────────────────────────────────────

def load_roster(session: Session, stage_id: int) -> list[dict]:
    """
    Retorna todos os jogadores do roster da stage com account_id válido.
    Exclui PENDING_* e None.
    """
    rows = session.execute(
        text("""
            SELECT
                p.id          AS person_id,
                p.display_name,
                r.team_name,
                r.fantasy_cost,
                pa.id         AS pa_id,
                pa.alias,
                pa.account_id,
                pa.shard
            FROM roster r
            JOIN person p ON p.id = r.person_id
            LEFT JOIN player_account pa ON pa.person_id = p.id
                AND pa.active_until IS NULL
            WHERE r.stage_id = :s
            ORDER BY r.team_name, p.display_name
        """),
        {"s": stage_id},
    ).fetchall()

    players = []
    for row in rows:
        acc = row.account_id
        if not acc or acc.upper().startswith("PENDING"):
            continue
        players.append({
            "person_id":    row.person_id,
            "display_name": row.display_name,
            "team_name":    row.team_name,
            "alias":        row.alias,
            "account_id":   acc,
            "shard":        row.shard,
        })
    return players


def lookup_account_id(session: Session, account_id: str) -> dict | None:
    """Dado um account_id, tenta encontrar o Person correspondente no banco."""
    row = session.execute(
        text("""
            SELECT p.id, p.display_name, pa.alias, pa.account_id
            FROM player_account pa
            JOIN person p ON p.id = pa.person_id
            WHERE pa.account_id = :aid
            LIMIT 1
        """),
        {"aid": account_id},
    ).fetchone()
    if row:
        return {"person_id": row.id, "display_name": row.display_name, "alias": row.alias}
    return None


# ── Match parsing ──────────────────────────────────────────────────────────────

def parse_match(data: dict) -> dict:
    """Extrai atributos e lista de participantes de um objeto match da API."""
    attrs     = data.get("data", {}).get("attributes", {})
    included  = data.get("included", [])

    participants = []
    for item in included:
        if item.get("type") != "participant":
            continue
        p_attrs = item.get("attributes", {}).get("stats", {})
        participants.append({
            "name":       p_attrs.get("name", "?"),
            "account_id": p_attrs.get("playerId", ""),
            "kills":      p_attrs.get("kills", 0),
            "damage":     round(p_attrs.get("damageDealt", 0), 1),
            "placement":  p_attrs.get("winPlace", 0),
        })

    return {
        "created_at": attrs.get("createdAt", ""),
        "match_type": attrs.get("matchType", ""),
        "map":        attrs.get("mapName", ""),
        "duration":   attrs.get("duration", 0),
        "participants": sorted(participants, key=lambda x: x["placement"]),
    }


def fmt_date(iso: str) -> str:
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d/%m %H:%M UTC")
    except Exception:
        return iso


def in_date_window(iso: str, date_str: str, window_hours: int = 6) -> bool:
    """Verifica se a partida ocorreu dentro da janela de data configurada."""
    if not date_str:
        return True
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        match_dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        start = target - timedelta(hours=2)
        end   = target + timedelta(hours=window_hours)
        return start <= match_dt <= end
    except Exception:
        return True


# ── Core logic ─────────────────────────────────────────────────────────────────

def find_candidates(
    roster: list[dict],
    shard: str,
    date_filter: str | None,
    min_overlap: int,
    window_hours: int,
) -> list[dict]:
    """
    Coleta match IDs recentes de cada jogador, detecta sobreposições
    e retorna matches candidatos ordenados por número de jogadores do roster.
    """
    print(f"\n[1/3] Coletando matches recentes de {len(roster)} jogadores no shard '{shard}'...")

    match_counter  = Counter()   # match_id → contagem de jogadores do roster
    match_players  = {}          # match_id → lista de jogadores do roster presentes
    skipped        = []

    for i, player in enumerate(roster, 1):
        name = player["display_name"]
        acc  = player["account_id"]
        print(f"  [{i:02d}/{len(roster)}] {name:<22} {acc}")

        match_ids = get_player_matches(acc, shard)
        if not match_ids:
            skipped.append(name)
            print(f"           ↳ nenhum match encontrado (conta inativa no shard?)")
            continue

        for mid in match_ids:
            match_counter[mid] += 1
            if mid not in match_players:
                match_players[mid] = []
            match_players[mid].append(name)

    if skipped:
        print(f"\n  ⚠️  Jogadores sem matches encontrados: {', '.join(skipped)}")

    # Filtra candidatos com overlap suficiente
    candidates_raw = [
        (mid, count)
        for mid, count in match_counter.items()
        if count >= min_overlap
    ]
    candidates_raw.sort(key=lambda x: -x[1])

    print(f"\n  Matches com ≥{min_overlap} jogadores do roster: {len(candidates_raw)}")

    # Se tiver filtro de data, vai buscar cada match para verificar a data
    candidates = []
    if date_filter and candidates_raw:
        print(f"\n[2/3] Filtrando por data '{date_filter}' (janela ±{window_hours}h)...")
        for mid, count in candidates_raw:
            details = get_match_details(mid, shard)
            if not details:
                continue
            parsed = parse_match(details)
            if not in_date_window(parsed["created_at"], date_filter, window_hours):
                continue
            candidates.append({
                "match_id":      mid,
                "overlap":       count,
                "roster_names":  match_players[mid],
                "details":       details,
                "parsed":        parsed,
            })
        print(f"  Candidatos após filtro de data: {len(candidates)}")
    else:
        print(f"\n[2/3] Sem filtro de data — usando todos os {len(candidates_raw)} candidatos.")
        for mid, count in candidates_raw:
            candidates.append({
                "match_id":      mid,
                "overlap":       count,
                "roster_names":  match_players[mid],
                "details":       None,
                "parsed":        None,
            })

    return candidates


def print_match_report(candidate: dict, session: Session):
    """Imprime relatório detalhado de um match candidato."""
    parsed = candidate["parsed"]
    mid    = candidate["match_id"]

    if not parsed:
        # Busca os detalhes agora se ainda não foram buscados
        details = get_match_details(mid, "steam")
        if not details:
            print(f"  ❌ Não foi possível buscar detalhes de {mid}")
            return
        candidate["details"] = details
        parsed = parse_match(details)
        candidate["parsed"] = parsed

    overlap  = candidate["overlap"]
    roster_n = candidate["roster_names"]

    print(f"\n{'═'*70}")
    print(f"  MATCH: {mid}")
    print(f"  Data:  {fmt_date(parsed['created_at'])}")
    print(f"  Tipo:  {parsed['match_type']}  |  Mapa: {parsed['map']}  |  Duração: {parsed['duration']//60}min")
    print(f"  Jogadores do roster presentes: {overlap} ({', '.join(roster_n)})")
    print(f"{'─'*70}")
    print(f"  {'Placement':<5} {'Nome Steam':<24} {'Account ID':<36} {'Kills':>5} {'Dano':>7} {'DB?'}")
    print(f"  {'─'*5} {'─'*24} {'─'*36} {'─'*5} {'─'*7} {'─'*20}")

    unknown_aliases = []

    for p in parsed["participants"]:
        db_info = lookup_account_id(session, p["account_id"]) if p["account_id"] else None
        if db_info:
            db_label = f"✅ {db_info['display_name']}"
        else:
            db_label = "❓ desconhecido"
            unknown_aliases.append(p)

        print(
            f"  #{p['placement']:<4} {p['name']:<24} {p['account_id']:<36} "
            f"{p['kills']:>5} {p['damage']:>7.1f} {db_label}"
        )

    if unknown_aliases:
        print(f"\n  ⚠️  {len(unknown_aliases)} participantes NÃO encontrados no banco:")
        for p in unknown_aliases:
            print(f"     nome={p['name']:<24}  account_id={p['account_id']}")
    else:
        print(f"\n  ✅ Todos os participantes já estão mapeados no banco.")

    print(f"{'═'*70}")


def save_results(candidates: list[dict], output_path: Path):
    """Salva resultados em JSON para referência futura."""
    output = []
    for c in candidates:
        parsed = c.get("parsed") or {}
        output.append({
            "match_id":       c["match_id"],
            "overlap":        c["overlap"],
            "roster_players": c["roster_names"],
            "created_at":     parsed.get("created_at", ""),
            "match_type":     parsed.get("match_type", ""),
            "map":            parsed.get("map", ""),
            "duration_min":   parsed.get("duration", 0) // 60,
            "participants":   parsed.get("participants", []),
        })
    output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\n  💾 Resultados salvos em: {output_path.resolve()}")


# ── Main ───────────────────────────────────────────────────────────────────────

def run(args):
    shard = args.shard

    with Session(engine) as session:
        roster = load_roster(session, args.stage_id)
        if not roster:
            sys.exit(f"❌  Nenhum jogador com account_id válido no roster da stage {args.stage_id}")

        print(f"\n  Roster stage {args.stage_id}: {len(roster)} jogadores com account_id válido")
        for p in roster:
            print(f"    {p['display_name']:<22} {p['team_name']:<25} {p['account_id']}")

        candidates = find_candidates(
            roster       = roster,
            shard        = shard,
            date_filter  = args.date,
            min_overlap  = args.min_overlap,
            window_hours = args.window_hours,
        )

        if not candidates:
            print(f"\n  ℹ️  Nenhum match candidato encontrado.")
            print(f"     Dicas:")
            print(f"       - Verifique se a partida já terminou (delay de 2-10 min após fim)")
            print(f"       - Tente --shard steam ou --shard pc-na")
            print(f"       - Reduza --min-overlap (atual: {args.min_overlap})")
            print(f"       - Amplie --window-hours (atual: {args.window_hours})")
            return

        print(f"\n[3/3] Relatório dos {len(candidates)} match(es) candidato(s):")

        for c in candidates:
            print_match_report(c, session)

        output_path = Path(f"pas_matches_stage{args.stage_id}_{args.date or 'all'}.json")
        save_results(candidates, output_path)


def main():
    parser = argparse.ArgumentParser(
        description="Encontra partidas PAS na PUBG API por sobreposição de jogadores do roster",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--stage-id",     type=int,   default=15,      help="ID da stage no banco (default: 15)")
    parser.add_argument("--shard",        type=str,   default="steam",  help="Shard PUBG (default: steam)")
    parser.add_argument("--date",         type=str,   default=None,     help="Data do evento (YYYY-MM-DD) para filtrar")
    parser.add_argument("--min-overlap",  type=int,   default=5,        help="Mínimo de jogadores do roster no mesmo match (default: 5)")
    parser.add_argument("--window-hours", type=int,   default=6,        help="Janela de horas em torno da data (default: 6)")
    parser.add_argument("--watch",        type=int,   default=0,        help="Polling: roda a cada N minutos até encontrar candidatos (0 = desabilitado)")

    args = parser.parse_args()

    if args.watch > 0:
        print(f"\n  🔄 Modo watch: verificando a cada {args.watch} minuto(s).")
        print(f"     Pressione Ctrl+C para parar.\n")
        run_count = 0
        while True:
            run_count += 1
            now = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
            print(f"\n{'─'*70}")
            print(f"  Verificação #{run_count} — {now}")
            print(f"{'─'*70}")
            run(args)
            print(f"\n  ⏳ Próxima verificação em {args.watch} min(s)... (Ctrl+C para sair)")
            time.sleep(args.watch * 60)
    else:
        run(args)


if __name__ == "__main__":
    main()
