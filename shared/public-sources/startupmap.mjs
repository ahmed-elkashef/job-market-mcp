import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {plainText} from './inventory.mjs';

const ORIGIN = 'https://startupmap.one';
const AGENT = 'job-market-mcp';
const USER_AGENT = `${AGENT}/0.4 public-source-reader`;
const MAX_BYTES = 5 * 1024 * 1024;
const COMPANY_PATH = /^\/startup\/[A-Za-z0-9_.-]+$/;
const geographicPath = (pathname,prefix) => {
  if (!pathname.startsWith(prefix) || pathname.slice(prefix.length).includes('/')) return false;
  try {return /^[\p{L}\p{N}-]+$/u.test(decodeURIComponent(pathname.slice(prefix.length)));}
  catch {return false;}
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const object = properties => ({type:'object', properties, additionalProperties:false});
const annotations = {readOnlyHint:true, destructiveHint:false, openWorldHint:true};
export const startupmapTools = [
  {name:'startupmap_capabilities', annotations, inputSchema:object({}),
    description:'Offline StartupMap public HTML/sitemap contracts and limits. No official StartupMap API, account access, applications or provider calls.'},
  {name:'startupmap_directory', annotations, inputSchema:{...object({
    kind:{type:'string',enum:['cities','companies']}, offset:{type:'integer',minimum:0,default:0},
    limit:{type:'integer',minimum:1,maximum:500,default:100},
    snapshot_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'}
  }),required:['kind']},
    description:'Read complete native StartupMap public sitemap into an immutable private cache, then return exact directory segments. Cities are the intersection of native map and unfiltered city-job routes. Companies are directory entries, not vacancies. Follow next_request with its snapshot hash. No role, skill, stage or personalised filters; no country/week coverage claim.'},
  {name:'startupmap_city_jobs', annotations, inputSchema:{...object({city_url:{type:'string',maxLength:256}}),required:['city_url']},
    description:'Read an exact sitemap-discovered unfiltered StartupMap city jobs HTML page. Preserve every visible primary role occurrence, company link, reported count and separately truncated JSON-LD. Titles are metadata, not full descriptions or stable vacancy IDs. No original publication dates, personalized matches, private APIs or applications.'},
  {name:'startupmap_company', annotations, inputSchema:{...object({company_url:{type:'string',maxLength:256}}),required:['company_url']},
    description:'Read an exact sitemap-discovered StartupMap company HTML page, public business facts, full company text and all visible native role IDs/titles. Apply query links are retained only as unfetched references. No job description, verified location, original publication date, account/profile change or application is inferred.'}
];

export function resourceUrl(value, kind) {
  if (typeof value !== 'string' || value.length > 256) throw new Error('invalid_public_resource_url');
  const u = new URL(value);
  if (u.origin !== ORIGIN || u.username || u.password || u.port || u.search || u.hash
      || u.href !== value || !(kind==='city'?geographicPath(u.pathname,'/jobs/'):COMPANY_PATH.test(u.pathname))) throw new Error('invalid_public_resource_url');
  return u.href;
}

/** RFC-style longest matching rule; specific crawler groups supersede '*'. */
export function robotsAllows(text, pathname) {
  const groups=[]; let current=null, rulesStarted=false;
  for (const raw of text.split(/\r?\n/)) {
    const line=raw.replace(/#.*/, '').trim(); if (!line) continue;
    const i=line.indexOf(':'); if (i<0) continue;
    const key=line.slice(0,i).toLowerCase(), value=line.slice(i+1).trim();
    if (key==='user-agent') {
      if (!current || rulesStarted) {current={agents:[],rules:[]};groups.push(current);rulesStarted=false;}
      current.agents.push(value.toLowerCase());
    } else if (current && ['allow','disallow'].includes(key)) {
      rulesStarted=true; if (value) current.rules.push({allow:key==='allow',value});
    } else if (current && key==='crawl-delay' && Number(value)>0) {
      // No silent rapid traversal when a provider adds an explicit pacing rule.
      current.delay=Number(value);
    }
  }
  const rank=g=>Math.max(-1,...g.agents.map(a=>a==='*'?0:AGENT.includes(a)?a.length:-1));
  const best=Math.max(-1,...groups.map(rank));
  if (best<0) throw new Error('robots_user_agent_policy_missing');
  const selected=groups.filter(g=>rank(g)===best);
  if (selected.some(g=>g.delay)) throw new Error('robots_crawl_delay_requires_operator_pacing');
  const matches=selected.flatMap(g=>g.rules).filter(r=>{
    const end=r.value.endsWith('$');
    const source=(end?r.value.slice(0,-1):r.value).split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    return new RegExp('^'+source+(end?'$':'')).test(pathname);
  }).sort((a,b)=>b.value.replace(/[*$]/g,'').length-a.value.replace(/[*$]/g,'').length || Number(b.allow)-Number(a.allow));
  return !matches.length || matches[0].allow;
}

export async function boundedGet(url, fetchImpl=fetch) {
  const r=await fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(20000),credentials:'omit',
    headers:{'user-agent':USER_AGENT,accept:'text/html,application/xml,text/plain'}});
  if (r.status!==200) {
    const e=new Error(`public_http_${r.status}`);e.http_status=r.status;e.retry_after=r.headers.get('retry-after');throw e;
  }
  if (Number(r.headers.get('content-length'))>MAX_BYTES) throw new Error('complete_response_exceeds_bound');
  const chunks=[]; let size=0;
  try {for await (const chunk of r.body) {size+=chunk.length;if(size>MAX_BYTES)throw new Error('complete_response_exceeds_bound');chunks.push(chunk);}}
  catch(e){await r.body?.cancel().catch(()=>{});throw e;}
  const bytes=Buffer.concat(chunks);
  return {bytes,text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),sha256:digest(bytes),content_type:r.headers.get('content-type')};
}

