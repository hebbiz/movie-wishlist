// All upstream values are text nodes, never markup/attributes or fetched URLs.
const value = f => f?.state === 'reported' || f?.state === 'reported-empty' && Object.hasOwn(f, 'value') ? String(f.value) : `[${f?.state ?? 'not-evaluated'}]`;
const state = f => f?.state ?? 'not-evaluated';
export function renderTmdbCredits(document, parent) {
  parent.replaceChildren();
  const heading = document.createElement('h2'); heading.textContent = 'Credits / About'; parent.append(heading);
  const link = document.createElement('a'); link.href = 'https://www.themoviedb.org'; link.rel = 'noreferrer';
  const logo = document.createElement('img'); logo.src = '/tmdb-logo.svg'; logo.alt = 'TMDB'; logo.width = 110; logo.style.height = 'auto'; link.append(logo); parent.append(link);
  const notice = document.createElement('p'); notice.textContent = 'This product uses the TMDB API but is not endorsed or certified by TMDB.'; parent.append(notice);
  const jw = document.createElement('p'); jw.textContent = 'Watch Providers data: JustWatch, via TMDB. Shared JustWatch lineage is not independent confirmation of Kinobaza.'; parent.append(jw);
}
export function renderTmdbResult(document, parent, result, synthetic) {
  parent.replaceChildren();
  const add = (tag, text) => { const el = document.createElement(tag); el.textContent = text; parent.append(el); };
  if (synthetic) add('p', 'SYNTHETIC ONLY — authored metadata/providers. No API/network, real Ukrainian catalogue/availability or independent identity validation.');
  add('p', `Source: TMDB · Country: UA · Metadata locale: uk-UA · Application HTTP requests made: ${result.requestsMade}`);
  const a = result.identity, b = result.providers;
  add('h3', 'A — Identity / catalogue metadata (not offer tracks)');
  add('p', `Status: ${a.status} · Identity: ${a.identity?.status ?? 'not-evaluated'} · HTTP: ${a.httpStatus ?? 'not-requested'} · Received: ${a.receivedAt ?? 'not-requested'}`);
  if (a.identity) add('pre', `TMDb ID: ${value(a.identity.tmdbId)}\nDetails IMDb: ${value(a.identity.detailsImdb)}\nExternal IMDb: ${value(a.identity.externalImdb)}\nIMDb crosswalk: ${a.identity.crosswalk ?? 'unknown'}\n${a.identity.basis ?? ''}`);
  if (a.metadata) {
    const m = a.metadata;
    add('pre', `original_title: ${value(m.originalTitle)}\ntitle (requested uk-UA; may fall back): ${value(m.requestedTitle)}\nrelease_date: ${value(m.releaseDate)}\noriginal_language (film-level): ${value(m.originalLanguage)}\nspoken_languages (film-level): ${state(m.spokenLanguages)} ${(m.spokenLanguages.items ?? []).map(l => value(l.language)).join(', ')}\nexternal_ids resource: ${state(m.externalIds)}`);
    add('p', `Directors (job=Director): ${state(m.directors)}`);
    for (const d of m.directors.items ?? []) add('pre', `Person ID: ${value(d.id)} · ${value(d.name)} · original_name: ${value(d.originalName)}`);
    add('p', `Alternative titles — country tags are not language proof: ${state(m.alternativeTitles)}`);
    for (const t of m.alternativeTitles.items ?? []) add('pre', `${value(t.country)} · ${value(t.title)} · type: ${value(t.type)}`);
    add('p', `Release events — not current offers: ${state(m.releaseDates)}`);
    for (const c of m.releaseDates.items ?? []) {
      add('p', `Country: ${value(c.country)} · dates: ${state(c.dates)}`);
      for (const d of c.dates?.items ?? []) add('pre', `${value(d.date)} · type: ${value(d.type)} · language: ${value(d.language)}`);
    }
    add('p', `Translations — explicit catalogue text, not dubbing: ${state(m.translations)}`);
    for (const t of m.translations.items ?? []) add('pre', `${value(t.language)} / ${value(t.country)} · title: ${value(t.title)} · overview: ${state(t.overview)} · tagline: ${state(t.tagline)}`);
    add('p', `Ukrainian catalogue title evidence: ${a.localization.ukrainianCatalogueTitle}. ${a.localization.limits}`);
  }
  if (a.issues?.length) add('pre', a.issues.join('\n'));
  add('h3', 'B — Watch Providers / actual results.UA');
  add('p', `Source: TMDB / JustWatch · Status: ${b.status} · HTTP: ${b.httpStatus ?? 'not-requested'} · Received: ${b.receivedAt ?? 'not-requested'} · UA field: ${b.uaState ?? 'not-evaluated'}`);
  if (b.status === 'not-requested') add('p', `B not requested: ${b.reason} This is not an empty UA result.`);
  add('pre', `TMDb country watch-page link (not provider deep link; not opened): ${value(b.watchLink)}`);
  for (const bucket of b.buckets ?? []) {
    add('h4', `${bucket.name} — ${bucket.access} · ${state(bucket.providers)}`);
    for (const p of bucket.providers.items ?? []) add('pre', `Provider: ${value(p.name)} [${value(p.id)}]\nSource display_priority (not confidence): ${value(p.displayPriority)}\nlogo_path (not fetched): ${value(p.logoPath)}`);
  }
  add('p', b.limits ?? 'Missing/null/empty UA or buckets do not prove unavailable. No provider tracks, prices, video quality or account entitlement established.');
  add('p', 'Additional information to compare manually: stable-ID crosswalk, aliases/directors/dates, explicit catalogue translation labels and UA access buckets. These do not complete MOTN offer characteristics or provide provider URLs. No automatic accuracy score or new card check.');
}
