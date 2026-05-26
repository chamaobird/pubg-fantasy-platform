import requests, json

EP  = 'https://tjjkdyimqrb7jjnc6m5rpefjtu.appsync-api.eu-west-1.amazonaws.com/graphql'
KEY = 'da2-vqpq6wms5ndbvhl2r7kvzbpmfi'
HDR = {'Content-Type': 'application/json', 'x-api-key': KEY, 'Origin': 'https://twire.gg'}

def gql(query, variables=None):
    payload = {'query': query}
    if variables:
        payload['variables'] = variables
    r = requests.post(EP, headers=HDR, json=payload, timeout=15)
    return r.json()

# Descobre campos do tipo Match
print("=== Match type fields ===")
match_type = gql('{ __type(name: "Match") { fields { name type { name kind ofType { name } } } } }')
fields = match_type.get('data', {}).get('__type', {}).get('fields', [])
for f in fields:
    print(f"  {f['name']}: {f['type']['name'] or f['type']['ofType']['name'] if f['type']['ofType'] else '?'}")

print()

# Busca os 5 matches do PAS D1 pelo ID interno do Twire
twire_ids = [1690130, 1690131, 1690134, 1690139, 1690142]
print("=== matchById para PAS D1 ===")
for tid in twire_ids:
    result = gql('''
    query GetMatch($id: String!, $game: String!) {
      matchById(id: $id, game: $game) {
        id
        shardInfo
        startDate
        map
        teams { id name }
      }
    }
    ''', {'id': str(tid), 'game': 'pubg'})

    if 'errors' in result:
        print(f"  {tid}: ERRO -> {result['errors'][0]['message']}")
    else:
        m = result.get('data', {}).get('matchById')
        if m:
            print(f"  {tid}: shardInfo={m.get('shardInfo')}  date={m.get('startDate')}  map={m.get('map')}")
        else:
            print(f"  {tid}: null")

print()

# Busca matches recentes do torneio PAS (id=2513)
print("=== getLastestMatches PAS (tournamentId=2513) ===")
latest = gql('''
{
  getLastestMatches(game: "pubg", tournamentId: 2513, page: 1) {
    id
    shardInfo
    startDate
    map
  }
}
''')
if 'errors' in latest:
    print("ERRO:", latest['errors'])
else:
    matches = latest.get('data', {}).get('getLastestMatches', [])
    print(f"Total: {len(matches)}")
    for m in matches[:15]:
        print(f"  id={m.get('id')}  shardInfo={m.get('shardInfo')}  date={m.get('startDate')}  map={m.get('map')}")

print()

# Busca matches recentes do torneio PEC (id=2512)
print("=== getLastestMatches PEC (tournamentId=2512) ===")
latest_pec = gql('''
{
  getLastestMatches(game: "pubg", tournamentId: 2512, page: 1) {
    id
    shardInfo
    startDate
    map
  }
}
''')
if 'errors' in latest_pec:
    print("ERRO:", latest_pec['errors'])
else:
    matches_pec = latest_pec.get('data', {}).get('getLastestMatches', [])
    print(f"Total: {len(matches_pec)}")
    for m in matches_pec[:15]:
        print(f"  id={m.get('id')}  shardInfo={m.get('shardInfo')}  date={m.get('startDate')}  map={m.get('map')}")
