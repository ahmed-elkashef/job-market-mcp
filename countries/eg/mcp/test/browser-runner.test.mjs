import test from 'node:test';
import assert from 'node:assert/strict';
import { browserCapturePlan, inspectBoardDOM, inspectDetailDOM, runBoardCapture } from '../browser-runner.mjs';

const TQ='https://egypt.tanqeeb.com/jobs/search?keywords=&country=213&state=0&lang=all&order_by=most_recent';
const FS='https://forasna.com/وظائف-خالية?'+new URLSearchParams({'filters[country][0]':'مصر','filters[jobType][0]':'نصف يوم'});

class FakeTab {
  constructor({source='tanqeeb',pages=3,type='Part Time',leakOnce=false,repeat=false,gate=false}={}) {
    Object.assign(this,{source,pages,type,leakOnce,repeat,gate,page:1,selected:'-1',sort:'most_recent',calls:[],url:'https://example.invalid/',applied:0});
    this.playwright={
      domSnapshot:async()=>{this.calls.push(['snapshot']);return 'Native public UI';},
      evaluate:async(fn,args)=>{
        this.calls.push(['evaluate',fn.name,args.kind || 'page']);
        if (fn.name==='inspectBoardDOM') return this.state();
        if (fn.name==='inspectDetailDOM') return {url:this.url,ready:!this.gate && !this.detailHydrating,gate:this.gate,fingerprint:this.url};
        if (fn.name==='captureEgyptBoardDOM') return {url:this.url,kind:args.kind,captured_at:'2026-01-01T00:00:00Z',html:JSON.stringify(this.state())};
        throw Error('Unexpected DOM evaluator');
      },
      locator:selector=>this.control(selector),
      getByRole:(role,args)=>this.control(role+':'+String(args.name)),
    };
  }
  state() {
    const nativeType=this.leaking?'Full Time':this.type;
    const id=String(this.repeat?100001:100000+this.page);
    const rows=this.gate || this.hydrating?[]:[{id,type:this.source==='forasna'?'نصف يوم':nativeType,country:this.source==='tanqeeb'?'Egypt':null,closed:this.closed?'1':'0',url:this.source==='tanqeeb'?`https://egypt.tanqeeb.com/jobs-in-middle-east/all/jobs/0${id}.html`:`https://forasna.com/job/p/constructed-${id}`,part_time_contradiction:Boolean(this.contradiction)}];
    const controls=this.source==='tanqeeb'?[{name:'refine[job_types][]',value:this.selected},{name:'refine[order_by]',value:this.sort}]:[{name:'Egypt-country',value:true},{name:'half-day',value:true}];
    return {url:this.url,country:this.source==='tanqeeb'?{value:'213',text:'Egypt'}:{value:'مصر',text:'Egypt'},controls,native_page_number:this.page,rows,stable_ids:rows.map(x=>x.id),next:{visible:this.page<this.pages,enabled:true,href:this.source==='forasna'?FS+'&start=20':TQ.replace('/jobs/search','/jobs/search/page/'+(this.page+1))},gate:this.gate,fingerprint:JSON.stringify({page:this.page,controls,rows})};
  }
  async goto(url) {
    this.calls.push(['goto',url]);this.url=new URL(url).href;
    if (url.includes('/jobs/search') || url.includes('وظائف') || url.includes('%D9%88')) {this.page=1;this.selected='-1';this.leaking=false;}
  }
  control(selector) {
    return {
      isVisible:async()=>true,isEnabled:async()=>true,
      first:()=>this.control(selector),
      waitFor:async options=>{this.calls.push(['waitFor',selector,options]);if(this.hydrationTimeout || this.detailHydrationTimeout)throw Error('Visible section wait timed out');this.hydrating=false;this.detailHydrating=false;},
      click:async()=>{
        this.calls.push(['click',selector]);
        if (selector.includes('Next') || selector.includes('pag-next')) {
          this.page+=1;
          this.url=this.source==='tanqeeb'?TQ.replace('/jobs/search','/jobs/search/page/'+this.page).replace('&order_by=most_recent',''):new URL(FS+'&start='+((this.page-1)*30)).href;
        } else if (selector.includes('filter_job_type_')) {
          this.selected=selector.match(/filter_job_type_(-?\d+)/)[1];
          if (this.selected!=='-1') {this.applied+=1;this.leaking=this.leakOnce && this.applied===1;}
        } else if (selector.includes('most_recent')) this.sort='most_recent';
      },
    };
  }
}

