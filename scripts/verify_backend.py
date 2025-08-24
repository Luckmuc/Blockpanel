import sys, requests, json

def verify(host='127.0.0.1', port=1105):
    base = f'http://{host}:{port}'
    tests = [
        ('GET /', '/'),
        ('GET /docs', '/docs'),
        ('GET /openapi.json', '/openapi.json'),
        ('GET /assets/index-BieOIPGB.js', '/assets/index-BieOIPGB.js'),
        ('GET /some/random/path', '/some/random/path')
    ]
    ok = True
    for name, path in tests:
        try:
            r = requests.get(base + path, timeout=5)
            print(f"{name}: {r.status_code}")
            if r.status_code >= 400:
                ok = False
        except Exception as e:
            print(f"{name} failed: {e}")
            ok = False
    return 0 if ok else 2

if __name__ == '__main__':
    sys.exit(verify())