export function parseSitemap(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text)!==true) throw new Error('invalid_complete_sitemap');
  const data=new XMLParser({ignoreAttributes:false,parseTagValue:false,isArray:n=>n==='url'}).parse(text);
  if (!data.urlset || data.urlset['@_xmlns']!=='http://www.sitemaps.org/schemas/sitemap/0.9'
      || !Array.isArray(data.urlset.url) || !data.urlset.url.length) throw new Error('sitemap_urlset_required');
  const urls=data.urlset.url.map(row=>{
    if (typeof row.loc!=='string') throw new Error('sitemap_location_missing');
    const u=new URL(row.loc);
    if (u.origin!==ORIGIN || u.username || u.password || u.search || u.hash) throw new Error('sitemap_nonpublic_location');
    return {url:u.href,lastmod:row.lastmod??null};
  });
  if (new Set(urls.map(r=>r.url)).size!==urls.length) throw new Error('duplicate_sitemap_locations');
  // Provider IDs are case-sensitive and can contain dots or hyphens. Refuse an
  // unknown company contract rather than silently losing directory entries.
  const companies=urls.filter(r=>new URL(r.url).pathname.startsWith('/startup/'));
  if(companies.some(r=>!COMPANY_PATH.test(new URL(r.url).pathname))) throw new Error('unrecognized_company_directory_route');
  const maps=new Set(urls.filter(r=>geographicPath(new URL(r.url).pathname,'/map/')).map(r=>new URL(r.url).pathname.split('/')[2]));
  return {total_sitemap_entries:urls.length,
    cities:urls.filter(r=>geographicPath(new URL(r.url).pathname,'/jobs/')&&maps.has(new URL(r.url).pathname.split('/')[2])),
    companies};
}

