import requests, re, json

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

print("Baixando bundle...")
bundle = requests.get('https://twire.gg/static/js/2.498e6baa.chunk.js', headers=HEADERS, timeout=60).text
print(f"Tamanho: {len(bundle)}")

# Procura configuracao HttpLink do Apollo
http_link = re.findall(r'HttpLink.{0,300}', bundle)
for h in http_link[:3]:
    print("HttpLink:", h[:300])

# Procura uri: "..." patterns
uri_pat = re.findall(r'uri:"([^"]+)"', bundle)
print("\nuri configs:", uri_pat[:10])

# Procura qualquer URL https externa
ext_urls = re.findall(r'"(https://[a-zA-Z0-9.\-/]+)"', bundle)
unique_urls = list(set(ext_urls))
print("\nExternal URLs:", unique_urls[:30])

# Procura match relacionado a PUBG ID
match_id_refs = re.findall(r'.{0,50}pubgId.{0,50}', bundle)
print("\npubgId refs:", match_id_refs[:5])

match_id_refs2 = re.findall(r'.{0,50}matchId.{0,50}', bundle)
print("\nmatchId refs:", match_id_refs2[:5])

# Tenta GET no graphql com persisted query header
r = requests.get(
    'https://twire.gg/graphql',
    headers={**HEADERS, 'Accept': 'application/json'},
    params={'query': '{ __typename }'},
    timeout=10
)
print(f"\nGraphQL GET status: {r.status_code}")
print(f"Content-Type: {r.headers.get('Content-Type', '?')}")
print(f"Body: {r.text[:300]}")
