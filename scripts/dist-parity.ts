/**
 * Compares two built sites page by page: the URL set, what search engines read from each page
 * and the text a visitor sees. The migration keeps a site's output identical unless a change is
 * meant, so every unexpected difference here is a regression.
 *
 * Usage: tsx scripts/dist-parity.ts <baseline-dist> <candidate-dist> [--ignore=field,field]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface PageSignature {
  readonly title: string;
  readonly meta: Readonly<Record<string, string>>;
  readonly canonical: string;
  readonly structuredData: readonly string[];
  readonly headings: readonly string[];
  readonly inlineScripts: number;
  readonly links: readonly string[];
  readonly text: string;
}

export type SignatureField = keyof PageSignature;

/** Files whose bytes are part of the public contract; hashed bundles under assets/ are not. */
const CONTRACT_FILES = ['sitemap.xml', 'robots.txt', 'llms.txt', 'song-ids.json', '_headers', '_routes.json', 'site.webmanifest', 'theme-init.js'];

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (value: string) => value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (entity, name: string) =>
  name[0] === '#' ? String.fromCodePoint(Number(name[1] === 'x' || name[1] === 'X' ? `0${name.slice(1)}` : name.slice(1))) : ENTITIES[name] ?? entity);
const squash = (value: string) => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const attribute = (tag: string, name: string) => decode(tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] ?? '');

/** Key-ordered JSON, so two equal structured-data blocks compare equal however they were serialised. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function pageSignature(html: string): PageSignature {
  const meta: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = attribute(tag, 'name') || attribute(tag, 'property') || attribute(tag, 'http-equiv');
    if (key) meta[key] = attribute(tag, 'content');
  }
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const structuredData = scripts.filter(([, attributes]) => /type\s*=\s*"application\/ld\+json"/i.test(attributes!)).map(([, , body]) => canonicalJson(JSON.parse(body!)));
  const inlineScripts = scripts.filter(([, attributes, body]) => !/\ssrc\s*=/i.test(attributes!) && !/application\/ld\+json/i.test(attributes!) && body!.trim() !== '').length;
  const links = [...new Set([...html.matchAll(/<a\b[^>]*>/gi)].map(([tag]) => attribute(tag, 'href')).filter(href => href !== ''))].sort();
  const body = html.slice(html.search(/<body\b/i)).replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ');
  return {
    title: squash(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
    meta,
    canonical: attribute(html.match(/<link\b[^>]*rel\s*=\s*"canonical"[^>]*>/i)?.[0] ?? '', 'href'),
    structuredData,
    headings: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(([, inner]) => squash(inner!)),
    inlineScripts,
    links,
    text: squash(body),
  };
}

/** Every file under a directory, as a URL-style path relative to it. */
function filesUnder(root: string, directory = root): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(root, path) : [relative(root, path).split(sep).join('/')];
  });
}

export interface ParityReport { readonly differences: readonly string[]; readonly pages: number }

export function compareSignatures(page: string, baseline: PageSignature, candidate: PageSignature, ignore: ReadonlySet<SignatureField> = new Set()): string[] {
  return (Object.keys(baseline) as SignatureField[]).filter(field => !ignore.has(field))
    .filter(field => canonicalJson(baseline[field]) !== canonicalJson(candidate[field]))
    .map(field => `${page}: ${field} differs\n  - ${canonicalJson(baseline[field])}\n  + ${canonicalJson(candidate[field])}`);
}

export function compareDists(baselineDir: string, candidateDir: string, ignore: ReadonlySet<SignatureField> = new Set()): ParityReport {
  const pagesOf = (dir: string) => new Set(filesUnder(dir).filter(file => file.endsWith('.html')));
  const baselinePages = pagesOf(baselineDir);
  const candidatePages = pagesOf(candidateDir);
  const differences: string[] = [
    ...[...baselinePages].filter(page => !candidatePages.has(page)).map(page => `${page}: missing from candidate`),
    ...[...candidatePages].filter(page => !baselinePages.has(page)).map(page => `${page}: added in candidate`),
  ];
  for (const page of [...baselinePages].filter(page => candidatePages.has(page)).sort()) {
    const read = (dir: string) => pageSignature(readFileSync(join(dir, page), 'utf8'));
    differences.push(...compareSignatures(page, read(baselineDir), read(candidateDir), ignore));
  }
  for (const file of CONTRACT_FILES) {
    const read = (dir: string) => { try { return readFileSync(join(dir, file), 'utf8'); } catch { return undefined; } };
    if (read(baselineDir) !== read(candidateDir)) differences.push(`${file}: contents differ`);
  }
  return { differences, pages: baselinePages.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [baselineDir, candidateDir] = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  if (!baselineDir || !candidateDir) {
    console.error('Usage: tsx scripts/dist-parity.ts <baseline-dist> <candidate-dist> [--ignore=field,field]');
    process.exit(2);
  }
  const ignore = new Set((process.argv.find(argument => argument.startsWith('--ignore='))?.slice('--ignore='.length).split(',') ?? []) as SignatureField[]);
  const report = compareDists(baselineDir, candidateDir, ignore);
  console.log(report.differences.length === 0 ? `Parity: ${report.pages} pages identical.` : report.differences.join('\n'));
  process.exit(report.differences.length === 0 ? 0 : 1);
}
