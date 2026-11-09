/**
 * Native public-source acquisition INSIDE an authorized CUA REPL session.
 *
 * Inject an already-authorized CUA Tab and a trusted private sink. This module
 * never launches a browser, reads credentials/storage, fetches a URL itself or
 * uses CDP. Every evaluate function is self-contained and DOM-read-only; native
 * actions use documented Tab/Locator methods. Raw captures go only to the sink.
 */
import { captureEgyptBoardDOM } from './browser-extract.mjs';

export const BROWSER_RUNNER_VERSION = '0.1.3';
const TANQEEB_MODELS = {
  part_time: { value:'2', label:'Part Time' },
  internship: { value:'5', label:'Internship' },
  freelance_project: { value:'7', label:'Freelance/ Project' },
  all: { value:'-1', label:'All' },
};
const TANQEEB_SEED = 'https://egypt.tanqeeb.com/jobs/search?keywords=&country=213&state=0&lang=all&order_by=most_recent';
const FORASNA_SEED = 'https://forasna.com/وظائف-خالية';

export function browserCapturePlan({source,workModel='part_time'}) {
  if (!['tanqeeb','forasna'].includes(source) || (source==='tanqeeb' ? !TANQEEB_MODELS[workModel] : !['part_time','all'].includes(workModel))) throw Error('Unsupported verified source/model');
  const initial_url=source==='tanqeeb' ? TANQEEB_SEED : FORASNA_SEED+'?'+new URLSearchParams({'filters[country][0]':'مصر',...(workModel==='part_time' ? {'filters[jobType][0]':'نصف يوم'} : {})});
  return {runner_version:BROWSER_RUNNER_VERSION,source,work_model:workModel,initial_url,
    execution_runtime:'authorized_cua_repl_with_injected_tab_and_private_sink',
    native_filter_plan:{native_work_model:workModel,country:'Egypt',transport:'public_dom'},
    controls:source==='tanqeeb' ? {country:'select#countryHeader[name="country"] option:checked',country_value:'213',order_label:'label[for="refine_search_order_by_most_recent"]',order_value:'most_recent',model_label:`label[for="filter_job_type_${TANQEEB_MODELS[workModel].value}"]`,model_value:TANQEEB_MODELS[workModel].value} : {country:'[id="مصر-country"]',part_time:'[id="نصف-يوم-jobtype"]'},
    sequence:source==='tanqeeb' ? ['open explicit newest-first Egypt inventory','verify native country/order','apply native work model last','settle actual native rows','persist through private sink','click actual native Next and verify new rows'] : ['open exact native Egypt query','verify selected public country/type controls','settle actual native rows','persist through private sink','click actual visible Next and verify actual URL/page/IDs'],
    limits:['A native priority model is not a whole compatibility universe. Unknown/mixed/contradictory complements remain separately required.','Budgets return resumable acquisition, never whole-market or frozen-interval completeness.']};
}

function publicURL(source, value, kind='page', workModel='part_time') {
  const url = new URL(value);
  const host = source === 'tanqeeb' ? 'egypt.tanqeeb.com' : 'forasna.com';
  const disclosure=source==='tanqeeb' && kind==='page' && ['#order-by-wrap','#job-type-wrap'].includes(url.hash);
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password || (url.hash && !disclosure)) throw Error('Public source URL scope changed');
  if (disclosure) url.hash='';
  if (kind === 'detail') {
    const route = source === 'tanqeeb' ? /^\/jobs-in-(?:egypt|middle-east)\/all\/jobs\/0?[1-9]\d*\.html$/ : /^\/job\/p\/[^/]+-\d+$/;
    if (!route.test(url.pathname) || url.search) throw Error('Canonical public detail required');
    return url.href;
  }
  const keys = [...url.searchParams.keys()];
  if (keys.some(key => url.searchParams.getAll(key).length !== 1)) throw Error('Duplicate native source filters');
  if (source === 'tanqeeb') {
    if (!/^\/jobs\/search(?:\/page\/[1-9]\d*)?$/.test(url.pathname) || keys.some(key=>!['keywords','country','state','lang','order_by'].includes(key)) || url.searchParams.get('country') !== '213' || url.searchParams.get('keywords') !== '' || url.searchParams.get('state') !== '0' || url.searchParams.get('lang') !== 'all' || ![null,'most_recent'].includes(url.searchParams.get('order_by'))) throw Error('Whole-Egypt blank-query Tanqeeb scope required');
  } else {
    const path = url.pathname.toLowerCase();
    if (!['/وظائف-خالية','/%d9%88%d8%b8%d8%a7%d8%a6%d9%81-%d8%ae%d8%a7%d9%84%d9%8a%d8%a9'].includes(path) || keys.some(key=>!['start','filters[country][0]','filters[jobType][0]'].includes(key)) || url.searchParams.get('filters[country][0]') !== 'مصر' || (workModel === 'part_time' ? url.searchParams.get('filters[jobType][0]') !== 'نصف يوم' : url.searchParams.has('filters[jobType][0]'))) throw Error('Explicit Egypt and verified native Forasna model required');
    const offset = url.searchParams.get('start');
    if (offset !== null && (!/^\d+$/.test(offset) || Number(offset)>200000)) throw Error('Invalid native source position');
  }
  return url.href;
}

