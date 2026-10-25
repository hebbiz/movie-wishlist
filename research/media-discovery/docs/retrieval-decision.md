# Retrieval decision before a live pilot

Reviewed: October 17, 2026. Status: **recommendation for owner review; no live
execution approved**. MW-FUT-01 remains Discovery. No account, subscription,
provider contact or new adapter was created during this review.

## Recommendation

Recommend **B: separate retrieval and structuring** for the proposed evidence
experiment. Treat **Brave Search with explicit storage/evaluation rights as the
first contractual candidate**, not as an already licensed or final provider.
No reviewed self-service plan establishes all rights this experiment needs.
The next executable step remains offline until the decision, applicable terms,
content rights, credentials and bounded pilot budget are approved.

Option A is a narrower alternative for an original-answer display experiment.
It is not a substitute for the proposed normalized evidence archive or a public
field-accuracy evaluation. The existing CLI is not that display-only application.

## Architectural comparison

| Aspect | A: Gemini Google Search | B: retrieval API + separate LLM |
| --- | --- | --- |
| User output | Original grounded answer, original citations and associated Search Suggestions. | Candidate listings and fields with references into separately supplied evidence, where licensed. |
| Attribution | API offsets identify generated output segments. JSON tool compatibility does not guarantee atomic field attribution; broad spans remain unknown. | Source IDs and exact quote spans can be checked against the actual LLM input; no reliance on substring matches in generated answers. |
| Truth | Citation placement alone does not establish stock, edition identity or UA rights. | Retrieved excerpts alone still do not establish current stock, exact editions or UA entitlement. Human/context checks remain necessary. |
| Archive | Do not assume a right to create this research archive from grounded output. | Requires explicit scope for raw payloads, snippets/excerpts and derived fields, including third-party content. |
| Engineering | Would require a separately approved original-response view; current CLI normalization is not this mode. | Later approval could justify a small adapter and source-span check. No framework or adapter is built here. |

## Permission findings

Legend: **C** = explicit permission/requirement, conditional on the cited terms;
**R** = explicit restriction under the public terms; **U** = unresolved for this
specific use. C does not mean the repository owner has accepted or obtained a
plan. Product examples and absence of a prohibition are not grants of rights.

### A. Gemini Google Search

