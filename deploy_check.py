import subprocess, sys

def get_token():
    out = subprocess.run(['reg', 'query', r'HKCU\Environment', '/v', 'CLOUDFLARE_API_TOKEN'],
                         capture_output=True, text=True).stdout
    for line in out.splitlines():
        if 'CLOUDFLARE_API_TOKEN' in line:
            parts = line.split()
            return parts[-1]
    return None

tok = get_token()
if not tok:
    print("NO TOKEN FOUND"); sys.exit(1)
print(f"token length={len(tok)} starts={tok[:5]}... ends=...{tok[-3:]}", file=sys.stderr)

env = {**__import__('os').environ, 'CLOUDFLARE_API_TOKEN': tok}
import os
r = subprocess.run('npx wrangler whoami', shell=True, cwd=r'C:\Users\kcrex\news-site',
                   env=env, capture_output=True, text=True, timeout=120)
print(r.stdout[-800:])
print(r.stderr[-300:], file=sys.stderr)
sys.exit(r.returncode)
