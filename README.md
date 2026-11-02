# Job Market MCP

Current browser correction: v0.4.31 awaits Tanqeeb native Next navigation to the
exact observed next-page document before inspecting its source rows. The wait
uses the remaining bounded invocation timeout; Forasna retains its independently
verified native-click continuation. Browser runner is 0.1.2; Python stays 0.3.7.

Current source corrections: v0.4.30 preserves complete unheaded Lever sections
and detects Tanqeeb pagination returning a broad cohort under a retained work
model checkbox. Browser and captured-HTML checks preserve contradictory evidence
and stop after bounded recovery. Python adapters are 0.3.7; no new source or
whole-market coverage claim is added.

Current original extension: v0.4.29 adds the independently qualified Haema
Jobshop employer origin and preserves every primary CMS section, including its
three-section internship template. Fraport vendor redirects remain isolated;
no hydration keys or browser/account fallback are used. See the
[Jobshop contracts](shared/jobshop/README.md).

The v0.4.28 extension adds the unfiltered native Ausbildung.de
internship catalogue and complete public advert readers, with a fixed anonymous
read-only search operation, separate result/place counters and bound native
continuation. University placements can occur in the school-labelled section;
portal mirrors can outlive employer originals. See the
[Ausbildung contracts](docs/ausbildung-native-readers.md). Indeed records its
dated exact-entry HTTP403 barrier. The earlier
[GULP contracts](docs/gulp-native-readers.md) and dated Kimeta/Stellenwerk limits remain active.
The 100-tool, 101-source catalogue preserves source types: research organisations are discovery records,
not vacancies or all employers. Immutable, checksum-verified native snapshots
support cached country segments without repeated provider reads. See
[ROR contracts](shared/ror/README.md). Monster records its dated exact new-entry
HTTP403 limit rather than an unverified inventory.
The [AUBI contracts](docs/aubiplus-native-readers.md) preserve native grouped
overlaps, pagination, source counter units and malformed-data limits.
The earlier [Berlin UTF-8 correction](docs/berlin-state-native-readers.md) remains active.

One source repository for country-based labour-market tools. Egypt and Germany are the first country packages. Public feeds, employer ATS readers and client-project adapters are shared. More countries can use the same contracts without copying another country's implementation.

The original [Oracle Candidate Experience reader](shared/oracle/README.md)
adds qualified whole-site and Germany inventories with complete public job
sections. It reconciles the inner vacancy count separately from Oracle's
outer search-container pagination. Employer discovery, other external sites
and historical market coverage remain explicit requirements.

The repository was renamed from `egypt-jobs-mcp`; its existing Git history and releases are preserved. It consolidates the authored Egypt adapters, the Germany BA derivative, the original StepStone implementation and the shared public-source server. Exact imported commits and retained licences are in [import provenance](docs/import-provenance.json) and [credits](ACKNOWLEDGMENTS.md).

## Install and run

Requires Node.js 20+ and Python 3.11+.

```sh
git clone https://github.com/ahmed-elkashef/job-market-mcp.git
cd job-market-mcp
python3 -m venv .venv
.venv/bin/python -m pip install -e packages/source-adapters -e countries/de/stepstone
npm ci --ignore-scripts
JOB_MARKET_PYTHON="$PWD/.venv/bin/python" npm start
```

`server.mjs` exposes the unified stdio MCP. Set `JOB_MARKET_PYTHON` to the absolute Python executable in your MCP client's environment; use the absolute `server.mjs` path as its Node argument. No sibling checkout or account login is needed for the public adapters. Account-based external services remain separately configured.

The original Egypt-only `node index.mjs` entrypoint remains available. Python imports/CLI names under `egypt_job_sources` are preserved for compatibility. `private: true` in the npm manifest prevents accidental npm publication; it does not describe GitHub repository visibility.

## Country packages and tools

