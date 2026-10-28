// Authored markup/films, not reconstructed source HTML or live coverage. Tests
// exercise the independently reviewed production person records below;
// other records are authored. No availability/track assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIRMED_DIRECTOR_ALIASES, createDirectorAliasLookup, projectDirectorPeople } from '../shared/director-alias-crosswalk.mjs';
import { fetchAssistedKinobaza } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { projectTmdbIdentityFor } from '../research/grounded-answer-demo/tmdb.mjs';
import { createMediaAdviceHandler } from '../netlify/functions/media-advice.mjs';
import { CARD, markup } from '../research/grounded-answer-demo/test/assisted-kinobaza.fixture.mjs';
import { IDS, detailsData, providersData, motnData } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';

const PERSON = 999999;
const record = (extra = {}) => ({ namespace: 'tmdb:person', personId: PERSON,
  aliases: ['Vérified Person'], scope: 'kinobaza-director-identity',
  evidence: { source: 'Authored fixture, not a real person', reference: 'test:authored-person-record', verifiedAt: '2026-10-23' }, ...extra });
const person = (extra = {}) => ({ namespace: 'tmdb:person', personId: PERSON, names: ['Authored director'], ...extra });
const film = { id: 'authored-person-film', tmdbId: IDS[0], imdbId: `tt${IDS[0]}`,
  identityTitle: 'Вигаданий фільм', originalTitle: 'Authored original', year: 2001,
  titleAliases: [], directorCount: 1, directorAliases: ['Authored director'], directorPeople: [person()] };
const htmlResponse = html => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
async function identity({ selected = film, html = markup({ director: 'Vérified Person' }), records = [record()], sourceURL = CARD } = {}) {
  const urls = [];
  const result = await fetchAssistedKinobaza(sourceURL, selected, async (url, init) => {
    urls.push(url); assert.equal(url, sourceURL); assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
    return htmlResponse(html);
  }, { directorAliasLookup: createDirectorAliasLookup(records) });
  assert.deepEqual(urls, [sourceURL]);
  if (result.identity.status !== 'matched') {
    assert.deepEqual(result.candidates, []); assert.equal(result.localization, undefined);
    assert.equal(result.identity.directorAliasEvidence, undefined);
  }
  return result;
}

test('reviewed real alias is immutable and person-scoped; authored films are not live coverage evidence', async () => {
  assert.equal(CONFIRMED_DIRECTOR_ALIASES.length, 2); assert.equal(Object.isFrozen(CONFIRMED_DIRECTOR_ALIASES), true);
  assert.deepEqual(CONFIRMED_DIRECTOR_ALIASES[0].aliases, ['Денні Вільньов']);
  const selected = { ...film, directorAliases: ['Дені Вільнев', 'Denis Villeneuve'],
    directorPeople: [person({ personId:137427, names: ['Дені Вільнев', 'Denis Villeneuve'] })] };
  for (const [index, personId] of [137427,137427,PERSON].entries()) {
    const movie = { ...selected, identityTitle:`Вигаданий приклад ${index}`, originalTitle:`Authored example ${index}`, year:2001+index,
      directorPeople:[person({personId,names:selected.directorAliases})] };
    const result = await fetchAssistedKinobaza(CARD, movie, async () => htmlResponse(markup({ title:movie.identityTitle,original:movie.originalTitle,year:movie.year,director:'Денні Вільньов' })));
    assert.equal(result.identity.status, personId === 137427 ? 'matched' : 'unresolved');
    if(personId === 137427) assert.equal(result.identity.directorAliasEvidence.personId,137427);
    else { assert.equal(result.identity.reason,'director-alias-unestablished'); assert.deepEqual(result.candidates,[]); assert.equal(result.localization,undefined); }
  }
  for(const change of [{stable:`<tr><td>IMDb:</td><td>tt${IDS[1]}</td></tr>`},{title:'Unrelated authored film'},{year:1999}]) {
    const result = await fetchAssistedKinobaza(CARD, selected, async () => htmlResponse(markup({director:'Денні Вільньов',...change})));
    assert.equal(result.identity.status,'mismatch'); assert.deepEqual(result.candidates,[]); assert.equal(result.localization,undefined);
  }
});

