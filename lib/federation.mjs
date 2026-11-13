import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const READ_ONLY = {readOnlyHint:true, destructiveHint:false, openWorldHint:true};
const sharedEgyptTools = new Set(['jobicy_location_taxonomy','read_public_api_jobs',
  'remote_source_capabilities','read_remote_feed','freelance_source_capabilities',
  'read_freelance_projects','read_freelance_project_detail','ats_source_capabilities',
  'read_employer_board','read_employer_job_detail']);
// These are the original audited read-only tools. Newly added backend tools are
// never enabled implicitly, even when a dependency calls itself read-only.
export const ALLOWED = {
  egypt: new Set(['read_source_page','read_source_detail','parse_rendered_board_page',
    'read_saved_board_capture','wuzzuf_work_model_taxonomy','browser_capture_plan',...sharedEgyptTools]),
  ba: new Set(['gehalt_suche','gehalt_regionen','job_suche','job_details','ausbildung_suche',
    'studium_suche','studienfelder','weiterbildung_suche','coaching_suche']),
  stepstone: new Set(['get_capabilities','search_location_page','get_job_details',
    'parse_listing_html','parse_job_html']),
  public_de: new Set(['interamt_capabilities','interamt_read','jobmensa_capabilities','jobmensa_page','jobmensa_detail','student_boards_capabilities','student_board_page','student_board_detail','student_board_resolve_external','german_boards_capabilities','german_board_inventory','german_board_detail','german_board_capture_segment','meinpraktikum_inventory','meinpraktikum_detail','organisation_directory','handwerk_inventory','handwerk_detail','state_portal_inventory','state_portal_detail','aubiplus_inventory','aubiplus_detail','gulp_inventory','gulp_detail','ausbildung_inventory','ausbildung_detail']),
  public: new Set(['get_public_inventory','get_public_job_from_snapshot','search_public_jobs',
    'startupmap_capabilities','startupmap_directory','startupmap_city_jobs','startupmap_company',
    'workday_capabilities','workday_inventory','workday_detail',
    'teamtailor_capabilities','teamtailor_inventory','teamtailor_detail',
    'dvinci_capabilities','dvinci_inventory','dvinci_detail',
    'onlyfy_capabilities','onlyfy_inventory','onlyfy_detail',
    'jobshop_capabilities','jobshop_inventory','jobshop_detail',
    'successfactors_capabilities','successfactors_inventory','successfactors_detail',
    'oracle_capabilities','oracle_inventory','oracle_detail',
    'personio_detail','ror_release','ror_directory',
    'search_arbeitnow','search_remotive','search_remoteok','search_jobicy','search_himalayas',
    'search_themuse','detect_company_ats','fetch_company_ats_jobs','search_workable','fetch_workable_jobs',
    'fetch_smartrecruiters_jobs','fetch_personio_jobs','fetch_recruitee_jobs']),
};

export function publicName(backend, name) {
  const prefix = backend==='egypt' ? (sharedEgyptTools.has(name)?'shared':'eg')
    : backend==='ba'?'de_ba':backend==='stepstone'?'de_stepstone':backend==='public_de'?'de_public':'shared';
  return `${prefix}_${name}`;
}

export function backendSpecs(env=process.env) {
  const python=env.JOB_MARKET_PYTHON || env.EGYPT_JOBS_PYTHON || 'python3';
  const pythonPaths=[path.join(ROOT,'packages/source-adapters/src'),path.join(ROOT,'countries/de/stepstone'),env.PYTHONPATH].filter(Boolean);
  const runtimeNames=['PATH','HOME','SYSTEMROOT','TMPDIR','TEMP','TMP','LANG','LC_ALL',
    'HTTPS_PROXY','HTTP_PROXY','NO_PROXY'];
  const childEnv=Object.fromEntries(runtimeNames.filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]));
  Object.assign(childEnv,{EGYPT_JOBS_PYTHON:python,PYTHONPATH:pythonPaths.join(path.delimiter)});
  const scoped=names=>({...childEnv,...Object.fromEntries(names.filter(k=>typeof env[k]==='string').map(k=>[k,env[k]]))});
  const js=(p,names=[])=>({command:process.execPath,args:[path.join(ROOT,p)],env:scoped(names),cwd:ROOT,stderr:'pipe'});
  return {
    egypt:js('countries/eg/mcp/index.mjs',['EGYPT_JOBS_CAPTURE_DIR','THEMUSE_API_KEY','UPWORK_ACCESS_TOKEN']),
    ba:js('countries/de/arbeitsmarkt/src/index.js'),
    public_de:js('countries/de/public-services/server.mjs',['INTERAMT_API_BASE','INTERAMT_API_KEY','JOB_MARKET_CAPTURE_DIR']),
    stepstone:{command:python,args:['-m','stepstone_mcp.server'],env:scoped(['STEPSTONE_HTTP_BACKEND']),cwd:ROOT,stderr:'pipe'},
    public:js('shared/public-sources/index.mjs',['THEMUSE_API_KEY','JOBFLOW_PUBLIC_JOBS_TIMEOUT_MS','JOBFLOW_PUBLIC_JOBS_USER_AGENT','JOB_MARKET_CAPTURE_DIR']),
  };
}