const list=x=>x===undefined?[]:Array.isArray(x)?x:[x];
const nodeText=x=>typeof x==='string'?x:typeof x==='object'?x?.['#text']??'':'';
export function parsePublicPage(text, url, kind) {
  const sections=[...text.matchAll(/<section\b[^>]*class="sm-seo"[^>]*>([\s\S]*?)<\/section>/g)];
  if (sections.length!==1) throw new Error('complete_public_html_section_missing');
  const fragment=sections[0][0];
  if (/<!DOCTYPE|<!ENTITY/i.test(fragment) || XMLValidator.validate(fragment)!==true) throw new Error('public_section_structure_changed');
  const canonicals=[...text.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
  if (canonicals.length!==1 || canonicals[0][1]!==url) throw new Error('public_canonical_mismatch');
  const section=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:true}).parse(fragment).section;
  const heading=plainText(nodeText(section.h1));
  if (!heading) throw new Error('public_heading_missing');
  const schemas=[];
  for (const m of text.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const data=JSON.parse(m[1]);schemas.push(...list(data?.['@graph']??data));
  }
  const primary=list(section.ul);
  if (primary.length>1) throw new Error('ambiguous_primary_role_list');
  const rows=list(primary[0]?.li);
  const reported = kind==='city'
    ? String(nodeText(list(section.p)[0])).match(/^([\d,]+) live startup roles\b/)
    : String(nodeText(section.h2)).match(/^Open roles at .+ \(([\d,]+)\)$/);
  const explicitEmpty=kind==='company' && !section.h2 && !rows.length
    && list(section.p).some(p=>nodeText(p)==='No open roles listed right now.');
  if (!reported && !explicitEmpty) throw new Error('native_role_count_missing');
  const reportedCount=explicitEmpty?0:Number(reported[1].replaceAll(',',''));
  const roles=rows.map((row,index)=>{
    const links=list(row.a);
    if (kind==='company' && links.length===0 && String(nodeText(row)).trim()) {
      return {occurrence:index+1,native_label:String(nodeText(row)).trim(),native_role_id:null,company_url:url,
        unfetched_action_reference:null,location_label:row.span?String(nodeText(row.span)):null,
        description_status:'not_in_public_html',original_publication:null};
    }
    if (links.length!==1) throw new Error('native_role_link_structure_changed');
    const protectedPlaceholder=links[0]?.span?.['@_class']==='__cf_email__';
    const label=plainText(protectedPlaceholder?nodeText(links[0].span):nodeText(links[0])), href=links[0]['@_href'];
    if (!label || typeof href!=='string') throw new Error('native_role_metadata_missing');
    const target=new URL(href,ORIGIN);let id=null;
    if (kind==='city') resourceUrl(target.href,'company');
    else {
      if (target.origin!==ORIGIN || target.pathname!==new URL(url).pathname || target.hash
          || [...target.searchParams.keys()].join(',')!=='apply') throw new Error('native_role_reference_changed');
      id=target.searchParams.get('apply');
      if (!/^[\p{L}\p{M}\p{N}_.-]{1,512}$/u.test(id)) throw new Error('invalid_native_role_id');
    }
    return {occurrence:index+1,native_label:label,native_role_id:id,
      native_label_is_protected_placeholder:protectedPlaceholder,
      company_url:kind==='city'?target.href:url,
      unfetched_action_reference:kind==='company'?target.href:null,
      location_label:row.span?String(nodeText(row.span)):null,
      description_status:'not_in_public_html',original_publication:null};
  });
  // Preserve mismatches as a source limitation, never an empty/complete inventory.
  if (roles.length!==reportedCount) throw new Error(`native_role_count_mismatch_${reportedCount}_${roles.length}`);
  // The site-wide publisher Organization is separate from this page's company.
  const organization=schemas.filter(x=>x?.['@type']==='Organization' && x.name===heading && x.location?.address?.addressCountry);
  if (kind==='company' && organization.length!==1) throw new Error('company_identity_mismatch');
  return {kind:kind==='city'?'city_role_metadata':'company_and_role_metadata',url,heading,
    full_public_text:plainText(fragment),public_section_sha256:digest(fragment),
    company:kind==='company'?organization[0]:null,source_json_ld:schemas,
    reported_role_count:reportedCount,returned_count:roles.length,roles,native_visible_list_complete:true,native_empty_state_verified:explicitEmpty,
    source_json_ld_is_complete_role_list:false,full_job_descriptions_available:false,
    original_publication_dates_available:false,national_or_historical_coverage:false};
}

export const startupmapCapabilities = {
  status:'ok',source:'startupmap',implementation:'independent_public_HTML_adapter',official_api:false,
  routes:['/robots.txt','/sitemap.xml','/map/germany','/jobs/{sitemap city}','/startup/{sitemap company}'],
  excluded:['/api','/admin','/settings','/matches','account/profile operations','application action links'],
  limits:['Public metadata and company text only; employer originals are needed for full job descriptions.',
    'The dynamic /jobs UI and personalized matches are not reproduced by this adapter.',
    'A public sitemap or matching page count is not complete national, historical-week or applicant-fit coverage.',
    'Sitemap lastmod is not a job publication date. City occurrences have no verified stable vacancy ID.',
    'Company headquarters and portal location labels do not prove actual role worksite or hybrid eligibility.'],
  coverage_complete:false,reviewed_by_model:false
};