test('reviewed Gillespie spelling is person-scoped across films, never a Supergirl or spelling-similarity exception',async()=>{
  const reviewed=CONFIRMED_DIRECTOR_ALIASES.find(r=>r.personId===50767);
  assert.deepEqual(reviewed.aliases,['Крейґ Ґіллеспі']);assert.equal(reviewed.evidence.verifiedAt,'2026-10-28');
  assert.match(reviewed.evidence.source,/1967-09-01/);assert.equal(Object.isFrozen(reviewed.aliases),true);
  const selected={...film,directorAliases:['Крейґ Джиллеспай','Craig Gillespie'],directorPeople:[person({personId:50767,names:['Крейґ Джиллеспай','Craig Gillespie']})]};
  for(const [index,personId] of [50767,50767,578].entries()){
    const movie={...selected,identityTitle:`Авторський фільм ${index}`,originalTitle:`Invented film ${index}`,year:2000+index,directorPeople:[person({personId,names:selected.directorAliases})]};
    const result=await fetchAssistedKinobaza(CARD,movie,async()=>htmlResponse(markup({title:movie.identityTitle,original:movie.originalTitle,year:movie.year,director:'Крейґ Ґіллеспі'})));
    assert.equal(result.identity.status,personId===50767?'matched':'unresolved');
    if(personId===50767)assert.equal(result.identity.directorAliasEvidence.personId,50767);
    else{assert.equal(result.identity.reason,'director-alias-unestablished');assert.deepEqual(result.candidates,[]);assert.equal(result.localization,undefined);}
  }
  for(const change of [{director:'Крейг Гіллеспі'},{director:'Крейґ Ґіллеспі / Інша людина'},{stable:`<tr><td>IMDb:</td><td>tt${IDS[1]}</td></tr>`},{title:'Different authored film'},{year:1999}]){
    const result=await fetchAssistedKinobaza(CARD,selected,async()=>htmlResponse(markup({director:'Крейґ Ґіллеспі',...change})));
    assert.equal(result.identity.status,change.director?'unresolved':'mismatch');assert.deepEqual(result.candidates,[]);assert.equal(result.localization,undefined);
  }
  const ambiguous=await fetchAssistedKinobaza(CARD,{...selected,directorCount:2},async()=>htmlResponse(markup({director:'Крейґ Ґіллеспі'})));
  assert.equal(ambiguous.identity.reason,'director-scope-unestablished');assert.deepEqual(ambiguous.candidates,[]);assert.equal(ambiguous.localization,undefined);
});

test('lookup is exact, namespaced, scoped and carries authored confirmation provenance', () => {
  const lookup = createDirectorAliasLookup([record()]), result = lookup(person());
  assert.equal(result.status, 'confirmed'); assert.deepEqual(result.aliases, ['Vérified Person']);
  assert.equal(result.provenance.namespace, 'tmdb:person'); assert.equal(result.provenance.personId, PERSON);
  assert.equal(result.provenance.scope, 'kinobaza-director-identity'); assert.deepEqual(result.provenance.evidence, record().evidence);
  for (const input of [person({ personId: PERSON + 1 }), person({ namespace: 'imdb:person' }),
    person({ personId: null }), person({ personId: String(PERSON) }), person({ personId: 0 }), person({ personId: Number.MAX_SAFE_INTEGER + 1 })]) {
    assert.notEqual(lookup(input).status, 'confirmed'); assert.deepEqual(lookup(input).aliases, []);
  }
});

test('malformed compiled records fail closed rather than create partially trusted entries', () => {
  const malformed = [null, {}, record({ namespace: 'imdb:person' }), record({ personId: '999999' }), record({ personId: 0 }),
    record({ aliases: [] }), record({ aliases: [''] }), record({ aliases: ['bad\nvalue'] }), record({ aliases: [null] }),
    record({ scope: 'any-provider-any-purpose' }), record({ evidence: null }),
    record({ evidence: { source: 'Authored', reference: '', verifiedAt: '2026-10-23' } }),
    record({ evidence: { source: 'Authored', reference: 'test:authored', verifiedAt: 'not-a-date' } })];
  for (const value of malformed) assert.throws(() => createDirectorAliasLookup([value]), Error);
  assert.throws(() => createDirectorAliasLookup(null), Error);
});

test('duplicate person records and shared aliases never silently select a record or person', () => {
  for (const records of [[record(), record()], [record(), record({ personId: PERSON + 1 })]]) {
    const lookup = createDirectorAliasLookup(records);
    assert.equal(lookup(person()).status, 'ambiguous'); assert.deepEqual(lookup(person()).aliases, []);
    if (records[1].personId !== PERSON) {
      assert.equal(lookup(person({ personId: PERSON + 1 })).status, 'ambiguous');
      assert.deepEqual(lookup(person({ personId: PERSON + 1 })).aliases, []);
    }
  }
});

test('registry compilation is a snapshot: later caller mutation cannot add an alias', () => {
  const records = [record()], lookup = createDirectorAliasLookup(records);
  records[0].aliases.push('Injected after compilation'); records[0].personId = PERSON + 1;
  assert.deepEqual(lookup(person()).aliases, ['Vérified Person']);
  const returned = lookup(person());
  try { returned.aliases.push('Injected through lookup'); } catch {}
  assert.deepEqual(lookup(person()).aliases, ['Vérified Person']);
});

