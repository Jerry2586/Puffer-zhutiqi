/** Preview media stays within the authenticated local proxy; native streams require HTTPS. */
export function validPlaybackAddress(url:string,desktop=false,native=false):boolean {
 if(typeof url!=='string')return false;
 if(desktop)return /^\/api\/preview\/media\/[a-f0-9]{48}$/.test(url);
 try {const parsed=new URL(url);return !parsed.username&&!parsed.password&&(parsed.protocol==='https:'||!native&&parsed.protocol==='http:');}catch{return false;}
}
