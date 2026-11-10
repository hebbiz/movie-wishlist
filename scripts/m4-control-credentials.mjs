// Local stdin contract only. Never read credentials from argv, files or fallback env.
async function readCredentials(input, keys) {
  const chunks = [];
  let joined, text, parsed, size = 0;
  try {
    for await (const chunk of input) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > 16_384) { bytes.fill(0); throw Error('invalid-local-credentials'); }
      chunks.push(bytes);
    }
    joined = Buffer.concat(chunks);
    text = new TextDecoder('utf-8', { fatal:true }).decode(joined);
    parsed = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || Object.keys(parsed).sort().join(',') !== [...keys].sort().join(',') ||
        !keys.map(key => parsed[key]).every(s => typeof s === 'string' && s.length > 0 && s.length <= 4096 && !/\s/.test(s))) throw Error('invalid-local-credentials');
    return Object.fromEntries(keys.map(key => [key, parsed[key]]));
  } catch { throw Error('invalid-local-credentials'); }
  finally {
    for (const chunk of chunks) chunk.fill(0);
    joined?.fill(0);
    text = null; parsed = null;
  }
}
export const readControlCredentials = input => readCredentials(input, ['tmdbToken', 'tavilyKey']);
export const readTmdbCredential = input => readCredentials(input, ['tmdbToken']);
