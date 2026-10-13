'use strict';
const fs=require('node:fs/promises'),crypto=require('node:crypto');
const {endpoint}=require('./authorization.cjs');

// Public trust anchor only. The signing private key stays on the terminal server.
const TERMINAL_TRUST=Object.freeze({
 url:'https://sq.appgog.com',
 keyId:'63c206204d3d3abb',
 publicKey:'-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAyIpqSbC0Ahdpdwx6B4aRN0oqpkljsKgOqlKRQTv13GQ=\n-----END PUBLIC KEY-----\n'
});
function validateTrust(trust,development=false){
 const url=endpoint(trust.url,development);
 if(crypto.createPublicKey(trust.publicKey).asymmetricKeyType!=='ed25519')throw Error('终端授权公钥无效');
 const keyId=crypto.createHash('sha256').update(trust.publicKey).digest('hex').slice(0,16);
 if(trust.keyId&&trust.keyId!==keyId)throw Error('终端公钥指纹不匹配');
 return Object.freeze({url,publicKey:trust.publicKey,keyId,...(development?{development:true}:{})});
}
function productionTrust(){return validateTrust(TERMINAL_TRUST);}
async function loadTerminalTrust({isPackaged=false,developmentTrustFile}={}){
 // Installed software always uses the embedded anchor; user files and env cannot replace it.
 if(isPackaged||!developmentTrustFile)return productionTrust();
 const trust=JSON.parse(await fs.readFile(developmentTrustFile,'utf8'));
 if(trust.development!==true)throw Error('本地调试只允许显式开发信任配置；正式终端已内置');
 const url=new URL(trust.url);
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname))throw Error('开发授权仅允许本机终端');
 return validateTrust(trust,true);
}
module.exports={productionTrust,loadTerminalTrust};
