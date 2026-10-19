'use strict';
// Loaded before the local authoring service. It only serves incoming loopback requests.
// Deny outgoing sockets before DNS or HTTP can start, including future service additions.
const {syncBuiltinESMExports}=require('node:module');
const offline=()=>{const error=Error('离线主题中心不连接网络。');error.code='OFFLINE_ONLY';throw error;};
require('node:net').Socket.prototype.connect=offline;
require('node:http').request=offline;require('node:http').get=offline;
require('node:https').request=offline;require('node:https').get=offline;
globalThis.fetch=async()=>offline();
syncBuiltinESMExports();
