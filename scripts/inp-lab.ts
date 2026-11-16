/**
 * Lab INP harness: serves a built site, drives headless Chrome over the DevTools protocol on a throttled phone
 * profile and reports, for every target interaction, its Event Timing duration split into input delay,
 * processing and presentation delay. Real (trusted) touch and key input, saved songs, progress and a ranking
 * are seeded so the page does the work a returning visitor's page does.
 *
 * Usage: tsx scripts/inp-lab.ts [dist] [--cpu=4] [--runs=5] [--only=scenario,scenario] [--css="rule"] [--cpu-raster]
 * Raster columns come from a trace of each interaction: desktop raster is far faster than a phone's, so read them as
 * the relative paint work an interaction causes, not as phone milliseconds.
 * `--cpu-raster` rasterizes on one CPU thread without a GPU, so paint cost shows up in the numbers as it does on slow phones.
 * `--css` injects a stylesheet into every page, to measure what a rendering change would save before making it.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.ico': 'image/x-icon' };

/** A static server shaped like Pages: directory index, home for unknown paths, and a fixed popularity ranking. */
function serve(dist: string, ranking: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    if (path === '/api/popularity') return void response.writeHead(200, { 'Content-Type': 'application/json' }).end(ranking);
    if (path.startsWith('/api/')) return void response.writeHead(204).end();
    let file = join(dist, normalize(path));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) file = join(dist, 'index.html');
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve({ server, origin: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}` });
  }));
}

/** One page session over the DevTools protocol. */
class Page {
  private next = 0;
  private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private readonly waiters: { method: string; resolve: () => void }[] = [];
  private readonly listeners = new Map<string, (params: any) => void>();
  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) {
        const call = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) call?.reject(new Error(message.error.message)); else call?.resolve(message.result);
      } else {
        this.listeners.get(message.method)?.(message.params);
        for (const waiter of this.waiters.splice(0)) if (waiter.method === message.method) waiter.resolve(); else this.waiters.push(waiter);
      }
    });
  }
  static async open(url: string): Promise<Page> {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
    return new Page(socket);
  }
  send(method: string, params: object = {}): Promise<any> {
    const id = ++this.next;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method: string, listener: (params: any) => void): void { this.listeners.set(method, listener); }
  once(method: string): Promise<void> { return new Promise(resolve => this.waiters.push({ method, resolve })); }
  async evaluate<T>(expression: string): Promise<T> {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value as T;
  }
  close(): void { this.socket.close(); }
}

/** Records every event-timing entry with an interaction id, from the first byte of the document. */
const OBSERVER = `(() => {
  window.__events = [];
  const describe = node => !node ? '' : node.id ? '#' + node.id : node.className && typeof node.className === 'string' ? node.tagName.toLowerCase() + '.' + node.className.split(' ')[0] : node.tagName.toLowerCase();
  new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.interactionId) window.__events.push({
    id: e.interactionId, name: e.name, target: describe(e.target), start: e.startTime, duration: e.duration,
    delay: e.processingStart - e.startTime, processing: e.processingEnd - e.processingStart,
    presentation: Math.max(0, e.startTime + e.duration - e.processingEnd) }); }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  window.__frames = [];
  new PerformanceObserver(list => { for (const f of list.getEntries()) window.__frames.push({
    start: f.startTime, end: f.startTime + f.duration, renderStart: f.renderStart, styleStart: f.styleAndLayoutStart,
    scripts: f.scripts.map(s => ({ name: (s.invoker || s.sourceFunctionName || '?') + ' ' + (s.sourceFunctionName || ''), duration: s.duration })) }); })
    .observe({ type: 'long-animation-frame', buffered: true });
})();`;

interface Interaction { label: string; duration: number; delay: number; processing: number; presentation: number; frameRender: number; frameStyleLayout: number; raster: number; paints: number; topScript: string }
interface Frame { start: number; end: number; renderStart: number; styleStart: number; scripts: { name: string; duration: number }[] }

async function sleep(ms: number): Promise<void> { await new Promise(resolve => setTimeout(resolve, ms)); }

async function waitFor(page: Page, condition: string, timeout = 20_000): Promise<void> {
  const until = Date.now() + timeout;
  while (!(await page.evaluate<boolean>(`Boolean(${condition})`))) {
    if (Date.now() > until) throw new Error(`Timed out waiting for ${condition}`);
    await sleep(100);
  }
}

async function tap(page: Page, selector: string): Promise<void> {
  const box = await page.evaluate<{ x: number; y: number } | null>(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
    el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) throw new Error(`No element for ${selector}`);
  await sleep(150);
  const point = [{ x: box.x, y: box.y }];
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function type(page: Page, text: string, gapMs: number): Promise<void> {
  for (const character of text) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: character, text: character });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: character });
    await sleep(gapMs);
  }
}

/** Interactions recorded since the mark, one per interaction id, labelled with what the scenario did. */
async function collect(page: Page, since: number, label: string): Promise<Interaction[]> {
  await sleep(600);
  const events = await page.evaluate<(Interaction & { id: number; start: number })[]>(`window.__events.filter(e => e.start >= ${since})`);
  const frames = await page.evaluate<Frame[]>(`window.__frames.filter(f => f.end >= ${since})`);
  // One interaction dispatches several events (pointerdown, pointerup, click, keydown, input…) that share its
  // duration: the delay is the first one's, the processing is every handler's, and the rest is presentation.
  const byId = new Map<number, (Interaction & { id: number; start: number })[]>();
  for (const event of events) byId.set(event.id, [...byId.get(event.id) ?? [], event]);
  return [...byId.values()].map(group => {
    const first = group.reduce((a, b) => (b.start < a.start ? b : a));
    const duration = Math.max(...group.map(event => event.duration));
    const processing = group.reduce((sum, event) => sum + event.processing, 0);
    const overlapping = frames.filter(frame => frame.end > first.start && frame.start < first.start + duration);
    const frameRender = overlapping.reduce((sum, frame) => sum + (frame.renderStart ? frame.end - frame.renderStart : 0), 0);
    const frameStyleLayout = overlapping.reduce((sum, frame) => sum + (frame.styleStart ? frame.end - frame.styleStart : 0), 0);
    const scripts = overlapping.flatMap(frame => frame.scripts).sort((a, b) => b.duration - a.duration);
    const topScript = scripts[0] ? `${scripts[0].name.trim()} ${Math.round(scripts[0].duration)}` : '';
    return { label, duration, delay: first.delay, processing, presentation: Math.max(0, duration - first.delay - processing), frameRender, frameStyleLayout, raster: 0, paints: 0, topScript };
  });
}

const now = (page: Page) => page.evaluate<number>('performance.now()');

interface TraceEvent { name: string; dur?: number }

/** Runs one interaction under a trace and adds the raster milliseconds and paint count it caused to its entries. */
async function measure(page: Page, label: string, action: () => Promise<void>): Promise<Interaction[]> {
  const events: TraceEvent[] = [];
  page.on('Tracing.dataCollected', ({ value }) => events.push(...value));
  await page.send('Tracing.start', { categories: 'cc,viz,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  const mark = await now(page);
  await action();
  const interactions = await collect(page, mark, label);
  const complete = page.once('Tracing.tracingComplete');
  await page.send('Tracing.end');
  await complete;
  const raster = events.filter(event => event.name === 'RasterTask').reduce((sum, event) => sum + (event.dur ?? 0), 0) / 1000;
  const paints = events.filter(event => event.name === 'Paint').length;
  return interactions.map(interaction => ({ ...interaction, raster, paints }));
}

type Scenario = (page: Page, origin: string, songIds: readonly string[]) => Promise<Interaction[]>;

async function load(page: Page, url: string, ready: string): Promise<void> {
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url });
  await loaded;
  await waitFor(page, ready);
  await sleep(1500);
}

const ROWS_READY = "document.querySelectorAll('#demos .song-row').length > 20";

const SCENARIOS: Record<string, Scenario> = {
  async search(page, origin) {
    await load(page, `${origin}/`, ROWS_READY);
    await tap(page, '#song-search');
    return (await measure(page, 'search keystroke', () => type(page, 'zelda lu', 80))).filter(entry => entry.duration > 0);
  },
  async nav(page, origin) {
    await load(page, `${origin}/`, ROWS_READY);
    const results: Interaction[] = [];
    for (const [selector, label] of [['.app-nav .nav-popular', 'nav popular'], ['.app-nav .nav-saved', 'nav saved'], ['.app-nav [data-view-link="catalog"]', 'nav songbook']] as const) {
      results.push(...await measure(page, label, () => tap(page, selector)));
    }
    return results;
  },
  async back(page, origin, songIds) {
    await load(page, `${origin}/song/${songIds[0]}/`, "document.querySelector('#tab .staff, #tab *')");
    return measure(page, 'back from deep link', () => tap(page, '.back-link'));
  },
  async quickplay(page, origin) {
    await load(page, `${origin}/`, ROWS_READY);
    const results: Interaction[] = [];
    for (const [selector, label] of [['#demos .song-row:nth-of-type(3) [data-quick-play]', 'quick-play first'], ['#demos .song-row:nth-of-type(5) [data-quick-play]', 'quick-play second'], ['#mini-close', 'mini close']] as const) {
      results.push(...await measure(page, label, () => tap(page, selector)));
      await sleep(800);
    }
    return results;
  },
};

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const option = (name: string, fallback: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const dist = args.find(arg => !arg.startsWith('--')) ?? 'dist';
  const cpu = Number(option('cpu', '4'));
  const runs = Number(option('runs', '5'));
  const only = option('only', Object.keys(SCENARIOS).join(',')).split(',');
  const css = option('css', '');
  const cpuRaster = args.includes('--cpu-raster');
  const songIds: string[] = JSON.parse(readFileSync(join(dist, 'song-ids.json'), 'utf8'));
  const ranking = JSON.stringify({ songs: songIds.slice(0, 40).map((id, index) => ({ id, plays: 400 - index * 7 })) });
  const seed = {
    'ocarina.saved.v1': JSON.stringify(songIds.filter((_, index) => index % 9 === 0)),
    'ocarina.progress.v1': JSON.stringify(Object.fromEntries(songIds.filter((_, index) => index % 4 === 0).map((id, index) => [id, { completed: index % 2 === 0, bestCombo: 12, openedAt: Date.now() - index * 60_000 }]))),
  };
  const { server, origin } = await serve(dist, ranking);
  const profile = mkdtempSync(join(tmpdir(), 'inp-lab-'));
  const port = 9600 + Math.floor(Math.random() * 300);
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disk-cache-size=1', '--media-cache-size=1', '--no-first-run', '--autoplay-policy=no-user-gesture-required', ...(cpuRaster ? ['--disable-gpu', '--disable-gpu-rasterization', '--num-raster-threads=1'] : []), 'about:blank'], { stdio: 'ignore' });
  try {
    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let attempt = 0; attempt < 50 && !target; attempt++) {
      await sleep(200);
      target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(response => response.json()).catch(() => undefined);
    }
    if (!target) throw new Error('Chrome did not start');
    const page = await Page.open(target.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `${OBSERVER}\ntry { for (const [k, v] of Object.entries(${JSON.stringify(seed)})) localStorage.setItem(k, v); } catch {}
