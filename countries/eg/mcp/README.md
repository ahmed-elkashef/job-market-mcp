> This retained component now belongs to [Job Market MCP](https://github.com/ahmed-elkashef/job-market-mcp). Install dependencies from the monorepo root with `npm ci --ignore-scripts`; see the root README for unified startup. The component instructions below preserve its standalone interface.

# Egypt Jobs MCP

Read-only MCP tools for Egyptian public job sources, worldwide remote feeds,
and freelance client projects. Built to make source acquisition reusable,
observable and accessible.
It combines the standalone [Egypt Job Sources Python library](https://github.com/ahmed-elkashef/egypt-job-sources)
with a small JavaScript SDK server over standard input/output.

**MIT licensed.** Credits, exact upstream reference commits and authors are in
[ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md) and
[upstream-references.json](upstream-references.json). These are independently
written adapters informed by community references. No fork ancestry, copied
scraper implementation or platform affiliation is claimed.

## Install from GitHub

Requires Node.js 20 or newer and Python 3.11 or newer. Install the Python project
first; this release is distributed as source on GitHub, not through npm or PyPI.

```bash
git clone --branch v0.3.5 --depth 1 https://github.com/ahmed-elkashef/egypt-job-sources.git
cd egypt-job-sources
python3 -m venv .venv
.venv/bin/python -m pip install .
cd ..
git clone --branch v0.3.7 --depth 1 https://github.com/ahmed-elkashef/egypt-jobs-mcp.git
cd egypt-jobs-mcp
npm ci --ignore-scripts
EGYPT_JOBS_PYTHON="$(pwd)/../egypt-job-sources/.venv/bin/python" node smoke.mjs
```

On Windows use the virtual environment's `Scripts/python.exe`. Configure an MCP
client with absolute paths:

```json
{
  "mcpServers": {
    "egypt-jobs": {
      "command": "node",
      "args": ["/absolute/path/egypt-jobs-mcp/index.mjs"],
      "env": {
        "EGYPT_JOBS_PYTHON": "/absolute/path/egypt-job-sources/.venv/bin/python"
      }
    }
  }
}
```

Without `EGYPT_JOBS_PYTHON`, the server uses `python3` on PATH. The Python package
must be installed into that interpreter. Start directly with `npm start`.
The server writes MCP messages to stdout; it does not open a network listener.

## Tools

| Tool | Inputs and behavior |
| --- | --- |
| `read_source_page` | `source`, `page` (default 1), optional `work_model`, Jobicy `cursor`, or board `continuation_url`. WUZZUF pages include hydrated full resources. |
| `read_source_detail` | `source` and canonical public `url`; no generic URL fetch. |
| `wuzzuf_work_model_taxonomy` | Blank-query Egypt employment facets and selected country. |
| `jobicy_location_taxonomy` | Current official location slugs. |
| `parse_rendered_board_page` | Source and exact `{url,kind,captured_at,html}` public DOM object; no network or browser control. |
| `read_saved_board_capture` | SHA-256 receipt only; verifies and reparses original local evidence. |
| `read_public_api_jobs` | Complete native Arbeitnow/The Muse pages; optional page or exact next_url, and bounded Muse testing mode. Requires Python 0.3.4. |
| `remote_source_capabilities` | Access, attribution, pagination and completeness limits for each global feed. |
| `read_remote_feed` | `source`: `remotive`, `remoteok`, `weworkremotely`, `workingnomads`, or `himalayas_global`; optional exact returned cursor for Himalayas only. All returned listings, without title/keyword filters or text slicing. |
| `freelance_source_capabilities` | Public Freelancer and approval-gated Upwork contracts and limits. |
| `read_freelance_projects` | `source`: `freelancer` or `upwork`; `limit` 1–100, default 20. Freelancer uses `offset`; Upwork uses its returned `cursor`. |
| `read_freelance_project_detail` | Source and a numeric `project_id`. Full client brief; no bids, profiles, messages or files. |

Supported sources: WUZZUF, Forasna, ArabJobs, Tanqeeb, Akhtaboot, Bayt Egypt, Himalayas, Jobicy and
Mostaql, plus the worldwide feeds and freelance routes above. WUZZUF models include `full_time`, `part_time`, `freelance_project`
(`freelance` alias), `internship`, `shift_based` and `volunteering`; omission means
broad Egypt inventory. No keyword, career-title, skill or seniority filter is
exposed. Source labels do not establish actual hours or candidate suitability.

Example tool input:

```json
{"source":"wuzzuf","page":1,"work_model":"part_time"}
```

### Verified native Egypt work models (0.3.5)

ArabJobs `work_model:part_time` uses `filterJobType=2` with Egypt `EG` and newest `sortType=2`; every returned continuation retains those exact filters. Other observed labels are `full_time`, `contract_temp`, `consultant` and `freelance`. Forasna `work_model:part_time` constructs the actual country `مصر` and case-sensitive `filters[jobType][0]=نصف يوم` controls. Ordinary HTTP may still be denied; the selected public DOM extractor accepts the same exact scope. An SEO landing-page heading alone is not geography proof.

Tanqeeb requires the actual selected Egypt country, checked type and sort state in the public capture. Its native Part Time checkbox value is2; Internship5 and Freelance/Project7 are separate labels. The collector preserves every returned card, including contradictions and unknowns. `next_url` is deliberately null when a Next URL omits native state; `next_browser_action` requires an actual native click followed by matching filter signature verification. Reopening a URL alone can reset the filters. A changing-sort-last sequence also returned full-time cards while Part Time remained checked. The verified sequence is: set newest sort first, apply the native work-type last, wait for returned card membership, then use Next and verify membership again. Preserve leakage and contradictory cards for consumer screening; a checkbox is not result-membership proof. Filtered HTTP parameters are not invented.

These are acquisition filters, not a guarantee of compatible actual hours or worker eligibility. A consumer must reconcile unknown/mixed/contradictory labels, original publication instants, duplicates and source limits. This public package contains no person's private preferences.

### Exact Lever commitment labels

`read_employer_board` accepts an optional Lever-only `commitments` array with one to twenty distinct nonempty exact labels, each at most 200 characters. Discover labels from the broad confirmed employer board's native `categories.commitment`; do not assume universal class names. The [official Lever API](https://github.com/lever/postings-api) applies repeated commitment parameters with case-sensitive OR matching. Preserve the same labels across every returned `next_skip` continuation. Full descriptions and original row counts remain intact, with `source_filters` and returned-label verification. Known contradictions fail explicitly; missing/mixed metadata stays undetermined.

Keep the unfiltered unknown/other-label and full-time-contradiction complement when assessing supply. Internship, contract and fixed-term labels do not prove part-time hours or eligible geography. Greenhouse/Ashby and individual details refuse commitments; a filtered terminal page does not establish whole-board or weekly coverage.

## Source capabilities and limits

| Source | Route | Limit |
| --- | --- | --- |
| WUZZUF | Transparent anonymous public JSON:API, 15/page and full-resource hydration | Undocumented frontend contract; can change. Public start is a page index, API startIndex is a card offset. |
| Forasna | Operator-authorized public browser DOM | Ordinary HTTP may be denied. Click visible Next and verify URL/active page/IDs: href offsets and rendered UI actions can disagree. No inferred numbered offsets. |
| ArabJobs | Country-only Egypt HTTP, newest-first pager and canonical details | Archive-like inventory and sparse descriptions may not represent active vacancies. |
| Tanqeeb | Selected public DOM cards/details and observed native controls | Anonymous HTTP currently yields an empty202 response. Model/type state can disappear from Next URLs; use native UI continuation and compare captured filter signatures. |
| Akhtaboot Egypt | Anonymous HTTP or selected public DOM, exact Egypt scope | Explicit scoped empty state is distinguished from loading/challenges. Nonempty markup validation is separate from current Egypt supply; original dates/hours still need review. |
| Bayt Egypt | Public page and JobPosting parser | HTTP access may be denied; failures remain visible. |
| Himalayas | Official country-filtered API | Egypt includes worldwide listings. Preserve canonical source attribution; verify location/hours. |
| Jobicy | Official global cursor feed and taxonomies | Seven-day window. Start new polling passes no more than hourly; cursor requests can complete one pass. |
| Mostaql | Public client-project list and scoped brief/terms | Posted project budget is not salary or earned income; scope, fees, hours and payment access need review. |
| Remotive | Official global JSON feed | 24-hour delay; cache responses and observe the provider's limit of four fresh fetches per day. Attribution required. |
| Remote OK | Public JSON feed with source legal metadata | Recent snapshot, not a historical census. Preserve source name and canonical links; descriptions may be abbreviated. |
| We Work Remotely | Official all-jobs RSS | Current feed window only; public source text may omit details. Canonical listing review required. |
| Working Nomads | Public footer-linked JSON endpoint | Exposed snapshot; no verified historical exhaustion or description completeness. Source reuse restrictions apply. |
| Himalayas global | Official full global cursor feed, 20/page | Daily refresh; follow exact returned cursor. Location, timezone, pay currency and pay period need review. |
| Freelancer.com | Public active-project API and numeric-ID detail | Moving offset inventory; full briefs, original budgets and commitments. Only public project fields retained; no account required for these reads. |
| Upwork | Fixed read-only GraphQL marketplace queries | Approved API application, authorized scopes and OAuth access token required. Browser login alone is insufficient. No live authenticated API verification is claimed. |

Successful text acquisition is not a model review or a completed market census.
Responses retain `coverage_complete=false` and `reviewed_by_model=false`.
Access, structure, identity or hydration failures are `source_limited`; they
never become fabricated zero jobs. Raw dates with unknown timezones stay raw.
Keep source-owned content private and follow [SOURCE_POLICY.md](SOURCE_POLICY.md).
The MIT license covers authored software, not third-party listings or site data.

### Upwork activation

The server reads `UPWORK_ACCESS_TOKEN` only from its machine-local environment.
Obtain it through an approved Upwork API application with the required read
scopes; never pass browser cookies, session tokens or credentials as tool inputs.
Missing approval/token returns an explicit `api_approval_required` limitation.
See [Upwork's API requirements](https://support.upwork.com/hc/en-us/articles/115015857647-How-to-request-an-API-key-from-Upwork).
Only fixed marketplace search/detail queries are implemented. No arbitrary
GraphQL or account write operations are exposed. Canonical job URLs stay null
when the verified query contract does not supply one.

### Bounded acquisition

Remote HTTP bodies are limited to 25 MiB; MCP Python subprocess output is limited
to 64 MiB and 55 seconds. Serialized MCP results are bounded to 9 MiB to fit
common SDK client buffers; larger complete results return `source_limited` and
can be acquired through the Python CLI into private storage. No partial listings
are returned. Oversize output, timeouts and malformed responses are
visible limitations, never silently truncated listings or empty supply. Feeds
without a cursor return `has_more=null`; a snapshot does not prove exhaustion.
Native work-type and worldwide labels may conflict with descriptions. Resolve
actual hours and country restrictions after reading the full canonical text.

## Browser evidence handoff

The Python package's `egypt-job-capture serve` starts a loopback-only local form.

The Forasna detail extractor retains only canonical public `JobPosting` job fields from JSON-LD. The Python parser reconciles the source identifier with the exact detail URL and preserves aware publication/expiry timestamps, original visible clock, applicant-country restrictions and native salary units. Conflicting clocks and expiry order are reported, not silently normalized. Source metadata does not establish compatible hours, historical completeness or candidate fit. Contact/account fields and executable scripts remain excluded.
Run it with the same interpreter configured for this MCP, open its printed local
URL, and transfer selected public DOM from a browser you are authorized to use.
The standalone `captureEgyptBoardDOM` function in
[browser-extract.mjs](browser-extract.mjs) validates the public page scope before
reading content. Copy the function without its `export` keyword into your
browser tool's read-only DOM evaluator and call it with
`{source:'forasna',kind:'page'}` or `kind:'detail'`.

Submit the exact capture object through the local form and inspect the saved
receipt. Call `read_saved_board_capture` with its SHA-256. The capture tool keeps
immutable receipts in the user's local cache; `EGYPT_JOBS_CAPTURE_DIR` can select
another local directory. It never reads cookies, session storage, hidden account
state or applicant data. Stop the receiver after use. It does not drive a
browser, solve challenges or widen access.

## Development

Install the Python library into your test interpreter, then:

```bash
npm ci --ignore-scripts
EGYPT_JOBS_PYTHON=/path/to/python npm test
node smoke.mjs
```

Tests use synthetic payloads and make no source-site network requests. GitHub
Actions tests the MCP against the paired Python library. Contributions are
welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Do not submit real captures,
candidate records, credentials or downloaded job corpora.

## Official employer boards

Version 0.3.0 adds `ats_source_capabilities`, `read_employer_board`, and `read_employer_job_detail` (fourteen read-only tools total). Each board call requires an explicit confirmed provider/board token. Greenhouse/Ashby use official whole-board responses; Lever uses skip/limit and global/EU endpoints. Only Greenhouse/Lever have documented individual detail reads here. No employer-domain guessing, arbitrary URL target, application, candidate data or internal posting access. Full text and stable IDs are preserved; API failures remain limits. A board snapshot is not a geographic or frozen-week census.

### Freelancer activity intervals

`read_freelance_projects` accepts paired aware RFC3339 `from_time` and `to_time` only for `source:freelancer`. For example, freeze `2026-01-01T12:00:00Z` to `2026-01-03T12:00:00Z` and repeat those exact values on each returned-offset page. Native date filters constrain **update activity**; the backend separately reports exact `[start,end)` submission-window classification. Missing or conflicting source timestamps remain undetermined, and every public row and raw pagination count remains intact. Known activity outside the requested native interval produces an explicit limitation. These parameters do not establish first-ever creation, an exhaustive market census or immunity to provider limits. No date argument is accepted for Upwork or detail reads.

The native hourly commitment value is a billing limit, often the default 40 hours per week, rather than proof of mandatory full-time attendance. Actual required hours must be established from the brief.

## Complete native public APIs

`read_public_api_jobs` preserves every native HTML description and actual continuation. [Arbeitnow](https://www.arbeitnow.com/blog/job-board-api) starts at page 1; [The Muse](https://www.themuse.com/developers/api/v2) starts at page 0. Use only the returned `next_url` or native page; these APIs expose no candidate filters here. An ordinary wrapper may cap result counts or clip descriptions; this reader does neither. Missing, stalled or cross-source continuation fails explicitly.

The Muse requires registered application access beyond capability testing. Its official limits are 500 anonymous test requests/hour and 3600 registered requests/hour. Keep `THEMUSE_API_KEY` machine-local; never put it in tool inputs. `testing:true` permits a bounded anonymous capability test, not a production market refresh. Arbeitnow has no verified numeric rate allowance: honor HTTP 429 and safe Retry-After metadata. Moving pages and native date fields do not establish historical completeness or original publication. Fifteen read-only tools are registered in this release.

The complete API body is retained once as `description`, with every other native field in `source_data` and the original body key in `source_description_field`. Original native rows are exactly reconstructible. This removes duplicate HTML serialization without dropping any row or shortening any description.


## Automatic authorized browser capture

`browser_capture_plan` exposes verified native recipes for **Tanqeeb Egypt** and
**Forasna Egypt**. Import `browser-runner.mjs` inside the supported CUA runtime,
inject an authorized source Tab and a trusted private checkpoint sink, then call:

```js
await runBoardCapture({tab, detailTab, sink, source: 'tanqeeb', workModel: 'part_time',
  maxPages: 20, maxMillis: 45000, collectDetails: true});
```

The runner controls native filters, observes actual card membership, clicks native
Next controls, saves selected DOM, resumes bounded chunks and captures only briefs
queued by the private intake. Pass a separate, task-owned `detailTab` to keep the
listing tab at its exact native cursor while briefs are read. The single-tab form
is still supported. It has no browser launcher, network client, session
export, CAPTCHA solver or application actions. Browser access must be available
through the authorized runtime. Native dates and candidate fit still require
independent evidence and review; capture completion is not market coverage.

Tanqeeb ordering is applied before the compatible job type. Type is applied last
because live testing found that changing sort afterward could silently restore
full-time results despite selected part-time controls. Forasna uses explicit Egypt
and half-day controls; pagination follows the actual control, not guessed offsets.
Unknown/mixed supply requires a separate all-types complement and objective private
screening. Full-time only supply is excluded before brief capture.

Forasna's all-types view may explicitly select its native `الكل-jobtype` option.
The runner accepts that All marker or no selected type for a broad capture, while
still rejecting restrictive or mixed type selections and requiring the same
verified Egypt controls. This does not change the part-time returned-membership
checks, bypass access barriers or establish historical completeness.

The injected sink implements `status()`, `capture(capture, meta)`,
`detail(capture, proof)`, `recover(options)` and `limit(metadata)`. It must persist
immutable binding/captures and validate native scope, continuation and stable IDs.
Status provides `source`, `initial_url`, `native_filter_plan`, `cursor`,
`source_continuation`, `detail_queue`, `listing_terminal_observed` and
`capture_complete`. A lost browser page is recovered by replaying from the seed
with preserved deduplication. Access barriers and layout changes stop with a
checkpoint rather than being reported as zero jobs. See the offline tests for
synthetic examples; no live listing data is shipped.


Native disclosure fragments on Tanqeeb are normalized only for the two observed
filter panels. Same-source, same-ID canonical detail slug redirects are allowed;
foreign hosts, different IDs and query-bearing detail URLs are rejected. Native
card/body visibility waits handle hydration. Browser-host navigation errors are
accepted only if the intended canonical identity is visibly reached and all
normal readiness/membership checks subsequently pass. Missing original publication
clocks and genuinely empty briefs remain evidence limitations, never invented facts.