class FakeSink {
  constructor(tab,{cursor=null,queue=[]}={}) {this.tab=tab;this.cursor=cursor;this.queue=queue;this.captures=[];this.limits=[];this.details=[];this.done=false;this.seen=new Set();this.newIDs=[];}
  async status() {return {status:'ok',source:this.tab.source,native_filter_plan:{native_work_model:'part_time'},initial_url:this.tab.source==='tanqeeb'?TQ:FS,cursor:this.cursor,source_continuation:this.cursor?{native_page_number:this.cursor.native_page_number}:null,verification_queue:this.queue,detail_queue:this.queue,listing_terminal_observed:this.done,capture_complete:this.done && !this.queue.length,done:this.done && !this.queue.length};}
  async capture(capture,meta) {
    const state=JSON.parse(capture.html);this.captures.push({state,meta});
    this.cursor={url:state.url,stable_ids:state.stable_ids,native_page_number:state.native_page_number,native_filter_signature:'saved'};
    for (const id of state.stable_ids) {if (!this.seen.has(id)) this.newIDs.push(id);this.seen.add(id);}
    return this.status();
  }
  async detail(capture) {this.details.push(capture);const id=new URL(capture.url).pathname.match(/(\d+)(?:\.html)?$/)?.[1];this.queue=this.queue.filter(x=>new URL(x.url).pathname.match(/(\d+)(?:\.html)?$/)?.[1]!==id);return this.status();}
  async limit(value) {this.limits.push(value);if (value.reason==='native_no_next_observed') this.done=true;return this.status();}
  async recover() {this.done=false;return this.status();}
}

test('one invocation initializes native filters and captures multiple pages automatically',async()=>{
  const tab=new FakeTab({pages:3});const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:3});
  assert.equal(result.counts.pages,3);
  assert.equal(sink.captures.length,3);
  assert.equal(tab.calls.filter(x=>x[0]==='goto').length,1);
  assert.equal(tab.calls.filter(x=>x[0]==='click' && x[1].includes('Next')).length,2);
  assert.equal(sink.done,true);assert.equal(result.coverage_complete,false);
  const modelClick=tab.calls.findIndex(x=>x[0]==='click' && x[1].includes('filter_job_type_2'));
  assert.ok(tab.calls.slice(0,modelClick).some(x=>x[0]==='snapshot'));
});

test('selected PT with actual all-FT membership is preserved diagnostically and recovered once',async()=>{
  const tab=new FakeTab({pages:1,leakOnce:true});const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:1});
  assert.equal(result.counts.recoveries,1);
  assert.equal(sink.captures.length,1);
  assert.equal(sink.captures[0].state.rows[0].type,'Part Time');
  const drift=sink.limits.find(x=>x.reason==='native_membership_drift');
  assert.equal(JSON.parse(drift.diagnostic_capture.html).rows[0].type,'Full Time');
  assert.equal(tab.calls.filter(x=>x[0]==='goto').length,1);
});

test('native Next click wins over the wrong advertised Forasna offset',async()=>{
  const tab=new FakeTab({source:'forasna',pages:2});const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'forasna',maxPages:2});
  assert.equal(result.counts.pages,2);
  assert.match(sink.captures[1].state.url,/start=30/);
  assert.ok(!tab.calls.some(x=>x[0]==='goto' && x[1].includes('start=20')));
});

