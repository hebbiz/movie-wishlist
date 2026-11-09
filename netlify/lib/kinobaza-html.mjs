// Bounded Kinobaza HTML extraction; callers supply their independent identity gate.
import { extractLocalization } from './kinobaza-localization.mjs';
export const HTML_LIMIT_BYTES = 2 * 1024 * 1024;
export const HTML_TIMEOUT_MS = 15_000;
const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const children = n => n.childNodes ?? [];
const clean = s => s.replace(/\s+/gu, ' ').trim();
function nodes(root) {
  const result = []; const stack = [[root, 0]];
  while (stack.length) {
    const [n, depth] = stack.pop();
    if (depth > 256 || result.length >= 100_000) throw new Error('markup-limit');
    result.push(n);
    if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(n.tagName)) {
      for (const c of children(n).toReversed()) stack.push([c, depth + 1]);
    }
  }
  return result;
}
const text = n => clean(nodes(n).filter(x => x.nodeName === '#text').map(x => x.value).join(' '));
const hasClass = (n, value) => (attr(n, 'class') ?? '').split(/\s+/).includes(value);
function excluded(n) {
  for (let p = n; p; p = p.parentNode) {
    if (['nav', 'aside', 'footer', 'script', 'style', 'template', 'noscript', 'iframe'].includes(p.tagName) ||
        /(?:^|[\s_-])(?:ad|ads|advertisement|trailer)(?:$|[\s_-])/i.test(`${attr(p, 'id') ?? ''} ${attr(p, 'class') ?? ''}`)) return true;
  }
  return false;
}
const territories = Object.freeze({
  UA: 'Доступно в Україні', PL: 'Доступно в Польщі', CZ: 'Доступно в Чехії', DE: 'Доступно в Німеччині',
});
const appleSubscriptionLabel = name => typeof name === 'string' && ['apple tv+', 'apple tv plus'].includes(clean(name).toLowerCase());
function providerName(a) {
  const label = attr(a, 'title') ?? '';
  const explicit = /^Дивитись \/ Купити на (.+)$/.exec(label);
  if (explicit) {
    const image = nodes(a).find(n => n.tagName === 'img');
    if (image && attr(image, 'alt') !== explicit[1]) return { unsupported: true };
    // Access belongs to this exact provider anchor, not its accordion, sibling
    // or query parameters. Unknown/contradictory labels do not disambiguate TV.
    const labels = children(a).filter(n => n.tagName === 'div').map(text);
    const subscription = labels.length === 2 && labels[0] === explicit[1] && labels[1] === 'Subscription';
    return { name: explicit[1], ...(subscription ? { subscription: true } : {}),
      ...(appleSubscriptionLabel(explicit[1]) && labels.length && !subscription ? { unsupportedAccess: true } : {}) };
  }
  const badges = [label, attr(a, 'aria-label') ?? '', text(a),
    ...nodes(a).filter(n => n.tagName === 'img').map(n => attr(n, 'alt') ?? '')];
  const matches = badges.map(s => /^(?:Доступно (?:в|у)|Купити в) (itunes|apple tv\+|rakuten|megogo|netflix|prime video|amazon prime)(?: з українською аудіо доріжкою \/ субтитрами)?$/i.exec(clean(s))).filter(Boolean);
  if (new Set(matches.map(m => m[1].toLowerCase())).size > 1) return { unsupported: true };
  return matches.length ? { name: matches[0][1],
    ...(matches[0][1].toLowerCase() === 'apple tv+' && badges.some(s => /^Купити в apple tv\+(?: |$)/i.test(clean(s))) ? { unsupportedAccess: true } : {}) } : null;
}
function candidate(a, territory, html, provider) {
  const href = attr(a, 'href');
  const loc = a.sourceCodeLocation?.attrs?.href;
  const spelling = loc ? html.slice(loc.startOffset, loc.endOffset) : '';
  const raw = /^href\s*=\s*(?:"([\s\S]*)"|'([\s\S]*)'|([^\s>]+))$/i.exec(spelling);
  const rawHref = raw ? (raw[1] ?? raw[2] ?? raw[3]) : null;
  const entry = { provider, territory, href: href ?? null, rawHref, hrefKind: 'missing', status: 'unresolved' };
  const identity = providerName(a);
  if (identity?.name === provider && identity.unsupportedAccess) entry.access = { state: 'invalid', basis: 'unsupported-or-contradictory-provider-access-label' };
  else if (identity?.name === provider && (identity.subscription || appleSubscriptionLabel(provider))) {
    entry.access = { state: 'reported', value: 'subscription', basis: identity.subscription ? 'same-provider-anchor-Subscription-label' : 'explicit-Apple-TV+-service-label' };
  }
  if (!href) return { ...entry, issue: 'missing-href' };
  if (href.length > 16384 || /[\\\s\p{C}]/u.test(href) || /[\p{C}]/u.test(provider)) return { ...entry, href: null, rawHref: null, issue: 'unsafe-url-or-label' };
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(href);
  if (!scheme) return { ...entry, hrefKind: 'relative', status: 'candidate', issue: 'not-an-absolute-provider-url' };
  if (!/^https?$/i.test(scheme[1])) return { ...entry, href: null, rawHref: null, issue: 'unsafe-url-scheme' };
  try {
    const url = new URL(href); // Validate only. Never serialize/resolve or fetch it.
    if (!url.hostname || url.username || url.password) throw new Error('unsafe');
    if (['justwatch.com', 'www.justwatch.com'].includes(url.hostname)) return null;
  } catch { return { ...entry, href: null, rawHref: null, issue: 'unsafe-or-invalid-url' }; }
  return { ...entry, hrefKind: 'absolute', status: 'candidate' };
}

