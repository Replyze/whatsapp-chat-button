// Checks that run in CI next to the browser tests:
//   - the built file stays under the size budget, and the README states its real gzip size;
//   - one version everywhere: package.json, the banner and `version` in src/ and dist/,
//     and the README's pinned tag and API table.
//   npm run check
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const BUDGET = 5 * 1024; // bytes, gzip

const problems = [];
const check = (ok, message) => ok || problems.push(message);

const dist = fs.readFileSync(path.join(ROOT, 'dist', 'whatsapp-chat-button.min.js'));
const gzip = zlib.gzipSync(dist, { level: 9 }).length;
const kb = (gzip / 1024).toFixed(1);
console.log(`dist/whatsapp-chat-button.min.js: ${dist.length} B raw, ${gzip} B gzip (${kb} KB), budget ${BUDGET} B gzip`);
check(gzip <= BUDGET, `gzip size ${gzip} B is over the ${BUDGET} B budget`);

const readme = read('README.md');
const claims = [...readme.matchAll(/(\d+(?:\.\d+)?) KB gzipped/g)].map((m) => m[1]);
check(claims.length > 0, 'README: no "N KB gzipped" size found');
claims.forEach((claim) => check(claim === kb, `README says ${claim} KB gzipped, the file is ${kb} KB: update the README`));

const version = require(path.join(ROOT, 'package.json')).version;
const src = read('src/whatsapp-chat-button.js');
const min = dist.toString('utf8');
const found = {
  'src/ banner': (src.match(/^\/\*! whatsapp-chat-button v(\S+) /) || [])[1],
  'src/ version': (src.match(/version: '([^']+)'/) || [])[1],
  'dist/ banner': (min.match(/^\/\*! whatsapp-chat-button v(\S+) /) || [])[1],
  'dist/ version': (min.match(/version:"([^"]+)"/) || [])[1],
  'README pinned tag': (readme.match(/whatsapp-chat-button@(\d+\.\d+\.\d+[^/]*)\/dist\//) || [])[1],
  'README API table': (readme.match(/`WhatsAppChatButton\.version` \| `"([^"]+)"`/) || [])[1],
};
for (const [where, v] of Object.entries(found)) {
  check(v === version, `${where} is ${v === undefined ? 'missing' : v}, package.json is ${version}`);
}

if (problems.length) {
  console.error('\n' + problems.map((p) => 'FAIL  ' + p).join('\n'));
  process.exit(1);
}
console.log(`version ${version} everywhere; size OK`);
