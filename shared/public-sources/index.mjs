#!/usr/bin/env node

import {
  detectATS,
  fetchAshbyJobs,
  fetchGreenhouseJobs,
  fetchLeverJobs,
  fetchRipplingJobs
} from "@mambalabsdev/ats-scrapers";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { XMLParser } from "fast-xml-parser";
import { pathToFileURL } from "node:url";
import { InventoryClient, inventoryTools, plainText, SourceError, errorResult } from "./inventory.mjs";
import {workdayTools,workday} from './workday.mjs';
import {teamtailorTools,teamtailor} from './teamtailor.mjs';
import {dvinciTools,dvinci} from './dvinci.mjs';
import {onlyfyTools,onlyfy} from './onlyfy.mjs';
import {jobshopTools,jobshop} from './jobshop.mjs';
import {successfactorsTools,successfactors} from './successfactors.mjs';
import {oracleTools,oracle} from './oracle.mjs';
import {personioTools,personio} from './personio.mjs';
import {rorTools,ror} from './ror.mjs';
import {startupmapTools,startupmap} from './startupmap.mjs';
import {startupmapSnapshotTools,startupmapSnapshot} from './startupmap-snapshot.mjs';
const inventoryClient = new InventoryClient();

const DEFAULT_TIMEOUT_MS = Number(process.env.JOBFLOW_PUBLIC_JOBS_TIMEOUT_MS || 15000);
const DEFAULT_LIMIT = 25;
const USER_AGENT =
  process.env.JOBFLOW_PUBLIC_JOBS_USER_AGENT ||
  "public-job-sources-mcp/0.2";

