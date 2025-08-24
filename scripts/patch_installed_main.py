import re
import shutil
import sys
import datetime
from pathlib import Path

# Installed main.py path
p = Path(r"C:\Users\Luckmucs HP\AppData\Local\Programs\Blockpanel\resources\backend\main.py")
if not p.exists():
    print("ERROR: file not found:", p)
    sys.exit(2)

# Backup
backup = p.with_suffix(p.suffix + f".bak_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}")
shutil.copy(p, backup)
print('Backup created:', backup)

s = p.read_text(encoding='utf-8')

# Fix oauth newline typo (oauth\n2_scheme)
s = re.sub(r"oauth\s*\r?\n\s*2_scheme", "oauth2_scheme", s)

# Replace entire 'else: ... if __name__ == "__main__":' fallback block with a safe, minimal block
# This matches from a line starting with 'else:' (possibly indented) up to the next 'if __name__ == "__main__":' and replaces it.
fallback_pattern = re.compile(r"else:\s*[\s\S]*?\nif __name__ == \"__main__\":", re.MULTILINE)
fallback_replacement = (
    "else:\n"
    "    print('Frontend not found - serving fallback')\n"
    "    print('Checked paths:')\n"
    "    for p in frontend_dist_paths:\n"
    "        print(f\"  {p} - exists: {p.exists()}, has index.html: {(p / 'index.html').exists() if p.exists() else False}\")\n"
    "\n"
    "    @app.get('/')\n"
    "    async def serve_fallback():\n"
    "        return HTMLResponse('<h1>Blockpanel Backend</h1><p>Backend is running but frontend not found.</p><p>API is available at <a href=\"/docs\">/docs</a></p>')\n"
    "\n"
    "    @app.get('/{path:path}')\n"
    "    async def serve_fallback_catch_all(path: str = ''):\n"
    "        if path.startswith('api/'):\n"
    "            raise HTTPException(status_code=404, detail='API endpoint not found')\n"
    "        return HTMLResponse('<h1>Blockpanel Backend</h1><p>Backend is running but frontend not found.</p><p>API is available at <a href=\"/docs\">/docs</a></p><p>Current working directory: ' + str(Path.cwd()) + '</p>')\n\n"
    "if __name__ == \"__main__\":"
)

new_s, nsub = fallback_pattern.subn(fallback_replacement, s, count=1)
if nsub == 0:
    print('No fallback block matched; no replacement performed')
else:
    p.write_text(new_s, encoding='utf-8')
    print('Patched file written (replaced fallback block)')

# Try compile to verify syntax
import py_compile
try:
    py_compile.compile(str(p), doraise=True)
    print('py_compile OK')
    sys.exit(0)
except py_compile.PyCompileError as e:
    print('py_compile failed:', e)
    sys.exit(3)
