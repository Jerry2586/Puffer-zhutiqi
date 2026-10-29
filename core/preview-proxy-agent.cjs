'use strict';
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const { isIP } = require('node:net');

// Proxy configuration comes from Electron's session, never from a renderer URL.
// CONNECT uses a locally checked numeric address to retain DNS-rebinding protection.
function createPreviewProxyAgent(url, proxyRule, checkedLookup, signal) {
 const rule = proxyRule.split(';')[0].trim();
 if (!rule || rule === 'DIRECT') return undefined;
 const match = /^PROXY ([^\s]+)$/i.exec(rule);
 if (!match) throw Error('当前预览不支持此系统代理类型，请使用 HTTP 系统代理');
 const proxy = new URL('http://' + match[1]);
 if (proxy.username || proxy.password || proxy.pathname !== '/' || proxy.search || proxy.hash) throw Error('系统代理地址无效');
 const secure = url.protocol === 'https:';
 const agent = new (secure ? https.Agent : http.Agent)({ keepAlive: false, maxSockets: 1 });
 agent.createConnection = (_options, callback) => {
  let connectRequest, socket, finished = false;
  const timer = setTimeout(() => finish(Error('连接系统代理超时')), 30000);
  const abort = () => finish(signal.reason || Error('预览请求已取消'));
  function finish(error, connection) {
   if (finished) return;
   finished = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
   if (error) { connectRequest?.destroy(); socket?.destroy(); }
   callback(error, connection);
  }
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) { abort(); return; }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const connect = (error, addresses) => {
   if (finished) return;
   if (error) { finish(error); return; }
   const address = addresses[0]?.address;
   if (!address || !isIP(address)) { finish(Error('素材域名解析无效')); return; }
   const authority = (isIP(address) === 6 ? '[' + address + ']' : address) + ':' + (url.port || (secure ? 443 : 80));
   connectRequest = http.request(proxy, { method: 'CONNECT', path: authority, headers: { Host: authority }, agent: false });
   connectRequest.once('error', finish);
   connectRequest.once('connect', (response, tunnel, head) => {
    socket = tunnel;
    if (finished) { tunnel.destroy(); return; }
    if (response.statusCode !== 200 || head.length) { finish(Error('系统代理连接失败')); return; }
    if (!secure) { finish(null, tunnel); return; }
    socket = tls.connect({ socket: tunnel, host: hostname, servername: isIP(hostname) ? '' : hostname });
    socket.once('error', finish);
    socket.once('secureConnect', () => finish(null, socket));
   });
   connectRequest.end();
  };
  // Even literal IPs go through the caller's policy before a proxy connection.
  checkedLookup(hostname, { all: true }, connect);
 };
 return agent;
}
module.exports = { createPreviewProxyAgent };