Basis: [Gemini terms, Google Search section](https://ai.google.dev/gemini-api/terms).

| Required use | Finding |
| --- | --- |
| Own customer-facing application | C: original results in an owned/operated app to the initiating user, with associated suggestions. |
| Normalize / send to another LLM | R: modification/analysis restrictions; the limited Google function-call refinement exception is not a general extraction license. |
| Raw results, excerpts, derived fields | R: general storage/collection restrictions; narrow displayed-text/chat/legal exceptions do not establish this archive's rights. |
| Retention/cache | R: no general cache grant. Some text exceptions allow up to two years; Google's own 30-day retention is different. |
| Attribution | C: keep original results, associated Search Suggestions and link behavior. |
| Publish evaluation report | R for restricted grounded-result analysis/republication; U for a purely operational, non-content report. |

### B1. Brave Search

Basis: [Search API terms](https://api-dashboard.search.brave.com/terms-of-service)
(updated September 1, 2026), sections 3, 4.4, 13.3, 14.2–14.3;
[official FAQ and plans](https://brave.com/search/api/#plans).

| Required use | Finding |
| --- | --- |
| Own customer-facing application | C: API/results license for Customer Applications, with end-user obligations. |
| Normalize / send to another LLM | R/U: base derivative-work and AI evaluation/improvement restrictions; inference scope needs an applicable override/clarification. |
| Raw results and excerpts | R by default except transient operation; C only conditionally: FAQ explicitly advertises storage-rights plans. No entitlement obtained. |
| Derived fields | R/U: storage rights alone do not resolve derivative-work restrictions. |
| Retention/cache | R by default; U duration under a storage plan. Termination normally requires deletion unless overridden. |
| Attribution | C: optional provider branding, governed format if used. Preserve other notices/rights. |
| Publish evaluation report | R/U: AI evaluation restriction and public-statement approval clause need resolution for this report. |

### B2. Tavily

Basis: [Platform Terms](https://www.tavily.com/terms), updated May 4, 2026,
definitions 1.2/1.6/1.7 and sections 2, 3(x), 9, 10.

| Required use | Finding |
| --- | --- |
| Own customer-facing application | C integration grant; U interaction between Customer Applications and internal-business/API-sharing limits. |
| Normalize / another LLM | U: Output is excluded from Services; AI-tool integration is contemplated, but this is not a complete output-use grant. |
| Raw results, excerpts, derived fields | U customer storage scope; provider processing rights do not grant customer rights. |
| Retention/cache | U: no verified customer retention duration for this archive. |
| Attribution | R removal of proprietary notices; U additional result/source attribution obligations. |
| Publish evaluation report | R: section 3(x) prohibits third-party disclosure of service performance information/analysis. |

No public paid tier reviewed here automatically waives section 3(x). A private
report does not resolve disclosure to external reviewers; the actual audience
and an express contractual exception would need approval.

### B3. Exa

Basis: [general API-inclusive Terms](https://exa.ai/terms), opening precedence
paragraph and sections 1.1, 4.1, 4.2(a/c/j/n).

| Required use | Finding |
| --- | --- |
| Own customer-facing application | C limited documented API license; U broader customer-facing redistribution/display under the general restrictions. |
| Normalize / another LLM | R/U: broad modification, transmission and derivative-work restrictions conflict with the proposed workflow absent an exception. |
| Raw results, excerpts, derived fields | R: copying/download/publication restrictions; no general archive grant established. |
| Retention/cache | R: temporary browser-display cache exception; U other retention rights/duration. |
| Attribution | R removal of proprietary notices; U precise result-display requirements. |
| Publish evaluation report | R/U for output reproduction/derived content; U aggregate non-content metrics. No permission inferred from silence. |

Additional Terms can prevail. An applicable MSA or written exception would need
to expressly cover the workflow; marketed LLM integrations do not independently
resolve the general wording.

## Plans and pricing actually observed

USD list prices checked on the review date; no plan was purchased, account
entitlement inspected, or cost measured. Separate structuring-LLM charges,
taxes, retries and publisher/content rights are additional considerations.

| Candidate | Public technical entry price | Entitlement needed for this experiment |
| --- | --- | --- |
| Gemini 3.8 Flash, paid Standard | [Pricing](https://ai.google.dev/gemini-api/docs/pricing): $0.75/M input and $3.75/M output including thinking through 2026-12-31; Search $14/1,000 queries after the shared 5,000/month allowance. | A needs compliant original display. Existing archive/normalizer needs a separate applicable grant, not just paid billing. |
| Brave **Search**, not Answers | [Plans](https://brave.com/search/api/#plans): $5/1,000 requests, $5 monthly credits advertised. | A plan explicitly including storage rights **plus** an Order Form covering derived fields, external LLM input, evaluation/report publication, retention and deletion. Exact eligible SKU/rate is not verified publicly; Enterprise/custom pricing is unpublished. Do not assume Search or an obsolete named AI tier includes it. |
| Tavily Researcher / PAYG | [Pricing](https://www.tavily.com/pricing), [credits](https://docs.tavily.com/documentation/api-credits): 1,000 free credits/month; PAYG $0.008/credit; basic Search 1 credit, advanced 2 ($0.008/$0.016 before allowances). | These have technical pilot capacity, not a report-publication exception. Need an express overriding agreement for the unresolved uses and section 3(x); Enterprise quote is custom/unpublished. |
| Exa Developer PAYG | [Pricing](https://exa.ai/pricing): Instant $4/1,000 searches; Fast/Auto $7/1,000 up to 10 results; Contents $1/1,000 pages per content type. | Applicable written/API MSA permissions overriding relevant restrictions. Enterprise offers a custom MSA; quote/rights are not public or obtained. PAYG alone is insufficient evidence. |

No exact total follows from these rates: query count, response tokens, retrieved
pages, extra results, account allowances and contractual prices are unknown.

## Third-party content and intended evidence lifecycle

API access is not blanket ownership/licensing of retailers' descriptions,
images, full pages or other content. Publisher terms, copyright, access controls
and the receiving LLM's terms are separate checks. An API plan permitting
storage does not automatically authorize scraping a destination, sending its
full text elsewhere, or publishing its excerpts. ZDR advertising concerns the
provider's retention, not a customer's right to archive results.

Proposed B pilot, only after approval: one retrieval attempt and one independent
structuring attempt per film, **two total HTTP attempts including any retry**.
A retrieval retry consumes the remaining slot: stop before structuring. Start
with Dune and physical-edition candidates; run the other two only after manual
evidence review. Do not attempt exhaustive twelve-store coverage in one query.
Keep unobserved stores and streaming UA availability explicitly unknown.

Before any live run, specify the permitted TTL separately for raw payloads,
excerpts and derived fields, deletion/termination behavior, source identifiers,
what may be sent to the structuring model, and what may enter a public report.
No raw/excerpt archive or public performance comparison is assumed permitted.
The current synthetic report contains no measured provider performance.

## Exact blockers and next experiment

1. Owner decision accepting B's narrowed physical-first pilot (or choosing a
   separately scoped A display-only demo). This recommendation is not approval.
2. An actual applicable entitlement resolving the marked R/U items: storage,
   normalization, third-party LLM processing, retention and evaluation/report
   rights. No reviewed default plan clears every requirement.
3. Approved third-party evidence/excerpt and model-input policy, with concrete
   TTLs and deletion/publication rules. Do not obtain rights by guessing.
4. Retrieval and structuring credentials and agreed cost limits. No new provider
   adapter exists yet; credential variable names for it are not invented here.
   Existing GEMINI_API_KEY availability has not been changed or relied upon.
5. Separate authorization to implement the small selected-provider adapter and
   run the pilot. `LIVE_RESEARCH_ENABLED=false` keeps the actual Gemini CLI
   transport blocked even if credentials/permission-reference strings exist.

Until those are resolved, continue only synthetic attribution/evidence checks.
After the three-film pilot, decide whether actual source coverage, verified
claims, manual effort and measured latency/cost justify 15 films. Do not infer
general accuracy from three titles.
