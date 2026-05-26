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

# 1. Descobre todos os campos da Query
print("=== Query fields ===")
schema = gql('''
{
  __type(name: "Query") {
    fields {
      name
      args { name type { name kind ofType { name kind } } }
      type { name kind ofType { name kind } }
    }
  }
}
''')
fields = schema.get('data', {}).get('__type', {}).get('fields', [])
for f in fields:
    args = ', '.join(f"{a['name']}:{a['type']['name'] or a['type']['ofType']['name']}" for a in f.get('args', []))
    print(f"  {f['name']}({args})")

print()

# 2. Tenta campos suspeitos para buscar match
for field in ['match', 'getMatch', 'matchById', 'matchByPubgId']:
    result = gql(f'{{ {field}(id: 1690130) {{ id }} }}')
    print(f"{field}: {result.get('errors', [{}])[0].get('message', 'OK') if 'errors' in result else str(result)[:100]}")
