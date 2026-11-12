import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PACKAGE_ROOT, validateRepo, buildCatalog, renderIndex, searchTools, normalizeUrl, withLocalLinks,
} from '../src/lib.mjs';

const tool = (over = {}) => ({
  slug: 'semgrep',
  name: 'Semgrep',
  description: 'Fast static analysis to find bugs and security vulnerabilities in code.',
  reference: 'https://github.com/semgrep/semgrep',
  kind: 'cli',
  categories: ['security'],
  tags: ['sast', 'scanner'],
  added: '2026-11-12',
  ...over,
});

function fixture(tools) {
  const root = mkdtempSync(join(tmpdir(), 'toolbox-'));
  cpSync(join(PACKAGE_ROOT, 'taxonomy.json'), join(root, 'taxonomy.json'));
  mkdirSync(join(root, 'tools'));
  for (const t of tools) writeFileSync(join(root, 'tools', `${t.slug ?? 'x'}.json`), JSON.stringify(t));
  return root;
}

test('real repo is valid', () => {
  assert.deepEqual(validateRepo(PACKAGE_ROOT), []);
});

test('valid tool passes', () => {
  assert.deepEqual(validateRepo(fixture([tool()])), []);
});

test('rejects unknown category, kind, field, bad slug match and date', () => {
  const root = fixture([tool({ categories: ['nope'], kind: 'gizmo', extra: 1, added: '2026-02-30' })]);
  writeFileSync(join(root, 'tools', 'other-name.json'), JSON.stringify(tool()));
  const errors = validateRepo(root).join('\n');
  assert.match(errors, /unknown category "nope"/);
  assert.match(errors, /kind must be one of/);
  assert.match(errors, /unknown field "extra"/);
  assert.match(errors, /added must be a YYYY-MM-DD/);
  assert.match(errors, /must match file name "other-name"/);
});

test('detects duplicate references after normalization', () => {
  const root = fixture([tool(), tool({ slug: 'semgrep-copy', reference: 'https://www.github.com/Semgrep/semgrep.git/' })]);
  assert.match(validateRepo(root).join('\n'), /same reference/);
  assert.equal(normalizeUrl('https://www.GitHub.com/a/b.git/'), 'github.com/a/b');
});

test('build sorts tools and renders index per category', () => {
  const root = fixture([tool({ slug: 'zz-tool', name: 'ZZ', categories: ['ai', 'security'] }), tool()]);
  const catalog = buildCatalog(root);
  assert.deepEqual(catalog.tools.map((t) => t.slug), ['semgrep', 'zz-tool']);
  const md = renderIndex(catalog);
  assert.match(md, /## AI[\s\S]*\[ZZ\]/);
  assert.match(md, /## DevOps\n\n_[^\n]+_\n\n_No tools yet\._/);
});

test('search ranks name/tag matches over description and applies filters', () => {
  const tools = [
    tool(),
    tool({ slug: 'trivy', name: 'Trivy', description: 'Scanner for containers, also finds secrets and semgrep-like issues.', tags: ['containers'], kind: 'cli' }),
    tool({ slug: 'claude-sec', name: 'Claude Security', kind: 'claude-plugin', categories: ['ai', 'security'], tags: ['scanner'] }),
  ].map((t) => ({ ...t, tags: t.tags ?? [] }));

  assert.equal(searchTools(tools, 'semgrep')[0].slug, 'semgrep');
  assert.deepEqual(searchTools(tools, 'scanner', { category: 'ai' }).map((t) => t.slug), ['claude-sec']);
  assert.deepEqual(searchTools(tools, '', { kind: 'claude-plugin' }).map((t) => t.slug), ['claude-sec']);
  assert.equal(searchTools(tools, 'scan').length, 3, 'prefix match');
  assert.equal(searchTools(tools, 'semgrep nonexistentword').length, 0, 'all tokens must match');
});

test('local links are merged with existence flag', () => {
  const [t] = withLocalLinks([tool()], { semgrep: '/definitely/not/here' });
  assert.deepEqual(t.localLink, { path: '/definitely/not/here', exists: false });
});
