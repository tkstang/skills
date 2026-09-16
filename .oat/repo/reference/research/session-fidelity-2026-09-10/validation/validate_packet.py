#!/usr/bin/env python3
"""Validate this authored research packet, not native provider compatibility.

Requires Python 3 and jsonschema. Optional TypeScript check uses tsc if installed.
Run from any directory: python validation/validate_packet.py
"""
from pathlib import Path
import copy
import json
import re
import shutil
import subprocess
import sys
from urllib.parse import unquote

try:
    from jsonschema import Draft202012Validator
except ImportError:
    raise SystemExit('Validation requires the Python jsonschema package.')

ROOT = Path(__file__).resolve().parents[1]
failures = []
checks = []

def check(condition, message):
    checks.append({'check': message, 'passed': bool(condition)})
    if not condition:
        failures.append(message)

# Parse every JSON artifact, including manifests and examples.
for file in sorted(ROOT.rglob('*.json')):
    try:
        json.loads(file.read_text())
        check(True, f'JSON syntax: {file.relative_to(ROOT)}')
    except Exception as error:
        check(False, f'JSON syntax: {file.relative_to(ROOT)}: {error}')

catalog = json.loads((ROOT / 'schemas/catalog.json').read_text())
for entry in catalog:
    schema = json.loads((ROOT / entry['schema']).read_text())
    example = json.loads((ROOT / entry['example']).read_text())
    try:
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(example)
        check(True, f'Native reference schema/example: {entry["schema"]}')
    except Exception as error:
        check(False, f'Native reference schema/example: {entry["schema"]}: {error}')
    check((ROOT / entry['document']).is_file(), f'Provider guide exists: {entry["document"]}')

proposal_path = ROOT / 'schemas/proposed/activity-report.schema.json'
proposal = json.loads(proposal_path.read_text())
sample = json.loads((ROOT / 'examples/proposed/activity-report.json').read_text())
try:
    Draft202012Validator.check_schema(proposal)
    Draft202012Validator(proposal).validate(sample)
    check(True, 'Proposed ActivityReport schema/example')
except Exception as error:
    check(False, f'Proposed ActivityReport schema/example: {error}')

# Explicit semantic checks on the authored ASCII-only report example.
display = sample['coverage']['display']
check(display['eventsShown'] == len(sample['events']), 'Activity example: shown-event count')
check(display['eventsAvailable'] == display['eventsShown'] + display['eventsOmitted'], 'Activity example: event-count conservation')
ids = [event['id'] for event in sample['events']]
check(len(ids) == len(set(ids)), 'Activity example: unique event keys')
omitted = 0
for event in sample['events']:
    for field in ['input', 'output']:
        if field in event:
            value = event[field]
            check(value['originalChars'] - len(value['text']) == value['omittedChars'], f'Activity example: {event["id"]} {field} truncation counts')
            omitted += value['omittedChars']
check(display['payloadCharsOmitted'] == omitted, 'Activity example: total omitted characters')

# A few contract-negative checks. These do not exercise any upstream parser.
for mutation, title in [
    (lambda data: data.update(activitySchemaVersion=999), 'wrong proposed contract version rejected'),
    (lambda data: data['events'][0].update(kind='imaginary_kind'), 'invalid proposed event kind rejected'),
    (lambda data: data['coverage']['display'].update(eventsShown=-1), 'negative display count rejected'),
]:
    changed = copy.deepcopy(sample)
    mutation(changed)
    check(not Draft202012Validator(proposal).is_valid(changed), 'Contract negative check: ' + title)

# Check local Markdown targets without network calls. Ignore external URLs and
# code fences, so command snippets are not treated as Markdown links.
local_links = 0
for file in sorted(ROOT.rglob('*.md')):
    text = file.read_text()
    check(not re.search(r'\{\{[A-Z][A-Z0-9-]+\}\}', text), f'Resolved source placeholders: {file.relative_to(ROOT)}')
    check(not re.search(r'(?:filecite|cite)|turn\d+file\d+', text), f'Portable citations: {file.relative_to(ROOT)}')
    # All generated fences use triple backticks. An odd count signals a broken block.
    fences = re.findall(r'^```', text, re.M)
    check(len(fences) % 2 == 0, f'Balanced code fences: {file.relative_to(ROOT)}')
    plain = re.sub(r'```[^\n]*\n.*?^```\s*$', '', text, flags=re.S | re.M)
    for target in re.findall(r'(?<!!)\[[^\]\n]*\]\(([^\s)]+)\)', plain):
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'):
            continue
        local_links += 1
        target_path = unquote(target.split('#', 1)[0])
        resolved = (file.parent / target_path).resolve()
        check(resolved.is_relative_to(ROOT), f'Local link stays inside packet: {file.relative_to(ROOT)} -> {target}')
        check(resolved.exists(), f'Local link resolves: {file.relative_to(ROOT)} -> {target}')

# Provider coverage and source pinning.
providers = json.loads((ROOT / 'sources/provider-coverage.json').read_text())
expected = {'claude-code','codex','cursor','copilot','gemini','opencode','droid','amp','kiro','crush','cline','roo-code','kilo-code','antigravity','kimi','qwen-code','pi'}
check({p['provider'] for p in providers} == expected, 'Provider coverage: exact 17-provider union')
repo_data = json.loads((ROOT / 'sources/repositories.json').read_text())
pinned = {repo['name']: repo['commit'] for repo in repo_data['repositories']}
sources = json.loads((ROOT / 'sources/evidence.json').read_text())
for key, source in sources.items():
    check(source['repo'] in pinned and source['commit'] == pinned[source['repo']], f'Source is pinned to inspected commit: {key}')
    check('/blob/' + source['commit'] + '/' in source['url'], f'Source uses immutable blob link: {key}')

# Type declarations must type-check, but this is not an implementation test.
tsc = shutil.which('tsc')
tsc_status = 'not run (tsc unavailable)'
if tsc:
    result = subprocess.run([tsc, '--noEmit', '--strict', '--target', 'ES2022', '--module', 'ESNext', str(ROOT / 'design/activity-contract.ts')], capture_output=True, text=True, timeout=45)
    check(result.returncode == 0, 'Proposed TypeScript contract: tsc --noEmit --strict')
    tsc_status = 'passed' if result.returncode == 0 else result.stdout + result.stderr

summary = {'passed': not failures, 'checks': len(checks), 'failed_checks': failures, 'native_schema_example_pairs': len(catalog), 'proposed_schema_example_pairs': 1, 'provider_guides': len(providers), 'local_markdown_links_checked': local_links, 'typescript_contract': tsc_status, 'scope': 'Authored packet checks only. No live provider sessions, native CLI launches, upstream parsers or upstream test suites were run.'}
(ROOT / 'validation/results.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
if failures:
    sys.exit(1)