const server = new Server(
  { name: "jobflow-public-jobs", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

export const tools = [
  ...startupmapTools,
  ...startupmapSnapshotTools,
  ...workdayTools,
  ...teamtailorTools,
  ...dvinciTools,
  ...onlyfyTools,
  ...jobshopTools,
  ...successfactorsTools,
  ...oracleTools,
  ...personioTools,
  ...rorTools,
  ...inventoryTools,
  {
    name: "search_public_jobs",
    description:
      "Search stable no-token public job APIs: Arbeitnow, Remotive, RemoteOK, Jobicy, Himalayas, and The Muse. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Role or keyword query." },
        location: { type: "string", description: "Optional location filter." },
        remote: { type: "boolean", description: "If true, keep remote jobs where the source exposes it." },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tag keywords to match."
        },
        max_per_source: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          default: 15,
          description: "Maximum returned jobs per source."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "search_arbeitnow",
    description:
      "Search Arbeitnow's public Germany-focused job-board API and filter locally. Useful for English/Germany startup and tech roles.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        location: { type: "string" },
        remote: { type: "boolean" },
        tags: { type: "array", items: { type: "string" } },
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      }
    }
  },
  {
    name: "search_remotive",
    description:
      "Search Remotive's public remote-jobs API. Useful for English-first remote and startup roles.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      }
    }
  },
  {
    name: "search_remoteok",
    description:
      "Search RemoteOK's public jobs API and filter locally. Useful for English-first remote roles.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      }
    }
  },
  {
    name: "search_jobicy",
    description:
      "Search Jobicy's public remote-jobs API. Useful for Europe/global remote roles and startup-friendly scans.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword/tag search over title and description." },
        geo: { type: "string", description: "Optional Jobicy region slug, for example europe, usa, canada, latam, apac." },
        industry: { type: "string", description: "Optional Jobicy industry/category slug." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      }
    }
  },
  {
    name: "search_himalayas",
    description:
      "Search Himalayas' public remote-jobs API. Useful for English-first remote roles with country, seniority, employment type, and salary data.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text job search query." },
        country: { type: "string", description: "Optional country filter such as Germany, Egypt, United States, or DE." },
        worldwide: { type: "boolean", description: "If true, request worldwide-only jobs." },
        seniority: { type: "string", description: "Optional seniority filter, for example Manager, Director, Senior." },
        employment_type: { type: "string", description: "Optional employment type, for example Full Time, Part Time, Contractor." },
        sort: { type: "string", description: "Optional sort, for example recent or salaryDesc." },
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 20 }
      }
    }
  },
  {
    name: "search_themuse",
    description:
      "Search The Muse public jobs API. Useful for international/remote company scans; weaker for German-local coverage.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text keyword filter applied locally." },
        location: { type: "string", description: "The Muse location filter, for example Remote or Germany." },
        category: { type: "string", description: "The Muse category filter, for example Engineering, Project Management, Customer Success." },
        company: { type: "string", description: "Optional company filter." },
        page: { type: "integer", minimum: 0, default: 0 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      }
    }
  },
  {
    name: "search_workable",
    description:
      "Search Workable's public cross-customer job board. Useful for broad international startup/SMB roles.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Role or keyword query." },
        location: { type: "string", description: "Optional location filter." },
        workplace: { type: "string", description: "Optional workplace filter, for example remote, hybrid, or on_site." },
        page_token: { type: "string", description: "Optional Workable nextPageToken from a previous response." },
        limit: { type: "integer", minimum: 1, maximum: 50, default: DEFAULT_LIMIT }
      },
      required: ["query"]
    }
  },
  {
    name: "fetch_workable_jobs",
    description:
      "Fetch public Workable jobs for one company slug from apply.workable.com. Company-targeted and read-only.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Workable company slug from apply.workable.com/<slug>." },
        query: { type: "string", description: "Optional local filter over title/description/location." },
        location: { type: "string", description: "Optional local location filter." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      },
      required: ["slug"]
    }
  },
  {
    name: "fetch_smartrecruiters_jobs",
    description:
      "Fetch public SmartRecruiters postings for one company identifier. Optional detail expansion includes fuller posting text.",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string", description: "SmartRecruiters company identifier, for example SmartRecruiters or Visa." },
        query: { type: "string", description: "Optional local filter over title/description/location." },
        location: { type: "string", description: "Optional local location filter." },
        offset: { type: "integer", minimum: 0, default: 0 },
        limit: { type: "integer", minimum: 1, maximum: 50, default: DEFAULT_LIMIT },
        include_details: { type: "boolean", description: "If true, fetch each posting detail for fuller text. Keep limits small." }
      },
      required: ["company"]
    }
  },
  {
    name: "detect_company_ats",
    description:
      "Detect a company's public ATS from its domain and return open roles when discoverable. Covers Greenhouse, Lever, Ashby, Workday, and Rippling.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Company domain, for example stripe.com." },
        slug: {
          type: "string",
          description: "Optional explicit ATS slug when it differs from the domain."
        },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      },
      required: ["domain"]
    }
  },
  {
    name: "fetch_company_ats_jobs",
    description:
      "Fetch jobs from a known public ATS for a company domain. Covers Greenhouse, Lever, Ashby, Workday, and Rippling.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string" },
        ats: {
          type: "string",
          enum: ["greenhouse", "lever", "ashby", "workday", "rippling", "auto"],
          default: "auto"
        },
        slug: { type: "string", description: "Optional explicit ATS slug." },
        query: { type: "string", description: "Optional local filter over title, department, location, and URL." },
        location: { type: "string", description: "Optional local location filter." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      },
      required: ["domain"]
    }
  },
  {
    name: "fetch_personio_jobs",
    description:
      "Fetch public Personio jobs from a company Personio subdomain, when XML feed is enabled.",
    inputSchema: {
      type: "object",
      properties: {
        subdomain: {
          type: "string",
          description: "The Personio company subdomain, for example example for example.jobs.personio.de."
        },
        query: { type: "string" },
        location: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      },
      required: ["subdomain"]
    }
  },
  {
    name: "fetch_recruitee_jobs",
    description:
      "Fetch public Recruitee jobs from a company Recruitee subdomain when the public offers API is enabled.",
    inputSchema: {
      type: "object",
      properties: {
        subdomain: {
          type: "string",
          description: "The Recruitee company subdomain, for example example for example.recruitee.com."
        },
        query: { type: "string" },
        location: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: DEFAULT_LIMIT }
      },
      required: ["subdomain"]
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, request => callTool(request.params.name, request.params.arguments));

