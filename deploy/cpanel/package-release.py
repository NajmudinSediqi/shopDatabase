"""Package an already successful local production build; never include local secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from datetime import date
import hashlib
import re

root = Path(__file__).resolve().parents[2]
assert (root / '.output/server/index.mjs').is_file(), 'Run npm run build first'
assert (root / '.output/nitro.json').is_file(), 'Incomplete Nitro build'
files = {}
for directory in ['.output', 'backend/src', 'backend/migrations', 'shared']:
    for path in (root / directory).rglob('*'):
        if path.is_file() and path.suffix not in ['.map', '.log']:
            files[path.relative_to(root).as_posix()] = path
for name in ['app.cjs', 'launcher.cjs', 'managed-service.cjs', 'app-workers.cjs', 'worker-service.cjs',
             'service-worker.cjs', 'package.json', '.env.example', 'README.md', 'RELEASE.md']:
    files[name] = root / 'deploy/cpanel' / name
files['backend/ai-assistant-instructions.md'] = root / 'backend/ai-assistant-instructions.md'

# Compare privately against sensitive values in local env files, never print values.
secrets = []
for env_path in [root / '.env', root / 'backend/.env']:
    if env_path.is_file():
        for line in env_path.read_text(encoding='utf-8-sig').splitlines():
            key, sep, value = line.partition('=')
            value = value.strip().strip('\"\'')
            if sep and re.search(r'(KEY|SECRET|PASSWORD|DATABASE_URL)', key) and len(value) >= 12:
                secrets.append(value.encode())
for name, path in files.items():
    parts = Path(name).parts
    assert '.env' not in parts and '.git' not in parts and 'test' not in parts, 'Excluded path'
    data = path.read_bytes()
    assert not any(secret in data for secret in secrets), 'Sensitive value detected; packaging refused'
    assert not re.search(rb'nvapi-[A-Za-z0-9_-]{30,}', data), 'API credential pattern detected'

output = root / f'output/noordb-cpanel-{date.today().isoformat()}.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for name, path in sorted(files.items()):
        archive.write(path, name)
with ZipFile(output) as archive:
    assert archive.testzip() is None, 'Corrupt archive'
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix('.zip.sha256').write_text(f'{digest}  {output.name}\n')
print(f'Created {output.name}: {len(files)} files, {output.stat().st_size:,} bytes; archive and secret checks passed')
print(f'SHA256 {digest}')
