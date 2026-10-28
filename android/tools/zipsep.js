const fs = require('fs');

const arc = process.argv[2];
if(!arc){ console.error('usage: zipsep.js <archive>'); process.exit(1); }
const zip = fs.readFileSync(arc);

let eocd = -1;
for(let i = zip.length - 22; i >= 0; i--){ if(zip.readUInt32LE(i) === 0x06054b50){ eocd = i; break; } }
if(eocd < 0){ console.error(arc + ': no end-of-central-directory record - not a zip'); process.exit(1); }
const cdOff = zip.readUInt32LE(eocd + 16);
const cdSize = zip.readUInt32LE(eocd + 12);

const BSLASH = 0x5c, SLASH = 0x2f;
let fixed = 0, names = [];

for(let p = cdOff; p < cdOff + cdSize; ){
  if(zip.readUInt32LE(p) !== 0x02014b50) break;
  const nl = zip.readUInt16LE(p + 28), el = zip.readUInt16LE(p + 30), cl = zip.readUInt16LE(p + 32);
  const lho = zip.readUInt32LE(p + 42);
  let hit = false;

  for(let i = p + 46; i < p + 46 + nl; i++){
    if(zip[i] === BSLASH){ zip[i] = SLASH; hit = true; }
  }
  if(hit){
    if(zip.readUInt32LE(lho) !== 0x04034b50){
      console.error('local header missing at ' + lho + ' - refusing to patch'); process.exit(1);
    }
    const lnl = zip.readUInt16LE(lho + 26);
    if(lnl !== nl){
      console.error('name length mismatch between headers - refusing to patch'); process.exit(1);
    }
    for(let i = lho + 30; i < lho + 30 + lnl; i++) if(zip[i] === BSLASH) zip[i] = SLASH;
    fixed++; names.push(zip.toString('latin1', p + 46, p + 46 + nl));
  }
  p += 46 + nl + el + cl;
}

if(fixed){
  fs.writeFileSync(arc, zip);
  console.log('zipsep: normalised ' + fixed + ' entry name(s) in ' + arc + '  [' + names.join(', ') + ']');
}else{
  console.log('zipsep: nothing to fix in ' + arc);
}