test('live cursor resumes automatically and identical stable IDs remain consumer-deduplicated',async()=>{
  const tab=new FakeTab({pages:3});tab.page=2;tab.selected='2';tab.url=TQ.replace('/jobs/search','/jobs/search/page/2');
  const state=tab.state();const sink=new FakeSink(tab,{cursor:{url:state.url,stable_ids:state.stable_ids,native_page_number:2}});sink.seen.add('100002');
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:2});
  assert.equal(result.counts.pages,1);assert.equal(result.counts.checkpoints_reused,1);assert.equal(tab.calls.filter(x=>x[0]==='goto').length,0);
  assert.deepEqual(sink.captures.map(x=>x.meta.resume),[true,false]);assert.deepEqual(sink.newIDs,['100003']);
});

test('lost UI context replays actual native pages rather than restoring a synthetic offset',async()=>{
  const tab=new FakeTab({pages:3});tab.url='https://example.invalid/';
  const sink=new FakeSink(tab,{cursor:{url:TQ.replace('/jobs/search','/jobs/search/page/2'),stable_ids:['100002'],native_page_number:2}});
  await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:3});
  assert.deepEqual(sink.captures.map(x=>x.state.native_page_number),[1,2,3]);
  assert.deepEqual(sink.captures.map(x=>x.meta.resume),[false,false,false]);
  assert.equal(tab.calls.filter(x=>x[0]==='goto').length,1);
});

test('empty private review queue never stops source continuation',async()=>{
  const tab=new FakeTab({pages:4});const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:2});
  assert.equal(result.status,'page_budget');assert.equal(result.counts.pages,2);assert.equal(sink.done,false);
});

test('unknown/mixed models, genuine PT contradictions and closure metadata survive intact',async()=>{
  for (const type of ['New source model','Full Time / Part Time','Full Time']) {
    const tab=new FakeTab({pages:1,type});tab.contradiction=true;tab.closed=true;
    const sink=new FakeSink(tab);await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:1});
    assert.equal(sink.captures[0].state.rows[0].type,type);assert.equal(sink.captures[0].state.rows[0].closed,'1');
  }
});

test('actual source barrier stops without a bypass or a fabricated empty success',async()=>{
  const tab=new FakeTab({gate:true});const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:2});
  assert.equal(result.status,'source_barrier');assert.equal(sink.captures.length,0);assert.equal(result.counts.recoveries,0);
});

test('repeated native page does not become terminal or skip ahead by href',async()=>{
  const tab=new FakeTab({pages:3,repeat:true});const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:5});
  assert.equal(result.status,'native_page_repeated');assert.equal(result.counts.recoveries,1);assert.equal(sink.done,false);
});

test('page/time budgets preserve a continuation without source completeness claims',async()=>{
  const tab=new FakeTab({pages:5});const sink=new FakeSink(tab);
  const original=Date.now;let clock=0;
  Date.now=()=>{clock+=10;return clock;};
  try {
    const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxMillis:15,maxPages:5});
    assert.equal(result.status,'time_budget');assert.equal(result.coverage_complete,false);assert.equal(sink.done,false);
  } finally {Date.now=original;}
});

test('canonical verification detail queue is hydrated automatically and only through the sink',async()=>{
  const tab=new FakeTab({pages:1});const url='https://egypt.tanqeeb.com/jobs-in-middle-east/all/jobs/0100001.html';
  const sink=new FakeSink(tab,{queue:[{id:'tanqeeb:100001',url}]});sink.done=true;
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:2,collectDetails:true});
  assert.equal(result.counts.details,1);assert.equal(sink.details[0].kind,'detail');assert.deepEqual(sink.queue,[]);
  assert.ok(!JSON.stringify(result).includes('html'));
});

test('foreign/account/apply detail URLs fail before browser navigation',async()=>{
  for (const url of ['https://evil.invalid/job/100001','https://egypt.tanqeeb.com/users/login','https://egypt.tanqeeb.com/jobs/view/100001/sid:2']) {
    const tab=new FakeTab();const sink=new FakeSink(tab,{queue:[{url}]});
    await assert.rejects(runBoardCapture({tab,sink,source:'tanqeeb',collectDetails:true}),/scope|Canonical/);
    assert.equal(tab.calls.filter(x=>x[0]==='goto').length,0);
  }
});

