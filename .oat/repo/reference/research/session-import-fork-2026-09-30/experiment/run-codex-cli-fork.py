#!/usr/bin/env python3
"""Run native Codex CLI fork in the caller's real terminal using synthetic fixture.

Prompts once to trust the disposable empty Git repo. Exit with /exit (Enter twice).
No prompt/model turn is necessary to create the fork.
"""
import json
import os
from pathlib import Path
from probe import ROOT, DEST, CODEX, SANDBOX, PROFILE, env_for

parent=json.loads((ROOT/'codex-result.json').read_text())['parent']
args=[str(SANDBOX),'-f',str(PROFILE),str(CODEX),
      '-c','model_provider="probe"','-c','model="probe-model"',
      '-c','model_providers.probe.name="Local probe"',
      '-c','model_providers.probe.base_url="http://127.0.0.1:9"',
      '-c','model_providers.probe.wire_api="responses"',
      '-c','model_providers.probe.supports_websockets=false',
      'fork',parent,'--no-daemon','--no-alt-screen',
      '-s','read-only','-a','never','-C',str(DEST)]
env=env_for('codex')
env['TERM']=os.environ.get('TERM','xterm-256color')
os.chdir(DEST)
os.execve(args[0],args,env)