test('TMDb person IDs are retained from validated director projection with literal source names', () => {
  const data = detailsData(IDS[0]); data.credits.crew[0].original_name = 'Authored original person';
  const projection = projectTmdbIdentityFor(data, { tmdbId: IDS[0], imdbId: `tt${IDS[0]}` });
  assert.deepEqual(projection.metadata.directors.items[0].id, { state: 'reported', value: PERSON });
  assert.deepEqual(projectDirectorPeople(projection.metadata.directors), [person({ names: ['Authored director', 'Authored original person'] })]);
});

test('missing/invalid person IDs remain null, never guessed from film ID, name or raw unreported value', () => {
  for (const value of [undefined, null, 0, -1, 1.5, '999999', Number.MAX_SAFE_INTEGER + 1]) {
    const data = detailsData(IDS[0]); data.credits.crew[0].id = value;
    const projection = projectTmdbIdentityFor(data, { tmdbId: IDS[0], imdbId: `tt${IDS[0]}` });
    const projected = projectDirectorPeople(projection.metadata.directors);
    assert.equal(projected.length, 1); assert.equal(projected[0].personId, null);
    assert.deepEqual(projected[0].names, ['Authored director']);
  }
  for (const input of [undefined, null, {}, { state: 'invalid', items: [{ id: { state: 'reported', value: PERSON } }] }])
    assert.deepEqual(projectDirectorPeople(input), []);
  assert.equal(projectDirectorPeople({ state: 'reported', items: [{ id: { state: 'invalid', value: PERSON }, name: { state: 'reported', value: 'Authored director' } }] })[0].personId, null);
});

test('confirmed same-person spelling passes only existing NFC/whitespace/case normalization and carries evidence', async () => {
  const result = await identity({ html: markup({ director: 'VE\u0301RIFIED    PERSON' }) });
  assert.equal(result.identity.status, 'matched'); assert.equal(result.identity.reason, 'explicit-title-year-director-match');
  assert.equal(result.identity.directorAliasEvidence.personId, PERSON);
  assert.equal(result.identity.directorAliasEvidence.scope, 'kinobaza-director-identity');
  assert.deepEqual(result.identity.directorAliasEvidence.evidence, record().evidence);
  assert.ok(result.candidates.length > 0); assert.ok(result.localization);
});

test('existing exact selected alias still matches without a person ID or crosswalk attribution', async () => {
  const result = await identity({ selected: { ...film, directorPeople: [] }, html: markup(), records: [] });
  assert.equal(result.identity.status, 'matched'); assert.equal(result.identity.directorAliasEvidence, undefined);
});

test('a person crosswalk works for another film, not a per-film title/year exception', async () => {
  const selected = { ...film, id: 'authored-second-film', tmdbId: IDS[1], imdbId: `tt${IDS[1]}`,
    identityTitle: 'Інший вигаданий фільм', originalTitle: 'Second authored original', year: 2009 };
  const sourceURL = CARD + '-second';
  const result = await identity({ selected, sourceURL, html: markup({ url: sourceURL, title: selected.identityTitle,
    original: selected.originalTitle, year: selected.year, director: 'Vérified Person' }) });
  assert.equal(result.identity.status, 'matched'); assert.equal(result.identity.directorAliasEvidence.personId, PERSON);
});

for (const [name, selected, records = [record()]] of [
  ['different person ID', { ...film, directorPeople: [person({ personId: PERSON + 1 })] }],
  ['different namespace', { ...film, directorPeople: [person({ namespace: 'imdb:person' })] }],
  ['missing person ID', { ...film, directorPeople: [person({ personId: null })] }],
  ['missing person projection', { ...film, directorPeople: [] }],
  ['unrelated projected person names', { ...film, directorPeople: [person({ names: ['Unrelated projected name'] })] }],
  ['duplicate person records', film, [record(), record()]],
  ['shared spelling between people', film, [record(), record({ personId: PERSON + 1 })]],
]) test(`crosswalk is not established for ${name}`, async () => {
  const result = await identity({ selected, records });
  assert.equal(result.identity.status, 'unresolved'); assert.equal(result.identity.reason, 'director-alias-unestablished');
});

for (const observed of ['Verified Person', 'Vérified Other', 'Верiфайд Персон', 'Vérified Person / Other Person'])
  test(`unknown literal spelling stays unresolved: ${observed}`, async () => {
    const result = await identity({ html: markup({ director: observed }) });
    assert.equal(result.identity.status, 'unresolved'); assert.equal(result.identity.reason, 'director-alias-unestablished');
  });