function detailIdentity(source,value) {
  const url=new URL(publicURL(source,value,'detail'));
  const id=source==='tanqeeb' ? url.pathname.match(/\/(\d+)\.html$/)[1].replace(/^0+(?=\d)/,'') : url.pathname.match(/-(\d+)$/)[1];
  return {url:url.href,id};
}

/** Compact public DOM only. No full job descriptions are returned here. */
export function inspectBoardDOM({source}) {
  const url = new URL(document.location.href);
  const expected = source === 'tanqeeb' ? 'egypt.tanqeeb.com' : 'forasna.com';
  const observed_ui_hash=url.hash;
  const disclosure=source==='tanqeeb' && ['#order-by-wrap','#job-type-wrap'].includes(url.hash);
  if (url.protocol !== 'https:' || url.hostname !== expected || url.username || url.password || url.port || (url.hash && !disclosure)) throw Error('Wrong public source surface');
  if (disclosure) url.hash='';
  const visible = node => Boolean(node && !node.hidden && node.getAttribute('aria-hidden')!=='true' && node.getClientRects().length);
  const normalize = text => String(text || '').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,' ').trim();
  const rows = [];
  let controls = [], country=null, page=null, nextNode=null, native_result_scope=null;
  if (source === 'tanqeeb') {
    if (!/^\/jobs\/search(?:\/page\/[1-9]\d*)?$/.test(url.pathname)) throw Error('Public inventory path required');
    const selected = document.querySelector('select#countryHeader[name="country"] option:checked');
    country = selected ? {value:selected.value,text:normalize(selected.textContent)} : null;
    controls = Array.from(document.querySelectorAll('input:checked,select option:checked')).filter(node=>['refine[job_types][]','refine[order_by]','refine[workplaces][]','refine[search_period]'].includes(node.name || node.parentElement?.name)).map(node=>({name:node.name || node.parentElement.name,value:node.value})).sort((a,b)=>(a.name+a.value).localeCompare(b.name+b.value));
    // These live public counts describe the returned cohort, not the immutable
    // query identity. A checked PT control can survive a native Next while the
    // default facets and pager have already reverted to the broad inventory.
    const facet_counts=Array.from(document.querySelectorAll('input:checked,select option:checked')).filter(node=>['refine[job_types][]','refine[workplaces][]','refine[search_period]'].includes(node.name || node.parentElement?.name)).map(node=>{
      const label=normalize(node.labels?.[0]?.innerText || node.textContent);
      const digits=label.match(/\(([\d,]+)\)\s*$/)?.[1];
      const count=digits===undefined ? null : Number(digits.replace(/,/g,''));
      return {name:node.name || node.parentElement.name,value:node.value,label,count:Number.isSafeInteger(count) && count>=0 ? count : null};
    });
    const pagination_pages=Array.from(document.querySelectorAll('[aria-label="Search Results Navigation"] a')).filter(visible).map(node=>normalize(node.innerText)).filter(text=>/^[1-9]\d*$/.test(text)).map(Number).filter(Number.isSafeInteger);
    native_result_scope={facet_counts,pagination_pages};
    for (const node of document.querySelectorAll('article[data-job-id]')) if (visible(node)) {
      const anchor=node.querySelector('h2 a[href]');
      rows.push({id:node.getAttribute('data-job-id'),type:normalize(node.getAttribute('data-job-type')),country:normalize(node.getAttribute('data-job-country')),closed:node.getAttribute('data-job-closed'),url:anchor?.href || null,part_time_contradiction:/part[ -]?time|نصف\s+يوم|دوام\s+جزئي/i.test(normalize(node.innerText))});
    }
    page = Number(url.pathname.match(/\/page\/(\d+)$/)?.[1] || 1);
    nextNode = Array.from(document.querySelectorAll('[aria-label="Search Results Navigation"] a')).find(node=>normalize(node.innerText)==='Next' && visible(node));
  } else {
    const path=url.pathname.toLowerCase();
    if (!['/وظائف-خالية','/%d9%88%d8%b8%d8%a7%d8%a6%d9%81-%d8%ae%d8%a7%d9%84%d9%8a%d8%a9'].includes(path)) throw Error('Public inventory path required');
    const egypt=document.querySelector('[id="مصر-country"]');
    const half=document.querySelector('[id="نصف-يوم-jobtype"]');
    controls=[{name:'Egypt-country',value:Boolean(egypt?.checked)},{name:'half-day',value:Boolean(half?.checked)},...Array.from(document.querySelectorAll('input[id$="-jobtype"]:checked')).map(node=>({name:'selected-jobtype',value:node.id}))];
    country={value:url.searchParams.get('filters[country][0]'),text:egypt?.checked ? 'Egypt' : null};
    for (const anchor of document.querySelectorAll('h2.job-title a[href]')) {
      const node=anchor.closest('.item-details');
      if (!visible(node)) continue;
      const types=Array.from(node.querySelectorAll('.job-details a')).map(tag=>normalize(tag.innerText)).filter(value=>['نصف يوم','يوم كامل','عمل حر','عمل من المنزل','موسمية'].includes(value));
      rows.push({id:new URL(anchor.href).pathname.match(/-(\d+)$/)?.[1] || null,type:types.join(' / '),country:null,closed:null,url:anchor.href,part_time_contradiction:types.includes('نصف يوم')});
    }
    const active=document.querySelector('ul.pagination li.pag-current');
    const text=normalize(active?.innerText);
    page=/^\d+$/.test(text) ? Number(text) : url.searchParams.has('start') ? null : 1;
    nextNode=Array.from(document.querySelectorAll('ul.pagination li.pag-next a')).find(visible);
  }
  const disabled=Boolean(nextNode && (nextNode.getAttribute('aria-disabled')==='true' || nextNode.closest('.disabled')));
  const next={visible:Boolean(nextNode),enabled:Boolean(nextNode && !disabled),href:nextNode?.href || null};
  const title=normalize(document.title);
  const publicText=rows.length ? '' : normalize(document.body?.innerText).slice(0,1500);
  const gate=!rows.length && (/^(?:403|access denied|forbidden|just a moment)/i.test(title) || /verify (?:that )?you are human|checking your browser|complete (?:the )?security check/i.test(publicText));
  const ids=rows.map(row=>row.id);
  return {url:url.href,observed_ui_hash,country,controls,native_page_number:page,rows,stable_ids:ids,next,gate,native_result_scope,
    fingerprint:JSON.stringify({page,controls,country,native_result_scope,rows:rows.map(({id,type,country,closed})=>({id,type,country,closed}))})};
}

