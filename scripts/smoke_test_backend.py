import subprocess
import time
import requests
import os

BASE = 'http://127.0.0.1:1105/api'

# Start backend in a subprocess using the project's venv python and uvicorn
# We'll try to find a python executable from the workspace venv or system
possible = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), '.venv', 'Scripts', 'python.exe'),
    'python', 'py'
]
python_exe = None
for p in possible:
    if os.path.exists(p):
        python_exe = p
        break

if python_exe is None:
    print('No python executable found for tests. Make sure venv is available.')
    exit(1)

print('Using python:', python_exe)

# Start uvicorn process
# Pass current environment to child so LOCALHOST_ONLY and other vars are respected
env = os.environ.copy()
backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
# When running with cwd set to backend, use main:app so imports like 'from auth import' work
proc = subprocess.Popen([python_exe, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '1105'], cwd=backend_dir, env=env)

# Wait for server to become ready
for i in range(30):
    try:
        r = requests.get('http://127.0.0.1:1105/')
        if r.status_code < 500:
            print('Server ready')
            # Best-effort cleanup of leftover test server to avoid conflicts from previous runs
            try:
                print('Cleaning up previous test server (if any)')
                dr = requests.delete('http://127.0.0.1:1105/api/server/delete', params={'servername': 'test-smoke'}, timeout=5)
                try:
                    print('Pre-clean delete status:', dr.status_code, dr.json() if dr.text else '')
                except Exception:
                    print('Pre-clean delete status:', dr.status_code)
            except Exception as e:
                print('Pre-clean delete request failed (continuing):', e)
            break
    except Exception:
        pass
    time.sleep(1)
else:
    print('Server did not start in time')
    proc.kill()
    exit(1)

endpoints = [
    ('GET', '/auth/status', {}),
    ('GET', '/server/list', {}),
    ('GET', '/server/ports/available', {}),
    # Create and initial start (DEV_MODE skips real start)
    ('POST', '/server/create_and_start', {'servername':'test-smoke','purpur_url':'https://api.purpurmc.org/v2/purpur/1.21.5/2450/download','ram':'1024','accept_eula':'true'}),
    # Check accept EULA endpoint
    ('POST', '/server/accept_eula', {'servername': 'test-smoke'}),
    # Note: start is redundant after create_and_start in DEV_MODE and can trigger unstable behavior in the test harness
    # ('POST', '/server/start?servername=test-smoke', {}),
    # Validate a specific port (use a port we saw allocated earlier)
    ('GET', '/server/ports/validate?port=25566', {}),
    # Delete server
    ('DELETE', '/server/delete', {'servername': 'test-smoke'}),
    # Stop server last to avoid shutting down the backend mid-run
    ('POST', '/server/stop?servername=test-smoke', {}),
]

# Check whether auth is required for this client (respecting LOCALHOST_ONLY etc.)
token = None
auth_required = True
try:
    r_status = requests.get('http://127.0.0.1:1105/api/auth/status', timeout=5)
    if r_status.ok:
        status_json = r_status.json()
        auth_required = status_json.get('auth_required', True)
        print('Auth status:', status_json)
    else:
        print('Could not get auth status, assuming auth required')
except Exception as e:
    print('Auth status request failed:', e)

# Only attempt login if auth is required. If auth is not required (localhost bypass), we'll skip login.
if auth_required:
    try:
        login_data = {'username': 'luckmuc', 'password': os.environ.get('BLOCKPANEL_TEST_PW', 'password')}
        r = requests.post('http://127.0.0.1:1105/api/login', data=login_data, timeout=10)
        if r.ok:
            token = r.json().get('access_token')
            print('Obtained token for tests')
        else:
            print('Login failed, will run unauthenticated tests (expected 401 for protected endpoints)')
    except Exception as e:
        print('Login request failed:', e)
else:
    print('Auth not required for this client; running unauthenticated requests')

results = []
failures = []
expected_status = {
    '/auth/status': 200,
    '/server/list': 200,
    '/server/ports/available': 200,
    '/server/create_and_start': 200,
}

