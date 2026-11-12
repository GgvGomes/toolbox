// Core library for the toolbox: taxonomy, tools, validation, catalog build, search, local config.
// Zero dependencies. Node >= 20.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TAG_RE = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOOL_FIELDS = new Set([
  '$schema', 'slug', 'name', 'description', 'reference', 'kind',
  'categories', 'tags', 'install', 'notes', 'added',
]);
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 280;
const NOTES_MAX = 2000;
const TAGS_MAX = 10;

// ---------- fs helpers ----------

export function readJson(path, fallback) {
  if (fallback !== undefined && !existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

// ---------- local (per-machine, never committed) config ----------

export function configDir() {
  if (process.env.TOOLBOX_CONFIG_DIR) return process.env.TOOLBOX_CONFIG_DIR;
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'toolbox');
}

const configFile = () => join(configDir(), 'config.json');
const localLinksFile = () => join(configDir(), 'local.json');

export const readConfig = () => readJson(configFile(), {});
export const writeConfig = (cfg) => writeJson(configFile(), cfg);
export const readLocalLinks = () => readJson(localLinksFile(), {});
export const writeLocalLinks = (links) => writeJson(localLinksFile(), sortKeys(links));
export const localLinksPath = localLinksFile;
export const configPath = configFile;

/** Root whose catalog should be read: the Maintainer clone if configured, else this package. */
export function catalogRoot() {
  const { repo } = readConfig();
  if (repo && existsSync(join(repo, 'catalog.json'))) return repo;
  return PACKAGE_ROOT;
}

// ---------- taxonomy & tools ----------

export function loadTaxonomy(root) {
  return readJson(join(root, 'taxonomy.json'));
}

/** @returns {{file: string, data?: any, parseError?: string}[]} sorted by file name */
export function loadToolFiles(root) {
  const dir = join(root, 'tools');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const file = join('tools', f);
      try {
        return { file, data: JSON.parse(readFileSync(join(dir, f), 'utf8')) };
      } catch (e) {
        return { file, parseError: e.message };
      }
    });
}

export function loadCatalog(root = catalogRoot()) {
  return readJson(join(root, 'catalog.json'));
}

// ---------- validation ----------

const isStr = (v) => typeof v === 'string';

