import subprocess, sys, os

def get_token():
    out = subprocess.run(['reg', 'query', r'HKCU\Environment', '/v', 'CLOUDFLARE_API_TOKEN'],
                         capture_output=True, text=True).stdout
    for line in out.splitlines():
        if 'CLOUDFLARE_API_TOKEN' in line:
            return line.split()[-1]
    return None

tok = get_token()
if not tok:
    print("NO TOKEN FOUND"); sys.exit(1)

env = {**os.environ, 'CLOUDFLARE_API_TOKEN': tok}
r = subprocess.run('npm run deploy', shell=True, cwd=r'C:\Users\kcrex\news-site',
                   env=env, capture_output=True, text=True, timeout=900)
print(r.stdout[-2000:])
print(r.stderr[-2000:], file=sys.stderr)
sys.exit(r.returncode)
