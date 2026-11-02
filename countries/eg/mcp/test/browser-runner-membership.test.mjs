import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectBoardDOM,membership} from '../browser-runner.mjs';

const page = (types=[]) => ({
  country:{value:'مصر',text:'Egypt'},
  controls:[{name:'Egypt-country',value:true},{name:'half-day',value:types.includes('نصف-يوم-jobtype')},
    ...types.map(value=>({name:'selected-jobtype',value}))],
  rows:[{id:'999001',url:'https://forasna.com/job/p/synthetic-example-999001',type:'يوم كامل'}],
});

test('Forasna broad inventory accepts the observed native All selection', () => {
  assert.equal(membership(page(['الكل-jobtype']),'forasna','all'),null);
  assert.equal(membership(page(),'forasna','all'),null);
});

test('Forasna broad inventory still refuses restrictive types and foreign scope', () => {
  for (const type of ['نصف-يوم-jobtype','يوم-كامل-jobtype','عمل-من-المنزل-jobtype','عمل-حر-jobtype']) {
    assert.equal(membership(page([type]),'forasna','all'),'selected_filter_drift');
  }
  assert.equal(membership(page(['الكل-jobtype','نصف-يوم-jobtype']),'forasna','all'),'selected_filter_drift');
  const foreign=page(['الكل-jobtype']); foreign.country.value='السعودية';
  assert.equal(membership(foreign,'forasna','all'),'selected_filter_drift');
});

test('Forasna priority still refuses full-time-only returned membership', () => {
  assert.equal(membership(page(['نصف-يوم-jobtype']),'forasna','part_time'),'native_membership_drift');
  const half=page(['نصف-يوم-jobtype']); half.rows[0].type='نصف يوم';
  assert.equal(membership(half,'forasna','part_time'),null);
});

test('Forasna All selection does not suppress barriers or unsettled cards', () => {
  assert.equal(membership({...page(['الكل-jobtype']),gate:'challenge'},'forasna','all'),'source_barrier');
  assert.equal(membership({...page(['الكل-jobtype']),rows:[]},'forasna','all'),'unsettled_or_changed_markup');
  const missingId=page(['الكل-jobtype']); missingId.rows[0].id='';
  assert.equal(membership(missingId,'forasna','all'),'unsettled_or_changed_markup');
});

const tanqeeb = ({model='2',total=364,resultTotal=total,pages=[1,2,19],types=['Part Time','Contract','New native label','Full Time / Part Time']}={}) => ({
  country:{value:'213',text:'Egypt'},native_page_number:1,
  controls:[{name:'refine[job_types][]',value:model},{name:'refine[order_by]',value:'most_recent'}],
  native_result_scope:{facet_counts:[
    {name:'refine[job_types][]',value:model,count:total},
    {name:'refine[workplaces][]',value:'',count:resultTotal},
    {name:'refine[search_period]',value:'0',count:resultTotal},
  ],pagination_pages:pages},
  rows:types.map((type,n)=>({id:String(100001+n),url:`https://egypt.tanqeeb.com/jobs-in-egypt/all/jobs/0${100001+n}.html`,type,country:'Egypt'})),
});

test('Tanqeeb checked PT cannot qualify a broad returned cohort with inconsistent facet totals',()=>{
  const state=tanqeeb({resultTotal:59197,pages:[1,2,500],types:[...Array(19).fill('Full Time'),'Contract']});
  assert.equal(membership(state,'tanqeeb','part_time'),'native_result_scope_drift');
});

test('coherent Tanqeeb facet counts preserve mixed, unknown and contradictory model rows',()=>{
  for (const total of [364,365]) {
    const state=tanqeeb({total});
    assert.equal(membership(state,'tanqeeb','part_time'),null);
    assert.deepEqual(state.rows.map(row=>row.type),['Part Time','Contract','New native label','Full Time / Part Time']);
  }
  assert.equal(membership(tanqeeb({model:'-1',total:59197,pages:[1,2,500]}),'tanqeeb','all'),null);
});

test('Tanqeeb pager bounds use the result count without guessing a fixed page size',()=>{
  assert.equal(membership(tanqeeb({pages:[1,2,500]}),'tanqeeb','part_time'),'native_result_scope_drift');
  assert.equal(membership(tanqeeb({total:0,pages:[1]}),'tanqeeb','part_time'),'native_result_scope_drift');
  const noCounts=tanqeeb();delete noCounts.native_result_scope;
  assert.equal(membership(noCounts,'tanqeeb','part_time'),null);
});

test('Tanqeeb DOM inspection retains only selected public facet counts and real numeric pager evidence',()=>{
  const original=globalThis.document;
  const selected=[
    {name:'refine[job_types][]',value:'2',labels:[{innerText:'Part Time (364)'}]},
    {name:'refine[workplaces][]',value:'',labels:[{innerText:'All (59,197)'}]},
    {name:'refine[search_period]',value:'0',labels:[{innerText:'All Time (59,197)'}]},
    {name:'refine[order_by]',value:'most_recent',labels:[{innerText:'Most Recent'}]},
    {name:'csrf_token',value:'EXCLUDED',labels:[{innerText:'Not public scope (123)'}]},
  ];
  const pager=['Previous','4','5','6','500','Next'].map(innerText=>({innerText,getAttribute:()=>null,getClientRects:()=>[{}],closest:()=>null}));
  try {
    globalThis.document={
      location:{href:'https://egypt.tanqeeb.com/jobs/search/page/5?keywords=&country=213&state=0&lang=all'},
      title:'Jobs in Egypt',body:{innerText:''},
      querySelector:()=>({value:'213',textContent:'Egypt'}),
      querySelectorAll:selector=>selector==='input:checked,select option:checked'?selected:selector.includes('Search Results Navigation')?pager:[],
    };
    const result=inspectBoardDOM({source:'tanqeeb'});
    assert.deepEqual(result.native_result_scope.facet_counts.map(row=>row.count),[364,59197,59197]);
    assert.deepEqual(result.native_result_scope.pagination_pages,[4,5,6,500]);
    assert.ok(!JSON.stringify(result).includes('EXCLUDED'));
    assert.ok(result.fingerprint.includes('59197'));
  } finally {globalThis.document=original;}
});