export async function loadRegistry() {
  const registry=JSON.parse(await readFile(new URL('../sources.json',import.meta.url),'utf8'));
  validateRegistry(registry);
  return registry;
}

export function validateRegistry(registry) {
  const ids=new Set();
  const states=new Set(['implemented','access_limited','external_connector','requires_employer_seed',
    'research_required','credential_required','context_only']);
  for(const source of registry.sources) {
    if(!/^[a-z][a-z0-9_]*$/.test(source.id)||ids.has(source.id)) throw new Error('Duplicate/invalid source ID');
    ids.add(source.id);
    if(!source.name||!states.has(source.status)||!source.countries?.length||!source.references?.length||!source.limits?.length)
      throw new Error(`Incomplete source contract: ${source.id}`);
    for(const country of source.countries) if(!['EG','DE','*'].includes(country)) throw new Error('Unknown country');
    for(const reference of source.references) if(new URL(reference).protocol!=='https:') throw new Error('References must be HTTPS');
    for(const route of source.routes??[]) {
      if(!ALLOWED[route.backend]?.has(route.tool)) throw new Error(`Unapproved route for ${source.id}`);
    }
    if(['implemented','requires_employer_seed'].includes(source.status)&&!source.routes?.length)
      throw new Error(`Implemented source has no route: ${source.id}`);
  }
  for(const country of registry.countries) if(!['EG','DE'].includes(country.code)) throw new Error('Unknown country');
  return registry;
}

export function countrySources(registry,country) {
  const code=country.toUpperCase();
  if(!registry.countries.some(c=>c.code===code)) throw new Error('Supported countries: EG, DE');
  return registry.sources.filter(s=>s.countries.includes(code)||s.countries.includes('*'));
}

