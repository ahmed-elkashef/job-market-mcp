import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startupmap,startupmapTools,parseSitemap,parsePublicPage,resourceUrl,robotsAllows} from '../startupmap.mjs';
const origin='https://startupmap.one';
const policy='User-agent: *\nAllow: /\nDisallow: /api\nDisallow: /settings\nDisallow: /admin/\n';
const sitemap=`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 <url><loc>${origin}/map/test-city</loc></url><url><loc>${origin}/jobs/test-city</loc><lastmod>2026-11-01</lastmod></url>
 <url><loc>${origin}/jobs/test-city/engineering</loc></url><url><loc>${origin}/jobs/engineering</loc></url>
 <url><loc>${origin}/startup/example_de</loc></url><url><loc>${origin}/startup/other_fr</loc></url></urlset>`;
function page(kind='city',count=2) {
 const city=kind==='city',url=origin+(city?'/jobs/test-city':'/startup/example_de');
 const heading=city?'Startup jobs in Test City':'Example';
 const body=city?`<h1>${heading}</h1><p>${count} live startup roles in Test City. Updated daily.</p>`
   :`<h1>Example</h1><p class="sm-facts"><b>Seed</b> · Test City</p><p>A useful business &amp; its products.</p><h2>Open roles at Example (${count})</h2>`;
 const list=Array.from({length:count},(_,i)=>`<li><a href="/startup/example_de${city?'':`?apply=example-role-${i}`}">Role ${i}${city?' — Example':''}</a>${city?'':' <span class="stage">— Test City</span>'}</li>`).join('');
 const schema=city?{'@type':'ItemList',numberOfItems:count,itemListElement:[{name:'Role 0 — Example'}]}
   :{'@type':'Organization',name:'Example',url:'https://employer.example/',location:{address:{addressCountry:'Germany'}}};
 return `<html><head><link rel="canonical" href="${url}" /><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><section class="sm-seo">${body}<ul>${list}</ul><nav><a href="/jobs/test-city/engineering">Engineering</a></nav></section><script>never_execute()</script></body></html>`;
}
const fetcher=(overrides={},calls=[])=>async(url,options)=>{
 calls.push({url,options});
 const routes={[origin+'/robots.txt']:policy,[origin+'/sitemap.xml']:sitemap,[origin+'/jobs/test-city']:page(),[origin+'/startup/example_de']:page('company'),...overrides};
 return routes[url] instanceof Response?routes[url]:new Response(routes[url]??'missing',{status:url in routes?200:404});
};

