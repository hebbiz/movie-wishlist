// Compact, text-only projection. Provider URLs never become links/resources.
export function renderMotnResult(document, host, result, synthetic) {
  host.replaceChildren();
  const add = (tag, value) => { const n = document.createElement(tag); n.textContent = value; host.append(n); return n; };
  const value = f => f?.state === 'reported' ? String(f.value) : f?.state === 'invalid' ? 'Invalid/unsafe value withheld' : 'Not reported in response';
  const locale = l => `${l.language}${l.region ? `-${l.region}` : ''}${l.closedCaptions !== undefined ? ` (CC ${l.closedCaptions})` : ''}`;
  const language = f => f?.state === 'reported' ? `Reported: ${f.ukrainian.map(locale).join(', ')}` :
    f?.state === 'not-listed-completeness-unknown' ? `Not listed; completeness unknown. Returned: ${f.returnedLocales.map(locale).join(', ') || '(empty list)'}` : value(f);
  add('p', `${synthetic ? 'SYNTHETIC ONLY — invented options/prices/locales; no API contacted. ' : ''}Status: ${result.status}. Aggregator report, not account entitlement or guaranteed current availability.`);
  add('p', `Country: UA · Received: ${result.receivedAt} · Source: ${result.source}`);
  const attribution = add('p', 'Streaming availability information provided by ');
  const link = document.createElement('a'); link.textContent = 'Streaming Availability API by Movie of the Night';
  link.href = 'https://www.movieofthenight.com/about/api'; attribution.append(link);
  add('p', `Identity: ${result.identity?.status ?? 'not established'}. ${result.httpStatus ? `HTTP ${result.httpStatus}.` : ''}`);
  if (result.identity) add('p', `${value(result.identity.title)} · ${value(result.identity.year)} · ${value(result.identity.imdbId)}`);
  if (result.identity?.warnings?.length) add('p', result.identity.warnings.join(' '));
  add('p', 'UHD is not HDR10/Dolby Vision. Audio locale is not codec/channel layout. List completeness is not established; a missing Ukrainian locale is not confirmed absence.');
  if (result.optionsState === 'withheld-identity') add('p', 'UA options withheld by identity gate; the UA list was not evaluated. This is not an empty UA result or evidence of unavailability.');
  else if (!result.options?.length) add('p', `No UA options established (${result.optionsState ?? result.uaField ?? 'response not available'}). This does not mean the film is unavailable in Ukraine.`);
  for (const [i, option] of (result.options ?? []).entries()) {
    add('h3', `UA option ${i + 1}: ${value(option.service.name)} [${value(option.service.id)}]`);
    const access = ({ rent: 'rental', buy: 'purchase', subscription: 'subscription', free: 'free', addon: 'addon subscription' })[option.access.value] ?? value(option.access);
    const price = option.price.state === 'reported' ? `${value(option.price.amount)} ${value(option.price.currency)}` : value(option.price);
    add('pre', `Access: ${access}\nAddon: ${value(option.addon.name)}\nExact link (not opened): ${value(option.link)}\nUkrainian audio: ${language(option.ukrainianAudio)}\nUkrainian subtitles: ${language(option.ukrainianSubtitles)}\nVideo quality: ${value(option.quality)}\nPrice/currency: ${price}`);
  }
  if (result.issues?.length) add('pre', result.issues.join('\n'));
}
