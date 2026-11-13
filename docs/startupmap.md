# StartupMap public reader

This is an independent adapter for StartupMap's public sitemap and HTML pages.
It is not an official StartupMap API. It needs no account, key or browser.

The same four read-only tools are available through the main federation with
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

Tests are synthetic and offline:

```sh
node --test shared/public-sources/test/startupmap.test.mjs
```

Bounded live checks belong to the private consumer's evidence. This repository
does not publish harvested job data or user-specific configuration.