test('detail security gate is a recorded stop and no raw detail is accepted',async()=>{
  const tab=new FakeTab({gate:true});const sink=new FakeSink(tab,{queue:[{url:'https://egypt.tanqeeb.com/jobs-in-middle-east/all/jobs/0100001.html'}]});
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',collectDetails:true});
  assert.equal(result.status,'source_barrier');assert.equal(sink.details.length,0);
  assert.equal(sink.limits[0].reason,'source_barrier');
});

test('discovery exposes the same exact model and source plan used by execution',()=>{
  const plan=browserCapturePlan({source:'tanqeeb',workModel:'internship'});
  assert.equal(plan.controls.model_value,'5');assert.equal(plan.initial_url,TQ);
  assert.throws(()=>browserCapturePlan({source:'forasna',workModel:'internship'}));
});

test('sink model/source drift and a failed intake never advance the browser',async()=>{
  const tab=new FakeTab({pages:2});const sink=new FakeSink(tab);
  sink.capture=async()=>({status:'source_limited'});
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:2});
  assert.equal(result.status,'capture_intake_failed');assert.equal(result.counts.pages,0);
  assert.ok(!tab.calls.some(x=>x[0]==='click' && x[1].includes('Next')));
  const mismatch=new FakeSink(tab);mismatch.status=async()=>({status:'ok',source:'tanqeeb',native_filter_plan:{native_work_model:'internship'}});
  const before=tab.calls.length;await assert.rejects(runBoardCapture({tab,sink:mismatch,source:'tanqeeb'}),/model binding/);assert.equal(tab.calls.length,before);
});

test('already captured details are not refetched merely because original clock holds remain',async()=>{
  const tab=new FakeTab({pages:1});const sink=new FakeSink(tab);sink.done=true;
  const original=sink.status.bind(sink);
  sink.status=async()=>({...await original(),detail_queue:[],verification_queue:[{url:'https://egypt.tanqeeb.com/jobs-in-middle-east/all/jobs/0100001.html'}]});
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',collectDetails:true});
  assert.equal(result.counts.details,0);assert.equal(tab.calls.length,0);
});

test('same-ID public Forasna slug canonicalization preserves the actual captured URL',async()=>{
  const initial='https://forasna.com/job/p/constructed-east-100001';
  const canonical='https://forasna.com/job/p/constructed-tenth-city-east-100001';
  const tab=new FakeTab({source:'forasna',pages:1});const navigate=tab.goto.bind(tab);
  tab.goto=async url=>{await navigate(url);if(url===initial)tab.url=canonical;};
  const sink=new FakeSink(tab,{queue:[{id:'forasna:100001',url:initial}]});sink.done=true;
  const result=await runBoardCapture({tab,sink,source:'forasna',collectDetails:true});
  assert.equal(result.counts.details,1);assert.equal(sink.details[0].url,canonical);assert.deepEqual(sink.queue,[]);
});

