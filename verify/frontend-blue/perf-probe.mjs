// 临时性能探针：用 headless Edge + CDP 在真实鼠标移动事件流下测 canvas 悬停的帧间隔。
// 用法：node verify/.perf-probe.mjs
import { setTimeout as sleep } from 'node:timers/promises';

const CDP = 'http://127.0.0.1:9334';
const URL = 'http://127.0.0.1:8090/';

async function json(url, opts = {}) {
  const r = await fetch(url, opts);
  return r.json();
}

async function connect() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const t = await json(CDP + '/json/new?about:blank', { method: 'PUT' });
      if (t && t.webSocketDebuggerUrl) return t;
    } catch { /* retry */ }
    await sleep(250);
  }
  throw new Error('no cdp');
}

let nextId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expr) {
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails).slice(0, 300));
  return res.result.value;
}

const target = await connect();
ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
  }
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
await sleep(2500);

// 等待就绪
for (let i = 0; i < 40; i += 1) {
  const ready = await evaluate(`!!(document.querySelector('#fretboard') && document.querySelector('#status-badge.is-ok'))`);
  if (ready) break;
  await sleep(250);
}

const rect = await evaluate(`(function(){var r=document.querySelector('#fretboard').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
const cx = rect.x + rect.w * 0.5;
const cy = rect.y + rect.h * 0.5;

async function measure(label, css) {
  if (css) {
    await evaluate(`(function(){var s=document.getElementById('__perf');if(!s){s=document.createElement('style');s.id='__perf';document.head.appendChild(s);}s.textContent=${JSON.stringify(css)};return true;})()`);
  } else {
    await evaluate(`(function(){var s=document.getElementById('__perf');if(s)s.textContent='';return true;})()`);
  }
  await sleep(400);
  await evaluate(`(function(){
    window.__frames=[]; window.__sampling=true;
    function tick(t){ if(!window.__sampling) return; window.__frames.push(t); requestAnimationFrame(tick); }
    requestAnimationFrame(tick); return true;
  })()`);
  // 在指板上来回扫动鼠标，每 5ms 一个事件
  for (let i = 0; i < 160; i += 1) {
    const x = rect.x + 40 + ((i * 37) % (rect.w - 80));
    const y = cy + Math.sin(i / 9) * rect.h * 0.35;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
    await sleep(5);
  }
  const frames = await evaluate(`(function(){window.__sampling=false;return window.__frames.slice();})()`);
  const d = [];
  for (let i = 1; i < frames.length; i += 1) d.push(frames[i] - frames[i - 1]);
  d.sort((a, b) => a - b);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  const p95 = d[Math.floor(d.length * 0.95)] || 0;
  const janky = d.filter((v) => v > 32).length;
  console.log(`${label.padEnd(30)} frames=${String(d.length).padStart(3)} avg=${avg.toFixed(1)}ms p50=${(d[Math.floor(d.length / 2)] || 0).toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${d[d.length - 1].toFixed(1)}ms >32ms=${janky}`);
  return { avg, p95, janky };
}

console.log('canvas rect', JSON.stringify(rect));
const r1 = await measure('baseline (当前样式)');
const r2 = await measure('muse 去 multiply', '.muse-decor{mix-blend-mode:normal !important;}');
const r3 = await measure('去掉全部 backdrop-filter', '*{-webkit-backdrop-filter:none !important;backdrop-filter:none !important;}');
const r4 = await measure('两者都去', '.muse-decor{mix-blend-mode:normal !important;}*{-webkit-backdrop-filter:none !important;backdrop-filter:none !important;}');
const r5 = await measure('baseline 复测(回退样式)', '');
console.log(JSON.stringify({ baseline: r1, noMultiply: r2, noBlur: r3, noBoth: r4, baseline2: r5 }, null, 2));
await send('Browser.close').catch(() => {});
process.exit(0);
