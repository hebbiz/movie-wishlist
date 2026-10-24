// Trusted local diagnostic only. NEVER a URL rewriter/admission replacement.
import { admitKinobazaURL } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';

export const expectedFormat = 'https://kinobazaua.com/titles/<lowercase-ascii-hyphenated-slug>';
const pathShape = /^\/titles\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sensitiveLabel = /^(?:api[-_]?key|token|secret|password|auth|session|credential|bearer|reset)$/i;
function echoesCredential(path,secrets) {
  let decoded=path;
  for(let i=0;i<4;i++){
    if(secrets.some(s=>s && decoded.includes(s)))return true;
    try{const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}catch{break;}
  }
  return secrets.some(s=>s && decoded.includes(s));
}
function componentRisk(component, previous, secrets) {
  let decoded = component;
  // Decode for detection ONLY; emitted safe path always retains original spelling.
  for (let i=0;i<3;i++) {
    if (secrets.some(s=>s && decoded.includes(s))) return 'credential-echo';
    if (!decoded.includes('%')) break;
    try { const next=decodeURIComponent(decoded); if(next===decoded)break; decoded=next; }
    catch { return 'malformed-encoding'; }
  }
  if (secrets.some(s=>s && decoded.includes(s))) return 'credential-echo';
  if (/%[0-9a-f]{2}/i.test(decoded)) return 'excessive-encoding';
  if (component.length>120 || sensitiveLabel.test(previous) || decoded.split(/[/\\]/).some(s=>sensitiveLabel.test(s)) ||
      /(?:api[-_]?key|token|secret|password|auth|session|credential|bearer)[=:_-]/i.test(decoded) ||
      /(?:^|[^a-z])(?:tvly-|eyJ)/.test(decoded) || /[A-Za-z0-9_]{24,}/.test(decoded) ||
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(decoded) ||
      /[\p{C}\s@:=]/u.test(decoded) || !/^[\p{L}\p{N}._~%+()\-/]*$/u.test(decoded)) return 'unusual-component';
  return null;
}
function safePath(path, component, secrets, redactions) {
  if (path===null) return null;
  if(echoesCredential(path,secrets)){redactions.push({component,reason:'credential-echo'});return '[withheld]';}
  if(path.split(/[/\\]/).length>16){redactions.push({component,reason:'unusual-structure'});return '[withheld]';}
  let previous='',withholdFollowing=false;
  return path.split(/([/\\])/).map((part,index)=>{
    if (part==='/' || part==='\\') return part;
    const risk=withholdFollowing?'following-unusual-component':componentRisk(part,previous,secrets); previous=part;
    if(risk){withholdFollowing=true;redactions.push({component,segment:index,reason:risk});return '[withheld]';}
    return part;
  }).join('');
}
export function describeCandidateURL(value,{secrets=[]}={}) {
  const result={expectedFormat,hostname:null,originalPathname:null,parsedPathname:null,
    pathChangedByParser:null,queryPresent:null,fragmentPresent:null,
    admission:admitKinobazaURL(value)?'accepted':'rejected',failedCheck:'none',differences:[],redactions:[]};
  if(typeof value!=='string'){result.failedCheck='string-input';return result;}
  if(value.length>512){result.failedCheck='max-url-length';result.redactions.push({component:'url',reason:'oversize'});return result;}
  let url;try{url=new URL(value);}catch{result.failedCheck='url-parser';return result;}
  if(url.hostname!=='kinobazaua.com'){
    result.failedCheck='exact-original-url-format';result.differences.push('hostname-not-allowed');
    result.redactions.push({component:'url',reason:'non-target-host'});return result;
  }
  result.hostname='kinobazaua.com';
  const authority=/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#\\]*)([^?#]*)/.exec(value);
  const rawPath=authority?.[2]??null;
  const question=value.indexOf('?'),hash=value.indexOf('#');
  result.queryPresent=question>=0&&(hash<0||question<hash);
  result.fragmentPresent=hash>=0;
  result.pathChangedByParser=rawPath===null?null:rawPath!==url.pathname;
  if(!value.startsWith('https://'))result.differences.push('https-original-spelling-required');
  if(url.username||url.password)result.differences.push('credentials-not-allowed');
  if(authority?.[1] !== 'kinobazaua.com')result.differences.push('exact-authority-spelling-required');
  if(url.port || /:\d+$/.test(authority?.[1]??''))result.differences.push('explicit-port-not-allowed');
  if(result.queryPresent)result.differences.push('query-not-allowed');
  if(result.fragmentPresent)result.differences.push('fragment-not-allowed');
  if(rawPath===null)result.differences.push('original-path-boundary-unavailable');
  else {
    if(!pathShape.test(rawPath))result.differences.push('original-path-shape-not-allowed');
    if(rawPath.endsWith('/'))result.differences.push('trailing-slash-not-allowed');
    if(rawPath.split('/').filter(Boolean).length>2)result.differences.push('additional-path-segments');
    if(/[A-Z]/.test(rawPath.replace(/%[a-f0-9]{2}/gi,'')))result.differences.push('uppercase-path-not-allowed');
    if(rawPath.includes('%'))result.differences.push('encoded-path-not-allowed');
  }
  if(result.pathChangedByParser)result.differences.push('parser-normalized-original-path');
  if(!pathShape.test(url.pathname))result.differences.push('parsed-path-shape-not-allowed');
  if(result.admission==='rejected')result.failedCheck='exact-original-url-format';
  if(url.username||url.password || !authority){
    result.redactions.push({component:'paths',reason:'credentials-or-abnormal-authority'});
  } else {
    result.originalPathname=safePath(rawPath,'original-path',secrets,result.redactions);
    result.parsedPathname=safePath(url.pathname,'parsed-path',secrets,result.redactions);
  }
  return result;
}
