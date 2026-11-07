// Attribution only, never source truth. Segment offsets are bytes within a Part:
// https://ai.google.dev/api/generate-content#Segment
// Parse the ORIGINAL JSON text to retain assertion positions, including escapes,
// whitespace, repeated values and Unicode. Never search for a claim's value.
function assertionRanges(text) {
  let cursor = 0;
  let duplicateKey = false;
  const ranges = new Map();
  const whitespace = () => { while (/\s/.test(text[cursor] || '') && cursor < text.length) cursor++; };
  function string() {
    const start = cursor++;
    while (cursor < text.length) {
      if (text[cursor++] === '"') return JSON.parse(text.slice(start, cursor));
      if (text[cursor - 1] === '\\') cursor++;
    }
    throw new Error('Unterminated JSON string');
  }
  function node(path) {
    whitespace();
    const start = cursor;
    const char = text[cursor];
    if (char === '{') {
      cursor++; whitespace();
      const keys = new Set();
      if (text[cursor] !== '}') do {
        whitespace();
        const key = string();
        if (keys.has(key)) duplicateKey = true;
        keys.add(key);
        whitespace(); cursor++; // colon; JSON.parse has already validated grammar
        node([...path, key]);
        whitespace();
      } while (text[cursor] === ',' && ++cursor);
      cursor++;
    } else if (char === '[') {
      cursor++; whitespace();
      let index = 0;
      if (text[cursor] !== ']') do {
        node([...path, index++]); whitespace();
      } while (text[cursor] === ',' && ++cursor);
      cursor++;
    } else if (char === '"') string();
    else {
      const token = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(cursor));
      if (!token) throw new Error('Invalid JSON token');
      cursor += token[0].length;
    }
    const isAssertion = path.length === 4 && path[0] === 'listings' && path[2] === 'claims';
    const isValue = path.length === 5 && path[0] === 'listings' && path[2] === 'claims' && path[4] === 'value';
    if (isAssertion || isValue) {
      const key = `${path[1]}/${path[3]}`;
      const item = ranges.get(key) || {};
      item[isAssertion ? 'assertion' : 'value'] = [start, cursor];
      ranges.set(key, item);
    }
  }
  node([]);
  return duplicateKey ? new Map() : ranges;
}

export function assertionAttributions(parts, text, supports, chunks) {
  const result = new Map();
  // Split-text JSON can be parsed for inspection but is not attributed by this PoC.
  // Preserve the ORIGINAL Part index (thought parts are not renumbered).
  const textParts = parts.map((part, index) => ({ part, index }))
    .filter(({ part }) => !part.thought && typeof part.text === 'string' && part.text.length);
  if (textParts.length !== 1 || textParts[0].part.text !== text || !Array.isArray(supports)) return result;
  const partIndex = textParts[0].index;
  const bytes = Buffer.from(text, 'utf8');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const ranges = assertionRanges(text);
  const byteRange = ([start, end]) => [Buffer.byteLength(text.slice(0, start), 'utf8'), Buffer.byteLength(text.slice(0, end), 'utf8')];
  const spans = [...ranges].map(([key, item]) => ({ key,
    allowed: [item.assertion, item.value, [item.value[0] + 1, item.value[1] - 1]].map(byteRange) }));
  for (let supportIndex = 0; supportIndex < supports.length; supportIndex++) {
    const support = supports[supportIndex];
    const segment = support?.segment;
    if (!segment || segment.partIndex !== partIndex || !Number.isSafeInteger(segment.startIndex) ||
      !Number.isSafeInteger(segment.endIndex) || segment.startIndex < 0 || segment.endIndex <= segment.startIndex ||
      segment.endIndex > bytes.length || typeof segment.text !== 'string') continue;
    try {
      if (decoder.decode(bytes.subarray(segment.startIndex, segment.endIndex)) !== segment.text) continue;
    } catch { continue; } // A range cutting through a UTF-8 sequence is invalid.
    const matches = spans.filter(span => span.allowed.some(([start, end]) => start === segment.startIndex && end === segment.endIndex));
    if (matches.length !== 1 || !Array.isArray(support.groundingChunkIndices)) continue;
    const indices = support.groundingChunkIndices;
    if (!indices.length || indices.some(i => !Number.isSafeInteger(i) || i < 0 || i >= chunks.length)) continue;
    const previous = result.get(matches[0].key) || [];
    previous.push({ supportIndex, chunkIndices: [...new Set(indices)], segment });
    result.set(matches[0].key, previous);
  }
  return result;
}