for (const [name, selected, html] of [
  ['known multiple directors', { ...film, directorCount: 2, directorPeople: [person(), person({ personId: PERSON + 1 })] }, markup({ director: 'Vérified Person' })],
  ['one count with multiple person records', { ...film, directorPeople: [person(), person({ personId: PERSON + 1 })] }, markup({ director: 'Vérified Person' })],
  ['unknown selected group scope', { ...film, directorCount: null }, markup({ director: 'Vérified Person' })],
  ['two separately labelled source directors', film, markup({ director: 'Vérified Person', stable: '<tr><td>Режисер:</td><td>Other Person</td></tr>' })],
]) test(`no flat aliases bypass director group scope: ${name}`, async () => {
  const result = await identity({ selected, html });
  assert.equal(result.identity.status, 'unresolved'); assert.equal(result.identity.reason, 'director-scope-unestablished');
});

for (const [name, changes, reason] of [
  ['stable ID conflict', { stable: `<tr><td>IMDb:</td><td>tt${IDS[1]}</td></tr>` }, 'source-stable-id-conflict'],
  ['film title conflict', { title: 'Unrelated authored film' }, 'source-title-conflict'],
  ['year conflict without crosswalk', { year: 2009 }, 'source-year-conflict-without-stable-crosswalk'],
]) test(`confirmed director alias cannot override ${name}`, async () => {
  const result = await identity({ html: markup({ director: 'Vérified Person', ...changes }) });
  assert.equal(result.identity.status, 'mismatch'); assert.equal(result.identity.reason, reason);
});

test('stable-ID conflict retains precedence together with an unknown director spelling', async () => {
  const result = await identity({ html: markup({ director: 'Unknown authored director', stable: `<tr><td>IMDb:</td><td>tt${IDS[1]}</td></tr>` }) });
  assert.equal(result.identity.status, 'mismatch'); assert.equal(result.identity.reason, 'source-stable-id-conflict');
  assert.equal(result.identity.diagnostics.gates['director-alias'], 'not-evaluated');
});

test('HTTP browser person IDs/aliases are ignored; resolver receives only server-projected TMDb person records', async () => {
  const uuid = '00000000-0000-4000-8000-000000000001', calls = [], rpc = [];
  let selectedFilm;
  const handler = createMediaAdviceHandler({
    env: key => ({ TMDB_READ_ACCESS_TOKEN: 'AUTHORED_TMDB_KEY', MOTN_API_KEY: 'AUTHORED_MOTN_KEY' })[key] ?? '',
    client: { auth: { getUser: async () => ({ data: { user: { id: uuid } } }) }, rpc: async (_, args) => {
      rpc.push(args); return { data: { id: uuid, attempts: [] } };
    } },
    resolver: async selected => { selectedFilm = selected; return { status: 'not-evaluated-authored-resolver', result: null }; },
    fetchImpl: async (url, init) => {
      calls.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      if (url.includes('/find/')) return Response.json({ movie_results: [{ id: IDS[0], title: film.identityTitle, original_title: film.originalTitle }] });
      if (url.includes('/watch/providers')) return Response.json(providersData(IDS[0]));
      if (url.includes('movieofthenight')) return Response.json(motnData(IDS[0]));
      assert.ok(url.startsWith(`https://api.themoviedb.org/3/movie/${IDS[0]}?`));
      return Response.json(detailsData(IDS[0]));
    },
  });
  const response = await handler(new Request('https://app.example/.netlify/functions/media-advice', { method: 'POST',
    headers: { origin: 'https://app.example', authorization: 'Bearer AUTHORED', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'discover', groupId: uuid, formSession: uuid, imdbId: film.imdbId,
      directorCount: 1, directorAliases: ['Injected browser alias'], directorPeople: [person({ personId: PERSON + 1, names: ['Injected browser alias'] })],
      directorAliasLookup: true, confirmedDirectorAliases: [record({ aliases: ['Injected browser alias'] })] }),
  }));
  assert.equal(response.status, 200); assert.equal(calls.length, 4);
  assert.deepEqual(selectedFilm.directorPeople, [person()]); assert.deepEqual(selectedFilm.directorAliases, ['Authored director']);
  assert.doesNotMatch(JSON.stringify(rpc), /directorPeople|directorAliases|Injected|confirmedDirectorAliases/);
  const payload = await response.json(); assert.doesNotMatch(JSON.stringify(payload), /Injected browser alias|AUTHORED_TMDB_KEY|AUTHORED_MOTN_KEY/);
});

test('crosswalk module is pure compiled configuration, without fetching/persistence or runtime browser loading', async () => {
  const source = await readFile(new URL('../shared/director-alias-crosswalk.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|console\.|localStorage|sessionStorage|writeFile|appendFile|readFile|process\.env|document\.|window\./);
});
