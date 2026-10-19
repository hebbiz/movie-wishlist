// Source-specific declarative blocks, not a general text-neighbourhood matcher.
const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const elements = n => (n.childNodes ?? []).filter(c => c.tagName);
const clean = s => s.replace(/\s+/gu, ' ').trim();
const hasClass = (n, name) => (attr(n, 'class') ?? '').split(/\s+/).includes(name);
const unknown = () => ({ state: 'unknown', language: 'uk', completeness: 'unknown', evidence: [] });
function descendants(n) {
  const out = [], stack = [n];
  while (stack.length) {
    const p = stack.pop(); out.push(p);
    if (!['script', 'style', 'template', 'noscript', 'iframe'].includes(p.tagName)) stack.push(...(p.childNodes ?? []).toReversed());
  }
  return out;
}
const text = n => clean(descendants(n).filter(p => p.nodeName === '#text').map(p => p.value).join(' '));
function summarize(evidence) {
  const signs = new Set(evidence.filter(e => ['positive', 'negative'].includes(e.state)).map(e => e.state));
  // A negative for stereo does not contradict a positive for Dolby. Only the
  // same explicit label can conflict. Different formats remain distinct evidence.
  const labels = new Map(); let conflict = false;
  for (const e of evidence) { const prior = labels.get(e.label); if (prior && prior !== e.state) conflict = true; labels.set(e.label, e.state); }
  return { state: conflict ? 'conflicting' : signs.has('positive') ? 'reported-positive' : signs.has('negative') ? 'reported-negative' : 'unknown',
    language: 'uk', completeness: 'unknown', evidence,
    note: 'Kinobaza block claim only; negatives concern named labels/formats, not every offer or track.' };
}

