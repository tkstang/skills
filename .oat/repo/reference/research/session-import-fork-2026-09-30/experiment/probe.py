#!/usr/bin/env python3
"""Disposable real-client import -> native fork -> continuation probe.

Protects the public import/fork/resume boundary: a provider fork must inherit
native imported tools, persist a new turn, and leave the source and import seed
unchanged. This lifecycle is absent from the upstream client probes.
"""
import hashlib
import json
import os
import queue
import subprocess
import sys
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path('/tmp/session-import-fork-7ZO9zB').resolve()
UPSTREAM = Path('/tmp/teleporter-review.pjO2qj/aviadr1-claude-session-teleporter-39fd13a')
DEST = (ROOT/'destination').resolve()
PYTHON = UPSTREAM/'.venv/bin/python'
TELEPORTER = UPSTREAM/'claude_sessions.py'
CODEX = Path('/Users/tstang/.local/bin/codex')
CLAUDE = Path('/Users/tstang/.local/bin/claude')
SANDBOX = Path('/usr/bin/sandbox-exec')
PROFILE = ROOT/'loopback.sb'
sys.path.insert(0, str(UPSTREAM/'tests'))
from teleport_support import PROMPT, ANSWER, TOOL_OUTPUT, CALL_ID, tool_rows, write_rows


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def save(name, data):
    path = ROOT/name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str) + '\n')
    return path


