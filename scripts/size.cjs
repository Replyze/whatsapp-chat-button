// Prints the built file's size (raw, gzip, brotli) and its SRI hash for the README's pinned tag.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const file = path.join(__dirname, '..', 'dist', 'whatsapp-chat-button.min.js');
const buf = fs.readFileSync(file);
const gzip = zlib.gzipSync(buf, { level: 9 }).length;
const brotli = zlib.brotliCompressSync(buf).length;
console.log(`dist/whatsapp-chat-button.min.js: ${buf.length} B raw, ${gzip} B gzip, ${brotli} B brotli`);
console.log('integrity="sha384-' + crypto.createHash('sha384').update(buf).digest('base64') + '"');
