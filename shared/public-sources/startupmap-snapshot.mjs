import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,open,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {boundedGet,robotsAllows,parseSitemap,parsePublicPage,resourceUrl} from './startupmap.mjs';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {plainText} from './inventory.mjs';

const ORIGIN='https://startupmap.one';
const sha=x=>createHash('sha256').update(x).digest('hex');
const annotations={readOnlyHint:true,destructiveHint:false,openWorldHint:true};
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const snapshotId={type:'string',pattern:'^[a-f0-9]{32}$'};
export const startupmapSnapshotTools=[
 {name:'startupmap_country',annotations,inputSchema:obj({country:{type:'string',enum:['DE']}},['country']),
  description:'Read the native public Germany country map: all published city memberships and exact country counts, separately from its capped featured/hiring company list. This is provider company geography, not verified job worksites. No private API, role query or account operation.'},
 {name:'startupmap_snapshot_begin',annotations,inputSchema:obj({country:{type:'string',enum:['DE']}},['country']),
  description:'Freeze the complete native public company sitemap plus the Germany country map in a new immutable snapshot. To avoid losing foreign-headquartered employers with German roles, all company partitions are retained before geography review. Requires private JOB_MARKET_CAPTURE_DIR. Starts no monitor, account operation or application.'},
 {name:'startupmap_snapshot_collect',annotations,inputSchema:obj({snapshot_id:snapshotId,offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:10,default:5}},['snapshot_id','offset']),
  description:'Read one bounded sequential batch of public company partitions from an exact frozen StartupMap snapshot. Cache every full company page projection and all native role metadata; reconcile advertised counts and explicit empty states. Completed batches replay without provider reads. Failed partitions remain explicit and independent ones continue. Never imply that job descriptions or original dates were obtained.'},
 {name:'startupmap_snapshot_retry',annotations,inputSchema:obj({snapshot_id:snapshotId,company_index:{type:'integer',minimum:0}},['snapshot_id','company_index']),
  description:'Retry one previously failed public company partition in the same snapshot under current robots and source policy. No arbitrary URL, fallback endpoint, automatic retry loop or private API.'},
 {name:'startupmap_snapshot_read',annotations,inputSchema:obj({snapshot_id:snapshotId,kind:{type:'string',enum:['summary','companies','roles']},view_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},offset:{type:'integer',minimum:0,default:0},limit:{type:'integer',minimum:1,maximum:200,default:100}},['snapshot_id','kind']),
  description:'Read saved native StartupMap snapshot metadata, exact counts, unresolved partitions or source-exact company/role segments without network. Role rows include native IDs, portal location labels, company HQ as separate facts and current-snapshot first observation; no invented original publication or Germany worksite. Full provider/national history is not inferred from a public sitemap.'}
];
const arr=x=>x===undefined?[]:Array.isArray(x)?x:[x];
const txt=x=>typeof x==='string'?x:x?.['#text']??'';
export function parseCountry(text) {
 const matches=[...text.matchAll(/<section\b[^>]*class="sm-seo"[^>]*>[\s\S]*?<\/section>/g)];
 if(matches.length!==1||XMLValidator.validate(matches[0][0])!==true)throw Error('country_public_section_missing_or_changed');
 const section=new XMLParser({ignoreAttributes:false,parseTagValue:false}).parse(matches[0][0]).section;
 if(txt(section.h1)!=='Startups in Germany'||!text.includes('href="https://startupmap.one/map/germany"'))throw Error('country_identity_mismatch');
 const intro=txt(arr(section.p)[0]);
 const counts=intro.match(/^([\d,]+) curated startups in Germany, spread over ([\d,]+) cities, ([\d,]+) hiring right now across ([\d,]+) open roles\./);
 if(!counts)throw Error('country_native_counts_missing');
 const [company_count,city_count,hiring_company_count,open_role_count]=counts.slice(1).map(x=>Number(x.replaceAll(',','')));
 const lists=arr(section.ul);if(lists.length!==2)throw Error('country_native_lists_changed');
 const cities=arr(lists[0].li).map(row=>{
  const a=arr(row.a);if(a.length!==1)throw Error('country_city_link_changed');
  const label=plainText([txt(a[0]),...arr(a[0].span).map(txt)].join('')),href=a[0]['@_href'];const u=new URL(href,ORIGIN);
  if(u.origin!==ORIGIN||u.search||u.hash||!/^\/map\/[^/]+$/.test(u.pathname))throw Error('country_city_route_changed');
  const m=label.match(/^(.*?)\s*—\s*([\d,]+) startups?(?:\s*·\s*([\d,]+) open)?$/);
  if(!m)throw Error('country_city_counts_missing');
  return {name:m[1],url:u.href,company_count:Number(m[2].replaceAll(',','')),open_role_count:m[3]?Number(m[3].replaceAll(',','')):null};
 });
 if(cities.length!==city_count||new Set(cities.map(x=>x.url)).size!==cities.length)throw Error('country_city_count_mismatch');
 const city_company_total=cities.reduce((n,x)=>n+x.company_count,0);
 const displayed_companies=arr(lists[1].li).map(row=>{const a=arr(row.a);if(a.length!==1)throw Error('country_company_link_changed');return {label:plainText(txt(a[0])),url:resourceUrl(new URL(a[0]['@_href'],ORIGIN).href,'company')};});
 return {country:'DE',url:ORIGIN+'/map/germany',company_count,city_count,hiring_company_count,open_role_count,cities,city_company_total,
  city_company_counts_reconciled:city_company_total===company_count,unreconciled_company_count:company_count-city_company_total,
  displayed_companies,displayed_company_count:displayed_companies.length,company_list_is_complete:displayed_companies.length===hiring_company_count,
  geography_basis:'provider_company_country_and_city_not_verified_job_workplace',full_public_text:plainText(matches[0][0])};
}
async function policy(fetchImpl,paths){const r=await boundedGet(ORIGIN+'/robots.txt',fetchImpl);for(const p of paths)if(!robotsAllows(r.text,p))throw Error('robots_denies_public_resource');return r.sha256;}
async function countryRead(fetchImpl){await policy(fetchImpl,['/map/germany']);const r=await boundedGet(ORIGIN+'/map/germany',fetchImpl);return {...parseCountry(r.text),response_sha256:r.sha256};}
async function atomic(file,data){const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(data)+'\n',{flag:'wx',mode:0o600});await rename(tmp,file);}
function location(cacheDir,id){if(!cacheDir||!path.isAbsolute(cacheDir))throw Error('private_capture_directory_required');if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id))throw Error('invalid_snapshot_id');return path.join(cacheDir,'startupmap','snapshots',id);}
async function load(dir){const m=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));const bytes=await readFile(path.join(dir,'sitemap.xml'));if(sha(bytes)!==m.sitemap_sha256)throw Error('snapshot_sitemap_digest_mismatch');const data=parseSitemap(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(data.companies.length!==m.company_count)throw Error('snapshot_company_count_changed');return {manifest:m,companies:data.companies};}
function summary(m){return {snapshot_id:m.snapshot_id,sitemap_sha256:m.sitemap_sha256,country:m.country,capture_started_at:m.capture_started_at,capture_updated_at:m.capture_updated_at,company_count:m.company_count,collected_partitions:m.offset,successful_partitions:Object.keys(m.records).length,failed_partitions:Object.values(m.errors),all_company_partitions_processed:m.offset===m.company_count,accessible_public_directory_exhausted:m.offset===m.company_count&&!Object.keys(m.errors).length,provider_or_national_history_complete:false,next_request:m.offset<m.company_count?{snapshot_id:m.snapshot_id,offset:m.offset,limit:5}:null};}
async function captureOne({dir,m,companies,index,fetchImpl}){
 const url=resourceUrl(companies[index].url,'company');const file=`company-${String(index).padStart(5,'0')}.json`;
 // A process can stop after committing a page but before updating the manifest.
 // Adopt only an intact page belonging to this exact frozen partition.
 try {
  const bytes=await readFile(path.join(dir,file));const data=JSON.parse(bytes);
  if(data.url!==url||data.company_index!==index||!Array.isArray(data.roles)||!data.observed_at||!/^[a-f0-9]{64}$/.test(data.response_sha256))throw Error('orphan_company_identity_mismatch');
  m.records[index]={index,file,sha256:sha(bytes),company_url:url,returned_role_count:data.roles.length,observed_at:data.observed_at};delete m.errors[index];return m.records[index];
 } catch(e){if(e.code!=='ENOENT')throw e;}
 await policy(fetchImpl,[new URL(url).pathname]);const response=await boundedGet(url,fetchImpl);
 const data={...parsePublicPage(response.text,url,'company'),response_sha256:response.sha256,observed_at:new Date().toISOString(),company_index:index};
 const bytes=JSON.stringify(data)+'\n';await writeFile(path.join(dir,file),bytes,{flag:'wx',mode:0o600});
 m.records[index]={index,file,sha256:sha(bytes),company_url:url,returned_role_count:data.roles.length,observed_at:data.observed_at};delete m.errors[index];return m.records[index];
}
const recordDigest=m=>sha(JSON.stringify(Object.values(m.records).sort((a,b)=>a.index-b.index)));
async function savedView(dir,m,requested){
 if(requested!==undefined&&!/^[a-f0-9]{64}$/.test(requested))throw Error('invalid_snapshot_view_digest');
 const digest=recordDigest(m),pointer=path.join(dir,'view-ref-'+digest+'.json');let viewHash=requested;
 if(!viewHash){try{viewHash=JSON.parse(await readFile(pointer,'utf8')).sha256;}catch(e){if(e.code!=='ENOENT')throw e;}}
 if(viewHash){
  if(!/^[a-f0-9]{64}$/.test(viewHash))throw Error('invalid_cached_view_digest');
  const bytes=await readFile(path.join(dir,'view-'+viewHash+'.json'));if(sha(bytes)!==viewHash)throw Error('snapshot_view_digest_mismatch');
  const view=JSON.parse(bytes);if(view.snapshot_id!==m.snapshot_id)throw Error('snapshot_view_identity_mismatch');
  return {view,viewHash,current:view.record_digest===digest};
 }
 const view={snapshot_id:m.snapshot_id,record_digest:digest,companies:[],roles:[]};
 for(const ref of Object.values(m.records).sort((a,b)=>a.index-b.index)){
  const bytes=await readFile(path.join(dir,ref.file));if(sha(bytes)!==ref.sha256)throw Error('cached_company_digest_mismatch');const data=JSON.parse(bytes);
  view.companies.push({company_index:data.company_index,company_url:data.url,company:data.company,full_public_text:data.full_public_text,reported_role_count:data.reported_role_count,observed_at:data.observed_at});
  for(const role of data.roles)view.roles.push({...role,company_name:data.company.name,company_homepage:data.company.url,company_headquarters:data.company.location??null,company_stage:data.company.keywords??null,observed_at:data.observed_at,source_snapshot_id:m.snapshot_id,geography_status:'portal_location_unverified',original_publication:null});
 }
 const bytes=JSON.stringify(view)+'\n';viewHash=sha(bytes);await writeFile(path.join(dir,'view-'+viewHash+'.json'),bytes,{flag:'wx',mode:0o600}).catch(e=>{if(e.code!=='EEXIST')throw e;});await atomic(pointer,{sha256:viewHash});return {view,viewHash,current:true};
}
export async function startupmapSnapshot(name,args={}, {fetchImpl=fetch,cacheDir=process.env.JOB_MARKET_CAPTURE_DIR}={}){
 const base={source:'startupmap',coverage_complete:false,reviewed_by_model:false};let lock;
 try{
  const tool=startupmapSnapshotTools.find(t=>t.name===name);
  if(!tool||!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!Object.hasOwn(tool.inputSchema.properties,k)))throw Error('invalid_snapshot_arguments');
  if(name==='startupmap_country'||name==='startupmap_snapshot_begin'){
   if(args.country!=='DE')throw Error('exact_country_DE_required');
   const country=await countryRead(fetchImpl);
   if(name==='startupmap_country')return {...base,status:'ok',kind:'native_country_directory',...country};
   if(!cacheDir||!path.isAbsolute(cacheDir))throw Error('private_capture_directory_required');
   await policy(fetchImpl,['/sitemap.xml']);const r=await boundedGet(ORIGIN+'/sitemap.xml',fetchImpl);const data=parseSitemap(r.text);const id=randomUUID().replaceAll('-','');const dir=location(cacheDir,id);await mkdir(dir,{recursive:true,mode:0o700});await writeFile(path.join(dir,'sitemap.xml'),r.bytes,{flag:'wx',mode:0o600});
   const now=new Date().toISOString();const m={schema_version:1,snapshot_id:id,country:'DE',capture_started_at:now,capture_updated_at:now,sitemap_sha256:r.sha256,company_count:data.companies.length,country_directory:country,offset:0,records:{},errors:{}};await atomic(path.join(dir,'manifest.json'),m);
   return {...base,status:'ok',kind:'frozen_public_company_directory',...summary(m),country_directory:country};
  }
  const dir=location(cacheDir,args.snapshot_id);const {manifest:m,companies}=await load(dir);
  if(name==='startupmap_snapshot_read'){
   if(!['summary','companies','roles'].includes(args.kind))throw Error('invalid_snapshot_read_kind');
   const offset=args.offset??0,limit=args.limit??100;if(args.offset===null||args.limit===null||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)throw Error('invalid_snapshot_segment');
   if(args.kind==='summary')return {...base,status:'ok',kind:'public_snapshot_summary',...summary(m),country_directory:m.country_directory};
   if(offset>0&&!args.view_sha256)throw Error('immutable_view_digest_required_for_continuation');
   const {view,viewHash,current}=await savedView(dir,m,args.view_sha256);const rows=view[args.kind];
   if(offset>rows.length)throw Error('snapshot_offset_out_of_range');const records=rows.slice(offset,offset+limit);const next=offset+records.length;
   return {...base,status:'ok',kind:'saved_'+args.kind,...summary(m),view_sha256:viewHash,view_matches_current_records:current,total_records:rows.length,offset,returned_count:records.length,records,next_segment:next<rows.length?{snapshot_id:m.snapshot_id,kind:args.kind,view_sha256:viewHash,offset:next,limit}:null};
  }
  const index=name==='startupmap_snapshot_retry'?args.company_index:args.offset;
  const limit=name==='startupmap_snapshot_retry'?1:args.limit??5;
  if(!Number.isSafeInteger(index)||index<0||index>=companies.length||!Number.isSafeInteger(limit)||limit<1||limit>10||args.limit===null)throw Error('invalid_collection_segment');
  if(name==='startupmap_snapshot_retry'&&!m.errors[index])throw Error('retry_requires_recorded_failed_partition');
  if(name==='startupmap_snapshot_collect'&&index!==m.offset){
   if(index<m.offset&&Math.min(index+limit,companies.length)<=m.offset)return {...base,status:'ok',kind:'cached_collection_receipt',...summary(m),provider_reads:0};
   throw Error('exact_sequential_collection_offset_required');
  }
  lock=await open(path.join(dir,'collect.lock'),'wx',0o600);
  const latest=(await load(dir)).manifest;
  if(latest.offset!==m.offset||recordDigest(latest)!==recordDigest(m)||JSON.stringify(latest.errors)!==JSON.stringify(m.errors))throw Error('snapshot_changed_before_collection_lock_retry_exact_offset');
  const outcomes=[];
  for(let i=index;i<Math.min(index+limit,companies.length);i++){
   try{const ref=await captureOne({dir,m,companies,index:i,fetchImpl});outcomes.push({index:i,status:'ok',role_count:ref.returned_role_count});}
   catch(e){m.errors[i]={index:i,company_url:companies[i].url,error:e.message,http_status:e.http_status??null,retry_after:e.retry_after??null};outcomes.push({index:i,status:'source_limited',...m.errors[i]});}
   if(name==='startupmap_snapshot_collect')m.offset=i+1;
   m.capture_updated_at=new Date().toISOString();await atomic(path.join(dir,'manifest.json'),m);
   if(outcomes.at(-1).http_status===429)break;
  }
  return {...base,status:outcomes.some(x=>x.status==='source_limited')?'source_limited':'ok',kind:'public_company_collection',...summary(m),outcomes};
 }catch(e){return {...base,status:'source_limited',returned_count:null,error:e.code==='EEXIST'?'snapshot_collection_busy':e.message};}
 finally{if(lock){await lock.close();await unlink(path.join(location(cacheDir,args.snapshot_id),'collect.lock')).catch(()=>{});}}
}