/** Readiness of an exact canonical detail, without returning its full body. */
export function inspectDetailDOM({source,expectedURL}) {
  if (!['tanqeeb','forasna'].includes(source)) throw Error('Unsupported public source');
  const current=new URL(document.location.href);
  const expected=new URL(expectedURL);
  const host=source==='tanqeeb' ? 'egypt.tanqeeb.com' : 'forasna.com';
  const path=source==='tanqeeb' ? /^\/jobs-in-(?:egypt|middle-east)\/all\/jobs\/0?[1-9]\d*\.html$/ : /^\/job\/p\/[^/]+-\d+$/;
  for (const url of [current,expected]) if (url.protocol!=='https:' || url.hostname!==host || !path.test(url.pathname) || url.search || url.username || url.password || url.port || url.hash) throw Error('Canonical detail identity changed');
  const sourceID=url=>source==='tanqeeb' ? url.pathname.match(/\/(\d+)\.html$/)[1].replace(/^0+(?=\d)/,'') : url.pathname.match(/-(\d+)$/)[1];
  // Native public routes can canonicalize a title/location slug. Only an
  // unchanged terminal source ID on the same approved route/host is an alias.
  if (sourceID(current)!==sourceID(expected)) throw Error('Canonical detail identity changed');
  const title=document.querySelector(source==='tanqeeb' ? 'h3.job-title-text' : 'h1');
  let body=null,requirements=true;
  if (source==='tanqeeb') body=document.querySelector('#jobDescriptionBody');
  else {
    const headings=Array.from(document.querySelectorAll('h3'));
    const heading=headings.find(node=>node.innerText.trim()==='تفاصيل الوظيفة');
    body=heading?.parentElement?.parentElement?.querySelector('.job-more-info');
    requirements=headings.some(node=>node.innerText.trim()==='متطلبات الوظيفة');
  }
  // Forasna can expose the genuine description section with no public task
  // text. Capture that evidence; private intake decides whether a brief is
  // usable. A missing section still signals changed/incomplete markup.
  const body_characters=body ? String(body.innerText || '').trim().length : null;
  const empty_description=body_characters===0;
  const ready=Boolean(title?.innerText.trim() && body && requirements && (source==='forasna' || body_characters>0));
  const gate=!ready && (/^(?:403|access denied|forbidden|just a moment)/i.test(document.title || '') || /verify (?:that )?you are human|checking your browser|complete (?:the )?security check/i.test(String(document.body?.innerText || '').slice(0,1500)));
  return {url:current.href,ready,gate,body_characters,empty_description,fingerprint:JSON.stringify({url:current.href,title:title?.innerText.trim(),body_characters,requirements})};
}

