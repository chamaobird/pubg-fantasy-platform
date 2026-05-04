import requests, json

ENDPOINTS = [
    'https://tjjkdyimqrb7jjnc6m5rpefjtu.appsync-api.eu-west-1.amazonaws.com/graphql',
    'https://qpyhfrkl6fhjjlqwvac3v23h7i.appsync-api.eu-west-1.amazonaws.com/graphql',
    'https://qu2qygng5zf4zbzt6j3wesx6fy.appsync-api.eu-west-1.amazonaws.com/graphql',
]
API_KEYS = [
    'da2-vqpq6wms5ndbvhl2r7kvzbpmfi',
    'da2-76ksxkwekrcm5bn4divdkgspoi',
]

INTROSPECT = json.dumps({'query': '{ __schema { queryType { name } types { name } } }'})

# Primeiro descobre qual endpoint+key funciona
working = []
for ep in ENDPOINTS:
    for key in API_KEYS:
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'Origin': 'https://twire.gg',
        }
        r = requests.post(ep, headers=headers, data=INTROSPECT, timeout=10)
        status = r.status_code
        preview = r.text[:120]
        print(f"HTTP {status}  key={key[:15]}...  {ep.split('.')[0].split('/')[-1]}")
        if status == 200 and 'data' in r.text:
            working.append((ep, key, r.json()))
            print(f"  *** FUNCIONOU! ***")
        else:
            print(f"  -> {preview}")
        print()

# Se achou algo funcionando, faz a query real
if working:
    ep, key, schema = working[0]
    headers = {'Content-Type': 'application/json', 'x-api-key': key, 'Origin': 'https://twire.gg'}

    types = [t['name'] for t in schema['data']['__schema']['types'] if not t['name'].startswith('__')]
    print(f"\nSchema types: {types}")

    # Tenta buscar match pelo ID interno do Twire
    match_query = json.dumps({
        'query': '''
        {
          getMatch(id: 1690130) {
            id
            pubgMatchId
            startDate
            map
          }
        }
        '''
    })
    r2 = requests.post(ep, headers=headers, data=match_query, timeout=10)
    print(f"\ngetMatch query: HTTP {r2.status_code}")
    print(r2.text[:500])