export async function startupmap(name,args={}, {fetchImpl=fetch,cacheDir=process.env.JOB_MARKET_CAPTURE_DIR}={}) {
  const base={source:'startupmap',coverage_complete:false,reviewed_by_model:false};
  try {
    const tool=startupmapTools.find(t=>t.name===name);
    if (!tool || !args || typeof args!=='object' || Array.isArray(args)
        || Object.keys(args).some(k=>!Object.hasOwn(tool.inputSchema.properties,k))) throw new Error('invalid_read_arguments');
    if (name==='startupmap_capabilities') return structuredClone(startupmapCapabilities);
    let url;
    if (name==='startupmap_directory') {
      if (!['cities','companies'].includes(args.kind) || !Number.isSafeInteger(args.offset??0) || (args.offset??0)<0
          || args.offset===null || !Number.isSafeInteger(args.limit??100) || (args.limit??100)<1 || (args.limit??100)>500 || args.limit===null
          || args.snapshot_sha256!==undefined && (typeof args.snapshot_sha256!=='string' || !/^[a-f0-9]{64}$/.test(args.snapshot_sha256))
          || (args.offset??0)>0 && !args.snapshot_sha256) throw new Error('exact_snapshot_segment_required');
      if (!cacheDir || !path.isAbsolute(cacheDir)) throw new Error('private_capture_directory_required');
    } else url=resourceUrl(args[name==='startupmap_city_jobs'?'city_url':'company_url'],name==='startupmap_city_jobs'?'city':'company');
    let map, snapshot;
    if (name==='startupmap_directory' && args.snapshot_sha256) {
      const bytes=await readFile(path.join(cacheDir,'startupmap',`${args.snapshot_sha256}.xml`));
      if (digest(bytes)!==args.snapshot_sha256) throw new Error('cached_sitemap_digest_mismatch');
      map=parseSitemap(new TextDecoder('utf-8',{fatal:true}).decode(bytes));snapshot=args.snapshot_sha256;
    } else {
      const robots=await boundedGet(`${ORIGIN}/robots.txt`,fetchImpl);
      for (const p of ['/sitemap.xml',...(url?[new URL(url).pathname]:[])]) if(!robotsAllows(robots.text,p)) throw new Error('robots_denies_public_resource');
      const sitemap=await boundedGet(`${ORIGIN}/sitemap.xml`,fetchImpl);map=parseSitemap(sitemap.text);snapshot=sitemap.sha256;
      if (name==='startupmap_directory') {
        const dir=path.join(cacheDir,'startupmap');await mkdir(dir,{recursive:true,mode:0o700});
        const target=path.join(dir,`${snapshot}.xml`);
        try {await writeFile(target,sitemap.bytes,{flag:'wx',mode:0o600});}
        catch(e){if(e.code!=='EEXIST')throw e;if(digest(await readFile(target))!==snapshot)throw new Error('cached_sitemap_digest_mismatch');}
      }
    }
    if (name==='startupmap_directory') {
      const entries=map[args.kind],offset=args.offset??0,limit=args.limit??100;
      if(offset>entries.length)throw new Error('directory_offset_out_of_range');
      const rows=entries.slice(offset,offset+limit),next=offset+rows.length;
      return {...base,status:'ok',kind:`${args.kind}_directory`,snapshot_sha256:snapshot,
        total_sitemap_entries:map.total_sitemap_entries,directory_count:entries.length,offset,returned_count:rows.length,
        entries:rows,next_request:next<entries.length?{kind:args.kind,offset:next,limit,snapshot_sha256:snapshot}:null,
        native_directory_exhausted:next===entries.length,lastmod_basis:'sitemap_page_modification_not_job_publication',observed_at:new Date().toISOString()};
    }
    const collection=name==='startupmap_city_jobs'?map.cities:map.companies;
    if(!collection.some(r=>r.url===url))throw new Error('resource_not_in_native_sitemap_directory');
    const response=await boundedGet(url,fetchImpl);
    return {...base,status:'ok',...parsePublicPage(response.text,url,name==='startupmap_city_jobs'?'city':'company'),
      response_sha256:response.sha256,sitemap_sha256:snapshot,observed_at:new Date().toISOString()};
  } catch(e) {return {...base,status:'source_limited',returned_count:null,source_result_count:null,
    error:e.message,http_status:e.http_status??null,retry_after:e.retry_after??null};}
}
