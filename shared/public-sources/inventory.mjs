import { randomUUID } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export class SourceError extends Error {
  constructor(message, code = 'source_error', details = {}) {
    super(message); this.name = 'SourceError'; this.code = code; Object.assign(this, details);
  }
}
export function errorResult(error) {
  return { status: 'error', error: { code: error.code || 'source_error', message: error.message || String(error),
    http_status: error.http_status ?? null, retry_after: error.retry_after ?? null },
    coverage: 'source_limited', jobs: null };
}
export async function requestText(url, { fetchImpl = fetch, timeout = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: {
      'User-Agent': 'public-job-sources-mcp/0.2', Accept: 'application/json,application/xml,text/xml'
    }});
    if (!response.ok) throw new SourceError(`Source returned HTTP ${response.status}`, 'http_error', {
      http_status: response.status, retry_after: response.headers.get('retry-after')
    });
    return await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new SourceError('Source request timed out', 'timeout');
    throw error;
  } finally { clearTimeout(timer); }
}
export function plainText(value) {
  return String(value ?? '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, value) => {
      const code = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : match;
    }).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, key) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[key]))
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function integer(value, fallback, minimum) {
  const n = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(n) || n < minimum) throw new SourceError(`Expected an integer >= ${minimum}`, 'invalid_argument');
  return n;
}
function array(value, label) {
  if (!Array.isArray(value)) throw new SourceError(`Missing or malformed ${label} array`, 'malformed_response');
  return value;
}
function valueOf(value) { return value == null ? '' : typeof value === 'object' ? String(value['#text'] ?? '') : String(value); }
export function publication(value, basis = 'original_publication') {
  if (value === undefined || value === null || value === '') return { raw: null, instant: null, precision: 'unknown', basis };
  if (typeof value === 'number') {
    const date = new Date(value < 1e10 ? value * 1000 : value);
    return { raw: value, instant: Number.isFinite(value) && !isNaN(date.valueOf()) ? date.toISOString() : null,
      precision: Number.isFinite(value) && !isNaN(date.valueOf()) ? 'instant' : 'invalid', basis };
  }
  const text = String(value);
  const aware = /[T ]\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const valid = !isNaN(Date.parse(text));
  return { raw: value, instant: aware && valid ? new Date(text).toISOString() : null,
    precision: aware ? (valid ? 'instant' : 'invalid') : /^\d{4}-\d{2}-\d{2}$/.test(text) ? 'calendar_date' : 'timezone_unconfirmed', basis };
}
export function personioPositions(text) {
  if (XMLValidator.validate(text) !== true) throw new SourceError('Invalid Personio XML', 'malformed_response');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(text);
  const container = parsed?.["workzag-jobs"] ?? parsed?.workzag_jobs ?? parsed?.jobs;
  if (container === undefined) throw new SourceError('Missing Personio jobs root', 'malformed_response');
  if (container && typeof container === 'object' && (container.error || container.errors)) throw new SourceError('Personio returned an error envelope', 'malformed_response');
  const rows = container?.position;
  return rows == null ? [] : Array.isArray(rows) ? rows : [rows];
}
function personioHtml(job) {
  let sections = job.jobDescriptions?.jobDescription;
  if (sections) sections = Array.isArray(sections) ? sections : [sections];
  return sections?.map(s => [valueOf(s.name), valueOf(s.value)].filter(Boolean).join('\n')).join('\n\n') || valueOf(job.description);
}
export function normalizeRecord(source, raw, board = null, feedUrl = null, locale = null) {
  let id, title, company, location, url, html, date, extras = {};
  if (source === 'arbeitnow') {
    ({slug:id,title,company_name:company,location,url,description:html,created_at:date} = raw);
    id ??= raw.id; extras = { remote: raw.remote ?? null, tags: raw.tags ?? [], job_types: raw.job_types ?? [], created_at: date };
  } else if (source === 'remotive') {
    ({id,title,company_name:company,candidate_required_location:location,url,description:html,publication_date:date} = raw);
    extras = {job_type:raw.job_type ?? null, salary:raw.salary ?? null, category:raw.category ?? null};
  } else if (source === 'remoteok') {
    ({id,position:title,company,location,url,description:html,date} = raw);
    date ??= raw.epoch; extras = { tags:raw.tags ?? [], salary_min:raw.salary_min ?? null, salary_max:raw.salary_max ?? null };
  } else if (source === 'himalayas') {
    ({guid:id,title,companyName:company,applicationLink:url,description:html,pubDate:date} = raw);
    const restrictions = raw.locationRestrictions;
    const countries = Array.isArray(restrictions) ? restrictions.map(x => typeof x === 'string' ? x : x?.name || x?.alpha2).filter(Boolean) : null;
    const timezones = raw.timezoneRestrictions;
    location = countries === null ? null : countries.length ? countries.join(', ') : Array.isArray(timezones) && timezones.length ? `Timezones: ${timezones.join(', ')}` : 'Worldwide';
    extras = { locationRestrictions: restrictions ?? null, timezoneRestrictions: timezones ?? null,
      employment_type:raw.employmentType ?? null, employmentType:raw.employmentType ?? null, expiryDate:raw.expiryDate ?? null, pubDate:date ?? null };
  } else if (source === 'themuse') {
    ({id,name:title,contents:html,publication_date:date} = raw); company = raw.company?.name;
    location = raw.locations?.map(x => x.name).join('; '); url = raw.refs?.landing_page;
    extras = {locations:raw.locations ?? [], levels:raw.levels ?? [], categories:raw.categories ?? []};
  } else if (source === 'personio') {
    id=valueOf(raw.id); title=valueOf(raw.name); company=board; location=valueOf(raw.office); url=valueOf(raw.recruitingUrl) || valueOf(raw.url);
    html=personioHtml(raw); date=valueOf(raw.createdAt);
    extras = {board_id:board, schedule:valueOf(raw.schedule), employment_type:valueOf(raw.employmentType),
      employmentType:valueOf(raw.employmentType), seniority:valueOf(raw.seniority), department:valueOf(raw.department), createdAt:date};
    if (!url && /^[1-9][0-9]*$/.test(id) && feedUrl) {
      const feed = new URL(feedUrl);
      if (feed.protocol === 'https:' && !feed.port && !feed.username && !feed.password
          && [board.toLowerCase() + '.jobs.personio.de', board.toLowerCase() + '.jobs.personio.com'].includes(feed.hostname)
          && feed.pathname === '/xml') {
        url = `${feed.origin}/job/${id}`;
        extras.url_basis = 'documented_personio_job_route_native_id';
      }
    }
    extras.url_basis ??= url ? 'provider_url_field' : 'unavailable';
    extras.source_description_locale = locale;
    extras.description_scope = 'personio_xml_configured_job_description_blocks';
    extras.description_context_limit = 'Personio XML excludes the separately configured About us section.';
  } else if (source === 'recruitee') {
    ({id,title,careers_url:url,description:html,created_at:date} = raw); id ??= raw.slug; company=board;
    for (const field of ['description','requirements']) {
      if (raw[field] != null && typeof raw[field] !== 'string') throw new SourceError(`Recruitee ${field} is not text; no full-body claim`, 'malformed_response');
    }
    html = [raw.description, raw.requirements].filter(value => typeof value === 'string' && value.trim()).join('\n\n');
    location=typeof raw.location === 'string' ? raw.location : [raw.location?.city,raw.location?.state,raw.location?.country].filter(Boolean).join(', ');
    extras={board_id:board, employment_type:raw.kind ?? raw.employment_type ?? null,
      description_scope:'recruitee_native_description_and_requirements',
      description_provider_fields:['description','requirements'].filter(field => typeof raw[field] === 'string' && raw[field].trim())};
  } else throw new SourceError('Unsupported source', 'invalid_argument');
  if (html != null && typeof html !== 'string') throw new SourceError('Description field is not text; no full-body claim', 'malformed_response');
  const dateBasis = {
    arbeitnow: 'provider_activity_created_at',
    himalayas: 'provider_last_updated_pubDate',
    personio: 'provider_createdAt',
    recruitee: 'provider_created_at',
  }[source] ?? 'original_publication';
  return {source, id:id == null || id === '' ? null : String(id), title:title ?? null, company:company ?? null,
    location:location || null, url:url || null, ...extras, publication:publication(date, dateBasis),
    description:plainText(html), description_html:String(html ?? ''), description_characters:plainText(html).length, description_html_characters:String(html ?? '').length, description_status:plainText(html) ? 'captured_full_provider_field' : 'missing', source_data:structuredClone(raw)};
}
const BODY_KEYS = new Set(['description','description_html','contents','jobDescriptions','jobDescription','jobExcerpt','requirements','requirementsHtml','descriptionHtml']);
function metadata(value) {
  if (Array.isArray(value)) return value.map(metadata);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !BODY_KEYS.has(k)).map(([k,v]) => [k, metadata(v)]));
  return value;
}
function nextArbeitnow(url) {
  if (url === null) return null;
  const invalid = () => new SourceError('Missing or unexpected Arbeitnow continuation URL', 'invalid_continuation');
  if (typeof url !== 'string') throw invalid();
  const parts = /^https:\/\/www\.arbeitnow\.com\/api\/job-board-api\?page=([1-9]\d*)$/.exec(url);
  if (!parts || !Number.isSafeInteger(Number(parts[1]))) throw invalid();
  return Number(parts[1]);
}
export const inventoryTools = [
  {name:'get_public_inventory',description:'Capture every record in one native page/feed with unmodified source metadata and full descriptions. No keyword or role filtering. Complete current response is not a historical archive. Metadata cards can be followed by snapshot detail retrieval.',inputSchema:{type:'object',properties:{
    source:{type:'string',enum:['arbeitnow','remotive','remoteok','himalayas','themuse','personio','recruitee']},
    page:{type:'integer',minimum:0}, country:{type:'string'}, employment_type:{type:'string'}, location:{type:'string'},
    worldwide:{type:'boolean'}, seniority:{type:'string'}, sort:{type:'string'}, category:{type:'string'}, company:{type:'string'},
    subdomain:{type:'string',pattern:'^[a-zA-Z0-9][a-zA-Z0-9-]*$'}, language:{type:'string',enum:['de','en'],description:'Personio native description locale, not a country, working language or vacancy filter. Default de; retain missing translations and reconcile native IDs across locales.'}, metadata_only:{type:'boolean',default:true}
  },required:['source'],additionalProperties:false}},
  {name:'get_public_job_from_snapshot',description:'Retrieve the full captured description and original metadata without a new provider request. Snapshots are process-local and expire; missing snapshots are explicit errors. A quarantined missing-ID record can be inspected by record_index alone.',inputSchema:{type:'object',properties:{snapshot_id:{type:'string'},source_id:{type:'string'},record_index:{type:'integer',minimum:0}},required:['snapshot_id'],anyOf:[{required:['source_id']},{required:['record_index']}],additionalProperties:false}}
];
export class InventoryClient {
  constructor({fetchImpl=fetch,timeout=15000,ttlMs=1200000,maxBytes=64*1024*1024,clock=Date.now}={}) {
    this.fetchImpl=fetchImpl;this.timeout=timeout;this.ttlMs=ttlMs;this.maxBytes=maxBytes;this.clock=clock;this.snapshots=new Map();
  }
  prune() { for (const [id,entry] of this.snapshots) if (this.clock() >= entry.expires) this.snapshots.delete(id); }
  async inventory(args) {
    const {source}=args; const page=integer(args.page,source==='themuse'?0:1,source==='themuse'?0:1);
    if (args.page !== undefined && !['arbeitnow','himalayas','themuse'].includes(source)) throw new SourceError('This source has no native page argument', 'invalid_argument');
    if (!['arbeitnow','remotive','remoteok','himalayas','themuse','personio','recruitee'].includes(source)) throw new SourceError('Unsupported source', 'invalid_argument');
    if ((args.country || args.employment_type || args.worldwide !== undefined || args.seniority || args.sort) && source !== 'himalayas') throw new SourceError('country/employment_type/worldwide/seniority/sort are Himalayas native filters only','invalid_argument');
    if (args.category && !['remotive','themuse'].includes(source)) throw new SourceError('category is a Remotive/Muse native filter only','invalid_argument');
    if (args.company && source !== 'themuse') throw new SourceError('company is a Muse native filter only','invalid_argument');
    if (args.location && source !== 'themuse') throw new SourceError('location is a Muse native filter only','invalid_argument');
    if (args.subdomain && !['personio','recruitee'].includes(source)) throw new SourceError('subdomain is an employer-board parameter','invalid_argument');
    if (args.language !== undefined && (source !== 'personio' || !['de','en'].includes(args.language))) throw new SourceError('language is a qualified Personio description locale only','invalid_argument');
    if (['personio','recruitee'].includes(source) && !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(args.subdomain || '')) throw new SourceError('Invalid public board subdomain','invalid_argument');
    let url, rows, notices=[], pagination={kind:'current_feed',next:null,total:null}, body;
    if (source==='arbeitnow') url=`https://www.arbeitnow.com/api/job-board-api?page=${page}`;
    if (source==='remotive') {const u=new URL('https://remotive.com/api/remote-jobs');if(args.category)u.searchParams.set('category',args.category);url=u.href;}
    if (source==='remoteok') url='https://remoteok.com/api';
    if (source==='himalayas') { const u=new URL('https://himalayas.app/jobs/api/search');u.searchParams.set('page',String(page));u.searchParams.set('sort',args.sort || 'recent');if(args.country)u.searchParams.set('country',args.country);if(args.employment_type)u.searchParams.set('employment_type',args.employment_type);if(args.worldwide!==undefined)u.searchParams.set('worldwide',String(args.worldwide));if(args.seniority)u.searchParams.set('seniority',args.seniority);url=u.href; }
    if (source==='themuse') { const u=new URL('https://www.themuse.com/api/public/jobs');u.searchParams.set('page',String(page));if(args.location)u.searchParams.set('location',args.location);if(args.category)u.searchParams.set('category',args.category);if(args.company)u.searchParams.set('company',args.company);url=u.href; }
    if (source==='personio') url=`https://${args.subdomain}.jobs.personio.de/xml${args.language ? '?language=' + args.language : ''}`;
    if (source==='recruitee') url=`https://${args.subdomain}.recruitee.com/api/offers/`;
    let text;
    try { text=await requestText(url,this); } catch(error) {
      if (source !== 'personio' || error.http_status !== 404) throw error;
      url=`https://${args.subdomain}.jobs.personio.com/xml${args.language ? '?language=' + args.language : ''}`; text=await requestText(url,this);
    }
    if (source==='personio') {rows=personioPositions(text);body=null;}
    else { try { body=JSON.parse(text); } catch {throw new SourceError('Source did not return valid JSON','malformed_response');} }
    if (source === 'arbeitnow') {
      rows = array(body.data, 'data');
      const observed = body.meta?.current_page ?? body.meta?.page;
      const next = nextArbeitnow(body.links?.next);
      if ((observed !== undefined && observed !== page) || (next !== null && (next !== page + 1 || !rows.length))) {
        throw new SourceError('Arbeitnow returned a different, empty nonterminal, or nonconsecutive page', 'invalid_continuation');
      }
      pagination = {kind:'native_page', page, next:next === null ? null : {page:next}, total:body.meta?.total ?? null, links:body.links};
    }
    if(source==='remotive') {rows=array(body.jobs,'jobs');notices=[body['0-legal-notice']??body['legal-notice']??body.legal_notice??null,'Remotive public feed is delayed by 24 hours; retain attribution and original application links. Review provider reuse terms before redistribution.'].filter(Boolean);}
    if(source==='remoteok') { const entries=array(body,'response'); rows=entries.filter(x=>x&&(x.position||x.id));notices=entries.filter(x=>!x?.position&&!x?.id); }
    if(source==='himalayas') { rows=array(body.jobs,'jobs');const total=body.totalCount??null;const offset=body.offset??(page-1)*20;const limit=body.limit??20;if(!Number.isSafeInteger(limit)||limit<1||offset!==(page-1)*limit||(total!==null&&(!Number.isSafeInteger(total)||total<0)))throw new SourceError('Himalayas page/offset/limit mismatch','invalid_continuation');pagination={kind:'native_page',page,offset,limit,total,next:rows.length&&typeof total==='number'&&offset+rows.length<total?{page:page+1}:null,provider_cursor:body.nextCursor??null};notices=['Attribute Himalayas and retain original application links.',body.comments??body._comments??null].filter(Boolean); }
    if(source==='themuse') {rows=array(body.results,'results');if(body.page!==undefined&&body.page!==page)throw new SourceError('Muse returned another native page','invalid_continuation');pagination={kind:'native_page',page:body.page??page,total:body.total??null,page_count:body.page_count??null,next:typeof body.page_count==='number'&&page+1<body.page_count?{page:page+1}:null};}
    if(source==='recruitee') rows=Array.isArray(body)?body:array(body.offers,'offers');
    const records=rows.map((raw,index)=>({...normalizeRecord(source,raw,args.subdomain??null,url,source==='personio' ? args.language ?? 'de' : null),record_index:index}));
    if (source==='personio') notices.push('The native XML description locale is independent of career-page display language and job working-language requirements. A missing translation is not an empty vacancy. Reconcile IDs across locales; never add locale counts. XML excludes the separately configured About us section.');
    const quarantine=records.filter(x=>!x.id).map(x=>({record_index:x.record_index,reason:'missing_stable_id'}));
    const jobs=records.filter(x=>x.id); const counts=new Map();for(const x of jobs)counts.set(x.id,(counts.get(x.id)??0)+1);
    const duplicate_ids=[...counts].filter(([,n])=>n>1).map(([id,count])=>({id,count}));
    this.prune();const bytes=Buffer.byteLength(JSON.stringify(records));
    if(bytes>this.maxBytes)throw new SourceError('Native response exceeds snapshot memory budget; no records silently discarded','capacity_limit');
    let used=[...this.snapshots.values()].reduce((n,e)=>n+e.bytes,0);while(used+bytes>this.maxBytes&&this.snapshots.size){const first=this.snapshots.keys().next().value;used-=this.snapshots.get(first).bytes;this.snapshots.delete(first);}
    const snapshot_id=randomUUID();const captured_at=new Date(this.clock()).toISOString();const expires=this.clock()+this.ttlMs;
    this.snapshots.set(snapshot_id,{records,source,url,pagination,notices,expires,bytes,captured_at});
    return {source,source_url:url,snapshot_id,captured_at,snapshot_expires_at:new Date(expires).toISOString(),
      raw_count:rows.length,count:jobs.length,quarantine,duplicate_ids,pagination,provider_notices:notices,
      coverage:'complete_native_response',historical_coverage:'not_established',
      jobs:args.metadata_only===false?structuredClone(jobs):jobs.map(metadata)};
  }
  detail({snapshot_id,source_id,record_index}) {
    if (source_id === undefined && record_index === undefined) throw new SourceError('source_id or record_index is required','invalid_argument');
    this.prune();const snapshot=this.snapshots.get(snapshot_id);
    if(!snapshot)throw new SourceError('Snapshot expired, evicted, or belongs to another MCP process','snapshot_unavailable');
    const matches=snapshot.records.filter(x=>(source_id===undefined||x.id===source_id)&&(record_index===undefined||x.record_index===record_index));
    if(matches.length!==1)throw new SourceError(matches.length?'Duplicate source ID: supply record_index':'Source ID not found in snapshot',matches.length?'ambiguous_source_id':'record_not_found');
    return {snapshot_id,captured_at:snapshot.captured_at,source_url:snapshot.url,provider_notices:snapshot.notices,job:structuredClone(matches[0])};
  }
}
