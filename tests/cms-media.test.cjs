'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
test('CMS posters resolve against the site root rather than the catalog API path',async()=>{
 const {normalizeVod}=await import(pathToFileURL(path.resolve(__dirname,'../shared-source/server/cms.mjs')).href);
 const poster=(value,base='https://cms.example/site/api.php/provide/vod/?ac=detail')=>normalizeVod({vod_id:1,vod_name:'影片',vod_pic:value},base).poster;
 assert.equal(poster('upload/a.jpg'),'https://cms.example/site/upload/a.jpg');
 assert.equal(poster('/upload/a.jpg'),'https://cms.example/upload/a.jpg');
 assert.equal(poster('//images.example/a.jpg'),'https://images.example/a.jpg');
 assert.equal(poster(' https://images.example/a.jpg?a=1&amp;b=2 '),'https://images.example/a.jpg?a=1&b=2');
 assert.equal(poster('upload/a.jpg','https://cms.example/site'),'https://cms.example/site/upload/a.jpg');
 for(const bad of ['', 'javascript:alert(1)','file:///a.png','data:image/png;base64,eA==','https://secret:password@cms.example/a.jpg'])assert.equal(poster(bad),'');
});
