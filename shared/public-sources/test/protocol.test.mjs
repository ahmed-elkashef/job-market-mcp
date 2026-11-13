import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tools,callTool,matchesNormalizedJob} from '../index.mjs';
test('49 tools retain legacy names and expose original native source contracts',async()=>{
  assert.equal(tools.length,49);for(const name of ['startupmap_snapshot_begin','startupmap_snapshot_collect','startupmap_snapshot_read','personio_detail','oracle_capabilities','oracle_inventory','oracle_detail','search_public_jobs','search_arbeitnow','search_remotive','search_remoteok','search_jobicy','search_himalayas','search_themuse','search_workable','fetch_workable_jobs','fetch_smartrecruiters_jobs','detect_company_ats','fetch_company_ats_jobs','fetch_personio_jobs','fetch_recruitee_jobs','get_public_inventory','get_public_job_from_snapshot','successfactors_capabilities','successfactors_inventory','successfactors_detail','workday_capabilities','workday_inventory','workday_detail','teamtailor_capabilities','teamtailor_inventory','teamtailor_detail','dvinci_capabilities','dvinci_inventory','dvinci_detail','onlyfy_capabilities','onlyfy_inventory','onlyfy_detail','jobshop_capabilities','jobshop_inventory','jobshop_detail'])assert.ok(tools.some(t=>t.name===name));
  const result=await callTool('unknown');assert.equal(result.isError,true);assert.equal(JSON.parse(result.content[0].text).jobs,null);
});

test('legacy Workday domain fetching is refused rather than masking a failure as an empty supply',async()=>{
 const result=await callTool('fetch_company_ats_jobs',{ats:'workday',domain:'not-a-network-fixture.test'});
 assert.equal(result.isError,true);const data=JSON.parse(result.content[0].text);
 assert.equal(data.error.code,'workday_explicit_board_required');assert.equal(data.jobs,null);
});

test('remote filter reads values rather than the remote property name',()=>{
 assert.equal(matchesNormalizedJob({remote:false,title:'Office work',location:'Berlin',description:'On site.'},{remote:true}),false);
 assert.equal(matchesNormalizedJob({remote:true,title:'Example'},{remote:true}),true);
 assert.equal(matchesNormalizedJob({remote:false,description:'No remote work is offered.'},{remote:true}),false);
 assert.equal(matchesNormalizedJob({description:'Remote role available'},{remote:true}),true);
});
