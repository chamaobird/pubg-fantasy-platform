import requests, re, json

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, */*',
    'Referer': 'https://twire.gg/',
}

# Analisa o bundle maior (2.5MB - onde estava o /graphql)
bundle_url = 'https://twire.gg/static/js/2.498e6baa.chunk.js'
print(f'Baixando {bundle_url}...')
r = requests.get(bundle_url, headers=HEADERS, timeout=60)
content = r.text
print(f'Tamanho: {len(content)} chars')

# Todos os hosts externos
hosts = re.findall(r'"(https?://[a-z0-9.\-]+\.(?:gg|io|com|net))"', content)
print('\nHosts:', sorted(set(hosts)))

# Strings com graphql
gql = re.findall(r'"([^"]*graphql[^"]{0,80})"', content)
print('\nGraphQL strings:', list(set(gql))[:20])

# Apollo client config - procura uri ou endpoint
uri_matches = re.findall(r'(?:uri|endpoint|url)\s*:\s*"([^"]{5,100})"', content)
print('\nURI/endpoint configs:', list(set(uri_matches))[:20])

# Procura subdomains do twire
twire_subs = re.findall(r'"(https?://[a-z\-]+\.twire\.gg[^"]{0,80})"', content)
print('\nTwire subdomains:', sorted(set(twire_subs)))

# Procura pubgMatchId ou similar no schema
schema_refs = re.findall(r'"([^"]*(?:pubgMatch|matchId|match_id|pubg_id)[^"]{0,60})"', content)
print('\nSchema match refs:', list(set(schema_refs))[:20])

# Procura tournament query pattern
tournament_q = re.findall(r'tournament[^"]{0,200}match[^"]{0,100}', content[:100000])
print('\nTournament query snippets:', tournament_q[:3])