def env_for(client, url=None):
    home = ROOT/'isolated/home'
    env = dict(HOME=str(home), USERPROFILE=str(home), PATH='/usr/bin:/bin:/usr/sbin:/sbin',
               TMPDIR=str(ROOT/'isolated/tmp'), XDG_CONFIG_HOME=str(ROOT/'isolated/config'),
               XDG_CACHE_HOME=str(ROOT/'isolated/cache'), XDG_DATA_HOME=str(ROOT/'isolated/data'),
               CODEX_HOME=str(ROOT/'isolated/codex'),
               CLAUDE_CONFIG_DIR=str(ROOT/'isolated/claude'),
               NO_COLOR='1', TERM='dumb')
    if client == 'codex': env['OPENAI_API_KEY'] = 'synthetic-loopback-only'
    if client == 'claude': env.update(ANTHROPIC_BASE_URL=url,
            ANTHROPIC_API_KEY='synthetic-loopback-only',
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1')
    return env


def run(args, client, url=None, timeout=40):
    cmd = [str(SANDBOX), '-f', str(PROFILE), *[str(a) for a in args]]
    result = subprocess.run(cmd, cwd=DEST, env=env_for(client,url), text=True,
                            capture_output=True, timeout=timeout)
    return dict(returncode=result.returncode, stdout=result.stdout, stderr=result.stderr, cmd=[str(a) for a in args])


def events(path, text):
    if 'messages' in path:
        return [dict(type='message_start',message=dict(id='msg_probe',type='message',role='assistant',model='claude-sonnet-4-6',content=[],stop_reason=None,stop_sequence=None,usage=dict(input_tokens=20,output_tokens=0))),
                dict(type='content_block_start',index=0,content_block=dict(type='text',text='')),
                dict(type='content_block_delta',index=0,delta=dict(type='text_delta',text=text)),
                dict(type='content_block_stop',index=0),
                dict(type='message_delta',delta=dict(stop_reason='end_turn',stop_sequence=None),usage=dict(output_tokens=5)),
                dict(type='message_stop')]
    part=dict(type='output_text',text=text,annotations=[])
    item=dict(id='msg_probe',type='message',role='assistant',status='completed',content=[part])
    response=dict(id='resp_probe',object='response',created_at=1,status='completed',model='probe-model',output=[item],usage=dict(input_tokens=20,output_tokens=5,total_tokens=25))
    return [dict(type='response.created',response={**response,'status':'in_progress','output':[]}),
            dict(type='response.output_item.added',output_index=0,item={**item,'status':'in_progress','content':[]}),
            dict(type='response.content_part.added',output_index=0,item_id='msg_probe',content_index=0,part={**part,'text':''}),
            dict(type='response.output_text.delta',output_index=0,item_id='msg_probe',content_index=0,delta=text),
            dict(type='response.output_text.done',output_index=0,item_id='msg_probe',content_index=0,text=text),
            dict(type='response.content_part.done',output_index=0,item_id='msg_probe',content_index=0,part=part),
            dict(type='response.output_item.done',output_index=0,item=item),
            dict(type='response.completed',response=response)]

@contextmanager
def api(reply):
    requests=queue.Queue()
    count=[0]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def do_POST(self):
            raw=self.rfile.read(int(self.headers['Content-Length']))
            data=json.loads(raw)
            if 'count_tokens' in self.path:
                body=json.dumps({'input_tokens':10}).encode()
                self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
            requests.put(dict(path=self.path,body=data))
            response_text=reply[min(count[0],len(reply)-1)] if isinstance(reply,list) else reply
            count[0]+=1
            stream=''.join('event: '+e['type']+'\ndata: '+json.dumps(e)+'\n\n' for e in events(self.path,response_text)).encode()
            self.send_response(200);self.send_header('Content-Type','text/event-stream');self.send_header('Content-Length',str(len(stream)));self.end_headers();self.wfile.write(stream)
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
    try: yield f'http://127.0.0.1:{server.server_port}',requests
    finally: server.shutdown();server.server_close();worker.join(timeout=5)

@contextmanager
def app(url, label):
    args=[CODEX,'-c','model_provider="probe"','-c','model="probe-model"',
          '-c','model_providers.probe.name="Local probe"',
          '-c',f'model_providers.probe.base_url="{url}"',
          '-c','model_providers.probe.wire_api="responses"',
          '-c','model_providers.probe.supports_websockets=false',
          'app-server','--listen','stdio://']
    stderr=(ROOT/f'{label}-codex-stderr.log').open('w')
    process=subprocess.Popen([str(SANDBOX),'-f',str(PROFILE),*[str(a) for a in args]],
           cwd=DEST,env=env_for('codex',url),stdin=subprocess.PIPE,stdout=subprocess.PIPE,
           stderr=stderr,text=True,encoding='utf8')
    responses=queue.Queue(); notes=queue.Queue()
    def read():
        for line in process.stdout:
            try: value=json.loads(line)
            except json.JSONDecodeError: continue
            (responses if 'id' in value else notes).put(value)
    reader=threading.Thread(target=read,daemon=True);reader.start()
    seq=0
    def rpc(method,params):
        nonlocal seq
        seq+=1
        process.stdin.write(json.dumps(dict(id=seq,method=method,params=params))+'\n');process.stdin.flush()
        while True:
            value=responses.get(timeout=30)
            if value.get('id')==seq:
                if 'error' in value: raise RuntimeError(f'{method}: {value["error"]}')
                return value['result']
    try:
        rpc('initialize',dict(clientInfo=dict(name='import_fork_probe',version='1.0'),capabilities=dict(experimentalApi=True)))
        yield rpc,notes
    finally:
        process.terminate()
        try: process.wait(timeout=5)
        except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
        process.stdin.close();process.stdout.close();reader.join(timeout=5);stderr.close()

def await_turn(notes):
    while True:
        note=notes.get(timeout=40)
        if note.get('method')=='turn/completed':
            if note['params']['turn']['status']!='completed': raise RuntimeError(f'turn: {note}')
            return note

def imported(source, target):
    home=ROOT/'isolated'/target
    before=set(home.rglob('*.jsonl'))
    args=[PYTHON,TELEPORTER,'teleport',source,'--to',target,'--target-home',home,'--cwd',DEST,'--apply']
    if target=='codex': args.extend(['--codex-project','none'])
    output=run(args,'teleporter')
    save(f'{target}-import.json',output)
    if output['returncode']:raise RuntimeError(output)
    new=list(set(home.rglob('*.jsonl'))-before)
    if not new and 'already exists' in output['stdout'].lower():
        new=[p for p in home.rglob('*.jsonl') if 'rollout-' in p.name] if target=='codex' else list(home.rglob('*.jsonl'))
    if len(new)!=1:raise RuntimeError(f'{target} import paths: {new}')
    seed=new[0]
    rows=[json.loads(x) for x in seed.read_text().splitlines()]
    sid=next(r['payload']['id'] for r in rows if r['type']=='session_meta') if target=='codex' else next(r['sessionId'] for r in rows if 'sessionId' in r)
    return seed,sid

def codex_direction():
    source=write_rows(ROOT/'sources/claude.jsonl',tool_rows('claude',DEST))
    source_hash=sha(source)
    seed,sid=imported(source,'codex');seed_hash=sha(seed)
    reply='CODEX_FORK_REPLY_91';second='CODEX_RESUME_REPLY_92'
    with api([reply,second]) as (url,requests):
        with app(url,'codex-first') as (rpc,notes):
            listing=rpc('thread/list',dict(limit=20))
            assert sid in [t['id'] for t in listing['data']]
            fork=rpc('thread/fork',dict(threadId=sid,modelProvider='probe',model='probe-model',cwd=str(DEST),sandbox='read-only',approvalPolicy='untrusted'))
            save('codex-fork-response.json',fork)
            child=fork['thread']['id']
            assert child!=sid and fork['thread'].get('forkedFromId')==sid
            assert Path(fork['thread']['cwd']).resolve()==DEST.resolve()
            assert sha(seed)==seed_hash
            rpc('turn/start',dict(threadId=child,input=[dict(type='text',text='Continue imported synthetic tools only.')]))
            request=requests.get(timeout=30)
            save('codex-first-request.json',request)
            context=json.dumps(request['body']['input'])
            for marker in (PROMPT,ANSWER,TOOL_OUTPUT,CALL_ID):assert marker in context,marker
            assert any(x.get('type')=='function_call' and x.get('call_id')==CALL_ID for x in request['body']['input'])
            assert any(x.get('type')=='function_call_output' and x.get('call_id')==CALL_ID for x in request['body']['input'])
            await_turn(notes)
        with app(url,'codex-restart') as (rpc,notes):
            thread=rpc('thread/read',dict(threadId=child,includeTurns=True))['thread']
            save('codex-child-after-restart.json',thread)
            visible=json.dumps(thread['turns'])
            for marker in (PROMPT,ANSWER,TOOL_OUTPUT,CALL_ID,reply):assert marker in visible,marker
            resumed=rpc('thread/resume',dict(threadId=child,modelProvider='probe',model='probe-model',sandbox='read-only',approvalPolicy='untrusted'))
            assert resumed['thread']['id']==child
            rpc('turn/start',dict(threadId=child,input=[dict(type='text',text='Check previous synthetic reply.')]))
            request=requests.get(timeout=30);save('codex-second-request.json',request)
            second_context=json.dumps(request['body']['input'])
            for marker in (PROMPT,ANSWER,TOOL_OUTPUT,CALL_ID,reply):assert marker in second_context,marker
            await_turn(notes)
        with app(url,'codex-final-restart') as (rpc,notes):
            final=rpc('thread/read',dict(threadId=child,includeTurns=True))['thread']
            save('codex-child-final.json',final)
            assert second in json.dumps(final['turns'])
    assert sha(source)==source_hash and sha(seed)==seed_hash
    save('codex-result.json',dict(source=str(source),source_sha256=source_hash,seed=str(seed),seed_sha256=seed_hash,parent=sid,child=child,destination=str(DEST),first_reply=reply,second_reply=second,source_unchanged=True,seed_unchanged=True))

def claude_run(url, sid, fork, prompt, label):
    args=[CLAUDE,'--bare','-p','--resume',sid]
    if fork:args+=['--fork-session']
    args+=['--model','claude-sonnet-4-6','--tools','','--setting-sources','',
           '--strict-mcp-config','--mcp-config','{"mcpServers":{}}',
           '--output-format','json','--',prompt]
    result=run(args,'claude',url,timeout=55)
    save(f'{label}-claude-output.json',result)
    if result['returncode']:raise RuntimeError(f'{label}: {result}')
    try: parsed=json.loads(result['stdout'])
    except json.JSONDecodeError:raise RuntimeError(f'{label} non-json: {result}')
    return parsed

def claude_direction():
    source=write_rows(ROOT/'sources/codex.jsonl',tool_rows('codex',DEST))
    source_hash=sha(source)
    seed,sid=imported(source,'claude');seed_hash=sha(seed)
    reply='CLAUDE_FORK_REPLY_93';second='CLAUDE_RESUME_REPLY_94'
    with api([reply,second]) as (url,requests):
        first=claude_run(url,sid,True,'Continue imported synthetic tools only.','claude-fork')
        child=first['session_id']
        assert child!=sid and reply in first['result']
        request=requests.get(timeout=10);save('claude-first-request.json',request)
        context=json.dumps(request['body']['messages'])
        for marker in (PROMPT,ANSWER,TOOL_OUTPUT,CALL_ID):assert marker in context,marker
        assert any(b.get('type')=='tool_use' and b.get('id')==CALL_ID for m in request['body']['messages'] for b in m['content'])
        assert any(b.get('type')=='tool_result' and b.get('tool_use_id')==CALL_ID for m in request['body']['messages'] for b in m['content'])
        assert sha(seed)==seed_hash
        # This second process is the restart/resume boundary.
        second_out=claude_run(url,child,False,'Check previous synthetic reply.','claude-resume')
        assert second_out['session_id']==child
        assert second in second_out['result']
        request=requests.get(timeout=10);save('claude-second-request.json',request)
        context=json.dumps(request['body']['messages'])
        for marker in (PROMPT,ANSWER,TOOL_OUTPUT,CALL_ID,reply):assert marker in context,marker
    child_files=[p for p in (ROOT/'isolated/claude').rglob('*.jsonl') if child in p.name]
    if len(child_files)!=1:raise RuntimeError(f'child files {child_files}')
    child_file=child_files[0]
    child_text=child_file.read_text()
    for marker in (PROMPT,ANSWER,TOOL_OUTPUT,CALL_ID,reply,second):assert marker in child_text,marker
    assert sha(source)==source_hash and sha(seed)==seed_hash
    save('claude-result.json',dict(source=str(source),source_sha256=source_hash,seed=str(seed),seed_sha256=seed_hash,parent=sid,child=child,child_file=str(child_file),child_sha256=sha(child_file),destination=str(DEST),first_reply=reply,second_reply=second,source_unchanged=True,seed_unchanged=True))

if __name__=='__main__':
    (ROOT/'isolated/tmp').mkdir(parents=True,exist_ok=True)
    direction=sys.argv[1]
    try:
        if direction=='codex': codex_direction()
        elif direction=='claude': claude_direction()
        else: raise ValueError(direction)
    except Exception as e:
        import traceback
        save(f'{direction}-failure.json',dict(error=str(e),traceback=traceback.format_exc()))
        raise
