> This retained component now belongs to [Job Market MCP](https://github.com/ahmed-elkashef/job-market-mcp). Install dependencies from the monorepo root with `npm ci --ignore-scripts`; see the root README for unified startup. The component instructions below preserve its standalone interface.

# Public Job Sources MCP

Read-only MCP for public job APIs and employer boards. Node.js 20 or newer.
It captures whole native pages/feeds, preserves full descriptions and worker
restrictions, and returns explicit errors instead of turning blocked calls into
empty markets. It does not apply, contact employers, or use account credentials.

## Install

```sh
git clone https://github.com/ahmed-elkashef/public-job-sources-mcp.git
cd public-job-sources-mcp
npm ci --ignore-scripts
node index.mjs
```

Configure an MCP stdio server with `command: node` and an absolute path to
`index.mjs` in `args`. No API token is required for these public endpoints.

## Complete capture and full-record retrieval

Call `get_public_inventory` with `source` and the native parameters below.
`metadata_only` defaults to true. Every stable-ID card in that native response
is returned; there is no local row cap or implicit title/keyword filter. Full HTML,
normalized complete text and original source data stay in a process-local
snapshot. Call `get_public_job_from_snapshot` with `snapshot_id`, `source_id`
and, for duplicate IDs, `record_index` to read the full record without refetching.

| Source | Native arguments | Continuation |
| --- | --- | --- |
| Arbeitnow | `page` starts at 1 | validated `pagination.next.page` |
| Remotive | optional native `category` | one current public feed; delayed 24 hours |
| RemoteOK | none | one current feed; legal header retained |
| Himalayas | `page` starts at 1, optional `country`, `employment_type`, `worldwide`, `seniority`, `sort` | native offset/limit/total; next page returned |
| The Muse | `page` starts at 0, optional `location`, `category`, `company` | provider page count; registration/access may be required |
| Personio | public `subdomain` | whole XML board; .com fallback only after .de 404 |
| Recruitee | public `subdomain` | whole offers response |

Snapshots expire after 20 minutes or are evicted at a 64 MiB total memory
budget. Persist authorized source records in your own workflow if longer review
is needed. Restarted servers do not retain snapshots. Oversized single responses,
unknown records and expired snapshots return errors. Duplicate/missing IDs are
reported; no synthetic identity or publication time is invented.

`coverage: complete_native_response` means every record in the returned page or
feed was captured. It does not mean the whole market or a historical interval is
complete. Pages can move, feeds can remove old jobs, and date-only or timezone
uncertain publication values remain unresolved. Keep immutable checkpoints,
deduplicate stable IDs, check repeated pages, and quarantine uncertain interval
dates in the consuming workflow. Himalayas `pubDate` is the last update.
Arbeitnow's `created_at` reflects source activity and can be later than the
publisher's original date. Both values remain available with their own clock
basis. Verify the first-publication instant independently on a permitted route
before using either source for a new-postings interval. Arbeitnow terminal
pagination requires the provider's explicit `links.next: null`.

## Legacy compatibility

The 14 previous search/ATS tools remain available. Search tools are convenience
views with explicit local limits and snapshot details; use complete capture for
inventory work. Legacy Mamba ATS discovery is metadata-oriented and upstream can
degrade network failures to empty arrays. It is **not an exhaustive supply or
full-description route**; use a verified direct-board adapter for that work.
Jobicy's legacy REST surface is a bounded feed; its separately authenticated
native MCP supports cursor search. No cursor is invented for REST results.

## Errors, provider rights and rate limits

HTTP 403/429, timeouts and malformed responses return MCP `isError: true` and
structured codes. `Retry-After` is preserved. This server performs no automatic
retry, challenge bypass, proxy rotation or authentication workaround. Provider
limits cannot be removed by a wrapper.

Review current provider terms before use or redistribution. In particular,
[Remotive's API terms](https://github.com/remotive-com/remote-jobs-api) require
attribution and original links, prohibit third-party job-site redistribution and
signup gating, and limit request frequency. Returned legal notices must travel
with the records. The MIT code license does not license job content.

## Verification

```sh
npm run check
npm test
npm run smoke
```

Tests use synthetic records: 325-row pages, descriptions above 2,500 characters,
string country restrictions, Personio nested sections, exact date provenance,
page zero, malformed responses, 403/429, timeout, duplicate IDs, expired snapshots
and memory limits. `smoke` performs bounded live reads through the actual MCP
stdio protocol and prints counts/hashes only. A provider access error is reported
as a source limit; it is not a successful zero-job test.

Original wrapper and improvements: Ahmed Elkashef. See
[dependency credits](THIRD_PARTY_NOTICES.md). Contributions with reproducible
synthetic failure cases are welcome.

The original `dvinci_capabilities`, `dvinci_inventory` and `dvinci_detail`
bridge calls the retained Python [public publication reader](../dvinci/README.md).
Its exact documented publishing GETs are separate from protected account REST
and application endpoints. Inventory is compact complete-array metadata by
default; `include_body: true` reads all full native publication body variants.

Original `onlyfy_capabilities`, `onlyfy_inventory` and `onlyfy_detail` bridge
to the [native Onlyfy career reader](../onlyfy/README.md). Full primary HTML
comes from the observed public job frame; the shell schema summary and
secondary export variants remain separate. Continuation requires the actual
first total and verifies native ranges, current page and terminal controls.

Original `jobshop_capabilities`, `jobshop_inventory` and `jobshop_detail`
bridge to the [Jobshop native reader](../jobshop/README.md). Native SSR links,
anchors and independent totals reconcile; complete primary CMS, other context,
schema/native clocks and form labels stay separate. No search key is used.
