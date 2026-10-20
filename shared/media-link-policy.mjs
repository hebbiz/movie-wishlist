// Classification only, never resolve, serialize or follow the observed href.
export function classifyLink(href, provider) {
  const result = { href: typeof href === 'string' ? href : null, kind: 'unknown', transferable: false };
  if (!href) return { ...result, kind: 'missing' };
  if (typeof href !== 'string' || href.length > 16384 || /[\\\s\p{C}]/u.test(href)) return { ...result, href: null, kind: 'unsafe' };
  if (!/^[a-z][a-z\d+.-]*:/i.test(href)) return { ...result, kind: 'relative' };
  let u;
  try { u = new URL(href); } catch { return { ...result, href: null, kind: 'unsafe' }; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return { ...result, href: null, kind: 'unsafe' };
  const host = u.hostname.toLowerCase();
  if (['themoviedb.org', 'www.themoviedb.org'].includes(host)) return { ...result, kind: 'tmdb-watch-page' };
  if (/\/(?:search|results)(?:\/|$)/i.test(u.pathname) || ['q', 'query', 'search_query'].some(k => u.searchParams.has(k))) return { ...result, kind: 'search' };
  if (host === 'click.justwatch.com') return { ...result, kind: 'tracking-redirect', transferable: Boolean(provider) };
  // Observed provider-native card routes, not arbitrary paths/redirect services.
  // Retain the original string; no destination fetch, referral stripping or ID substitution.
  const primeReferral = ['primevideo.com', 'www.primevideo.com'].includes(host) && /^\/detail\/[a-z0-9]+\/ref=atv_[a-z0-9_]+$/i.test(u.pathname);
  const itunesCard = host === 'itunes.apple.com' && /^\/ua\/movie\/id\d+$/.test(u.pathname);
  const megogoIdCard = ['megogo.net', 'www.megogo.net'].includes(host) && /^\/ua\/view\/\d+$/.test(u.pathname);
  const exact = {
    apple: host === 'tv.apple.com' && /^\/[a-z]{2}\/movie\/[^/]+\/umc\.cmc\.[a-z0-9]+$/i.test(u.pathname) || itunesCard,
    prime: ['primevideo.com', 'www.primevideo.com'].includes(host) && /^\/(?:[^/]+\/)?detail\/[a-z0-9]+\/?$/i.test(u.pathname) || primeReferral,
    netflix: ['netflix.com', 'www.netflix.com'].includes(host) && /^\/(?:[a-z]{2}\/)?title\/\d+\/?$/i.test(u.pathname),
    rakuten: ['rakuten.tv', 'www.rakuten.tv'].includes(host) && /^\/ua\/movies\/[^/]+\/?$/i.test(u.pathname),
    megogo: ['megogo.net', 'www.megogo.net'].includes(host) && /^\/ua\/view\/\d+-[^/]+\.html$/i.test(u.pathname) || megogoIdCard,
  };
  if (!Object.hasOwn(exact, provider?.key) || !exact[provider.key]) return result;
  // Presence of exact decoded key "at" is conservative even when empty/repeated.
  // The original query stays untouched; no extra markers/hosts/routes inferred.
  const referral = primeReferral || provider.key === 'apple' && u.searchParams.has('at');
  return { ...result, kind: 'exact-card-unverified', transferable: true,
    ...(referral ? { referral: 'provider-native', acknowledgementRequired: true } : {}) };
}
