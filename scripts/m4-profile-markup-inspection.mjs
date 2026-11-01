// Explicit local, read-only diagnostic. One exact admitted profile GET, never a
// source retry, credential reader, runtime endpoint or source-content archive.
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { admitDirectorProfileURL, inspectDirectorProfile } from '../netlify/lib/director-profile.mjs';

const LIMIT = 2 * 1024 * 1024;
const TIMEOUT = 5_000;
const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const children = n => n.childNodes ?? [];
const hasClass = (n, value) => (attr(n, 'class') ?? '').split(/\s+/).includes(value);
const skip = new Set(['script', 'style', 'template', 'noscript', 'iframe']);
const clean = s => s.replace(/\s+/gu, ' ').trim();
const nodeText = n => clean(children(n).map(c => c.nodeName === '#text' ? c.value : skip.has(c.tagName) ? '' : nodeText(c)).join(' '));
const text = s => typeof s === 'string' && s.length <= 500 && !/[\p{C}]/u.test(s) ? s : null;
const excluded = n => { for (let p = n; p; p = p.parentNode) if (['nav', 'aside', 'footer', 'template', 'noscript', 'iframe'].includes(p.tagName)) return true; return false; };
const locNumber = n => Number.isSafeInteger(n) && n >= 0 && n <= LIMIT ? n : null;
const count = n => Number.isSafeInteger(n) && n >= 0 && n <= 100_000 ? n : null;
function nodes(root) {
  const all = [], stack = [[root, 0]];
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (all.length >= 100_000 || depth > 256) throw Error('profile-structure-limit');
    all.push(node);
    if (!skip.has(node.tagName)) for (const child of children(node).toReversed()) stack.push([child, depth + 1]);
  }
  return all;
}
const tag = n => typeof n?.tagName === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(n.tagName) ? n.tagName : null;

function leadingStructure(html) {
  const doctypes = [...html.matchAll(/<!doctype\b[^>]*>/gi)].map(m => ({ start: m.index, end: m.index + m[0].length, standardHTML: /^<!doctype\s+html\s*>$/i.test(m[0]) }));
  const first = doctypes[0], prefix = first ? html.slice(0, first.start) : html.slice(0, 32 * 1024);
  const tokens = []; let cursor = 0;
  while (cursor < prefix.length && tokens.length < 8) {
    const white = /^\s*/u.exec(prefix.slice(cursor))[0].length; cursor += white;
    if (cursor === prefix.length) break;
    const open = /^<style\b([^>]*)>/i.exec(prefix.slice(cursor));
    if (!open) break;
    const bodyStart = cursor + open[0].length, close = /<\/style\s*>/gi;
    close.lastIndex = bodyStart; const ending = close.exec(prefix);
    const end = ending ? ending.index + ending[0].length : prefix.length;
    tokens.push({ tag: 'style', start: cursor, openEnd: bodyStart, closeStart: ending?.index ?? null, end, closed: Boolean(ending),
      hasAttributes: Boolean(open[1].trim()), bodyChars: (ending?.index ?? prefix.length) - bodyStart,
      bodyContainsAngleBracket: /[<>]/u.test(prefix.slice(bodyStart, ending?.index ?? prefix.length)) });
    cursor = end; if (!ending) break;
  }
  const remaining = prefix.slice(cursor), htmlOpen = first ? /^\s*(<html\b[^>]*>)/i.exec(html.slice(first.end)) : null;
  const htmlStart = htmlOpen ? first.end + htmlOpen[0].indexOf(htmlOpen[1]) : null;
  const htmlEnd = htmlStart === null ? null : htmlStart + htmlOpen[1].length;
  const headOpen = htmlEnd === null ? null : /^\s*(<head\b[^>]*>)/i.exec(html.slice(htmlEnd));
  const headStart = headOpen ? htmlEnd + headOpen[0].indexOf(headOpen[1]) : null;
  return { doctypeCount: doctypes.length, doctypes: doctypes.slice(0, 8), prefixChars: prefix.length, prefixTokens: tokens,
    onlyClosedStylePrefix: Boolean(first && tokens.length && tokens.every(t => t.closed) && !remaining.trim()),
    nonStyleLeadingText: Boolean(remaining.trim()), nonStyleLeadingTagNames: [...remaining.matchAll(/<\/?([a-z][a-z0-9-]*)\b/gi)].slice(0, 8).map(m => m[1].toLowerCase()),
    documentHTML: htmlStart === null ? null : { start: htmlStart, end: htmlEnd }, documentHead: headStart === null ? null : { start: headStart, end: headStart + headOpen[1].length } };
}

