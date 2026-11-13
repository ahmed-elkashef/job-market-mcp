import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {germanDiscovery, runDiscovery} from '../countries/de/public-services/discovery.mjs';
import {loadRegistry, ALLOWED} from '../lib/federation.mjs';

const use = {personal_noncommercial_use: true};
function capture() {
  const calls = [];
  return {calls, run: async argv => {calls.push(argv);return {status: 'ok'};}};
}

test('student inventory dispatch preserves exact native scope/page and explicit use', async () => {
  const probe = capture();
  await germanDiscovery('meinpraktikum_inventory', {...use, scope: 'internships', page: 2}, probe);
  assert.deepEqual(probe.calls, [['mein_inventory','--scope','internships','--page','2','--personal-noncommercial-use']]);
});

test('native detail passes the complete URL as one argument', async () => {
  const probe = capture();
  const url = 'https://www.meinpraktikum.de/stellen/student-role-00000000-0000-4000-8000-000000000001';
  await germanDiscovery('meinpraktikum_detail', {...use, url}, probe);
  assert.deepEqual(probe.calls, [['mein_detail','--url',url,'--personal-noncommercial-use']]);
});

test('personal use must be a deliberate boolean before spawning any reader', async () => {
  for (const value of [undefined, false, 1, 'true', null]) {
    const probe = capture();
    const result = await germanDiscovery('meinpraktikum_inventory', {scope: 'internships', personal_noncommercial_use: value}, probe);
    assert.equal(probe.calls.length, 0);
    assert.equal(result.status, 'source_limited');
    assert.equal(result.returned_count, null);
    assert.equal(result.source_result_count, null);
  }
});

test('role keyword, source URL override and unknown scope arguments refuse before spawn', async () => {
  for (const args of [{...use, scope:'internships', query:'PR'}, {...use, scope:'internships', url:'https://example.invalid'},
    {...use, scope:'marketing'}, {...use, scope:['internships']}]) {
    const probe = capture();
    const result = await germanDiscovery('meinpraktikum_inventory', args, probe);
    assert.equal(probe.calls.length, 0);
    assert.equal(result.coverage_complete, false);
  }
});

test('numeric native page semantics reject coercion and client cap overflow', async () => {
  for (const page of [0, -1, 1.2, '1', true, null, 10001]) {
    const probe = capture();
    await germanDiscovery('meinpraktikum_inventory', {...use, scope:'working_student', page}, probe);
    assert.equal(probe.calls.length, 0);
  }
});

test('organisation file is not provider pagination; staffing pages remain independent', async () => {
  const probe = capture();
  await germanDiscovery('organisation_directory', {...use, directory:'higher_education', page:2}, probe);
  assert.equal(probe.calls.length, 0);
  await germanDiscovery('organisation_directory', {...use, directory:'staffing_members', page:2}, probe);
  assert.deepEqual(probe.calls, [['organisation_directory','--directory','staffing_members','--page','2','--personal-noncommercial-use']]);
});

test('audited student and directory routes retain their separate source gaps', async () => {
  for (const name of ['meinpraktikum_inventory','meinpraktikum_detail','organisation_directory']) assert.ok(ALLOWED.public_de.has(name));
  assert.ok(!ALLOWED.public_de.has('member_detail'));
  assert.ok(!ALLOWED.public_de.has('member_challenge'));
  const registry = await loadRegistry();
  assert.equal(registry.sources.length, 102);
  for (const id of ['public_institutions','staffing']) {
    const source = registry.sources.find(row => row.id === id);
    assert.equal(source.status, 'research_required');
    assert.equal(source.routes[0].tool, 'organisation_directory');
    assert.equal(source.routes[0].fixed_arguments.personal_noncommercial_use, undefined);
  }
  const source = registry.sources.find(row => row.id === 'meinpraktikum');
  assert.equal(source.status, 'implemented');
  assert.ok(source.limits.some(line => /grouped records/.test(line)));
});

test('native bridge validates the actual provider identity for all three readers', async () => {
  for (const [argv, source] of [
    [['mein_inventory','--scope','internships'], 'meinpraktikum'],
    [['mein_detail','--url','https://example.invalid'], 'meinpraktikum'],
    [['organisation_directory','--directory','higher_education'], 'hochschulkompass'],
    [['organisation_directory','--directory','staffing_members'], 'gvp_staffing'],
  ]) {
    const spawnProcess = () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.kill = () => {};
      queueMicrotask(() => {
        child.stdout.emit('data', Buffer.from(JSON.stringify({status:'ok',source,returned_count:1})));
        child.emit('close', 0);
      });
      return child;
    };
    const result = await runDiscovery(argv, {spawnProcess, env:{}});
    assert.equal(result.status, 'ok');
    assert.equal(result.source, source);
  }
});