const IMAGE_ATTRIBUTE_RECOVERY = new Set(['missing-whitespace-between-attributes', 'unexpected-character-in-attribute-name']);
function noncriticalImageError(error, all, html) {
  if (!IMAGE_ATTRIBUTE_RECOVERY.has(error.code)) return false;
  const accordions = all.filter(n => attr(n, 'id') === 'availabilityAccordion');
  const end = accordions.length === 1 ? accordions[0].sourceCodeLocation?.endTag?.endOffset : null;
  if (!Number.isInteger(end)) return false;
  const targets = all.filter(n => {
    const span = n.sourceCodeLocation?.startTag;
    return span && Number.isInteger(error.startOffset) && Number.isInteger(error.endOffset) &&
      span.startOffset <= error.startOffset && error.startOffset < span.endOffset && error.endOffset <= span.endOffset;
  });
  if (targets.length !== 1) return false;
  const node = targets[0], span = node.sourceCodeLocation.startTag;
  // Only a located, void HTML image after the bounded viewing sections. Do not
  // recover a broken tag that could have swallowed later metadata/HTML tags.
  if (node.tagName !== 'img' || node.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      children(node).length || span.startOffset < end || html.slice(span.startOffset + 1, span.endOffset).includes('<')) return false;
  const critical = p => ['h1', 'h2', 'table', 'tr', 'td', 'th'].includes(p.tagName) ||
    attr(p, 'id') === 'availabilityAccordion' || p.tagName === 'a' && providerName(p);
  for (let p = node.parentNode; p; p = p.parentNode) if (critical(p)) return false;
  // parse5 may foster-parent an image out of a table. Its original source
  // interval must also be outside critical structures, not just its DOM parent.
  if (all.some(p => critical(p) && p.sourceCodeLocation?.startOffset <= span.startOffset &&
      p.sourceCodeLocation?.endOffset >= span.endOffset)) return false;
  return true;
}

function noncriticalRecommendationError(error, all, html) {
  if (!IMAGE_ATTRIBUTE_RECOVERY.has(error.code)) return false;
  const accordions = all.filter(n => attr(n, 'id') === 'availabilityAccordion');
  const end = accordions.length === 1 ? accordions[0].sourceCodeLocation?.endTag?.endOffset : null;
  if (!Number.isInteger(end)) return false;
  const targets = all.filter(n => {
    const s = n.sourceCodeLocation?.startTag;
    return s && Number.isInteger(error.startOffset) && Number.isInteger(error.endOffset) &&
      s.startOffset <= error.startOffset && error.startOffset < s.endOffset && error.endOffset <= s.endOffset;
  });
  if (targets.length !== 1) return false;
  const node = targets[0], span = node.sourceCodeLocation.startTag;
  if (!['a', 'img'].includes(node.tagName) || node.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      html.slice(span.startOffset + 1, span.endOffset).includes('<')) return false;
  const closed = n => n?.sourceCodeLocation?.startTag && n.sourceCodeLocation.endTag &&
    n.sourceCodeLocation.startTag.endOffset <= n.sourceCodeLocation.endTag.startOffset;
  if (node.tagName === 'a' && !closed(node)) return false;
  let item = node.parentNode;
  while (item && !hasClass(item, 'scrolling-wrapper-flexbox__item')) item = item.parentNode;
  const wrapper = item?.parentNode;
  if (item?.tagName !== 'div' || wrapper?.tagName !== 'div' || !hasClass(wrapper, 'scrolling-wrapper-flexbox') ||
      !closed(item) || !closed(wrapper) || wrapper.sourceCodeLocation.startOffset < end) return false;
  const inside = (outer, inner) => outer.startTag.endOffset <= inner.startOffset && inner.endOffset <= outer.endTag.startOffset;
  if (!inside(wrapper.sourceCodeLocation, item.sourceCodeLocation) || !inside(item.sourceCodeLocation, node.sourceCodeLocation)) return false;
  const critical = n => ['h1', 'h2', 'table', 'tr', 'td', 'th', 'link'].includes(n.tagName) ||
    attr(n, 'id') === 'availabilityAccordion' || n.tagName === 'a' && providerName(n) ||
    // The identity reader also supports these inline director-label shapes.
    // A recommendation cannot become their authority after markup recovery.
    n.nodeName === '#text' && clean(n.value) === 'Режисер:' ||
    ['span', 'strong', 'b'].includes(n.tagName) && text(n) === 'Режисер:';
  // DOM ancestry is insufficient after parser foster-parenting. Reject critical
  // structures both in the carousel tree and in its original source interval.
  for (let p = node; p; p = p.parentNode) if (critical(p)) return false;
  const w = wrapper.sourceCodeLocation, within = new Set(nodes(wrapper));
  if (all.some(n => critical(n) && (within.has(n) || n.sourceCodeLocation &&
      n.sourceCodeLocation.startOffset < w.endOffset && n.sourceCodeLocation.endOffset > w.startOffset))) return false;
  return true;
}

