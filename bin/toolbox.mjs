#!/usr/bin/env node
// toolbox CLI — search the catalog, manage Local Links, validate and build.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import {
  PACKAGE_ROOT, catalogRoot, loadCatalog, searchTools, withLocalLinks, normalizeUrl,
  readConfig, writeConfig, readLocalLinks, writeLocalLinks, localLinksPath, configPath,
  validateRepo, renderGenerated, readJson, writeJson,
} from '../src/lib.mjs';

const HELP = `toolbox — personal catalog of external tools

Usage: toolbox <command> [args] [--json]

Find
  search [query...] [--category c] [--kind k] [--tag t] [--limit n]
                         Rank tools by query; filters are exact ids
  show <slug>            Full details of one tool
  exists <url>           Exit 0 + print slug if a tool already has this reference
  taxonomy               List categories and kinds with tool counts

Local Links (stored in ~/.config/toolbox/local.json, never committed)
  link <slug> <path>     Record where a tool lives on this machine
  unlink <slug>          Remove a Local Link
  links                  List Local Links

Maintainer
  config [repo <path>]   Show config, or set path of your git clone
  validate               Check taxonomy.json and tools/*.json
  build [--check]        Regenerate catalog.json, INDEX.md, schema (--check: fail if stale)
  check-links            Fail if any reference is broken (network)
  bump                   Bump patch version in package.json and plugin manifests
`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split('=', 2);
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') && ['category', 'kind', 'tag', 'limit'].includes(key))
        flags[key] = argv[++i];
      else flags[key] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

const out = (data, json, human) => (json ? console.log(JSON.stringify(data, null, 2)) : human(data));
const fail = (msg, code = 1) => {
  console.error(`toolbox: ${msg}`);
  process.exit(code);
};

function formatTool(t) {
  const tags = t.tags.length ? '  ' + t.tags.map((x) => `#${x}`).join(' ') : '';
  const lines = [`${t.slug}  [${t.kind}] ${t.categories.join(', ')}${tags}`, `  ${t.description}`, `  ↗ ${t.reference}`];
  if (t.localLink) lines.push(`  ⌂ ${t.localLink.path}${t.localLink.exists ? '' : '  (missing on disk)'}`);
  return lines.join('\n');
}

function catalogTools() {
  const catalog = loadCatalog();
  return { catalog, tools: withLocalLinks(catalog.tools) };
}

