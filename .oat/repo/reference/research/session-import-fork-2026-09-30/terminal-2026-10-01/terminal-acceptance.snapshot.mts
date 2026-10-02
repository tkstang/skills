import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createFixture, app, codexConfig, hash, history, run, sourceTranscript, sourceId } from '/Users/tstang/.t3/worktrees/skills/t3code-0a05071c/src/skills/session-fork-to-destination/src/helpers/import-native-clients-support.ts';
const provider=process.argv[2] as 'codex'|'claude';
assert(['codex','claude'].includes(provider));
const evidenceDir='/tmp/session-import-generated-evidence.CB35i5';
const f=await createFixture(provider);
const firstReply=`${provider.toUpperCase()}_EXACT_TERMINAL_REPLY_101`;
const secondReply=`${provider.toUpperCase()}_EXACT_TERMINAL_REPLY_102`;
const requests:any[]=[];
const http=createServer(async(req,res)=>{
 try{
  let raw='';for await(const chunk of req){raw+=String(chunk);assert(raw.length<4*1024*1024);}
  const body=JSON.parse(raw);if(req.url?.includes('count_tokens')){res.setHeader('content-type','application/json');res.end('{"input_tokens":10}');return;}
  requests.push(body);const seq=requests.length;
  await writeFile(join(evidenceDir,`${provider}-exact-terminal-all-requests.json`),JSON.stringify(requests,null,2)+'\n');
  const input=JSON.stringify(provider==='codex'?body.input:body.messages);
  const reply=input.includes('Check previous synthetic reply.')?secondReply:input.includes('SYNTHETIC_BOOTSTRAP_PROMPT')||input.includes('Initialize synthetic fixture.')?'SYNTHETIC_BOOTSTRAP_REPLY':firstReply;
  const events=provider==='claude'?[
   {type:'message_start',message:{id:`msg_${seq}`,type:'message',role:'assistant',model:'claude-sonnet-4-6',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:20,output_tokens:0}}},
   {type:'content_block_start',index:0,content_block:{type:'text',text:''}},
   {type:'content_block_delta',index:0,delta:{type:'text_delta',text:reply}},
   {type:'content_block_stop',index:0},
   {type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:5}},
   {type:'message_stop'},
  ]:[];
  if(provider==='codex'){
   const part={type:'output_text',text:reply,annotations:[]};const item={id:`msg_${seq}`,type:'message',role:'assistant',status:'completed',content:[part]};
   const response={id:`resp_${seq}`,object:'response',created_at:1,status:'completed',model:'probe-model',output:[item],usage:{input_tokens:20,output_tokens:5,total_tokens:25}};
   events.push(...[
    {type:'response.created',response:{...response,status:'in_progress',output:[]}},
    {type:'response.output_item.added',output_index:0,item:{...item,status:'in_progress',content:[]}},
    {type:'response.content_part.added',output_index:0,item_id:item.id,content_index:0,part:{...part,text:''}},
    {type:'response.output_text.delta',output_index:0,item_id:item.id,content_index:0,delta:reply},
    {type:'response.output_text.done',output_index:0,item_id:item.id,content_index:0,text:reply},
    {type:'response.content_part.done',output_index:0,item_id:item.id,content_index:0,part},
    {type:'response.output_item.done',output_index:0,item},
    {type:'response.completed',response},
   ] as any);
  }
  res.setHeader('content-type','text/event-stream');res.end(events.map((event:any)=>`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
 }catch(error){res.statusCode=500;res.end(String(error));}
});
await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));
const server={url:`http://127.0.0.1:${(http.address() as any).port}`,close:async()=>{http.closeAllConnections();await new Promise<void>(resolve=>http.close(()=>resolve()));}};
const result:any={provider,networkIsolation:'verified loopback allowed/external denied before clients',configuredEnvironment:provider==='codex'?{CODEX_EXEC_SERVER_URL:'none'}:{ANTHROPIC_BASE_URL:server.url,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'},defaultDaemon:provider==='codex'?'not verified: sandbox rejects setuid /bin/ps':'not applicable',generatedImporter:'0.3.1',creation:'not reached',continuation:'not reached',restartResume:'not reached'};
let live:any;
async function terminal(command:string,label:string){
 console.log(`EXACT_TERMINAL_START ${label}\n${command}`);
 live=spawn('/usr/bin/sandbox-exec',['-f',f.profile,'/bin/sh','-c',command],{cwd:f.destination,env:f.env,stdio:'inherit'});
 const timer=setTimeout(()=>live.kill('SIGKILL'),90000);
 const status=await new Promise<number|null>((resolve)=>live.once('exit',resolve));clearTimeout(timer);live=undefined;
 assert.equal(status,0,`${label} exit status`);
}
function checkRequest(request:any,previous?:string){
 const content=JSON.stringify(provider==='codex'?request.input:request.messages);
 for(const text of [history.prompt,history.answer,history.output,...(previous?[previous]:[])])assert(content.includes(text),text);
 if(provider==='codex'){
  const call=request.input.find((i:any)=>i.type==='function_call'&&i.call_id===history.callId);
  assert.equal(call.name,history.tool);assert.deepEqual(JSON.parse(call.arguments),history.arguments);
  const output=request.input.find((i:any)=>i.type==='function_call_output'&&i.call_id===history.callId);
  assert.equal(output.output,history.output);
 }else{
  const blocks=request.messages.flatMap((m:any)=>Array.isArray(m.content)?m.content:[]);
  const call=blocks.find((i:any)=>i.type==='tool_use'&&i.id===history.callId);assert.equal(call.name,history.tool);assert.deepEqual(call.input,history.arguments);
  const output=blocks.find((i:any)=>i.type==='tool_result'&&i.tool_use_id===history.callId);
  assert([history.output,JSON.stringify([{type:'text',text:history.output}])].includes(typeof output.content==='string'?output.content:JSON.stringify(output.content)));
 }
}
try{
 result.version=(await run(f,[f.client,'--version'])).trim();
 if(provider==='codex'){
  f.env.CODEX_EXEC_SERVER_URL='none';
  await writeFile(join(f.targetHome,'config.toml'),codexConfig(server.url,f.destination));
  const a=await app(f);
  try{
   const started=await a.rpc('thread/start',{modelProvider:'probe',model:'probe-model',cwd:f.destination,sandbox:'read-only',approvalPolicy:'untrusted'});
   result.bootstrap=(started.thread as any).id;
   await a.rpc('turn/start',{threadId:result.bootstrap,input:[{type:'text',text:'SYNTHETIC_BOOTSTRAP_PROMPT'}]});assert.equal(await a.completed(),'completed');
  }finally{await a.close();}
 }else{
  f.env.ANTHROPIC_BASE_URL=server.url;
  await run(f,[f.client,'--bare','-p','--session-id','550e8400-e29b-41d4-a716-446655440099','--model','claude-sonnet-4-6','--tools','','--setting-sources','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--output-format','json','--','Initialize synthetic fixture.'],55000);
 }
 const source=await sourceTranscript(f,provider==='codex'?'claude':'codex');
 result.sourceSha256=hash(await readFile(source));
 const bundle='/Users/tstang/.t3/worktrees/skills/t3code-0a05071c/skills/session-fork-to-destination/scripts/session-fork-to-destination.mjs';
 const args=[bundle,'import','--source',f.source,'--target',f.destination,'--session',`${provider==='codex'?'claude':'codex'}:cli:${sourceId}`,'--to',provider,'--entry-point','destination-fresh','--target-home',f.targetHome,'--json'];
 const plan=JSON.parse(await run(f,[process.execPath,...args])).data;
 await run(f,[process.execPath,...args,'--apply','--expect-plan',plan.digest]);
 result.seedId=plan.seed.id;result.seedSha256=hash(await readFile(plan.seed.path));result.destination=f.destination;result.exactForkCommand=plan.instructions.find((i:any)=>i.kind==='terminal').command;
 const store=provider==='codex'?join(f.targetHome,'sessions'):join(f.targetHome,'projects',f.destination.replace(/[^A-Za-z0-9]/g,'-'));
 const before=new Set(await readdir(store,{recursive:true}));
 await terminal(result.exactForkCommand,'fork');
 const candidates=[];
 for(const relative of await readdir(store,{recursive:true})){
  if(!relative.endsWith('.jsonl')||before.has(relative))continue;
  const path=join(store,relative);const text=await readFile(path,'utf8');const rows=text.trim().split('\n').map(line=>JSON.parse(line));
  const meta=provider==='codex'?rows.find((r:any)=>r.type==='session_meta')?.payload:rows.find((r:any)=>r.sessionId)?.sessionId;
  if(provider==='codex'?meta?.forked_from_id===plan.seed.id:meta!==plan.seed.id)candidates.push({path,text,id:provider==='codex'?meta.id:meta,cwd:provider==='codex'?meta.cwd:rows.find((r:any)=>r.cwd)?.cwd});
 }
 assert.equal(candidates.length,1);const child=candidates[0];assert.notEqual(child.id,plan.seed.id);assert.equal(child.cwd,f.destination);
 result.childId=child.id;result.childCwd=child.cwd;result.creation='passed';
 const first=requests.find(request=>JSON.stringify(provider==='codex'?request.input:request.messages).includes('Continue synthetic imported tools.'));assert(first,'actual first prompt request');checkRequest(first);assert(child.text.includes(firstReply));result.continuation='passed';
 await writeFile(join(evidenceDir,`${provider}-exact-terminal-first-request.json`),JSON.stringify(first,null,2)+'\n');
 const resume=provider==='codex'?`env CODEX_HOME=${f.targetHome} codex resume ${child.id}`:`env CLAUDE_CONFIG_DIR=${f.targetHome} claude --resume ${child.id}`;
 result.resumeCommand=resume;
 await terminal(resume,'restart-resume');
 const second=requests.find(request=>JSON.stringify(provider==='codex'?request.input:request.messages).includes('Check previous synthetic reply.'));assert(second,'actual resumed prompt request');checkRequest(second,firstReply);
 const persisted=await readFile(child.path,'utf8');assert(persisted.includes(secondReply));
 result.restartResume='passed';result.sourceUnchanged=hash(await readFile(source))===result.sourceSha256;result.seedUnchanged=hash(await readFile(plan.seed.path))===result.seedSha256;assert(result.sourceUnchanged&&result.seedUnchanged);
 await writeFile(join(evidenceDir,`${provider}-exact-terminal-second-request.json`),JSON.stringify(second,null,2)+'\n');
 result.firstReply=firstReply;result.secondReply=secondReply;result.validated=true;
}catch(error){result.failure=String(error);result.validated=false;console.error('TERMINAL_FAILURE',String(error));}
finally{
 if(live)live.kill('SIGKILL');
 await writeFile(join(evidenceDir,`${provider}-exact-terminal.json`),JSON.stringify(result,null,2)+'\n');console.log('TERMINAL_RESULT',JSON.stringify(result));
 await server.close();await f.cleanup();
}
