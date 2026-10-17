# Historical research checkpoint: PR #174

Checkpoint merge: `a5d4f42149c616d4dc3cdac35c6086240b3fdacf`,
[PR #174](https://github.com/hebbiz/movie-wishlist/pull/174).
This record concerns the earlier physical-only prompts, before the digital-ua
and per-region Amazon iteration. It does not validate the revised prompts.
MW-FUT-01 remained, and remains, **Discovery**.

## Independent offline implementation checks

At `61ef317baaf631a4123c438488742b5acfd9719d` (October 18, 2026),
33 Node offline and 11 installed-Edge browser checks passed without skips.
All provider transport was mocked; this was not evidence of search quality.
Dune's prompt then matched the original `3337fc9` prompt hash. The new physical
priority instructions intentionally revise those prompts; exact prompt identity
with this earlier version is no longer claimed.

Documentation-only commit `093b39d2e0eebfd0d581178870e03b26e926af13`
recorded owner validation, local links/diff/whitespace and unchanged prompts.
The implementation/browser suites were not rerun for that documentation commit.
No live API calls were performed by the implementation agent.

## Owner-reported validation

The following validation was performed and reported by the owner, **not the
implementation agent**. These are reports of manual checks, not independently
repeated tests or an automated evaluation.

| Scenario | Live requests | Owner-confirmed outcome |
| --- | --- | --- |
| Dune: Part Two | 2 | Core data of the available HMV offer confirmed by the owner. |
| Coherence | 1 | Rarewaves Blu-ray edition data and Sold Out status confirmed by the owner. |
| Blade Runner — Final Cut | 1 | Data of the available Rarewaves 4K + Blu-ray offer confirmed by the owner. |

Limits of this evidence:

- **Three scenarios and four requests**, not an assessment of general accuracy.
- Negative HMV/Amazon search results for Coherence were not independently
  confirmed. Failure to find an offer is not proof of unavailability.
- Dune technical-specification completeness differed between the two answers.
- Latency, token usage and actual API costs were not measured.
- Owner confirmation is limited to the outcomes above, not every generated
  claim, every citation or every disc-specific characteristic.

## Proposals recorded at that checkpoint

These were proposals, not implemented guarantees at the time:

- Do not restrict Amazon to direct/fulfilled listings.
- Do not call a sold-out price historical without evidence.
- Distinguish UHD and bundled Blu-ray specifications.
- Check citation identity against the exact edition.

The subsequent iteration expresses these in prompts only. It adds no automatic
semantic citation validation or offer normalization and has no new live evidence.
No live response text, screenshots or evidence archive is included here.
