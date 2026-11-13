import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
test('source-only MCP serves the exact read-only catalogue and refuses private routes offline',async()=>{
 const client=new Client({name:'startupmap-protocol-test',version:'1'});
 try {
  await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../startupmap-server.mjs',import.meta.url))],stderr:'pipe'}));
  const {tools}=await client.listTools();assert.equal(tools.length,9);assert.ok(tools.every(t=>t.annotations.readOnlyHint));
  const r=await client.callTool({name:'startupmap_capabilities',arguments:{}});
  assert.equal(r.structuredContent.official_api,false);assert.equal(r.structuredContent.source,'startupmap');
  const denied=await client.callTool({name:'startupmap_city_jobs',arguments:{city_url:'https://startupmap.one/api/jobs'}});
  assert.equal(denied.isError,true);assert.equal(denied.structuredContent.returned_count,null);
 } finally {await client.close();}
});