export function scanPlan(registry,{country,from,to,geography}) {
  if(![from,to].every(v=>typeof v==='string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))) || Date.parse(from)>=Date.parse(to))
    throw new Error('Provide an ordered, offset-aware [from,to) interval');
  if(typeof geography!=='string'||!geography.trim()) throw new Error('Explicit geography is required');
  const sources=countrySources(registry,country);
  return {country:country.toUpperCase(),window:{from,to,semantics:'[from,to)'},geography,
    status:'plan_only',coverage_complete:false,reviewed_by_model:false,
    source_partitions:sources.filter(s=>s.status!=='context_only'),
    context_sources:sources.filter(s=>s.status==='context_only'),
    unresolved_sources:sources.filter(s=>['research_required','credential_required','external_connector'].includes(s.status)).map(s=>s.id),
    procedure:['Inspect current source capabilities and access terms before acquisition.',
      'Enumerate native geography/model partitions without an implicit role, title or skill filter.',
      'Save exact native responses privately, follow real continuation and reconcile duplicate/changed IDs.',
      'Hydrate every retained full description; keep original, updated, expiry and observation times distinct.',
      'Verify original interval membership; quarantine unknown clocks instead of inventing instants.',
      'Report every missing partition and access limit. Acquisition and native exhaustion are not full-market coverage.'],
    limits:registry.limits};
}

function failure(code,message) {
  const data={status:'source_limited',code,message,coverage_complete:false,reviewed_by_model:false};
  return {isError:true,structuredContent:data,content:[{type:'text',text:JSON.stringify(data)}]};
}

export class Federation {
  constructor({specs=backendSpecs(),connect,requestTimeoutMs=60000}={}) {
    this.specs=specs;this.requestTimeoutMs=requestTimeoutMs;
    this.connect=connect??(async(id,spec)=>{
      const client=new Client({name:'job-market-mcp',version:'0.4.0'});
      const transport=new StdioClientTransport(spec);
      // Drain backend diagnostics without forwarding possible provider/private data.
      transport.stderr?.on('data',()=>{});
      try {await client.connect(transport,{timeout:15000});return client;}
      catch(error){await client.close().catch(()=>{});throw error;}
    });
    this.clients=new Map();this.routes=new Map();this.status=new Map();
    this.pending=new Map();this.closed=false;
  }
  async start(id) {
    if(this.closed) throw new Error('Federation closed');
    if(!this.specs[id]||!ALLOWED[id]) throw new Error('Unknown backend');
    if(this.clients.has(id))return this.clients.get(id);
    if(this.pending.has(id))return this.pending.get(id);
    const promise=(async()=>{
      let client;
      try {
        client=await this.connect(id,this.specs[id]);
        if(this.closed){await client.close();throw new Error('Federation closed');}
        const tools=[];let cursor;const seen=new Set();
        do {
          const result=await client.listTools(cursor?{cursor}:{});
          tools.push(...result.tools);
          cursor=result.nextCursor;
          if(cursor&&seen.has(cursor))throw new Error('Repeated backend tool cursor');
          if(cursor)seen.add(cursor);
        }while(cursor);
        const routes=[];
        for(const tool of tools) {
          if(!ALLOWED[id].has(tool.name))continue;
          if(tool.annotations?.destructiveHint===true||tool.annotations?.readOnlyHint===false)
            throw new Error('Backend read-only contract changed');
          const name=publicName(id,tool.name);
          if(this.routes.has(name)||routes.some(([n])=>n===name))throw new Error('Duplicate tool name');
          routes.push([name,{backend:id,native:tool.name,descriptor:{...tool,name,annotations:{...tool.annotations,...READ_ONLY}}}]);
        }
        for(const [name,route] of routes)this.routes.set(name,route);
        this.clients.set(id,client);this.status.set(id,{state:'ready',tools:routes.length});
        return client;
      }catch(error){
        if(client)await client.close().catch(()=>{});
        this.status.set(id,{state:'unavailable',tools:0,reason:'Backend could not initialize; check installed runtime/dependencies locally.'});
        throw error;
      }finally{this.pending.delete(id);}
    })();
    this.pending.set(id,promise);return promise;
  }
  async initialize() {await Promise.allSettled(Object.keys(this.specs).map(id=>this.start(id)));return this;}
  tools() {return [...this.routes.values()].map(r=>r.descriptor);}
  health() {return Object.fromEntries(this.status);}
  async call(name,args={}) {
    const route=this.routes.get(name);
    if(!route)return failure('unknown_or_unavailable_tool','Tool is not in the audited active catalogue.');
    const client=this.clients.get(route.backend);
    try {
      let result=await client.callTool({name:route.native,arguments:args},undefined,{timeout:this.requestTimeoutMs});
      if(!result.structuredContent && result.content?.length===1 && result.content[0].type==='text'){
        try{const data=JSON.parse(result.content[0].text);
          if(data && typeof data==='object' && !Array.isArray(data))result={...result,structuredContent:data};
        }catch{/* Native prose remains prose; no invented record structure. */}
      }
      if(result.isError && !result.structuredContent)result={...result,structuredContent:{
        status:'source_limited',code:'backend_error',coverage_complete:false,reviewed_by_model:false}};
      // Do not slice descriptions to fit a protocol message. Preserve native
      // errors and content; provenance does not upgrade coverage or review.
      if(Buffer.byteLength(JSON.stringify(result),'utf8')>9*1024*1024)
        return failure('response_too_large','Complete native result exceeds the MCP message bound; use the source CLI to preserve it privately.');
      return result;
    }catch{return failure('backend_call_failed','Source call failed or timed out; acquisition remains incomplete.');}
  }
  async close() {
    this.closed=true;
    await Promise.allSettled([...this.pending.values()]);
    await Promise.allSettled([...this.clients.values()].map(c=>c.close()));
    this.clients.clear();this.routes.clear();
  }
}