export function membership(state, source, model) {
  if (state.gate) return 'source_barrier';
  if (!state.rows.length || state.rows.some(row=>!row.id || !row.url)) return 'unsettled_or_changed_markup';
  if (source === 'tanqeeb') {
    if (state.country?.value!=='213' || state.country?.text!=='Egypt') return 'country_drift';
    const values=state.controls.filter(row=>row.name==='refine[job_types][]').map(row=>row.value);
    if (values.length!==1 || values[0]!==TANQEEB_MODELS[model].value || state.controls.filter(row=>row.name==='refine[order_by]' && row.value==='most_recent').length!==1) return 'selected_filter_drift';
    if (state.controls.some(row=>(row.name==='refine[workplaces][]' && row.value!=='') || (row.name==='refine[search_period]' && row.value!=='0'))) return 'selected_filter_drift';
    const facets=state.native_result_scope?.facet_counts || [];
    const models=facets.filter(row=>row.name==='refine[job_types][]' && Number.isSafeInteger(row.count) && row.count>=0);
    if (models.length===1) {
      const total=models[0].count;
      const defaults=facets.filter(row=>(row.name==='refine[workplaces][]' && row.value==='') || (row.name==='refine[search_period]' && row.value==='0'));
      if (defaults.some(row=>Number.isSafeInteger(row.count) && row.count>=0 && row.count!==total)) return 'native_result_scope_drift';
      // Every nonempty native page needs at least one result. This bound does
      // not assume a page size or reject a legitimate mixed/unknown card type.
      const pages=[state.native_page_number,...(state.native_result_scope?.pagination_pages || [])].filter(Number.isSafeInteger);
      if (total===0 || pages.some(page=>page>total)) return 'native_result_scope_drift';
    }
    if (model!=='all' && state.rows.every(row=>/^full[ -]?time$/i.test(row.type) && !row.part_time_contradiction)) return 'native_membership_drift';
    if (state.rows.every(row=>row.country && row.country!=='Egypt')) return 'native_country_membership_drift';
  } else {
    if (state.country?.value!=='مصر' || state.country?.text!=='Egypt' || !state.controls.find(row=>row.name==='Egypt-country')?.value || (model==='part_time' && !state.controls.find(row=>row.name==='half-day')?.value)) return 'selected_filter_drift';
    // Forasna explicitly checks its native All option in an unfiltered type
    // inventory. Only a restrictive type selection is scope drift.
    if (model==='all' && (state.controls.find(row=>row.name==='half-day')?.value || state.controls.some(row=>row.name==='selected-jobtype' && row.value!=='الكل-jobtype'))) return 'selected_filter_drift';
    if (model==='part_time' && state.rows.every(row=>row.type==='يوم كامل' && !row.part_time_contradiction)) return 'native_membership_drift';
  }
  return null;
}

function compact(state) {
  const models={};
  for (const row of state.rows || []) models[row.type || 'unknown']=(models[row.type || 'unknown'] || 0)+1;
  return {url:state.url,observed_ui_hash:state.observed_ui_hash || null,native_page_number:state.native_page_number,raw_count:state.rows?.length || 0,models,stable_ids:state.stable_ids,next:state.next,native_result_scope:state.native_result_scope || null};
}

async function fresh(tab) {
  await tab.playwright.domSnapshot();
}

async function tabURL(tab) {
  return typeof tab.url==='function' ? await tab.url() : tab.url;
}

async function navigate(tab,source,target,kind,model) {
  const expected=publicURL(source,target,kind,model);
  let current=await tabURL(tab);
  if (current===expected) {await fresh(tab);return;}
  try {await tab.goto(expected);}
  catch (error) {
    // Some browser hosts time out after committing navigation. Accept only an
    // observed approved destination identity; readiness/membership still runs.
    current=await tabURL(tab);
    let reached=false;
    try {reached=kind==='detail' ? detailIdentity(source,current).id===detailIdentity(source,expected).id : publicURL(source,current,kind,model)===expected;} catch { /* A foreign/account/different route cannot satisfy navigation. */ }
    if (!reached) throw error;
  }
  await fresh(tab);
}

