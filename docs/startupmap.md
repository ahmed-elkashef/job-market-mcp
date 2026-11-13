# StartupMap public reader

This is an independent adapter for StartupMap's public sitemap and HTML pages.
It is not an official StartupMap API. It needs no account, key or browser.

The same nine read-only tools are available through the main federation with
the `shared_` prefix, or through the small source-only entry point:

```sh
node shared/public-sources/startupmap-server.mjs
```

Set `JOB_MARKET_CAPTURE_DIR` to a private absolute directory. The directory tool
stores only the public sitemap there, under its SHA-256 hash. Its continuation
uses that exact snapshot, rather than silently switching to a changed directory.
No personal facts, account state, cookies or credentials are read or stored.

| Tool | What it returns |
| --- | --- |
| `startupmap_capabilities` | Offline routes and limits |
| `startupmap_directory` | Every company or city entry in a native sitemap segment |
| `startupmap_city_jobs` | All role occurrences in an unfiltered public city page |
| `startupmap_company` | Public company text, source facts and native role references |
| `startupmap_country` | Germany's published city memberships and native counts, with capped company lists labelled |
| `startupmap_snapshot_begin` | A frozen complete public company sitemap and country directory |
| `startupmap_snapshot_collect` | One resumable batch of at most ten company pages, including explicit empty states |
| `startupmap_snapshot_retry` | One explicitly recorded failed partition |
| `startupmap_snapshot_read` | Offline summaries or immutable company/role view segments |

For a first national baseline, freeze a snapshot, then collect every company
partition using the exact returned offset. Keep foreign-headquartered companies:
their jobs can be in Germany. Country and city company lists are capped and
cannot replace the whole public sitemap. Follow `next_segment` unchanged when
reading saved rows; its content hash binds every page to the same view, even if
a failed company is collected later. Collection errors remain visible and never
become zero vacancies. A committed page can be recovered after interruption.
An existing collection lock requires the operator to establish that its owner
has stopped before removing it; the reader never kills another process.

This establishes all accessible **published company partitions**, not an atomic
provider database export or a historical week. Record each observation time.
Company-page server-rendered role lists can stop at 50 even when the public
Jobs UI lists more. Exhausting every company partition therefore does not
establish a complete vacancy inventory. Use the permitted public UI when a
consumer needs that additional supply, and keep its separate evidence.
The consuming workflow owns its first-seen baseline, future weekly differences,
geography review, employer full-text reads and individual application decisions.

Use the directory first. City routes must also have a matching native map route;
role categories are excluded from this geographical catalogue. Page readers
require exact directory membership. There are no role, skill, stage, language,
work-model or personal-match acquisition parameters.

Every fresh resource checks the current robots policy. Private `/api`, `/admin`,
`/settings`, account routes and query-bearing URLs are outside the fixed input
contract. Redirects, HTTP denials, malformed responses, changed canonicals,
unknown source structure and inconsistent counts return `source_limited` with
unknown result counts. No fallback runs a website script or a private API.

Public city lists contain job titles and company links. Their JSON-LD can be
shorter than the visible HTML, so it is kept separately. Multiple roles at one
company remain separate occurrences. They have no verified stable vacancy ID.
Company pages provide native role IDs in application-dialog references; those
references are data only and are never followed. Full job descriptions still
need a permitted employer original or the appropriate existing ATS reader.

Sitemap `lastmod`, request time, a matching page count and a company headquarters
are not original publication time, country/week completeness, an actual job
worksite or applicant eligibility. Every response keeps these limits explicit.
Nothing applies, contacts an employer, saves a job or changes a profile.

When enriching a discovered role through the shared Recruitee reader, the full
body includes both native `description` and `requirements`. The latter can also
contain benefits and work arrangements. Preserve those sections and the raw
offer; reading only the introduction is not a full vacancy review.

Tests are synthetic and offline:

```sh
node --test shared/public-sources/test/startupmap.test.mjs
```

Bounded live checks belong to the private consumer's evidence. This repository
does not publish harvested job data or user-specific configuration.
