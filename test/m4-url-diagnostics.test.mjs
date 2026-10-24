import test from 'node:test';
import assert from 'node:assert/strict';
import { describeCandidateURL } from '../scripts/m4-url-diagnostics.mjs';
import { runControlDiagnostic } from '../scripts/m4-control-diagnostic.mjs';
import { admitKinobazaURL } from '../research/grounded-answer-demo/assisted-kinobaza.mjs';
import { resolverQueries, tavilySearch } from '../netlify/lib/kinobaza-resolver.mjs';
import { detailsData, IDS } from '../research/grounded-answer-demo/test/film-workflow.fixture.mjs';

// Authored URL shapes, never a saved search response or historical owner URL.
const origin = 'https://kinobazaua.com';
const exact = `${origin}/titles/authored-card`;
const credentials = { tmdbToken: 'AUTHORED_TMDB_KEY', tavilyKey: 'AUTHORED_TAVILY_KEY' };
const jsonText = value => JSON.stringify(value);

test('URL diagnostics preserve supported exact spelling without claiming film identity', () => {
  const d = describeCandidateURL(exact);
  assert.equal(d.hostname, 'kinobazaua.com');
  assert.equal(d.originalPathname, '/titles/authored-card');
  assert.equal(d.parsedPathname, '/titles/authored-card');
  assert.equal(d.pathChangedByParser, false);
  assert.equal(d.admission, 'accepted');
  assert.equal(d.failedCheck, 'none');
  assert.equal(d.queryPresent, false);
  assert.equal(d.fragmentPresent, false);
  assert.match(d.expectedFormat, /kinobazaua\.com/);
  assert.match(d.expectedFormat, /\/titles\//);
  assert.doesNotMatch(jsonText(d), /identity-matched|correct-film|verified-film/);
});

test('rejected path shapes show the actual case, encoded spelling and final slash unchanged', () => {
  for (const path of ['/titles/authored-card/', '/titles/authored-card/subpage', '/titles/Authored-Card', '/titles/authored%2Fcard', '/']) {
    const input = origin + path;
    const d = describeCandidateURL(input);
    assert.equal(admitKinobazaURL(input), null);
    assert.equal(d.admission, 'rejected');
    assert.equal(d.failedCheck, 'exact-original-url-format');
    assert.equal(d.originalPathname, path);
    assert.equal(d.parsedPathname, new URL(input).pathname);
    assert.equal(d.pathChangedByParser, false);
    assert.ok(d.differences.length > 0);
  }
});

test('dot-path normalization is exposed as a difference, never used to admit the rewritten URL', () => {
  for (const path of ['/titles/authored/../card', '/titles/authored/%2e%2e/card', '/titles/authored/./card']) {
    const input = origin + path, d = describeCandidateURL(input);
    assert.equal(d.originalPathname, path);
    assert.equal(d.parsedPathname, new URL(input).pathname);
    assert.notEqual(d.originalPathname, d.parsedPathname);
    assert.equal(d.pathChangedByParser, true);
    assert.equal(d.admission, 'rejected');
    assert.ok(d.differences.length > 0);
  }
  const backslashes=describeCandidateURL(String.raw`https://kinobazaua.com\titles\authored-card`);
  assert.equal(backslashes.originalPathname,String.raw`\titles\authored-card`);
  assert.equal(backslashes.parsedPathname,'/titles/authored-card');
  assert.equal(backslashes.pathChangedByParser,true);assert.equal(backslashes.admission,'rejected');
});

test('query/fragment presence includes empty delimiters, never their values', () => {
  for (const tail of ['?PRIVATE_QUERY_VALUE=SECRET', '#PRIVATE_FRAGMENT_VALUE', '?', '#', '?PRIVATE_QUERY_VALUE#PRIVATE_FRAGMENT_VALUE', '?#']) {
    const d = describeCandidateURL(exact + tail);
    assert.equal(d.queryPresent, tail.includes('?'));
    assert.equal(d.fragmentPresent, tail.includes('#'));
    assert.equal(d.originalPathname, '/titles/authored-card');
    assert.equal(d.parsedPathname, '/titles/authored-card');
    assert.equal(d.admission, 'rejected');
    assert.doesNotMatch(jsonText(d), /PRIVATE_QUERY_VALUE|PRIVATE_FRAGMENT_VALUE|SECRET/);
  }
});

test('non-target hosts and authority secrets are not disclosed as URL diagnostics', () => {
  const outside = describeCandidateURL('https://untrusted.example/PRIVATE_PATH?PRIVATE_QUERY#PRIVATE_FRAGMENT');
  assert.equal(outside.hostname, null);
  assert.equal(outside.originalPathname, null);
  assert.equal(outside.parsedPathname, null);
  assert.equal(outside.admission, 'rejected');
  assert.ok(outside.redactions.length > 0);
  assert.doesNotMatch(jsonText(outside), /untrusted\.example|PRIVATE_PATH|PRIVATE_QUERY|PRIVATE_FRAGMENT/);
  for (const input of [
    'https://PRIVATE_USER:PRIVATE_PASSWORD@kinobazaua.com/titles/authored-card',
    'https://kinobazaua.com@untrusted.example/PRIVATE_PATH',
    'https://kinobazaua.com:443/titles/authored-card',
    'ftp://kinobazaua.com/titles/authored-card',
  ]) {
    const d = describeCandidateURL(input);
    assert.equal(d.admission, 'rejected');
    assert.doesNotMatch(jsonText(d), /PRIVATE_USER|PRIVATE_PASSWORD|PRIVATE_PATH|untrusted\.example/);
    assert.ok(d.differences.length > 0);
  }
});

test('unusual potentially private path components are explicitly withheld, including encoded credentials', () => {
  const authoredSecret = 'AUTHORED_PRIVATE_KEY_VALUE';
  const encodedSecret = [...authoredSecret].map(c => '%' + c.charCodeAt(0).toString(16).toUpperCase()).join('');
  for (const segment of [
    authoredSecret, encodedSecret,
    'd09ab7e0-44bf-4c79-9d3b-1e4193346535',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdXRob3JlZCJ9.privateSignature',
    'private@example.invalid', 'private%40example.invalid',
    'a'.repeat(96),
  ]) {
    const d = describeCandidateURL(`${origin}/titles/${segment}`, { secrets: [authoredSecret] });
    assert.ok(d.redactions.length > 0);
    assert.ok([d.originalPathname, d.parsedPathname].some(p => typeof p === 'string' && p.includes('[withheld]')));
    assert.ok(!jsonText(d).includes(segment), 'must not expose secret-like segment');
    assert.ok(!jsonText(d).includes(authoredSecret));
    assert.equal(d.admission, admitKinobazaURL(`${origin}/titles/${segment}`) ? 'accepted' : 'rejected');
  }
});

test('encoded labels, cross-segment credentials and password-shaped components cannot leak subsequent values',()=>{
  for(const path of ['/titles/api%2Dkey/shortvalue','/titles/auth%252Dtoken/shortvalue','/titles/token%2Fshortvalue','/titles/user:shortvalue','/titles/access=shortvalue']){
    const d=describeCandidateURL(origin+path);
    assert.ok(d.redactions.length>0);assert.match(jsonText(d),/\[withheld\]/);
    assert.doesNotMatch(jsonText(d),/shortvalue/);
  }
  const secret='tvly/dev/abcdef';
  for(const path of ['/titles/tvly/dev/abcdef','/titles/tvly%2Fdev/abcdef','/titles/tvly%252fdev%252fabcdef']){
    const d=describeCandidateURL(origin+path,{secrets:[secret]});
    assert.equal(d.originalPathname,'[withheld]');assert.equal(d.parsedPathname,'[withheld]');
    assert.doesNotMatch(jsonText(d),/abcdef|tvly|%2[fF]/);
  }
});

test('trusted URL hook cannot mutate regular output, cannot expose snippets, and is absent for invalid responses',async()=>{
  const data={results:[{url:exact,content:'PRIVATE_SNIPPET',score:99},{url:exact+'?PRIVATE_QUERY_VALUE'}]};
  const expected=await tavilySearch('AUTHORED_TAVILY_KEY',async()=>Response.json(data)).search('authored');
  let received;
  const traced=await tavilySearch('AUTHORED_TAVILY_KEY',async()=>Response.json(data),{onCandidateURLs:urls=>{received=[...urls];urls.length=0;throw Error('PRIVATE_HOOK_ERROR');}}).search('authored');
  assert.deepEqual(received,data.results.map(r=>r.url));assert.deepEqual(traced,expected);
  assert.doesNotMatch(jsonText(traced),/PRIVATE_QUERY_VALUE|PRIVATE_SNIPPET|PRIVATE_HOOK_ERROR/);
  let hooks=0;
  const invalid=await tavilySearch('AUTHORED_TAVILY_KEY',async()=>Response.json({results:'PRIVATE_BODY'}),{onCandidateURLs:()=>hooks++}).search('authored');
  assert.equal(hooks,0);assert.equal(invalid.status,'search-invalid-response');
});

test('malformed, non-string and oversized values fail closed without echoing source input', () => {
  for (const [value, failed] of [[null, 'string-input'], [{ url: exact }, 'string-input'], ['PRIVATE_NON_URL', 'url-parser'], [origin + '/titles/' + 'PRIVATE'.repeat(100), 'max-url-length']]) {
    const d = describeCandidateURL(value);
    assert.equal(d.admission, 'rejected');
    assert.equal(d.failedCheck, failed);
    assert.doesNotMatch(jsonText(d), /PRIVATE_NON_URL|PRIVATEPRIVATE/);
  }
  const nonstandard = describeCandidateURL('https:kinobazaua.com/titles/authored-card');
  assert.equal(nonstandard.admission, 'rejected');
  assert.equal(nonstandard.originalPathname, null);
  assert.ok(nonstandard.redactions.length > 0);
});

function fixtureFetch({ results = [], searchStatus = 200, searchError = false, firstStatus = 200 } = {}) {
  const calls = [];
  return { calls, fetchImpl: async (target, init) => {
    calls.push({ target, init });
    assert.equal(init.redirect, 'manual');
    assert.equal(init.credentials, 'omit');
    const u = new URL(target);
    if (u.pathname === '/3/search/movie') {
      assert.equal(init.method, 'GET');
      assert.equal(u.searchParams.get('query'), 'Blade Runner 2049');
      return firstStatus === 200 ? Response.json({ results: [{ id: IDS[0], original_title: 'Blade Runner 2049', release_date: '2017-01-01' }] }) : new Response('PRIVATE_IDENTITY_ERROR', { status: firstStatus });
    }
    if (u.hostname === 'api.themoviedb.org') {
      assert.equal(init.method, 'GET');
      assert.equal(u.pathname, `/3/movie/${IDS[0]}`);
      const details = detailsData(IDS[0]);
      details.original_title = 'Blade Runner 2049';
      details.release_date = '2017-01-01';
      return Response.json(details);
    }
    assert.equal(target, 'https://api.tavily.com/search', 'no card, destination, MOTN or alternate-provider request');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer AUTHORED_TAVILY_KEY');
    const body = JSON.parse(init.body);
    assert.equal(body.query, resolverQueries({ originalTitle: 'Blade Runner 2049', identityTitle: 'Вигаданий фільм', titleAliases: ['Авторський alias'], year: 2017, directorAliases: ['Authored director'] })[0]);
    assert.equal(body.search_depth, 'basic');
    assert.equal(body.auto_parameters, false);
    assert.equal(body.include_answer, false);
    assert.equal(body.include_raw_content, false);
    if (searchError) throw Error('PRIVATE_TRANSPORT_ERROR');
    return searchStatus === 200 ? Response.json({ results }) : new Response('PRIVATE_SEARCH_ERROR', { status: searchStatus });
  } };
}

test('URL-only control uses actual query/admission, one film, exactly two identity plus one search, zero card reads', async () => {
  const raw = [exact, exact + '/', exact + '?PRIVATE_QUERY_VALUE#PRIVATE_FRAGMENT_VALUE'];
  const mock = fixtureFetch({ results: raw.map(url => ({ url, content: 'PRIVATE_SNIPPET', score: 99 })) });
  const out = await runControlDiagnostic({ ...credentials, urlDiagnostic: true, fetchImpl: mock.fetchImpl });
  assert.equal(out.execution, 'local-diagnostic');
  assert.equal(out.mode, 'url-diagnostic');
  assert.equal(out.buildSha, null);
  assert.deepEqual(out.counts, { tmdb: 2, search: 1, cards: 0, total: 3 });
  assert.equal(mock.calls.length, 3);
  assert.equal(out.cases.length, 1);
  assert.equal(out.cases[0].film, 'Blade Runner 2049');
  assert.equal(out.cases[0].status, 'urls-inspected-no-html');
  assert.equal(out.cases[0].urlDiagnostics.length, 3);
  assert.deepEqual(out.cases[0].urlDiagnostics.map(d => d.admission), ['accepted', 'rejected', 'rejected']);
  assert.ok(out.cases[0].urlDiagnostics.every(d => d.originalPathname.startsWith('/titles/authored-card')));
  assert.doesNotMatch(jsonText(out), /PRIVATE_QUERY_VALUE|PRIVATE_FRAGMENT_VALUE|PRIVATE_SNIPPET|AUTHORED_TMDB_KEY|AUTHORED_TAVILY_KEY/);
});

test('empty/error URL-only search consumes its attempt and never permits alternate search or any card request', async () => {
  for (const options of [{ results: [] }, { searchStatus: 401 }, { searchStatus: 429 }, { searchStatus: 500 }, { searchStatus: 302 }, { searchError: true }]) {
    const mock = fixtureFetch(options);
    const out = await runControlDiagnostic({ ...credentials, urlDiagnostic: true, fetchImpl: mock.fetchImpl });
    assert.deepEqual(out.counts, { tmdb: 2, search: 1, cards: 0, total: 3 });
    assert.equal(out.cases.length, 1);
    assert.equal(out.cases[0].attempts.length, 3);
    assert.equal(mock.calls.length, 3);
    assert.doesNotMatch(jsonText(out), /PRIVATE_SEARCH_ERROR|PRIVATE_TRANSPORT_ERROR|AUTHORED_TMDB_KEY|AUTHORED_TAVILY_KEY/);
  }
});

test('URL-only identity failure consumes only actual calls, and missing keys cause zero source attempts', async () => {
  const mock = fixtureFetch({ firstStatus: 401 });
  const out = await runControlDiagnostic({ ...credentials, urlDiagnostic: true, fetchImpl: mock.fetchImpl });
  assert.deepEqual(out.counts, { tmdb: 1, search: 0, cards: 0, total: 1 });
  assert.equal(mock.calls.length, 1);
  assert.equal(out.cases.length, 1);
  const missing = await runControlDiagnostic({ urlDiagnostic: true, fetchImpl: () => assert.fail('missing key must not dispatch') });
  assert.equal(missing.mode, 'url-diagnostic');
  assert.deepEqual(missing.counts, { tmdb: 0, search: 0, cards: 0, total: 0 });
  assert.equal(missing.cases.length, 1);
});
