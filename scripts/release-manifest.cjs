'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
async function writeManifest(release,version,revision){
 const files=(await fs.readdir(release)).filter(name=>name.endsWith('.exe')||name.endsWith('.blockmap')).sort();
 const artifacts=[];for(const name of files){const bytes=await fs.readFile(path.join(release,name));artifacts.push({name,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
 await fs.writeFile(path.join(release,'SHA256SUMS.txt'),artifacts.map(file=>file.sha256+'  '+file.name).join('\n')+'\n');
 await fs.writeFile(path.join(release,'release-info.json'),JSON.stringify({version,revision,platform:'win32-x64',signed:false,artifacts},null,2)+'\n');return artifacts;
}
module.exports={writeManifest};