for method, path, body in endpoints:
    url = BASE + path
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    # retry logic for transient connection errors
    max_attempts = 3
    attempt = 0
    last_exc = None
    while attempt < max_attempts:
        attempt += 1
        try:
            # choose sensible timeouts per request
            if method == 'GET':
                to = 10
            elif method == 'POST':
                # allow long timeout for create_and_start (jar download)
                if '/create_and_start' in path:
                    to = 300
                else:
                    to = 30
            elif method == 'DELETE':
                to = 30
            else:
                to = 30

            if method == 'GET':
                r = requests.get(url, headers=headers, timeout=to)
            elif method == 'POST':
                r = requests.post(url, data=body, headers=headers, timeout=to)
            elif method == 'DELETE':
                r = requests.delete(BASE + '/server/delete', params=body, headers=headers, timeout=to)
            else:
                results.append((method, path, 'SKIPPED', f'Unsupported method {method}'))
                r = None
            if r is None:
                break
            try:
                data = r.json()
            except Exception:
                data = r.text
            results.append((method, path, r.status_code, data))
            # Basic assertion
            exp = expected_status.get(path)
            if exp and r.status_code != exp:
                failures.append({'path': path, 'expected': exp, 'got': r.status_code, 'body': data})
            # If backend returned a server error, abort to avoid hanging subsequent requests
            if r.status_code >= 500:
                print(f"Fatal server error {r.status_code} for {path}, aborting tests")
                out = {
                    'results': [ {'method': m, 'path': p, 'status': s, 'data': d} for (m,p,s,d) in results ],
                    'failures': failures
                }
                with open(os.path.join(os.path.dirname(__file__), 'smoke_test_result.json'), 'w', encoding='utf-8') as f:
                    import json as _json
                    _json.dump(out, f, indent=2, ensure_ascii=False)
                try:
                    proc.kill()
                    proc.wait()
                except Exception:
                    pass
                exit(3)
            # success or handled response -> break retry loop
            break
        except KeyboardInterrupt as e:
            # Ensure we write partial results and stop backend on Ctrl+C
            print('KeyboardInterrupt received, writing partial results and exiting')
            failures.append({'path': path, 'error': 'KeyboardInterrupt'})
            results.append((method, path, 'ERROR', 'KeyboardInterrupt'))
            out = {
                'results': [ {'method': m, 'path': p, 'status': s, 'data': d} for (m,p,s,d) in results ],
                'failures': failures
            }
            with open(os.path.join(os.path.dirname(__file__), 'smoke_test_result.json'), 'w', encoding='utf-8') as f:
                import json as _json
                _json.dump(out, f, indent=2, ensure_ascii=False)
            try:
                proc.kill()
                proc.wait()
            except Exception:
                pass
            exit(3)
        except Exception as e:
            # catch other exceptions to ensure partial results are written
            last_exc = e
            print(f"Request attempt {attempt} failed for {path}: {e}")
            # if server appears down, abort the rest of the tests
            if attempt >= max_attempts:
                failures.append({'path': path, 'error': str(e)})
                results.append((method, path, 'ERROR', str(e)))
                print(f"Aborting tests: server not responding for {path}")
                # write partial results and exit with failure after cleanup
                out = {
                    'results': [ {'method': m, 'path': p, 'status': s, 'data': d} for (m,p,s,d) in results ],
                    'failures': failures
                }
                with open(os.path.join(os.path.dirname(__file__), 'smoke_test_result.json'), 'w', encoding='utf-8') as f:
                    import json as _json
                    _json.dump(out, f, indent=2, ensure_ascii=False)
                try:
                    proc.kill()
                    proc.wait()
                except Exception:
                    pass
                # if it was a keyboard interrupt, propagate non-zero code
                exit(3)
            time.sleep(1)

# Print results
for r in results:
    print(r)

# Write result JSON
out = {
    'results': [ {'method': m, 'path': p, 'status': s, 'data': d} for (m,p,s,d) in results ],
    'failures': failures
}
with open(os.path.join(os.path.dirname(__file__), 'smoke_test_result.json'), 'w', encoding='utf-8') as f:
    import json as _json
    _json.dump(out, f, indent=2, ensure_ascii=False)

if failures:
    print('Smoke test finished with failures:', failures)
    proc.kill()
    proc.wait()
    exit(2)

# Cleanup
proc.kill()
proc.wait()
print('Stopped backend')