export function extractLocalization({ accordion, h1, identifyProvider, makeCandidate, isExcluded }) {
  const root = accordion.parentNode, byAnchor = new Map(), blocks = [], issues = [];
  const before = n => n.sourceCodeLocation?.startOffset > h1.sourceCodeLocation?.startOffset && n.sourceCodeLocation?.startOffset < accordion.sourceCodeLocation?.startOffset;
  const filmBadges = elements(root).filter(n => before(n) && !isExcluded(n) && n.tagName === 'div' &&
    attr(n, 'title') === 'За нашими даними до цього фільму/серіалу існує українське аудіо на стрімінгових сервісах або від аматорських студій' && text(n) === 'Є українське аудіо');
  const film = { ukrainianAudio: filmBadges.length === 1 ? { state: 'reported-positive', language: 'uk', completeness: 'unknown',
    basis: 'Explicit general film badge, possibly streaming or amateur studio; not provider audio.' } : unknown() };
  const containers = elements(root).flatMap(n => n.tagName === 'div' && hasClass(n, 'd-md-flex') ? elements(n) : n.tagName === 'p' && hasClass(n, 'mt-2') ? [n] : []).filter(n => before(n) && !isExcluded(n));
  if (containers.length > 100) return { film, blocks, byAnchor, issues: ['provider-block-count-limit'] };
  for (const container of containers) {
    const anchors = elements(container).filter(n => n.tagName === 'a' && identifyProvider(n)?.name);
    if (!anchors.length) continue;
    const blockId = `kinobaza:block:${blocks.length}`;
    const ambiguous = anchors.length !== 1 || descendants(container).some(n => n !== container && ['script', 'iframe', 'template', 'style', 'form'].includes(n.tagName));
    for (const anchor of anchors) {
      if (blocks.length >= 100) return { film, blocks: [], byAnchor: new Map(), issues: ['provider-block-count-limit'] };
      const provider = identifyProvider(anchor).name;
      const link = makeCandidate(anchor, null, provider);
      if (!link) continue;
      const block = { blockId, provider, href: link.href, territory: null, territoryBasis: 'Provider block outside country sections; territory unknown',
        upstream: 'not-established', audio: unknown(), subtitles: unknown(), issues: [],
        binding: 'Direct single provider anchor and its own table or parenthesized tokens in a recognized film-content block; never name-only offer matching.' };
      const tables = elements(container).filter(n => n.tagName === 'table');
      const unsafeBoundary = ambiguous || tables.length > 1 || descendants(container).filter(n => n.tagName === 'table').length !== tables.length || descendants(container).some(n => n.tagName === 'a' && n !== anchor && attr(n, 'href') !== attr(anchor, 'href'));
      if (unsafeBoundary) block.issues.push('ambiguous-provider-block');
      else if (tables.length === 1 && container.tagName === 'div' && hasClass(container.parentNode, 'd-md-flex') && elements(container).every(n => n === anchor || n === tables[0])) {
        const evidence = { audio: [], subtitles: [] };
        for (const row of descendants(tables[0]).filter(n => n.tagName === 'tr')) {
          const cells = elements(row);
          if (cells.length !== 2 || cells.some(n => !['td', 'th'].includes(n.tagName))) continue;
          const label = text(cells[0]), literal = text(cells[1]);
          if (label.length > 120 || literal.length > 32 || /[\p{C}]/u.test(label + literal)) continue;
          const audio = /^Укр\. звук(?: \(([^()]+)\))?$/.exec(label);
          const subtitles = /^Укр\. субтитри(?: \(([^()]+)\))?$/.exec(label);
          if (!audio && !subtitles) continue; // Original language is not a track.
          const state = literal === '+' ? 'positive' : ['-', '−'].includes(literal) ? 'negative' : 'unknown';
          if (evidence.audio.length + evidence.subtitles.length >= 64) { block.issues.push('block-field-count-limit'); break; }
          evidence[audio ? 'audio' : 'subtitles'].push({ label, literal, state,
            ...(audio?.[1] ? { formatLiteral: audio[1] } : {}), ...(subtitles?.[1] ? { typeLiteral: subtitles[1] } : {}) });
        }
        if (!block.issues.length) { block.audio = summarize(evidence.audio); block.subtitles = summarize(evidence.subtitles); }
      } else if (!tables.length && container.tagName === 'p' && elements(container).length === 1) {
        // This entire source-specific paragraph is the block. Arbitrary adjacent
        // nodes or the anchor's generic audio/subtitle tooltip are not evidence.
        const rest = clean((container.childNodes ?? []).filter(n => n.nodeName === '#text').map(n => n.value).join(' '));
        const match = /^\((укр\. (?:аудіо|субтитри)(?:, укр\. (?:аудіо|субтитри))?)\)$/.exec(rest);
        if (match) for (const [key, token] of [['audio', 'укр. аудіо'], ['subtitles', 'укр. субтитри']]) {
          if (match[1].split(', ').includes(token)) block[key] = summarize([{ label: token, literal: token, state: 'positive' }]);
        }
      } else block.issues.push('unsupported-provider-block');
      if (block.audio.state === 'conflicting' || block.subtitles.state === 'conflicting') block.issues.push('conflicting-block-labels');
      blocks.push(block); byAnchor.set(anchor, block);
      issues.push(...block.issues);
    }
  }
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    if (blocks[i].provider.toLowerCase() !== blocks[j].provider.toLowerCase() || blocks[i].blockId === blocks[j].blockId) continue;
    for (const key of ['audio', 'subtitles']) {
      const states = [blocks[i][key].state, blocks[j][key].state];
      if (states.includes('reported-positive') && states.includes('reported-negative')) for (const block of [blocks[i], blocks[j]]) {
        if (!block.issues.includes('possible-block-conflict-scope-unestablished')) block.issues.push('possible-block-conflict-scope-unestablished');
      }
    }
  }
  issues.push(...blocks.flatMap(b => b.issues));
  return { film, blocks, byAnchor, issues: [...new Set(issues)] };
}
