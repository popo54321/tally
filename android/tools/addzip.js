const fs = require('fs'), path = require('path');

const [,, arc, src, asName] = process.argv;
if(!arc || !src){ console.error('usage: addzip.js <archive> <file> [name]'); process.exit(1); }
const name = asName || path.basename(src);
const zip = fs.readFileSync(arc), data = fs.readFileSync(src);

let eocd = -1;
for(let i = zip.length - 22; i >= 0; i--){ if(zip.readUInt32LE(i) === 0x06054b50){ eocd = i; break; } }
if(eocd < 0){ console.error(arc + ': no end-of-central-directory record - not a zip'); process.exit(1); }
const nEnt = zip.readUInt16LE(eocd + 10);
const cdSize = zip.readUInt32LE(eocd + 12);
const cdOff = zip.readUInt32LE(eocd + 16);
const cd = zip.subarray(cdOff, cdOff + cdSize);

for(let p = 0; p < cd.length; ){
  if(cd.readUInt32LE(p) !== 0x02014b50) break;
  const nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32);
  if(cd.toString('latin1', p + 46, p + 46 + nl) === name){
    console.error(name + ' is already in ' + arc); process.exit(1);
  }
  p += 46 + nl + el + cl;
}

const TBL = (() => { const t = new Uint32Array(256);
  for(let n = 0; n < 256; n++){ let c = n;
    for(let k = 0; k < 8; k++) c = (c & 1) ? ((0xEDB88320 ^ (c >>> 1)) >>> 0) : (c >>> 1);
    t[n] = c >>> 0; }
  return t; })();
let crc = 0xFFFFFFFF;
for(let i = 0; i < data.length; i++) crc = ((crc >>> 8) ^ TBL[(crc ^ data[i]) & 0xFF]) >>> 0;
crc = (crc ^ 0xFFFFFFFF) >>> 0;

const nb = Buffer.from(name, 'latin1');
const DOS_DATE = 0x21;

const lfh = Buffer.alloc(30);
lfh.writeUInt32LE(0x04034b50, 0);
lfh.writeUInt16LE(20, 4);
lfh.writeUInt16LE(0, 6);
lfh.writeUInt16LE(0, 8);
lfh.writeUInt16LE(0, 10); lfh.writeUInt16LE(DOS_DATE, 12);
lfh.writeUInt32LE(crc, 14);
lfh.writeUInt32LE(data.length, 18);
lfh.writeUInt32LE(data.length, 22);
lfh.writeUInt16LE(nb.length, 26); lfh.writeUInt16LE(0, 28);

const cdh = Buffer.alloc(46);
cdh.writeUInt32LE(0x02014b50, 0);
cdh.writeUInt16LE(20, 4); cdh.writeUInt16LE(20, 6);
cdh.writeUInt16LE(0, 8); cdh.writeUInt16LE(0, 10);
cdh.writeUInt16LE(0, 12); cdh.writeUInt16LE(DOS_DATE, 14);
cdh.writeUInt32LE(crc, 16);
cdh.writeUInt32LE(data.length, 20); cdh.writeUInt32LE(data.length, 24);
cdh.writeUInt16LE(nb.length, 28);
cdh.writeUInt16LE(0, 30); cdh.writeUInt16LE(0, 32);
cdh.writeUInt16LE(0, 34); cdh.writeUInt16LE(0, 36);
cdh.writeUInt32LE(0, 38);
cdh.writeUInt32LE(cdOff, 42);

const eo = Buffer.alloc(22);
eo.writeUInt32LE(0x06054b50, 0);
eo.writeUInt16LE(0, 4); eo.writeUInt16LE(0, 6);
eo.writeUInt16LE(nEnt + 1, 8); eo.writeUInt16LE(nEnt + 1, 10);
eo.writeUInt32LE(cdSize + cdh.length + nb.length, 12);
eo.writeUInt32LE(cdOff + lfh.length + nb.length + data.length, 16);
eo.writeUInt16LE(0, 20);

fs.writeFileSync(arc, Buffer.concat([
  zip.subarray(0, cdOff),
  lfh, nb, data,
  cd,
  cdh, nb,
  eo
]));
console.log('addzip: ' + name + ' -> ' + arc + '  (' + data.length + ' bytes, stored)');
