// All upstream values are text nodes, never markup/attributes or fetched URLs.
const value = f => f?.state === 'reported' ? String(f.value) : `[${f?.state ?? 'not-evaluated'}]`;
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
  const add = (tag, text, host = parent) => { const el = document.createElement(tag); el.textContent = text; host.append(el); return el; };
  const details = (label, kind) => {
    const el = document.createElement('details'); el.dataset.tmdbDetails = kind;
    add('summary', label, el); parent.append(el); return el; // Collapsed, no fetch/storage.
  };
  if (synthetic) add('p', 'SYNTHETIC ONLY — authored metadata/providers. No API/network, real Ukrainian catalogue/availability or independent identity validation.');
  add('p', `Source: TMDB · Country: UA · Metadata locale: uk-UA · Application HTTP requests made: ${result.requestsMade}`);
  const a = result.identity, b = result.providers;
  add('h3', 'A — Identity / catalogue metadata (not offer tracks)');
  add('p', `Status: ${a.status} · Identity: ${a.identity?.status ?? 'not-evaluated'} · HTTP: ${a.httpStatus ?? 'not-requested'} · Received: ${a.receivedAt ?? 'not-requested'}`);
  if (a.identity) add('pre', `TMDb ID: ${value(a.identity.tmdbId)} · Details IMDb: ${value(a.identity.detailsImdb)} · External IMDb: ${value(a.identity.externalImdb)}\nIMDb crosswalk: ${a.identity.crosswalk ?? 'unknown'}`);
  const resources = Object.entries(a.resources ?? {});
  if (resources.length) add('pre', resources.map(([name, resource]) => `Appended resource ${name}: ${state(resource)}`).join('\n'));
  if (a.metadata) {
    const m = a.metadata;
    add('pre', `title (requested uk-UA; may fall back): ${value(m.requestedTitle)}\noriginal_title: ${value(m.originalTitle)} · core release_date (not UA-specific): ${value(m.releaseDate)}\noriginal_language / spoken_languages (film-level): ${value(m.originalLanguage)} / ${state(m.spokenLanguages)} ${(m.spokenLanguages.items ?? []).map(l => value(l.language)).join(', ')}`);
    add('p', `Directors (job=Director): ${state(m.directors)}`);
    for (const d of m.directors.items ?? []) add('p', value(d.name));
    const aliases = m.alternativeTitles.items ?? [], releases = m.releaseDates.items ?? [], translations = m.translations.items ?? [];
    const ua = c => c.country?.value === 'UA', uk = t => t.language?.value === 'uk';
    add('p', `UA alternative titles — country tag, not language proof: ${state(m.alternativeTitles)}`);
    if (!aliases.some(ua)) add('p', 'No explicit UA alias established; collection state above is not a UA match.');
    for (const t of aliases.filter(ua)) add('pre', `${value(t.title)} · type: ${value(t.type)}`);
    const release = (c, host = parent) => {
      add('p', `Country: ${value(c.country)} · dates: ${state(c.dates)}`, host);
      for (const d of c.dates?.items ?? []) add('pre', `${value(d.date)} · type: ${value(d.type)} · language: ${value(d.language)}`, host);
    };
    add('p', `UA release events — not current offers: ${state(m.releaseDates)}`);
    const uaReleases = releases.filter(ua);
    if (!uaReleases.length) add('p', 'No explicit UA release-event group established; not a statement of availability.');
    for (const c of uaReleases) release(c);
    const others = releases.filter(c => !ua(c));
    if (others.length) {
      const extra = details(`Other / unknown territories: release events (${others.length} groups)`, 'release-dates');
      for (const c of others) release(c, extra);
    }
    const translation = (t, host = parent) => add('pre', `${value(t.language)} / ${value(t.country)} · title: ${value(t.title)} · overview: ${state(t.overview)} · tagline: ${state(t.tagline)}`, host);
    add('p', `Translations — explicit catalogue text, not dubbing: ${state(m.translations)} (showing uk by default)`);
    const ukTranslations = translations.filter(uk);
    if (!ukTranslations.length) add('p', 'No explicit uk translation entry established; not evidence of missing provider localization.');
    for (const t of ukTranslations) translation(t);
    add('p', `Ukrainian catalogue title evidence: ${a.localization.ukrainianCatalogueTitle}. Catalogue text / film languages / release events do not prove provider audio or subtitles.`);
    const extra = details('Other aliases / translations and technical metadata', 'metadata');
    add('p', a.identity?.basis ?? 'Identity basis not evaluated.', extra);
    add('p', a.localization.limits, extra);
    add('p', 'Resource states do not assert field completeness.', extra);
    for (const d of m.directors.items ?? []) add('pre', `Person ID: ${value(d.id)} · ${value(d.name)} · original_name: ${value(d.originalName)}`, extra);
    for (const t of aliases.filter(t => !ua(t))) add('pre', `Alias: ${value(t.country)} · ${value(t.title)} · type: ${value(t.type)}`, extra);
    for (const t of translations.filter(t => !uk(t))) translation(t, extra);
  }
  if (a.issues?.length) add('pre', a.issues.join('\n'));
  add('h3', 'B — Watch Providers / actual results.UA');
  add('p', `Source: TMDB / JustWatch · Status: ${b.status} · HTTP: ${b.httpStatus ?? 'not-requested'} · Received: ${b.receivedAt ?? 'not-requested'} · UA field: ${b.uaState ?? 'not-evaluated'}`);
  if (b.status === 'not-requested') add('p', `B not requested: ${b.reason} This is not an empty UA result.`);
  add('pre', `TMDb country watch-page link (not provider deep link; not opened): ${value(b.watchLink)}`);
  for (const bucket of b.buckets ?? []) {
    add('p', `${bucket.name} — ${bucket.access} · ${state(bucket.providers)}${bucket.providers.items?.length ? `: ${bucket.providers.items.map(p => `${value(p.name)} [${value(p.id)}]`).join('; ')}` : ''}`);
  }
  add('p', 'Missing data is unknown, not unavailable. TMDB / JustWatch signals are not account entitlement; catalogue localization is not provider audio/subtitles.');
  if (b.buckets?.length) {
    const extra = details('Provider technical fields and interpretation limits', 'providers');
    for (const bucket of b.buckets) for (const p of bucket.providers.items ?? []) add('pre', `${bucket.name}: ${value(p.name)} [${value(p.id)}] · display_priority (not confidence): ${value(p.displayPriority)} · logo_path (not fetched): ${value(p.logoPath)}`, extra);
    add('p', b.limits ?? 'No provider tracks, prices, quality or entitlement established.', extra);
  }
}
