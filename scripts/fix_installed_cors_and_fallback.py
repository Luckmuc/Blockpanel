import re, shutil, sys, datetime
from pathlib import Path
p = Path(r"C:\Users\Luckmucs HP\AppData\Local\Programs\Blockpanel\resources\backend\main.py")
if not p.exists():
    print('ERROR: not found', p)
    sys.exit(2)
backup = p.with_suffix(p.suffix + f".corsfix_bak_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}")
shutil.copy(p, backup)
print('Backup created:', backup)
s = p.read_text(encoding='utf-8')

# Replace the CORS + add_middleware block with a clean implementation
cors_block = '''# CORS origins based on network access setting
if NETWORK_ACCESS:
    origins = ["*"]  # Allow all origins for network access
    print("CORS: Network access enabled - allowing all origins")
else:
    origins = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:1105",
        "http://127.0.0.1:1105",
    ]
    print("CORS: Localhost only - restricted origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
'''

# Find region starting with 'CORS origins based on network access setting' up to the following 'app.include_router(server_control.router' or next 'app.include_router(' occurrence
m = re.search(r"# CORS origins[\s\S]*?app.add_middleware\([\s\S]*?\)\s*\n", s)
if m:
    s = s[:m.start()] + cors_block + s[m.end():]
    print('Replaced existing CORS block')
else:
    # Fallback: try to find 'app.add_middleware(' occurrence and replace a smaller region
    m2 = re.search(r"if NETWORK_ACCESS:[\s\S]*?app.add_middleware\([\s\S]*?\)\s*\n", s)
    if m2:
        s = s[:m2.start()] + cors_block + s[m2.end():]
        print('Replaced CORS block by alternate match')
    else:
        print('Could not locate CORS block to replace; aborting')
        sys.exit(3)

# Ensure a safe fallback serving root exists: if no "async def serve_fallback" present, insert before "if __name__ == \"__main__\":"
if 'async def serve_fallback' not in s:
    fallback = '''\n# Safe fallback when frontend not found\n@app.get('/')\nasync def serve_fallback():\n    return HTMLResponse('<h1>Blockpanel Backend</h1><p>Backend is running but frontend not found.</p><p>API is available at <a href="/docs">/docs</a></p>')\n\n@app.get('/{path:path}')\nasync def serve_fallback_catch_all(path: str = ''):\n    if path.startswith('api/'):\n        raise HTTPException(status_code=404, detail='API endpoint not found')\n    return HTMLResponse('<h1>Blockpanel Backend</h1><p>Backend is running but frontend not found.</p><p>API is available at <a href="/docs">/docs</a></p><p>Current working directory: ' + str(Path.cwd()) + '</p>')\n\n'''
    # insert before if __name__ == "__main__":
    s = re.sub(r"\nif __name__ == \"__main__\":", '\n' + fallback + '\nif __name__ == "__main__":', s, count=1)
    print('Inserted safe fallback block')
else:
    print('serve_fallback already present')

# Write changes
p.write_text(s, encoding='utf-8')
print('Wrote patched installed main.py')

# Syntax check
import py_compile
try:
    py_compile.compile(str(p), doraise=True)
    print('py_compile OK')
except py_compile.PyCompileError as e:
    print('py_compile failed:', e)
    sys.exit(4)

print('Done')
