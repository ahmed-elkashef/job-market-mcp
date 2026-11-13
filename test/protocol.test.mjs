import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

test('legacy root entrypoint still serves the original Egypt tool catalogue',async()=>{
  const client=new Client({name:'legacy-entry-test',version:'1'});
  try{
    await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../index.mjs',import.meta.url))],env:{...process.env},stderr:'pipe'}));
    const tools=(await client.listTools()).tools;
    assert.equal(tools.length,16);assert.ok(tools.some(t=>t.name==='read_source_page'));
    const result=await client.callTool({name:'browser_capture_plan',arguments:{source:'forasna'}});
    assert.notEqual(result.isError,true);
  }finally{await client.close();}
});

test('real unified stdio lists countries and routes through Egypt and Germany offline',async()=>{
  const client=new Client({name:'country-protocol-test',version:'1'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server.mjs',import.meta.url))],env:{...process.env},stderr:'pipe'});
  transport.stderr?.on('data',()=>{});
  try{
    await client.connect(transport);
    const list=await client.listTools();
    for(const name of ['list_countries','list_country_sources','plan_country_scan','eg_read_source_page','de_ba_job_suche','de_stepstone_get_capabilities','shared_get_public_inventory','de_public_interamt_capabilities','de_public_interamt_read','de_public_jobmensa_capabilities','de_public_jobmensa_page','de_public_jobmensa_detail','de_public_student_boards_capabilities','de_public_student_board_page','de_public_student_board_detail','de_public_student_board_resolve_external','de_public_german_boards_capabilities','de_public_german_board_inventory','de_public_german_board_detail','de_public_german_board_capture_segment','de_public_meinpraktikum_inventory','de_public_meinpraktikum_detail','de_public_organisation_directory','de_public_handwerk_inventory','de_public_handwerk_detail','de_public_state_portal_inventory','de_public_state_portal_detail','de_public_aubiplus_inventory','de_public_aubiplus_detail','shared_ror_release','shared_ror_directory'])assert.ok(list.tools.some(t=>t.name===name),name);
    assert.equal(list.tools.length,104);
    for(const name of ['shared_startupmap_capabilities','shared_startupmap_directory','shared_startupmap_city_jobs','shared_startupmap_company']) assert.ok(list.tools.some(t=>t.name===name),name);
    const startupmap=await client.callTool({name:'shared_startupmap_capabilities',arguments:{}});
    assert.equal(startupmap.structuredContent.official_api,false);
    const unsafeStartupmap=await client.callTool({name:'shared_startupmap_company',arguments:{company_url:'https://startupmap.one/api/jobs'}});
    assert.equal(unsafeStartupmap.structuredContent.status,'source_limited');
    const farCaps=await client.callTool({name:'de_public_german_boards_capabilities',arguments:{}});
    assert.ok(farCaps.structuredContent.sources.includes('far_retail'));
    assert.ok(farCaps.structuredContent.sources.includes('sap_modern'));
    const unsafeFar=await client.callTool({name:'de_public_german_board_detail',arguments:{source:'far_retail',url:'https://career5.successfactors.eu/career?career_ns=job_application'}});
    assert.equal(unsafeFar.structuredContent.status,'source_limited');
    assert.equal(unsafeFar.structuredContent.returned_count,null);
    const oracle=await client.callTool({name:'shared_oracle_capabilities',arguments:{}});
    assert.equal(oracle.structuredContent.source,'oracle');
    assert.deepEqual(Object.keys(oracle.structuredContent.native_country_location_partitions),['DE']);
    const unsafeOracle=await client.callTool({name:'shared_oracle_detail',arguments:{job_url:'https://example.com/apply'}});
    assert.equal(unsafeOracle.structuredContent.status,'source_limited');
    const successfactors=await client.callTool({name:'shared_successfactors_capabilities',arguments:{}});
    assert.equal(successfactors.structuredContent.source,'successfactors');
    assert.equal(successfactors.structuredContent.separate_current_front_implemented,false);
    const unsafeRmk=await client.callTool({name:'shared_successfactors_detail',arguments:{job_url:'https://career5.successfactors.eu/career?career_ns=job_application'}});
    assert.equal(unsafeRmk.isError,true);
    assert.equal(unsafeRmk.structuredContent.returned_count,null);
    for(const name of ['shared_onlyfy_capabilities','shared_successfactors_capabilities','shared_successfactors_inventory','shared_successfactors_detail','shared_jobshop_capabilities','shared_jobshop_inventory','shared_jobshop_detail','shared_onlyfy_inventory','shared_onlyfy_detail'])assert.ok(list.tools.some(t=>t.name===name),name);
    const jobshop=await client.callTool({name:'shared_jobshop_capabilities',arguments:{}});
    assert.equal(jobshop.structuredContent.source,'jobshop');
    const unsafeJobshop=await client.callTool({name:'shared_jobshop_detail',arguments:{job_url:'https://www.jobs-fraport.com/application/apply'}});
    assert.equal(unsafeJobshop.isError,true);
    const onlyfy=await client.callTool({name:'shared_onlyfy_capabilities',arguments:{}});
    assert.equal(onlyfy.structuredContent.source,'onlyfy');assert.equal(onlyfy.structuredContent.seed_required,true);
    const unsafeOnlyfy=await client.callTool({name:'shared_onlyfy_inventory',arguments:{board_url:'https://example.onlyfy.jobs/application/apply/forbidden'}});
    assert.equal(unsafeOnlyfy.isError,true);assert.equal(unsafeOnlyfy.structuredContent.returned_count,null);
    for(const name of ['shared_dvinci_capabilities','shared_dvinci_inventory','shared_dvinci_detail'])assert.ok(list.tools.some(t=>t.name===name),name);
    const dvinci=await client.callTool({name:'shared_dvinci_capabilities',arguments:{}});
    assert.equal(dvinci.structuredContent.source,'dvinci');assert.equal(dvinci.structuredContent.seed_required,true);
    const unsafePublication=await client.callTool({name:'shared_dvinci_inventory',arguments:{portal_url:'https://example.dvinci-hr.com/jobPublications/'}});
    assert.equal(unsafePublication.isError,true);assert.equal(unsafePublication.structuredContent.returned_count,null);
    for(const name of ['shared_teamtailor_capabilities','shared_teamtailor_inventory','shared_teamtailor_detail'])assert.ok(list.tools.some(t=>t.name===name),name);
    const teamtailor=await client.callTool({name:'shared_teamtailor_capabilities',arguments:{}});
    assert.equal(teamtailor.structuredContent.source,'teamtailor');
    const unsafeFeed=await client.callTool({name:'shared_teamtailor_inventory',arguments:{careers_origin:'https://api.teamtailor.com'}});
    assert.equal(unsafeFeed.isError,true);assert.equal(unsafeFeed.structuredContent.returned_count,null);
    for(const name of ['shared_workday_capabilities','shared_workday_inventory','shared_workday_detail'])assert.ok(list.tools.some(t=>t.name===name),name);
    const workday=await client.callTool({name:'shared_workday_capabilities',arguments:{}});
    assert.equal(workday.structuredContent.source,'workday');assert.equal(workday.structuredContent.seed_required,true);
    const unsafeWorkday=await client.callTool({name:'shared_workday_inventory',arguments:{board_url:'https://example.test/External'}});
    assert.equal(unsafeWorkday.isError,true);assert.equal(unsafeWorkday.structuredContent.count,null);
    assert.ok(list.tools.every(t=>t.annotations?.readOnlyHint===true));
    const countries=await client.callTool({name:'list_countries',arguments:{}});
    assert.equal(countries.structuredContent.countries.length,2);
    assert.ok(Object.values(countries.structuredContent.backend_status).every(b=>b.state==='ready'));
    const student=await client.callTool({name:'de_public_jobmensa_capabilities',arguments:{}});
    assert.equal(student.structuredContent.source,'jobmensa');
    const refused=await client.callTool({name:'de_public_jobmensa_page',arguments:{url:'https://example.test/jobs-suchen'}});
    assert.equal(refused.isError,true);assert.equal(refused.structuredContent.returned_count,null);
    const boards=await client.callTool({name:'de_public_student_boards_capabilities',arguments:{}});
    assert.deepEqual(boards.structuredContent.sources,['studentjob','youngcapital']);
    const unsafe=await client.callTool({name:'de_public_student_board_page',arguments:{source:'studentjob',url:'https://example.test/stellenangebote'}});
    assert.equal(unsafe.isError,true);assert.equal(unsafe.structuredContent.returned_count,null);
    const publicBoards=await client.callTool({name:'de_public_german_boards_capabilities',arguments:{}});
    assert.deepEqual([...publicBoards.structuredContent.sources].sort(),['absolventa','academics','stellenanzeigen','yourfirm','germantechjobs','bund_de','jobs_de','jobware','berlinstartupjobs','englishjobs','xing','getinengineering','zenjob','swffm','far_retail','sap_modern','join'].sort());
    assert.deepEqual(publicBoards.structuredContent.operations_by_source.englishjobs,['inventory']);
    const noCapture=await client.callTool({name:'de_public_german_board_capture_segment',arguments:{capture_id:'0'.repeat(64),segment_index:0}});assert.equal(noCapture.isError,true);assert.equal(noCapture.structuredContent.returned_count,null);
    const unsafeBoard=await client.callTool({name:'de_public_german_board_inventory',arguments:{source:'germantechjobs',url:'https://germantechjobs.de/api/jobApply'}});
    assert.equal(unsafeBoard.isError,true);assert.equal(unsafeBoard.structuredContent.returned_count,null);
    const interamt=await client.callTool({name:'de_public_interamt_read',arguments:{operation:'agency_list'}});
    assert.equal(interamt.isError,true);assert.equal(interamt.structuredContent.status,'credential_required');
    for(const source of (await client.callTool({name:'list_country_sources',arguments:{country:'DE'}})).structuredContent.sources){
      for(const route of source.routes){const tool=list.tools.find(t=>t.name===route.public_tool);assert.ok(tool,route.public_tool);
        for(const [key,value]of Object.entries(route.fixed_arguments)){const schema=tool.inputSchema.properties[key];assert.ok(schema,key);if(schema.enum)assert.ok(schema.enum.includes(value));}}
    }
    const capture={url:'https://www.akhtaboot.com/en/egypt/jobs',kind:'page',captured_at:'2026-10-01T00:00:00Z',html:'<section data-public-native-filters data-country="Egypt"></section><li id="current_page">Jobs in Egypt</li><p class="error_message">Sorry, no results found</p>'};
    const parsed=await client.callTool({name:'eg_parse_rendered_board_page',arguments:{source:'akhtaboot',capture}});
    assert.equal(parsed.isError,false);assert.equal(parsed.structuredContent.native_empty_state_verified,true);
    const bad=await client.callTool({name:'de_ba_job_suche',arguments:{page:0}});
    assert.equal(bad.isError,true);assert.equal(bad.structuredContent.coverage_complete,false);
    const html='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'JobPosting',title:'Synthetic role',identifier:{value:'123456'},description:'<p>'+('Full duties. '.repeat(500))+'</p>',hiringOrganization:{name:'Synthetic'},url:'https://www.stepstone.de/stellenangebote--Synthetic--123456-inline.html'})+'</script>';
    const detail=await client.callTool({name:'de_stepstone_parse_job_html',arguments:{html,source_url:'https://www.stepstone.de/stellenangebote--Synthetic--123456-inline.html'}});
    assert.equal(detail.isError,false);assert.ok(JSON.stringify(detail.structuredContent).length>5000);
  }finally{await client.close();}
});
