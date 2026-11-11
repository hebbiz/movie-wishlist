export const STORES = {
  'Apple TV': { kind: 'streaming', hosts: ['tv.apple.com'] },
  'Rakuten TV': { kind: 'streaming', hosts: ['rakuten.tv'] },
  'HBO Max': { kind: 'streaming', hosts: ['hbomax.com', 'max.com'] },
  Netflix: { kind: 'streaming', hosts: ['netflix.com'] },
  'Prime Video': { kind: 'streaming', hosts: ['primevideo.com'] },
  MEGOGO: { kind: 'streaming', hosts: ['megogo.net'] },
  'Amazon US': { kind: 'physical', hosts: ['amazon.com'] },
  'Amazon UK': { kind: 'physical', hosts: ['amazon.co.uk'] },
  'Amazon Germany': { kind: 'physical', hosts: ['amazon.de'] },
  'Amazon Italy': { kind: 'physical', hosts: ['amazon.it'] },
  HMV: { kind: 'physical', hosts: ['hmv.com'] },
  Rarewaves: { kind: 'physical', hosts: ['rarewaves.com'] },
};

export const CORE_FIELDS = ['movie_identity', 'availability', 'format', 'edition',
  'edition_id', 'cut', 'price', 'currency', 'territory', 'disc_region',
  'video_resolution', 'hdr', 'audio', 'subtitles'];
export const AVAILABILITY = ['available', 'preorder', 'unavailable', 'unknown'];
export const PROMPT_VERSION = 'media-discovery-v1';
export const REVIEW_DATE = '2026-10-17';
// No environment flag can substitute for the pending retrieval decision.
export const LIVE_RESEARCH_ENABLED = false;
export const PRICING = {
  source: 'https://ai.google.dev/gemini-api/docs/pricing',
  checkedAt: REVIEW_DATE,
  model: 'gemini-3.8-flash',
  currency: 'USD',
  inputPerMillion: 0.75,
  outputIncludingThinkingPerMillion: 3.75,
  searchPerThousand: 14,
  validThrough: '2026-12-31',
};

export function safeUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u;
  } catch { return null; }
}

export function storeUrl(store, value) {
  const u = safeUrl(value);
  return Boolean(u && STORES[store]?.hosts.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`)));
}

// Input schema is also sent to Gemini. Unknown fields are represented by missing claims.
const claim = {
  type: 'object', additionalProperties: false,
  properties: {
    field: { type: 'string' }, value: { type: 'string' },
    sourceUrls: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' }, conflict: { type: 'boolean' },
  }, required: ['field', 'value', 'sourceUrls', 'note', 'conflict'],
};
export const RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    movieId: { type: 'string' },
    listings: { type: 'array', maxItems: 20, items: {
      type: 'object', additionalProperties: false,
      properties: {
        id: { type: 'string' }, store: { type: 'string', enum: Object.keys(STORES) },
        kind: { type: 'string', enum: ['streaming', 'physical'] },
        url: { type: 'string' }, claims: { type: 'array', maxItems: 80, items: claim },
      }, required: ['id', 'store', 'kind', 'url', 'claims'],
    } },
    checkedSources: { type: 'array', maxItems: 12, items: {
      type: 'object', additionalProperties: false,
      properties: { store: { type: 'string', enum: Object.keys(STORES) },
        outcome: { type: 'string', enum: ['searched', 'no_result', 'blocked', 'not_checked'] },
        note: { type: 'string' } }, required: ['store', 'outcome', 'note'],
    } },
  }, required: ['movieId', 'listings', 'checkedSources'],
};

// No dependency, but enforce the entire small schema locally, including extra fields.
export function validate(value, schema = RESPONSE_SCHEMA, path = '$') {
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (type !== schema.type) throw new Error(`Invalid response at ${path}: expected ${schema.type}`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`Invalid enum at ${path}`);
  if (type === 'object') {
    for (const key of schema.required || []) if (!(key in value)) throw new Error(`Missing ${path}.${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (!schema.properties[key]) throw new Error(`Unexpected ${path}.${key}`);
      validate(item, schema.properties[key], `${path}.${key}`);
    }
  }
  if (type === 'array') {
    if (value.length > (schema.maxItems ?? Infinity)) throw new Error(`Too many items at ${path}`);
    value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`));
  }
  return value;
}