// Resolve the lazy parser from its runtime owner, using the repository lockfile.
export async function extractHtml(html, film, { identityCheck, onIdentityBlocked } = {}) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > HTML_LIMIT_BYTES) return { status: 'unsupported-markup', candidates: [], issues: ['html-size-limit'] };
  let parse;
  try { ({ parse } = await import('parse5')); } catch { return { status: 'parser-unavailable', candidates: [], issues: ['From repository root run npm ci --ignore-scripts --no-audit --no-fund'] }; }
  try {
    const errors = []; let overflow = false;
    const doc = parse(html, { sourceCodeLocationInfo: true, onParseError: e => {
      if (errors.length < 256) errors.push({ code: e.code, startOffset: e.startOffset, endOffset: e.endOffset }); else overflow = true;
    } });
    const all = nodes(doc), recoveries = errors.filter(e => e.code !== 'missing-doctype');
    // Never silently drop a late critical error behind the event bound. No HTML
    // repair/serialization: identity and extraction use the same parsed tree.
    if (overflow) return { status: 'unsupported-markup', candidates: [], issues: ['html-parse-errors'] };
    const imageRecovery = [], recommendationRecovery = [];
    for (const error of recoveries) {
      // A malformed image inside a recommendation must satisfy the entire
      // carousel boundary, rather than falling through to generic image recovery.
      let recommendation = false;
      for (const n of all) if (hasClass(n, 'scrolling-wrapper-flexbox') &&
          n.sourceCodeLocation?.startOffset <= error.startOffset && n.sourceCodeLocation?.endOffset >= error.endOffset) recommendation = true;
      if (noncriticalRecommendationError(error, all, html)) recommendationRecovery.push(error);
      else if (!recommendation && noncriticalImageError(error, all, html)) imageRecovery.push(error);
      else return { status: 'unsupported-markup', candidates: [], issues: ['html-parse-errors'] };
    }
    // Internal staged verification can resume extraction against this already
    // validated tree. No DOM, raw HTML or continuation is part of the result.
    const extractChecked = checked => {
    const fail = issue => ({ status: 'unsupported-markup', identity: checked, candidates: [], issues: [issue] });
    if (checked.status !== 'matched') return { status: checked.status === 'mismatch' ? 'identity-mismatch' : 'identity-unresolved', identity: checked, candidates: [], issues: [checked.reason ?? 'title-year-director-not-unambiguous'] };
    const accordions = all.filter(n => attr(n, 'id') === 'availabilityAccordion');
    if (accordions.length !== 1) return fail('missing-or-duplicate-availabilityAccordion');
    const accordion = accordions[0];
    const localization = extractLocalization({ accordion, h1: all.find(n => n.tagName === 'h1'), identifyProvider: providerName, isExcluded: excluded,
      makeCandidate: (anchor, territory, provider) => candidate(anchor, territory, html, provider) });
    const independentCandidates = [], independentIssues = [];
    const add = (a, territory, candidates, issues) => {
      if (excluded(a)) return;
      const provider = providerName(a);
      if (provider?.unsupported) { issues.push('conflicting-provider-label'); return; }
      if (!provider?.name || /^justwatch$/i.test(provider.name)) return;
      const entry = candidate(a, territory, html, provider.name);
      if (entry && localization.byAnchor.has(a)) entry.blockId = localization.byAnchor.get(a).blockId;
      if (entry) { candidates.push(entry); if (entry.issue) issues.push(entry.issue); }
    };
    const h1 = all.find(n => n.tagName === 'h1');
    for (const a of all.filter(n => n.tagName === 'a')) {
      const offset = a.sourceCodeLocation?.startOffset;
      // Only source-specific film badges between the title and country accordion.
      if (offset > h1.sourceCodeLocation.startOffset && offset < accordion.sourceCodeLocation.startOffset) add(a, null, independentCandidates, independentIssues);
    }
    if (independentCandidates.length > 100) return fail('candidate-count-limit');
    // Film badges/source blocks have their own validated boundary. Country
    // parsing is atomic: ambiguity withholds every country claim, not these
    // independent observations. A valid foreign-only accordion stays foreign.
    const countryCandidates = [], countryIssues = [], panels = new Set();
    const countryIssue = (() => {
      const items = children(accordion).filter(n => n.tagName);
      if (!items.length || items.some(n => !hasClass(n, 'accordion-item'))) return 'unsupported-accordion-items';
      for (const item of items) {
        const headings = nodes(item).filter(n => hasClass(n, 'accordion-header'));
        if (headings.length !== 1) return 'ambiguous-territory-heading';
        const buttons = nodes(headings[0]).filter(n => n.tagName === 'button');
        if (buttons.length !== 1) return 'ambiguous-territory-control';
        const [code] = Object.entries(territories).find(([, label]) => text(buttons[0]) === label) ?? [];
        const target = attr(buttons[0], 'data-bs-target');
        if (!code || target !== `#collapse${code}` || panels.has(code)) return 'unsupported-or-conflicting-territory';
        const panel = all.filter(n => attr(n, 'id') === target.slice(1));
        if (panel.length !== 1 || panel[0].parentNode !== item || attr(panel[0], 'data-bs-parent') !== '#availabilityAccordion') return 'ambiguous-territory-panel';
        panels.add(code);
        for (const a of nodes(panel[0]).filter(n => n.tagName === 'a')) add(a, { code, label: territories[code] }, countryCandidates, countryIssues);
        if (countryCandidates.length + independentCandidates.length > 100) return 'candidate-count-limit';
      }
      return panels.has('UA') ? null : 'missing-explicit-ukraine-section';
    })();
    if (countryIssue === 'candidate-count-limit') return fail(countryIssue);
    const countryValid = !countryIssue || countryIssue === 'missing-explicit-ukraine-section';
    const independentClaims = independentCandidates.length || localization.blocks.length || localization.film.ukrainianAudio.state !== 'unknown';
    if (!countryValid && !independentClaims) return fail(countryIssue);
    // Keep the established order and block IDs when all country sections parse.
    const candidates = [...(countryValid ? countryCandidates : []), ...independentCandidates];
    const issues = [...(countryValid ? countryIssues : []), ...independentIssues, ...(countryIssue ? [countryIssue] : []), ...localization.issues,
      ...(imageRecovery.length ? ['noncritical-image-markup-recovered'] : []),
      ...(recommendationRecovery.length ? ['noncritical-recommendation-markup-recovered'] : [])];
    if (candidates.length > 100) return fail('candidate-count-limit');
    const availabilitySignals = candidates.filter(c => c.territory).map(c => ({ provider: c.provider, href: c.href, territory: c.territory,
      state: 'source-section-claim', value: 'available', access: 'unknown', upstream: 'JustWatch', basis: 'Explicit country heading/panel, not href presence or account entitlement.' }));
    return { status: candidates.length || independentClaims ? (issues.length ? 'partial' : 'ok') : 'unresolved', identity: checked, candidates,
      localization: { film: localization.film, blocks: localization.blocks }, availabilitySignals, issues: [...new Set(issues)] };
    };
    const checked = identityCheck ? await identityCheck(all) : { status: 'unresolved', reason: 'identity-check-required', observed: {} };
    if (checked.status === 'unresolved' && typeof onIdentityBlocked === 'function') {
      let available = true;
      try { onIdentityBlocked(async nextIdentityCheck => {
        if (!available || typeof nextIdentityCheck !== 'function') return extractChecked(checked);
        available = false;
        try { return extractChecked(await nextIdentityCheck(all)); }
        catch { return { status: 'unsupported-markup', candidates: [], issues: ['unresolved-parser-or-structure'] }; }
      }); } catch {} // A diagnostic/controller hook cannot alter the first result.
    }
    return extractChecked(checked);
  } catch { return { status: 'unsupported-markup', candidates: [], issues: ['unresolved-parser-or-structure'] }; }
}