export async function inspectProfileMarkup(html, sourceURL) {
  if (!admitDirectorProfileURL(sourceURL) || typeof html !== 'string' || Buffer.byteLength(html) > LIMIT) return { status: 'invalid-input' };
  const errors = []; let errorCount = 0;
  const root = parse(html, { sourceCodeLocationInfo: true, onParseError: error => { errorCount++; if (errors.length < 32) errors.push(error); } });
  let all; try { all = nodes(root); } catch { return { status: 'structure-limit', parseErrorCount: errorCount }; }
  const h1 = all.filter(n => n.tagName === 'h1' && !excluded(n));
  const header = h1.length === 1 && h1[0].parentNode?.tagName === 'div' && hasClass(h1[0].parentNode, 'col-8') ? h1[0].parentNode : null;
  const start = header?.sourceCodeLocation?.startOffset, end = header?.sourceCodeLocation?.endOffset;
  const headerFacts = header ? { start: locNumber(start), end: locNumber(end), h1: children(header).filter(n => n.tagName === 'h1').map(n => text(nodeText(n))).slice(0, 3),
    h2: children(header).filter(n => n.tagName === 'h2').map(n => text(nodeText(n))).slice(0, 3),
    birthday: children(header).filter(n => n.tagName === 'p' && /^Дата народження:/u.test(nodeText(n))).map(n => text(nodeText(n))).slice(0, 3),
    role: children(header).filter(n => n.tagName === 'p' && /^Ролі:/u.test(nodeText(n))).map(n => text(nodeText(n))).slice(0, 3) } : null;
  const details = errors.map(error => {
    const target = all.filter(n => { const s = n.sourceCodeLocation?.startTag; return s && s.startOffset <= error.startOffset && error.startOffset < s.endOffset; }).sort((a, b) => a.sourceCodeLocation.startTag.endOffset - a.sourceCodeLocation.startTag.startOffset - (b.sourceCodeLocation.startTag.endOffset - b.sourceCodeLocation.startTag.startOffset))[0];
    let critical = null;
    for (let p = target; p; p = p.parentNode) if (p === header || ['h1', 'h2', 'p', 'table', 'tr', 'td', 'th', 'a'].includes(p.tagName)) { critical = p === header ? 'profile-header' : tag(p); break; }
    return { code: /^[a-z-]{1,100}$/.test(error.code ?? '') ? error.code : 'unknown', start: locNumber(error.startOffset), end: locNumber(error.endOffset),
      line: count(error.startLine), column: count(error.startCol), targetTag: tag(target), nearestCriticalTag: critical,
      insideHeader: Number.isInteger(start) && Number.isInteger(end) ? error.startOffset >= start && error.startOffset < end : null,
      relationToHeader: !Number.isInteger(start) || !Number.isInteger(end) ? 'unknown' : error.startOffset < start ? 'before' : error.startOffset >= end ? 'after' : 'inside' };
  });
  // This diagnostic reuses the own H1 only to localize parse refusal. It does
  // not attest binding to a film-card director or confirm any person identity.
  const native = headerFacts?.h1.length === 1 ? headerFacts.h1[0] : null;
  const inspected = await inspectDirectorProfile(html, sourceURL, native);
  const diagnostic = inspected.diagnostics ?? {};
  return { status: 'profile-markup-inspected-not-identity-confirmation', ownHeader: headerFacts, activeH1Count: h1.length, leadingStructure: leadingStructure(html),
    parseErrorCount: errorCount, omittedErrors: Math.max(0, errorCount - details.length), errors: details,
    inspector: { status: ['ok', 'unresolved'].includes(inspected.status) ? inspected.status : 'unknown', reason: typeof inspected.reason === 'string' && /^[a-z-]{1,100}$/.test(inspected.reason) ? inspected.reason : 'unknown',
      counts: Object.fromEntries(['canonicalCount', 'headingCount', 'latinHeadingCount', 'birthdayCount', 'roleCount', 'ownedPersonCount', 'recoveredImageErrors', 'recoveredPreambleErrors'].map(k => [k, count(diagnostic[k])])),
      nativeAliasMatch: typeof diagnostic.nativeAliasMatch === 'boolean' ? diagnostic.nativeAliasMatch : null,
      aliasBinding: 'own-h1-for-markup-inspection-not-card-attested' } };
}

export async function runProfileMarkupInspection({ sourceURL, fetchImpl = fetch } = {}) {
  const out = { execution: 'local-diagnostic', mode: 'profile-markup-inspection', limits: { profileGET: 1, total: 1 }, counts: { profileGET: 0, total: 0 }, status: 'profile-url-rejected' };
  if (!admitDirectorProfileURL(sourceURL)) return out;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT); let reader;
  let onAbort; const aborted = new Promise((_, reject) => { onAbort = () => reject(Error('profile-deadline')); controller.signal.addEventListener('abort', onAbort, { once: true }); });
  const bounded = promise => Promise.race([promise, aborted]);
  try {
    out.counts.profileGET++; out.counts.total++;
    const response = await bounded(fetchImpl(sourceURL, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: 'text/html' }, signal: controller.signal }));
    if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) out.httpStatus = response.status;
    const stop = status => { void response.body?.cancel().catch(() => {}); return { ...out, status }; };
    if (response.status >= 300 && response.status < 400) return stop('redirect-refused');
    if (!response.ok) return stop('http-error-no-retry');
    const type = response.headers.get('content-type') ?? '';
    if (!/^text\/html(?:\s*;|$)/i.test(type) || /charset=/i.test(type) && !/charset\s*=\s*["']?utf-?8\b/i.test(type) || !response.body) return stop('invalid-content');
    if (Number(response.headers.get('content-length')) > LIMIT) return stop('response-too-large');
    reader = response.body.getReader(); const chunks = []; let bytes = 0;
    for (;;) { const part = await bounded(reader.read()); if (part.done) break; bytes += part.value.byteLength; if (bytes > LIMIT) { void reader.cancel().catch(() => {}); return { ...out, status: 'response-too-large' }; } chunks.push(part.value); }
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes));
    if (/captcha|cf-chl-|challenge-platform/i.test(html)) return { ...out, status: 'challenge-refused' };
    const inspection = await bounded(inspectProfileMarkup(html, sourceURL));
    return { ...out, status: 'completed-current-profile-only', bytes, inspection };
  } catch {
    if (reader) void reader.cancel().catch(() => {});
    return { ...out, status: controller.signal.aborted ? 'timeout-no-retry' : 'network-or-decoding-error-no-retry' };
  } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const out = args.length === 2 && args[0] === '--profile' ? await runProfileMarkupInspection({ sourceURL: args[1] }) : { execution: 'local-diagnostic', status: 'explicit-profile-option-required', counts: { profileGET: 0, total: 0 } };
  process.stdout.write(JSON.stringify(out) + '\n');
}
