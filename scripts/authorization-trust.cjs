'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {productionTrust}=require('../core/terminal-trust.cjs');
async function bundleTrust(stage){
 // Generated build metadata. Runtime trust comes from core/terminal-trust.cjs inside the app.
 await fs.writeFile(path.join(stage,'authorization-trust.json'),JSON.stringify(productionTrust(),null,2));
}
module.exports={bundleTrust};
