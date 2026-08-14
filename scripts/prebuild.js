/**
 * Prebuild: ensure public/index.html carries the __BUILD_TIME__ placeholder
 * so next.config.js can stamp it with a fresh build timestamp.
 *
 * The committed (git) version is the canonical source with the placeholder.
 * After each build the working copy contains the stamped time; this script
 * restores the placeholder before the next build.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const homepage = path.join(__dirname, '..', 'public', 'index.html');
const PLACEHOLDER = '__BUILD_TIME__';

if (!fs.existsSync(homepage)) process.exit(0);

const current = fs.readFileSync(homepage, 'utf-8');
if (current.includes(PLACEHOLDER)) {
  console.log('ℹ prebuild: placeholder already present, nothing to do');
  process.exit(0);
}

try {
  const pristine = execSync('git show HEAD:public/index.html', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore'],
    cwd: path.join(__dirname, '..'),
  });
  if (pristine.includes(PLACEHOLDER)) {
    fs.writeFileSync(homepage, pristine, 'utf-8');
    console.log('✓ prebuild: restored public/index.html placeholder from git');
  } else {
    console.log('⚠ prebuild: git version has no placeholder — commit the placeholder version');
  }
} catch {
  console.log('⚠ prebuild: git unavailable, leaving public/index.html as-is');
}