test('DOM detail identity accepts only same-host same-source-ID canonical aliases before reading content',()=>{
  const initial='https://forasna.com/job/p/constructed-east-100001';
  const canonical='https://forasna.com/job/p/constructed-tenth-city-east-100001';
  const original=globalThis.document;
  let reads=0;
  const task={innerText:'Constructed task body'};
  const headings=[{innerText:'تفاصيل الوظيفة',parentElement:{parentElement:{querySelector:()=>task}}},{innerText:'متطلبات الوظيفة'}];
  try {
    globalThis.document={location:new URL(canonical),title:'Constructed role',querySelector:()=>{reads+=1;return {innerText:'Constructed role'};},querySelectorAll:()=>{reads+=1;return headings;}};
    const state=inspectDetailDOM({source:'forasna',expectedURL:initial});
    assert.equal(state.ready,true);assert.equal(state.url,canonical);
    for (const wrong of [canonical.replace('100001','100002'),canonical.replace('forasna.com','other.invalid'),canonical+'?account=private']) {
      document.location=new URL(wrong);reads=0;
      assert.throws(()=>inspectDetailDOM({source:'forasna',expectedURL:initial}),/identity changed/);
      assert.equal(reads,0);
    }
  } finally {if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

test('a different-ID detail redirect never reaches the private sink',async()=>{
  const initial='https://forasna.com/job/p/constructed-east-100001';
  const tab=new FakeTab({source:'forasna',pages:1});const navigate=tab.goto.bind(tab);
  tab.goto=async url=>{await navigate(url);if(url===initial)tab.url=initial.replace('100001','100002');};
  const sink=new FakeSink(tab,{queue:[{url:initial}]});
  await assert.rejects(runBoardCapture({tab,sink,source:'forasna',collectDetails:true}),/identity changed/);
  assert.equal(sink.details.length,0);
});

test('a real empty Forasna description section is capturable while absent structure is unready',()=>{
  const original=globalThis.document;
  const url='https://forasna.com/job/p/constructed-role-100001';
  let task={innerText:''};
  let requirements=true;
  const headings=()=>[{innerText:'تفاصيل الوظيفة',parentElement:{parentElement:{querySelector:()=>task}}},...(requirements?[{innerText:'متطلبات الوظيفة'}]:[])];
  try {
    globalThis.document={location:new URL(url),title:'Constructed role',querySelector:()=>({innerText:'Constructed role'}),querySelectorAll:headings};
    let state=inspectDetailDOM({source:'forasna',expectedURL:url});
    assert.equal(state.ready,true);assert.equal(state.empty_description,true);assert.equal(state.body_characters,0);
    task=null;state=inspectDetailDOM({source:'forasna',expectedURL:url});
    assert.equal(state.ready,false);assert.equal(state.empty_description,false);assert.equal(state.body_characters,null);
    task={innerText:''};requirements=false;
    assert.equal(inspectDetailDOM({source:'forasna',expectedURL:url}).ready,false);
    const tanqeeb='https://egypt.tanqeeb.com/jobs-in-middle-east/all/jobs/0100001.html';
    globalThis.document={location:new URL(tanqeeb),title:'Constructed role',querySelector:selector=>selector==='#jobDescriptionBody'?{innerText:''}:{innerText:'Constructed role'}};
    assert.equal(inspectDetailDOM({source:'tanqeeb',expectedURL:tanqeeb}).ready,false);
  } finally {globalThis.document=original;}
});

test('three maxPages1 chunks advance automatically instead of recapturing the same checkpoint forever',async()=>{
  const tab=new FakeTab({pages:3});const sink=new FakeSink(tab);
  const chunks=[];
  for (let n=0;n<3;n+=1) chunks.push(await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:1}));
  assert.deepEqual(sink.captures.map(x=>x.state.native_page_number),[1,1,2,2,3]);
  assert.deepEqual(chunks.map(x=>x.counts.pages),[1,1,1]);
  assert.deepEqual(chunks.map(x=>x.counts.checkpoints_reused),[0,1,1]);
  assert.equal(tab.calls.filter(x=>x[0]==='goto').length,1);
});

test('changed same-ID row metadata is always recaptured without consuming the new-page budget',async()=>{
  const tab=new FakeTab({pages:2});const sink=new FakeSink(tab);
  await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:1});
  tab.closed=true;
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:1});
  assert.equal(result.counts.checkpoints_reused,1);assert.equal(result.counts.pages,1);
  assert.deepEqual(sink.captures.map(x=>x.state.native_page_number),[1,1,2]);
  assert.equal(sink.captures[1].state.rows[0].closed,'1');
});