async function initialize(tab, source, model, seed) {
  await navigate(tab,source,seed,'page',model);
  if (source!=='tanqeeb') return;
  // Sorting first, model last is essential: sort-last preserved a PT checkbox
  // while returning an entire FT page in a real development diagnostic.
  let state=await tab.playwright.evaluate(inspectBoardDOM,{source});
  if (state.gate) return;
  if (!state.controls.some(row=>row.name==='refine[order_by]' && row.value==='most_recent')) {
    const label=tab.playwright.locator('label[for="refine_search_order_by_most_recent"]');
    if (!await label.isVisible()) {await tab.playwright.getByRole('button',{name:/^Order By/}).click(); await fresh(tab);}
    await label.click(); await fresh(tab);
  }
  const desired=TANQEEB_MODELS[model].value;
  const label=tab.playwright.locator(`label[for="filter_job_type_${desired}"]`);
  if (!await label.isVisible()) {await tab.playwright.getByRole('button',{name:/^Job Type/}).click(); await fresh(tab);}
  state=await tab.playwright.evaluate(inspectBoardDOM,{source});
  const selected=state.controls.filter(row=>row.name==='refine[job_types][]').map(row=>row.value);
  if (selected.length===1 && selected[0]===desired && model!=='all') {
    // A retained cookie/UI selection might not have been effectively applied.
    // Reset through the actual native All control, then apply desired last.
    await tab.playwright.locator('label[for="filter_job_type_-1"]').click(); await fresh(tab);
  }
  if (!(model==='all' && selected.length===1 && selected[0]==='-1')) {await label.click(); await fresh(tab);}
}

async function settled(tab, source, model, deadline, previous, expectedPage) {
  let prior=null, last=null, lastReason='unsettled_or_changed_markup',hydrationWaited=false;
  for (let probe=0;probe<12 && Date.now()<deadline;probe+=1) {
    await fresh(tab);
    const state=await tab.playwright.evaluate(inspectBoardDOM,{source});
    state.url=publicURL(source,state.url,'page',model);
    last=state;
    const reason=membership(state,source,model);
    if (reason==='source_barrier') return {state,reason};
    if (!state.rows.length && !hydrationWaited) {
      hydrationWaited=true;
      const remaining=deadline-Date.now();
      if (remaining<=0) return {state,reason:'time_budget'};
      // Native navigation can paint the inventory shell before hydrating its
      // cards. Wait on the verified visible card anchor, not a fixed sleep or
      // repeated instantaneous metadata probes.
      const selector=source==='tanqeeb' ? 'article[data-job-id] h2 a[href]' : 'h2.job-title a[href]';
      try {await tab.playwright.locator(selector).first().waitFor({state:'visible',timeoutMs:Math.min(10000,remaining)});}
      catch {return {state,reason:Date.now()>=deadline ? 'time_budget' : 'native_hydration_timeout'};}
      prior=null;continue;
    }
    const pageChanged=!expectedPage || state.native_page_number===expectedPage;
    const newIDs=!previous || state.stable_ids.some(id=>!previous.stable_ids.includes(id));
    if (!reason && pageChanged && newIDs && prior===state.fingerprint) return {state,reason:null};
    prior=!reason && pageChanged && newIDs ? state.fingerprint : null;
    lastReason=reason || (!pageChanged ? 'native_page_did_not_advance' : !newIDs ? 'native_page_repeated' : 'unsettled_or_changed_markup');
  }
  return {state:last,reason:Date.now()>=deadline ? 'time_budget' : lastReason};
}

