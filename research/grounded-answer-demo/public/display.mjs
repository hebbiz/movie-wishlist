function httpsURL(value) {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:'; } catch { return false; }
}

// Byte positions belong to the original Part, not concatenated JS UTF-16 text.
export function byteIndex(text, offset) {
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid citation offset.');
  let bytes = 0;
  let index = 0;
  for (const char of text) {
    if (bytes === offset) return index;
    bytes += new TextEncoder().encode(char).length;
    index += char.length;
  }
  if (bytes === offset) return index;
  throw new Error('Citation offset is outside the text or splits a UTF-8 character.');
}

// Display preparation only: no offer extraction, confidence or factual validation.
export function displayParts(response) {
  if (response?.candidates?.length !== 1) throw new Error('Empty or unsupported response; nothing displayed.');
  const candidate = response.candidates[0];
  if (candidate.finishReason !== 'STOP') throw new Error('Incomplete or blocked response; nothing displayed. No continuation call.');
  const parts = candidate.content?.parts;
  const grounding = candidate.groundingMetadata;
  if (!Array.isArray(parts) || !parts.some(p => !p.thought && typeof p.text === 'string' && p.text.trim())) throw new Error('Empty response; nothing displayed.');
  if (!grounding?.searchEntryPoint?.renderedContent?.trim() || !grounding.groundingSupports?.length || !grounding.groundingChunks?.length) throw new Error('Ungrounded response or missing citations/Search Suggestions; nothing displayed.');
  const chunks = grounding.groundingChunks;
  if (chunks.some(chunk => !httpsURL(chunk.web?.uri))) throw new Error('Unsupported citation source; nothing displayed.');
  const output = parts.map(part => {
    if (part.thought) return null; // Thought Parts are not the visible model answer.
    if (typeof part.text !== 'string') throw new Error('Unsupported non-text answer; nothing displayed.');
    return { text: part.text, citations: [] };
  });
  for (const support of grounding.groundingSupports) {
    const segment = support.segment;
    if (!segment) throw new Error('Missing citation segment; nothing displayed.');
    const partIndex = segment.partIndex ?? 0; // protobuf zero-valued fields may be omitted
    const part = Number.isInteger(partIndex) && output[partIndex];
    if (!part) throw new Error('Invalid citation Part; nothing displayed.');
    const start = byteIndex(part.text, segment.startIndex ?? 0);
    const end = byteIndex(part.text, segment.endIndex);
    if (end <= start || (segment.text !== undefined && part.text.slice(start, end) !== segment.text)) throw new Error('Citation segment mismatch; nothing displayed.');
    const indices = support.groundingChunkIndices;
    if (!Array.isArray(indices) || !indices.length || indices.some(i => !Number.isInteger(i) || !chunks[i])) throw new Error('Invalid citation reference; nothing displayed.');
    part.citations.push({ end, indices });
  }
  return { parts: output.filter(Boolean), chunks, suggestions: grounding.searchEntryPoint.renderedContent };
}

export function renderAnswer(document, data) {
  const fragment = document.createDocumentFragment();
  for (const part of data.parts) {
    let cursor = 0;
    for (const citation of [...part.citations].sort((a, b) => a.end - b.end)) {
      fragment.append(document.createTextNode(part.text.slice(cursor, citation.end)));
      for (const index of citation.indices) {
        const link = document.createElement('a');
        link.href = data.chunks[index].web.uri; // Never resolve/replace provider redirect URLs.
        link.textContent = `[${index + 1}]`;
        link.title = data.chunks[index].web.title || `Source ${index + 1}`;
        link.setAttribute('aria-label', `Source ${index + 1}: ${link.title}`);
        link.dataset.citation = 'true';
        fragment.append(link);
      }
      cursor = citation.end;
    }
    fragment.append(document.createTextNode(part.text.slice(cursor)));
  }
  return fragment;
}

export function renderSuggestions(document, host, html) {
  // Insert the provider's HTML/CSS unchanged, not in a frame. Reject unexpected
  // active content instead of sanitizing/rebranding it or altering its links.
  const template = document.createElement('template');
  template.innerHTML = html;
  const forbidden = 'script,iframe,object,embed,base,meta,link,form,input,button,video,audio';
  if (template.content.querySelector(forbidden)) throw new Error('Unsupported active Search Suggestions HTML; nothing displayed.');
  const links = template.content.querySelectorAll('a');
  if (!links.length || [...links].some(link => !httpsURL(link.getAttribute('href')))) throw new Error('Search Suggestions contain no usable link; nothing displayed.');
  for (const element of template.content.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      if (/^on/i.test(attribute.name) || ['srcdoc', 'ping'].includes(attribute.name)) throw new Error('Unsupported Search Suggestions behavior; nothing displayed.');
      if (['href', 'xlink:href'].includes(attribute.name) && !httpsURL(attribute.value) && !attribute.value.startsWith('#')) throw new Error('Unsupported Search Suggestions URL; nothing displayed.');
    }
  }
  // Shadow DOM isolates Google's CSS from our styles without changing the snippet.
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.replaceChildren(template.content);
}

export function once(action) {
  let used = false;
  return async () => {
    if (used) return;
    used = true;
    return action();
  };
}