test('only verified Tanqeeb inventory disclosure hashes are accepted and normalized before handoff',async()=>{
  for (const hash of ['#order-by-wrap','#job-type-wrap']) {
    const tab=new FakeTab({pages:1});const sink=new FakeSink(tab);
    const nativeControl=tab.control.bind(tab);
    tab.control=selector=>{
      const control=nativeControl(selector),click=control.click;
      return {...control,click:async()=>{await click();if(selector.includes('filter_job_type_'))tab.url=TQ+hash;}};
    };
    const accept=sink.capture.bind(sink);
    sink.capture=async(capture,meta)=>{
      assert.equal(new URL(capture.url).hash,'');
      assert.deepEqual(Object.keys(capture).sort(),['captured_at','html','kind','url']);
      return accept(capture,meta);
    };
    const original=sink.status.bind(sink);
    sink.status=async()=>({...await original(),initial_url:TQ+hash});
    await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:1});
    assert.equal(sink.captures.length,1);
    assert.equal(new URL(tab.url).hash,hash);
    assert.equal(tab.calls[0][0],'goto');
  }
  const tab=new FakeTab();const sink=new FakeSink(tab);const original=sink.status.bind(sink);
  sink.status=async()=>({...await original(),initial_url:TQ+'#unverified'});
  await assert.rejects(runBoardCapture({tab,sink,source:'tanqeeb'}),/scope changed/);
  assert.equal(tab.calls.length,0);
});

test('DOM inspection normalizes only actual native listing disclosure fragments',()=>{
  const original=globalThis.document;
  let reads=0;
  try {
    for (const hash of ['#order-by-wrap','#job-type-wrap']) {
      globalThis.document={location:{href:TQ+hash},title:'Jobs in Egypt',body:{innerText:''},querySelector:()=>{reads+=1;return null;},querySelectorAll:()=>[]};
      const state=inspectBoardDOM({source:'tanqeeb'});
      assert.equal(state.url,TQ);assert.equal(state.observed_ui_hash,hash);
    }
    reads=0;globalThis.document.location.href=TQ+'#unverified';
    assert.throws(()=>inspectBoardDOM({source:'tanqeeb'}),/Wrong public source/);assert.equal(reads,0);
    globalThis.document.location.href='https://egypt.tanqeeb.com/jobs-in-middle-east/all/jobs/0100001.html#order-by-wrap';
    assert.throws(()=>inspectDetailDOM({source:'tanqeeb',expectedURL:'https://egypt.tanqeeb.com/jobs-in-middle-east/all/jobs/0100001.html'}),/identity changed/);assert.equal(reads,0);
  } finally {globalThis.document=original;}
});

test('native empty inventory shells await real visible card hydration once before capture',async()=>{
  for (const source of ['tanqeeb','forasna']) {
    const tab=new FakeTab({source,pages:1});tab.hydrating=true;
    const sink=new FakeSink(tab);
    const result=await runBoardCapture({tab,sink,source,maxPages:1});
    assert.equal(result.counts.pages,1);assert.equal(sink.captures.length,1);
    const waits=tab.calls.filter(x=>x[0]==='waitFor');
    assert.equal(waits.length,1);assert.equal(waits[0][2].state,'visible');
    assert.ok(waits[0][2].timeoutMs>0 && waits[0][2].timeoutMs<=10000);
    assert.equal(waits[0][1],source==='tanqeeb'?'article[data-job-id] h2 a[href]':'h2.job-title a[href]');
  }
  const tab=new FakeTab({pages:1});tab.hydrating=true;tab.hydrationTimeout=true;
  const sink=new FakeSink(tab);const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:1});
  assert.equal(result.status,'native_hydration_timeout');assert.equal(sink.captures.length,0);
  assert.equal(tab.calls.filter(x=>x[0]==='waitFor').length,1);assert.equal(sink.done,false);
});

