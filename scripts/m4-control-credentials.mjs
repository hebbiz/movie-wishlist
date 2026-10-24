// Local stdin contract only. Never read credentials from argv, files or fallback env.
export async function readControlCredentials(input) {
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
    if (!parsed || Array.isArray(parsed) || Object.keys(parsed).sort().join(',') !== 'tavilyKey,tmdbToken' ||
        ![parsed.tmdbToken, parsed.tavilyKey].every(s => typeof s === 'string' && s.length > 0 && s.length <= 4096 && !/\s/.test(s))) throw Error('invalid-local-credentials');
    return { tmdbToken:parsed.tmdbToken, tavilyKey:parsed.tavilyKey };
  } catch { throw Error('invalid-local-credentials'); }
  finally {
    for (const chunk of chunks) chunk.fill(0);
    joined?.fill(0);
    text = null; parsed = null;
  }
}