async function next(tab,source,model,expectedPage,deadline,observedHref) {
  const control=source==='tanqeeb'
    ? tab.playwright.getByRole('link',{name:'Next',exact:true})
    : tab.playwright.locator('ul.pagination li.pag-next a');
  if (!await control.isVisible() || !await control.isEnabled()) throw Error('Native Next is unavailable');
  let target=null;
  if (source==='tanqeeb') {
    // Tanqeeb's observed native href identifies the next document. A click can
    // return before navigation commits, leaving the previous cards visible.
    // Await the documented navigation event before the normal DOM checks.
    // Forasna deliberately retains its click-only path: its href offsets are
    // not equivalent to the actual hydrated continuation.
    if (!observedHref) throw Error('Tanqeeb native Next has no observed href');
    target=publicURL(source,observedHref,'page',model);
    const page=Number(new URL(target).pathname.match(/\/page\/(\d+)\/?$/)?.[1]);
    if (!Number.isSafeInteger(expectedPage) || expectedPage<2 || page!==expectedPage) throw Error('Tanqeeb native Next href differs from the expected page');
    if (typeof tab.playwright.expectNavigation!=='function') throw Error('Tanqeeb Next requires documented navigation readiness support');
  }
  const remaining=deadline-Date.now();
  if (remaining<=0) return false;
  const timeoutMs=Math.min(10000,remaining);
  try {
    if (source==='tanqeeb') {
      await tab.playwright.expectNavigation(()=>control.click({timeoutMs}),
        {url:target,waitUntil:'commit',timeoutMs});
    } else await control.click();
  }
  catch (error) {
    let reached=false;
    try {
      const destination=publicURL(source,await tabURL(tab),'page',model);
      if (source==='tanqeeb') {
        // A committed document may still be an empty shell. Exact destination
        // recovery only hands off to settled(), which checks the new cards.
        reached=destination===target;
      } else {
        await fresh(tab);
        const actual=await tab.playwright.evaluate(inspectBoardDOM,{source});
        reached=Boolean(expectedPage && actual.native_page_number===expectedPage);
      }
    } catch { /* A changed/foreign identity cannot satisfy native Next. */ }
    if (!reached) throw error;
  }
  await fresh(tab);
  return true;
}

function report(reason, counts, extra={}) {
  return {runner_version:BROWSER_RUNNER_VERSION,status:reason,counts,...extra,coverage_complete:false,reviewed_by_model:false};
}

function continuationOf(status) {return status?.source_continuation || status?.continuation || null;}
function detailsOf(status) {return Array.isArray(status?.detail_queue) ? status.detail_queue : Array.isArray(status?.verification_queue) ? status.verification_queue : [];}
function listingStopped(status) {return Boolean(status?.listing_terminal_observed || status?.listing_terminal || status?.done);}
function assertBinding(status,source,model) {
  const context=status?.context || status;
  if (context?.source!==source) throw Error('Sink source binding differs');
  const plan=status.native_filter_plan || context.query || {};
  const selected=plan.native_work_model || plan.work_model || plan.workModel;
  if (selected && (selected==='freelance' ? 'freelance_project' : selected)!==model) throw Error('Sink native model binding differs');
}

/**
 * Run automatic native filtering/capture/pagination in one bounded invocation.
 * The sink owns frozen context, immutable evidence, dedupe and person filtering.
 * Budgets pause acquisition; they never mean source exhaustion or candidate fit.
 */