test('navigation host timeouts are accepted only after the exact approved destination is observed',async()=>{
  const tab=new FakeTab({pages:1});const navigate=tab.goto.bind(tab);
  tab.goto=async url=>{await navigate(url);throw Error('Timed out waiting for Page.navigate');};
  const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:1});
  assert.equal(result.counts.pages,1);assert.equal(sink.captures.length,1);
  const wrong=new FakeTab({pages:1});wrong.goto=async()=>{wrong.url='https://example.invalid/';throw Error('navigation failed');};
  const wrongSink=new FakeSink(wrong);
  await assert.rejects(runBoardCapture({tab:wrong,sink:wrongSink,source:'tanqeeb'}),/navigation failed/);
  assert.equal(wrongSink.captures.length,0);
  const existing=new FakeTab({pages:1});existing.url=TQ;
  await runBoardCapture({tab:existing,sink:new FakeSink(existing),source:'tanqeeb',maxPages:1});
  assert.equal(existing.calls.filter(x=>x[0]==='goto').length,0);
});

test('committed detail and native Next host timeouts still require approved identities and normal readiness',async()=>{
  const url='https://forasna.com/job/p/constructed-east-100001';
  const tab=new FakeTab({source:'forasna',pages:1});const go=tab.goto.bind(tab);
  tab.goto=async target=>{await go(target);tab.url=target===url?url.replace('east','expanded-east'):target;throw Error('host navigation timeout');};
  const sink=new FakeSink(tab,{queue:[{url}]});sink.done=true;
  const result=await runBoardCapture({tab,sink,source:'forasna',collectDetails:true});
  assert.equal(result.counts.details,1);assert.equal(sink.details.length,1);
  const list=new FakeTab({pages:2});const nativeControl=list.control.bind(list);
  list.control=selector=>{const control=nativeControl(selector),click=control.click;return {...control,click:async()=>{await click();if(selector.includes('Next'))throw Error('host click timeout');}};};
  const listSink=new FakeSink(list);const listed=await runBoardCapture({tab:list,sink:listSink,source:'tanqeeb',maxPages:2});
  assert.equal(listed.counts.pages,2);assert.equal(listSink.captures.length,2);
  const failed=new FakeTab({pages:2});const badControl=failed.control.bind(failed);
  failed.control=selector=>{const control=badControl(selector),click=control.click;return {...control,click:async()=>{if(selector.includes('Next'))throw Error('native click failed');await click();}};};
  await assert.rejects(runBoardCapture({tab:failed,sink:new FakeSink(failed),source:'tanqeeb',maxPages:2}),/native click failed/);
});

test('canonical detail hydration waits for the verified body container and preserves timeout limits',async()=>{
  for (const source of ['tanqeeb','forasna']) {
    const url=source==='tanqeeb'?'https://egypt.tanqeeb.com/jobs-in-middle-east/all/jobs/0100001.html':'https://forasna.com/job/p/constructed-east-100001';
    const tab=new FakeTab({source,pages:1});tab.detailHydrating=true;
    const sink=new FakeSink(tab,{queue:[{url}]});sink.done=true;
    const result=await runBoardCapture({tab,sink,source,collectDetails:true});
    assert.equal(result.counts.details,1);assert.equal(sink.details.length,1);
    const waits=tab.calls.filter(x=>x[0]==='waitFor');
    assert.equal(waits.length,1);assert.equal(waits[0][1],source==='tanqeeb'?'#jobDescriptionBody':'.job-more-info');
    assert.equal(waits[0][2].state,'visible');assert.ok(waits[0][2].timeoutMs<=10000);
    const timeout=new FakeTab({source,pages:1});timeout.detailHydrating=true;timeout.detailHydrationTimeout=true;
    const blocked=new FakeSink(timeout,{queue:[{url}]});blocked.done=true;
    const limited=await runBoardCapture({tab:timeout,sink:blocked,source,collectDetails:true});
    assert.equal(limited.status,'detail_hydration_timeout');assert.equal(blocked.details.length,0);
    assert.equal(blocked.queue.length,1);assert.equal(timeout.calls.filter(x=>x[0]==='waitFor').length,1);
  }
});

