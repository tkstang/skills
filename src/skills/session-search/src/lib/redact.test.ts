import { describe, expect, it } from 'vitest';

import { compileMatcher, snippetFor } from './matcher.js';
import { REDACTED, redact } from './redact.js';

// Synthetic credential shapes are assembled at runtime so no literal token
// pattern lives in the repository.
const join = (...parts: string[]) => parts.join('');
const OPENAI_KEY = join('sk', '-', 'proj', 'A1b2C3d4E5f6G7h8I9j0K1');
const ANTHROPIC_KEY = join('sk', '-ant-', 'api03-', 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3');
const GITHUB_PAT = join('gh', 'p_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8');
const GITHUB_OAUTH = join('gh', 'o_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8');
const GITHUB_SERVER = join('gh', 's_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8');
const GITHUB_FINE = join(
  'github',
  '_pat_',
  '11ABCDEFG0123456789_abcdefghijKLMNOP',
);
const SLACK = join('xo', 'xb-', '123456789012-abcdefABCDEF');
const AWS_ID = join('AK', 'IA', 'Z2Y3X4W5V6U7T8S9');
const AWS_SECRET = join('wJalrXUtnFEMI', '/K7MDENG/', 'bPxRfiCY+EXAMPLEKEY01');
const AWS_STS_ID = join('AS', 'IA', 'Q7R8S9T0U1V2W3X4');
const GOOGLE_KEY = join('AI', 'za', 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q');
const GITLAB_PAT = join('gl', 'pat-', 'A1b2C3d4E5f6G7h8I9j0');
const STRIPE_LIVE = join('sk', '_live_', 'A1b2C3d4E5f6G7h8');
const STRIPE_RESTRICTED = join('rk', '_live_', 'Z9y8X7w6V5u4T3s2R1q0');
const STRIPE_TEST = join('pk', '_test_', 'Q1w2E3r4T5y6U7i8O9p0');
const HUGGING_FACE = join('hf', '_', 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789');
const SHA = 'a'.repeat(8) + '0123456789abcdef0123456789abcdef';
const SYNTHETIC = 'synthetic-only';

describe('redact: credential shapes', () => {
  it.each([
    ['OpenAI-style key', `use ${OPENAI_KEY} here`, OPENAI_KEY],
    ['Anthropic-style key', `key=${ANTHROPIC_KEY}`, ANTHROPIC_KEY],
    ['GitHub ghp_ token', `token ${GITHUB_PAT}`, GITHUB_PAT],
    ['GitHub gho_ token', `got ${GITHUB_OAUTH}`, GITHUB_OAUTH],
    ['GitHub ghs_ token', `got ${GITHUB_SERVER}`, GITHUB_SERVER],
    ['GitHub fine-grained PAT', `got ${GITHUB_FINE}`, GITHUB_FINE],
    ['Slack token', `slack ${SLACK} ok`, SLACK],
    ['AWS access key id', `id ${AWS_ID} ok`, AWS_ID],
    ['AWS temporary (STS) key id', `id ${AWS_STS_ID} ok`, AWS_STS_ID],
    ['Google API key', `maps ${GOOGLE_KEY} ok`, GOOGLE_KEY],
    ['GitLab PAT', `export GL=${GITLAB_PAT}`, GITLAB_PAT],
    ['Stripe short live secret key', `stripe ${STRIPE_LIVE} ok`, STRIPE_LIVE],
    [
      'Stripe restricted key',
      `stripe ${STRIPE_RESTRICTED} ok`,
      STRIPE_RESTRICTED,
    ],
    ['Stripe test key', `stripe ${STRIPE_TEST} ok`, STRIPE_TEST],
    ['Hugging Face token', `hub ${HUGGING_FACE} ok`, HUGGING_FACE],
    [
      'Bearer token',
      `Authorization: Bearer ${join('eyJhbGci', 'OiJIUzI1NiJ9.e30.x1')}`,
      'eyJhbGci',
    ],
    [
      '40-char AWS-style secret with / and +',
      `secret blob ${AWS_SECRET}`,
      AWS_SECRET,
    ],
  ])('masks %s', (_name, text, secret) => {
    const out = redact(text);
    expect(out).toContain(REDACTED);
    expect(out).not.toContain(secret);
  });

  it.each([
    [
      'url-safe token with - and _',
      join('Xk3_pQ9-ZmVyYWwtc2Vj', 'cmV0LWtleS0xMjM0NTY3ODkw'),
    ],
    [
      'camel-looking random run',
      join('AbCdEf1GhIjKl2MnOpQr', '3StUvWx4YzAbCdEf5GhIj'),
    ],
    [
      'digit-dense camel run',
      join('session', 'Search12345678', 'PatternsAndMoreWords'),
    ],
  ])('still masks a %s', (_name, run) => {
    expect(redact(`value ${run} end`)).toBe(`value ${REDACTED} end`);
  });

  it('masks a 40-hex run, so a full git SHA is intentionally redacted', () => {
    expect(SHA).toHaveLength(40);
    expect(redact(`commit ${SHA} landed`)).toBe(`commit ${REDACTED} landed`);
  });

  it('masks long mixed-case base64-like runs that contain a digit', () => {
    const blob = join('QmFzZTY0', 'RW5jb2RlZERhdGFXaXRoMURpZ2l0', 'c0Zvcg==');
    expect(redact(`payload ${blob} end`)).toBe(`payload ${REDACTED} end`);
  });
});

describe('redact: key-value secrets', () => {
  it.each([
    ['uppercase env assignment', `API_KEY=${SYNTHETIC}`, 'API_KEY='],
    [
      'prefixed env assignment',
      `export AWS_SECRET_ACCESS_KEY=${SYNTHETIC}`,
      'AWS_SECRET_ACCESS_KEY=',
    ],
    ['lowercase colon form', `password: ${SYNTHETIC}`, 'password: '],
    ['short JSON password', `{"password":"${SYNTHETIC}"}`, '{"password":'],
    ['short JSON API_KEY', `{"API_KEY":"${SYNTHETIC}"}`, '{"API_KEY":'],
    [
      'single-quoted value',
      `client_secret = '${SYNTHETIC}'`,
      'client_secret = ',
    ],
    [
      'escaped raw-record credential',
      `{\\"token\\":\\"${SYNTHETIC}\\"}`,
      '{\\"token\\":',
    ],
    [
      'query string',
      `https://x.test/cb?access_key=${SYNTHETIC}&next=1`,
      'access_key=',
    ],
  ])('masks the %s value', (_name, text, keptKey) => {
    const out = redact(text);
    expect(out).toContain(`${keptKey}${REDACTED}`);
    expect(out).not.toContain('synthetic');
  });

  it('masks a quoted value with spaces entirely', () => {
    expect(redact('{"API_KEY":"x y"}')).toBe(`{"API_KEY":${REDACTED}}`);
    expect(redact('password="pass word" next')).toBe(
      `password=${REDACTED} next`,
    );
  });

  it('masks quoted values containing escaped quotes entirely', () => {
    const out = redact('{"secret": "a\\"b c", "keep": "visible"}');
    expect(out).toBe(`{"secret": ${REDACTED}, "keep": "visible"}`);
  });

  it('masks escaped-quoted values containing spaces and nested escapes', () => {
    const raw =
      '{\\"private_key\\": \\"pass \\\\\\"word\\\\\\" tail\\", \\"k\\":1}';
    const out = redact(raw);
    expect(out).toBe(`{\\"private_key\\": ${REDACTED}, \\"k\\":1}`);
  });

  it('masks two-level escaped JSON credentials', () => {
    // A JSON-encoded tool output that itself contains JSON.
    const raw = `{\\\\\\"password\\\\\\":\\\\\\"${SYNTHETIC}\\\\\\"}`;
    expect(raw).toBe('{\\\\\\"password\\\\\\":\\\\\\"synthetic-only\\\\\\"}');

    expect(redact(raw)).toBe(`{\\\\\\"password\\\\\\":${REDACTED}}`);
  });

  it('masks three-level escaped values whole, including deeper-escaped quotes', () => {
    const q3 = '\\'.repeat(7) + '"';
    const inner = '\\'.repeat(15) + '"';
    const raw = `${q3}api_key${q3}: ${q3}pass ${inner}word${inner} tail${q3}, ${q3}k${q3}:1`;

    const out = redact(raw);

    expect(out).toBe(`${q3}api_key${q3}: ${REDACTED}, ${q3}k${q3}:1`);
  });

  it('stops a bare value at a delimiter', () => {
    expect(redact(`token=${SYNTHETIC},other=1`)).toBe(
      `token=${REDACTED},other=1`,
    );
  });

  it('masks an unterminated quoted value to the end of the line', () => {
    expect(redact(`{"password":"${SYNTHETIC}\nnext line`)).toBe(
      `{"password":${REDACTED}\nnext line`,
    );
  });
});

describe('redact: URL userinfo and CLI flags', () => {
  it.each([
    [
      'postgres connection string',
      `DATABASE_URL=postgres://app:${SYNTHETIC}@db.internal:5432/main`,
      `DATABASE_URL=postgres://app:${REDACTED}@db.internal:5432/main`,
    ],
    [
      'https clone URL with a token',
      `git clone https://x-access-user:${SYNTHETIC}@github.com/org/repo.git`,
      `git clone https://x-access-user:${REDACTED}@github.com/org/repo.git`,
    ],
    [
      'double-dash password flag',
      `mysql --user root --password ${SYNTHETIC} -h db`,
      `mysql --user root --password ${REDACTED} -h db`,
    ],
    [
      'double-dash token flag',
      `cli login --token ${SYNTHETIC}`,
      `cli login --token ${REDACTED}`,
    ],
    [
      'quoted flag value with spaces',
      `tool --client-secret "pass ${SYNTHETIC}" --verbose`,
      `tool --client-secret ${REDACTED} --verbose`,
    ],
  ])('masks the %s', (_name, text, expected) => {
    expect(redact(text)).toBe(expected);
  });

  it.each([
    [
      'password containing /',
      'psql postgres://u:ab/cd@host/db',
      `psql postgres://u:${REDACTED}@host/db`,
    ],
    [
      'password containing an unencoded @',
      'psql postgres://u:p@ss@host/db',
      `psql postgres://u:${REDACTED}@host/db`,
    ],
    [
      'token-only userinfo',
      `git clone https://${join('glpat', '-', 'Ab12Cd34Ef56Gh78Ij90')}@gitlab.com/org/repo.git`,
      `git clone https://${REDACTED}@gitlab.com/org/repo.git`,
    ],
    [
      'Basic authorization header',
      'curl -H "Authorization: Basic dXNlcjpwYXNz" https://api.test',
      `curl -H "Authorization: Basic ${REDACTED}" https://api.test`,
    ],
    [
      'JSON Token authorization header',
      '{"Authorization": "Token abc123"}',
      `{"Authorization": "Token ${REDACTED}"}`,
    ],
    [
      'escaped Bearer authorization header',
      '{\\"authorization\\":\\"Bearer short1\\"}',
      `{\\"authorization\\":\\"Bearer ${REDACTED}\\"}`,
    ],
  ])('masks the %s', (_name, text, expected) => {
    expect(redact(text)).toBe(expected);
  });

  it.each([
    'Remember that the token is rotated weekly by the platform team.',
    'The re-token step runs after the password reset email is sent.',
    'Browse https://example.com:8080/docs for details.',
    'Run with --verbose before the token refresh step.',
    'Contact user@example.com about the secret santa list.',
    'Clone ssh://git@github.com/org/repo.git and see https://example.com/user@domain',
    'The Authorization header carries a Bearer token for Basic auth fallback.',
  ])('leaves prose and plain URLs intact: %j', (text) => {
    expect(redact(text)).toBe(text);
  });
});

describe('redact: full unit before windowing', () => {
  const needle = compileMatcher(['needle'], { literal: true });

  it('leaves no fragment of an escaped credential near a snippet edge', () => {
    // Place the credential value so the raw window would end mid-value.
    const head = 'needle ';
    const keyPart = '{\\"token\\":\\"';
    const filler = 'y'.repeat(80 - head.length - keyPart.length);
    const text = `${head}${filler}${keyPart}${SYNTHETIC}\\"} trailing`;
    expect(text.slice(0, 86)).toMatch(/synthe$/);

    const snippet = snippetFor(text, needle);

    expect(snippet).toContain('needle');
    expect(snippet).not.toMatch(/synth/);
  });

  it('masks a long token whose window cut would leave a short fragment', () => {
    const text = `needle ${'z'.repeat(60)} ${SHA}${SHA} tail`;

    const snippet = snippetFor(text, needle);

    expect(snippet).not.toMatch(/[0-9a-f]{12,}/);
  });
});

describe('redact: ordinary text stays intact', () => {
  it.each([
    'Session 0b6d8f3e-3f4a-4c1b-9d2e-7a8b9c0d1e2f resumed',
    'We vetted Perceive Now and decided against it.',
    'See documentation/docs/engineering/architecture/session-schemas for details',
    '/Users/Shared/Vault/Projects2026/Stoa/Proposals/Search',
    'The bearer of the message tokenizes nothing.',
    'A password manager keeps secrets safe.',
    'Run pnpm run test:vitest src/skills/session-search/src/lib',
    // Claude project slug (base64 rule must not blank it).
    'cd ~/.claude/projects/-Users-thomas-stang--superconductor-worktrees-skills-sc-levitated-cryostat-ae6a',
    'projects/-Users-name-code-repo/0b6d8f3e-3f4a-4c1b-9d2e-7a8b9c0d1e2f.jsonl',
    // Long camelCase identifiers.
    'call compileMatcherWithLiteralEscapingForV2Patterns() first',
    'HTTPServerRequestHandlerFactoryForSessionSearch2 is unused',
    // Token-family prefixes in prose, and a bare 32-hex (MD5-looking) hash.
    'Ask Asia about the AIza docs, glpat- tokens, sk_live mode, and hf_ repos.',
    'md5 9e107d9d372bb6826bd81d3542a419d6 matches the fixture',
  ])('leaves %j untouched', (text) => {
    expect(redact(text)).toBe(text);
  });
});

describe('redact: identifier exemptions keep random tokens masked', () => {
  // mulberry32: a tiny fixed-seed PRNG, so the sample is deterministic.
  function mulberry32(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('masks at least 99.99% of random 40-char alphanumeric tokens', () => {
    const alphabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const random = mulberry32(0x5e55);
    const samples = 20_000;
    const exempted: string[] = [];
    let generated = 0;
    while (generated < samples) {
      let token = '';
      for (let i = 0; i < 40; i++) {
        token += alphabet[Math.floor(random() * alphabet.length)];
      }
      // Only tokens that pass the digit and mixed-case gate are candidates.
      if (!/\d/.test(token) || !/[a-z]/.test(token) || !/[A-Z]/.test(token)) {
        continue;
      }
      generated += 1;
      if (redact(`v ${token} e`) !== `v ${REDACTED} e`) exempted.push(token);
    }
    expect(exempted.length).toBeLessThanOrEqual(Math.floor(samples * 0.0001));
  });

  it.each([
    'L2WwqMjqvfoWQ781LJjj4zynuNQRrv80ttrNsfbc',
    'KmNABIQoevljrojLiuY7USS9Ckg3vgmfh8vjl1ZC',
    'NEFS21DW683nhxjvmon6fkivmDqhn5QOvtu6SIKS',
    'Correct-Horse-Battery-Staple-Mountain-River7',
  ])('masks the previously leaking sample %j', (token) => {
    expect(redact(`v ${token} e`)).toBe(`v ${REDACTED} e`);
  });

  it.each([
    'compileMatcherWithLiteralEscapingForV2Patterns',
    'HTTPServerRequestHandlerFactoryForSessionSearch2',
    'useSessionSearchResultsQueryForCursorV3Store',
    '-Users-thomas-stang--superconductor-worktrees-skills-sc-levitated-cryostat-ae6a',
  ])('keeps the identifier or slug %j', (text) => {
    expect(redact(text)).toBe(text);
  });
});

describe('redact: oversize input', () => {
  // Deep-tier raw lines can be hundreds of KiB. A quadratic key scan took
  // seconds at 64 KiB; the bound below is generous for slow CI yet far below
  // what a quadratic regex needs at 256 KiB.
  it('scans long identifier runs in linear time', () => {
    const inputs = [
      'a'.repeat(256 * 1024),
      'token'.repeat(52 * 1024),
      `password=${'x'.repeat(256 * 1024)}`,
      '\\'.repeat(256 * 1024),
      `\\\\"password\\\\": \\\\"${'x'.repeat(256 * 1024)}`,
      '\\"'.repeat(128 * 1024),
      '-'.repeat(256 * 1024),
      `--password${'-'.repeat(256 * 1024)}`,
      `https://${'a'.repeat(256 * 1024)}`,
      `postgres://user:${'p'.repeat(256 * 1024)}`,
      'a://:'.repeat(52 * 1024),
      `postgres://u:${'p@'.repeat(128 * 1024)}`,
      `https://${'t'.repeat(256 * 1024)}@host`,
      'Authorization: Basic '.repeat(12 * 1024),
      'AIza'.repeat(64 * 1024),
      `glpat-${'-'.repeat(256 * 1024)}`,
      'sk_live_'.repeat(32 * 1024),
      `hf_${'a'.repeat(256 * 1024)}`,
      'ASIA'.repeat(64 * 1024),
    ];
    const started = performance.now();
    for (const input of inputs) redact(input);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