function isHttpUrl(v) {
  if (!isStr(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isRealDate(v) {
  if (!isStr(v) || !DATE_RE.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '').replace(/\.git$/, '').toLowerCase();
    return `${host}${path}${u.search}`;
  } catch {
    return String(url).trim().toLowerCase();
  }
}

export function validateTaxonomy(taxonomy) {
  const errors = [];
  for (const group of ['categories', 'kinds']) {
    const list = taxonomy?.[group];
    if (!Array.isArray(list) || list.length === 0) {
      errors.push(`taxonomy.json: "${group}" must be a non-empty array`);
      continue;
    }
    const seen = new Set();
    for (const [i, entry] of list.entries()) {
      const where = `taxonomy.json: ${group}[${i}]`;
      if (!isStr(entry?.id) || !SLUG_RE.test(entry.id)) errors.push(`${where}: id must be kebab-case`);
      else if (seen.has(entry.id)) errors.push(`${where}: duplicate id "${entry.id}"`);
      else seen.add(entry.id);
      if (!isStr(entry?.name) || !entry.name.trim()) errors.push(`${where}: name is required`);
      if (!isStr(entry?.description) || !entry.description.trim()) errors.push(`${where}: description is required`);
    }
  }
  return errors;
}

export function validateTool(tool, file, taxonomy) {
  const errors = [];
  const err = (msg) => errors.push(`${file}: ${msg}`);
  if (typeof tool !== 'object' || tool === null || Array.isArray(tool)) {
    err('must be a JSON object');
    return errors;
  }
  const categoryIds = new Set(taxonomy.categories.map((c) => c.id));
  const kindIds = new Set(taxonomy.kinds.map((k) => k.id));

  for (const key of Object.keys(tool)) if (!TOOL_FIELDS.has(key)) err(`unknown field "${key}"`);

  const expectedSlug = basename(file, '.json');
  if (!isStr(tool.slug) || !SLUG_RE.test(tool.slug)) err('slug must be kebab-case (a-z, 0-9, -)');
  else if (tool.slug !== expectedSlug) err(`slug "${tool.slug}" must match file name "${expectedSlug}"`);

  if (!isStr(tool.name) || !tool.name.trim()) err('name is required');

  if (!isStr(tool.description)) err('description is required');
  else if (tool.description.length < DESCRIPTION_MIN || tool.description.length > DESCRIPTION_MAX)
    err(`description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} chars (got ${tool.description.length})`);

  if (!isHttpUrl(tool.reference)) err('reference must be an http(s) URL');

  if (!kindIds.has(tool.kind)) err(`kind must be one of: ${[...kindIds].join(', ')}`);

  if (!Array.isArray(tool.categories) || tool.categories.length === 0) err('categories must be a non-empty array');
  else {
    for (const c of tool.categories) if (!categoryIds.has(c)) err(`unknown category "${c}" (add it to taxonomy.json first)`);
    if (new Set(tool.categories).size !== tool.categories.length) err('categories must be unique');
  }

  if (tool.tags !== undefined) {
    if (!Array.isArray(tool.tags)) err('tags must be an array');
    else {
      if (tool.tags.length > TAGS_MAX) err(`at most ${TAGS_MAX} tags`);
      for (const t of tool.tags) if (!isStr(t) || !TAG_RE.test(t)) err(`tag "${t}" must be lowercase kebab-case`);
      if (new Set(tool.tags).size !== tool.tags.length) err('tags must be unique');
    }
  }

  if (tool.install !== undefined && (!isStr(tool.install) || !tool.install.trim())) err('install must be a non-empty string');
  if (tool.notes !== undefined && (!isStr(tool.notes) || tool.notes.length > NOTES_MAX))
    err(`notes must be a string up to ${NOTES_MAX} chars`);

  if (!isRealDate(tool.added)) err('added must be a YYYY-MM-DD date');

  return errors;
}

/** Validate the whole repo at `root`. Returns a list of error strings (empty = valid). */
export function validateRepo(root) {
  let taxonomy;
  try {
    taxonomy = loadTaxonomy(root);
  } catch (e) {
    return [`taxonomy.json: ${e.message}`];
  }
  const errors = validateTaxonomy(taxonomy);
  if (errors.length) return errors;

  const byRef = new Map();
  for (const { file, data, parseError } of loadToolFiles(root)) {
    if (parseError) {
      errors.push(`${file}: invalid JSON (${parseError})`);
      continue;
    }
    errors.push(...validateTool(data, file, taxonomy));
    if (isStr(data?.reference)) {
      const key = normalizeUrl(data.reference);
      if (byRef.has(key)) errors.push(`${file}: same reference as ${byRef.get(key)}`);
      else byRef.set(key, file);
    }
  }
  return errors;
}

// ---------- build (catalog.json, INDEX.md, schema) ----------

function cleanTool(t) {
  const out = {
    slug: t.slug,
    name: t.name,
    description: t.description,
    reference: t.reference,
    kind: t.kind,
    categories: t.categories,
    tags: t.tags ?? [],
  };
  if (t.install) out.install = t.install;
  if (t.notes) out.notes = t.notes;
  out.added = t.added;
  return out;
}

export function buildCatalog(root) {
  const taxonomy = loadTaxonomy(root);
  const tools = loadToolFiles(root)
    .map((f) => cleanTool(f.data))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    version: 1,
    generatedBy: 'npm run build — do not edit by hand',
    counts: { tools: tools.length, categories: taxonomy.categories.length, kinds: taxonomy.kinds.length },
    taxonomy,
    tools,
  };
}

function anchor(text) {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
}

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function renderIndex(catalog) {
  const { taxonomy, tools } = catalog;
  const kindName = Object.fromEntries(taxonomy.kinds.map((k) => [k.id, k.name]));
  const lines = [
    '# Toolbox Index',
    '',
    '> Generated by `npm run build` from `tools/*.json` and `taxonomy.json`. Do not edit by hand.',
    '',
    `**${tools.length} tools** · ${taxonomy.categories.length} categories · ${taxonomy.kinds.length} kinds`,
    '',
    '## Categories',
    '',
  ];
  const inCategory = (id) => tools.filter((t) => t.categories.includes(id));
  for (const c of taxonomy.categories)
    lines.push(`- [${c.name}](#${anchor(c.name)}) (${inCategory(c.id).length}) — ${c.description}`);

  lines.push('', '## Kinds', '', '| Kind | Description | Tools |', '|---|---|---|');
  for (const k of taxonomy.kinds)
    lines.push(`| \`${k.id}\` | ${cell(k.description)} | ${tools.filter((t) => t.kind === k.id).length} |`);

  for (const c of taxonomy.categories) {
    lines.push('', `## ${c.name}`, '', `_${c.description}_`, '');
    const list = inCategory(c.id);
    if (list.length === 0) {
      lines.push('_No tools yet._');
      continue;
    }
    lines.push('| Tool | Kind | Description | Tags |', '|---|---|---|---|');
    for (const t of list) {
      const tags = t.tags.map((x) => `\`${x}\``).join(' ');
      lines.push(`| [${cell(t.name)}](${t.reference}) | ${kindName[t.kind] ?? t.kind} | ${cell(t.description)} | ${tags} |`);
    }
  }
  return lines.join('\n') + '\n';
}

export function renderSchema(taxonomy) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'tool.schema.json',
    title: 'Toolbox Tool',
    description: 'One catalog entry. Generated by `npm run build` from taxonomy.json — do not edit by hand.',
    type: 'object',
    additionalProperties: false,
    required: ['slug', 'name', 'description', 'reference', 'kind', 'categories', 'added'],
    properties: {
      $schema: { type: 'string' },
      slug: { type: 'string', pattern: SLUG_RE.source, description: 'Kebab-case id; must match file name.' },
      name: { type: 'string', minLength: 1, description: 'Display name.' },
      description: {
        type: 'string', minLength: DESCRIPTION_MIN, maxLength: DESCRIPTION_MAX,
        description: 'What it does and when to use it, in one or two sentences. Written for search.',
      },
      reference: { type: 'string', format: 'uri', pattern: '^https?://', description: 'Public link (repo, site, package).' },
      kind: {
        enum: taxonomy.kinds.map((k) => k.id),
        description: taxonomy.kinds.map((k) => `${k.id}: ${k.description}`).join('\n'),
      },
      categories: {
        type: 'array', minItems: 1, uniqueItems: true,
        items: { enum: taxonomy.categories.map((c) => c.id) },
        description: taxonomy.categories.map((c) => `${c.id}: ${c.description}`).join('\n'),
      },
      tags: {
        type: 'array', maxItems: TAGS_MAX, uniqueItems: true,
        items: { type: 'string', pattern: TAG_RE.source },
        description: 'Free lowercase labels for finer search.',
      },
      install: { type: 'string', minLength: 1, description: 'How to install or start using it (one command if possible).' },
      notes: { type: 'string', maxLength: NOTES_MAX, description: 'Optional usage notes, caveats, tips.' },
      added: { type: 'string', pattern: DATE_RE.source, description: 'Date added (YYYY-MM-DD).' },
    },
  };
}

