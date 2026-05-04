import requests, re, json

HEADERS_BASE = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/graphql',
    'Accept': 'application/json',
    'Origin': 'https://twire.gg',
    'Referer': 'https://twire.gg/',
}

ENDPOINTS = [
    'https://tjjkdyimqrb7jjnc6m5rpefjtu.appsync-api.eu-west-1.amazonaws.com/graphql',
    'https://qpyhfrkl6fhjjlqwvac3v23h7i.appsync-api.eu-west-1.amazonaws.com/graphql',
    'https://qu2qygng5zf4zbzt6j3wesx6fy.appsync-api.eu-west-1.amazonaws.com/graphql',
]

# Procura API keys no bundle
print("Procurando API keys no bundle...")
bundle = requests.get('https://twire.gg/static/js/main.702c2c94.chunk.js',
                       headers=HEADERS_BASE, timeout=30).text
api_keys = re.findall(r'["\']([a-zA-Z0-9/+]{20,60})["\']', bundle)
# API keys do AppSync geralmente tem ~40 chars e incluem letras+numeros+/+
appsync_keys = [k for k in api_keys if len(k) > 30 and '/' in k or len(k) == 26]
print(f"Possiveis API keys: {appsync_keys[:5]}")

# Procura x-api-key header pattern
xapi = re.findall(r'x-api-key["\s:]+["\']([^"\']{10,60})["\']', bundle)
print(f"x-api-key values: {xapi[:5]}")

# Procura apiKey config
apikey_conf = re.findall(r'apiKey["\s:]+["\']([^"\']{10,60})["\']', bundle)
print(f"apiKey configs: {apikey_conf[:5]}")

print()

# Tenta query simples em cada endpoint, sem auth e com api key header
QUERY = json.dumps({'query': '{ __typename }'})

for ep in ENDPOINTS:
    print(f"--- {ep} ---")

    # Sem auth
    r = requests.post(ep, headers={**HEADERS_BASE, 'Content-Type': 'application/json'},
                      data=QUERY, timeout=10)
    print(f"  Sem auth: HTTP {r.status_code} -> {r.text[:200]}")

    # Com Content-Type application/graphql
    r2 = requests.post(ep, headers=HEADERS_BASE, data='{ __typename }', timeout=10)
    print(f"  GQL content-type: HTTP {r2.status_code} -> {r2.text[:200]}")
    print()
