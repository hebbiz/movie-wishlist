# M4 — Mykola media advice

Status: M4.1–M4.3 implemented; default-off semantics retained. Earlier deployment,
assignment and cleanup evidence remains in its dated execution records below.
The #198–#200 successor changes are not merged/deployed by this task.
Current branch search strategy: **Tavily basic Search**, candidate URLs only,
with a bounded ordinary Kinobaza title-search fallback after first-card identity
refusal. [Five locked local controls passed URL/identity checks](#five-film-automatic-results--2026-10-24);
this is not catalogue-wide accuracy, track verification or new activation approval.
Gemini Google Search Grounding remains excluded from URL → HTML extraction.
See [Tavily decision/configuration](#tavily-search-replacement-2026-10-21),
the historical [Brave decision/data-flow audit](#brave-pilot-provider-decision-and-data-flow-audit-2026-10-21)
and the preserved [Gemini finding](#gemini-primary-resolver-feasibility-2026-10-21).
Canonical implementation record, not a second research architecture. Evidence and
source boundaries remain in [research proposal](../research/grounded-answer-demo/docs/regional-card-proposal.md).
Latest narrow source-parser change: [Mad Max markup recovery](#mad-max-noncritical-image-markup-recovery--2026-10-31).
Latest link-choice decision: [declared destinations and duplicate navigation](#link-choice-equivalence-and-justwatch-inspection--2026-10-31).

## Reviewed baseline and sequence

`develop` acbdadf8efa2d180a12ed3fc85aa7784bb681782 (2026-10-20).
Existing static add/edit form writes only on Save; no feature-capability system
exists. Group owner/member may edit; visitors may not. Migration files 001–016
are historical evidence, not proof of their deployed state. Owner checkout is
excluded from implementation.

1. **M4.1 — implemented, offline/browser-tested, live-unvalidated** isolated accessible form dialog, source-row selection, explicit
   medium/URL diff and local-only transfer. Capability fails closed until M4.2.
   Authored fixtures exist only in tests. No social-chat controller reuse.
2. **M4.2 — implemented, isolated SQL/mock-tested, live-unvalidated** authenticated Netlify boundary, backend-only per-user assignment,
   independently gated TMDb/MOTN and atomic technical ledger. New SQL only;
   migration application/production flags/secrets require separate authorization.
3. **M4.3 — implemented, mock/browser-tested, live-unvalidated** replaceable Tavily Search resolver, ≤2 queries and ≤2 sequential
   admitted Kinobaza card GETs; no redirect/retry/destination resolution.

Each stage has a separate stacked PR; no merge/deployment in this task.

## Contracts and invariants

### Pilot diagnostics and bounded controls — 2026-10-23

Implemented/offline-tested in the diagnostics PR, not deployed. Base develop
`5bd9f830eb665b2fa1ac4ad7eb2b384267bf37a7`; no matching/search-policy change.
The five-film pilot is owner-reported, not representative accuracy/coverage or
account entitlement. Transfer/Save is not attested. Historical reports print
`Commit: unknown`; they cannot be assigned a runtime SHA retroactively.

Owner evidence: Pursuit-title case screenshot7/8, search1/card2, two unexamined,
director-alias unresolved then heading-alias refusal; its earlier6/8 report is a
different/unlinked run, not combined. Exact year/IMDb remain unestablished.
Blade Runner2049:6/8, search2/card0; empty versus rejected-only URLs unknown.
Mortal Kombat2021:6/8, search1/card1, heading-alias refusal. Oppenheimer2023:7/8,
one matched card, one heading-alias refusal, two unexamined; useful Rakuten/MEGOGO
provider-block audio/subtitle claims and separate owner confirmation. Territory/
offer binding stay unestablished. Alien1979:7/8, two heading-alias refusals and
two unexamined; baseline Apple/Rakuten does not establish provider tracks.
None of these refusals alone proves another film, parser defect or unavailability.

**Correction to historical MOTN interpretation:** old M4 short reports read only
`kinobazaLocalization` for all rows, so their MOTN `unknown` does **not** establish
that language fields were absent in API responses. `row.audio/subtitles` retain
the adapter fields. New reports distinguish `not-reported (missing-or-null)`
(the adapter combines those), empty list, UK not listed/completeness unknown,
invalid-withheld and positive `reported-uk`. Kinobaza block claims remain separate;
no locale implies codec, entitlement, complete list or a cross-source offer join.

Search diagnostics contain only allowlisted status/outcome, returned/admitted/
rejected/duplicate counts and rejection categories. Admitted counts **unique
accepted URLs**; duplicate counts repeated accepted URLs, so returned equals
admitted + rejected + duplicates. Provider error counts are unknown, not zero.
`empty-response` differs from `all-rejected`. First two admitted URLs retain
provider order; exact deduplication/admission is unchanged. An alternative query
still requires a successful empty admitted set; never an identity-refusal retry.

Identity results add failed gate, existing structural counts, comparison flags
and evaluated/not-evaluated gates. Heading-alias non-match is described literally,
not as independently established different-film identity. Canonical/stable-ID
priority, exact aliases, no transliteration/fuzzy matching and withholding are
unchanged. `onIdentityDiagnostic` is an explicit **local trusted hook**, not an
HTTP/browser option. It transiently receives the admitted sourceURL, bounded
extracted H1/H2/year/directors, selected aliases and each gate result. Actual
source values are absent from ordinary identity diagnostics/short reports/ledger.
Truncation/structural limits remain explicit; no first/convenient-heading choice.

Version provenance: a non-capability random UUID run ID is generated by the
server after successful finish, never accepted from browser JSON. New
`netlify.toml` sets **only the develop branch build command** to
`node scripts/stamp-media-advice-build.mjs`; publish/functions settings remain
in the existing dashboard, other deploy contexts unchanged. The script bundles
public identifiers only when Netlify branch/develop context, COMMIT_REF and Git
HEAD agree and DEPLOY_ID is valid. The handler additionally requires that bundled
deploy ID match Netlify's server context. Missing/mismatched stamp => SHA unknown.
No API lookup or additional source request. This is server build provenance, not
a cryptographic signature. Local controls always say `local-diagnostic`, SHA
unattested; copied browser text is not itself a trusted server artifact.
[Netlify documents](https://docs.netlify.com/build/functions/environment-variables/#netlify-read-only-variables)
that COMMIT_REF is not a guaranteed function-runtime variable; no new secret or
runtime env assignment is introduced. Real develop build/stamp remains unvalidated
until a separately approved merge/deploy; this task performs neither.

`scripts/m4-control-diagnostic.mjs --live-control` prepares exactly Blade Runner
2049 and Mortal Kombat2021. No catalogue IDs or source slugs are invented. Up to
four TMDb identity requests (one explicit title search + one appended Details per
film) establish a **unique exact original-title** candidate and stable crosswalk;
Mortal Kombat additionally requires2021. No first-result fallback. A failed or
ambiguous identity stops that case before Tavily. Then the existing resolver/
admission/identity/extraction functions run with unchanged policy. Caps across
both cases: TMDb4 + Tavily4 + Kinobaza4 = **12 source HTTP attempts**, including
errors, at most6 per case.45s per-case source deadline; no retries/redirects,
MOTN, Watch Providers, production proxy, destination fetch, DB or Wishlist write.
This local bounded harness is not a replacement for the deployed atomic ledger.

**Earlier credential-free preflight:** blocked before dispatch, both
`TMDB_READ_ACCESS_TOKEN` and `TAVILY_API_KEY` absent in the local process. Both
cases not-run; TMDb0 / Tavily0 / Kinobaza0, total0/12. No identity/result or new
historical root cause is claimed. Existing Netlify Functions-only Secret values
are not an exportable local credential handoff; no value read, printed, copied
or changed. This zero-attempt result predates the owner's authorization of
one-time local hidden input; it is not an executed live control.

**Hidden local continuation implemented:** `scripts/m4-control-password-prompt.ps1`
requires PowerShell7, the installed Node22+ and an exact `-ExpectedCommit` checkout
with no tracked modifications. Two `Read-Host -AsSecureString` inputs immediately
start the existing controls, once; do not restart after an uncertain/interrupted
run. Credentials go only through redirected child stdin (`--credentials-stdin`),
not argv, environment assignments, files, DPAPI blobs, clipboard or logs. The
strict bounded stdin contract accepts exactly the two credentials, with no env
fallback for malformed/missing input. Inherited Node preload/debug/TLS-bypass
settings are removed from this child. Never use a transcript/recorded terminal.
Managed strings are released best-effort; perfect memory zeroization is not
claimed, and this does not change OS paging/crash-dump policy.

After completion the helper clears credential references and keeps only the
minimal safe diagnostic result in a single current-user-only **local named pipe**
`mw-m4-controls-198`, for up to15 minutes including transfer. No TCP listener or
result archive. Leave the prompt window open and notify Codex immediately;
the result can be received in the same Windows token context, with only needed
findings recorded in this section/PR. Receiver failure does not authorize another source run. Local
checkout SHA is reported separately, never as deployed runtime attestation.
The final copyable CMD/Termius command must pin the actual helper commit SHA
with `-ExpectedCommit`; no source credential value belongs in that command.
The owner executed the authorized hidden-input controls; evidence follows below.
No owner movie retest or Netlify secret export is requested.

**Result-handoff limitation:** owner subsequently reported `local prompt
completed`; reading the existing pipe from the agent returned `Access denied`,
including outside the sandbox and with a standard read-only pipe client.
Windows `CurrentUserOnly` checks account **and elevation level**. Different
SSH/desktop token contexts are a plausible explanation, not an independently
proven exact token diagnosis. Same-context native authored IPC tests did not
cover this boundary. Server ACL is not loosened, no process-memory dump/debugger
attachment and no source rerun. `scripts/m4-read-control-result.ps1` is a bounded
read-only receiver for a **second terminal in the same SSH context** while the
original helper still waits; it prints only the already-sanitized diagnostic
JSON for handoff, with no credential prompt, HTTP call or file write. The owner
successfully used it and pasted a safe result excerpt; the excerpt is truncated
in the second case, not an independently captured/complete machine JSON artifact.
No ACL change or source rerun was used to recover it. Expiry/lost results would
not authorize repeating the controls.

**Executed control result — 2026-10-23:** local checkout
`62c4a9a401899e29cd319af6f055bbd12661297b`, run
`3d9890e2-ca7b-4132-baa0-5586f719da11`, `execution=local-diagnostic`,
`buildSha=null`. This is owner-executed local diagnostic evidence, not deployed
runtime attestation or a reconstruction of historical pilot responses.

| Control | TMDb attempts | Tavily attempts | Kinobaza GET | Stop / evidence |
| --- | ---: | ---: | ---: | --- |
| Blade Runner 2049 | 2 | 1 | 0 | Both TMDb responses HTTP200; Tavily HTTP401 / `search-auth-error`. Explicit identity: TMDb335984, IMDbtt1856101, original title Blade Runner 2049,2017, English director alias Denis Villeneuve. |
| Mortal Kombat (2021 control) | 2* | 1 | 0 | Resolver fragment shows `search-auth-error`, one search/no cards. Its per-case attempts/IDs/year were omitted in the pasted excerpt. |
| Total | 4 | 2 | 0 | **6/12 attempts**; failed search attempts counted. |

\* Mortal's TMDb2 (and total3) is arithmetic from the aggregate minus the fully
shown Blade Runner case, not a directly pasted per-case counter. Its visible
`search-auth-error` maps only to HTTP401 in the adapter; the actual HTTP status
entry is omitted. Reaching search implies the harness's preceding TMDb gates
passed, but omitted identity values are not reconstructed or added to catalogue.

**Established stop:** Tavily authentication rejection, before successful search
results, URL admission or any Kinobaza identity/extraction. The request uses
`Authorization: Bearer <key>`; the existing adapter maps HTTP401 to
`search-auth-error` and immediately stops without an alternative query, retry,
Brave/Gemini fallback or card GET. Exact credential/account reason is unknown;
the error body is intentionally discarded. A syntactically admitted local key
is not evidence of a working Tavily credential. This result does **not** establish
that the Netlify credential has the same problem; no configured secret is read
or changed. Search `returned/admitted/rejected/duplicates=null` means provider
counts unavailable, **not** an empty response/all URLs rejected. Resolver
`candidates=0` is not proof there are no cards. Historical Blade Runner admission
and Mortal title-refusal causes therefore remain unknown. No observed/expected
Kinobaza title/director comparison was possible because card GETs were zero.

**Local diagnostic encoding fix:** Node emits UTF-8, but the original PowerShell
wrapper did not set child stdout decoding. The reported Cyrillic garbling is
reproducible by decoding authored UTF-8 as CP866; this is a supported local
handoff defect, not evidence of malformed upstream director aliases. The wrapper
now explicitly uses UTF-8 for redirected stdout/stderr, and the read-only reader
emits ASCII-escaped JSON to survive legacy CMD/SSH code pages. The exact point(s)
of historical display corruption are not fully attested. Node's in-process
matching/search data and HTTP authorization policy are unchanged; output encoding
does not explain the Tavily401. No attempt is made to repair pasted names into
new aliases. No new source calls were made for this fix.

At that stage, the next prerequisite was a valid Tavily credential/account check
by its holder, not a parser/search-policy change. No key is requested in chat and no automatic
source repeat is authorized by the unused part of the cap. No new owner pilot
or additional paste is needed to establish this stop; any further live
continuation must explicitly account for the six spent attempts and its scope.

Final continuation checks: **32/32** targeted credential/diagnostics/resolver
tests passed. They include strict stdin/EOF, malformed/oversize/cancelled input,
no env fallback, authored child errors with zero network traffic, PowerShell7 AST,
native same-context current-user-only named-pipe round trip, read-only receiver,
Unicode preservation under process-local CP866, exact6 accounting for two mocked
401 controls with unknown provider counts/no retries/cards, existing cap12,
withholding, admission and source isolation. These are not live validation or
proof of SSH/desktop cross-token IPC compatibility.
Source adapters, resolver policy, serverless ledger and application lifecycle
remain unchanged; no new full browser/Windows-demo lifecycle run is needed for
this isolated credential wrapper.

**Separately authorised repeat — 2026-10-23:** after suspecting incorrect local
Tavily input, the owner explicitly approved one new run of the same controls,
with its own cap12 and no automatic retries/policy change. Owner-forwarded safe
excerpt: run`5a481f68-1e0f-4b73-83ea-732fa143a4e9`, local checkout
`20ed54c527ec953b2fa63812225f360d16148a14`, `execution=local-diagnostic`,
`buildSha=null`. Its Mortal fragment is again truncated and one escaped director
string is broken by the pasted line wrap; this is not a complete parseable JSON
artifact. Only visible facts and explicitly identified code-path deductions are
recorded. No omitted identity/URLs or historical source responses reconstructed.

| Control | TMDb | Tavily | Kinobaza GET | Visible search result / stop |
| --- | ---: | ---: | ---: | --- |
| Blade Runner 2049 | 2 | 2 | 0 | All four attempt entries HTTP200. Each search `ok/all-rejected`, returned1/admitted0/rejected1/duplicates0, `unsupported-path:1`. Final `no-admitted-search-candidates`. |
| Mortal Kombat (2021 control) | 2 | 2 | 0 | Per-case counters visible. Two TMDb200 and first search200 visible; first diagnostic fragment rejected5/duplicates0, `query:1`, `unsupported-path:4`. Second diagnostic complete: `ok/all-rejected`, returned5/admitted0/rejected5/duplicates0, `unsupported-path:5`. Final `no-admitted-search-candidates`. |
| Repeat total | 4 | 4 | 0 | **8/12 attempts**; no card, MOTN, Watch Providers or destination requests. |

The exact second Mortal HTTP status and its identity values are not visible;
`ok` establishes a successful 2xx provider result, not an independently pasted
HTTP200 entry. Dispatching the alternative requires the first search's `ok`
status with zero admitted URLs; that first outcome/returned count are code-path
deductions, not restored missing report fields. Blade identity is again explicitly
TMDb335984 / IMDbtt1856101 / original title Blade Runner 2049 /2017, with English
director alias Denis Villeneuve. Mortal's stable IDs are not invented.

**What this establishes:** the local Tavily credential/request was accepted in
this run. Search was non-empty where shown, but **URL admission rejected every
candidate before HTML retrieval**. It is no longer an auth stop. This does not
identify the precise cause of the earlier401 or attest Netlify configuration.
The previous run remains6 attempts; the new run8, so **14 source HTTP attempts
across two separately authorised runs** (TMDb8/Tavily6/Kinobaza0). They are not
one run with an enlarged production budget. Unused cap does not authorise a third
run or more search calls. The historical five-film owner pilot is separate.

**Offline rule audit:** `admitKinobazaURL` accepts only the original exact
`https://kinobazaua.com/titles/<lowercase-ascii-hyphenated-slug>` spelling, no
query/fragment, trailing slash, subpage, credentials, explicit port, alternate
host or encoded/path-normalisation tricks. Diagnostic classification uses the
first applicable category: scheme → credentials → port → host → query → fragment
→ normalised pathname shape → spelling. `unsupported-path` proves a failed path
shape test, **not specifically a trailing slash**, and `query` can mask another
path problem. Authored examples show trailing slash, subpage, root path,
underscore/uppercase slug all produce the same broad path category; query on a
bad subpage is still labelled `query`. None reconstructs a live search URL.
`duplicates=0` counts no repeated **accepted** URLs, not uniqueness of rejected
URLs within/across searches. Do not describe these responses as distinct cards.

**Limits / proposed next narrow step:** actual rejected URLs/path components are
not in this report and were not archived. No evidence yet distinguishes a valid
card shape rejected too narrowly from a genuinely irrelevant/non-card result;
admission broadening, slash/query stripping, redirect resolution, alternate
host support or matching fixes are not justified. No Kinobaza H1/H2/year/director
comparison ran. Historical Mortal title refusal and the exact historical Blade
search result remain unknown; this current run is not their reconstruction.

If separately authorised, the smallest next probe is **Blade Runner 2049 only**:
up to2 TMDb identity calls + **one** Tavily basic call using the same established
identity/query builder, total≤3; **zero Kinobaza/provider GET**, no alternate
query/retry/redirect. Inspect rejected URLs only in trusted invocation memory;
emit bounded allowlisted path-shape facts (title-path vs other, segment count,
trailing slash, slug grammar/encoding flags, query-present), not query values,
tokens, snippets, raw responses or a URL archive. Stop on identity ambiguity,
auth/transport/quota error or no response URLs. That proposal is not executed or
authorised here; it tests URL-shape admission only, not card identity/extraction.
No owner pilot repeat or source-policy change is proposed as a substitute for
the missing evidence.

**URL-only probe authorised and prepared — 2026-10-23:** the owner subsequently
approved precisely that one Blade Runner run, with actual safe path evidence.
`scripts/m4-control-password-prompt.ps1 -UrlDiagnostic -ExpectedCommit <pinned
SHA>` reuses the hidden stdin credential handoff and immediately runs
`scripts/m4-control-diagnostic.mjs --live-control --credentials-stdin
--url-diagnostic`. This is a separate explicit mode, **not** the old two-film
controls. Before each dispatch it enforces TMDb≤2, Tavily≤1, cardGET=0,total≤3;
errors spend attempts, no alternative query/retry/redirect. Existing TMDb
identity selection/crosswalk and the first result of the unchanged
`resolverQueries` builder are reused; the real bounded Tavily basic adapter
parses the search response. No second film, MOTN, Watch Providers, card/provider
fetch or destination resolution. Both Windows helpers validate the cap3,
Blade-only, card0 result contract. Prior14 attempts remain separate; cumulative
maximum17. A fresh run UUID is generated on execution. Execution was initially
pending hidden entry; the subsequent screenshot result is recorded below.

`tavilySearch` has an optional trusted `onCandidateURLs` callback, receiving only
up to5 URL strings from a validated response in invocation memory. It is not an
HTTP/browser parameter and receives no snippets/score/body; normal adapter output
and admission are computed before it runs, and callback failure/mutation cannot
alter that output. The ordinary resolver does not supply this hook, so detailed
paths never enter its client projection, short report, ledger or logs.

Local `scripts/m4-url-diagnostics.mjs` uses the **actual** `admitKinobazaURL`
decision, with literal expected format, failed original-format check and specific
differences (trailing slash, additional segments, uppercase/encoded path,
query/fragment, authority spelling, parser normalization). Only a parsed exact
`hostname=kinobazaua.com` permits path display. `originalPathname` is sliced from
the original URL **before** parsing normalization and ends before query/fragment;
`parsedPathname` is `URL.pathname`. Safe case, percent-escape spelling and final
slash are preserved in each, with `pathChangedByParser` separately reported.
This compares values, never rewrites/admits/fetches a normalized URL. Query and
fragment values/names are absent; only presence flags, including empty`?`/`#`.
Foreign hosts, userinfo/abnormal authority, oversized or unusual structures are
withheld explicitly. Secret echoes (including encoded/cross-segment variants),
token/credential-like labels, emails, UUID/JWT/long opaque or suspicious segments
are `[withheld]` with a reason; following components are also withheld. Decoding
is bounded and **detection-only**, never a displayed alias/canonicalization.
Conservative diagnostic redaction does not change the actual admission decision.

Authored output example only, not a live result: original and parsed path both
`/titles/Authored-card/`, rejected by `exact-original-url-format`, with specific
`trailing-slash-not-allowed` and `uppercase-path-not-allowed` differences. A dot
path shows both the raw and parser-normalized paths instead of silently fixing
it. Without HTML the result explicitly says `not-evaluated-no-html-fetch`; even
an accepted pointer is **not** proof of the correct film or source claims.

Use the existing second-terminal same-SSH reader within15 minutes after
`Controls completed`; optional `-Compact` emits a single JSON line to reduce
manual copy truncation. It reads only the safe in-memory result with ASCII JSON
escaping; no key/file/clipboard persistence or archive is added. Keys enter only
hidden prompts, not command arguments; no Netlify configuration/secrets read or
changed. Record only minimum safe findings in this section/PR after execution,
not full HTML/search responses. Existing application retention/TTL, request
bodies/budgets, `initApp`, draft and production boundaries are unchanged.

URL-mode preparation validation: **44/44** targeted offline/HTTP/helper tests
passed, including real query-builder/admission reuse, cap3 with valid/empty/error
results, identity-stop accounting, no card/alternative/destination request,
literal vs parser-normalized path, empty query/fragment markers, foreign host/
userinfo withholding, encoded and cross-segment key echoes, token/email/JWT/UUID/
opaque components, hook mutation/error isolation and unchanged normal output,
UTF-8/legacy-codepage handoff and mode-specific hidden-stdin CLI. Reviewer found
initial encoded-label/cross-segment redaction gaps; hardened detection and authored
regressions close those before any live execution. Local links/anchors and
whitespace pass. No new browser/app-demo/SQL-concurrency/lifecycle suite: no UI,
launcher, SQL or public endpoint contract changed. These checks are synthetic,
not live validation of the returned URL shape, card identity or source coverage.

**URL-only result received — 2026-10-23 (owner screenshot):** the visible safe
JSON records Blade Runner 2049, `TMDb2 / Tavily1 / Kinobaza0 / total3`, all three
attempts `response-received / HTTP200`, status`urls-inspected-no-html` and card
identity`not-evaluated-no-html-fetch`. The screenshot begins mid-envelope: run ID,
mode/build header and `localCheckoutSha` are **not visible**. The prepared pin was
`ea9a14b70eedef309b12590bee24a20d5c41ddd0`; it is not retroactively attested by
this cropped image. This is owner-forwarded local diagnostic evidence, not an
independent agent source request or deployed-runtime attestation. Only minimal
visible comparisons are transcribed, not the screenshot/full response in Git.

| Comparison | Visible value |
| --- | --- |
| Hostname | `kinobazaua.com` |
| Expected admitted path | `/titles/<lowercase-ascii-hyphenated-slug>` |
| Original pathname | `/persons/denis-villeneuve` |
| `URL.pathname` | `/persons/denis-villeneuve` |
| Parser changed path / query present / fragment present | false / false / false |
| Admission / failed check | rejected / `exact-original-url-format` |
| Specific differences | `original-path-shape-not-allowed`, `parsed-path-shape-not-allowed` |
| Diagnostic redactions | none |
| Search | `ok/all-rejected`, returned1/admitted0/rejected1/duplicates0, `unsupported-path:1` |

**Established cause for this result:** Tavily returned a **person-shaped pointer
under `/persons/`**, not a title-shaped pointer. This is not a trailing-slash,
percent-encoding, query or parser-normalization mismatch. Admission correctly
refused that path; no admission fix or `/persons/` allowance is justified. No
HTML was read, so neither actual destination content/person identity nor a
correct film card, availability, localization or entitlement is verified.
The visible film projection is TMDb335984 / IMDbtt1856101 / Blade Runner 2049 /
2017; that film crosswalk does not validate the search URL.

At that checkpoint the query builder included quoted film name, year, first known
director alias and `site:kinobazaua.com/titles/`. Tavily `include_domains` is set
to the hostname; the title-path hint exists in query text, not an enforced
local admission decision. The exact provider-side reason for returning the
director pointer is unknown. The director term may influence it, but that is a
**hypothesis**, not demonstrated causation or a provider-contract verdict.
Historical Blade results and Mortal title refusals are not reconstructed from
this new result. No source URL rewrite, second query or HTML GET was attempted.

Accounting: this authorised URL probe spent3/3; prior6+8 remain separate, so
**17 total source attempts across three authorised local runs** (TMDb10 /
Tavily7 / Kinobaza0). No budget remains for an automatic repeat. The second
reader invocation shown below the already-printed safe JSON reports unavailable:
the helper serves one connection and disposes the pipe after transfer. This is
consistent with expected one-shot result consumption, not a failed source run,
new source request or need to re-enter keys. No further reader/source run needed
to establish this finding; exact missing wrapper fields stay unknown.

**Separate query-policy proposal at that checkpoint, not yet implemented:** try a title/year-oriented
query without the director term, retaining the existing title-path hint,
domain/admission checks and the director as independent HTML identity evidence.
Existing query/card limits, alternate-query error rules and withholding must
stay unchanged. Whether this yields useful film candidates is unvalidated; no
new live test is authorised by this result. Do not broaden admission to person
routes or change identity to manufacture success.

This result checkpoint changes only README/canonical documentation. Focused
authored offline checks confirm the same person-route rejection and the current
query composition (zero HTTP); no live URL copied into a fixture. Links/anchors,
whitespace and scope checked. No runtime-suite rerun for Markdown-only changes;
the44/44 preparation evidence remains tied to unchanged implementation. Owner
checkout/demo, unrelated files, init/auth/lifecycle, source request policy/budgets,
TTL/retention, R1/R2 and draft controls preserved; no merge/deployment.

The preceding checkpoint`12223ea` was **documentation-only**, with8 focused authored offline
admission/category cases (zero HTTP), local links/anchors and whitespace
checks. No runtime test-suite rerun for Markdown-only changes; preceding32/32
targeted checks belong to the unchanged implementation tip, not a new live
validation. Request bodies/budgets, admission/identity gates, R1/R2, exact URLs,
acknowledgement, TTL/storage, draft/stale controls and owner checkout unchanged.

Controls keep field comparisons only in invocation memory and emit only minimal
public identity differences needed to explain a failed gate, not raw bodies,
snippets, scores or full responses. Do not redirect output into an evidence
archive. Old pilot responses are not reconstructed. Retention remains unchanged:
existing page-memory lifetime/TTL, content-free server ledger; no new logging,
storage, chat UX, lifecycle/auth, budgets, transfer or persistence policy.

Validation: initial full `npm run test:m4`67 passed/1 skipped (native PostgreSQL;
SQL/ledger unchanged). Final changed/dependent M4 offline/HTTP/Edge suites65/65;
dependent assisted-identity/MOTN suites126/126. Desktop1280×900, mobile375×812
and820×1180 authored browser checks include copy fallback, stale results,
pending apply/cancel and manual fields. No real iPhone/WebKit or fresh native
concurrency claim; Windows lifecycle not repeated (unchanged launcher).
Syntax/whitespace and local-reference checks pass. Application init/auth/lifecycle,
M4 form controller, exact-link policy, source service/deadline and SQL unchanged.
Source-use/account conditions remain separate; no merge/deploy, source key change,
DB write, transfer/Save or pilot run. At that checkpoint new matching/search-policy
changes remained proposals only; alternate search after identity refusal is still
not implemented or authorised by the subsequent title/year-only change below.

### Title/year-oriented Kinobaza search — 2026-10-23

Implemented in a separate stacked branch above #198
(`codex/m4-diagnostics`, pinned base
`54e54a90e4ecedcbf627861bc25528f5231ccb5b`), not merged/deployed.
The only application-path code change removes the director term from
`resolverQueries`: quoted selected title + integer year (when established) +
`site:kinobazaua.com/titles/`. Existing original/localised/known-alias ordering,
two-name bound, escaping, input bounds and Tavily basic/domain settings remain.
Director evidence is still required independently by HTML identity acceptance.
No admission, parser/alias, withholding, R1/R2, form/report/retention, deadline or
application-budget change. The second query still requires a successful first
search with no admitted URLs; no alternate after identity refusal or error.

**One authorised control, prepared then executed as recorded below:** the existing credential
helper adds `-TitleYearControl` (Node `--title-year-control`), mutually exclusive
with URL-only diagnostic mode. Only Blade Runner 2049 runs: TMDb identity <=2,
Tavily <=2, sequential Kinobaza GET <=2, **total <=6 attempts**, errors included.
The previous17 stay separate; cumulative ceiling23, not permission to retry.
Identity is re-established by the same bounded TMDb search/Details functions;
admitted cards continue through the actual resolver/admission/identity/extraction,
not an alternate parser or a URL-only success check. No MOTN, Watch Providers,
provider/destination request, redirect, retry or fallback.45s case deadline is
unchanged. Normal deployed M4 cap8 is not replaced by this local control cap6.

The existing local trusted hook compares bounded actual H1/H2/year/directors
with the selected aliases and reports per-gate outcomes. This explicit control
also exposes those minimal public identity fields for matched/refused cards,
with exact admitted source-card URL, truncation and extraction status/counts;
no raw HTML, snippets, offers, provider/tracking links, query/fragment values or
credentials. Comparison/credential data stay in invocation memory; safe IPC
result lifetime remains <=15 minutes. Do not archive the JSON or rerun after
uncertain/lost output. `buildSha=null`; checkout SHA is local provenance only.
The helper pins a clean tracked checkout and immediately runs once after two
hidden inputs, without a credential file/environment/argv handoff. Retrieve
the existing result once from a second Termius tab in the same SSH/elevation
context using `m4-read-control-result.ps1 -Compact`; no source call or prompt
occurs in that reader. Do not retry the reader after successful consumption.

Offline validation and actual live counts are recorded separately. At preparation
no new source request has run and no effect on search quality is established.
The prior person-shaped pointer refusal remains correct; its director-term
causation stays a hypothesis. A single new response cannot reconstruct earlier
pilot results or demonstrate general resolver quality.

Preparation validation: **9/9** new authored query/control regressions, **44/44**
targeted resolver/diagnostic/credential/URL regressions and **94/94** dependent
assisted-identity/extraction/workflow regressions passed. These cover exact
director-free payloads, primary/alternate order/escaping/bounds, error stops,
director/stable-ID refusals/withholding, actual mocked2+2+2 continuation to
extraction, transient field comparisons and no snippet/key/raw HTML output.
PowerShell7 parsing, stdin-only keys, native same-context IPC and codepage
roundtrip ran.13 Markdown documents/445 local links/271 anchors, zero errors;
whitespace and scope checked. Independent read-only diff review found no blocker.
Sandbox initially refused test child spawning (`EPERM`); the same tests passed
outside that restriction, not by weakening assertions/timeouts. No new browser,
Windows-demo lifecycle, PostgreSQL or iPhone run: UI/lifecycle/SQL unchanged.
No live-quality, deployment or rights-closure claim follows from these mocks.

**Executed title/year control — 2026-10-23:** owner-forwarded safe local result,
run `5923b78a-f889-49b0-a6b4-c0d842dd1768`, checkout
`e8ff58b8a5f0790db330dd5fbf5ea6f012da2a85`, mode `title-year-control`,
`execution=local-diagnostic`, `buildSha=null`. This is local checkout provenance,
not deployed-runtime attestation, independent agent source capture or a
reconstruction of the earlier pilot. The pasted excerpt is truncated between
the first card's expected fields and the second card's diagnostics; it is not a
complete parseable machine artifact. Missing fields/URLs are not reconstructed.

| Stage | Actual attempts | Visible result |
| --- | ---: | --- |
| TMDb identity | 2 | Both HTTP200; selected TMDb335984 / IMDbtt1856101, Blade Runner 2049,2017; director aliases Дені Вільнев / Denis Villeneuve. |
| Tavily basic Search | 1 | HTTP200; returned5, admitted3, rejected2 (query1 / unsupported-path1), duplicates0. |
| Kinobaza cards | 2 | Both HTTP200; first unresolved at director alias, second mismatch at heading alias. One admitted candidate unexamined. |
| New control total | **5/6** | `bounded-unresolved`; no second search/retry/redirect or provider request. |

**First card:** exact visible admitted pointer
`https://kinobazaua.com/titles/blade-runner-2049`. Extracted H1
`Той, хто біжить по лезу 2049 ( 2017 )`, H2 `Blade Runner 2049`, year2017;
title/original-title/year gates pass. One canonical/heading/original-title/
director value, no explicit stable IDs (`stableIdCount=0`). Source director is
**Денні Вільньов**, versus selected aliases **Дені Вільнев / Denis Villeneuve**.
Those selected aliases are visible in the top-level identity and the later
expected-field fragment; the cut-off first expected block is not reconstructed.
The only failed gate is `director-alias`, reason `director-alias-unestablished`.
NFC/whitespace/case normalization does not equate these spellings; the exact
alias check correctly leaves unresolved rather than asserting different people.
This establishes a missing **verified alias relationship**, not a malformed
director extraction or proof of a different person. No alias is added by this
result and no per-film/fuzzy/transliteration exception is introduced.

**Second card:** visible H1 `Той, хто біжить по лезу ( 1982 )`, H2 `Blade Runner`,
year1982, director `Рідлі Скотт`. These are concrete source-declared title/year
differences from the selected2049/2017 projection; the first refusing gate is
`heading-alias` / `source-title-conflict`. Later gates remain not evaluated,
not additional independent failures merely because comparison flags are false.
The exact second URL is absent from the excerpt and is not guessed. No
independent stable-ID crosswalk for this card was established.

Both refusals withheld claims before viewing/localization extraction
(`identity-unresolved` / `identity-mismatch`), not `unsupported-markup` or evidence
of no offers/tracks. The third admitted URL/identity is unknown and unexamined.
First successful search already had admitted candidates, so the unchanged
policy correctly did not use an alternate query after card refusals. Rejected
URL categories alone do not reveal their exact paths/query values. No new URL
admission change or additional control is warranted by these data.

Accounting stays separate: previous17 + this5 = **22 actual attempts**
(TMDb12 / Tavily8 / Kinobaza2), within the cumulative ceiling23. The unused
ceiling does not authorise another request/run. No new live requests were made
to analyse or record this owner-forwarded result.

**Bounded conclusion / next proposal:** title/year search produced usable
title-card pointers in this invocation, unlike the preceding person-pointer
result, but no identity-confirmed extracted claims. One run does not prove
general quality or that removing the director caused the difference. Historical
pilot responses stay unknown. A separate narrow follow-up could establish a
trusted **person-level** alias crosswalk with explicit provenance and a
regression for this spelling pair; do not silently add aliases or bypass the
director gate. No new live run is required to explain the now-visible stop.

This result commit changes only README/canonical documentation. Three authored
in-memory checks using the existing extractor/identity functions passed: the
observed spelling remains unresolved/withheld, an existing exact alias matches
when other gates pass, and a stable-ID conflict still overrides unknown director
spelling. These are algorithm checks, not reconstructed source HTML or a parser
fix. No runtime-suite rerun for Markdown-only changes; the prior147 regressions
remain evidence of executed implementation `e8ff58b`, not newly attested on a
different runtime. Local links/anchors, whitespace and documentation scope
checked. No source call, parser/search-policy change, owner checkout/demo change,
init/auth/lifecycle/retention change, DB/flag/secret/Save/merge/deployment action.

### Person-level director alias crosswalk — 2026-10-23

**Status: mechanism implemented/offline-tested; zero real aliases activated.**
Separate stacked implementation above #199, pinned base
`114afcfc58fd0b3fd109de8798df8bbd1ef41a94`; develop verified
`5bd9f830eb665b2fa1ac4ad7eb2b384267bf37a7`. At mechanism implementation no
merge/deployment or new live run;22 attempts were the then-current total. The
separately authorised person check below adds3, for25 actual attempts.

The TMDb credits projection already preserves validated `directors.items[].id`;
M4 service/local-control film construction previously flattened names and lost
their person association. `projectDirectorPeople` now retains
`{namespace:'tmdb:person', personId, names}` from the **matched server-received
projection**, separately per director. Missing/invalid IDs stay null; no ID is
guessed from film IDs, names, slug or browser JSON. M4's HTTP handler still
constructs server discovery inputs explicitly: additional browser person IDs,
names, records or lookup options do not enter the resolver or ledger.

`shared/director-alias-crosswalk.mjs` is statically imported compiled code, not
a new database/service/file read, cache, client configuration or network lookup.
Each reviewed record is keyed by namespace + person ID and contains literal
aliases, `scope:'kinobaza-director-identity'`, and confirmation evidence with
source/reference/recording date. This scope applies across films directed by
that person, **only** to Kinobaza director identity; not title matching, MOTN
values, tracks, offers, availability or entitlement. Record provenance is a
review requirement, not self-proving evidence or legal permission. Malformed
records fail compilation; duplicate person entries or shared alias spellings
across different IDs yield ambiguous/no crosswalk aliases. Registry and lookup
results are immutable snapshots; there is no runtime/browser registration.

The identity gate can use the crosswalk only for one selected director/person,
names attached to that same trusted credits record, and one source director
value. Multiple/unknown group scope stays unresolved; no flat multi-person
union, splitting, fuzzy matching, transliteration or diacritic removal. Existing
NFC/whitespace/case normalization and exact equality remain. Original returned
TMDb aliases still work without an extra crosswalk; absent person ID cannot
enable new aliases. Canonical/stable-film-ID/title/year gates retain precedence,
and unresolved/mismatch still withhold all Kinobaza claims. A match using a new
confirmed person alias retains `identity.directorAliasEvidence` with record
namespace/ID/scope/provenance; no extra UI/short-report or field propagation.
Authored tests inject a separate lookup through an internal function option,
never an HTTP/browser contract. Fixed-card parser/legacy film aliases unchanged.

**Evidence at mechanism implementation did not authorise a real entry:** the control established
source spelling `Денні Вільньов` versus selected `Дені Вільнев / Denis Villeneuve`
but recorded movie IDs, not an authoritative person-ID association. The older
fixed Dune alias list is per-film configuration without independent person-level
provenance. The person-shaped Tavily pointer had not then been fetched, and neither its
slug, spelling similarity nor the studied film's title/year can prove this
crosswalk. No TMDb person ID is invented from memory. Required missing evidence:
an independent person-level record explicitly tying the observed spelling to
the same authoritative namespaced TMDb person ID, with source/date/scope.
Accordingly `CONFIRMED_DIRECTOR_ALIASES` is deliberately empty. **The specific
Blade Runner2049 spelling remains unresolved under the shipped registry.**
The mechanism is complete, but confirming/activating that real record is not.

All positive crosswalk records in regressions are explicitly authored synthetic
people and provenance, not reconstructed source responses. Offline identity/
extraction success does not validate real offers/tracks. Tests cover exact
confirmed spelling, different namespace/person, the same person across films,
missing/invalid IDs, record ambiguity, multi-director refusal, stable-ID/title/
year precedence, withholding and ignored browser injection. Validation passed:
**31/31** new crosswalk regressions, **34/34** resolver/title-year/diagnostic
regressions and **203/203** dependent TMDb/assisted/workflow/HTTP/report/transfer/
credential/URL checks.13 Markdown documents/446 links/272 anchors, zero errors;
diff/whitespace pass. Independent read-only code/evidence reviews found no code
blocker and no adequate real-record evidence. Initial sandbox child spawning
failed with EPERM; unchanged tests passed outside that restriction. No new
browser/iPhone, Windows-demo lifecycle or PostgreSQL run: UI/launcher/SQL
unchanged. The Netlify Functions skill informed the static import boundary
(no runtime file reads/new endpoint/configuration), not a deploy. No new
control/owner cycle, source/rules/API GET,
DB/migration, flag/secret, init/auth/lifecycle, UI, retention or Wishlist action.
Search text/admission/request budgets/deadlines/retries/redirect policy, R1/R2,
exact URLs/acknowledgement and form-transfer safeguards remain unchanged.

#### Authorised one-time person verification — 2026-10-23

Prepared in the same #200, subsequently executed as recorded below; real
registry remains empty. **No new request at preparation.**
The owner authorised <=3 total HTTP attempts, prior22 separate/cumulative<=25:
one TMDb movie335984 credits GET, one details GET for its validated director
person ID, and only if needed one exact
`https://kinobazaua.com/persons/denis-villeneuve` GET. At preparation no reliable
person-ID evidence was saved, so credits were not skipped or replaced by a guess.
No film search/title-card/Tavily/watch-provider/platform/destination request.
Errors spend attempts; no retries, redirect follow, alternative or auto-repeat.
This person path is a local diagnostic exception, **not runtime card admission**.

`scripts/m4-director-person-diagnostic.mjs` requires explicit CLI opt-in and
strict one-key stdin. Existing hidden helper adds `-DirectorPersonCheck`:
exact clean ExpectedCommit, only TMDB_READ_ACCESS_TOKEN SecureString prompt,
no Tavily input or credential argv/env/disk/log handoff. The Node child removes
inherited source credentials/preload/debug/TLS-log settings, uses the existing
bounded TMDb reader, a45s overall source deadline and15s per-read bounds.
Fixed source origin/path/stage/counters are validated before every dispatch;
TMDb Authorization is never forwarded to Kinobaza. Only initial HTML in memory,
no scripts/assets/JSON-LD context/linked IDs are fetched. Reader uses
`-DirectorPersonCheck -Compact` in a second same-SSH/elevation terminal; separate
current-user-only pipe `mw-m4-director-person-200`, one handoff, <=15min, no file.
Retrieval failure/unused cap never authorises another run.

Evidence chain: credits must identify movie335984 and one valid Director person
ID; requested person response ID must match, including any appended ID. Exact
target spelling in the valid TMDb person name/aliases can directly confirm and
**skips the optional third GET**. Otherwise shared IMDb **person** nm-ID may
link TMDb to an explicitly bound Kinobaza Person profile: canonical/H1/Person
names and stable IDs must be consistent. No requirement that Kinobaza itself
expose a TMDb ID. Root/appended IMDb conflicts, unrelated or ambiguous Person
objects, foreign profile ownership or unclear markup do not auto-confirm.
Plain person links are bounded observations with ownership unestablished for
review, not a convenient page-wide same-ID proof. No slug/name/filmography/year
similarity inference. Profiles lacking adequate linkage remain unresolved.

Safe output contains source references, validated person IDs, only matching
TMDb aliases/counts, bounded profile identity fields/person links, structural
uncertainties, actual attempt statuses/counts and a new local run ID. No raw
HTML/JSON response, biography, search snippets, credentials or tracking data.
Local checkout SHA is distinct from unknown deployed-runtime attestation.
After input the approved check runs immediately, once; no additional consent
needed. Only sufficient reviewed proof permits a real registry entry; mocks
must not be promoted to evidence. No repeated discovery or offer/track claim.

Preparation checks: **54/54** targeted offline regressions passed (15 authored
person-diagnostic,8 credential/helper,31 person-crosswalk). They cover direct
TMDb alias proof/skipped third read, common IMDb person-ID proof, wrong or
ambiguous IDs/profile ownership, appended-ID conflicts, exact spelling, counted
HTTP/transport/body failures, manual redirects/no destinations, strict one-key
stdin/no env fallback, secret/body filtering, native PowerShell parsing/IPC and
unchanged crosswalk withholding. Review found/fixed missing profile-ownership and
appended-person-ID guards before any source dispatch; bounded name output also
checked.13 docs/446 links/272 anchors, no errors; whitespace/scope checked.
These are mocks, not real alias confirmation. No browser/Windows-demo/SQL rerun:
only local diagnostic/credential helpers and docs changed; app/runtime registry,
admission, query, budgets, lifecycle/auth, UI and retention are unchanged.

**Executed person check — 2026-10-23:** owner-forwarded safe local result,
run `40763a2f-fddc-41b6-b6da-c09e2d4b779f`, started
`2026-10-23T19:55:05.822Z`, checkout
`099db961d86eada84b6b222de667add951979085`, mode `director-person-check`,
`execution=local-diagnostic`, `buildSha=null`. Local checkout provenance only,
not independent agent source capture or deployed-runtime attestation. Minimal
facts below, not a copied JSON/HTML response or persistent content archive.

| Read | Attempts / status | Established evidence |
| --- | --- | --- |
| [TMDb movie335984 credits](https://api.themoviedb.org/3/movie/335984/credits?language=uk-UA) | 1 / HTTP200 | The validated Director record identifies person137427, name Дені Вільнев, original name Denis Villeneuve. |
| [TMDb person137427](https://api.themoviedb.org/3/person/137427?language=uk-UA&append_to_response=external_ids) | 1 / HTTP200 | Matching requested person ID137427, name Дені Вільнев;3 aliases examined, no exact target spelling; projected IMDb person ID nm0898288. |
| [Kinobaza person pointer](https://kinobazaua.com/persons/denis-villeneuve) | 1 / HTTP200 | `person-page-too-large`; refused before HTML decoding/profile extraction. No H1, canonical, Person object or external person-ID evidence returned. |
| Total | **3/3** | No confirmed target alias; no redirect/retry/extra read. |

The TMDb reads now establish the film-director-to-person-ID chain; the exact
alias list contents are not reconstructed from its count. Matching the selected
person to IMDb nm0898288 does **not** establish that Kinobaza uses that IMDb ID
or that its profile associates `Денні Вільньов` with this person. HTTP200 does
not establish a parsed profile. Public birth fields in the safe result are not
needed for this conclusion and are not archived here.

Precise stop: `readPersonHTML` returns the same `person-page-too-large` for
declared Content-Length >524288 bytes **or** accumulated body bytes exceeding
524288 (512 KiB). The safe result contains neither the branch nor the exact
size. It therefore cannot show which check fired, the complete body size or
that all HTML was read. Both paths stop before decoding, challenge detection,
parse5/profile identity inspection; no claim that profile markup/links were
missing, unsupported or incorrect. No alias, source-value repair or matching
change is justified by this transport-bound refusal.

**Real-entry status: not confirmed, not activated; registry still empty.**
Missing evidence is the Kinobaza person-level side of the linkage (e.g. explicit
profile ownership plus the same IMDb nm0898288 and the target spelling), or a
trusted person record explicitly listing that exact alias. The earlier movie
card, similar names/slug and known film ID cannot fill this gap.

Accounting: previous22 + this3 = **25 actual attempts**, ceiling fully spent:
TMDb14 / Tavily8 / Kinobaza title-card2 / Kinobaza person-page1. No unused budget,
automatic repeat, re-prompt or additional request is authorised. Analysis/docs
made zero source calls. A possible **separate proposal, not implemented or
authorised** is one read of this same person page with a diagnostic-only2MiB
bound and separate declared-length/stream-limit reason; reuse the now-saved
TMDb person proof, no repeated TMDb/Tavily/title-card/discovery call. If it still
fails its new bound, stop. This would require new explicit request/bound scope;
it is not a change to runtime admission, parsing, retention or application cap.

This result checkpoint changes only README/canonical documentation. Two focused
authored in-memory transport cases reproduced both size-limit paths with the
same public reason/counts and no profile extraction (zero source HTTP). These
are not reconstructions of the real profile or evidence of its actual size.
Links/anchors, diff scope and whitespace checked; runtime suites not repeated
for Markdown-only changes. The54/54 preparation evidence remains tied to
unchanged executed099db96, not a new live validation. No real alias, runtime
bound, identity gate, query, UI/lifecycle/auth, retention, migration/flag/secret,
Wishlist, owner checkout/demo, merge/deployment or discovery change.

### Same-document M4 return state — 2026-10-23

Owner reported loss of the open M4 window/results after switching apps on
iPhone. The code establishes a loss path, not a recorded iPhone event sequence:
the existing auth callback can invoke `initApp()` again; `initApp()` calls
`loadCurrentRole()`, whose M4 hook previously called `invalidateMediaAdvice()`
unconditionally. That rotated the form reference, erased the M4 controller
session/DOM and closed its dialog, even for the same user/group/film/form.
The visibility/pageshow resume path itself only refreshes movie data.

Only that M4 hook now requests a capability refresh rather than invalidation.
`initApp`, its callers/frequency, auth/lifecycle handlers and initialization order
are unchanged. A same-context successful access refresh retains the original
dialog, result objects, expanded details and scroll; it does not re-render or
reopen an explicitly closed dialog. Capability checks use Auth/RPC, **zero
source requests**. Failed/revoked access or changed context clears M4; ordinary
form fields remain untouched. Pending selection authorization is revoked on
revalidation; selection/review must be repeated, never applied by restoration.

No persistence is added: no localStorage/sessionStorage/IndexedDB, snapshots,
raw bodies, search snippets or server result recovery. This addresses a retained
document/controller, **not iOS unloading the page or a full browser reload**.
Those lose in-memory state; durable restoration would need a separately approved
retention design. Explicit close, cancel/Save, logout and genuine user/group/
film/list/form-session changes retain their invalidation/close behavior.

Historical client-expiry behavior in this paragraph is superseded by the
[pilot dialog/session decision](#mykola-media-dialog-and-form-session-lifetime--2026-10-28).
The existing server session TTL remains 30 minutes and SQL/ledger retention is
unchanged. The M4 view uses a conservative local bound of 30 minutes from explicit
discovery dispatch (before server session creation), not from response/reopen.
At expiry it drops projected results/choice/report DOM and pending apply, shows
an expiry explanation and offers **Оновити вручну**. That explicit action checks
access and renews only the M4 form reference; it makes zero source requests.
The separate **Знайти варіанти** action starts a new metered search. Errors and
lost replies remain spent/unknown; there is no retry or refund before expiry.
Clock/deferred-timer expiry is also checked at access refresh, reopening and
selection/navigation/copy/apply boundaries, including after async authorization.

Authored browser regressions cover the actual unchanged auth callback → init →
role load path with non-M4 data loaders mocked, retained DOM/details/scroll,
in-flight discovery, explicit close, context changes, logout, revoked access,
expiry and pending apply. No live source/DB/Save or real iPhone test is implied.
After a separately authorized deployment: use one existing result, expand a
detail and scroll; switch apps and return within TTL. Check the same window and
position, unchanged source counter, no transfer/Save; explicitly close and return
again to verify it stays closed. Real Safari/iOS suspension remains unvalidated.

Local validation on this change: `npm run test:m4` with the explicit installed
Playwright module/Edge: **60 passed, 1 skipped, 0 failed** (61 total). The skipped
case is native PostgreSQL concurrency: no server/SQL/ledger changes; no claim of
a new native run. Real-form browser viewports: 1280×900, 375×812, 820×1180.
Windows launcher lifecycle and WebKit/device tests were not repeated/performed.
Syntax, whitespace and local-reference checks passed (13 documents, 443 links,
269 anchors). Byte-content comparison confirms the entire `initApp`/resume/auth
tail, `updateAuthUI` and logout block are unchanged from develop `fbec4c2…`.
No live discovery, Wishlist write, migration, flag/secret, merge or deployment.

Form context: user + group + established IMDb identity + optional group-list ID
+ random form session. Typed title alone is insufficient. New film/group,
cancel, successful Save or logout invalidates it. Late responses are discarded.
Reopening retains same-session results. Abort does not refund a server attempt.
Only `recommended_medium` and `purchase_url` are transferable; no ownership,
status, title/year or added-by changes. Missing URL requires explicit clearing,
never silent retention of a different platform's URL. Form edits after preview
invalidate that preview. Affiliate/tracking acknowledgement preserves exact href.
Unsupported/unmapped platforms remain read-only. Source rows never merge.
Preview has its own opaque in-memory selection token, separate from discovery
generation. Cancel, Escape, close, re-render and any new selection revoke it.
After asynchronous access verification, both that token and the current form
context/field snapshot must still match before the two local fields can change.

## Source use and activation

Implementation/offline checks are not live validation or rights clearance.
No live source-body/API calls are authorized here. Existing dated research reviews do not
grant blanket production or arbitrary-card permission. Before live activation,
a separately authorized preflight must reconcile current TMDb, MOTN, Kinobaza
scope and account-specific Tavily plan/terms, attribution, transient transfer and
permitted access. The dated Tavily review below distinguishes the supported API
path from unresolved end-user licensing. Search does not license destination
content. No application LLM call or full-body archive.
No current production feature assignment, secret or migration is changed.

## Pilot (future, not executed)

No concrete pilot films selected. The single
[execution runbook](#activation--operation-plan-not-executed) defines selection,
activation gates, owner-only access, source-free smoke and the later five-film
pilot; do not substitute research fixtures.

## Validation and remaining work

M4.1 authored offline/browser validation covers capability failure, isolated
dialog, stale response and preview, exact URLs/acknowledgement, missing URL and
transfer-only fields. M4.2/M4.3 add server authz/concurrency/resolver tests.
Windows launcher components are unchanged and are outside this integration.
MW-FUT-01 remains Discovery; production readiness is a separate decision.

## M4.2 server and migration contract

Implemented, mock/offline tested; live-unvalidated. The server verifies a Supabase
Auth user (not user metadata), then calls service-role-only
`media_advice_action`. Every capability/start/reserve/finish checks backend
permission, fresh owner/member membership and (edit only) list/group/IMDb relation.
Add accepts an established IMDb selection without requiring an existing list row;
the server resolves/validates the crosswalk itself. No client result/role/counter
is accepted. Failed capability leaves normal editing usable.

No trusted TMDb preview is retained by the existing form lookup. Therefore the
full M4 ceiling is **8 source HTTP attempts**: IMDb Find 1 + Details 1 + UA
providers 1 + MOTN title 1 + Tavily search ≤2 + Kinobaza cards ≤2. M4.2 alone ≤4.
Missing/ambiguous crosswalk skips MOTN, never guesses an ID. Details/providers
failure does not suppress an independent MOTN attempt with established crosswalk;
its own metadata/ID gate may still withhold claims. Identity Details are reused
within the action for localization/resolver, without additional fan-out.
The handler clock starts at entry, before reading the body, Auth or ledger RPCs.
Sources have only the remainder of the first **45s**; Auth and each RPC have at
most 8s and never more than the remaining phase time. At most one finish attempt
can use the next 8s, ending by 53s from entry. A 2s application response margin
and a further 5s platform margin fit Netlify's documented synchronous 60s limit.
Existing smaller adapter bounds remain; no budget increase or retry. Abort is
propagated to network/body waits; an awaited operation that ignores abort is
also raced against its deadline. This is an operational bound, not latency data.
The response distinguishes dispatched source attempts from the finish RPC's
durable reservation count. If a reservation reply is lost, no HTTP dispatch is
authorized by that reply; the ledger may still have consumed the slot. If the
whole action reply is lost, accounting is unknown to the client, not zero.
Deadline exhaustion returns 504 without source results. If a session ID was
received, the server makes one best-effort finish within its remaining margin,
never retries finish or fetch. Failed/lost finish withholds results; it may have
committed or left the session unfinished. Either way reservations are not refunded,
the form/action cannot replay, and the 30-minute TTL plus retention cleanup apply.
An unknown start outcome cannot be finished by guessed ID and is not retried.

Migration `20261020205122_media_advice_access_ledger.sql` was created using
Supabase CLI 2.121.0. It creates only a new private schema, default-off permission
assignments, technical sessions and restricted RPCs. New tables have RLS and no
anon/authenticated privileges; RPCs are service-role only. An advisory transaction
lock serializes a user's new sessions and reservations; no lock spans source I/O.
Follow-up `20261021072002_media_advice_review_fixes.sql` rechecks permission,
fresh group role and edit-card context **after** acquiring the advisory lock,
before any ledger mutation, including queued start/reserve/finish operations.
Permission expiration is checked against wall-clock time after that wait.
Per form session: one action; fixed stage names each reserved at most once,
maximum eight. Per user: twenty sessions per rolling 24h (including expired
30-minute sessions). Errors/lost responses consume reservations. No response,
HTML, credential or chat persistence. No session replay/result recovery.

Retention origin is the immutable action session's `created_at` (not its last
reservation, finish, logout or form close). Rows become eligible at age **24h**,
whether finished or abandoned, after their 30-minute active TTL has expired.
A still-active row is preserved defensively, including an anomalously extended
TTL; it becomes an overdue-monitor finding, not a reason to delete active work.
Daily service-only `media_advice_cleanup()` is expected to delete eligible rows
at ages **24–48h under a healthy scheduler**; opportunistic same-user cleanup can
delete them earlier within that window. There is **no guaranteed 48h ceiling**
during scheduler/DB failure. Movie, group-list/Wishlist and permission rows are
not deleted by cleanup. Permission assignments
persist until an authorized administrator revokes/removes them. No assignment
is seeded. No global historical RLS repairs or production migration commands.

Prepared, **not installed/activated**:
[inactive pg_cron job configuration](../supabase/operations/media-advice-cleanup.schedule.sql)
and [content-free health query](../supabase/operations/media-advice-cleanup.sql).
The daily job is named `mykola-media-advice-cleanup`, 02:15 UTC; configuration
refuses a non-UTC scheduler or an existing same-name job and creates it inactive
in one transaction. There is no `cron.schedule` in an automatic migration.
Enabling pg_cron/job requires later explicit authorization and baseline review.
Denys, as backend operator, owns activation and daily independent monitoring:
missing heartbeat, >26h since success, failed/inactive job or rows aged ≥48h
require investigation. The private singleton heartbeat stores only last success
and deletion count, atomically with deletion; a failed transaction cannot report
success. Inspect `cron.job` / `cron.job_run_details`; recover via one authorized
cleanup, never source replay or rate-counter reset. Before activation assign an
independent daily check/alert outside this cleanup job; a stopped scheduler
cannot report its own total outage. Cleanup health is backend-only, not browser
content. Cron history pruning remains an operator concern, not source archival.

Local validation uses PGlite 0.5.10 (test-only PostgreSQL/WASM), minimal authored
prerequisites, and this new SQL only. It proves SQL execution/privileges/replay,
not production migration history or native multi-connection/load behavior.
Native PostgreSQL **17.6** was additionally run in an isolated loopback cluster
with 24 distinct backend connections (matching the previously recorded target
major/minor, not querying production to attest its current version). Both new
M4 migrations run against authored prerequisites only; production migration
history/baseline reconciliation remains pre-activation work. No old SQL replay.

Server configuration (no values in Git): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `TMDB_READ_ACCESS_TOKEN`, `MOTN_API_KEY`;
M4.3 additionally `TAVILY_API_KEY`. Secrets are not arguments/URLs/UI data.
No configuration is changed by these PRs. Approved TMDb logo/complete current
attribution and applicable commercial/source-use terms must be checked during
activation preflight; text attribution and source links remain visible now.

## M4.3 automatic resolver and UI

No manual card field is required. The swappable search interface uses
Tavily basic Search `POST https://api.tavily.com/search`, with
server-only Bearer authentication. A verified original title/alias and year form
a title-path/domain-limited query; director remains in the HTML identity gate,
not the search text. Snippets/rank never establish identity or
claims and are not returned or persisted. At most one alternative known title
query is allowed **only when the first successful search yields no admitted
URLs**, not after transport/auth/quota errors or merely to seek a nicer result.
Read at most two distinct admitted candidates sequentially. More candidates are
reported unexamined, not declared absent. Provider-internal traffic is unknown.

Admission reuses the strict assisted policy:
`https://kinobazaua.com/titles/<lowercase-ascii-slug>` only; no query, fragment,
credentials, port (including explicit 443), alternative host, subpage, encoded
slash/dot path, normalization repair or guessed slug. Revalidate before every
GET; redirects/retries are refused. Search ≤15s/512KiB, source card ≤15s/2MiB,
within the remaining source phase of the entry-based deadline. A reservation
that outlives this phase cannot start a later search/card fetch. No
cookies/login/scripts/assets/destinations.

Identity reuses the existing independent canonical/title/original-title/year/
director/stable-ID gates, including unresolved director spellings/composition,
original-title scope refusal and stable-ID conflict priority. These parser
limitations are preserved, not fixed by finding a URL. Refusals withhold claims.
One matched card can contribute source rows automatically even when extraction
is partial. Two matched cards require an explicit choice of already checked
cards; selection adds **zero** requests and cannot override a refused identity.
An identity match is not extraction success, offer identity or account entitlement.

The dialog groups supported platforms for presentation only, keeps each source
row selectable independently, and retains unknown/unmapped observations read-only.
It shows source warnings, literal characteristics in details, localization scope,
shared JustWatch lineage, exact-link acknowledgement and a safe copyable report.
Report content is allowlisted counts/status/scopes; no raw URLs, tracking query,
source body, secret or manually edited draft. Commit remains unknown without
attestation. Clipboard denied/unavailable has selectable text fallback.
Default field exclusions remain price/currency, audio/subtitles/video, status,
owned medium, identity/title/year and added_by. No form write until explicit
transfer; no DB write until ordinary Save. No source request from rendering,
card selection, copy, review, transfer or cancel.

The ledger retains rate rows across list/group deletion: new contexts cannot
erase prior rolling-window usage. Historical foreign-key/RLS issues are not
modified. New accounting stores group/list IDs as technical bindings, checked
against fresh membership/list identity on each RPC, not cascading rate resets.

## Activation / operation plan (not executed)

### Execution runbook — preparation checkpoint 2026-10-21

**Prepared, not authorized to execute.** One operational runbook; design remains
above. Target: Netlify **develop branch deploy** with existing production
Supabase `mttkectgdqqmejpenkrn`, not a fresh DB. Denys is the deployment/backend
operator. Owner checkout/demo is excluded. Every mutating step below requires
the next explicit authorization; do not run commands merely because documented.
The five pilot films are **not selected**.
**Execution hold:** the [focused recovery assessment](#focused-recovery-assessment--2026-10-22-m4-qualified)
clears the MW recovery prerequisite for the two M4 migrations, with explicit
limits; it does not authorize consolidation/auto-deploy or migrations. All other
execution prerequisites and the next explicit authorization still apply.

### Recovery checkpoint — 2026-10-22 (blocked)

The heading retains its historical anchor. **Current verdict: recovery is
sufficient for the two additive M4 migrations, not a full Supabase-project
recovery guarantee.** The initial [data-pass/ACL-blocker result](#local-restore--2026-10-22-data-verified-acl-blocker)
is superseded only to that scope by the
[focused assessment](#focused-recovery-assessment--2026-10-22-m4-qualified).
Disk encryption is explicitly waived, not a blocker. No production restore,
migration, consolidation/deploy or activation is authorized by this evidence.

Historical initial inspection time **2026-10-21T21:24:28Z** (2026-10-22 local Kyiv).
PR #195 remained at `c2d38f6740ec4fd6ae7d6615d1e963c3ce9d1740`,
base #194 `bdca14f9a06a6e84297f75917c5b009dbf41fa66` before this
ordinary documentation follow-up. This timestamp is an access check, **not**
a backup/snapshot time; **at that inspection** no artifact path, size, SHA256
or restore comparison was available. It is superseded only by the explicitly
dated evidence below, not by assumed success.

Historical evidence / initial access blocker (subsequently resolved):

- No `pg_dump`, `pg_restore`, `psql`, Supabase CLI or Docker on PATH.
  The existing isolated native PG bundle supplies `postgres --version=17.6`,
  but no dump/restore/psql executables were found in that bundle.
- No PG connection/password/service environment configuration, default Windows
  pgpass or service file was present (presence-only checks, no values read).
  No login/export attempt, empty dump or invented checksum was produced.
- Read-only SQL connector reports role `postgres`, server17.6. This is SQL
  authorization, **not an exportable password/connection or secure streaming
  file channel**. Do not extract it, expose source rows through tool/chat output,
  use server-side files/OS commands, or substitute the Netlify service-role key.
- Catalog-only inspection: public plus auth/storage/realtime and
  cron/extensions/graphql/graphql_public/net/vault schemas exist. Extensions:
  pg_cron1.6.4, pg_net0.20.4, pg_stat_statements1.11, pgcrypto1.3, plpgsql1.0,
  supabase_vault0.3.1, uuid-ossp1.1. M4 schema/history table still absent.
  No user rows, role-password hashes, decrypted Vault values or Storage files
  were fetched. Core PG17.6 presence does not prove Supabase extension parity.

**Required access, no password in chat:** in this project's Supabase Dashboard
→ **Connect → Session pooler**, configure the displayed host, port **5432**,
database **postgres**, user **postgres.mttkectgdqqmejpenkrn** and TLS. Use the
existing DB password via a hidden local prompt or owner-restricted Windows
`%APPDATA%\postgresql\pgpass.conf` / `PGPASSFILE`, not command arguments,
source files, chat or public artifacts. Do not guess the regional pooler host.
Direct connection from Connect is an alternative only when network access is
established. Do not use transaction pooling (6543) for coordinated snapshots.
Do not reset the production password, create roles or change grants under
this authorization. Existing privileged read/export access is needed; a
limited account must fail rather than silently omit RLS-protected tables.
Portable PG17 client tools are also required before export can begin.

#### Local tools / hidden password handoff — prepared 2026-10-22

The earlier access-check findings above are historical, not current tool status.
Owner confirmed Session pooler host
`aws-1-eu-north-1.pooler.supabase.com`, port5432, database`postgres`,
user`postgres.mttkectgdqqmejpenkrn`. PR #195/base #194 were rechecked before
this follow-up; no owner-checkout or production changes.

- Official EDB portable archive `postgresql-17.11-5-windows-x64-binaries.zip`
  installed under `%LOCALAPPDATA%\MovieWishlist\RecoveryTools\pg17.11\pgsql`.
  `pg_dump`, `pg_restore`, `psql` report **17.11**, same major as source17.6.
  No installer, system service or PATH change. Download SHA256:
  `80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F`.
  This is a local integrity hash of an official HTTPS download, not an
  independently published vendor checksum or a database-backup checksum.
- The initial Windows-root-only TLS probe refused the Supabase private CA;
  no password or SQL was sent. The CA download URL was then verified against
  [Supabase dashboard source](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json).
  Public `prod-ca-2021.crt` file SHA256:
  `700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7`.
  The helper pins that downloaded CA file for this operation. No machine-wide
  trust-store modification or permissive certificate callback.
- TLS preflight passed with the explicit Supabase CA, chain/validity and exact
  pooler-hostname verification. Native PG17 `sslmode=verify-full` also reached
  `fe_sendauth: no password supplied`, the expected password-free stop before
  authentication/SQL. This proves TLS setup, **not privileged DB access**.
  CRL/OCSP revocation is not attested; no CRL is configured. Do not silently
  downgrade to `require`/`verify-ca` to work around future errors.
- [Local password prompt](../supabase/operations/recovery-password-prompt.ps1):
  Windows PowerShell7+, `Read-Host -AsSecureString`; fixed pooler only;
  no password in argv, parent environment, Git, console or plaintext file.
  A bounded read-only `psql -X -w` check verifies database/role/major before
  saving a **DPAPI CurrentUser-encrypted** credential handoff under
  `%LOCALAPPDATA%\MovieWishlist\Recovery\mttkectgdqqmejpenkrn\pending`.
  The directory has protected owner/SYSTEM-only DACL; reparse-point ancestors
  are refused. A pending handoff is never overwritten. Brief plaintext copies
  in the local child-process environment/memory are unavoidable; they are not
  protected from a compromised same-user/admin process. Do not run with a
  terminal transcript/session recording or in CI.
- This is a two-stage local handoff, **not an automatic backup runner**.
  The operator enters the password locally and reports only completion.
  The next authorized recovery operation must check `pending.json` project,
  successful read-only/TLS evidence and `expiresAt` before importing
  `credential.pending.clixml` under the same Windows user/machine. Expiry is
  two hours after creation, not a scheduled deletion: refuse expired use and
  remove the exact credential file on consumption/failure/abandonment; do not
  retain it with backups. Never print/decrypt it into tool arguments or logs.
  DPAPI depends on this Windows profile/machine and is **not** a portable
  disaster-recovery key. The eventual backup needs its own protected/tested
  encryption and recovery-key procedure under the contract below.

Launch in an ordinary, non-recorded PowerShell terminal using the prepared
isolated checkout (no update/switch of the owner's working copy):

```powershell
& 'C:\Users\DenysLis\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoProfile -File 'C:\Users\DenysLis\.codex\visualizations\2026\09\28\01a0e7c4-3dc8-75e0-a3ed-84a709483b8d\mw-m2-ab-implementation\supabase\operations\recovery-password-prompt.ps1'
```

Offline authored regression passed: private/reapplied DACL, child-only secret
with no argv exposure, fixed verify-full/read-only configuration, DPAPI
round-trip, bounded-expiry metadata, refusal to overwrite and explicit
`backupCreated=false` / `restoreVerified=false`. At that preparation stage,
real-password entry, backup, snapshot/count capture and local restore were
still pending; see the executed checkpoint below for subsequent evidence.
The prompt itself performs no production writes/migrations or restore.
Official references: [EDB portable binaries](https://www.enterprisedb.com/download-postgresql-binaries),
[Supabase psql TLS](https://supabase.com/docs/guides/database/psql),
[PostgreSQL17 SSL verification](https://www.postgresql.org/docs/17/libpq-ssl.html).

Owner prompt follow-up (2026-10-22): the screenshot reports an earlier psql
exit2 and a later successful psql execution followed by the generic
`Unexpected database identity, server major, or read-only setting` refusal.
The later refusal establishes neither a wrong password nor which metadata
check failed: those values were deliberately not retained. At that failed-run
inspection no credential handoff existed; no backup/restore had run.

Narrow helper correction: the access query now explicitly runs
`BEGIN READ ONLY; SET LOCAL statement_timeout = '15s'; ...; ROLLBACK;`,
rather than relying solely on startup `PGOPTIONS` for transaction mode.
Wrong database, unexpected role, non-PG17 and a non-read-only transaction
still refuse credential capture. Refusals now use fixed allowlisted codes:
`database-not-expected`, `role-not-expected`, `server-major-not-17`,
`transaction-not-read-only`, `malformed-metadata`; no raw JSON, stderr,
role names or other server-returned text is echoed. Client-side startup
options not reaching the server is a possible explanation, **not an attested
root cause for this owner's pooler connection**. PostgreSQL's explicit
[read-only transaction mode](https://www.postgresql.org/docs/17/sql-begin.html)
does not depend on that explanation. Reuse the same local launch command;
no checkout switch/update or password reset is needed.
Authored offline diagnostics/DPAPI/DACL tests passed. A fresh isolated native
PostgreSQL17.11 test also reproduced the old refusal when the session default
is read-write, then accepted the explicit read-only query with unchanged
database/role/major checks. This is a controlled local reproduction, not proof
that the pooler dropped the owner's startup options. The local fixture cluster
was stopped; no production connection or real password was used in these tests.

#### Executed backup — 2026-10-22 (local restore blocked)

Owner subsequently completed the local prompt. The handoff's database/role/
PG17/read-only evidence and two-hour expiry were checked privately. One TLS
evidence object was validated explicitly (the older helper also emitted empty
pipeline values; those are not accepted as verification). The helper now
suppresses those non-secret extra outputs. The password was consumed via
DPAPI/current-user memory and child environment only; the exact
`credential.pending.clixml` was **deleted**, and non-secret handoff metadata
was moved into the checkpoint. No password reset, grants or Netlify secrets.

Actual checkpoint:

- Source **PostgreSQL17.6**, clients **17.11**. Session pooler with verified
  Supabase CA/hostname; explicit `REPEATABLE READ READ ONLY`, `row_security=off`
  so unreadable/RLS-filtered counts cannot silently pass. Exported snapshot
  held for dump and per-table counts; role/global definitions captured separately.
- Snapshot UTC **2026-10-21T22:13:53.045Z** (Kyiv **2026-10-22 01:13:53**).
  DB archive completed **2026-10-21T22:14:15.839Z**; snapshot released and
  archive verification completed **22:14:17.980Z**. These are actual operation
  times, not prior access-check timestamps.
- Protected directory (outside Git/owner checkout/preview/OneDrive):
  `C:\Users\DenysLis\AppData\Local\MovieWishlist\Recovery\mttkectgdqqmejpenkrn\checkpoint-20261021T221351Z-432dc0a6`.
  Protected, inheritance-disabled DACL verified: current Windows owner + SYSTEM.
  **AES-256-GCM** direct streaming, random nonce per file, authenticated header
  and tag; no plaintext DB archive/staging file was created.
- Separate key:
  `%LOCALAPPDATA%\MovieWishlist\RecoveryKeys\checkpoint-20261021T221351Z-432dc0a6.key.dpapi`.
  Owner/SYSTEM ACL verified. Independent reload/unprotect and archive
  authentication passed under this Windows profile. **DPAPI is machine/profile
  dependent**: this is not a portable/off-device disaster-recovery copy. Protect
  that profile/key; moving ciphertext alone to another computer is insufficient.
- Snapshot schema/table/constraint inventory and per-table counts are retained
  **encrypted**, never in Git/report. All inventoried counts were readable.
  Archive TOC accounts for every inventoried non-extension table, including Auth
  and Storage data entries. This is coverage validation, **not** restored-row,
  schema-definition, sequence, grant/RLS or FK/orphan comparison.
- `pg_dump` custom archive and both `pg_dumpall --roles-only --no-role-passwords`
  exports exited0 with empty stderr (no export warnings). Role definitions/
  memberships were unchanged between exports
  after removing pg_dumpall's random `\restrict` markers. All retained encrypted
  artifacts authenticated; manifest hashes matched. `pg_restore --list` and
  full `pg_restore --file=NUL` archive reading exited0, no SQL execution.
  **Archive reading/decryption is not a database restore.**

| Encrypted artifact | Bytes | SHA256 |
| --- | ---: | --- |
| `database.aesgcm` | 629292 | `a09a6d3079ebf22b42ff7b0af47406bff14bc8552005ebac6d0bf2fde99104f5` |
| `roles-before.aesgcm` | 5701 | `5f5a77ed7b5f4a8d2fb24e952998ed9dcc08f9dab8caaa45dc724e7520b949ff` |
| `source-inventory.aesgcm` | 58281 | `cd3235cc7a5902309783162e0b0689ad0f7b454d6061907ba3d6a77b01d899c7` |

`status.json` and dated `audit-*.status.json` privately record all artifact
names/sizes/hashes. Detailed TOC, diagnostics, source counts/constraints and
coverage audit remain encrypted. Export completion is labelled `backupComplete`;
it does **not** assert a complete Supabase-project backup or recovery readiness.
Retain this checkpoint and its separate wrapped key until explicit owner-approved
disposal; no automatic backup deletion/scheduler was introduced.

**Historical local-restore prerequisites (subsequent authorization below):**

1. EFS on the newly created empty test directory returned **"The request is not
   supported"**. `manage-bde -status C:` was read-only but returned **access
   denied / administrative rights required**. Therefore disk encryption is
   **unknown**, not proven off or on. No real-data cluster or plaintext archive
   was created under that earlier authorization. The owner subsequently
   **explicitly authorized decryption/local restore without disk encryption**.
   BitLocker/Device Encryption is no longer a prerequisite. Owner/SYSTEM-only
   staging, network isolation and deletion of temporary plaintext remain required;
   deletion is not a forensic-wipe guarantee (including SSD/pagefile remnants).
2. Installed vanilla Windows PG17 lacks `pg_cron`, `pg_net`, `supabase_vault`
   extension controls/binaries. This historical prerequisite was subsequently
   addressed in an isolated Linux VM with real native modules; no stubs or
   silently omitted extension errors. No Docker/system service was installed.

The capture/audit stage above did not execute SQL restore. It is superseded by
the dated test below, not retroactively relabelled as restore evidence. Another
production connection/password is not needed to decrypt/test this immutable copy.
Do not repeat the backup just to retry local restore. Auth/Storage service-level
validation remains unperformed; production DDL/migrations, deployment,
flags/scheduled cleanup and historical RLS remain untouched.

#### Local restore — 2026-10-22 (data verified; ACL blocker)

Actual final VM run started **2026-10-22T01:41:52.529Z**. The native driver
completed and its first comparison was recorded at **01:43:58.716Z**. A final
offline comparison of those outputs was recorded at **07:01:00.993Z**; that is
**not a second SQL execution or a newer source snapshot**. The original source
snapshot remains **2026-10-21T22:13:53.045Z**.

Target/preparation, not a production Supabase restore:

- Portable QEMU11.1/Alpine Linux VM, `-nic none`, no port forwarding/monitor/VNC;
  PostgreSQL **17.6** listening only on a guest-local mode0700 Unix socket,
  `listen_addresses=''`. No Docker entrypoint, Auth/Storage/Realtime services,
  source-provider requests or new production connection. BitLocker is not required
  under the owner's explicit waiver. All staging was owner/SYSTEM-only outside Git.
- Official `supabase/postgres:17.6.1.054` amd64 image, pinned manifest
  `sha256:e884cde9f5594ddb30ebec888bd236d128eaf9c9b48cc864d8fa3d27a6c6c6bc`.
  The initial OCI unpack command reached its20min bound; no complete-container
  image claim is made. Actual required PG/compiler/modules were inspected and
  exercised, and the exact locale payload was recovered from verified layer50.
- All seven extension versions matched the source inventory. Image pg_net0.19.5
  was not presented as compatible with source0.20.4: real **pg_net0.20.4** was
  built offline from official commit `698fb055f666366a78c112b0578b0a5652ddbcfa`.
  Native dependencies for all seven modules were checked. PG17.11 Linux clients
  were used for the final full-archive restore/schema/data redump, matching the
  export's minor generator version (server remains17.6).
- PostgreSQL17 initially rejected an exported `GRANTED BY` under the separately
  named bootstrap. The final target uses the exported platform grantor as its
  initial bootstrap, plus a distinct local operator role. Only the duplicate
  `CREATE ROLE` for that pre-existing bootstrap is omitted from a private replay
  copy; original encrypted roles/ALTER attributes/GRANT statements are unchanged.
  Full role/membership redump matched after removing only the local operator and
  client-version/random-restrict metadata. Source system OIDs were not captured.
  This reconciles the local target, not proof of a source bootstrap OID.
- Actual native pg_net0.20.4 requires preload. Its real, unmodified worker is
  confined to untouched **template1**, **batch_size=0**, never the restored DB.
  The worker is **present**, not falsely reported absent. Source code allows0
  and consumes queue rows with that bound. Native checks confirmed isolation,
  zero processing setting and an empty restored HTTP queue. Cron
  `launch_active_jobs=off` throughout; no restored jobs ran. Import sessions use
  `session_replication_role=replica` to prevent normal webhook/Vault triggers.
  Independent no-NIC isolation prevents external HTTP even if an unexpected hook
  exists. No playback, source API, webhook destination or production calls.

| Native comparison | Actual result / boundary |
| --- | --- |
| Full archive SQL execution | Completed with stop-on-error; final run used unfiltered full `pg_restore17.11`, not a partial application-only restore. Earlier preparation failures are retained privately, not called successful restores. |
| Snapshot table counts and data | PASS: every compared table count and sorted COPY-record fingerprint matched, including Auth and Storage SQL records. Only the two explicitly excluded net queue/cache tables are outside archived-data fidelity. No row counts/content in Git. |
| Sequence state | PASS against captured archive `setval` state, not an assertion about later production changes or atomic MVCC sequence snapshots. |
| Catalog structure | PASS for schema/table inventory, owners, RLS/force-RLS flags, extension membership/version inventory and constraint definitions/validation flags. This is not a blanket pass for all SQL serialization. |
| Key relationships | PASS: all restored FKs checked for orphans. Captured FK coverage includes group membership→groups/users and movie-group-list→groups/movies; source/target constraint definitions match. No undeclared relationships or Auth service behavior are inferred. |
| Roles/memberships | PASS for captured logical attributes/memberships, without role passwords. Source role/global definitions were stable during export. |
| Object ACLs | **FAIL globally**: PostgreSQL `aclexplode`/`acldefault` comparison retains grantee, grantor, privilege and grant option, including NULL/default semantics. Later exact enumeration found **two schema mismatches and zero table mismatches**. The earlier statement about extension-owned table mismatches was an empty-set `every()` diagnostic, not evidence of any such mismatch. |
| Full schema SQL | **FAIL**: normalized schema redump is not identical even with matched17.11 client. Remaining differences were not exhaustively classified; no blanket column/index/function/trigger/privilege fidelity claim. |
| Auth/Storage/Vault services | Not tested; SQL rows restored, no service entrypoint, object bytes or project-root-key recovery. |

**Historical blocker, subsequently scoped below:** permission/schema fidelity of the local Supabase-compatible
target is not established. Different managed/extension initial privileges are a
**hypothesis**, not an attested root cause. The source snapshot did not independently
capture `pg_init_privs` or every extension-member function/column ACL baseline.
Do not change/ignore ACL assertions, manually grant broader privileges, or call
this checkpoint fully recovery-ready because data alone matched. A bounded next
step is to compare the retained source/target ACL evidence against the relevant
extension/bootstrap initialization, then test a supported, source-preserving
reconciliation locally. Any additional privileged source-catalog capture requires
separate approval; no password in chat. No new M4 research/owner evaluation is
needed for this recovery issue.

Evidence and cleanup:

- Original ciphertext/key paths and hashes above are unchanged. Dated
  `restore-*.status.json` plus authenticated `restore-*-details.aesgcm` and
  `restore-*-comparisons.aesgcm` remain in that protected checkpoint directory.
  They retain private catalog/count/ACL diagnostics and comparison fingerprints,
  not public SQL/data or a Git archive. Original capture `status.json` remains
  immutable historical evidence; the latest dated restore result supersedes its
  old "not attempted" state. Updated offline audit reads both stages explicitly.
- **2026-10-22T07:02:45.8977708Z**: stopped VM/PG, validated exact temporary
  path/process/reparse boundaries, removed the entire disposable VM/software/
  plaintext staging directory. Original AES archive SHA256 and separate wrapped
  key preservation checked afterward; all retained AES-GCM artifacts authenticated
  again. Logical deletion, **not forensic secure erase** of SSD/pagefile remnants.
- Actual driver SHA256
  `ff74facf85b6689f32ac1fa00fa6dab95e674a131b7fe89ac2965d4945dc1fce`
  matched the normalized worktree helper before deletion. This is content
  provenance for that native run, not an invented runtime Git-commit attestation.
- [VM/operator helper](../supabase/operations/recovery-vm.mjs),
  [private staging/comparison](../supabase/operations/recovery-local.ps1),
  [native ACL queries](../supabase/operations/recovery-acl-checks.mjs) and
  [exact cleanup](../supabase/operations/recovery-local-cleanup.ps1) are a pinned
  operator test harness, **not a production restore/provisioning service**.
  Authored helper tests are separate from the actual database evidence above:
  **7 authored tests passed**, including console refusal after private staging,
  GCM tamper/wrong-key handling, COPY comparison and native ACL-query generation.
  JS/PowerShell syntax and local links/anchors checked (13docs/439links/267anchors,
  no errors); whitespace/scope checked. Application/browser/Windows demo lifecycle
  suites were not repeated: no application, launcher or deployment code changed.

References: [official Supabase PG image](https://hub.docker.com/r/supabase/postgres),
[pg_net0.20.4 preload/worker configuration](https://raw.githubusercontent.com/supabase/pg_net/698fb055f666366a78c112b0578b0a5652ddbcfa/src/worker.c),
[queue consumption bound](https://raw.githubusercontent.com/supabase/pg_net/698fb055f666366a78c112b0578b0a5652ddbcfa/src/core.c),
[PG17 role grantor/bootstrap rules](https://www.postgresql.org/docs/17/sql-grant.html),
[initial privileges catalog](https://www.postgresql.org/docs/17/catalog-pg-init-privs.html).

#### Focused recovery assessment — 2026-10-22 (M4 qualified)

**Decision:** the existing copy demonstrates recovery of the MW objects/data
needed before `20261020205122_media_advice_access_ledger.sql` and
`20261021072002_media_advice_review_fixes.sql`. This is a **scope-qualified
recovery checkpoint**, not permission to apply them. Original source inventory,
archive and comparison failures remain unchanged; no expected ACL was weakened.
No production connection, new snapshot, M4 SQL, flag or scheduler was executed.

**Exact ACL differences, final full PG17.6 restore:** 66 native schema/table
comparisons; 64 equal, the following two differ. All inventoried table ACLs
match, including MW/public, Auth, Storage and extension-owned tables.

| Object / ownership class | Captured source → restored target | Cause / MW impact |
| --- | --- | --- |
| `graphql`, Supabase-managed, owner `supabase_admin` | Source: owner `USAGE,CREATE`; `postgres` `USAGE WITH GRANT OPTION`; `anon`, `authenticated`, `service_role` `USAGE`, all granted by `supabase_admin`. Target: NULL ACL = owner defaults only; those four explicit grantee entries absent. | Inventory contains these grants, but the authenticated archive's schema SQL has **no SCHEMA ACL entry/grants for this schema**. A clean target cannot recreate omitted grants. This removes explicit schema access/grant option, not an RLS or MW-table change. |
| `graphql_public`, same managed ownership (not proved extension membership) | Identical source grants and target omission as `graphql`. | Same archive omission. GraphQL callers need schema USAGE in addition to function EXECUTE; a function grant alone is insufficient. `BYPASSRLS` does not itself supply schema privileges. No M4 RPC/query uses either GraphQL schema. |

The owner/default entry is unchanged; this is a real grant difference, not ACL
array ordering. The missing direct `postgres` grant option is distinct from any
power inherited through other roles. Managed ownership is **not** the same as
current extension membership: `pg_graphql` is absent from the captured seven
extensions. Why the exporter omitted these grants (for example an initial-
privileges baseline) remains unknown: source `pg_init_privs` was not captured.
That deeper cause is not asserted or needed to identify the omission.

**Narrow procedure correction:** after an offline restore, use
[the source-validated schema supplement](../supabase/operations/recovery-schema-supplement.mjs)
for these two schemas only. It requires the exact captured source owner/ACL,
allows only a default or already-identical target ACL, then grants precisely
the missing USAGE/grant-option entries **as the original grantor**. Unexpected
source or target rights cause refusal, not blanket grants/revokes. Re-run native
`aclexplode` comparison afterward. This is an operator restore step, **not a
production migration**, and is not imported by the application. Do not apply it
to the still-live source or claim it repaired the already-deleted PG17.6 VM.

**Targeted native repeat:** completed **2026-10-22T07:43:12.774Z**, Windows
PostgreSQL **17.11** (same major; earlier full data/extension restore was real
17.6). Only actual archived MW/public + Auth **schema** and logical roles were
replayed here; no rows reimported and no M4 migrations. No extension stubs,
cron/pg_net preload, event-trigger bootstrap, webhooks or source calls. The
endpoint was **127.0.0.1 only**, random port, random private SCRAM credential,
protected owner/SYSTEM directory; no LAN listener. This is distinct from the
earlier no-NIC/socket-only VM. No Auth service or user-token behavior is claimed.

- Both schema ACL omissions reproduced before the supplement; **44/44** scoped
  schema/table ACL comparisons matched after it, without changing source ACLs.
- MW/Auth table inventory/owners/RLS flags match independent of catalog ordering.
- **476 source SQL object blocks** match the redump's object meaning: tables,
  columns/defaults, indexes, constraints, functions/RPC definitions and archived
  permissions, triggers, RLS policies and default grants. No changed function,
  policy or constraint is silently normalized away. Authored tests ensure actual
  DDL/grant/grant-option changes remain failures.
- Exactly **two extra serialization blocks** are initdb's `public` schema and
  its comment, owner `pg_database_owner`; source archive relies on that built-in
  schema. Owner and effective ACL are checked separately, not inferred from the
  missing CREATE statement.

**Exact non-semantic SQL differences in that scoped repeat:**

| Serialization difference | Evidence / interpretation |
| --- | --- |
| Block `public.sync_social_advice_discovery_for_movie(uuid,boolean,uuid)` | Two following dump-boundary statements, `SET default_tablespace = ''` and `SET default_table_access_method = heap`, occur at a different first-table boundary. They are not function statements. Exact global setting values match separately. |
| Auth default ACLs for sequences/functions/tables, owner `supabase_auth_admin` | Same complete GRANT statements in a different order; no privilege/grantee/grant-option discarded. |
| Public default ACLs for sequences/functions/tables, owner `supabase_admin` | Same statements/order-only serialization; the final block also carries the dump-complete comment. |
| 29 FK `pg_get_constraintdef` strings | `REFERENCES auth.<table>` versus visible unqualified `REFERENCES <table>` under the different inspector/search-path context. Validation flags/actions unchanged; archived and redumped FK DDL explicitly agree on the actual target. Not evidence of a retargeted FK. |
| Extension versions | All seven matched in the full17.6 restore; no version mismatch is being normalized into a pass. No extension members/binaries were exercised in the later schema-only repeat. |

<details>
<summary>Exact FK deparser-only differences (auth qualification removed; no other definition change)</summary>

- `auth.users(id)`: auth FKs `identities_user_id_fkey`, `mfa_factors_user_id_fkey`,
  `mfa_recovery_code_sets_user_id_fkey`, `oauth_authorizations_user_id_fkey`,
  `oauth_consents_user_id_fkey`, `one_time_tokens_user_id_fkey`,
  `scim_users_user_id_fkey`, `sessions_user_id_fkey`,
  `webauthn_challenges_user_id_fkey`, `webauthn_credentials_user_id_fkey`;
  public FKs `advice_room_participants_user_id_fkey`, `advice_rooms_created_by_fkey`,
  `groups_created_by_fkey`, `profiles_id_fkey`, `push_subscriptions_user_id_fkey`.
- `auth.sessions(id)`: `mfa_amr_claims_session_id_fkey`, `refresh_tokens_session_id_fkey`.
- `auth.mfa_factors(id)`: `mfa_challenges_auth_factor_id_fkey`,
  `mfa_recovery_code_sets_mfa_factor_id_fkey`.
- `auth.mfa_recovery_code_sets(id)`: `mfa_recovery_codes_mfa_recovery_code_set_id_fkey`.
- `auth.oauth_clients(id)`: `oauth_authorizations_client_id_fkey`,
  `oauth_consents_client_id_fkey`, `sessions_oauth_client_id_fkey`.
- `auth.sso_providers(id)`: `saml_providers_sso_provider_id_fkey`,
  `saml_relay_states_sso_provider_id_fkey`, `scim_tokens_sso_provider_id_fkey`,
  `scim_users_sso_provider_id_fkey`, `sso_domains_sso_provider_id_fkey`.
- `auth.flow_state(id)`: `saml_relay_states_flow_state_id_fkey`.

</details>

**Dependency/access conclusion:** the two additive M4 migrations reference
`auth.users(id)`, MW `group_members`, `movies`, `movie_group_lists` and PostgreSQL17
built-ins (UUID/jsonb/time/advisory locks); none requires GraphQL, pg_net or Vault.
The full17.6 test already verified snapshot data/COPY fingerprints, sequences,
roles, all captured FKs and required membership/list/movie relationships. The
scoped repeat verifies the MW/Auth DDL and archived RPC/RLS/grants, not historical
RLS correctness (out of scope). Public/Auth schema/table access for `anon`,
`authenticated`, `service_role` is unchanged from inventory. New M4 private
tables/RPCs do not yet exist; their explicit service-role-only grants/default-off
and post-migration checks remain future execution gates. Existing RPCs were not
invoked; source-independent function/column ACL catalogs were not captured, so
their proof is archive replay fidelity, not an independent whole-source ACL audit.

**Remaining bounds, not an M4 recovery blocker:** full Supabase schema SQL hashes
still differ. Target raw SQL from the deleted full17.6 VM was not retained, only
fingerprints/catalogs; exact differences **outside** the scoped repeat cannot be
reconstructed from those hashes. They are not relabelled formatting-only or
asserted harmless for GraphQL/Auth/Storage/Vault service recovery. Requiring that
entire text to be identical adds no demonstrated protection for the two additive
M4 migrations after the MW/Auth checks above. Complete-project recovery still has
the stated Storage bytes, secrets/service-config, managed-function/initial-ACL
and portable/off-device key gaps. This verdict clears only the MW recovery gate.

Protected evidence: `focused-1792654992781-details.aesgcm`, earlier scoped raw-
difference proof, and dated authenticated `focused-assessment-*.aesgcm` beside
the unchanged original backup. The [focused reader](../supabase/operations/recovery-focus.ps1)
prints only structural evidence/flags, never rows or function bodies. All repeat
clusters/open copies, including the stopped first harness attempt, were removed;
original ciphertext and DPAPI key preserved. Logical deletion, not forensic
erasure. A Windows child-pipe harness issue and missing schema prerequisite in a
subset attempt were resolved locally, not misreported as backup/data failures.
No application/browser/owner lifecycle test was needed: no application changed.
Final checks: **12 authored recovery tests passed**, JS/PowerShell syntax passed,
13 documentation files /442 local links /268 anchors checked without errors,
whitespace/scope clean. Subsequent offline audit authenticated every retained
AES-GCM artifact and original manifest hashes. It reports
`m4MigrationRecoveryQualified:true` separately from the unchanged historical
whole-round-trip `scopeQualifiedRecoveryReady:false`/`fullProjectRoundTripVerified:false`.

#### Backup coverage contract — actual capture and exclusions

| Area | Captured scope / explicit exclusion |
| --- | --- |
| Application schemas/data | Unfiltered native custom archive. Full17.6 data/counts/sequences/FKs pass plus scoped MW/Auth schema/archived-permission fidelity established above. Sufficient for the two additive M4 migrations, not a blanket Supabase definition/service/permission guarantee. |
| Auth | Auth schema/data entries included only in encrypted archive, including sensitive account/session/hash records; no rows in Git/report. OAuth/SMTP settings, JWT/API secrets and external Auth service configuration excluded; project encryption-root keys not exported and service-level recoverability not established. |
| Roles/grants | Separate role/membership exports **without role passwords**, stability/restored logical comparison passed. Exact two managed GraphQL schema ACL omissions identified and source-preserving supplement tested; all original table ACLs match. No independent complete function/column/initial-ACL capture; no production privilege changes. |
| Extensions / managed schemas | Definitions/version inventory retained; source `pg_cron1.6.4`, `pg_net0.20.4`, `pg_stat_statements1.11`, `pgcrypto1.3`, `plpgsql1.0`, `supabase_vault0.3.1`, `uuid-ossp1.1`. Native logical dump omits non-config extension-owned table contents: specifically `net._http_response`, `net.http_request_queue` (HTTP cache/queue). No claim to preserve in-flight HTTP work. Extension binaries, managed services and Vault/project encryption-root keys excluded; no decrypted Vault export. |
| Storage metadata | Storage SQL metadata rows/counts matched in native restore. Metadata is not object bytes; service behavior and object-store recovery remain untested. |
| Storage files | Separate authorized object export with private per-object checksums/count/size verification; **not part of pg_dump**. No files copied or empty-bucket claim established in this checkpoint. |
| Project configuration | Netlify/Edge deployments, secrets, DNS, Auth-provider settings, service keys and other external configuration are excluded from this DB checkpoint. A database dump is **not a full Supabase-project backup**. |

This is a logical export of database`postgres` plus role definitions, not a
physical/PITR backup: PostgreSQL system catalogs, WAL, replication-slot runtime
state and server/OS configuration are not supplied. Object definitions/sequence
state follow native pg_dump semantics; sequences are not MVCC snapshots of
concurrent `nextval` activity. Do not infer external service recovery from SQL
archive completeness.

Actual destination and separate key are recorded above; both ACLs verified.
The direct-to-encryption stream avoids needing plaintext dump staging.
For this owner-authorized restore test, disk encryption is explicitly waived.
Temporary plaintext is allowed only inside the protected disposable environment.
The full restore used no NIC/TCP; the schema-only repeat used SCRAM loopback only,
never LAN exposure or external service execution. No plaintext
staging in Git/owner checkout/transcripts/public artifacts. Do not call private
filesystem placement encryption. Stop the VM and remove its exact verified
temporary directory afterward, preserving the original ciphertext and wrapped key;
do not broadly delete user files or claim secure physical erasure.

#### Resume procedure — only backup and isolated local restore authorized

**Steps1–3 and native4–5 were executed with the boundaries above; step6 is now
qualified for MW recovery before the two additive M4 migrations, not full-project
recovery. Do not repeat export or infer execution permission.
Disk encryption is not a prerequisite under the owner's explicit waiver.**
Export is a one-use operator command,
not a scheduled backup or migration tool. [Export wrapper](../supabase/operations/recovery-export.ps1)
and [worker](../supabase/operations/recovery-export.mjs) use the already prepared
local `pg` dependency; no product dependency or production code changed.

To recheck the existing ciphertext **offline**, use the same Windows profile:

```powershell
& '<isolated-checkout>\supabase\operations\recovery-audit.ps1' -Checkpoint 'checkpoint-20261021T221351Z-432dc0a6'
```

The [audit](../supabase/operations/recovery-audit.ps1) unwraps the separate DPAPI
key only in memory, passes it through child stdin, verifies original manifest
hashes and all AES-GCM tags, emits only safe coverage flags, and creates a new
dated private audit record. No source connection/password or SQL execution.
The [archive module](../supabase/operations/recovery-archive.mjs) documents the
format: magic`MWREC01\n` +12-byte nonce +ciphertext +16-byte GCM tag, with
header as AAD. Authenticate the **whole** file with `verifyArtifact` before
passing a second decrypt stream to any executing restore; streamed bytes are
not authenticated until the final tag passes. Wrong key/tampering must stop.

1. Establish the above private connection and PG17 tools. Recheck database/
   project identity and effective read permissions; no DDL on production.
   Record UTC start/end and a consistent snapshot boundary privately. Use a
   held read-only repeatable-read exported snapshot for the database dump and
   its validation counts so concurrent legitimate writes do not manufacture
   mismatches; keep its control connection open until exports finish.
2. Write the logical DB archive directly to the protected location, explicitly
   inventorying managed/application schemas; export roles without passwords
   separately. Inspect exit status/warnings and archive table-of-contents in
   protected files, never stdout/chat. Do not ignore unreadable relations or
   use schema-only/public-only output as a full DB success. Role/global metadata
   is separate from the data snapshot; detect/reconcile concurrent role changes.
3. Record SHA256, byte sizes, exact coverage/exclusions, dump-tool/server
   versions and snapshot UTC time in a protected manifest. Export Storage bytes
   separately if full Storage recovery is required; otherwise retain an explicit
   file-exclusion gap. Verify encrypted artifacts can be decrypted locally.
   Public documentation may record hashes/status, never bodies or credentials.
4. Initialize a disposable **local** PG17.6-compatible target, separate directory/
   cluster and local-only endpoint, no production connection string. Review the
   archive as executable SQL. Block outbound network; keep cron/pg_net, webhooks,
   subscriptions and Supabase services from executing external actions.
   Prepare matching extension/service prerequisites locally before restoring.
   Restore role prerequisites, then schema/pre-data, data/sequence state and
   post-data constraints/indexes/ACLs, using stop-on-error and no production
   `--clean`/restore commands. Never apply the M4 migrations as part of this test.
   Concretely: authenticate archive +roles file using the saved key; on the
   protected local target prepare compatible extension binaries with background
   work/egress disabled; inspect decrypted schema/role SQL privately. Prefer a
   **guest-local Unix socket, listen_addresses='' and a VM without a NIC**;
   never use the pooler. Reconcile
   the initial bootstrap/grantor with the role export (do not blindly replay
   conflicting CREATE ROLE statements); restore roles/memberships with `psql -X`
   and `ON_ERROR_STOP=1`. Use authenticated private staging and the matched17.11
   restore client over the dedicated guest socket. The final actual run uses
   full `pg_restore --create --exit-on-error` after dropping only initdb's empty
   local DB **before** preload/worker startup; no production connection/clean.
   `--create` is not combined with `--single-transaction`. Keep cron off and the
   required pg_net preload worker in empty template1 with batch_size0/no NIC.
   Reconcile the two omitted managed schema ACLs using the source-validated
   supplement above and rerun exact native ACL checks; unexpected ACLs stop.
   Any omitted/altered role or prerequisite must be recorded; a partial test is
   not a full pass. This is a procedure, **not a command authorized for production**.
5. Compare captured and restored schema object inventories/definitions, RLS/
   grants/ownership, sequence state and **per-table snapshot row counts**,
   including Auth and Storage metadata. Check validated FKs and explicit orphan
   checks for group_members→users/groups, movie_group_lists→movies/groups and
   any other inventoried key relationships. Record only aggregate pass/fail in
   Git, keeping counts/identifiers/details protected. Historical violations,
   if any, must remain distinguished from restore-created differences; do not
   repair historical RLS/data under this task.
6. If a Supabase extension/managed schema cannot restore on plain PG, report
   that exact dependency and any separately tested application subset. Do not
   replace it with a mock/stub or suppress errors and claim full recovery.
   Native SQL restore cannot validate OAuth/email, object bytes, Realtime,
   provider-hosted Vault or live Supabase services. Save verified hashes and
   local comparison evidence before declaring **scope-qualified recovery ready**.
   Stop/securely remove only the verified disposable target afterward; preserve
   the encrypted backup. **No production restore is authorized**.

Export/integrity, actual data/relationship checks and the focused MW/Auth
schema/permission verification establish **scope-qualified recovery for Step2's
two M4 migrations**, with the complete-project limitations above. This is not a
claim that the old whole-dump `verified:false` result became `true`.
No consolidation/deployment/migration/activation follows automatically.
Relevant official references (checked 2026-10-22):
[Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[DB backup limitations](https://supabase.com/docs/guides/platform/backups),
[PostgreSQL17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html),
[roles/global objects](https://www.postgresql.org/docs/17/app-pg-dumpall.html),
[private password file](https://www.postgresql.org/docs/17/libpq-pgpass.html).

Original preparation findings (2026-10-21; retained, not new restore evidence):

- PRs #190–#194 are open/mergeable, each head descends from its stated base;
  develop `acbdadf8efa2d180a12ed3fc85aa7784bb681782`;
  main `e92392856038e40e6d98c6c8744eed04c4e8dff9`.
- At exact heads, #190 has Netlify Deploy Preview success, three neutral
  Netlify checks and skipped Supabase Preview. #191–#194 have skipped Supabase
  Preview, no commit statuses; no approvals reported on any PR. These are not
  passing required tests. Rulesets list is empty; branch-protection read is
  **403**, so effective required checks/approvals/merge policy are **unknown**.
- Supabase: PostgreSQL **17.6**, UTC; no M4 schema or function-name collisions;
  migration list empty and history **table absent**, not proof of a blank DB.
  Required UUID/text columns match. `auth.users`, UUID generation and required
  roles exist. `pg_cron 1.6.4` is installed, `cron.timezone=GMT`; named M4 job
  is absent. No DDL/DML or function invocation performed in this review.
- Netlify site `e4d5295a-0794-40dc-abfa-6e346b04c142`,
  `denyslisovyi-movies-list`: published production deploy
  `6ad3ad799a970e3fc942b516` is ready, branch main at the main SHA above.
  This does not prove configured develop builds. Project tool does not expose
  build/branch settings, env scopes, APM or log drains. Values were not requested.

### Step 0 — pre-merge operator gates

In the [Netlify project dashboard](https://app.netlify.com/projects/denyslisovyi-movies-list):

| Dashboard location | Required evidence before execution |
| --- | --- |
| Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts | Production branch **main**; branch deploy explicitly enables **develop**; record auto-publish/build behavior. A merge into develop may immediately deploy. If not confirmed, stop before final merge; do not change settings silently. |
| Same area → Build settings; Functions settings | Repository/base/publish directory, Functions directory `netlify/functions`, dependency install and Node **22+**, bundler and synchronous limit. Diagnostics PR prepares a develop-only build stamp command in `netlify.toml`; verify that command at a separately approved deployment. Preserve existing publish/Functions settings and other contexts. |
| Project configuration → Environment variables | Owner reports Tavily/TMDb/MOTN keys Secret, Functions, Production + Branch deploys; Supabase URL/service-role present. Confirm **metadata/context only** (including develop overrides/shared-var precedence); no values/export. New source keys intentionally absent from PR previews. |
| Analytics & metrics → Log Drains; Extensions / installed APM integrations; Cloud compute → Functions → media-advice (branch filter develop) | Inspect destinations, body/header capture and retention/redaction; never capture bearer/API keys, source bodies/results, query snippets or card/tracking URLs. Tool cannot attest these. Built-in observability extension in published deploy is not proof of third-party APM capture or its absence. |

Check GitHub Settings → Rules → Rulesets / Branches and each PR merge box for
effective required checks, approvals and merge-commit support. Missing API
permission is not permission to bypass. If requirements cannot be established,
pause execution for owner confirmation, not policy changes.

Original function/import review (before diagnostic build stamp): `media-advice.mjs` imports three local libraries, then
existing research transports/projections/identity and shared URL policy; package
dependencies include Supabase JS and parse5. Offline import with networking
disabled and stubbed empty configuration succeeded. No runtime file-read asset
is needed by this handler. This is **not a Netlify bundle/deploy test**; local
Netlify bundler is unavailable. Branch build must include the complete import
closure/dependencies and list `media-advice` alongside existing functions.
Inspect publish output for secret/server-only artifacts; no env values may be
inlined. Keep 45s sources / 53s finish margins; no timeout/cap change.

### Step 1 — consolidate with merge commits

Pinned starting refs (full SHAs, not mutable labels):

| PR → base branch | Initial head | Initial base |
| --- | --- | --- |
| #194 → codex/m4-gemini-resolver-feasibility | bdca14f9a06a6e84297f75917c5b009dbf41fa66 | 0db059a710bff801e5c455dcc396f06914c156cc |
| #193 → codex/m4-3-kinobaza-discovery | 0db059a710bff801e5c455dcc396f06914c156cc | c5a09298903957b16360147b3363b8d4db90f195 |
| #192 → codex/m4-2-media-advice-server | c5a09298903957b16360147b3363b8d4db90f195 | e0817151f73da0f742ee72b77bc23bb709457d7b |
| #191 → codex/m4-1-media-advice-form | e0817151f73da0f742ee72b77bc23bb709457d7b | bd43cc83319888ff82c7763e48cd9adb36cb453a |
| #190 → develop | bd43cc83319888ff82c7763e48cd9adb36cb453a | acbdadf8efa2d180a12ed3fc85aa7784bb681782 |

Starting #194 tree: `6ddf25db140829951da748404a9244d6717308e5`.
This documentation successor is not silently part of that tree: if incorporated
into #194 first under later approval, repin its head/tree and review that docs
diff before executing this sequence.

| Merge | Expected source head | Expected target head immediately before merge | Record |
| --- | --- | --- | --- |
| #194 → #193 branch | H194 above | H193 above | M1 |
| #193 → #192 branch | M1 | H192 above | M2 |
| #192 → #191 branch | M2 | H191 above | M3 |
| #191 → #190 branch | M3 | H190 above | M4 |
| #190 → develop | M4 | pinned develop above, re-read immediately | M5 |

Before **each** operation: fetch refs; re-read source **and base** SHA, diff,
mergeability, reviews and checks at that exact head. Use GitHub merge method
`merge` with expected source `sha`; no admin/bypass/force/retarget/squash.
Expected head does not lock base: serialize operators, check base immediately
before merge and verify returned commit's first parent equals that base and
second parent equals expected source. After every parent advance, fetch and
record its new SHA, both parents, tree, ancestry and updated PR diff/checks.
Tree must equal the starting reviewed tip tree (or explicitly repinned docs
successor); do not copy old checks to the new SHA.

Before M5, verify the combined develop diff is M4 research-approved integration
only; both M4 migrations, Tavily selection and #192 fixes are present. Confirm
ancestry of all pinned heads plus launcher fix
`e596341f2fdc1203b52b9abae840f7090cef30c0` and R1/R2
`16461b22f001499720193d6b72df745dc8890a20`; no deletion/reversion of their tests/controls.
Run full M4 offline/HTTP/Edge suites on assembled M4; native PG17.6 evidence
can be reused only if SQL/ledger unchanged. After M5 record actual develop SHA,
tree/parents/ancestry, rerun relevant final checks and read fresh statuses.
Confirm main SHA and published production deploy unchanged.

**Stop** for any unexpected head/base/tree/diff, conflict, rejected merge,
missing required approval or failing required check. No automatic restacking.
M5 also authorizes an auto branch deploy **only if explicitly included in the
next approval**; do not invoke a manual deploy or build hook here.

### Step 2 — apply only the two M4 migrations (future privileged action)

| File under supabase/migrations | Dependency / SHA256 of reviewed bytes |
| --- | --- |
| `20261020205122_media_advice_access_ledger.sql` | Existing auth.users(id), public group_members/movies/movie_group_lists, standard roles and UUID function; creates private schema/two tables/index and two service-only public RPCs. `08b6ecfa102bb3d34d994a29d76412dfb6ad0546c65b4579c2408bd7f4fa825c` |
| `20261021072002_media_advice_review_fixes.sql` | Requires first file; replaces those RPCs, adds private cleanup_health. `39ab043e86072efe25db55e042945e11fa8cfe7f39d1977e5d55eab65b2cd1b7` |

No dependency on executing 001–016, no existing-row updates or historical
RLS changes. Recheck object collisions before applying, including **any**
same-name function signature; these are not idempotent replay scripts.
Verify hashes against Git blobs/assembled tip (line-ending conversion changes
byte hashes: establish the reviewed execution-file hash before running).
Confirm backup/PITR recovery availability privately; no restore is invoked.

Use a **new disposable Supabase CLI work directory containing only these two
unchanged migration files**, outside owner checkout. Current machine has no
Supabase CLI/psql in PATH: executing operator must pin/install an approved CLI
and first inspect `--version` and command `--help`. Planned commands below
are from the [official CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-up)
(checked 2026-10-21), not executed here:

```powershell
supabase migration up --help
supabase migration list --help
supabase migration repair --help
supabase --workdir "$m4Stage" init
# Copy ONLY the two reviewed files into $m4Stage/supabase/migrations.
supabase --workdir "$m4Stage" link --project-ref mttkectgdqqmejpenkrn
supabase --workdir "$m4Stage" migration list --linked
# STOP unless exactly these two pending versions and no unexpected remote history.
supabase --workdir "$m4Stage" migration up --linked
supabase --workdir "$m4Stage" migration list --linked
```

`$m4Stage` must be a new unique temporary directory, not the repo or an existing
linked workspace. Authenticate interactively with hidden password input; no
password-bearing URI/arguments, debug logs or credentials in the runbook/Git.
Confirm project identity independently before writes. CLI creates its own
history metadata and applies only pending files in that isolated directory.
Expected history: **only 20261020205122 and 20261021072002**, reflecting actual
execution. Do not use general `db push`, `--include-all`, historical replay,
blanket repair or automatic GitHub/Supabase production migration integration.

Both files contain transaction boundaries. On any error/lost reply **stop**:
an earlier file may have committed even if history recording failed. Inspect
actual catalogs/function definitions and history; never blindly rerun.
Only after proving which exact file executed may an operator use targeted
`migration repair <that-version> --status applied --linked` in the same
isolated directory. Do not mark 001–016 applied. Partial execution/history
reconciliation needs review, not an automatic retry.

Post-checks, with access still off:

- Exactly permissions/sessions/cleanup_health in private schema; RLS enabled,
  no anon/authenticated schema/table access. No permissions or sessions inserted.
- Two public RPCs have expected signatures/definitions, SECURITY DEFINER and
  empty search_path; service_role EXECUTE true, anon/authenticated false,
  including PUBLIC/inherited grants. Verify pg_proc/proacl and
  `has_function_privilege`; table grants match migration, cleanup_health is
  service-role SELECT only. Do not execute start/reserve as a smoke test.
- Record pre/post definitions/policies of the three existing public tables
  and private aggregate row counts/fingerprints, not row bodies; compare.
  Concurrent legitimate app writes require reconciliation, not a claim that
  counts prove no changes. Static SQL writes only new M4 objects. No lock or
  owner-demo interruption to manufacture identical snapshots.
- Check actual two history entries and no new automated cleanup job; capability
  without assignment must fail closed. Missing RPC/schema-cache visibility is
  an operations issue to investigate, not permission to replay migrations.

Copyable post-checks (privileged read-only connection, **after** migrations):

```sql
select version from supabase_migrations.schema_migrations order by version;
select c.relname,c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as user_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='media_advice_private' and c.relkind='r';
select p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,
  has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as user_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('media_advice_action','media_advice_cleanup');
select (select count(*) from media_advice_private.permissions) as assignments,
       (select count(*) from media_advice_private.sessions) as sessions;
```

### Step 3 — daily cleanup and independent control

Operator **Denys** owns activation and daily operations. After both migrations,
review/run [prepared schedule SQL](../supabase/operations/media-advice-cleanup.schedule.sql)
only with separate authorization: it creates the named job **inactive** and
refuses an existing name/non-UTC-equivalent timezone. Then inspect its single
jobid, command, database/user, `15 2 * * *` and GMT/UTC; activate that exact job
with `cron.alter_job(<verified-jobid>, active := true)`. No second job or
extension installation is needed by the observed baseline.

Retention origin is session **created_at**, eligibility after age24h **and**
expires_at elapsed (normal TTL30min), including unfinished/error sessions.
Still-active rows are retained and become an overdue finding if anomalously
old. Daily healthy scheduling expects deletion at age24–48h, **not a guaranteed
48h bound on scheduler/DB failure**. No movies/Wishlist or permission deletion.

Concrete pilot monitoring: Denys checks **daily at 09:00 UTC**, independently of
pg_cron, in Supabase SQL Editor using
[existing health SQL](../supabase/operations/media-advice-cleanup.sql), then
these read-only checks:

```sql
select jobid,schedule,active from cron.job
where jobname='mykola-media-advice-cleanup';
select status,start_time,end_time from cron.job_run_details
where jobid in (select jobid from cron.job
               where jobname='mykola-media-advice-cleanup')
order by start_time desc limit 3;
```

Require exactly one correctly configured job and today's scheduled
run succeeded and heartbeat advanced after02:15UTC; the health query's missing/
>26h success or age≥48h backlog is actionable too. Record only UTC check time,
success/overdue count privately. Initial missing heartbeat is expected before
first run, not permission to skip monitoring. Verify first scheduled success
before live access; alternatively a separately authorized one-time cleanup
can test the function but **does not validate scheduler firing**.

This is a **manual control, not automatic alerting**. Denys must explicitly
accept the duty before pilot, continuing after flag expiry until the final
session has been cleaned; without coverage postpone access. For a missed/
failed run, unexpected active job/TTL or overdue records: revoke pilot flag,
inspect scheduler/DB, perform only authorized cleanup recovery, recheck; no
source replay or accounting reset. Unattended alerting needs a separate
approved independent monitor/notification design; none is added or activated
implicitly. Scheduler cannot report its own complete outage.

### Step 4 — branch deploy verification and source-free smoke

Follow the automatic develop deploy from M5; record deploy ID, context
`branch-deploy`, branch develop, commit exactly M5 and its HTTPS URL
(expected convention `https://develop--denyslisovyi-movies-list.netlify.app`;
use dashboard-reported URL, not an unverified address as evidence).
Build/functions list must include media-advice with imports/dependencies and
no secret exposure; check diagnostics without bodies/keys. Published main
deploy must still be the recorded production one. Failure stops activation,
not a reason for manual prod publish or policy/secret-scanning bypass.

Future smoke, **no discovery/source calls**:

1. GET media-advice →405; cross-origin POST →403; valid-context POST without
   bearer →401, malformed context →400; all JSON/no-store, no secrets.
2. With actual browser login, only `action: capability` for an established
   film and eligible test group. Before assignment expect denial/hidden entry;
   ordinary form editing still works. Do not click Find; no start/reserve.
3. After separately authorized owner assignment, capability true only for
   that UUID/eligible group; unassigned user/visitor/foreign group denied.
   Open/close isolated advice without Find: no source requests or form writes.
   Do not create/delete/modify production group membership for smoke.

Capability uses Auth/RPC, not Tavily/TMDb/MOTN/Kinobaza. It does **not** validate
source keys or live resolver quality. Do not use existing movie-search as a
configuration probe. Ordinary read requests and later pilot Save are distinct.

### Step 5 — owner-only, expiring backend assignment

Owner UUID is **not established in this preparation**. Resolve it privately from
the owner's authenticated Supabase `getUser()` id, corroborate in Authentication
→ Users and eligible test-group membership. Never infer from display name or
choose the first auth user. Do not print access tokens or publish email/UUID.
Also establish the test group/list/film binding; current flag is per-user, not
a new per-group restriction.

Once all gates pass and activation is authorized: require no other enabled
M4 permission rows; replace `<VERIFIED_OWNER_UUID>` with that exact UUID and assign
**2 hours** through privileged SQL/admin, not editable user_metadata:

```sql
insert into media_advice_private.permissions(user_id,feature_key,enabled,expires_at)
values ('<VERIFIED_OWNER_UUID>'::uuid,'mykola_media_advice',true,
        clock_timestamp() + interval '2 hours')
on conflict(user_id,feature_key) do update
set enabled=true, expires_at=excluded.expires_at;
```

Emergency stop / end of pilot — a separate action, same verified UUID:

```sql
update media_advice_private.permissions
set enabled=false, expires_at=clock_timestamp()
where user_id='<VERIFIED_OWNER_UUID>'::uuid and feature_key='mykola_media_advice';
```

These are **future actions**. Confirm one exact active user/expiry after
assignment; all others default-off. Revocation
denies subsequent capability/reserve/finish/apply authorization; an already
dispatched source request may still have spent its attempt. It does not undo
earlier user Save or erase already displayed results. No retries/refund.

### Step 6 — pilot, only under subsequent authorization

Select **five concrete real Wishlist films first**; currently none selected.
Record their real IDs and test-group card bindings privately, not research
fixtures. One explicit discovery per film, ≤2 Tavily + ≤2 card + ≤4 baseline
= ≤8 attempts/case, **≤10 Tavily within ≤40 total**. No retries/fallback/
redirects/destination probes or platform sweep; internal search traffic unknown.
One select → preview → transfer → ordinary **Save in the test group**, checking
manual edits and exact acknowledged URL. This one Save is a later authorized
Wishlist write, not part of preparation/smoke. No claim/track propagation.

Record separately: search URL candidate acceptance; identity matched/refused;
extraction useful/partial/refused; source-labelled links/localization and
practical help; application calls/time and intervention; transfer/Save outcome.
No offers is not resolver failure or evidence of unavailability. Stop for
false identity, cap/access bypass, unexpected writes, lost edits or unsafe URL.
No raw responses/HTML/snippets/secrets archive.

### Unresolved prerequisites and evidence boundary

Execution remains **conditional**, not deployment/pilot-ready approval:

1. Effective branch policy/required approvals (403), fresh assembled-tip checks;
   explicit merge + possible automatic develop deploy authorization.
2. Dashboard develop/base/publish/functions/bundler/Node configuration and
   APM/log-drain/body-capture verification; env context metadata confirmation.
3. MW recovery prerequisite now scope-qualified for only two new migrations;
   explicit execution authorization, privileged connection/history procedure and
   live privileges/default-off/post-data checks still required and not yet run.
4. Explicit cleanup activation/first-run evidence and Denys's independent
   daily monitoring commitment (no automatic alerting exists).
5. Exact owner UUID/test group and later bounded backend assignment.
6. Five real pilot films, still unselected, and separate pilot/Save authorization.
7. Account/source-use conditions: Tavily §§2/3.5 end-user scope versus an
   owner-only pilot, actual plan/quota and AUP obligations; Kinobaza automatic
   arbitrary-card content rights not supplied by Search; existing TMDb/MOTN
   attribution/commercial/retention requirements. See dated findings below;
   no blanket clearance, no new runtime legal switch.

Read-only catalog/project/PR review and offline import check passed. No runtime,
SQL, flag, secret or scheduler change here; prior #194 45-pass/1-skip browser/
offline and #192 native17.6 evidence stay pinned, not a new run on these docs.
Markdown-only: verify links/anchors, consistency, scope and whitespace; no
reason to repeat runtime/Windows suites. Reference docs checked 2026-10-21:
[Cron](https://supabase.com/docs/guides/cron),
[migration history repair](https://supabase.com/docs/reference/cli/supabase-migration-repair),
[function logs](https://docs.netlify.com/build/functions/logs/),
[log drains](https://docs.netlify.com/manage/monitoring/log-drains/).

## Verification record

Authored fixtures are not source HTML archives or live coverage evidence.
Real-form Edge browser covers desktop, 375×812 (iPhone X-sized) and 820×1180
(Air-sized), not real iPhone/WebKit validation. It checks social-state isolation,
local transfer, no write before Save, explicit clearing, affiliate acknowledgement,
manual edits, same-session reuse, late replies and clipboard fallback.
Local PostgreSQL/WASM validates only the new migration against minimal authored
prerequisites. Existing research offline/HTTP/security suites protect unchanged
requests, R1/R2 and old modes. No assertion/timeout is weakened.
Launcher/key-routing components are unchanged, but the pure shared URL-policy
import adds a copy-layout dependency. The Windows isolated test fixture now
preserves repository-relative paths; lifecycle is rerun for this concrete risk.
WebKit and live source/resolver behavior remain unvalidated. Windows lifecycle
was not repeated for the narrow #192 fixes: no launcher, key routing, research
transport or Windows fixture dependency changed; earlier evidence is reused only
for that unchanged boundary, not claimed as a new lifecycle run.

### #192 narrow blocker regressions (2026-10-21)

Original findings: pending apply survived Cancel/Escape while awaiting access;
the old 55s source clock excluded preceding Auth/start RPC; access checked before
the advisory lock could become stale while queued. Fixes are selection-token
revocation, entry-based phase deadline, and fresh post-lock authorization.
Authored regressions cover each trigger (not live source reconstruction), pending
close/new selection/manual edits, hanging Auth body/reserve/finish, resolver abort
after reservation, and queued flag/group/card revocation. Native 17.6 tests also
cover concurrent duplicate starts/stages, eight-slot cap, twenty-session cap,
service-only privileges and cleanup health. PGlite tests cover active/younger rows
and no card/Wishlist deletion. The isolated native server is stopped after tests.
Scheduler extension/run integration is **not run**: only inactive configuration
and the health query are prepared, no production job or migration activated.
An authored cron stub verifies the configuration transaction's UTC/refusal,
inactive-job and no-overwrite behavior; it is not evidence of pg_cron execution.

Final narrow-fix run: **43/43 M4 tests passed**, including real-form Edge at
1280×900 / 375×812 / 820×1180 and native PostgreSQL 17.6 with 24 connections;
**29/29** targeted research provider-grouping/matching regressions passed.
13 Markdown documents / 418 local links / 257 anchors: zero errors; whitespace
clean. To repeat native tests, set `M4_NATIVE_PG_MODULE` to the local pinned
`embedded-postgres@17.6.0-beta.15` module's `dist/index.js` before `npm run test:m4`.
No project dependency was added for that portable engine. Without the explicit
module path the native test is **skipped**, not successful native evidence.
Browser tests likewise need `PLAYWRIGHT_MODULE_PATH` and the installed Edge
channel; WebKit is absent. Native runs create authored temporary data and stop
their own loopback server, without installing a Windows service.

Platform references checked 2026-10-21:
[Netlify synchronous execution limit](https://docs.netlify.com/build/functions/configuration/?fn-language=js)
and [Supabase Cron scheduling/monitoring](https://supabase.com/docs/guides/cron),
[Cron configuration](https://supabase.com/docs/guides/cron/quickstart).
These are hosting/database checks, not movie-source rights clearance. The new
code is ready for focused re-review and controlled pilot **preparation**, not
automatic merge, activation or a claim of deployed readiness.

Recorded checks on the assembled implementation:
M4 authored offline/HTTP/SQL + Edge form suite passed; research offline/HTTP
**463/463** passed; Windows `windows.test.ps1 -Discovery` passed parent-exit
survival, duplicate start, inherited mock-key routing, safe stop and restart in
a disposable copy. No actual SSH disconnect was repeated. WebKit executable is
absent. Local links/anchors: 13 Markdown documents, 416 links / 257 anchors,
zero errors; whitespace clean. Exact final counts/remote statuses are recorded
in the implementation PR description rather than guessed here.

## Gemini-primary resolver feasibility (2026-10-21)

Historical Gemini proposal, retained for its explicit blocker. The later
[Brave pilot decision](#brave-pilot-provider-decision-and-data-flow-audit-2026-10-21)
supersedes provider selection, not this finding or the unchanged runtime gates.

### Decision and verified code baseline

**Outcome: concrete API-use blocker; documentation-only successor, no adapter
activation.** Current #192 HEAD `c5a09298903957b16360147b3363b8d4db90f195`,
base #191 `e0817151f73da0f742ee72b77bc23bb709457d7b`; fetched develop remains
`acbdadf8efa2d180a12ed3fc85aa7784bb681782`. All three #192 fixes are ancestors.
At that checkpoint the request was Gemini-only, so Brave was not silently
substituted. Its later explicit pilot approval below is a new provider decision,
not fallback behavior.

Inspection: `netlify/lib/kinobaza-resolver.mjs` exposes a replaceable
`searchFactory(apiKey, boundedFetch)` with `accepts` and `search`; its current
handler wiring in `netlify/functions/media-advice.mjs` still instantiates Brave.
**This documentation change does not switch that existing wiring off or claim
Gemini is installed.** M4 remains default-off, no activation or fallback is
performed. A deployment of the unchanged baseline with its old Brave key would
still select Brave; it must not be presented as the requested Gemini pilot.

Research `config.mjs`/`server.mjs` currently use `gemini-3.8-flash`, REST
`generateContent`, `googleSearch: {}`, low thinking, 4096 output tokens and a
server-side `x-goog-api-key`. `public/display.mjs` checks UTF-8 support offsets,
chunk indices and Search Suggestions to display the original answer/citations.
That display contract is not a reusable license for automated URL collection.
No secret values, owner configuration or live responses were inspected/copied.

### Source-use blocker: explicit, not missing permission documentation

The [Gemini Additional Terms, Grounding with Google Search → Use Restrictions](https://ai.google.dev/gemini-api/terms#grounding-with-google-search)
(effective March 23, 2026; checked October 21) explicitly include these examples:
“using programmatic or automated means to collect Links” and
“using Links to identify destination pages for crawling or scraping”.
They restrict separating components for another purpose and require combined
grounded-answer/Search Suggestions display. The proposed machine URL resolver
followed by Kinobaza HTML extraction directly conflicts with that stated use
restriction. Transient memory, metadata-only URLs, fewer calls or adding display
do not remove this purpose conflict. No claim of a general ban on Gemini or
Kinobaza integration is made; this is the specific requested Grounding path.
No applicable written exception is established. Without one or a different
explicitly approved source route, do not activate this path. This is an
engineering source-use assessment, not a legal guarantee.

### Technical capability is present, but does not clear that blocker

| Question | Official contract / consequence |
| --- | --- |
| Supported model | [Stable model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) explicitly lists Search grounding for `gemini-3.8-flash`. Old model choice is still documented, not assumed valid merely because it exists in research. Account availability is not tested. |
| API variants | [Generate Content Search guide](https://ai.google.dev/gemini-api/docs/generate-content/google-search) documents `POST /v1beta/models/gemini-3.8-flash:generateContent` with Google Search tool and header key. The [current main Search guide](https://ai.google.dev/gemini-api/docs/google-search) instead demonstrates Interactions. Do not mix their response shapes or assume an API migration fixes use restrictions. |
| Generate Content evidence | [GroundingMetadata / GroundingSupport reference](https://ai.google.dev/api/generate-content#GroundingMetadata): `groundingChunks[].web.uri`, support `groundingChunkIndices`, `segment`/part byte offsets, `webSearchQueries`, `searchEntryPoint`. Generated text alone is not metadata evidence; citation attribution is not film identity. |
| Interactions evidence | Main guide shows `google_search_call`, `google_search_result`/Suggestions and text `annotations` of type `url_citation`, with URL and segment indices. This is not the old `groundingMetadata` envelope. |
| Opaque URLs | Generate Content guide itself illustrates `vertexaisearch.cloud.google.com` source URIs. A `web` chunk has URI/title, not a guaranteed separate canonical-destination field. A generated canonical URL plus an opaque citation does not establish their equivalence. |

Any later permitted implementation must accept a URL only from a structurally
valid, actually grounded source reference, linked to the cited response segment,
then apply unchanged exact Kinobaza admission and independent identity/extraction.
Do not use citation title/snippet as a destination mapping or identity proof.
Wrong host, generated-text-only URL, empty/malformed grounding, or unsupported
opaque reference must return a precise non-candidate outcome, not absence of a
film/card. No redirect following, slug reconstruction, URL Context substitution,
provider fetch or hidden resolution request is permitted.

An opaque-reference-only result would require a **separately scoped proposal**
for one tightly bounded reference-resolution operation, with validated host/path,
target re-admission, accounting and terms review, before any implementation.
It is not approved here and would not itself solve the explicit use restriction.

### Accounting recorded before any implementation (proposed, not live-ready)

The API exposes a single application request that can cause multiple internal
Google Search queries. Keep these units separate:

| Unit | Ceiling / accounting rule |
| --- | --- |
| TMDb / MOTN HTTP attempts | Existing ≤4, unchanged independent gates and identity reuse. |
| Gemini API POST attempts | ≤2, each atomically reserved before dispatch using the two search slots. A lost response/timeout still consumes its reservation. |
| Google Search operations | Unknown unless a documented response exposes them; declared query metadata is diagnostic, not an attested billing total or guaranteed complete internal count. Never label two Gemini calls as two Google searches. |
| Kinobaza card GETs | ≤2, sequential; no redirects/retries/destination requests. |
| Application HTTP total | ≤8 = 4 + 2 + 2, not a total-network-traffic or cost cap. No extra opaque-reference hop fits this definition without a separately reviewed budget. |
| Time | Entry clock preserved: source work ends by 45s, finish by 53s, response/platform margin unchanged. No deadline reset or increased request cap. |

Second-call strategy, only if the use blocker is cleared: after a successful,
well-formed **grounded** first response with no admitted direct candidate, use
one different already-known title alias plus existing year/director to
disambiguate. No second call for auth/quota/transport/timeout, missing/malformed
grounding or opaque-reference-only output. Multiple direct candidates go through
the existing ≤2 card gates/choice, not a new LLM identity decision. This is not
implemented and is not permission to run a probe.

The [pricing page](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash)
currently lists Standard paid input/output at $0.75/$3.75 per million tokens
through December 31, 2026, then $1.50/$7.50 from January 1, 2027. Grounding is
not on the API Free tier for this model: 5,000 monthly search requests shared
across Gemini 3+ precede $14/1,000 search requests; each model-executed search
query is chargeable under its billing rules. No remaining quota, zero cost or
per-film price is inferred. The [rate-limit guide](https://ai.google.dev/gemini-api/docs/rate-limits)
uses model/project/tier limits (not per-key); actual owner limits are unknown.

### Data/configuration and pilot boundary

If later allowed, the outgoing input is explicitly projected public film
identity only: title/known aliases, year, director and optional IMDb. Never
serialize the whole film/source object: no user/group/form IDs, draft, TMDb/MOTN
offers, card HTML, full responses or owner control observations. No source data
to LLM for extraction, recommendations, localization or enrichment.

`GEMINI_API_KEY` would have to be separately provisioned in Netlify Functions
scope; an existing owner/demo key proves neither presence nor entitlement there.
That unimplemented proposal required server-side explicit Gemini selection, never
inference from whichever key exists. No env var, credential copy, provider-selection switch
or new dependency is installed by this blocked change. Existing
`BRAVE_SEARCH_API_KEY` is not invoked as Gemini fallback; baseline wiring is
unchanged as stated above. Do not provision keys to bypass this decision.

The five-real-Wishlist-film pilot must **not use the requested Gemini resolver**.
Provider choice is now resolved by the Brave decision below; no Gemini exception
is assumed. No owner evaluation or new risk-based study is requested. Tests for
any future, separately permitted Gemini adapter would still need: direct
grounded candidate; text-only/wrong-host/opaque URL; invalid/empty grounding;
ambiguous candidates; timeout/quota/no fallback; second-call strategy, ≤8 cap,
independent gates, R1/R2, exact URL/acknowledgement and form safeguards.
No placeholder adapter or synthetic pass is claimed as implementation. This
successor changes only Markdown, so runtime/browser/native suites are not rerun;
their #192 results remain pinned historical evidence, not a test of Gemini.
Verify local links/anchors, whitespace, scope and unchanged runtime tree only.
Documentation-only verification: 13 documents / 420 local links / 259 anchors,
zero reference errors; whitespace clean. Runtime/security/ledger/research paths
are byte-for-byte unchanged from #192 `c5a0929`; no runtime tests are newly
claimed. Actual Gemini/Search/card requests in this task: **0**.

## Brave pilot provider decision and data-flow audit (2026-10-21)

**Historical checkpoint, superseded by the Tavily replacement below.** Brave is
no longer selected because of practical access/payment difficulties reported by
the owner. The dated review, observations and counts below remain historical
evidence, not current production adapter/configuration instructions.

**Approved provider: Brave ordinary Web Search**, solely to find candidate
Kinobaza URLs. Current handler wiring already selects it; no runtime change or
provider switch is necessary. Gemini Grounding is not used for URL → HTML
extraction and is not a fallback. No other automatic fallback exists. Finding a
URL is not acceptance of film identity, extraction success or availability.
Search rank/snippets do not satisfy any identity gate or fill any offer field.
Resolver quality remains **live-unvalidated**, not established by authored mocks.

### Dated terms finding and boundaries

[Brave Search API Terms of Use](https://api-dashboard.search.brave.com/documentation/resources/terms-of-service),
last updated September 1, 2026, checked October 21: §3(a) permits application use;
§3(b)(i) restricts Search Results persistence while excepting operational transient
storage. No direct equivalent of Google's Link-collection restriction was found
for this bounded candidate-only flow. This is not blanket permission or a legal
guarantee. §9(d) preserves third-party content rights; Brave grants no Kinobaza
content rights. Other §3(b) limits, including redistribution/AI-improvement,
remain; no Search Results are sent to an LLM or used for AI training/evaluation.
§4(c) end-user/privacy obligations and actual account/Order Form still require
operator confirmation. §4(d) attribution is optional but has requirements if
elected; this change adds no Brave branding or endorsement claim.

### Verified repository data path (no live traffic)

Reviewed #193 `e412c0374bc99279b8eaecbfacaf78bef44081d3` on #192
`c5a09298903957b16360147b3363b8d4db90f195`; both remain open, develop unchanged.
This is a code/mock audit, not an inspection of deployed databases, browser
extensions, log drains/APM or provider-side retention. No persistence or leak of
the specified Search Results was found in the application path; no fix required.

| Stage / inspected component | What exists transiently | What leaves/persists |
| --- | --- | --- |
| Brave response: `netlify/lib/kinobaza-resolver.mjs`, `braveWebSearch` | Bounded response bytes/JSON only in the current invocation (≤512KiB). | `web.results[].url` only through `admittedCandidates`; title, description/snippet, result envelope and numeric rank are not projected/logged/saved. Exact URL dedup/order preserves a bounded candidate list, not identity evidence. |
| Resolver: same module, `createKinobazaResolver` | Admitted URLs, ≤2 fetched card results, independently checked identity/extraction. | Only status/count/reason summary; matched card projections/choices. Rejected/unexamined raw search entries are not returned. No query/search response cache, disk, log or database call. |
| Projection: `netlify/lib/media-advice-service.mjs`, research `discovery.mjs` | Card `sourceURL` in provenance/film-localization or matched `cardChoices`, separate provider hrefs parsed from HTML. | Projected response only; `stages` removed. No raw Search Results or HTML archive. A source-card URL can reach the client as temporary provenance; it is not falsely claimed to be absent from the response. |
| HTTP boundary: `netlify/functions/media-advice.mjs` | Result/serialized response in invocation memory; secret-echo suppression. | `Cache-Control: no-store`; generic errors, no body/URL/error-object logging. RPC arguments are fixed context, operation, session ID and stage only, never search result/card URL/snippet. |
| UI: `assets/media-advice.mjs`; `app.js` media-advice bridge | Controller closure/session and text-only DOM; same-form reopening reuses memory. A chosen source-card URL may be shown. Invalidation clears session/DOM and rejects stale replies. | No localStorage/sessionStorage/IndexedDB, telemetry, chat-history snapshot or automatic navigation of search/card URLs. Requests use `cache: no-store`. `service-worker.js` has no fetch/cache handler. Closing retains appropriate current-session memory, not persistent storage. |
| Short report: `assets/media-advice-report.mjs` | Allowlisted counters, statuses/reason codes and localization scopes, copied only on explicit action; selectable-text fallback. | No search queries, result text/rank/snippets, raw source-card/provider URLs or credentials. Clipboard is an explicit user export of that safe summary, not a source archive. |
| Ledger/cleanup: both new M4 migration files | Private context bindings and attempt stages; cleanup health timestamp/count. | Technical session accounting only; no result/body/snippet/query/card URL columns or writes. Retention/permissions remain as above; no migrations executed in this task. |

The repository M4 path has no custom analytics/telemetry emitter, response logger
or Search Results storage. Existing unrelated app localStorage keys (group,
invite, conversation-finished boolean) and main-chat HTML state do not receive
this controller's results. Hosting instrumentation settings were not queried:
before activation, verify that function log drains/APM, replay or browser
telemetry do not capture request/response bodies or source URLs. This is a
remaining operational check, not a claim that remote logging was inspected.

### Separate origin and lifecycle of provider links

For Kinobaza source rows, provider hrefs in `row.link`/`rawHref` come from a
**separate Kinobaza HTML GET**, not from Brave's result URLs. MOTN links keep
their own API provenance. HTML links retain provenance and link classification;
tracking/affiliate transfer needs acknowledgement. `transferFor`/`makePreview`
pass only the chosen medium and eligible provider href, never card `sourceURL`,
search response, provenance object or snippet. Same-film/provider observations
do not merge, and film badges do not become provider tracks.

The controller changes only local form fields after explicit review/confirm.
Ordinary `getMovieFormData` → `getMovieGroupListData` → Save can later persist
that chosen **provider link** as `purchase_url`; no automatic save occurs.
Existing app form/movie debug logging can also contain saved/selected provider
URLs. Thus this audit does **not** claim that all URLs everywhere in MW are
nonpersistent/unlogged; the confirmed boundary concerns Brave Search Results
and search-discovered source-card URLs. Existing form logs do not receive the
Search Results, source-card provenance or M4 result object. No unrelated logging
refactor is introduced under a documentation-only provider decision.

### Pilot cap and remaining activation conditions

Exactly five actual Wishlist films, chosen before execution, not a new risk-set
substitution. One explicit action per form/case, no retries. Per film: TMDb/MOTN
≤4 + Brave ≤2 + card GET ≤2 = **8 application source HTTP attempts**. Across the
pilot: Brave **≤10**, card GETs ≤10, all sources **≤40**; these are ceilings, not
targets. Brave alternate query only after a successful first search with no
admitted candidate, never after timeout/auth/quota/transport error. Internal
provider traffic remains unknown and is not counted as known network traffic.
The entry deadline, atomic reservations, unknown accounting on lost responses,
independent gates, R1/R2 and form/draft controls are unchanged.

Provider selection is resolved; remaining preparation is the existing M4 review,
separate merge/develop branch-deploy authorization and verification of actual
Netlify context/functions/key mapping, source-use/account checks, reconciled
migration baseline, authorized cleanup/monitoring and backend-only pilot access.
No secrets/flags/migrations/deployment are changed here. The five-film pilot
and owner evaluation still require their separate activation step, not a new
research cycle or another provider-selection approval.

### Audit checks

No runtime defect found, so only canonical documentation/README change. Existing
resolver/report/HTTP authored regressions: **14/14 passed**. A separate in-memory
authored canary exercise traversed handler → resolver → projection → report/RPC:
2 Brave + 2 card + 4 baseline mock attempts, 8 reservations; no search
title/snippet/envelope/key in client output, no URL/result in RPC or report,
0 application log calls. Matched source-card URLs appeared only as transient
provenance/choices; a separately extracted HTML provider link kept exact href
and acknowledgement. The exercise disabled real fetch, saved no fixture/body
archive, and is not live validation. Static review additionally covered storage,
service worker, normal Save and existing app logging. Full browser/native/Windows
suites are not rerun for unchanged runtime; prior evidence is not relabelled.
Current documentation verification: 13 Markdown documents / 422 local links /
261 anchors, zero errors; scope and whitespace clean. The prior Gemini-only
checkpoint's 420/259 counts above are historical, not this audit's scope/count.

## Tavily Search replacement (2026-10-21)

**Implemented/offline-tested; live-unvalidated, default-off.** Narrow successor
to #193 `0db059a710bff801e5c455dcc396f06914c156cc`, base #192
`c5a09298903957b16360147b3363b8d4db90f195`. #190/#191 and develop
`acbdadf8efa2d180a12ed3fc85aa7784bb681782` were unchanged at inspection.
No migrations, ledger stages, client/state/form-transfer logic, dependency,
cleanup configuration or research adapter changed. All three #192 fixes remain.
Brave is removed from the active M4 path; Gemini's established API-use blocker
is unchanged. There is no alternate-provider fallback.

### Contract and data boundary

[Official Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search),
checked 2026-10-21: POST `https://api.tavily.com/search`, Bearer header;
`search_depth: basic`, `topic: general`, `max_results: 5`,
`auto_parameters: false`, `include_answer: false`,
`include_raw_content: false`, `include_images: false`,
`include_favicon: false`, `include_usage: false`,
`include_domains: ["kinobazaua.com"]`, `include_domains_mode: restrict`.
The explicit request avoids automatic parameter/depth changes and generated
answers. Only `results[].url` is used; content/score/title/answer are discarded.
Missing/malformed results is an error, not an empty success; `results: []` is
empty. Responses exceeding five results are refused, unsafe URLs filtered and
exact admitted URLs deduplicated. No Extract/Crawl/Research endpoint or SDK.

The existing `searchFactory(apiKey, boundedFetch)` interface remains injectable.
Only exact Tavily endpoint POSTs are accepted; redirects/cookies are refused.
The 15s/512KiB response bound is inside the existing entry-based 45s source
deadline, leaving the finish phase until 53s. Durable reservation precedes each
attempt; a post-reservation deadline prevents dispatch without refund/retry.
At most two searches: the second uses an already established alternate title
only after successful search with zero admitted candidates. HTTP/auth/quota,
malformed/oversize, transport and timeout errors do not trigger another query.
401/403/429/432/433 and other HTTP errors use content-free status codes.

The audited path remains response → URL admission → bounded card GET →
independent identity/extraction → projected source rows → transient client.
Neither Search Results nor snippets/scores/envelopes enter ledger, form,
short report, browser storage or application logging. Matched card addresses
can appear as transient card provenance/choices, not a search archive.
The automated canary regression covers handler → projection → report/RPC and
zero application log calls. Hosting-side telemetry/log-drain configuration
remains uninspected and must not capture request/response bodies or secrets.
Separately extracted HTML provider links retain their own provenance and
R1/R2/navigation/transfer/acknowledgement rules. Ordinary explicit Save may
persist that chosen provider URL; this is not persistence of Search Results.
The existing app's form logging caveat in the historical audit still applies.

### Dated source-use findings, not legal approval

[Platform Terms](https://www.tavily.com/terms) (May 4, 2026; checked October 21):
§§1.2–1.3 define Customer Applications/inputs, including end-user queries.
§2 permits documented API integration but limits it to internal business
purposes and expressly restricts third-party API use without prior written
consent. §3.5 nevertheless addresses external application end users and
requires appropriate user agreements without shifting liability to Tavily.
Account/Order Form scope must reconcile this before unrelated group-user
activation; protected keys alone do not establish rights. §§7/9.2 permit
provider-side input sharing/retention/improvement: application no-storage is
not a provider zero-retention guarantee. §17.8 requires usage/audit records;
check actual account obligations without archiving result bodies. This is
neither blanket app prohibition nor clearance.

[AUP](https://www.tavily.com/acceptable-use-policy) (May 5, 2026; checked
October 21), §2 allows expressly supported automated access while preserving
third-party rights/obligations; no specific Google-style ban on candidate
URL → independent HTML fetch was found in these reviewed texts. §4 requires
downstream-user compliance/enforcement; §5 requires output vetting. Those are
conditions, not a Kinobaza content license. Query input here is public film
identity only, never user/group/draft/source offers. Application code requests
no LLM answer; this does not claim Tavily has no internal AI processing.

**Assessment:** documented search capability is compatible with the narrow
technical pipeline; customer-app/end-user license scope remains **unresolved**,
not cleared by this implementation. Kinobaza automatic arbitrary-card
extraction and existing TMDb/MOTN conditions still need the separately
authorized activation preflight. No new legal toggle/acknowledgement is added.

### Five-Wishlist-film live plan (prepared, not authorized/executed)

**Correction:** no five-film manifest has been selected or agreed. Earlier
P1–P5 labels were placeholders, not agreed films. The
[execution runbook](#activation--operation-plan-not-executed) is the only
current operation/pilot sequence: select real Wishlist films before activation,
≤10 Tavily calls within ≤40 application source attempts, one ordinary Save
check in the test group. No pilot, preflight discovery or automatic retries
are authorized here; billing/actual quota and provider internal traffic are
not established by application counters.

### Replacement verification

Authored fixtures only, not live Tavily/Kinobaza validation. Final M4
offline/mock-HTTP/isolated SQL/Edge suite: **45 passed, 1 native test skipped,
0 failures**. Edge covers desktop 1280×900, mobile 375×812 and 820×1180,
including pending apply/cancel/stale/manual-edit controls and safe clipboard
fallback. Separate research provider-grouping/matching/R1/R2 regressions:
**29/29 passed**. Ledger SQL, #192 queued access/
pending-apply fixes and launchers are unchanged: no new migration or native
PostgreSQL/Windows lifecycle execution is required for this adapter change.
Previous PostgreSQL **17.6** concurrency evidence is reused, not relabelled as
a Tavily run. No WebKit/device claim; Edge mobile viewport checks are separate.
Local Markdown verification covers the root README, this canonical record and
the existing research README/docs: **13 documents, 424 local links / 263
anchors**, zero errors. Historical counts above remain pinned to their own
checkpoints, not silently reused.

## Autonomous five-film resolver iteration — 2026-10-23

**Authorized implementation and live source investigation; no merge/deploy.**
This subsequent owner decision supersedes the numerical caps of the earlier
individual diagnostic controls, not application limits or service conditions.
Lock the five cases before testing: Blade Runner 2049 (2017), Mortal Kombat
(2021), Alien (1979), Oppenheimer (2023), Dune: Part Two (2024). The first four
retain difficult owner-pilot cases; do not replace failures with easier films.
Control URLs are independently established comparison evidence, never inputs
to `createKinobazaResolver` or film-specific runtime exceptions. Automatic
discovery, identity acceptance and extraction are separate outcomes; five
successful controls would not establish whole-catalogue accuracy or rights.

### Reviewed person record, not a film exception

The earlier three-attempt person check stopped at a local 512KiB bound. Under
the expanded authorization, the canonical Kinobaza person page was successfully
read with an 8MiB **local inspection** bound: actual HTML 807,749 bytes, HTTP200.
This does not change runtime title-card admission or its 2MiB body limit.
Its unique H1 is `Денні Вільньов`; the same profile header explicitly names
`Denis Villeneuve`, gives `3 жовтня 1967`, and lists director as a role.
The canonical is the requested
[Kinobaza person profile](https://kinobazaua.com/persons/denis-villeneuve).
The existing trusted
[TMDb movie credits](https://api.themoviedb.org/3/movie/335984/credits?language=uk-UA)
identified one Director, person137427 (`Дені Вільнев` / `Denis Villeneuve`);
the already-read
[TMDb person record](https://api.themoviedb.org/3/person/137427?language=uk-UA&append_to_response=external_ids)
gave the exact English name and full birth date `1967-10-03`.

Manual person-level review of the exact English full name + full birth date +
director role, attached to the same canonical profile/H1, establishes the
literal alias for `tmdb:person:137427`. This is not the older diagnostic's
automatic exact-alias/shared-ID confirmation: the Kinobaza page exposed neither
a shared IMDb/TMDb person link nor a JSON-LD Person object. Birthplace values
differ (TMDb Gentilly versus Kinobaza Trois-Rivières); no matching-birthplace or
shared-person-ID claim is made. Slug similarity and any studied film title/year
are not the linkage basis. An independent read-only evidence review agreed
that this distinctive person-profile composite is adequate for this one
reviewed record, with those explicit limitations.

The registry now contains exactly one real record: `Денні Вільньов`, namespace
`tmdb:person`, ID137427, scope `kinobaza-director-identity`, reviewed 2026-10-23.
Exact NFC/whitespace/case equality only; no transliteration/fuzzy matching or
director-gate bypass. It applies across this person's films, not other people,
titles, offers or tracks. Unknown/ambiguous directors remain unresolved;
explicit film-ID conflicts retain priority and claims remain withheld.
Authored regressions exercise the actual record with two invented films,
another person and conflicting film evidence: **31/31 passed**, not live
availability or extraction validation.

### Practical resolver work and one-entry local session

General discovery changes under this authorization retain two search stages
and two card stages. Normalize duplicate title-query spellings; use a genuinely
different established title or an unquoted version when only one exists.
Promote exact established ASCII title/optional-year slug matches as discovery
hints, never create a URL or use its slug as identity proof. After a completed
first-card identity refusal, use the remaining search slot before the
second card slot; merge/deduplicate actual returned URLs and rank unseen
candidates. Search errors are not retried and do not trigger alternatives.
Admission, actual HTML identity/extraction, no redirects, R1/R2, exact links,
acknowledgement and form controls remain independent. The normal application
budget remains **8 = baseline4 + search<=2 + cards<=2**, with unchanged ledger
stages/deadlines. The final fallback policy is recorded in the dated results
below; no migration or arbitrary network destination is added.

`scripts/m4-practical-session.ps1` is an opt-in local task tool, not deployed
code. Enter TMDB_READ_ACCESS_TOKEN and TAVILY_API_KEY once each, hidden, and
leave that SSH terminal open for the series (up to four hours). The helper
keeps credentials and minimal trusted projected identities only in process
memory; fresh fixed Node workers load edited resolver code for each requested
operation. No key argv/environment/file/clipboard/console handoff, raw source
archive or search snippet persistence. Reusing trusted identity prevents
unnecessary repeat TMDb reads. A local-only named pipe permits the current
Windows SID explicitly and rejects remote pipe clients in the kernel; it avoids the older
CurrentUserOnly elevation comparison. Same-SID desktop/SSH connectivity still
needs an actual session handshake; a failed handshake is not permission to
rerun source tests blindly. Worker calls are separately bounded (60s and<=6
attempts per invocation); the broader task can perform further deliberate
iterations, with cumulative accounting, not automatic retries.

At preparation, **3 new HTTP attempts**: Kinobaza person2 + title-card1, all200;
TMDb0/Tavily0. The second profile read obtained the additional co-located
English-name/birth-date fields not projected by the first inspection. The card
read confirmed the previously observed Blade Runner2049 H1/H2/year/director
shape. Historical25 attempts remain separate (**28 combined to this point**).
No five-film automatic success is claimed yet. Full live resolver evaluation
continues after the one credential entry; no new per-iteration authorization
is needed. No MOTN/watch-provider/destination fetch, Wishlist write, owner
demo change, initApp/lifecycle/auth/UI/retention/SQL/flag change or deployment.

Preparation validation on the edited tree: **72/72 targeted offline/mock tests**
(crosswalk, resolver, title/year, safe diagnostics and local series worker).
Native PowerShell7 prerequisite check passed explicit-SID pipe request/response
and the actual fixed Node worker `status` operation with authored placeholders:
zero credential prompts/source requests. This exposed/fixed a missing worker
opt-in argument and .NET async-void return leakage before any real key entry.
An independent local-worker review also removed a too-broad H1-parent text
projection: profile diagnostics now expose bounded headings, not biographies.
13 Markdown docs/447 links/273 anchors, zero errors; whitespace/scope checked.
No new browser/iPhone, Windows-demo lifecycle or SQL run yet: UI, form transfer,
launcher and ledger are unchanged. Relevant final regression scope will be
reassessed after the actual five-film iterations, not claimed from mocks.

#### SSH preflight repair, before credential entry

The owner launch at `fce49c6` returned `session-not-started` /
`local-pipe-prerequisites`, **sourceRequests0**, before either hidden key prompt.
That screenshot identifies the failed preflight, not the internal create/
connect/frame/ACL branch or SSH token groups. The initial desktop/elevated
preflight success was not proof of success under the owner's SSH token.

Code review found an unconditional Deny-FullControl ACE for the Windows NETWORK
SID. That SID describes a logon-token group, not whether a pipe client is
connecting from another computer: it can deny an authorized same-account
**local** SSH client. The fix retains one protected current-user-SID Allow ACE
and moves remote-transport rejection to native `PIPE_REJECT_REMOTE_CLIENTS`
(`0x8`). No Everyone/Users/anonymous grant, listener, default ACL, elevation
requirement or credential file is introduced. Asynchronous operation,
first-instance protection, non-inherited handles, request/output bounds and
one fixed worker remain. The native handle is owned/closed by SafePipeHandle /
NamedPipeServerStream; its security descriptor and helper compilation contain
no credentials and exist only in memory. Sources:
[Microsoft CreateNamedPipe flags](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createnamedpipea),
[managed SafePipeHandle wrapper](https://learn.microsoft.com/en-us/dotnet/api/system.io.pipes.namedpipeserverstream.-ctor).

On any remaining preflight failure, safe diagnostics distinguish create,
local-connect, request-frame, response-frame and ACL-check, with exception type,
numeric HResult/Win32 code and NETWORK-group-presence boolean. No exception
message, token/SID dump, key or source content. This repairs local launch only;
the screenshot does not by itself prove which SSH authorization check failed.
The corrected desktop non-elevated preflight already passes pipe round trip,
exact protected ACL and actual Node status worker, with **zero HTTP requests
and zero credential prompts**. Actual owner-SSH handshake remains to verify.
The five-film source series has not started; counts remain3 new /25 historical
at this checkpoint. No resolver/search-policy/runtime or app-state change in
this follow-up, no live repeat/merge/deploy.

The focused native Windows Authz regression uses the **actual** new pipe DACL
and a copy with the old NETWORK deny restored, then adds an enabled NETWORK
SID to a synthetic current-user authorization context: old ACL/current user
alone permits, old ACL/NETWORK denies (error5), new ACL/NETWORK permits. This
reproduces the authorization defect with the Windows engine, not a homemade
ACE evaluator or a claim that the owner's actual SSH token was captured.
The same native test invokes the exact-HEAD zero-prompt/zero-HTTP pipe + worker
preflight. Targeted checks: native pipe regression1/1 and local series worker
regressions3/3; no full runtime/browser/demo/SQL repetition for this local
helper-only repair. Actual five-film source work resumes after the hidden
entry, without new authorization or a repeat of already completed source runs.

#### Full local-session recovery — 2026-10-24

The owner entered the keys at `a79e94f`. The agent could connect locally, so
the earlier SSH ACL barrier no longer prevented transport. Initial client
errors were generic and do not establish their exact branch. A subsequent
diagnostic connection closed without sending a frame; later connects timed
out. No identify/resolve/inspection operation was dispatched: **zero source
attempts** in this credential session, not a repeat of the earlier controls.

Code review found a second local-wrapper defect: client EOF can change the
stream to Broken / `IsConnected=false`; the conditional Disconnect was then
skipped and subsequent WaitForConnection calls could not recover the still
allocated pipe. Cleanup now tracks an accepted connection and disconnects it
even after EOF, recreating the same protected local pipe if necessary. That
does not repeat a source action or clear credentials/context/counters. The
client adds typed `-Action` / `-Film` / `-SourceURL` parameters, constructing JSON
internally instead of relying on nested Windows shell quoting, and emits safe
error phase/type/HResult only. Remaining outer errors preserve known counters
or explicitly unknown counts instead of always claiming zero after prior work.
These are local task-tool repairs, not application search, TTL or budget changes.

The complete fake-key session also reproduced a first-response loss: the
server disconnected immediately after writing, while PipeStream Flush is not
a drain and Disconnect discards unread pipe data. The corrected client sends
a framed receipt only after receiving/validating the entire safe JSON reply;
the server waits at most5s for that receipt before disconnecting (including
safe error replies). There is no unbounded WaitForPipeDrain or source retry.
If sending a receipt fails, the client still preserves the already received
guarded result/known counts and marks `acknowledgementSent=false`. References:
[Microsoft pipe disconnection](https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-disconnectnamedpipe),
[PipeStream Flush semantics](https://learn.microsoft.com/en-us/dotnet/api/system.io.pipes.pipestream.flush).

The already-running owner process has the older functions loaded; editing the
files cannot hot-patch its broken connection state. Restart that helper only,
not the owner demo/application, and enter the keys hidden again. No credential
is recovered from process memory, copied to disk or requested in chat. After
that necessary wrapper restart, the authorized autonomous five-film work
continues; no source rerun or new per-iteration consent is requested here.

A new native full-loop regression executes the real helper/client code in
isolated processes with a random pipe and authored fake keys, never the
owner's pipe. It verifies status twice, an abandoned connection, another
status with retained counters, receipt acknowledgements, stop and complete
process/stdout closure. It passes without changing timeouts/assertions; the
test waits for child `close` (stdio drained), not just `exit`. This closes the
coverage gap in the older separate pipe/worker preflight. No five-film search
result is claimed from this local regression.

Final targeted run: **5/5 passed**, no failures/skips or loosened timeouts:
native Authz/preflight + complete fake-key lifecycle +3 worker regressions.
The first incomplete protocol tests failed and motivated the actual fixes;
they are not described as passing evidence.13 docs/447 local links/273 anchor
references and whitespace/scope checks pass. No live source attempt added;
no app/runtime/UI/launcher/SQL suite rerun is warranted for these helper-only
changes. The actual five-film resolver outcome remains pending the corrected
credential-session start, not declared blocked by an external service.

### Five-film automatic results — 2026-10-24

**Completed local resolver investigation/fix/recheck, not deployed runtime
attestation or a new owner pilot.** The corrected hidden-input session worked
under the owner's SSH connection. TMDb search + Details established all five
identities (10 requests); projected identities were then reused in memory.
No MOTN, Watch Providers, provider destination, redirect or automatic retry was
performed. No source HTML/search response/snippet archive was created.

The final five-case pass used the same edited source tree over checkout
`eaaa07bf54731718f5c8629d85d7704c9f94b5df`, explicitly `localTrackedEdits=true`,
`execution=local-diagnostic`, `buildSha=null`; it is not a server-attested commit.
All five worker hashes were
`7d680acd8d4328496927aa032f19eacea29c1c8c1c18e91282f093343df5d580`.
The reviewed source changes are committed in #200. The URLs below were actually
returned by search, then independently checked from HTML; none was supplied
as a resolver input or installed in a runtime catalogue.

| Film / verified identity | Control / automatically selected card | Final search/card attempts | Identity / extraction | Local run ID |
| --- | --- | --- | --- | --- |
| Blade Runner 2049 (2017), TMDb335984 / IMDbtt1856101 | [blade-runner-2049](https://kinobazaua.com/titles/blade-runner-2049) | Tavily1 / cards2 | matched / partial; 32 candidates, 4 localization blocks | `819cad64-99da-40ff-bd98-2c42daad8b67` |
| Mortal Kombat (2021), TMDb460465 / IMDbtt0293429 | [mortal-kombat-2021](https://kinobazaua.com/titles/mortal-kombat-2021) | Tavily1 / cards2 | matched / ok; 36 candidates, 3 blocks | `2a1f352a-836f-4343-b368-6c2306108a25` |
| Alien (1979), TMDb348 / IMDbtt0078748 | [alien](https://kinobazaua.com/titles/alien) | Tavily1 + public search1 / cards2 | matched / ok; 29 candidates, 3 blocks | `d014f8ac-2dc5-4430-a59b-eaaf6060a040` |
| Oppenheimer (2023), TMDb872585 / IMDbtt15398776 | [oppenheimer-2023](https://kinobazaua.com/titles/oppenheimer-2023) | Tavily1 / cards2 | matched / partial; 24 candidates, 3 blocks | `5c2c19fa-6883-42bb-94c7-11fb1ce198aa` |
| Dune: Part Two (2024), TMDb693134 / IMDbtt15239678 | [dune-part-two](https://kinobazaua.com/titles/dune-part-two) | Tavily1 / cards2 | matched / ok; 32 candidates, 3 blocks | `57ee79f0-ca2b-4f9d-b66c-1e958b67793a` |

Each final result is `one-confirmed-bounded-not-exhaustive`: one accepted card
among the bounded reads, not proof that all source editions were examined.
Matched identity uses the existing `explicit-title-year-director-match` route;
no film stable ID was invented from a snippet or slug. The local summary's
localization counter was corrected from nonexistent `providerBlocks` to the
actual `localization.blocks`; the extractor/model were not changed. Counts are
source claims, not independently verified offers, tracks or entitlement.
Partial extraction remains partial. No transfer/Save was attempted here.

#### Findings and final general strategy

- The reviewed Villeneuve person alias works for both Blade Runner2049 and
  Dune2. Unknown person spelling/group scope still withholds claims; no identity
  gate relaxation was needed for these five films.
- An early Mortal Kombat pass found Legends: Battle of the Realms first; its
  different title/director was correctly refused. The second search slot then
  found the 2021 card. Search outputs varied: the final pass found that card in
  the first Tavily response. Do not attribute a deterministic ranking guarantee
  to this small series.
- Tavily returned Prometheus, Alien3, Covenant and related films for Alien1979,
  not the actual card, across the original queries, a ten-result experiment,
  altered quoting/year grouping and an IMDb discriminator. Those experiments
  did not solve recall; **none of those experimental query/result-limit changes
  is retained**. The ordinary public source search returned `/titles/alien`;
  a separate control read passed the same identity gate. That manual control
  was not counted as automatic success. Two later actual resolver passes found
  it automatically through the general public-search fallback.
- Wrong-film pages remain refused, including Alien3/Prometheus/Covenant, a Blade
  Runner1982 card, Dune: Prophecy and the Oppenheimer documentary. Historical
  owner-pilot responses are not reconstructed by these new reads.

Tavily remains the primary provider (basic, max5 URL results, existing parameters).
A successful first search with no admitted pointers still gets the established
alternate-title Tavily query. After a completed first-card identity refusal,
the remaining **second search slot** instead reads the source's ordinary
public form: fixed `https://kinobazaua.com/search?q=<encoded trusted title>`.
The form action/input and its unique `div#nav-titles` result scope were observed
read-only on 2026-10-24; this is not an invented/private endpoint. Only literal
relative `/titles/<admitted-slug>` anchors inside that scope become candidates.
Source rank, link label, snippet, genre and person text never become identity
or localization evidence. An explicit source-relative anchor is resolved only
against the fixed canonical host; title-card admission itself is unchanged.

The fallback has GET/manual/omit/no-auth controls, 15s header/body deadline,
2MiB UTF-8 HTML bound, at most100,000 nodes/depth256/500 scoped anchors and one
unambiguous result container. The initial 100-anchor local bound refused an
ordinary observed scope (173 anchors:40 repeated title links plus133 auxiliary
links); this own-code limitation was fixed, with an authored regression and a
remaining finite bound. Missing/ambiguous/unsupported scope is a diagnostic
refusal, not an absence-of-cards claim. Public-search diagnostic `returned`
counts scoped anchors, not distinct film results; admitted counts unique safe
card pointers and duplicate counts responsive repetitions. Safe short reports
now identify the allowlisted search provider so those units are distinguishable.

The union of actually discovered URLs is deduplicated and ranked before each
remaining card read. No generated slug, per-film URL/alias exception, prefix
sequel promotion, fuzzy matching, transliteration or winner among ambiguous
confirmed cards. Primary/alternate title query text remains title/year-only;
the director remains an independent HTML identity gate. Errors do not trigger
fallback; no Brave/Gemini fallback. Search<=2/card GET<=2 and full runtime cap8,
durable `search-1/2` reservations, handler/finish deadlines and lost-response
accounting remain unchanged. No new dependency, key, migration or storage.

#### Actual request ledger and limits of the result

| Scope | TMDb | Tavily | Kinobaza public search | Kinobaza title GET | Kinobaza root | Person GET | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Working credential session, all investigation/rechecks | 10 | 22 | 3 | 32 | 0 | 0 | 67 |
| Public-form/control-structure inspection outside credential broker | 0 | 0 | 3 | 0 | 1 | 0 | 4 |
| **2026-10-24 total** | **10** | **22** | **6** | **32** | **1** | **0** | **71** |
| Earlier expanded-task preparation, recorded above | 0 | 0 | 0 | 1 | 0 | 2 | 3 |
| **This expanded task, total** | **10** | **22** | **6** | **33** | **1** | **2** | **74** |

Earlier separately authorized controls remain25 (historical cumulative99,
not a single evaluation run). The final five-case recheck alone cost16:
Tavily5 + public search1 + title GET10, with zero repeat TMDb requests because
trusted identity was reused. Successful and unsuccessful/refused attempts are
included. Broker `countsIncomplete=false`; all recorded HTTP responses in this
working session were200, including semantically refused results. Search-provider
internal network operations are unknown and not included as known HTTP traffic.
No credentials or response bodies are included in this ledger. The local key
session was explicitly stopped after the final pass; no additional live work
is required to complete this task.

Five successes demonstrate this bounded improvement, not general catalogue
coverage/accuracy. No automatic claim that a link destination works, tracks bind
to a particular offer, access exists in UA or the user is entitled. Extraction
coverage and source-use/account constraints remain; ordinary public search does
not create blanket permission to reuse content. No new rights closure, production
activation or hosted latency assertion is made. The full hosted deadline may
still produce a bounded partial outcome under slower services.

#### Final validation and handoff

- Targeted resolver/public-search/crosswalk/diagnostics tests:86/86 passed.
- Full `test/*.test.mjs` offline/mock/HTTP/browser run:167 passed,0 failed,
  1 explicit skip (native PostgreSQL multi-connection fixture is not configured
  for this run). Chromium/Edge exercised desktop1280x900, iPhone-X-sized375x812
  and Air-sized820x1180, pending apply/cancel/Escape, manual form edits,
  clipboard fallback, retained/expired state and late replies without source
  replay. These are authored browser states, not an actual iPhone/Safari result.
- Additional relevant invariants after adding two budget/deadline tests:
  161/161 passed across resolver and research assisted identity, localization,
  provider grouping/R1/R2 and URL controls. Counts overlap the full run; they
  are not added together as distinct coverage. The two new cases explicitly
  cover full-action8 with public fallback and denied/expired `search-2` without
  dispatch. No assertion/timeout was loosened.
- The new ordinary-search structural limit was calibrated to observed benign
  anchor counts, with a regression at173 and refusal above500. This is a
  justified parser-bound change, not a claim that a prior too-small limit was
  an external blocker.
- Native Windows task-helper ACL/complete fake-key session tests passed in the
  full run. Windows **owner-demo launcher lifecycle** and native PostgreSQL
  concurrency were not repeated: their code/SQL are unchanged and no new
  relevant risk was introduced. Prior dated evidence is not called a fresh run.
- No WebKit/device test, hosted resolver validation or remote-check success is
  inferred from local tests. Links/anchors, whitespace and scope are checked;
  remote missing/skipped statuses remain missing/skipped, not passed.

Review-ready in existing stacked #200, above unchanged #199/#198. No merge,
retarget, deployment, source-policy closure or owner evaluation is performed
by the handoff. Owner checkout/demo and unrelated untracked files are preserved.
MW-FUT-01 remains Discovery.

## Three-film pilot retrieval follow-up — 2026-10-28

**Authorized investigation and implementation; merge/deployment not authorized.**
Base: verified `origin/develop` / deployed commit
`e63316bcb36fdd3aff41c0522a4495d42460bc69`. Netlify deploy
`6ae1f36b7525afed6cc83754` is ready, branch `develop`, context `branch-deploy`,
with the media-advice Node22 function present. This task changes neither that
deployment nor production. Work is isolated from the owner checkout/demo.

Owner evidence, not archived source responses:

| Film | Owner run | Reported outcome / limit |
| --- | --- | --- |
| Blade Runner (1982) | `70479803-be87-4152-9f3c-bd3322f001bd` | Kinobaza matched, 7/8, mapped0, film-UA unknown; externally observed iTunes/MEGOGO/audio on the current card does not reconstruct the historical HTML. |
| Mortal Kombat (2021) | `b9c22f56-8ad3-458b-bee0-ab970f829bbf` | Matched, seven source rows Apple/Rakuten/MEGOGO/Prime; positive preservation control. Apple UA audio5.1/subtitle observation is not an attested ability to buy. |
| Supergirl (2026) | `f7aca2a8-c902-4857-92ec-5bd82bd64e05` | First card title/year match with director-alias unresolved, second year refusal; 8/8 and eleven unread candidates. Report lacks card URLs; do not attribute either historical read to today's known URL. MOTN Prime language claims do not establish offer binding or UA entitlement. |

Implementation: establish current extraction and person-level evidence;
preserve independent film/provider localization when country sections cannot
establish UA availability; reuse exact namespaced person aliases across films;
add bounded content-free extraction diagnostics and a digest of the requested
card pointer; run the actual resolver for the locked three films plus relevant
offline/browser regressions. No inferred country/offer enrichment, broader URL
fetch, UI/controller/global auth/lifecycle change, persistence or migration.

Initial current evidence (five read-only HTTP attempts): three known
card markup inspections, one exact Blade Runner extraction diagnostic, one
person-profile inspection. Bodies were processed only in memory.
The current Blade Runner card has PL/CZ/DE sections and no UA section. The actual
unmodified extractor returned matched / unsupported-markup /
`missing-explicit-ukraine-section`, candidates0, no localization: it computes
independent badge/block localization then discards it on this global refusal.
That proves a present code defect, not the historical run URL or body.
The diagnostic's selected title/year/director metadata was an explicit owner
control, not a newly attested TMDb projection; independent TMDb checks follow.

The current Supergirl director anchor points to
`https://kinobazaua.com/persons/craig-gillespie`. Its canonical person header
co-locates H1 `Крейґ Ґіллеспі`, English H2 `Craig Gillespie`, birth date
1 September1967, Sydney NSW Australia and director role. The subsequent trusted
TMDb projection establishes sole director `tmdb:person:50767`; its fixed person
details record reports `Крейґ Джиллеспай`, IMDb `nm0318916`, birth date
`1967-09-01`, and no additional aliases. The exact English full name, complete
birth date and director role agree across independently read person headers.
This reviewed composite evidence activates literal `Крейґ Ґіллеспі` only for
person50767 and scope `kinobaza-director-identity`; no shared external person ID
was observed on Kinobaza. References: [trusted TMDb film projection](https://api.themoviedb.org/3/movie/1081003?language=uk-UA&append_to_response=external_ids,alternative_titles,credits,release_dates,translations),
[TMDb person](https://api.themoviedb.org/3/person/50767?language=uk-UA&append_to_response=external_ids),
[Kinobaza person](https://kinobazaua.com/persons/craig-gillespie). No film/slug
shortcut, fuzzy matching, transliteration, flat multi-person alias list or new
runtime person request. The existing Villeneuve record remains unchanged.

Historical exact-card/body recovery is unavailable by design: copied reports
omit URLs/bodies, the technical ledger stores no source content, and transient
results were not archived. A new source response cannot establish what an old
request returned. Current automatic results below are separate new evidence.

Implemented fixes retain independent pre-accordion observations on country-only
refusal, while ambiguous countries are handled atomically and valid foreign
countries stay foreign. Shared fixed/assisted extraction changes because both
use that same proven faulty path; admission and identity are unchanged.
The current Blade Runner post-fix control returns partial,20 candidates,
2 blocks and2 mapped rows: Apple/iTunes audio reported-negative/subtitles
reported-positive for the named block labels; MEGOGO audio/subtitles
reported-positive; general film audio reported-positive. Both rows have country
unknown and availability unknown. These are literal source scopes, not a claim
that Apple has no Ukrainian track in any offer or that MEGOGO is entitled in UA.
This control still uses explicit owner metadata, not fresh TMDb attestation.

Source attempts before the credential-backed series: **7** = titleGET6 +
personGET1. One post-GET local diagnostic used an incomplete projection-stage
argument and failed before printing a result; its spent GET is included, not
reported as zero or silently retried. The corrected deliberate check produced
the result above. No body archive or application retry was introduced.

Content-free diagnostics now retain allowlisted extraction status/issues,
candidate/foreign/block counts and film-badge state. Each attempted admitted
card also gets SHA256 of its exact requested public URL: compare a known URL
offline without copying raw URLs into the short report or archiving a body.
The digest is not a capability, retrieval success or identity proof. Existing
runtime SHA/run-ID attestation remains unchanged. Source content, aliases and
HTML are still absent from normal reports/ledger.

### Current automatic results, not historical reconstruction

PR [#201](https://github.com/hebbiz/movie-wishlist/pull/201), based on develop
`e63316bcb36fdd3aff41c0522a4495d42460bc69`. Fresh server-side TMDb search/details
established Blade Runner78/`tt0083658`/1982/person578, Mortal Kombat460465/
`tt0293429`/2021/person1828590 and Supergirl1081003/`tt8814476`/2026/person50767.
The normal resolver, admission, identity, extraction and composition functions
then ran without supplying known card URLs. No MOTN/Watch Providers or provider
destinations were requested. Shared trusted identity data was reused, not fetched
again during resolver repeats. Known URLs were used only in separately counted
markup/control inspections, never injected as resolver successes.

| Film / final local run | Automatic accepted card | Outcome and added source scopes | Resolver attempts in this pass |
| --- | --- | --- | --- |
| Blade Runner1982 / `3b9acca1-f9c2-471d-b9a1-8d8e788af19b` | `https://kinobazaua.com/titles/blade-runner` | Matched; partial,20 candidates/2 blocks/2 Kinobaza mapped rows. General film UA audio positive; Apple subtitles positive with named stereo/dolby audio labels negative; MEGOGO audio/subtitles positive. Both provider blocks have unknown territory/availability. Ex Machina correctly rejected by title. | Tavily1 + card2 =3 |
| Mortal Kombat2021 / `f0901a0c-e6dc-418f-ad90-5a4180996097` | `https://kinobazaua.com/titles/mortal-kombat-2021` | Matched; ok,36 candidates/3 blocks/4 Kinobaza-only mapped rows. UA-section Apple pointer has unknown tracks; separate Apple/Rakuten/MEGOGO blocks keep literal track values and unknown territory. General film UA audio positive. Legends: Battle of the Realms correctly rejected by title. | Tavily1 + card2 =3 |
| Supergirl2026 / `42a13989-aff0-4224-935e-c9e2a6492fec` | `https://kinobazaua.com/titles/supergirl-2026` | Matched with confirmed person alias; ok,24 candidates/1 block/3 Kinobaza mapped rows. UA-section Rakuten/HBO pointers have unknown tracks; separate Rakuten block audio/subtitles positive, territory unknown. General film UA audio positive. Just Her remains unresolved and withheld. | Tavily1 + public Kinobaza search1 + card2 =4 |

All outcomes are `one-confirmed-bounded-not-exhaustive`; no claim that unread
candidates do not contain another match. Supergirl's first current pass read the
same correct card but stopped specifically at director-alias; after the reviewed
person record it passes without changing any other gate. This establishes a
current before/after, not the identity of either historical owner-read card.
Mortal Kombat's four rows above are **Kinobaza-only**: the owner's seven historical
rows were combined source observations, including Prime. Their different counts
are not evidence of dropped baseline rows; an authored seven-observation
Apple/Rakuten/MEGOGO/Prime preservation regression checks composition separately.
No current Prime availability or Apple purchase/5.1 claim is independently
validated by this source-limited run. Source country, film badge, provider track,
offer binding and entitlement remain distinct.

### Request ledger and secret handling

This task used **34 application HTTP attempts**, including failed local diagnostics
and deliberate rechecks: TMDb7, Tavily6, ordinary Kinobaza search2, title-card18,
Kinobaza person1. The protected broker counted27 (TMDb7/search8/card12), plus the
seven separately recorded pre-session reads above. TMDb comprises6 identity
search/details reads and1 person read; search comprises6 Tavily +2 public search.
The two automatic three-film passes used10 each; fresh identity/person reads7;
pre-session reads7. This ledger is separate from earlier tasks'74/25/control
counts and from the historical owner pilot. No provider/tracking destination,
MOTN, Watch Providers, retry/redirect, production discovery, transfer or Save.

The one hidden `-Study pilot-retrieval` session reused the existing SID-only
broker; keys stayed in process memory, never argv/environment/files/logs or a
Netlify export. Default five-film controls remain unchanged. The session was
explicitly stopped after the final pass (zero requests to stop). Results identify
`execution=local-diagnostic`, `buildSha=null`, checkout3a0d2ef plus tracked edits
and worker digest; they are not attested deployed-runtime reports. Minimal
identity/claim comparisons, not raw HTML/search response archives, are recorded.

### Verification and boundaries

Preparation:176/176 targeted extraction/workflow/report/resolver, R1/R2,
localization/helper checks;8/8 scoped native helper/worker tests with fake keys
and zero source HTTP. The broader main/HTTP/browser run had172 passes,1 skip
(unconfigured native PostgreSQL fixture) and1 browser-environment failure:
bundled Chromium was absent. The affected assisted browser suite then passed
11/11 using installed Edge, unchanged assertions/timeouts. This is browser
viewport testing, not native iPhone/WebKit validation. The final confirmed
person entry also passed56/56 crosswalk/resolver/report regressions; independent
review ran194/194 dependent offline cases with no runtime blocker. Final combined
offline/HTTP/browser suite passed **291/291**, including desktop/iPhone X/Air
viewports, assisted addition, pending apply, cancel, manual edits, retained/expired
state, logout/context changes, clipboard/report, R1/R2 and forbidden enrichment.
A sandbox child-process `EPERM` prevented an earlier invocation from starting;
the allowed local execution passed without code/assertion/timeout relaxation.
Review also found a local-only person-inspection helper accepted malformed/API
error-shaped appended external IDs. It now refuses those proof inputs rather
than labelling them inspected; **22/22** helper/person diagnostic tests passed,
including eight new error-shape cases and missing/null optional-ID preservation.
The actual Craig response was valid; this did not require another source call
or alter runtime identity policy. Links:13 docs/451 local links/277 anchor
references, zero errors; whitespace/scope clean. Local Node is24.22.0; deployed
Node22 compatibility is not a newly executed hosting validation.

No new runtime calls/stages/cap, broader admission, parser wrapper guessing,
identity relaxation, R1/R2/acknowledgement change, offer enrichment, chat UI,
initApp/global lifecycle/auth, persistence/retention, SQL/flag/secret or deployment
change. The shared extractor necessarily serves fixed and assisted cards; both
retain identity/boundary/count guards. Launcher/Windows lifecycle and native
PostgreSQL concurrency were not repeated: their dependent code/schema is
unchanged; native local IPC was tested separately. Existing source-use/account
uncertainties remain; this investigation is not blanket rights approval or proof
of general accuracy/coverage. MW-FUT-01 remains Discovery.

## Mykola media dialog and form-session lifetime — 2026-10-28

Current pilot presentation supersedes the historical per-variant UI, Rakuten-only
inference and required M4 tracking acknowledgement below: see [compact service comparison,
Kinobaza service-language interpretation and link preview](m4-platform-summary-pilot.md). This follow-up changes
only M4 client interaction, not shared URL admission or research consumers.

**Implemented for review; not merged/deployed or live-evaluated in this task.**
Base `develop=f64c739593e07c879852c7b54f2729e9fd04f68f`, with #201 already merged.
The owner authorizes the presentation/ranking and local memory-lifetime change;
the existing pilot flag/default-off semantics and user/group access rules are
unchanged. No new user/movie/group restriction. This is not production release
readiness or completion of MW-FUT-01, which remains Discovery.

### Implementation and user flow

`assets/media-advice.mjs` keeps its own dialog, state, timers, abort controller,
selection tokens, original source-row references and focus/scroll positions.
It reuses Mykola's **CSS** bubbles, avatar and typing dots, never his conversation
history, mutable controller, HTML snapshot or Advice Room lifecycle. No changes
to `initApp`, its call frequency/order or global auth/resume handlers.
The only `app.js` edits are in the existing M4 integration: capture title/year
with the already established IMDb/form identity, and invalidate M4 on those
identity inputs. These display fields are not sent as trusted server identity.

Opening a new permitted form context explicitly starts its one discovery:
loading bubble/dots exist only while the real promise is pending, with no fake
delay. Completion shows a short Mykola answer and one compact card per established
platform. Every original source row remains a separate variant inside that card.
Reopening the same card session resumes the same DOM/results/variant/scroll,
not another request. Closing does not reopen automatically on access refresh.
Same-document app return retains state; full reload/iOS page eviction still
loses memory, and durable recovery is not promised or introduced.

Platform cards show only the selected variant's access, territory, languages,
literal reported price/quality and meaningful warnings. A native selector makes
all variants accessible without repeated action blocks: at most one link action
and one selection action per platform. Switching variants changes neither the
group order nor the underlying rows; it revokes pending selection and resets
tracking/affiliate acknowledgement. Missing/unsafe URLs have no link action.
Source names and technical field limitations live in the diagnostic report and
attribution, not in the main platform list or per-row JSON disclosures.
No new plain-text
chat input, LLM, physical-offer search or fabricated links. Other/unmapped
platforms remain visible read-only. Multiple identity-confirmed Kinobaza cards
remain explicit local choices, not automatic merging or further fetches.

`Відкрити посилання` appears only under the existing classification policy;
exact href and tracking/affiliate acknowledgement remain intact. `Обрати` is
bound to the **original row**, then shows before/after recommended medium and
URL. Only `Перенести в картку`, after fresh source-free access authorization,
can change those local form fields. A missing new URL cannot silently erase an
old one: the explicit clear checkbox is still required. Changed form fields,
canceled/replaced tokens, Escape/close, context changes and late authorization
cannot apply the old preview. Ordinary Save remains the sole Wishlist write.

### Deterministic evidence priority (owner's new decision)

`assets/media-advice-presentation.mjs` is a pure view of projected original rows:

1. Explicit UA source context and positive Ukrainian audio in that same row.
2. Explicit UA source context and positive Ukrainian subtitles without positive
   Ukrainian audio; unknown and explicitly negative audio are explained differently.
3. Explicit UA source context without established language data.
4. Supplemental rows whose territory is unknown/foreign; conflicts remain visible
   but do not become a recommendation. Equal evidence retains stable input order,
   with no new price/quality/provider preference or numeric confidence.

The first-choice explanation is at most two sentences and describes the actual
evidence, not a guaranteed best offer. No provider-name join or copying tracks
from a film badge/separate block to an offer. Kinobaza block language stays a
separate claim (`Для цієї пропозиції ще не перевірено`); unknown territory cannot
become UA. Unknown/empty lists are not negative. Conflicts are not repaired or
resolved by choosing a winner. A group warning keeps contradictions in other
variants visible while a different variant is selected. The summary names the
ranked original variant's ordinal/access when its platform has several options;
selecting another option cannot silently acquire that explanation or its tracks.
Recommendations do not assert entitlement.

The 2026-10-29 review refinement is visual grouping, not offer deduplication or
enrichment: even two rows with the same URL remain separate. Only established
canonical platform mappings group together; ambiguous identity/provider rows
remain read-only separate observations. An authored Supergirl-shaped fixture
(not a reconstruction of the live response) contains2 Prime,2 HBO and4 Rakuten
rows and renders3 platform cards with8 independently accessible variants.

### Thirty minutes: freshness, not deletion of the answer

The server action ledger still expires after **30 minutes**, keeps atomic stage
reservations, cap8, finish/replay/rate limits and its existing retention/cleanup.
No SQL, backend handler, source adapter, migration or production setting changes.
`media_advice_action('capability')` already checks user/flag/group/edit-card rights
**before** looking up an action session/TTL: see the second migration's capability
branch and `netlify/functions/media-advice.mjs`. This source-free check is also
the client's existing `validateApply` boundary, so stale viewing/transfer does
not need a longer ledger or a permission bypass.

The view now retains projected results for the **form session in page memory**.
At 30 minutes from dispatch it marks them stale, retains expanded sections and
positions, and revokes any pending preview authorization so that it must be
reviewed with the warning. A new selection of retained results still checks
fresh capability before applying. `Оновити вручну` is an explicit user action:
after capability it rotates the M4 action reference and starts one new bounded
discovery, subject to the unchanged server daily-session/replay/stage controls.
It appears for stale/error results; reopening/returning/copy/render does not
refresh sources. Abort does not refund a reserved attempt. A failed reply leaves
accounting unknown, not a claimed zero or permission for an automatic retry.

Successful Save, cancel/back-to-list, another form/movie/IMDb/group/user, logout
or failed/revoked access clears the controller context. No full HTML/JSON body,
search snippet archive, localStorage/sessionStorage/IndexedDB or server result
storage. This is an explicitly approved extension of **projected-result memory
lifetime**, not of technical ledger retention or source rights.

### Temporary pilot report

The last Mykola bubble links to `Діагностичний звіт`. It opens a separate panel
with copy, selectable text fallback and return/focus preservation. Nothing is
sent automatically. `safeMediaReport` receives the captured **run** title/year/
IMDb context, not the subsequently edited form. A trusted result identity can
fill matching context fields; incompatible IMDb bindings are withheld as
unknown. Safe build/deploy/run IDs retain their prior provenance rules; missing
attestation stays unknown. Source outcome statuses are allowlisted; row scopes,
language distinctions, extraction/card-digest/search counters remain available.
Each retained row also has a generated platform/variant reference matching the
selector ordinal, fixed source label, allowlisted access/field states and safe
conflict/block reason codes. Raw source descriptions and literal URLs stay out
of the copied report; removing the main-list technical details adds no storage.
The diagnostic panel also has a collapsed, read-only view of the already
projected row/unmapped fields, including literal localization labels/formats.
It uses bounded known keys and withholds URLs, raw-body/private keys and
credential-shaped strings; this view is not appended to the copied short report.
Thus simplifying the platform list does not erase inspectable source evidence.
Age is updated if the report remains open across the freshness boundary, and
copy recomputes it without a source call. No credentials, arbitrary error body,
private/group metadata, raw URLs/tracking query or responses in the copied report.

### Verification and activation boundaries

Authored unit/HTTP/browser checks cover evidence ordering/no enrichment,
source/refusal/empty/partial/conflict states, safe reports, real add/edit forms,
explicit transfer, manual edits/missing URL/acknowledgement, isolated other chats,
auto-once/reopen/return/expiry/context/late response guards and mobile focus/copy.
Final 2026-10-29 full `test/*.test.mjs` run: **206 passed,1 skipped,0 failed**
(207 total), including31 browser cases/subtests. This supersedes the original
PR checkpoint's193/1 result. The skip is the unconfigured native
PostgreSQL17 multi-connection fixture, not a passed concurrency result.
The prior checkpoint's additional106/106 source/projection/R1/R2 result is
historical, not a new run; source adapters/shared policies are unchanged.
The grouped-card review adds8-to-3 rendering, all8 original options, no source
names/per-row JSON in the main list, variant-scoped literal price/quality,
unknown territory/block tracks, conflict visibility, exact non-primary transfer,
acknowledgement reset, pending-selection cancellation and retained native controls.
The final real-form
browser run also checks successful ordinary Save with a **mocked** DB, clearing
the cached dialog without a source call, and passed5/5 after adjusting screenshot
capture to two actual mobile scroll positions (not an overflow-clipped element).
Earlier failures while adapting the old
technical-view tests led to explicit visible-preview waits and capturing scroll
at the actual report click (after browser auto-scroll), not an unrelated prior
position; assertions/timeouts were not weakened or increased. Native dialog focus
handoffs, pending notice clearing and next-frame scroll restore are covered.
No server/shared/migration diff; normalized source comparison confirms the whole
`app.js` outside its M4 integration, including `initApp`/global lifecycle/auth,
is unchanged. Syntax, whitespace,13 docs/453 local links/279 anchor references
and13 handoff sections passed. Local Node24.22.0/installed Edge were used; no
new Netlify Node22/deployed-runtime validation is claimed. Screenshot paths are
listed in the PR; authored files stay outside Git and public artifacts.
Screenshots use invented source fixtures, not live availability/coverage evidence.
Browser viewports include1280×900,375×812 (iPhone X size),420×912 (iPhone Air size)
and820×1180; these are Edge/Chromium simulations, not native Safari/iPhone tests.
No live source discovery, Wishlist write, flag/secret change, migration, merge or
deployment. Owner checkout/demo and unrelated files are preserved. Native
PostgreSQL concurrency and Windows launcher lifecycle need no new run because
their code/contracts/schema are unchanged; existing offline ledger tests still
verify no new bypass. Separate merge/deployment approval remains required.

### Owner verification on develop — 2026-10-28

Owner-reported Netlify Function runs on deployed merge commit
`61bc9e706230811628560468f41e7d112dbd64bf` and deploy
`6ae2524cfdbb0094fbf3b6ff` verified the two focused pilot fixes:

- Blade Runner (1982), run `e6bcacd8-e91d-4cb0-b75c-9c8f5a1a6921`:
  the confirmed card URL digest matches `/titles/blade-runner`; two
  Kinobaza rows (Apple and MEGOGO) and the film-level Ukrainian audio badge
  were retained. Provider territory and availability remain unknown.
- Supergirl (2026), run `03e07997-7655-4591-ab29-22a531abd724`:
  the confirmed card URL digest matches `/titles/supergirl-2026`; identity
  matched and three Kinobaza rows were projected. The separate Rakuten
  localization block has unknown territory and unverified offer binding.

These focused runs do not establish account entitlement, current platform
availability, general catalog coverage, or native iPhone compatibility.

## Mad Max noncritical image markup recovery — 2026-10-31

Implemented locally on develop `cd96811b4a0f4527154d5863177c8c94043927de`
(after #212); not merged or deployed by this task. MW-FUT-01 remains Discovery.
The owner run `0d87341b-9cb6-42c3-9521-2257bb2073cd` reported a pre-identity
`unsupported-markup / html-parse-errors` refusal. Its first requested-card digest
`1a36d8f904915591582ac309a60c3ebd4a47e9891332c0fa5c955a3fbbe5d1d1`
matches [the supplied Mad Max card](https://kinobazaua.com/titles/mad-max-fury-road),
not an archived HTML body. The precise historical parser errors remain unknown.

### Current response and cause

The current HTTP200 response read at **2026-10-31 10:23:52 UTC**,432172 bytes,
has exactly three parse5 errors at one trailer image on line3021:
`missing-whitespace-between-attributes` (column210), then
`unexpected-character-in-attribute-name` (columns236 and276). Unescaped quotes
inside the image's `alt` produce stray attributes. This image follows the film
metadata (H1 644–646, original H2 648, labelled director row1521–1526), the
provider blocks1723–1813, and the complete availability accordion1818–2337.
The old shared extractor rejects every non-doctype parse error before identity;
it reproduces the reported refusal and zero candidates on these current bytes.
This is a current reproduction, not proof of the historical response's contents.

Recovery is structural, not a film/slug/trailer-text exception. Only those two
attribute-tokenization codes may be tolerated, inside one located HTML void
`img` **after a unique explicitly closed availability accordion**. Errors in
H1/H2/table/provider-anchor ancestry or original source intervals, foreign elements, tags swallowing another
`<`, duplicate attributes, unknown errors, missing/duplicate viewing boundaries
or more than256 error events still refuse. Every collected error is classified;
a later critical error cannot hide behind the old ten-event diagnostic cap.
Source intervals also catch an image that parse5 foster-parents out of a table;
repaired DOM ancestry alone is not accepted as proof of a noncritical location.
No HTML repair, script execution or second parser is introduced. Identity and
extraction use the original parse5 tree. Successful recovery stays `partial`
with allowlisted, content-free `noncritical-image-markup-recovered` diagnostics.
The fixed-card research path shares this parser, so the same narrow handling
applies there; its identity, transport and extraction rules are unchanged.

### Full-path result and controls

The same in-memory responses were passed through baseline/current `extractHtml`
with the same assisted identity gate, then actual composition, M4 presentation
and transfer eligibility. These are **local controls, not a deployed run or a new
TMDb identity fetch**. Control identity inputs were explicit: Mad Max's supplied
IMDb/year and title/director names supported by the
[Ukrainian distributor](https://kinomania.com.ua/shalenyy-maks-doroga-gnivu-0)
and [Cannes film record](https://www.festival-cannes.com/en/f/mad-max-fury-road/);
the distributor's2020 re-release date is not used as production year. Mortal
Kombat's previously established movie identity and literal director name are
local extraction-control inputs, not a newly verified person alias. Dune uses
the existing reviewed person137427 alias record. No runtime aliases are added.

| Current card | Baseline → fixed extraction | Own provider-block audio / subtitles | M4 projection |
| --- | --- | --- | --- |
| Mad Max: Fury Road2015 | unsupported-markup,0 → matched/partial,36 candidates,3 blocks | Apple `+ / −`; Rakuten `+ / −`; MEGOGO `+ / unknown` | 6 Kinobaza rows,0 unmapped; all three blocks reach the comparison and exact link choices. A fourth HBO group retains unknown languages. |
| [Mortal Kombat2021](https://kinobazaua.com/titles/mortal-kombat-2021) | identical before/after: matched/ok,36 candidates,3 blocks | Apple `+ / +`; Rakuten named audio formats `−` / subtitles `+`; MEGOGO `+ / +` | 4 Kinobaza-only rows,0 unmapped. Named-format negatives do not imply absence of every Ukrainian audio track. |
| [Dune: Part Two2024](https://kinobazaua.com/titles/dune-part-two) | identical before/after: matched/ok,32 candidates,3 blocks | Apple `+ / −`; Rakuten `+ / +`; MEGOGO `+ / +` | 5 Kinobaza-only rows,0 unmapped. |

For both controls the **entire extracted object** is identical before/after.
Candidate counts include foreign-country contexts and are not UA offer counts.
Mad Max's own block URLs classify as admitted iTunes, JustWatch tracking and
MEGOGO links; they survive unchanged. Apple's nested table CTA repeats the same
URL, not a lost second offer. No downstream localization/link/presentation defect
was established, so those production modules are not changed. The three language
blocks retain unknown source territory/availability; M4 displays `◐` and uses
the approved Ukraine interpretation, not independently verified availability or
offer binding. The film-level audio badge stays unknown and supplies no tracks.
No provider destination was opened and no purchase, playback or entitlement is
verified. The historical owner's combined baseline rows are not these Kinobaza-
only projections.

Five direct Kinobaza card GET attempts were made: Mad Max three times (first local
analysis process was sandbox-blocked; the last read at11:09:55 UTC rechecked the
final source-interval guard and confirmed the same before/after outcome), Mortal
Kombat once, Dune once; all200. These were explicit local research reads, not
application retries. HTML existed only in memory, was reused for before/after
analysis without refetches, and the process was terminated afterwards. Public
documentation/identity-reference browsing is separate from these five source
GETs. No Tavily, TMDb API, MOTN, Watch Providers, redirect or destination requests;
no keys, raw HTML archive, new persistence, Wishlist writes or owner tests.

### Regression evidence

Authored fixtures are not reconstructed source HTML. They cover recovery after
the closed boundary, critical/ambiguous structures and duplicate attributes,
late critical errors/overflow, exact links, one-shot bounded GET, missing/unsafe
links, source-block scopes, unresolved directors/stable conflicts/withholding,
composition→comparison→original-row preview, and content-free safe reports.
Validation: final M4 full offline/HTTP suite229 passed,4 skipped (three browser entry
tests subsequently ran explicitly; native PostgreSQL17 concurrency remains
unconfigured/skipped). Final changed parser/report/pipeline target54/54 passed;
full shared research offline/HTTP suite479 passed,13 legacy browser entries
skipped. M4 Edge browser suite30/30 passed: real add/edit forms with authored
network/DB mocks, desktop1280×900, tablet820×1180 and iPhone-size375×812/420×912,
pending apply, retained/stale results, context isolation and normal mocked Save.
These are viewport simulations, not native Safari/iPhone or deployed Node22
validation. Syntax, whitespace and14-document local link/anchor checks passed.
Windows launcher lifecycle/native database concurrency were not repeated:
transport/launcher, ledger and schema dependencies did not change. No assertions
or timeouts were weakened. No initApp/global
lifecycle/auth/UI, budgets/deadlines, source interpretation/ranking, session,
preview/Save, ledger, migration, flag or production changes. Merge/deployment
remain separately authorized; this does not establish general parser coverage.

## Link-choice equivalence and JustWatch inspection — 2026-10-31

Base develop `1f732537547ad67f84f5be3252f3ffc732b0d925`, after #213.
The owner-supplied deploy `6ae5cef3b77db1ed705befed` is ready, branch-deploy
`develop`, at that exact commit. Run `34a94bd3-42a6-4dcf-a675-02fa6aa17c2c`
reported four Apple choices and two Rakuten choices. Full original result URLs
are not archived by M4; the owner cannot provide the four pre-redirect addresses.
Current source inspections below **are not a reconstruction of that run** and do
not identify the two additional historical Apple addresses. No new MOTN API call
was made; no local MOTN credential was available and no secret was read from
Netlify. No new owner evaluation or authenticated discovery was requested.

### Current Mad Max links and observed transport

Current [Kinobaza card](https://kinobazaua.com/titles/mad-max-fury-road) extraction
returns two Apple and two Rakuten candidate URLs. None is a literal duplicate.
The own-block Apple CTA repeats the same iTunes href inside its table; it already
produces only one candidate, so it is not the cause of four historical choices.

| Source observation | Declared destination / distinguishing fields | Observed read-only outcome |
| --- | --- | --- |
| Apple UA-section JustWatch, href digest `034e67b1ef217a7cd80cf6730b4ac420526b5fb12342e834f984f18c0356922b` | `r` names `https://tv.apple.com/ua/movie/mad-max-fury-road/umc.cmc.6xerenwn1999cjd2y6421r2ex` with `playableId=tvs.sbd.9001:990549112`. | HTTP302 to that card with added `at`, `ct`, `itsct`; Apple returns200, title Mad Max: Fury Road, canonical URL with that same UA/UMC ID. Thus `r` is not byte-identical to the actual Location. |
| Apple own-block iTunes, digest `9fd6a1a989a8c50d6b480310342d1e71b5a28e1af454b3dddcc3f721ae6c28e7` | `https://itunes.apple.com/ua/movie/id990549112`, query keys `at`, `l=uk`. | Three explicit301 steps: same iTunes card without `at`; localized-slug Apple TV URL; the same English-slug UA/UMC canonical above. This current route convergence is established, not independent offer/track/entitlement verification. |
| Rakuten UA-section JustWatch, digest `0dcbd6e3eee9e9c08efdb33de5498f02f4aa27178a34aac21a0900dbde9cff69` | `r=https://www.rakuten.tv/ua/movies/mad-max-fury-road`. | HTTP302 Location exactly equals `r`. |
| Rakuten own-block JustWatch, digest `092b08ba7fd9c3232f4cd760b0b5263ce4f20d987c16176653a3964df7c9f108` | Same exact `r` and `uct_country`; only outer `cx` differs from the UA-section link. | HTTP302 to the exact same URL. One destination GET returns200, generic Rakuten TV shell; scripts/login/purchase/playback were not executed. |

The address supplied in a parameter and an observed redirect are distinct
evidence. A supported `r` can be decoded locally and independently validated,
but it is **not** an authenticated promise about future HTTP responses. There
is no automatic redirect or destination fetch in the application, no direct-URL
substitution, and no removal of source tracking parameters from open/transfer.
These links establish neither new versions nor different offers; they also do
not prove that all four historical Apple routes were equivalent.

### Implemented navigation grouping, not an offer join

`assets/media-advice-link-choices.mjs` is a pure presentation helper, called only
by the existing `linkChoicesFor`. Each admitted choice keeps one **original**
row and its exact href; the preferred original transfer row remains preferred.
All original rows, access/language/package/edition facts and provenance remain
unchanged in the diagnostic report. No source field is moved to a peer row.

- Exact duplicate URLs remain one navigation action.
- Apple TV UMC identity or iTunes numeric identity is compared within its own
  namespace and explicit URL country. Rakuten uses its exact admitted regional
  host/path; different slugs, hosts or trailing slashes are not guessed aliases.
- Only documented Apple tracking keys `at`, `ct`, `itscg`, `itsct` are omitted
  from the comparison key, **not from the original href**. Sources:
  [Apple linking guide](https://performance-partners.apple.com/linking) and
  [Apple TV Marketing Tools token definitions](https://toolbox.marketingtools.apple.com/en-us/apple-tv/subscribe-link).
- `playableId` is decoded once and retained as a content qualifier. Other
  parameters keep exact raw key/value spelling and relative order. Different,
  missing or ambiguous qualifiers remain separate. No universal query stripping.
- A JustWatch declared target participates only for exact HTTPS
  `click.justwatch.com/a`, one each of `cx`, `r`, `uct_country`, no extra keys or
  fragment, explicit UA, and an independently admitted same-provider UA card.
  Nested wrappers, wrong providers, credentials, explicit ports, path
  normalization, duplicate/encoded keys and malformed encoding do not establish
  equivalence. Existing outer-link admission is unchanged.
- Conflicting explicit country/cut/version/package evidence cannot bridge
  semantic groups. Rent/buy labels alone do not turn the same card navigation
  into different links; their source observations remain separate in diagnostics.
- Missing/unsafe URLs remain unavailable as choices. Unknown semantics stay
  distinct, never a reason to invent a link or to infer a shared offer.

The current Mad Max Rakuten pair is now **2 choices →1**, selecting the unchanged
own-block pointer when that is the preferred original row. The two current Apple
routes remain **2→2**: the one-film redirect observation is not compiled into a
per-film exception or a universal iTunes-number↔UMC crosswalk. `l=uk` is retained,
not interpreted as track evidence. This is an intentional remaining limit, not
a claim that the routes lead to different films. Known Apple tracking-only
duplicates within one established card/qualifier namespace do collapse.

A fresh local actual-extractor→composition→presentation→choice→preview check
at 11:50:15 UTC confirms those counts and exact chosen URLs without row mutation.
Dune: Part Two is a control: two Rakuten pointers declare the same UUID-based
UA path and collapse2→1; its one iTunes route stays one. An authored six-row
Mad Max-shaped fixture separately exercises four Apple source observations→two
choices and two Rakuten observations→one; it is not a reconstruction of the
owner's missing four URLs. Rendering/grouping/opening preview adds0 source calls.

### Research accounting and boundaries

This task made13 explicit HTTP GET attempts: Kinobaza Mad Max3 and Dune2;
JustWatch3; iTunes2; Apple TV2; Rakuten1. All completed with200/301/302.
The total includes separately requested redirect hops and final source-control
reads, never application retries. Official-document browsing is separate.
No cookies/credentials, subresource/script execution, purchase/playback, hidden
endpoints, search/TMDb/MOTN calls or Wishlist writes. HTML and pointer maps were
process-memory only and were discarded; no raw-body/search archive or retention
change. Source-use/account conditions are unchanged, not blanket permission.

Validation: 90/90 targeted offline tests pass across link choices, controller,
platform presentation/summary, report and Kinobaza pipeline. The pending-apply
and retained-document browser regressions pass 25/25, including revoked
selection, changed form/context, access, expiry and late replies. Syntax and
whitespace checks pass. Local documentation validation: 14 documents, 457 local
links, 282 anchors, all 13 handoff sections, no errors.

The real-form dialog browser suite also passes 5/5 (parent plus four viewports:
1280×900, 375×812 iPhone X-size, 420×912 iPhone Air-size, 820×1180 tablet).
Its new authored six-row case verifies deduplicated choices, switching to the
distinct original iTunes pointer, exact open/preview/local apply, all six
diagnostic records, no DB writes and reopen without another discovery.

Browser runs use authored responses and local Edge/Playwright; they are not
Safari/WebKit or physical-iPhone evidence, nor a deployed-runtime/source
evaluation. Server/SQL/native-PostgreSQL and Windows lifecycle suites are not
repeated: their code and dependencies are unchanged by this presentation-only
helper. No earlier server result is attributed to the new commit.

Only client link-choice presentation and its tests/documentation change. Ranking,
language interpretation, link admission/R1/R2, original-row preview/apply/Save,
session/stale/pending protection, initApp/global lifecycle/auth, server timeouts
and budgets, schema/flags/main/production are unchanged. Merge/deployment remain
separate decisions. MW-FUT-01 remains Discovery.
