# Changelog

## 0.4.35 — 2026-11-09

- Use the documented Jobicy public API and a 100-record request. Check the source’s echoed filters, returned count and terminal cursor before accepting a page. Preserve complete returned job fields.
- Python source adapters advance to 0.3.10. The read-only tool catalogue is unchanged.

## 0.4.34 — 2026-11-09

- Preserve the Tanqeeb listings cursor during delayed native navigation and use a separate tab for Tanqeeb and Forasna detail reads.
- Retain an observed regional Tanqeeb link as listing metadata while keeping detail scope restricted.
- Distinguish Himalayas update and Arbeitnow activity clocks from original publication. Require Arbeitnow’s exact native continuation and explicit terminal signal.
- Python adapters advance to 0.3.9 and the browser runner to 0.1.4. The tool catalogue is unchanged.

## 0.4.33 — 2026-11-02

- Preserve a Tanqeeb record whose publisher left its actual title anchor blank,
  retaining its native ID, canonical URL, model, dates and page continuation.
  The title remains empty with `title_status: publisher_blank`; no label is
  invented and no neighbouring records are discarded.
- Missing or ambiguous job links, malformed IDs and cross-source/ID mismatches
  still fail. Source metadata remains separate from candidate suitability.
- Python adapters advance to 0.3.8. Browser runner stays 0.1.3 and the catalogue
  remains 100 read-only tools and 101 source entries.

## 0.4.32 — 2026-11-02

- Resume a late-committed Tanqeeb native Next after an invocation budget ends,
  only for the exact saved observed Next href, the immediate next source page,
  new stable IDs and consistent membership across DOM observations.
- Keep capture and backend continuation checks. Skipped, foreign, wrong-URL,
  repeated-ID and stale-model pages cannot qualify this continuation. Forasna
  remains unchanged. No source frontier or archive completeness is inferred.
- Browser runner advances to 0.1.3; Python remains 0.3.7 and the catalogue
  remains 100 read-only tools and 101 source entries.

## 0.4.31 — 2026-11-02

- Await documented native navigation around Tanqeeb Next clicks, using only the
  exact observed in-scope next-page href and the remaining invocation timeout.
  Delayed navigation cannot be mistaken for a repeated old page.
- Retain source DOM page/ID, membership and post-capture checks. Forasna keeps its
  verified native-click continuation because its advertised offset can differ
  from the hydrated page. No guessed routes, fixed sleeps or skipped cards.
- Browser runner advances to 0.1.2; Python adapters remain 0.3.7. The 100-tool
  and 101-source catalogue is unchanged. Budgets remain resumable, not frontiers.

## 0.4.30 — 2026-11-02

- Preserve valid Lever description sections without headings, including their
  complete text and native labels, instead of failing a whole employer board.
- Detect Tanqeeb result-scope drift when native pagination retains a selected
  work model but returns a conflicting broad result cohort. Compare explicit
  selected/default facet totals and actual pagination without guessing page
  sizes, removing cards, or putting live counts in query identity.
- Recheck scope after browser capture and independently validate the captured
  HTML in the Python parser. Attempt one bounded native-control recovery;
  persistent contradictions remain incomplete evidence.
- Python source adapters advance to 0.3.7. Browser runner advances to 0.1.1.
  The 100-tool and 101-source catalogue is unchanged. These corrections do not
  certify candidate fit, original publication dates or complete market history.

## 0.4.27 — 2026-10-30

- Add original anonymous GULP employment whole-page and full-detail read tools.
  Preserve native zero-based twenty-record pages, acquired counters, whole public
  role fields, conflicting schedules and malformed-schema diagnostics. Exact
  fixed read routes, current policy, strict UTF-8 and nonpromoting errors apply.
- Record dated native Kimeta agent-policy and Stellenwerk robots-HTTP403 limits,
  keeping legitimate indexed-reader channels distinct from custom collection.
- Reject explicitly null ROR offsets/limits before reader spawn or cache access;
  omitted values still use the documented consumer-segment defaults.
- Reject unknown fields at the actual public-DE MCP boundary, so SDK shape
  normalization cannot silently remove a filter before a guarded reader sees it.
- Catalogue: 98 read-only tools and 101 source entries. No all-market coverage,
  student eligibility, employer-original or frozen-week completeness claim.

## 0.4.2

- Add original Germany Jobmensa public page/detail tools with current robots checks, strict native URL/continuation validation, complete JSON-LD and private raw capture.
- Keep mixed models, source dates, hours and worker-country constraints separate; no account or application action.
- Extend offline protocol and synthetic parser tests. Country registry remains an open discovery register.

## 0.4.1 — 2026-10-29

- Preserve BA v6's native `stellenangebotsart` ahead of legacy offering aliases;
  retain source enum values without inferring a precise employment model.
- Preserve Arbeitnow's officially linked Netherlands posting URLs in mixed
  native pages. Keep the fetch endpoint and continuation scope fixed, complete
  bodies intact, and hostile lookalike domains rejected.
- Package versions: German Arbeitsmarkt 1.1.1 and Python source adapters 0.3.6.
  No new source, country-eligibility or frozen-market completeness is claimed.

## 0.4.0 — country consolidation

- Rename the existing Egypt MCP repository to Job Market MCP and preserve its history and releases.
- Consolidate Egypt Python/MCP, German BA, original StepStone and shared public-source code with exact provenance and licences.
- Add a country source registry, explicit capability/gap inspection and frozen scan-plan tools.
- Add a unified read-only stdio federation with native tool namespacing, complete result forwarding, explicit backend/size limits and owned process cleanup.
- Preserve the legacy Egypt entrypoint and Python imports. Add StepStone module startup/read-only annotations and update Zod to the audited patched version.
- Registry entries without working transport remain gaps; this release does not claim complete national-market coverage.

Earlier Egypt release history: [countries/eg/mcp/CHANGELOG.md](countries/eg/mcp/CHANGELOG.md).