const commands = {
  search({ positional, flags }) {
    const { catalog, tools } = catalogTools();
    for (const [flag, group] of [['category', 'categories'], ['kind', 'kinds']]) {
      if (flags[flag] && !catalog.taxonomy[group].some((x) => x.id === flags[flag]))
        fail(`unknown ${flag} "${flags[flag]}". Valid: ${catalog.taxonomy[group].map((x) => x.id).join(', ')}`);
    }
    const results = searchTools(tools, positional.join(' '), {
      category: flags.category, kind: flags.kind, tag: flags.tag,
      limit: flags.limit ? Number(flags.limit) : undefined,
    });
    out(results, flags.json, (r) => {
      if (!r.length) {
        console.log('No tools matched. Maintainers can add one with /toolbox:add <url>.');
        process.exitCode = 1;
        return;
      }
      console.log(r.map(formatTool).join('\n\n'));
    });
  },

  show({ positional: [slug], flags }) {
    if (!slug) fail('usage: toolbox show <slug>');
    const tool = catalogTools().tools.find((t) => t.slug === slug);
    if (!tool) fail(`no tool "${slug}"`);
    out(tool, flags.json, (t) => {
      console.log(formatTool(t));
      if (t.install) console.log(`  install: ${t.install}`);
      if (t.notes) console.log(`\n${t.notes}`);
    });
  },

  exists({ positional: [url], flags }) {
    if (!url) fail('usage: toolbox exists <url>');
    const key = normalizeUrl(url);
    const tool = loadCatalog().tools.find((t) => normalizeUrl(t.reference) === key);
    out(tool ? { exists: true, slug: tool.slug } : { exists: false }, flags.json, (r) => console.log(r.exists ? r.slug : 'not found'));
    if (!tool) process.exitCode = 1;
  },

  taxonomy({ flags }) {
    const { taxonomy, tools } = loadCatalog();
    const data = {
      categories: taxonomy.categories.map((c) => ({ ...c, count: tools.filter((t) => t.categories.includes(c.id)).length })),
      kinds: taxonomy.kinds.map((k) => ({ ...k, count: tools.filter((t) => t.kind === k.id).length })),
    };
    out(data, flags.json, (d) => {
      console.log('Categories');
      for (const c of d.categories) console.log(`  ${c.id.padEnd(14)} ${String(c.count).padStart(3)}  ${c.description}`);
      console.log('\nKinds');
      for (const k of d.kinds) console.log(`  ${k.id.padEnd(14)} ${String(k.count).padStart(3)}  ${k.description}`);
    });
  },

  link({ positional: [slug, path] }) {
    if (!slug || !path) fail('usage: toolbox link <slug> <path>');
    if (!loadCatalog().tools.some((t) => t.slug === slug)) fail(`no tool "${slug}" in catalog`);
    const abs = resolve(path.replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));
    if (!existsSync(abs)) fail(`path does not exist: ${abs}`);
    const links = readLocalLinks();
    links[slug] = abs;
    writeLocalLinks(links);
    console.log(`linked ${slug} → ${abs}\n(stored in ${localLinksPath()})`);
  },

  unlink({ positional: [slug] }) {
    if (!slug) fail('usage: toolbox unlink <slug>');
    const links = readLocalLinks();
    if (!(slug in links)) fail(`no Local Link for "${slug}"`);
    delete links[slug];
    writeLocalLinks(links);
    console.log(`unlinked ${slug}`);
  },

  links({ flags }) {
    const links = readLocalLinks();
    const data = Object.entries(links).map(([slug, path]) => ({ slug, path, exists: existsSync(path) }));
    out(data, flags.json, (d) => {
      if (!d.length) return console.log(`No Local Links yet (${localLinksPath()}).`);
      for (const l of d) console.log(`${l.slug.padEnd(24)} ${l.path}${l.exists ? '' : '  (missing)'}`);
    });
  },

  config({ positional: [key, value], flags }) {
    const cfg = readConfig();
    if (!key) {
      const data = { configFile: configPath(), ...cfg, catalogRoot: catalogRoot(), pluginRoot: PACKAGE_ROOT };
      return out(data, flags.json, (d) => Object.entries(d).forEach(([k, v]) => console.log(`${k.padEnd(12)} ${v}`)));
    }
    if (key !== 'repo') fail('only "repo" can be set');
    if (!value) fail('usage: toolbox config repo <path-to-your-clone>');
    const abs = resolve(value);
    if (!existsSync(join(abs, 'taxonomy.json')) || !existsSync(join(abs, '.git')))
      fail(`${abs} is not a git clone of the toolbox (needs taxonomy.json and .git)`);
    writeConfig({ ...cfg, repo: abs });
    console.log(`repo → ${abs}`);
  },

  validate() {
    const errors = validateRepo(PACKAGE_ROOT);
    if (errors.length) {
      console.error(errors.map((e) => `✗ ${e}`).join('\n'));
      fail(`${errors.length} error(s)`);
    }
    console.log('✓ valid');
  },

  build({ flags }) {
    const errors = validateRepo(PACKAGE_ROOT);
    if (errors.length) {
      console.error(errors.map((e) => `✗ ${e}`).join('\n'));
      fail('fix validation errors before building');
    }
    const files = renderGenerated(PACKAGE_ROOT);
    const stale = Object.entries(files).filter(([rel, content]) => {
      const p = join(PACKAGE_ROOT, rel);
      return !existsSync(p) || readFileSync(p, 'utf8') !== content;
    });
    if (flags.check) {
      if (stale.length) fail(`generated files are stale: ${stale.map(([r]) => r).join(', ')} — run \`npm run build\``);
      return console.log('✓ generated files up to date');
    }
    for (const [rel, content] of stale) {
      const p = join(PACKAGE_ROOT, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content);
    }
    console.log(stale.length ? `✓ wrote ${stale.map(([r]) => r).join(', ')}` : '✓ nothing to update');
  },

  async 'check-links'() {
    const { tools } = JSON.parse(renderGenerated(PACKAGE_ROOT)['catalog.json']);
    const broken = [];
    const warn = [];
    const check = async (t) => {
      const opts = { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'toolbox-link-checker' } };
      try {
        let res = await fetch(t.reference, { ...opts, method: 'HEAD' });
        if (res.status === 405 || res.status === 403 || res.status === 501) res = await fetch(t.reference, { ...opts, method: 'GET' });
        if (res.status === 404 || res.status === 410) broken.push(`${t.slug}: ${res.status} ${t.reference}`);
        else if (res.status >= 400) warn.push(`${t.slug}: ${res.status} ${t.reference}`);
      } catch (e) {
        broken.push(`${t.slug}: ${e.cause?.code ?? e.name} ${t.reference}`);
      }
    };
    const queue = [...tools];
    await Promise.all(Array.from({ length: 5 }, async () => { while (queue.length) await check(queue.shift()); }));
    for (const w of warn) console.warn(`! ${w}`);
    if (broken.length) {
      console.error(broken.map((b) => `✗ ${b}`).join('\n'));
      fail(`${broken.length} broken reference(s)`);
    }
    console.log(`✓ ${tools.length} references reachable`);
  },

  bump() {
    const targets = ['package.json', '.claude-plugin/plugin.json'];
    const pkg = readJson(join(PACKAGE_ROOT, 'package.json'));
    const [maj, min, patch] = pkg.version.split('.').map(Number);
    const next = `${maj}.${min}.${patch + 1}`;
    for (const rel of targets) {
      const p = join(PACKAGE_ROOT, rel);
      const data = readJson(p);
      data.version = next;
      writeJson(p, data);
    }
    const mp = join(PACKAGE_ROOT, '.claude-plugin/marketplace.json');
    const market = readJson(mp);
    for (const plugin of market.plugins) plugin.version = next;
    writeJson(mp, market);
    console.log(next);
  },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(HELP);
} else if (!commands[cmd]) {
  fail(`unknown command "${cmd}"\n\n${HELP}`);
} else {
  try {
    await commands[cmd](parseArgs(rest));
  } catch (e) {
    if (e.code === 'ENOENT' && /catalog\.json/.test(e.message)) fail('catalog.json missing — run `npm run build`');
    throw e;
  }
}