export async function callTool(name, args = {}) {
  try {
    if([...startupmapTools,...startupmapSnapshotTools].some(tool=>tool.name===name)) {
      const data=await (startupmapSnapshotTools.some(t=>t.name===name)?startupmapSnapshot:startupmap)(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(rorTools.some(tool=>tool.name===name)) {
      const data=await ror(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(personioTools.some(tool=>tool.name===name)) {
      const data=await personio(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(workdayTools.some(tool=>tool.name===name)) {
      const data=await workday(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(jobshopTools.some(tool=>tool.name===name)) {
      const data=await jobshop(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(oracleTools.some(tool=>tool.name===name)) {
      const data=await oracle(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(successfactorsTools.some(tool=>tool.name===name)) {
      const data=await successfactors(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(onlyfyTools.some(tool=>tool.name===name)) {
      const data=await onlyfy(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(dvinciTools.some(tool=>tool.name===name)) {
      const data=await dvinci(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    if(teamtailorTools.some(tool=>tool.name===name)) {
      const data=await teamtailor(name,args);
      return {...jsonContent(data),structuredContent:data,isError:data.status!=='ok'};
    }
    let data;
    switch (name) {
      case "get_public_inventory": data = await inventoryClient.inventory(args); break;
      case "get_public_job_from_snapshot": data = inventoryClient.detail(args); break;
      case "search_public_jobs":
        data = await searchPublicJobs(args);
        break;
      case "search_arbeitnow":
        data = await searchArbeitnow(args);
        break;
      case "search_remotive":
        data = await searchRemotive(args);
        break;
      case "search_remoteok":
        data = await searchRemoteok(args);
        break;
      case "search_jobicy":
        data = await searchJobicy(args);
        break;
      case "search_himalayas":
        data = await searchHimalayas(args);
        break;
      case "search_themuse":
        data = await searchTheMuse(args);
        break;
      case "search_workable":
        data = await searchWorkable(args);
        break;
      case "fetch_workable_jobs":
        data = await fetchWorkableJobs(args);
        break;
      case "fetch_smartrecruiters_jobs":
        data = await fetchSmartRecruitersJobs(args);
        break;
      case "detect_company_ats":
        data = await detectCompanyAts(args);
        break;
      case "fetch_company_ats_jobs":
        data = await fetchCompanyAtsJobs(args);
        break;
      case "fetch_personio_jobs":
        data = await fetchPersonioJobs(args);
        break;
      case "fetch_recruitee_jobs":
        data = await fetchRecruiteeJobs(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return jsonContent({ status: "success", data });
  } catch (error) {
    return { ...jsonContent(errorResult(error)), isError: true };
  }
}

function jsonContent(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function legacySelection(data, args) {
  const limit = clampInt(args.limit, DEFAULT_LIMIT, 1, 100);
  const matches = data.jobs.filter(job => matchesNormalizedJob(job, args));
  const jobs = matches.slice(0, limit).map(job => ({...job, publication_date: job.publication.instant || job.publication.raw, created_at: job.created_at ?? null}));
  return {...data, jobs, count: jobs.length, matched_count: matches.length,
    omitted_by_local_limit: Math.max(0, matches.length - limit), local_limit: limit,
    coverage: matches.length > limit ? "local_result_limit" : "complete_native_response",
    next_page_url: data.pagination.links?.next || null,
    page: data.pagination.page ?? null,
    total_count: data.pagination.total ?? null,
    detail_tool: "get_public_job_from_snapshot"};
}

async function searchPublicJobs(args) {
  const maxPerSource = clampInt(args.max_per_source, 15, 1, 50);
  const results = await Promise.allSettled([
    searchArbeitnow({ ...args, limit: maxPerSource }),
    searchRemotive({ ...args, limit: maxPerSource }),
    searchRemoteok({ ...args, limit: maxPerSource }),
    searchJobicy({ ...args, limit: maxPerSource }),
    searchHimalayas({ ...args, limit: Math.min(maxPerSource, 20) }),
    searchTheMuse({ ...args, limit: maxPerSource })
  ]);
  return {
    query: args.query,
    sources: {
      arbeitnow: settledValue(results[0]),
      remotive: settledValue(results[1]),
      remoteok: settledValue(results[2]),
      jobicy: settledValue(results[3]),
      himalayas: settledValue(results[4]),
      themuse: settledValue(results[5])
    }
  };
}

async function searchArbeitnow(args) {
  const data = await inventoryClient.inventory({source: "arbeitnow", metadata_only: false, page: args.page});
  return legacySelection(data, args);
}

async function searchRemotive(args) {
  const data = await inventoryClient.inventory({source: "remotive", metadata_only: false, category:args.category});
  return legacySelection(data, args);
}

async function searchRemoteok(args) {
  const data = await inventoryClient.inventory({source: "remoteok", metadata_only: false});
  return legacySelection(data, args);
}

async function searchJobicy(args) {
  const limit = clampInt(args.limit, DEFAULT_LIMIT, 1, 100);
  const url = new URL("https://jobicy.com/api/v2/remote-jobs");
  url.searchParams.set("count", String(limit));
  if (args.geo || args.location) url.searchParams.set("geo", normalizeJobicyGeo(args.geo || args.location));
  if (args.industry) url.searchParams.set("industry", args.industry);
  if (args.query) url.searchParams.set("tag", args.query);
  const body = await fetchJson(url);
  const jobs = requireArray(body.jobs, "jobs");
  return {
    coverage:"bounded_native_feed", raw_count:jobs.length, local_limit:limit,
    api_version: body.apiVersion || null,
    job_count: body.jobCount ?? jobs.length,
    last_update: body.lastUpdate || null,
    attribution: "Job data sourced from Jobicy. Keep original application links.",
    jobs: jobs.slice(0, limit).map((job) => ({
      source: "jobicy",
      id: job.id || null,
      title: job.jobTitle || null,
      company: job.companyName || null,
      location: job.jobGeo || null,
      industry: job.jobIndustry || null,
      job_type: job.jobType || null,
      level: job.jobLevel || null,
      url: job.url || null,
      publication_date: job.pubDate || null,
      salary: job.annualSalaryMin || job.annualSalaryMax ? {
        min: job.annualSalaryMin || null,
        max: job.annualSalaryMax || null,
        currency: job.salaryCurrency || null
      } : null,
      description: plainText(job.jobDescription || job.jobExcerpt)
    }))
  };
}

async function searchHimalayas(args) {
  const data = await inventoryClient.inventory({source: "himalayas", metadata_only: false, page: args.page, country: args.country || args.location, employment_type: args.employment_type, worldwide:args.worldwide, seniority:args.seniority, sort:args.sort});
  return legacySelection(data, args);
}

async function searchTheMuse(args) {
  const data = await inventoryClient.inventory({source: "themuse", metadata_only: false, page: args.page, location: args.location, category:args.category, company:args.company});
  return legacySelection(data, args);
}

async function searchWorkable(args) {
  const limit = clampInt(args.limit, DEFAULT_LIMIT, 1, 50);
  const url = new URL("https://jobs.workable.com/api/v1/jobs");
  url.searchParams.set("query", args.query);
  if (args.location) url.searchParams.set("location", args.location);
  if (args.workplace) url.searchParams.set("workplace", args.workplace);
  if (args.page_token) url.searchParams.set("pageToken", args.page_token);
  const body = await fetchJson(url);
  const jobs = requireArray(body.jobs, "jobs");
  return {
    coverage: "bounded_native_response",
    raw_count: jobs.length, omitted_by_local_limit: Math.max(0, jobs.length-limit),
    total_size: body.totalSize ?? null,
    next_page_token: body.nextPageToken || null,
    count: Math.min(jobs.length, limit),
    jobs: jobs.slice(0, limit).map(normalizeWorkableJob)
  };
}

async function fetchWorkableJobs(args) {
  const limit = clampInt(args.limit, DEFAULT_LIMIT, 1, 100);
  const slug = normalizeSlug(args.slug);
  const url = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`;
  const body = await fetchJson(url);
  const jobs = requireArray(body.jobs, "jobs");
  const filtered = jobs
    .map((job) => normalizeWorkableJob({ ...job, company: body.name, companySlug: slug }))
    .filter((job) => matchesNormalizedJob(job, args))
    .slice(0, limit);
  return {
    company: body.name || slug,
    company_slug: slug,
    source_url: url,
    count: filtered.length,
    jobs: filtered
  };
}

async function fetchSmartRecruitersJobs(args) {
  const limit = clampInt(args.limit, DEFAULT_LIMIT, 1, 50);
  const offset = args.offset === undefined ? 0 : args.offset;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new SourceError("Invalid native offset", "invalid_argument");
  const company = normalizeSmartRecruitersCompany(args.company);
  const url = new URL(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  const body = await fetchJson(url);
  let jobs = requireArray(body.content, "content");
  const detail_errors = [];
  const detail_limit = Math.min(jobs.length, limit, 10);

  if (args.include_details === true) {
    const detailLimit = Math.min(jobs.length, limit, 10);
    const detailJobs = await Promise.all(
      jobs.slice(0, detailLimit).map(async (job) => {
        try {
          return await fetchJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings/${encodeURIComponent(job.id)}`);
        } catch (error) {
          detail_errors.push({source_id:job.id, ...errorResult(error).error});
          return {...job, detail_error:true};
        }
      })
    );
    jobs = [...detailJobs, ...jobs.slice(detailLimit)];
  }

  const filtered = jobs
    .map(normalizeSmartRecruitersJob)
    .filter((job) => matchesNormalizedJob(job, args))
    .slice(0, limit);

  return {
    company,
    coverage: "bounded_native_response",
    raw_count: jobs.length, details_attempted: args.include_details ? detail_limit : 0,
    details_capped: args.include_details === true && detail_limit < jobs.length, detail_errors,
    total_found: body.totalFound ?? null,
    offset,
    count: filtered.length,
    jobs: filtered
  };
}

async function detectCompanyAts(args) {
  const limit = clampInt(args.limit, DEFAULT_LIMIT, 1, 100);
  const result = await detectATS(normalizeDomain(args.domain), {
    slug: args.slug || undefined,
    timeout: DEFAULT_TIMEOUT_MS
  });
  return {
    coverage:"source_limited",
    limitations:["Legacy upstream discovery can swallow network failures; metadata-only result, not full-board supply."],
    raw_count:result.jobs?.length ?? 0, local_limit:limit,
    ats: result.ats,
    slug: result.slug || null,
    jobs: normalizeAtsJobs(result.jobs || [], args).slice(0, limit)
  };
}

async function fetchCompanyAtsJobs(args) {
  const ats = args.ats || "auto";
  if (ats === "auto") {
    return detectCompanyAts(args);
  }
  if(ats==='workday')throw new SourceError('Use the original workday_inventory/workday_detail tools with an explicitly verified board_url. The legacy capped domain reader is disabled.','workday_explicit_board_required');

  const domain = normalizeDomain(args.domain);
  const options = { slug: args.slug || undefined, timeout: DEFAULT_TIMEOUT_MS };
  const fetcher = {
    greenhouse: fetchGreenhouseJobs,
    lever: fetchLeverJobs,
    ashby: fetchAshbyJobs,
    rippling: fetchRipplingJobs
  }[ats];

  if (!fetcher) throw new Error(`Unsupported ATS: ${ats}`);
  const result = await fetcher(domain, options);
  const jobs = normalizeAtsJobs(result.jobs || [], args).slice(0, clampInt(args.limit, DEFAULT_LIMIT, 1, 100));
  return {
    coverage:"source_limited",
    limitations:["Legacy upstream discovery can swallow network failures; metadata-only result, not full-board supply."],
    raw_count:result.jobs?.length ?? 0,
    ats,
    slug: result.slug || args.slug || null,
    is404: Boolean(result.is404),
    count: jobs.length,
    jobs
  };
}

async function fetchPersonioJobs(args) {
  const data = await inventoryClient.inventory({source: "personio", metadata_only: false, subdomain: normalizeSubdomain(args.subdomain)});
  return legacySelection(data, args);
}

async function fetchRecruiteeJobs(args) {
  const data = await inventoryClient.inventory({source: "recruitee", metadata_only: false, subdomain: normalizeSubdomain(args.subdomain)});
  return legacySelection(data, args);
}

function normalizeAtsJobs(jobs, args) {
  return jobs
    .map((job) => ({
      source: "company_ats",
      id: job.id || job.url || null,
      title: job.title || null,
      company: job.company || null,
      department: job.department || null,
      location: job.location || null,
      posted_date: job.posted_date || job.postedAt || null,
      url: job.url || null
    }))
    .filter((job) => matchesNormalizedJob(job, args));
}

function normalizeWorkableJob(job) {
  const company = job.company?.name || job.companyName || job.company || null;
  const location = job.location?.fullLocation || job.fullLocation || [
    job.city,
    job.state,
    job.country
  ].filter(Boolean).join(", ") || normalizeLocations(job.locations);
  return {
    source: "workable",
    source_data: structuredClone(job), updated_at:job.updatedAt ?? null,
    id: job.id || job.shortcode || job.shortlink || job.url || null,
    title: job.title || null,
    company,
    company_slug: job.companySlug || null,
    department: job.department || null,
    function: job.function || null,
    industry: job.industry || null,
    employment_type: job.employment_type || job.employmentType || null,
    experience: job.experience || job.experienceLevel || null,
    location: location || null,
    remote: Boolean(job.telecommuting || job.remote || job.isRemote || job.workplace === "remote"),
    workplace: job.workplace || null,
    publication_date: job.published_on || job.published || job.created_at || null,
    url: job.url || job.shortlink || null,
    application_url: job.application_url || job.applyUrl || null,
    description: plainText(job.description || job.descriptionHtml || job.requirementsHtml || "")
  };
}

function normalizeSmartRecruitersJob(job) {
  const sections = job.jobAd?.sections || {};
  const description = [
    sections.companyDescription?.text,
    sections.jobDescription?.text,
    sections.qualifications?.text,
    sections.additionalInformation?.text
  ].filter(Boolean).join("\n\n");
  return {
    source: "smartrecruiters",
    source_data: structuredClone(job),
    description_status:description ? "captured_full_provider_field" : "missing",
    id: job.id || job.uuid || null,
    title: job.name || null,
    company: job.company?.name || null,
    company_identifier: job.company?.identifier || null,
    ref_number: job.refNumber || null,
    department: job.department?.label || job.department || customFieldValue(job, "Department"),
    function: job.function?.label || job.function || null,
    employment_type: job.typeOfEmployment?.label || job.typeOfEmployment || null,
    experience: job.experienceLevel?.label || job.experienceLevel || null,
    location: job.location?.fullLocation || [
      job.location?.city,
      job.location?.region,
      job.location?.country
    ].filter(Boolean).join(", ") || null,
    remote: Boolean(job.location?.remote),
    hybrid: Boolean(job.location?.hybrid),
    publication_date: job.releasedDate || null,
    url: job.postingUrl || null,
    application_url: job.applyUrl || null,
    description: plainText(description)
  };
}

function matchesJob(job, args, fields) {
  const haystack = fields.map((field) => JSON.stringify(job[field] || "")).join(" ").toLowerCase();
  const query = normalize(args.query);
  const location = normalize(args.location);
  const tags = Array.isArray(args.tags) ? args.tags.map(normalize).filter(Boolean) : [];
  if (query && !haystack.includes(query)) return false;
  if (location && !haystack.includes(location)) return false;
  if (args.remote === true && !String(haystack).includes("remote") && job.remote !== true) return false;
  if (tags.length && !tags.some((tag) => haystack.includes(tag))) return false;
  return true;
}

export function matchesNormalizedJob(job, args) {
  const haystack = JSON.stringify(job).toLowerCase();
  const query = normalize(args.query);
  const location = normalize(args.location);
  if (query && !haystack.includes(query)) return false;
  if (location && !haystack.includes(location)) return false;
  const remoteValues = [job.title, job.description, job.location, job.tags].map(value => JSON.stringify(value || "")).join(" ").toLowerCase();
  if (args.remote === true && job.remote === false) return false;
  if (args.remote === true && job.remote !== true && !remoteValues.includes("remote")) return false;
  if (Array.isArray(args.tags) && args.tags.length && !args.tags.some(tag => haystack.includes(normalize(tag)))) return false;


  return true;
}

function requireArray(value, field) {
  if (!Array.isArray(value)) throw new SourceError(`Missing or malformed ${field} array`, "malformed_response");
  return value;
}

function settledValue(result) {
  if (result.status === "fulfilled") return result.value;
  return { status: "error", error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  return JSON.parse(text);
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json,text/xml,application/xml,text/plain,*/*",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      throw new SourceError(`HTTP ${response.status} from provider`, "http_error", {http_status: response.status, retry_after: response.headers.get("retry-after")});
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function firstSuccessfulText(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      const text = await fetchText(url, { headers: { Accept: "text/xml,application/xml,*/*" } });
      return { text, url };
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`No endpoint succeeded. ${errors.join(" | ")}`);
}

function normalizeRecruiteeLocation(job) {
  if (typeof job.location === "string") return job.location;
  const location = job.location || {};
  return [location.city, location.state, location.country].filter(Boolean).join(", ") || null;
}

function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "");
}

function normalizeSubdomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\.(jobs\.)?personio\.(de|com).*$/i, "")
    .replace(/\.recruitee\.com.*$/i, "")
    .replace(/\/.*$/, "");
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^apply\.workable\.com\//i, "")
    .replace(/^www\.workable\.com\/api\/accounts\//i, "")
    .replace(/\?.*$/, "")
    .replace(/\/.*$/, "");
}

function normalizeSmartRecruitersCompany(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^jobs\.smartrecruiters\.com\//i, "")
    .replace(/^api\.smartrecruiters\.com\/v1\/companies\//i, "")
    .replace(/\/.*$/, "");
}

function normalizeLocations(locations) {
  if (!Array.isArray(locations)) return "";
  return locations
    .map((location) => [
      location.city,
      location.region,
      location.state,
      location.country
    ].filter(Boolean).join(", "))
    .filter(Boolean)
    .join("; ");
}

function customFieldValue(job, label) {
  if (!Array.isArray(job.customField)) return null;
  const field = job.customField.find((item) => normalize(item.fieldLabel) === normalize(label));
  return field?.valueLabel || field?.value || null;
}

function normalizeJobicyGeo(value) {
  const normalized = normalize(value);
  const aliases = {
    germany: "germany",
    deutschland: "germany",
    de: "germany",
    eu: "europe",
    europe: "europe",
    usa: "usa",
    us: "usa",
    "united states": "usa",
    canada: "canada",
    latam: "latam",
    apac: "apac",
    anywhere: "anywhere"
  };
  return aliases[normalized] || normalized;
}

function formatHimalayasLocation(job) {
  const countries = Array.isArray(job.locationRestrictions)
    ? job.locationRestrictions.map((country) => typeof country === "string" ? country : country.name || country.alpha2).filter(Boolean)
    : [];
  const timezones = Array.isArray(job.timezoneRestrictions) ? job.timezoneRestrictions : [];
  if (!countries.length && !timezones.length) return "Worldwide";
  return [countries.join(", "), timezones.length ? `Timezones: ${timezones.join(", ")}` : ""]
    .filter(Boolean)
    .join("; ");
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === "number") {
    const millis = value < 10000000000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  return value;
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function valueOf(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    if ("#text" in value) return String(value["#text"] || "");
    if ("text" in value) return String(value.text || "");
  }
  return "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