test('schemas expose exactly four read-only tools and reject additional fields',()=>{
 assert.equal(startupmapTools.length,4);
 for(const t of startupmapTools){assert.equal(t.annotations.readOnlyHint,true);assert.equal(t.inputSchema.additionalProperties,false);}
});
test('capabilities are offline and distinguish public metadata from official API/full descriptions',async()=>{
 const r=await startupmap('startupmap_capabilities',{}, {fetchImpl:()=>assert.fail()});
 assert.equal(r.status,'ok');assert.equal(r.official_api,false);assert.equal(r.coverage_complete,false);
});
test('sitemap keeps every company, ignores role partitions, and binds cities to map routes',()=>{
 const r=parseSitemap(sitemap);assert.equal(r.companies.length,2);assert.equal(r.cities.length,1);
 assert.equal(r.cities[0].lastmod,'2026-11-01');assert.equal(r.total_sitemap_entries,6);
});
test('case-sensitive dotted and hyphenated company IDs are never dropped from the native directory',()=>{
 const ids=['CRMpli_be','Cuez','bio-sourcing_be','e-invoice','level.works','vidi-x_hr'];
 const extra=ids.map(id=>`<url><loc>${origin}/startup/${id}</loc></url>`).join('');
 const r=parseSitemap(sitemap.replace('</urlset>',extra+'</urlset>'));
 assert.equal(r.companies.length,8);
 for(const id of ids) assert.equal(resourceUrl(origin+'/startup/'+id,'company'),origin+'/startup/'+id);
 assert.throws(()=>parseSitemap(sitemap.replace('/startup/other_fr','/startup/new/unknown')));
});
test('encoded geographical names use source-exact paths and refuse encoded separators',()=>{
 const extra=`<url><loc>${origin}/map/reykjav%C3%ADk</loc></url><url><loc>${origin}/jobs/reykjav%C3%ADk</loc></url>`;
 assert.equal(parseSitemap(sitemap.replace('</urlset>',extra+'</urlset>')).cities.length,2);
 assert.equal(resourceUrl(origin+'/jobs/reykjav%C3%ADk','city'),origin+'/jobs/reykjav%C3%ADk');
 assert.throws(()=>resourceUrl(origin+'/jobs/test%2Fcity','city'));
});
test('malformed, truncated, duplicate and external sitemap entries fail closed',()=>{
 for(const s of [sitemap.slice(0,-10),sitemap.replace('</urlset>',`<url><loc>${origin}/startup/example_de</loc></url></urlset>`),
   sitemap.replace('/startup/other_fr','/api/private'),sitemap.replace(origin,'https://elsewhere.example'),'<html>challenge</html>']) {
   if(s.includes('/api/private')) {assert.equal(parseSitemap(s).companies.length,1);continue;}
   assert.throws(()=>parseSitemap(s));
 }
});
test('city parsing preserves repeated company occurrences and all HTML rows beyond JSON-LD',()=>{
 const r=parsePublicPage(page('city',40),origin+'/jobs/test-city','city');
 assert.equal(r.roles.length,40);assert.equal(r.source_json_ld[0].itemListElement.length,1);
 assert.equal(r.roles[0].native_role_id,null);assert.equal(r.roles[0].original_publication,null);
 assert.equal(r.roles[0].description_status,'not_in_public_html');assert.equal(r.native_visible_list_complete,true);
 assert.equal(r.full_job_descriptions_available,false);
});
test('company reads preserve source facts and native IDs without following action references',async()=>{
 const withPublisher=page('company').replace('<head>','<head><script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"StartupMap"}]}</script>');
 const calls=[];const r=await startupmap('startupmap_company',{company_url:origin+'/startup/example_de'},{fetchImpl:fetcher({[origin+'/startup/example_de']:withPublisher},calls)});
 assert.equal(r.status,'ok');assert.equal(r.roles[1].native_role_id,'example-role-1');assert.equal(r.company.name,'Example');
 assert.match(r.full_public_text,/useful business & its products/);assert.equal(calls.length,3);
 assert.ok(calls.every(c=>!c.url.includes('?') && !c.url.includes('/api')));
});
test('company role references retain accented native IDs and unlinked native rows',()=>{
 const accented=page('company').replaceAll('example-role-0','example-k%C3%B6ln-0');
 assert.equal(parsePublicPage(accented,origin+'/startup/example_de','company').roles[0].native_role_id,'example-köln-0');
 const unlinked=page('company').replace('<a href="/startup/example_de?apply=example-role-0">Role 0</a>','Role 0');
 const r=parsePublicPage(unlinked,origin+'/startup/example_de','company');assert.equal(r.roles.length,2);assert.equal(r.roles[0].native_label,'Role 0');assert.equal(r.roles[0].native_role_id,null);
});
test('native entities, publisher-name collisions and protected placeholders remain distinct',()=>{
 const apostrophe=page('company').replaceAll('Example','Let&#39;s').replace('"name":"Let&#39;s"','"name":"Let\'s"');
 assert.equal(parsePublicPage(apostrophe,origin+'/startup/example_de','company').heading,"Let's");
 const publisher=page('company').replace('<head>','<head><script type="application/ld+json">{"@type":"Organization","name":"Example","url":"https://publisher.example/"}</script>');
 assert.equal(parsePublicPage(publisher,origin+'/startup/example_de','company').company.url,'https://employer.example/');
 const protectedRow=page('company').replace('>Role 0</a>','><span class="__cf_email__" data-cfemail="not-decoded">[email&#160;protected]</span></a>');
 const r=parsePublicPage(protectedRow,origin+'/startup/example_de','company');assert.equal(r.roles[0].native_label_is_protected_placeholder,true);assert.equal(r.roles[0].native_label,'[email protected]');
});
test('missing SSR, count mismatch, changed canonical, ambiguous lists and wrong company identities fail',()=>{
 for(const s of ['<div id="root"></div>',page().replace('2 live','3 live'),page().replace('rel="canonical"','rel="alternate"'),
  page().replace('</section>','<ul><li>Other</li></ul></section>'),page('company').replace('"name":"Example"','"name":"Other"')]) {
  assert.throws(()=>parsePublicPage(s,origin+(s.includes('Open roles')?'/startup/example_de':'/jobs/test-city'),s.includes('Open roles')?'company':'city'));
 }
});
test('URLs reject private routes, arbitrary origins, queries, redirects and credentials before fetch',async()=>{
 for(const u of [origin+'/api/jobs',origin+'/matches',origin+'/jobs/test-city/engineering',origin+'/jobs/test-city?q=x',origin+'/jobs/test-city#x',
  'http://startupmap.one/jobs/test-city','https://user@startupmap.one/jobs/test-city','https://startupmap.one:443/jobs/test-city','https://elsewhere.example/jobs/test-city']) {
  assert.throws(()=>resourceUrl(u,'city'));
  assert.equal((await startupmap('startupmap_city_jobs',{city_url:u},{fetchImpl:()=>assert.fail()})).status,'source_limited');
 }
});
test('robots uses longest match, specific agents, wildcards and allow tie breaking',()=>{
 assert.equal(robotsAllows(policy,'/api/jobs'),false);assert.equal(robotsAllows(policy,'/jobs/test-city'),true);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /jobs/*\nAllow: /jobs/test-city$','/jobs/test-city'),true);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: job-market-mcp\nAllow: /jobs','/jobs/a'),true);
 assert.equal(robotsAllows('User-agent: *\nAllow: /jobs\nDisallow: /jobs','/jobs'),true);
});
test('current robot denial stops before sitemap or page access',async()=>{
 const calls=[];const r=await startupmap('startupmap_city_jobs',{city_url:origin+'/jobs/test-city'},
  {fetchImpl:fetcher({[origin+'/robots.txt']:'User-agent: *\nDisallow: /'},calls)});
 assert.equal(r.status,'source_limited');assert.equal(r.error,'robots_denies_public_resource');assert.equal(calls.length,1);
});
test('HTTP failures and redirects preserve unknown counts and Retry-After without fallback',async()=>{
 for(const status of [301,403,429,500]) {
  const r=await startupmap('startupmap_city_jobs',{city_url:origin+'/jobs/test-city'},
    {fetchImpl:fetcher({[origin+'/sitemap.xml']:new Response('blocked',{status,headers:{'retry-after':'30',location:'https://other.example/'}})})});
  assert.equal(r.status,'source_limited');assert.equal(r.returned_count,null);assert.equal(r.http_status,status);assert.equal(r.retry_after,'30');
 }
});
test('size and UTF-8 errors never become partial source success',async()=>{
 for(const response of [new Response('x',{headers:{'content-length':String(6*1024*1024)}}),new Response(new Uint8Array([255,255]))]) {
  const r=await startupmap('startupmap_city_jobs',{city_url:origin+'/jobs/test-city'}, {fetchImpl:fetcher({[origin+'/sitemap.xml']:response})});
  assert.equal(r.status,'source_limited');assert.equal(r.returned_count,null);
 }
});
test('snapshot-bound continuation survives sitemap changes and makes no network calls',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'startupmap-test-'));
 try {
  const a=await startupmap('startupmap_directory',{kind:'companies',limit:1},{cacheDir:dir,fetchImpl:fetcher()});
  assert.equal(a.status,'ok');assert.equal(a.entries[0].url,origin+'/startup/example_de');
  const b=await startupmap('startupmap_directory',a.next_request,{cacheDir:dir,fetchImpl:()=>assert.fail('cached segment must not fetch')});
  assert.equal(b.entries[0].url,origin+'/startup/other_fr');assert.equal(b.native_directory_exhausted,true);assert.equal(b.coverage_complete,false);
  await writeFile(path.join(dir,'startupmap',a.snapshot_sha256+'.xml'),'corrupt');
  const c=await startupmap('startupmap_directory',a.next_request,{cacheDir:dir,fetchImpl:()=>assert.fail()});
  assert.equal(c.status,'source_limited');assert.match(c.error,/digest_mismatch/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('invalid types, unsupported filters and missing immutable continuation refuse before IO',async()=>{
 for(const args of [null,[],{kind:'companies',query:'IT'},{kind:'companies',toString:'x'},{kind:'companies',offset:1},{kind:'cities',offset:null},
  {kind:'cities',offset:'0'},{kind:'cities',limit:null},{kind:'cities',limit:501},{kind:'cities',snapshot_sha256:['a'.repeat(64)]}]) {
  const r=await startupmap('startupmap_directory',args,{cacheDir:'/unused',fetchImpl:()=>assert.fail()});assert.equal(r.status,'source_limited');
 }
});
test('a valid but undiscovered city or company is not fetched',async()=>{
 const calls=[];const r=await startupmap('startupmap_company',{company_url:origin+'/startup/not_discovered'}, {fetchImpl:fetcher({},calls)});
 assert.equal(r.status,'source_limited');assert.equal(r.error,'resource_not_in_native_sitemap_directory');assert.equal(calls.length,2);
});