| Package | Included implementation | Unified tool prefix |
| --- | --- | --- |
| [Egypt](countries/eg/README.md) | WUZZUF, Forasna, ArabJobs, Tanqeeb, Akhtaboot, Bayt and Mostaql readers; native public DOM recipes where HTTP is unavailable | `eg_` |
| [Germany](countries/de/README.md) | Structured BA jobs; salary, study and training; original StepStone, Interamt and public student-board readers | `de_ba_`, `de_stepstone_`, `de_public_` |
| [Shared](shared/README.md) | Native public feeds, complete snapshot/detail retrieval, direct ATS boards and public client-project reads | `shared_` |

Four catalogue tools work without acquiring jobs:

- `list_countries`: packages and actual local backend readiness.
- `list_country_sources`: national and shared sources, current implementation gaps and access conditions.
- `source_capabilities`: one source's supported routes, fixed arguments and native tool schemas.
- `plan_country_scan`: a plan for explicit geography and offset-aware `[from,to)` dates, retaining unresolved sources.

[The source registry](sources.json) currently contains 99 distinct source/channel entries. It is an open discovery register, **not proof that every Egyptian or German employer or vacancy is represented**. Entries explicitly distinguish implemented readers, access-limited routes, employer-seeded readers, credential requirements, external connectors, research gaps and statistical context. [Coverage](docs/coverage.md) explains the remaining work.

## End to end

1. Resolve the country and source capabilities before acquiring supply.
2. Enumerate genuine native geography/model partitions and pagination; do not hide title, role or skill filters in an inventory route.
3. Preserve each native response, IDs, source/observation dates, continuation and access errors in the consumer's private evidence store.
4. Hydrate complete descriptions and requirements, then reconcile duplicates, changed/reopened postings and uncertain publication clocks.
5. Evaluate eligibility or applicant fit in the consuming application. A read, source total, native terminal or registry entry never proves a complete frozen market.

The federation forwards full native responses without shortening job descriptions. It exposes an explicit read-only tool allowlist, namespaces tool identities and isolates backend failure. Unknown/new backend tools are not enabled automatically. Oversized results fail explicitly rather than returning truncated descriptions. Child processes are owned by the server and closed with it.

## Germany public boards

The original [JOIN employer-board reader](docs/join-native-reader.md) handles both public SSR layouts, complete native continuation and distinct public/internal job IDs. Spontaneous-application context and repeated cached rows on a virtual final page are kept separate from vacancies. Primary full HTML, source schema/company context and native dates remain distinct; scope-checked canonical job redirects require no browser. An explicit verified employer board is required.

The original [Jobmensa, StudentJob and YoungCapital readers](countries/de/student-boards/README.md) enumerate complete public native pages and full visible job details without a browser. Current robots policy, exact native continuation and model/date/worker-country ambiguities remain explicit. It makes no account, contact or application action.

The original [public-board readers](countries/de/public-boards/README.md) also cover Absolventa, academics, stellenanzeigen.de, Yourfirm, GermanTechJobs the permitted official government vacancy feed, Jobs.de, Jobware, BerlinStartupJobs EnglishJobs metadata and anonymous XING inventory/body/discovery, get in Engineering, Zenjob public shifts and the official Frankfurt student portal. Native full bodies, verified pagination and distinct clocks remain separate from coverage and applicant fit.

## Original shared Workday reader

The [original Workday CXS reader](shared/workday/README.md) adds `shared_workday_capabilities`, `shared_workday_inventory` and `shared_workday_detail`. It enumerates an explicitly identified employer board without role keywords, preserves native continuation and full descriptions, and checks tenant/site/posting identity. The live proof reconciled 922 distinct current postings across 47 native pages and three complete source bodies. The legacy capped Workday domain reader is disabled. Employer discovery and historical interval coverage remain separate requirements.

## Original shared Teamtailor feeds

The [original career-feed reader](shared/teamtailor/README.md) exposes `shared_teamtailor_capabilities`, `shared_teamtailor_inventory` and `shared_teamtailor_detail`. Native advertised API catalogues lead to complete JSON/RSS feeds with full descriptions and additional location/remote/department facts. Native counts, GUIDs, URLs and body variants reconcile without role filters. The dated proof covers three employers and98 current postings; employer discovery and historical weekly coverage remain separate. No account API, secret key or application operation is used.

## Original shared d.vinci publications