// A checked model can remain while a native Next loads the entire inventory.
// One Contract row prevents the old all-FT heuristic from detecting this race.
class ScopeTab extends FakeTab {
  constructor({persistent=false,liveCounts=false,race=false}={}) {
    super({pages:3});Object.assign(this,{persistent,liveCounts,forceScopeDrift:false});
    if (race) {
      const evaluate=this.playwright.evaluate;
      this.playwright.evaluate=async(fn,args)=>{
        const result=await evaluate(fn,args);
        if (fn.name==='captureEgyptBoardDOM' && this.applied===1) this.forceScopeDrift=true;
        return result;
      };
    }
  }
  state() {
    const state=super.state();
    const drift=(this.page===2 || this.forceScopeDrift) && (this.persistent || this.applied===1);
    const total=this.liveCounts && this.page>1 ? 365 : 364;
    state.native_result_scope={facet_counts:[
      {name:'refine[job_types][]',value:'2',count:total},
      {name:'refine[workplaces][]',value:'',count:drift?59197:total},
      {name:'refine[search_period]',value:'0',count:drift?59197:total},
    ],pagination_pages:[this.page,this.page+1,drift?500:19]};
    if (drift) {
      state.rows[0].type='Full Time';
      state.rows.push({id:'199999',type:'Contract',country:'Egypt',closed:'0',url:'https://egypt.tanqeeb.com/jobs-in-egypt/all/jobs/0199999.html'});
      state.stable_ids=state.rows.map(row=>row.id);
    }
    state.fingerprint=JSON.stringify({page:this.page,controls:state.controls,rows:state.rows,native_result_scope:state.native_result_scope});
    return state;
  }
}

test('native Next cohort drift is saved diagnostically and recovered through native controls before commit',async()=>{
  const tab=new ScopeTab();const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:4});
  assert.equal(result.counts.recoveries,1);
  assert.deepEqual(sink.captures.map(x=>x.state.native_page_number),[1,1,2,3]);
  assert.ok(sink.captures.every(x=>x.state.rows.every(row=>row.type==='Part Time')));
  const diagnostic=sink.limits.find(x=>x.reason==='native_result_scope_drift');
  assert.ok(diagnostic);
  assert.equal(JSON.parse(diagnostic.diagnostic_capture.html).native_result_scope.facet_counts[1].count,59197);
  assert.deepEqual(JSON.parse(diagnostic.diagnostic_capture.html).rows.map(row=>row.type),['Full Time','Contract']);
  assert.equal(tab.applied,2);assert.equal(sink.done,true);
});

test('persistent Tanqeeb result drift stays incomplete after one bounded native seed recovery',async()=>{
  const tab=new ScopeTab({persistent:true});const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:4});
  assert.equal(result.status,'native_result_scope_drift');assert.equal(result.counts.recoveries,1);
  assert.deepEqual(sink.captures.map(x=>x.state.native_page_number),[1,1]);
  assert.equal(sink.done,false);assert.equal(result.coverage_complete,false);
  assert.equal(sink.limits.filter(x=>x.reason==='native_result_scope_drift').length,2);
});

test('live coherent Tanqeeb result counts are observed rather than pinned to the first page',async()=>{
  const tab=new ScopeTab({liveCounts:true});tab.applied=2;
  const sink=new FakeSink(tab);const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:3});
  assert.equal(result.counts.recoveries,0);
  assert.deepEqual(sink.captures.map(x=>x.state.native_result_scope.facet_counts[0].count),[364,365,365]);
  assert.equal(sink.done,true);
});

test('inspection-to-capture result-scope races never commit the unchecked native cohort',async()=>{
  const tab=new ScopeTab({race:true});const sink=new FakeSink(tab);
  const result=await runBoardCapture({tab,sink,source:'tanqeeb',maxPages:3});
  assert.equal(result.counts.recoveries,1);
  assert.ok(sink.captures.every(x=>x.state.native_result_scope.facet_counts[1].count===x.state.native_result_scope.facet_counts[0].count));
  assert.equal(sink.limits.filter(x=>x.reason==='native_result_scope_drift').length,1);
});