export async function runBoardCapture({tab,detailTab=tab,sink,source,workModel='part_time',maxPages=20,maxMillis=45000,onProgress,collectDetails=false}) {
  if (!['tanqeeb','forasna'].includes(source) || (source==='tanqeeb' ? !TANQEEB_MODELS[workModel] : !['part_time','all'].includes(workModel))) throw Error('Unsupported verified source/model');
  if (!Number.isSafeInteger(maxPages) || maxPages<1 || !Number.isFinite(maxMillis) || maxMillis<=0 || maxMillis>45000) throw Error('Positive page budget and maxMillis<=45000 required');
  for (const method of ['status','capture','detail','limit','recover']) if (typeof sink?.[method]!=='function') throw Error('A trusted checkpointing sink is required');
  const deadline=Date.now()+maxMillis;
  const counts={pages:0,details:0,raw_cards:0,recoveries:0,replayed_pages:0,checkpoints_reused:0};
  let status=await sink.status();
  assertBinding(status,source,workModel);
  if (status.pending_capture) {status=await sink.recover();assertBinding(status,source,workModel);}
  if (status.status!=='ok') return report('sink_source_limited',counts,{continuation:continuationOf(status)});
  const seed=publicURL(source,status.initial_url || status.context?.initial_url || browserCapturePlan({source,workModel}).initial_url,'page',workModel);
  let state=null, previous=null, expectedPage=null, cursor=status.cursor || null;
  let needsInitialization=true, replaying=Boolean(cursor), replayTarget=cursor?.native_page_number || 0, driftRecoveries=0;
  const progress=async (phase,more={})=>{if (onProgress) await onProgress({phase,source,counts:{...counts},...more});};
  const limit=async (reason,more={})=>{await sink.limit({reason,source,...more});return report(reason,counts,{continuation:continuationOf(await sink.status())});};
  const capturePage=async()=>{
    const capture=await tab.playwright.evaluate(captureEgyptBoardDOM,{source,kind:'page'});
    return {url:publicURL(source,capture.url,'page',workModel),kind:capture.kind,captured_at:capture.captured_at,html:capture.html};
  };

  // Pending canonical checks can be completed automatically without visiting
  // excluded listings. They are verification, never automatic fit decisions.
  const details=async ()=>{
    let snapshot=await sink.status();
    if (snapshot.status!=='ok') return 'sink_source_limited';
    const queue=detailsOf(snapshot);
    const visited=new Set();
    for (const item of queue) {
      if (Date.now()>=deadline || counts.details>=maxPages) break;
      if (!item?.url) continue;
      const identity=detailIdentity(source,item.url),url=identity.url;
      if (visited.has(identity.id)) continue;
      visited.add(identity.id);
      await navigate(detailTab,source,url,'detail',workModel);
      let prior=null,ready=false,hydrationWaited=false;
      for (let probe=0;probe<12 && Date.now()<deadline;probe+=1) {
        await fresh(detailTab);
        const actual=await detailTab.playwright.evaluate(inspectDetailDOM,{source,expectedURL:url});
        if (actual.gate) return 'source_barrier';
        if (!actual.ready && !hydrationWaited) {
          // Scope and source ID were checked by inspectDetailDOM before this
          // locator wait. Wait for the verified public body container to paint,
          // then retain the normal two-observation readiness check.
          hydrationWaited=true;
          const remaining=deadline-Date.now();
          if (remaining<=0) return 'time_budget';
          const selector=source==='tanqeeb' ? '#jobDescriptionBody' : '.job-more-info';
          try {await detailTab.playwright.locator(selector).first().waitFor({state:'visible',timeoutMs:Math.min(10000,remaining)});}
          catch {return Date.now()>=deadline ? 'time_budget' : 'detail_hydration_timeout';}
          prior=null;continue;
        }
        if (actual.ready && prior===actual.fingerprint) {ready=true;break;}
        prior=actual.ready ? actual.fingerprint : null;
      }
      if (!ready) return Date.now()>=deadline ? 'time_budget' : 'detail_unavailable';
      let capture;
      try {capture=await detailTab.playwright.evaluate(captureEgyptBoardDOM,{source,kind:'detail'});} catch {return 'detail_unavailable';}
      if (detailIdentity(source,capture.url).id!==identity.id) throw Error('Canonical detail identity changed');
      const accepted=await sink.detail(capture);
      if (accepted?.status!=='ok') return 'detail_intake_failed';
      counts.details+=1;
      await progress('detail_persisted',{id:item.id || null});
    }
    return null;
  };
  if (Date.now()>=deadline) return limit('time_budget');
  if (collectDetails && detailsOf(status).length) {
    const reason=await details();
    if (reason) return limit(reason);
    status=await sink.status();
    if (detailsOf(status).length || Date.now()>=deadline) return limit('detail_budget');
    cursor=status.cursor || cursor;
  }
  if (listingStopped(status)) return report(status.capture_complete || status.done ? 'capture_complete' : 'metadata_phase_complete',counts,{continuation:continuationOf(status)});

  // Reuse the actual live checkpoint, or the exact observed Tanqeeb successor
  // after a navigation committed just beyond the previous invocation budget.
  // URL restoration alone never reconstructs native filter state.
  if (cursor) {
    try {
      const candidate=await tab.playwright.evaluate(inspectBoardDOM,{source});
      candidate.url=publicURL(source,candidate.url,'page',workModel);
      const samePage=(cursor.native_page_number && candidate.native_page_number===cursor.native_page_number) || (!cursor.native_page_number && candidate.url===cursor.url);
      const observedNext=cursor.source_continuation?.observed_next_control_href;
      const nextPage=Number.isSafeInteger(cursor.native_page_number) ? cursor.native_page_number+1 : null;
      const lateSuccessor=source==='tanqeeb' && nextPage!==null && typeof observedNext==='string' &&
        candidate.url===publicURL(source,observedNext,'page',workModel) &&
        Number(new URL(candidate.url).pathname.match(/\/page\/(\d+)\/?$/)?.[1])===nextPage &&
        (!candidate.rows.length || (candidate.native_page_number===nextPage &&
          candidate.stable_ids.some(id=>!(cursor.stable_ids || []).includes(id))));
      if (lateSuccessor || (samePage && !membership(candidate,source,workModel))) {
        const result=await settled(tab,source,workModel,deadline,lateSuccessor ? cursor : null,
          lateSuccessor ? nextPage : candidate.native_page_number);
        if (!result.reason) {
          state=result.state; needsInitialization=false;
          if (lateSuccessor) replaying=false;
        } else if (lateSuccessor && ['native_hydration_timeout','time_budget'].includes(result.reason)) {
          // Leave the persisted cursor intact. Seed replay would repeat all
          // accepted pages and can lose the already committed successor.
          return limit(result.reason);
        }
      }
    } catch { /* Safe source reset below, never inspect account/foreign pages. */ }
  }
  if (needsInitialization) {
    if (Date.now()>=deadline) return limit('time_budget');
    if (cursor) {
      const recovered=await sink.recover({replay_from_seed:true,reason:'Live native cursor lost; replay verified seed without discarding prior evidence'});
      if (recovered?.status!=='ok') return report('sink_source_limited',counts,{continuation:continuationOf(recovered)});
      status=recovered;counts.recoveries+=1;
    }
    await initialize(tab,source,workModel,seed);await progress('native_scope_applied');
  }

  while (counts.pages<maxPages && Date.now()<deadline) {
    if (!state) {
      const result=await settled(tab,source,workModel,deadline,previous,expectedPage);
      state=result.state;
      if (result.reason) {
        if (result.reason==='time_budget') return limit('time_budget');
        const recoverable=['native_membership_drift','native_result_scope_drift','native_country_membership_drift','selected_filter_drift','native_page_repeated','native_page_did_not_advance'].includes(result.reason);
        let diagnostic=null;
        if (state && recoverable) {
          try {diagnostic=await capturePage();} catch { /* Still preserve compact drift metadata. */ }
        }
        await sink.limit({reason:result.reason,source,diagnostic_capture:diagnostic,metadata:state ? compact(state) : null,recovery_pending:recoverable && driftRecoveries<1});
        if (!recoverable || driftRecoveries>=1) return report(result.reason,counts,{continuation:continuationOf(await sink.status())});
        counts.recoveries+=1;driftRecoveries+=1;
        const recovered=await sink.recover({replay_from_seed:true,reason:'Native filter membership drift; replay verified seed without discarding prior evidence'});
        if (recovered?.status!=='ok') return report('sink_source_limited',counts,{continuation:continuationOf(recovered)});
        replayTarget=status.cursor?.native_page_number || replayTarget;
        replaying=Boolean(replayTarget);
        status=recovered;
        await initialize(tab,source,workModel,seed); previous=null; expectedPage=null; state=null;
        continue;
      }
    }
    {
      const capture=await capturePage();
      const after=await tab.playwright.evaluate(inspectBoardDOM,{source});
      after.url=publicURL(source,after.url,'page',workModel);
      if (membership(after,source,workModel) || after.fingerprint!==state.fingerprint || capture.url!==state.url) {state=null;continue;}
      const sameCheckpoint=Boolean(status.cursor && capture.url===status.cursor.url && JSON.stringify([...state.stable_ids].sort())===JSON.stringify([...(status.cursor.stable_ids || [])].sort()));
      const accepted=await sink.capture(capture,{resume:sameCheckpoint});
      if (accepted?.status!=='ok') return report('capture_intake_failed',counts,{continuation:continuationOf(accepted)});
      // Persist the live checkpoint again so the sink can detect changed card
      // evidence even when native IDs are unchanged. It does not consume the
      // new-page budget: maxPages=1 must still advance on the next invocation.
      if (sameCheckpoint) counts.checkpoints_reused+=1;
      else counts.pages+=1;
      counts.raw_cards+=state.rows.length;
      if (replaying) counts.replayed_pages+=1;
      await progress('page_persisted',{native_page_number:state.native_page_number});
      status=await sink.status();
      if (replaying && state.native_page_number>=replayTarget) replaying=false;
    }
    if (listingStopped(status) || !state.next.visible || !state.next.enabled) {
      if (!listingStopped(status)) await sink.limit({reason:'native_no_next_observed',source,metadata:compact(state),native_terminal_observed:true,coverage_complete:false});
      if (collectDetails && Date.now()<deadline) {
        const reason=await details();
        if (reason) return limit(reason);
      }
      return report('native_no_next_observed',counts,{continuation:continuationOf(await sink.status())});
    }
    if (counts.pages>=maxPages || Date.now()>=deadline) break;
    previous=state;expectedPage=state.native_page_number ? state.native_page_number+1 : null;
    if (!await next(tab,source,workModel,expectedPage,deadline,state.next.href)) return limit('time_budget');
    state=null;
  }
  if (collectDetails && Date.now()<deadline) {
    const reason=await details();
    if (reason) return limit(reason);
  }
  return limit(Date.now()>=deadline ? 'time_budget' : 'page_budget');
}