The [original publication reader](shared/dvinci/README.md) adds complete compact metadata arrays, optional full-body arrays and exact native publication details for independently identified portals. It preserves every rendered section, raw variants and all ten company description fields; publication availability, requisition creation and job-entry clocks remain separate. The dated proof covers two portals and 28 current publications. No protected account REST or application endpoint is requested.

## Original shared Onlyfy career boards

The [original Onlyfy native reader](shared/onlyfy/README.md) exposes complete unfiltered career pages with checked native continuation and full primary job-ad HTML. It keeps the shell schema summary and additional export variants separate from the primary ad, with no account, script/CDN, print/PDF or application request. Employer seeds and historical coverage remain explicit requirements.

## Original shared Jobshop career boards

The [original Jobshop reader](shared/jobshop/README.md) reconciles the whole native SSR link array with every source anchor and an independent board count. It follows actual policy-checked public redirects and preserves complete primary CMS HTML, full context, source clocks and form labels separately, without source search credentials or application operations.

## Original shared SAP SuccessFactors RMK reader

The [original RMK reader](shared/successfactors/README.md) qualifies SAP's
explicitly advertised legacy board, with whole native pages, verified Germany
and Egypt partitions, frozen-count continuation and complete job descriptions.
URL-site and requisition IDs, primary and additional locations, student status,
contract fields and posted dates remain separate. The current SAP front is a
different transport and is not included or combined with the legacy counts.

## Additional Germany API

Original Interamt capability/list/detail code is included under `countries/de/interamt`. Its public OpenAPI requires an approved API key; single-customer and MultiMandant scopes remain distinct. `de_public_interamt_capabilities` inspects this offline; `de_public_interamt_read` refuses before network without approved local access and an explicitly confirmed API base. No authenticated live access is claimed.

## Browser use and limits

API, feed and ordinary authorized HTTP routes are the default. A browser is a last transport option where a maintained source actually requires it. Forasna/Tanqeeb's existing runners remain explicit browser-dependent routes. StepStone checks its current route policy and does not turn denied pagination into a fake empty market. LinkedIn, Upwork and similar account services are external access boundaries, not anonymous scraper fallbacks.

A country package is complete only when every required registered source has tested discovery, native partitions, continuation, complete details, clock evidence and honest access results. Today's consolidation does **not** claim that the remaining Germany/Egypt research entries are implemented. [Architecture and workflow](docs/architecture.md) records the exact ownership and migration boundary.

## Verify

```sh
.venv/bin/python -m pip install -e 'packages/source-adapters[dev]' -e 'countries/de/stepstone[test]'
JOB_MARKET_PYTHON="$PWD/.venv/bin/python" EGYPT_JOBS_PYTHON="$PWD/.venv/bin/python" npm test
npm run check
.venv/bin/python scripts/test-python.py
```

Tests use synthetic data, mocked source requests and real local stdio MCP connections. The Python receiver test binds an owned temporary loopback port. Live probes are separate and bounded; no source census, account connection, application, message, bid, purchase or monitor starts from installation or testing. See [source policy](SOURCE_POLICY.md).

Personio native German/English description feeds and verified-origin posting links are documented in [the original XML reader contract](docs/personio-native-xml.md). Locale variants share native job identities; XML company-context omissions remain explicit.

Personio complete primary adverts, separate About us context and guarded source identity are available through the original [read-only primary advert tool](docs/personio-primary-adverts.md). XML and primary-page descriptions remain distinct.

Original [German student-market and organisation-directory readers](docs/german-student-and-directory-readers.md) expose native MeinPraktikum inventory/full adverts and personal-use HRK/GVP discovery records. Parent and location IDs, native continuation, source-use restrictions and remaining employer-discovery gaps stay explicit.

Original [Handwerk native readers](docs/handwerk-native-readers.md) expose scoped Radar internship/apprenticeship offers and the qualified standalone Wiesbaden/Unterfranken primaries. Actual variable and overlapping rows, unknown totals, initial page ceilings and genuine empty query scopes remain explicit. Firm-directory records are not jobs; native inline fields can omit standalone full-time requirements. No source-script or application operation.
