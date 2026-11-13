import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startupmapSnapshot as call,parseCountry,startupmapSnapshotTools} from '../startupmap-snapshot.mjs';
import {parsePublicPage} from '../startupmap.mjs';
const origin='https://startupmap.one';
const country='<link rel="canonical" href="https://startupmap.one/map/germany"><section class="sm-seo"><h1>Startups in Germany</h1><p>2 curated startups in Germany, spread over 1 cities, 2 hiring right now across 2 open roles.</p><h2>Startup cities in Germany</h2><ul><li><a href="/map/test-city">Test City<span class="sm-count"> — 2 startups</span><span class="hiring"> · 2 open</span></a></li></ul><h2>Startups hiring in Germany</h2><ul><li><a href="/startup/one_de">One</a></li></ul></section>';
const sitemap='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['one_de','two_fr'].map(id=>`<url><loc>${origin}/startup/${id}</loc></url>`).join('')+'</urlset>';
const company=(id,empty=false)=>`<link rel="canonical" href="${origin}/startup/${id}"/><script type="application/ld+json">${JSON.stringify({'@type':'Organization',name:id,url:'https://example.org',location:{address:{addressCountry:id==='one_de'?'Germany':'France'}}})}</script><section class="sm-seo"><h1>${id}</h1><p class="sm-facts">Seed · Test City</p><p>A business.</p>${empty?'<p>No open roles listed right now.</p>':`<h2>Open roles at ${id} (1)</h2><ul><li><a href="/startup/${id}?apply=${id}-job">Team lead</a><span class="stage">— Berlin</span></li></ul>`}</section>`;
function fetcher(overrides={},calls=[]){return async url=>{calls.push(url);const routes={[origin+'/robots.txt']:'User-agent: *\nAllow: /\nDisallow: /api',[origin+'/map/germany']:country,[origin+'/sitemap.xml']:sitemap,[origin+'/startup/one_de']:company('one_de'),[origin+'/startup/two_fr']:company('two_fr',true),...overrides};return typeof routes[url]==='function'?routes[url]():routes[url] instanceof Response?routes[url]:new Response(routes[url]??'missing',{status:url in routes?200:404});};}
async function fixture(fn){const cacheDir=await mkdtemp(path.join(os.tmpdir(),'startupmap-snapshot-'));try{await fn(cacheDir);}finally{await rm(cacheDir,{recursive:true,force:true});}}
const begin=(cacheDir,fetchImpl=fetcher())=>call('startupmap_snapshot_begin',{country:'DE'},{cacheDir,fetchImpl});
test('country preserves nested city counts, capped lists and source counter discrepancies',()=>{const r=parseCountry(country);assert.equal(r.company_count,2);assert.equal(r.cities[0].open_role_count,2);assert.equal(r.company_list_is_complete,false);assert.equal(parseCountry(country.replace('2 startups','3 startups')).city_company_counts_reconciled,false);assert.throws(()=>parseCountry(country.replace('1 cities','2 cities')));assert.equal(startupmapSnapshotTools.length,5);});
test('only a verified native zero state becomes zero roles',()=>{const r=parsePublicPage(company('two_fr',true),origin+'/startup/two_fr','company');assert.equal(r.roles.length,0);assert.equal(r.native_empty_state_verified,true);assert.throws(()=>parsePublicPage(company('two_fr',true).replace('No open roles listed right now.','Unknown'),origin+'/startup/two_fr','company'));});
test('full sitemap capture retains foreign HQ; bounded collection resumes and replays offline',()=>fixture(async cacheDir=>{
 const b=await begin(cacheDir);assert.equal(b.status,'ok');assert.equal(b.company_count,2);
 let r=await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:1},{cacheDir,fetchImpl:fetcher()});assert.equal(r.successful_partitions,1);
 r=await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:1},{cacheDir,fetchImpl:()=>assert.fail()});assert.equal(r.provider_reads,0);
 r=await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:1,limit:1},{cacheDir,fetchImpl:fetcher()});assert.equal(r.accessible_public_directory_exhausted,true);assert.equal(r.provider_or_national_history_complete,false);
}));
test('wrong offsets, unsupported filters, private paths and robot denial refuse safely',()=>fixture(async cacheDir=>{
 const b=await begin(cacheDir);for(const args of [{snapshot_id:b.snapshot_id,offset:1},{snapshot_id:b.snapshot_id,offset:0,query:'lead'},{snapshot_id:'../api',offset:0}])assert.equal((await call('startupmap_snapshot_collect',args,{cacheDir,fetchImpl:()=>assert.fail()})).status,'source_limited');
 const calls=[];const r=await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:1},{cacheDir,fetchImpl:fetcher({[origin+'/robots.txt']:'User-agent: *\nDisallow: /'},calls)});assert.equal(r.failed_partitions.length,1);assert.equal(calls.length,1);
}));
test('one failed partition does not hide independent supply; explicit retry resolves it',()=>fixture(async cacheDir=>{
 const b=await begin(cacheDir);let r=await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:2},{cacheDir,fetchImpl:fetcher({[origin+'/startup/one_de']:new Response('blocked',{status:403})})});assert.equal(r.collected_partitions,2);assert.equal(r.successful_partitions,1);assert.equal(r.failed_partitions[0].http_status,403);assert.equal(r.accessible_public_directory_exhausted,false);
 r=await call('startupmap_snapshot_retry',{snapshot_id:b.snapshot_id,company_index:0},{cacheDir,fetchImpl:fetcher()});assert.equal(r.accessible_public_directory_exhausted,true);
 assert.equal((await call('startupmap_snapshot_retry',{snapshot_id:b.snapshot_id,company_index:0},{cacheDir,fetchImpl:()=>assert.fail()})).status,'source_limited');
}));
test('rate limiting stops the batch with its exact continuation and retry-after',()=>fixture(async cacheDir=>{
 const b=await begin(cacheDir);const calls=[];const r=await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:2},{cacheDir,fetchImpl:fetcher({[origin+'/startup/one_de']:new Response('limited',{status:429,headers:{'retry-after':'60'}})},calls)});assert.equal(r.collected_partitions,1);assert.equal(r.failed_partitions[0].retry_after,'60');assert.ok(!calls.includes(origin+'/startup/two_fr'));
}));
test('immutable view continuation survives later retries and requires its digest',()=>fixture(async cacheDir=>{
 const b=await begin(cacheDir);await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:2},{cacheDir,fetchImpl:fetcher({[origin+'/startup/one_de']:new Response('no',{status:500})})});
 const first=await call('startupmap_snapshot_read',{snapshot_id:b.snapshot_id,kind:'companies',limit:1},{cacheDir});assert.equal(first.total_records,1);
 await call('startupmap_snapshot_retry',{snapshot_id:b.snapshot_id,company_index:0},{cacheDir,fetchImpl:fetcher()});
 const old=await call('startupmap_snapshot_read',{snapshot_id:b.snapshot_id,kind:'companies',view_sha256:first.view_sha256},{cacheDir});assert.equal(old.total_records,1);assert.equal(old.view_matches_current_records,false);
 const fresh=await call('startupmap_snapshot_read',{snapshot_id:b.snapshot_id,kind:'companies',limit:1},{cacheDir});assert.equal(fresh.total_records,2);assert.notEqual(fresh.view_sha256,first.view_sha256);
 const next=await call('startupmap_snapshot_read',fresh.next_segment,{cacheDir});assert.equal(next.records[0].company.name,'two_fr');assert.equal((await call('startupmap_snapshot_read',{snapshot_id:b.snapshot_id,kind:'companies',offset:1},{cacheDir})).error,'immutable_view_digest_required_for_continuation');
}));
test('cached pages and immutable views detect corruption',()=>fixture(async cacheDir=>{
 const b=await begin(cacheDir);await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:2},{cacheDir,fetchImpl:fetcher()});const dir=path.join(cacheDir,'startupmap','snapshots',b.snapshot_id);
 await writeFile(path.join(dir,'company-00000.json'),'changed');assert.equal((await call('startupmap_snapshot_read',{snapshot_id:b.snapshot_id,kind:'roles'},{cacheDir})).error,'cached_company_digest_mismatch');
}));
test('a committed orphan page is adopted without refetch after process interruption',()=>fixture(async cacheDir=>{
 const b=await begin(cacheDir);await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:1},{cacheDir,fetchImpl:fetcher()});const file=path.join(cacheDir,'startupmap','snapshots',b.snapshot_id,'manifest.json');const m=JSON.parse(await readFile(file));m.records={};m.offset=0;await writeFile(file,JSON.stringify(m));
 const r=await call('startupmap_snapshot_collect',{snapshot_id:b.snapshot_id,offset:0,limit:1},{cacheDir,fetchImpl:()=>assert.fail()});assert.equal(r.successful_partitions,1);
}));
