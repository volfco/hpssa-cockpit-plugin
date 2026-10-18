// Isolated layout regression check. Requires Node >=22 and Firefox BiDi:
// firefox --headless --no-remote --profile /tmp/hpssa-ui-profile --remote-debugging-port 9222
// node test/ui-check.mjs (optional HPSSA_BIDI_URL, default ws://127.0.0.1:9222/session)
// All hardware calls are mocked; no host storage is accessed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { build } from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

const root = path.resolve(import.meta.dirname, '..');
const outdir = await fs.mkdtemp(path.join(os.tmpdir(), 'hpssa-ui-'));
const fixture = path.join(root, 'test/ui/fixtures.ts');
await build({
    absWorkingDir: root, entryPoints: ['src/index.tsx'], outdir, bundle: true,
    nodePaths: ['pkg/lib'], external: ['*.woff', '*.woff2', '*.svg', '../../assets*'],
    plugins: [{
        name: 'isolated-hardware',
        setup(b) {
            b.onResolve({ filter: /^cockpit$/ }, () => ({ path: fixture }));
            b.onLoad({ filter: /\/src\/service\.ts$/ }, async ({ path: file }) => ({
                loader: 'ts',
                contents: (await fs.readFile(file, 'utf8'))
                        .replace('export async function fetchOverview()', 'async function unusedHardwareOverview()') + `
import { overview as fixtureOverview } from ${JSON.stringify(fixture)};
export async function fetchOverview() {
    if (window.location.search.includes('error')) throw new Error('Mock discovery failure');
    if (window.location.search.includes('empty')) return { controllers: [], arrays: [], logicalDrives: [], physicalDrives: [], enclosures: [] };
    return fixtureOverview;
}`,
            }));
        },
    }, sassPlugin({ loadPaths: ['pkg/lib', 'node_modules'], quietDeps: true })],
});
const server = http.createServer(async (req, res) => {
    const file = req.url.split('?')[0];
    if (file === '/' || file === '/index.html') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/index.css"><script defer src="/index.js"></script></head><body><div id="app"></div></body></html>');
    } else if (file === '/index.js' || file === '/index.css') {
        res.setHeader('Content-Type', file.endsWith('js') ? 'text/javascript' : 'text/css');
        res.end(await fs.readFile(path.join(outdir, file)));
    } else if (/^\/static\/fonts\/[A-Za-z0-9/-]+\.woff2$/.test(file)) {
        let font = file.slice('/static/fonts/'.length);
        if (!font.includes('/')) font = font.split('-')[0] + '/' + font;
        res.setHeader('Content-Type', 'font/woff2');
        res.end(await fs.readFile(path.join(root, 'node_modules/@patternfly/patternfly/assets/fonts', font)));
    } else { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const ws = new WebSocket(process.env.HPSSA_BIDI_URL || 'ws://127.0.0.1:9222/session');
let id = 0;
const pending = new Map();
const runtimeErrors = [];
ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.method === 'log.entryAdded' && m.params.level === 'error' && ['javascript', 'console'].includes(m.params.type)) runtimeErrors.push(m.params.text);
    if (!pending.has(m.id)) return;
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.type === 'error') reject(new Error(JSON.stringify(m))); else resolve(m.result);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
});
let context;
try {
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    await call('session.new', { capabilities: {} });
    await call('session.subscribe', { events: ['log.entryAdded'] });
    ({ context } = await call('browsingContext.create', { type: 'tab' }));
    const evaluate = async expression => {
        const r = await call('script.evaluate', { expression, target: { context }, awaitPromise: true });
        assert.notEqual(r.type, 'exception', JSON.stringify(r.exceptionDetails));
        return r.result.value;
    };
    const settle = () => evaluate('new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 250))');
    const click = async (selector, text) => {
        assert(await evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.includes(${JSON.stringify(text)}) && e.getClientRects().length); if (!el) return false; el.scrollIntoView({block:"nearest", inline:"nearest", behavior:"instant"}); el.click(); return true; })()`), `Missing ${selector}: ${text}`);
        await settle();
    };
    const checkLayout = async label => {
        const issues = JSON.parse(await evaluate(`JSON.stringify((() => {
            const issues = [];
            const main = document.querySelector('main');
            if (main.getBoundingClientRect().left > 50) issues.push('reserved sidebar');
            if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('document overflow');
            const tabs = document.querySelector('.hpssa-controller-tabs');
            if (tabs && tabs.getBoundingClientRect().height < 36) issues.push('controller tab strip collapsed');
            for (const e of document.querySelectorAll('.pf-v6-c-card, .pf-v6-c-description-list__group, .pf-v6-c-data-list__cell')) {
                if (e.getClientRects().length && e.scrollWidth > e.clientWidth + 2) issues.push(e.className + ' overflow');
            }
            for (const e of document.querySelectorAll('.pf-v6-c-modal-box, .hpssa-action-menu')) {
                if (!e.getClientRects().length) continue;
                const box = e.getBoundingClientRect();
                if (box.left < -1 || box.right > innerWidth + 1 || box.top < -1 || box.bottom > innerHeight + 1) issues.push(e.className + ' outside viewport');
            }
            const ids = [...document.querySelectorAll('[id]')].map(e => e.id).filter(Boolean);
            if (new Set(ids).size !== ids.length) issues.push('duplicate IDs: ' + ids.filter((id, i) => ids.indexOf(id) !== i).join(', '));
            return issues;
        })())`));
        if (issues.length) {
            const { data } = await call('browsingContext.captureScreenshot', { context });
            await fs.writeFile(path.join(outdir, 'failure.png'), Buffer.from(data, 'base64'));
            console.log('Failure screenshot:', path.join(outdir, 'failure.png'));
        }
        assert.deepEqual(issues, [], label);
        console.log('PASS', label);
    };
    const navigate = async query => {
        await call('browsingContext.navigate', { context, url: `http://127.0.0.1:${server.address().port}/${query}`, wait: 'complete' });
        await evaluate('document.fonts.ready.then(() => true)');
        await settle();
    };
    for (const width of [1440, 1024, 768, 390]) {
        await call('browsingContext.setViewport', { context, viewport: { width, height: 1000 }, devicePixelRatio: 1 });
        await navigate('');
        await checkLayout(`dashboard ${width}`);
        assert.equal(await evaluate('document.querySelectorAll(".hpssa-controller-card input").length'), 0, 'cards must not show selection checkboxes');
        assert(['absolute', 'fixed'].includes(await evaluate('getComputedStyle(document.querySelector("caption")).position')), 'caption utility loaded');
        await click('button.pf-v6-c-card__clickable-action', '');
        await checkLayout(`controller overview ${width}`);
        await click('.pf-v6-c-nav__link', 'P408i-p');
        for (const tab of ['Overview', 'Arrays & Logical Drives', 'Physical Drives', 'Enclosures', 'HBA Drives', 'Settings']) {
            await click('.pf-v6-c-tabs__link', tab);
            await checkLayout(`${tab} ${width}`);
            if (tab === 'Physical Drives') {
                assert.equal(await evaluate('getComputedStyle(document.querySelector("table tbody tr")).display'), width < 1024 ? 'grid' : 'table-row', 'responsive table styles');
                await click('button[aria-label^="Expand drive"]', '');
                assert(await evaluate('!!document.querySelector(".hpssa-pd-details")'), 'expanded drive details');
                await checkLayout(`drive details ${width}`);
                if (width === 390 || width === 1440) {
                    const { data } = await call('browsingContext.captureScreenshot', { context });
                    await fs.writeFile(path.join(outdir, `drives-${width}.png`), Buffer.from(data, 'base64'));
                }
                await click('.hpssa-row-actions button[aria-label="Actions"]', '');
                await checkLayout(`drive action menu ${width}`);
                assert(await evaluate('!document.querySelector(".hpssa-action-menu").closest(".hpssa-table-region")'), 'action menu portal');
                await click('.pf-v6-c-menu__item', 'Identify');
                await checkLayout(`drive form dialog ${width}`);
                await click('.pf-v6-c-modal-box button', 'Cancel');
            }
            if (tab === 'Settings') {
                await click('button', 'Edit');
                assert(await evaluate('!!document.querySelector("[role=dialog]")'), 'setting modal');
                await checkLayout(`setting dialog ${width}`);
                if (width === 390 || width === 1440) {
                    const { data } = await call('browsingContext.captureScreenshot', { context });
                    await fs.writeFile(path.join(outdir, `settings-${width}.png`), Buffer.from(data, 'base64'));
                }
                await click('button', 'Cancel');
            }
        }
        await click('button[aria-label="Actions"]', '');
        await checkLayout(`controller action menu ${width}`);
        await click('.pf-v6-c-menu__item', 'Show debug token');
        await checkLayout(`output dialog ${width}`);
        await click('.pf-v6-c-modal-box button', 'Close');
        await click('button[aria-label="Actions"]', '');
        await click('.pf-v6-c-menu__item', 'Set as boot controller');
        await checkLayout(`confirmation dialog ${width}`);
        await click('.pf-v6-c-modal-box button', 'Cancel');
        await click('.pf-v6-c-nav__link', 'Command log');
        await click('button', 'Clear');
        await checkLayout(`empty command log ${width}`);
        await click('button', 'Run command');
        await evaluate('(() => { const el = document.querySelector("input[placeholder]" ); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set; setter.call(el,"ctrl all show"); el.dispatchEvent(new Event("input",{bubbles:true})); })()');
        await settle();
        await click('.pf-v6-c-modal-box button', 'Run');
        await checkLayout(`command dialog ${width}`);
        await click('.pf-v6-c-modal-box button', 'Close');
        await checkLayout(`populated command log ${width}`);
        if (width === 1440 || width === 390) {
            await click('.pf-v6-c-nav__link', 'Dashboard');
            const { data } = await call('browsingContext.captureScreenshot', { context });
            const screenshot = path.join(outdir, `dashboard-${width}.png`);
            await fs.writeFile(screenshot, Buffer.from(data, 'base64'));
            console.log('Screenshot:', screenshot);
        }
    }
    for (const scenario of ['?empty', '?error']) {
        await navigate(scenario);
        await checkLayout(scenario);
    }
    await navigate('');
    await evaluate('document.documentElement.classList.add("pf-v6-theme-dark")');
    await checkLayout('dark dashboard');
    assert.deepEqual(runtimeErrors, [], 'browser runtime errors');
    console.log('Browser UI checks passed. Artifacts:', outdir);
} finally {
    if (context) await call('browsingContext.close', { context }).catch(() => {});
    await call('session.end').catch(() => {});
    ws.close();
    server.close();
}
