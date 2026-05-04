import requests, re

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

# AppSync URLs tem formato: https://XXXXX.appsync-api.REGION.amazonaws.com/graphql
# Podem estar no bundle principal ou num chunk separado

# Pega o HTML para ver todos os chunks
html = requests.get('https://twire.gg/', headers=HEADERS, timeout=15).text
chunks = re.findall(r'src="(/static/js/[^"]+\.js)"', html)
print(f"Chunks encontrados: {chunks}")

for chunk_path in chunks:
    url = 'https://twire.gg' + chunk_path
    print(f"\nAnalisando: {chunk_path}")
    r = requests.get(url, headers=HEADERS, timeout=60)
    content = r.text

    # AppSync endpoints
    appsync = re.findall(r'https://[a-z0-9]+\.appsync-api\.[a-z0-9\-]+\.amazonaws\.com[^"\'\\s]*', content)
    print(f"  AppSync URLs: {appsync[:5]}")

    # Cognito pool IDs
    cognito = re.findall(r'[a-z]{2}-[a-z]+-[0-9]_[A-Za-z0-9]+', content)
    print(f"  Cognito pools: {list(set(cognito))[:5]}")

    # Qualquer amazonaws.com
    aws = re.findall(r'https://[^"\'\\s]+amazonaws\.com[^"\'\\s]*', content)
    print(f"  AWS URLs: {list(set(aws))[:5]}")

    # Procura variaveis de ambiente embeddadas (REACT_APP_*)
    env_embedded = re.findall(r'REACT_APP_[A-Z_]+["\s:]+["\']([^"\']{5,100})["\']', content)
    print(f"  REACT_APP vars: {env_embedded[:5]}")