${css ? `document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(css)} })));` : ''}` });
    const all: Interaction[] = [];
    for (let run = 0; run < runs; run++) for (const name of only) all.push(...await SCENARIOS[name]!(page, origin, songIds));
    page.close();
    const labels = [...new Set(all.map(entry => entry.label))];
    console.log(`INP lab · ${dist} · 390x844 · CPU ${cpu}x · ${runs} runs${css ? ` · css: ${css}` : ''} (ms, p75 per interaction)`);
    console.log(['interaction'.padEnd(22), 'n', 'p75', 'max', 'delay', 'processing', 'presentation', 'rAF+render', 'style+layout+paint', 'raster', 'paints', 'top script (last run)'].join('\t'));
    for (const label of labels) {
      const entries = all.filter(entry => entry.label === label);
      const p75 = (key: 'duration' | 'delay' | 'processing' | 'presentation' | 'frameRender' | 'frameStyleLayout' | 'raster' | 'paints') => Math.round(percentile(entries.map(entry => entry[key]), 0.75));
      console.log([label.padEnd(22), entries.length, p75('duration'), Math.round(Math.max(...entries.map(entry => entry.duration))), p75('delay'), p75('processing'), p75('presentation'), p75('frameRender'), p75('frameStyleLayout'), p75('raster'), p75('paints'), entries.at(-1)!.topScript].join('\t'));
    }
  } finally {
    chrome.kill();
    server.close();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
