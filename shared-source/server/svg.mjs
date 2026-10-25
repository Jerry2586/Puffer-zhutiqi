// Static SVG subset for portable theme artwork. Never accepts executable markup.
export function isStaticSvg(bytes){
 if(bytes.length>1024*1024)return false;
 let source=bytes.toString('utf8').trim().replace(/^<\?xml[^?]*\?>\s*/,'').replace(/<!--[\s\S]*?-->/g,'');
 const tags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','linearGradient','radialGradient','stop','clipPath','mask','use','title','desc']);
 const attrs=new Set(['xmlns','xmlns:xlink','version','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stroke-opacity','opacity','transform','id','clip-path','clip-rule','mask','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','fx','fy','href','xlink:href','preserveAspectRatio']);
 const stack=[];let roots=0,last=0;const tokens=/<([^<>]+)>/g;let match;
 while((match=tokens.exec(source))){
  const between=source.slice(last,match.index);if(between.trim()&&!['title','desc'].includes(stack.at(-1)))return false;if(/[<&]/.test(between))return false;last=tokens.lastIndex;
  const token=match[1],end=token.match(/^\/([A-Za-z]+)\s*$/);
  if(end){if(stack.pop()!==end[1])return false;continue;}
  const start=token.match(/^([A-Za-z]+)([\s\S]*?)(\/?)$/);if(!start||!tags.has(start[1]))return false;
  if(!stack.length){if(start[1]!=='svg'||++roots!==1)return false;}
  let rest=start[2];const seen=new Set();while(rest.trim()){
   const a=rest.match(/^\s+([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/);if(!a)return false;
   const name=a[1],value=a[2]??a[3];if(!attrs.has(name)||seen.has(name))return false;seen.add(name);
   if(name==='xmlns'||name==='xmlns:xlink'){if(value!==(name==='xmlns'?'http://www.w3.org/2000/svg':'http://www.w3.org/1999/xlink'))return false;}
   else if(name==='href'||name==='xlink:href'){if(!/^#[A-Za-z_][\w-]*$/.test(value))return false;}
   else if(!/^[A-Za-z0-9#().,% _+:\/-]*$/.test(value)||(/url/i.test(value)&&!/^url\(#[A-Za-z_][\w-]*\)$/.test(value)))return false;
   rest=rest.slice(a[0].length);
  }
  if(!start[3])stack.push(start[1]);
 }
 return roots===1&&!stack.length&&!source.slice(last).trim();
}