/** Returns map of relative path -> file contents for every generated file. */
export function renderGenerated(root) {
  const catalog = buildCatalog(root);
  return {
    'catalog.json': JSON.stringify(catalog, null, 2) + '\n',
    'INDEX.md': renderIndex(catalog),
    'schema/tool.schema.json': JSON.stringify(renderSchema(catalog.taxonomy), null, 2) + '\n',
  };
}

// ---------- search ----------

export function tokenize(text) {
  return String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const WEIGHTS = { slug: 6, name: 6, tags: 4, categories: 3, kind: 3, description: 1, notes: 0.5 };

function fieldTokens(tool) {
  return {
    slug: tokenize(tool.slug),
    name: tokenize(tool.name),
    tags: tool.tags.flatMap(tokenize),
    categories: tool.categories.flatMap(tokenize),
    kind: tokenize(tool.kind),
    description: tokenize(tool.description),
    notes: tokenize(tool.notes),
  };
}

/**
 * Rank tools against a free-text query plus optional exact filters.
 * Every query token must match some field (prefix match allowed for tokens >= 3 chars).
 */
export function searchTools(tools, query = '', { category, kind, tag, limit } = {}) {
  const qTokens = tokenize(query);
  const results = [];
  for (const tool of tools) {
    if (category && !tool.categories.includes(category)) continue;
    if (kind && tool.kind !== kind) continue;
    if (tag && !tool.tags.includes(tag)) continue;

    const fields = fieldTokens(tool);
    let score = 0;
    let allMatched = true;
    for (const q of qTokens) {
      let best = 0;
      for (const [field, tokens] of Object.entries(fields)) {
        const w = WEIGHTS[field];
        if (tokens.includes(q)) best = Math.max(best, w);
        else if (q.length >= 3 && tokens.some((t) => t.startsWith(q))) best = Math.max(best, w * 0.6);
      }
      if (best === 0) allMatched = false;
      score += best;
    }
    if (qTokens.length && !allMatched) continue;
    results.push({ tool, score });
  }
  results.sort((a, b) => b.score - a.score || a.tool.slug.localeCompare(b.tool.slug));
  return (limit ? results.slice(0, limit) : results).map((r) => ({ ...r.tool, score: r.score }));
}

export function withLocalLinks(tools, links = readLocalLinks()) {
  return tools.map((t) => {
    const path = links[t.slug];
    if (!path) return t;
    return { ...t, localLink: { path, exists: existsSync(path) } };
  });
}

// ---------- misc ----------

export function sortKeys(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}
