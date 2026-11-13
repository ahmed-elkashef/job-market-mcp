#!/usr/bin/env node
/** Source-only entry point; the same readers also belong to the federation. */
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {startupmap,startupmapTools} from './startupmap.mjs';

const server=new Server({name:'startupmap-public-reader',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:startupmapTools}));
server.setRequestHandler(CallToolRequestSchema,async({params})=>{
  const result=await startupmap(params.name,params.arguments??{});
  return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result,isError:result.status!=='ok'};
});
await server.connect(new StdioServerTransport());
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void server.close().finally(()=>process.exit(0));});
