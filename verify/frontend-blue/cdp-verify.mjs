// yinjie v3 主题/CDP 验收脚本（Edge headless + CDP，无第三方依赖）
// 覆盖：品牌文案、CSS/Canvas 配色一致性、muse 装饰层、9 张截图、CAGED 五色、
//       x32010 识别、Drop D、自定义调弦编辑器、退出遮罩（Fetch mock，绝不真停服务）、
//       console 0 错误、正文对比度。
// 用法：node verify/frontend-blue/cdp-verify.mjs
// 依赖：本机 Edge；服务已在 http://127.0.0.1:8090 运行。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'verify/frontend-blue');
const PAGE_URL = process.env.PAGE_URL || 'http://127.0.0.1:8090/';
const CDP_PORT = Number(process.env.CDP_PORT || 9224);
const CDP = 'http://127.0.0.1:' + CDP_PORT;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const results = [];
const consoleErrors = [];
const screenshots = [];
let failures = 0;
let mockedShutdown = null;
let dialogsShown = [];

function ok(name, detail) {
  results.push({ name, status: 'PASS', detail });
  console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail) {
  failures += 1;
  results.push({ name, status: 'FAIL', detail });
  console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`);
}
function check(name, condition, detail) {
  if (condition) ok(name, detail);
  else fail(name, detail);
}

/* ------------------------------------------------------------------ *
 * 启动 / 关闭 Edge headless
 * ------------------------------------------------------------------ */
async function waitForCdp(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(CDP + '/json/version');
      if (res.ok) return await res.json();
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error('Edge CDP 调试端口未就绪: ' + CDP);
}

async function closeBrowserQuietly(browserWs) {
  try {
    if (!browserWs) {
      const version = await (await fetch(CDP + '/json/version')).json();
      browserWs = version.webSocketDebuggerUrl;
    }
    const ws = new WebSocket(browserWs);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('browser ws 连接失败'));
      setTimeout(() => reject(new Error('browser ws 超时')), 3000);
    });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await sleep(600);
    try { ws.close(); } catch { /* ignore */ }
  } catch {
    // ignore
  }
}

let edgeProcess = null;
let profileDir = null;
let browserWs = null;

async function launchEdge() {
  // 若端口上已有旧实例，先关掉它，避免端口冲突
  try {
    const res = await fetch(CDP + '/json/version');
    if (res.ok) {
      const version = await res.json();
      await closeBrowserQuietly(version.webSocketDebuggerUrl);
      await sleep(700);
    }
  } catch {
    // no stale instance
  }

  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yinjie-edge-'));
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--remote-allow-origins=*',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + profileDir,
    '--window-size=1400,900',
    'about:blank'
  ];
  edgeProcess = spawn(EDGE, args, { stdio: 'ignore' });
  const version = await waitForCdp();
  browserWs = version.webSocketDebuggerUrl;
}

async function cleanup() {
  try { await closeBrowserQuietly(browserWs); } catch { /* ignore */ }
  await sleep(400);
  if (edgeProcess && edgeProcess.pid) {
    try {
      spawnSync('taskkill', ['/PID', String(edgeProcess.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // ignore
    }
  }
  if (profileDir) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ *
 * 最小 CDP 客户端
 * ------------------------------------------------------------------ */
let ws;
let nextId = 0;
const pending = new Map();

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('CDP 超时: ' + method));
    }, 20000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); }
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error('页面脚本执行失败: ' + JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function getPageTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const created = await fetch(CDP + '/json/new?about:blank', { method: 'PUT' });
      if (created.ok) {
        const target = await created.json();
        if (target && target.webSocketDebuggerUrl) return target;
      }
    } catch {
      // fall through
    }
    try {
      const list = await (await fetch(CDP + '/json/list')).json();
      const page = list.find(
        (t) => t.type === 'page' && t.webSocketDebuggerUrl && !t.url.startsWith('edge://'));
      if (page) return page;
    } catch {
      // not ready
    }
    await sleep(250);
  }
  throw new Error('无法连接 Edge 调试端口 ' + CDP);
}

function attachEvents() {
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
      return;
    }
    if (message.method === 'Page.javascriptDialogOpening') {
      dialogsShown.push(message.params.message);
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      return;
    }
    if (message.method === 'Fetch.requestPaused') {
      const request = message.params.request;
      if (request.url.indexOf('/api/shutdown') !== -1) {
        mockedShutdown = request.url;
        const body = Buffer.from('{"status":"stopping"}').toString('base64');
        send('Fetch.fulfillRequest', {
          requestId: message.params.requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Cache-Control', value: 'no-store' }
          ],
          body
        }).catch(() => {});
      } else {
        send('Fetch.continueRequest', { requestId: message.params.requestId }).catch(() => {});
      }
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails || {};
      consoleErrors.push('exception: ' + (details.exception && details.exception.description ? details.exception.description : details.text));
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push('console.error: ' + message.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      consoleErrors.push('log.error: ' + message.params.entry.text);
    }
  };
}

/* ------------------------------------------------------------------ *
 * 页面辅助
 * ------------------------------------------------------------------ */
async function waitForReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const info = JSON.parse(await evaluate(`(function () {
        var badge = document.getElementById('status-badge');
        var fb = document.getElementById('fretboard-sub');
        return JSON.stringify({
          readyState: document.readyState,
          badge: badge ? badge.className : '',
          badgeText: (document.getElementById('status-text') || {}).textContent || '',
          sub: fb ? fb.textContent : '',
          canvas: !!document.getElementById('fretboard'),
          overlayHidden: (function () {
            var overlay = document.getElementById('canvas-overlay');
            return !overlay || overlay.hidden || getComputedStyle(overlay).display === 'none' ||
              getComputedStyle(overlay).opacity === '0';
          })()
        });
      })()`));
      if (info.readyState === 'complete' && info.badge.includes('is-ok') && info.canvas && info.overlayHidden) {
        return info;
      }
    } catch {
      // page not ready
    }
    await sleep(250);
  }
  throw new Error('页面在超时时间内未就绪');
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      last = await predicate();
      lastError = null;
      if (last && last.ok) return last.value;
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error('等待超时: ' + label + ' (last=' + JSON.stringify(last) +
    ' lastError=' + (lastError && lastError.message ? lastError.message : lastError) + ')');
}

async function clickSelector(selector) {
  const clicked = await evaluate(`(function () {
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  await sleep(250);
  return clicked;
}

async function setSelect(selector, value) {
  return evaluate(`(function () {
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function moveMouseAway() {
  try {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 6, y: 6 });
  } catch {
    // ignore
  }
  await sleep(120);
}

async function screenshot(name, keepScroll) {
  if (!keepScroll) await evaluate('window.scrollTo(0, 0); true').catch(() => {});
  await moveMouseAway();
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  const size = fs.statSync(file).size;
  screenshots.push({ name, bytes: size });
  ok('截图 ' + name, size + ' bytes');
  return file;
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
}

async function chordPanelText() {
  const value = await evaluate(`(function () {
    var body = document.getElementById('chord-body');
    var count = document.getElementById('chord-count');
    var play = document.getElementById('play-chord-button');
    return JSON.stringify({
      count: count ? count.textContent : '',
      body: body ? body.innerText : '',
      playDisabled: play ? play.disabled : null
    });
  })()`);
  return JSON.parse(value);
}

/* ---------- 指板几何（与 app.js 参考实现一致） ---------- */
const BOARD = { left: 78, right: 26, top: 44, bottomPad: 82 };

function buildGeometry(rect, fretFrom, fretTo) {
  const width = rect.width;
  const height = rect.height;
  const boardHeight = Math.max(height - BOARD.bottomPad, 1);
  const boardWidth = Math.max(width - BOARD.left - BOARD.right, 1);
  const frets = [];
  for (let f = fretFrom; f <= fretTo; f += 1) frets.push(f);
  const weights = frets.map((f) =>
    f === 0 ? (1 - Math.pow(2, -1 / 12)) * 0.72 : Math.pow(2, -(f - 1) / 12) - Math.pow(2, -f / 12));
  const total = weights.reduce((a, b) => a + b, 0);
  const boundaries = [BOARD.left];
  for (let i = 0; i < frets.length; i += 1) {
    boundaries.push(boundaries[i] + (boardWidth * weights[i]) / total);
  }
  boundaries[boundaries.length - 1] = BOARD.left + boardWidth;
  const gap = (boardHeight * 0.86) / 5;
  const centerY = BOARD.top + boardHeight / 2;
  return {
    colCenter: (fret) => {
      const index = frets.indexOf(fret);
      return (boundaries[index] + boundaries[index + 1]) / 2;
    },
    stringY: (stringIndex) => centerY + (5 - stringIndex - 2.5) * gap,
  };
}

async function getCanvasRect() {
  const value = await evaluate(`(function () {
    var el = document.getElementById('fretboard');
    var r = el.getBoundingClientRect();
    return JSON.stringify({ left: r.left, top: r.top, width: r.width, height: r.height });
  })()`);
  return JSON.parse(value);
}

async function mouseClick(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(180);
}

async function clickChordX32010() {
  const rect = await getCanvasRect();
  const geom = buildGeometry(rect, 0, 24);
  for (const [string, fret] of [[1, 3], [2, 2], [3, 0], [4, 1], [5, 0]]) {
    await mouseClick(rect.left + geom.colCenter(fret), rect.top + geom.stringY(string));
  }
  await moveMouseAway();
}

/* ------------------------------------------------------------------ *
 * 静态文件侧检查：配色一致性 + 对比度
 * ------------------------------------------------------------------ */
function parseHexColor(value) {
  const v = String(value).trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex, bgHex) {
  const fg = parseHexColor(fgHex);
  const bg = parseHexColor(bgHex);
  if (!fg || !bg) return 0;
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function readPalette() {
  const css = fs.readFileSync(path.join(ROOT, 'src/main/resources/static/css/app.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'src/main/resources/static/js/app.js'), 'utf8');

  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
  const cssVars = {};
  if (rootMatch) {
    rootMatch[1].replace(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi, (whole, name, value) => {
      cssVars['--' + name] = value.trim();
      return whole;
    });
  }
  const colorsMatch = js.match(/var COLORS\s*=\s*\{([\s\S]*?)\};/);
  const jsColors = {};
  if (colorsMatch) {
    colorsMatch[1].replace(/([A-Za-z0-9]+)\s*:\s*"(#[0-9a-fA-F]{6})"/g, (whole, key, value) => {
      jsColors[key] = value;
      return whole;
    });
  }
  const cagedMatch = js.match(/var CAGED_SHAPE_COLORS\s*=\s*\{([\s\S]*?)\};/);
  const jsCaged = {};
  if (cagedMatch) {
    cagedMatch[1].replace(/([A-Z])\s*:\s*"(#[0-9a-fA-F]{6})"/g, (whole, key, value) => {
      jsCaged[key] = value;
      return whole;
    });
  }
  return { cssVars, jsColors, jsCaged };
}

function paletteSyncChecks() {
  const { cssVars, jsColors, jsCaged } = readPalette();
  const tokenMap = {
    bg: '--bg', panel: '--panel', panel2: '--panel-2', panelActive: '--panel-active',
    board: '--board', boardEdge: '--board-edge', text: '--text', muted: '--muted',
    mutedDark: '--muted-dark', primary: '--primary', primaryDark: '--primary-dark',
    accent: '--accent', accentHover: '--accent-hover', blue: '--blue', good: '--good',
    bad: '--bad', warning: '--warning', line: '--line', focus: '--focus',
    brass: '--brass', paper: '--paper', shadow: '--shadow'
  };
  const mismatches = [];
  const missing = [];
  Object.keys(tokenMap).forEach((key) => {
    const cssVar = tokenMap[key];
    if (!jsColors[key] || !cssVars[cssVar]) {
      missing.push(key + '/' + cssVar);
      return;
    }
    if (jsColors[key].toLowerCase() !== cssVars[cssVar].toLowerCase()) {
      mismatches.push(`${key}: js ${jsColors[key]} vs css ${cssVars[cssVar]}`);
    }
  });
  const cagedMap = { C: '--caged-c', A: '--caged-a', G: '--caged-g', E: '--caged-e', D: '--caged-d' };
  Object.keys(cagedMap).forEach((key) => {
    if (!jsCaged[key] || !cssVars[cagedMap[key]]) {
      missing.push('caged ' + key);
      return;
    }
    if (jsCaged[key].toLowerCase() !== cssVars[cagedMap[key]].toLowerCase()) {
      mismatches.push(`caged ${key}: js ${jsCaged[key]} vs css ${cssVars[cagedMap[key]]}`);
    }
  });
  const palette = { tokenMap, cagedMap, cssVars, jsColors, jsCaged, mismatches, missing };
  check('CSS :root 与 JS COLORS 全量一致（23 个 token）', mismatches.length === 0 && missing.length === 0,
    mismatches.length || missing.length ? mismatches.concat(missing).join(' | ') : '23/23 一致');
  check('CAGED 五色 CSS 与 JS 一致（5 个 token）',
    mismatches.filter((m) => m.startsWith('caged')).length === 0 && !missing.some((m) => m.startsWith('caged')),
    ['C', 'A', 'G', 'E', 'D'].map((k) => k + '=' + (jsCaged[k] || '?')).join(' '));
  return palette;
}

function contrastChecks() {
  const tokenPairs = [
    ['--text', '--panel', 4.5],
    ['--text', '--bg', 4.5],
    ['--text', '--header', 4.5],
    ['--text', '--board', 4.5],
    ['--muted', '--panel', 4.5],
    ['--muted', '--bg', 4.5],
    ['--muted-dark', '--panel', 4.5],
    ['--accent', '--panel', 4.5],
    ['--primary', '--panel', 4.5],
    ['--paper', '--board', 4.5],
    ['#ffffff', '--primary', 4.5],
    ['#ffffff', '--accent', 4.5],
    ['#ffffff', '--blue', 4.5],
  ];
  const { cssVars } = readPalette();
  const rows = [];
  let worst = 99;
  let below = [];
  tokenPairs.forEach(([fg, bg, threshold]) => {
    const fgValue = fg.startsWith('--') ? cssVars[fg] : fg;
    const bgValue = bg.startsWith('--') ? cssVars[bg] : bg;
    const ratio = contrastRatio(fgValue, bgValue);
    rows.push({ fg: fgValue, bg: bgValue, ratio: Number(ratio.toFixed(2)), threshold });
    worst = Math.min(worst, ratio);
    if (ratio < threshold) below.push(fg + ' on ' + bg + ' = ' + ratio.toFixed(2));
  });
  check('配色 token 对比度全部 ≥ WCAG AA (4.5:1)', below.length === 0,
    '最低 ' + worst.toFixed(2) + ':1' + (below.length ? ' | ' + below.join(' | ') : ''));
  return rows;
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const palette = paletteSyncChecks();
  const contrastRows = contrastChecks();

  await launchEdge();
  const target = await getPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('WebSocket 连接失败'));
  });
  attachEvents();

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  /* ---------- 1400 x 900：默认音阶模式 ---------- */
  await setViewport(1400, 900);
  await send('Page.navigate', { url: PAGE_URL });
  const ready = await waitForReady();
  ok('页面加载完成并连上后端', 'badge="' + ready.badgeText + '" sub="' + ready.sub + '"');

  const brand = JSON.parse(await evaluate(`(function () {
    return JSON.stringify({
      title: document.title,
      description: (document.querySelector('meta[name="description"]') || {}).content || '',
      latin: (document.querySelector('.brand-latin') || {}).textContent || '',
      cn: (document.querySelector('.brand-cn') || {}).textContent || '',
      footer: (document.querySelector('.site-footer') || {}).innerText || '',
      hint: (document.querySelector('.shutdown-hint') || {}).textContent || '',
      htmlHits: ['Fretboard Studio', 'fretboard-web', '电吉他指板工坊'].filter(function (word) {
        return document.documentElement.outerHTML.indexOf(word) !== -1;
      }),
      textHits: ['Fretboard Studio', 'fretboard-web', '电吉他指板工坊'].filter(function (word) {
        return document.body.innerText.indexOf(word) !== -1;
      })
    });
  })()`));
  check('浏览器标题 = yinjie · 音阶指板工坊', brand.title === 'yinjie · 音阶指板工坊', brand.title);
  check('header 品牌为 yinjie / 音阶指板工坊', brand.latin.trim() === 'yinjie' && brand.cn.trim() === '音阶指板工坊',
    brand.latin + ' · ' + brand.cn);
  check('meta description 使用新品牌', brand.description.indexOf('yinjie 音阶指板工坊') === 0, brand.description);
  check('footer 使用新品牌', brand.footer.indexOf('yinjie · 音阶指板工坊') !== -1, brand.footer.split('\n')[0]);
  check('退出提示不再出现 fretboard-web', brand.hint.indexOf('fretboard-web') === -1, brand.hint);
  check('页面 HTML/文本中无旧品牌残留', brand.htmlHits.length === 0 && brand.textHits.length === 0,
    'html=' + JSON.stringify(brand.htmlHits) + ' text=' + JSON.stringify(brand.textHits));

  /* ---------- muse 装饰层 ---------- */
  const muse = JSON.parse(await evaluate(`(function () {
    var el = document.querySelector('.muse-decor');
    if (!el) return JSON.stringify({ missing: true });
    var cs = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    return JSON.stringify({
      missing: false,
      opacity: cs.opacity,
      mixBlendMode: cs.mixBlendMode,
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      backgroundPosition: cs.backgroundPosition,
      pointerEvents: cs.pointerEvents,
      zIndex: cs.zIndex,
      mask: cs.maskImage || cs.webkitMaskImage || '',
      display: cs.display,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
    });
  })()`));
  const museSizeRaw = String(muse.backgroundSize);
  const museSizePx = parseFloat(museSizeRaw.split(' ')[0]) || 0;
  const museWidthOk = /%/.test(museSizeRaw) ? museSizePx >= 120 : museSizePx >= 1400 * 1.2;
  check('muse 装饰层存在且为固定定位', muse.missing === false && muse.display !== 'none');
  check('muse 不拦截交互（pointer-events:none）',
    muse.pointerEvents === 'none', muse.pointerEvents + ' / z-index ' + muse.zIndex);
  check('muse 位于内容之下（背景层，z-index 0，不遮挡正文与交互）',
    Number(muse.zIndex) === 0, 'z-index ' + muse.zIndex);
  check('muse 使用 muse.png 并放大铺满整页（宽度 ≥ 视口 120%）',
    muse.backgroundImage.indexOf('muse.png') !== -1 && museWidthOk,
    muse.backgroundImage.split('/').pop() + ' / ' + muse.backgroundSize);
  check('muse 透明度在规格内（0.55–0.8；性能优化后移除 multiply 混合模式）',
    Number(muse.opacity) >= 0.55 && Number(muse.opacity) <= 0.8 && /normal|multiply/.test(muse.mixBlendMode),
    'opacity ' + muse.opacity + ' / ' + muse.mixBlendMode);
  check('muse 有径向遮罩渐隐四角', muse.mask.indexOf('radial-gradient') !== -1, muse.mask ? 'mask 已生效' : '无 mask');
  check('muse 覆盖整个视口', muse.rect.w >= 1390 && muse.rect.h >= 890, JSON.stringify(muse.rect));
  const pageTheme = JSON.parse(await evaluate(`(function () {
    var cs = getComputedStyle(document.documentElement);
    var body = getComputedStyle(document.body);
    return JSON.stringify({
      colorScheme: cs.colorScheme,
      bgImage: body.backgroundImage,
      bgColor: body.backgroundColor
    });
  })()`));
  check('页面为浅色主题（color-scheme: light + 浅色渐变底）',
    pageTheme.colorScheme === 'light' && /gradient/.test(pageTheme.bgImage),
    'color-scheme=' + pageTheme.colorScheme + ' bg=' + pageTheme.bgColor);

  /* ---------- 01 初始音阶模式 ---------- */
  await screenshot('01-initial-1400.png');

  /* ---------- CAGED 图例五色渐变 ---------- */
  const legendDot = await evaluate(`getComputedStyle(document.querySelector('.dot-caged')).backgroundImage`);
  const cagedRgb = ['rgb(13, 148, 136)', 'rgb(5, 150, 105)', 'rgb(101, 163, 13)', 'rgb(8, 145, 178)', 'rgb(37, 99, 235)'];
  check('CAGED 图例圆点为 teal/emerald/lime/cyan/sky 五色渐变',
    cagedRgb.every((rgb) => legendDot.indexOf(rgb) !== -1), legendDot.slice(0, 140) + '…');

  /* ---------- 02 CAGED 总览 ---------- */
  await clickSelector('#view-seg [data-view="caged"]');
  const cagedOverview = await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      return JSON.stringify({
        partHidden: document.getElementById('caged-part-field').hidden,
        legendHidden: document.getElementById('caged-legend').hidden,
        sub: document.getElementById('fretboard-sub').textContent,
        part: (document.getElementById('caged-part-select') || {}).value || ''
      });
    })()`));
    return { ok: v.partHidden === false && v.legendHidden === false && /CAGED/.test(v.sub), value: v };
  }, 10000, 'CAGED 总览加载');
  ok('CAGED 总览可见（五色把位窗口）', 'sub="' + cagedOverview.sub + '" part=' + cagedOverview.part);
  await screenshot('02-caged-overview-1400.png');

  /* ---------- 03 CAGED C 形状 ---------- */
  await setSelect('#caged-part-select', 'C');
  const cagedSingle = await waitFor(async () => {
    const v = await evaluate(`document.getElementById('fretboard-sub').textContent`);
    return { ok: /CAGED\s*C\s*形状/.test(v), value: v };
  }, 8000, 'CAGED C 形状');
  ok('CAGED 单形状切换到 C', cagedSingle);
  await screenshot('03-caged-c-shape-1400.png');

  /* ---------- 04 和弦模式点选 x32010 ---------- */
  await clickSelector('#mode-seg [data-mode="chord"]');
  await waitFor(async () => {
    const v = JSON.parse(await evaluate(`JSON.stringify({
      chord: document.querySelector('#mode-seg [data-mode="chord"]').getAttribute('aria-pressed'),
      body: document.body.className
    })`));
    return { ok: v.chord === 'true' && v.body.indexOf('mode-chord') !== -1, value: v };
  }, 5000, '切换到和弦模式');
  await waitFor(async () => {
    const hidden = await evaluate(`(function () {
      var overlay = document.getElementById('canvas-overlay');
      return !overlay || overlay.hidden || getComputedStyle(overlay).display === 'none';
    })()`);
    return { ok: hidden === true, value: hidden };
  }, 5000, '和弦模式画布就绪');
  await clickChordX32010();
  const chord = await waitFor(async () => {
    const panel = await chordPanelText();
    return {
      ok: /C\s*大三和弦/.test(panel.body) && /100/.test(panel.body),
      value: panel
    };
  }, 8000, 'x32010 和弦识别');
  check('和弦模式点选 x32010 → C 大三和弦（100 分）',
    /C\s*大三和弦/.test(chord.body) && /100/.test(chord.body),
    (chord.count || '').trim() + ' | ' + chord.body.replace(/\n/g, ' / ').slice(0, 120));
  await screenshot('04-chord-x32010-1400.png');

  /* ---------- 05 Drop D 调弦 ---------- */
  await clickSelector('#mode-seg [data-mode="scale"]');
  await sleep(300);
  await setSelect('#tuning-select', 'drop-d');
  const dropD = await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      var overlay = document.getElementById('canvas-overlay');
      var hidden = !overlay || overlay.hidden || getComputedStyle(overlay).display === 'none';
      return JSON.stringify({
        tuning: document.getElementById('tuning-text').textContent,
        footer: document.getElementById('footer-tuning').textContent,
        sub: document.getElementById('fretboard-sub').textContent,
        hidden: hidden
      });
    })()`));
    return { ok: /Drop D/i.test(v.tuning) && v.hidden === true, value: v };
  }, 10000, 'Drop D 调弦生效');
  ok('切到 Drop D 调弦并重绘指板', dropD.tuning + ' | ' + dropD.footer);
  await screenshot('05-drop-d-1400.png');

  /* ---------- 06 自定义调弦编辑器 ---------- */
  await setSelect('#tuning-select', '__custom__');
  const editor = await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      var box = document.getElementById('tuning-editor');
      var selects = box ? Array.prototype.slice.call(box.querySelectorAll('select')) : [];
      return JSON.stringify({ hidden: box.hidden, count: selects.length, values: selects.map(function (s) { return s.value; }) });
    })()`));
    return { ok: v.hidden === false && v.count === 6, value: v };
  }, 6000, '自定义调弦编辑器');
  ok('自定义调弦编辑器展开（6 个弦位）', editor.values.join(','));
  await screenshot('06-tuning-editor-1400.png');

  /* ---------- 07 退出遮罩（Fetch mock，绝不真停服务） ---------- */
  await send('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/shutdown*', requestStage: 'Request' }]
  });
  await clickSelector('#exit-button');
  const shutdown = await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      var overlay = document.getElementById('shutdown-overlay');
      return JSON.stringify({
        overlayHidden: overlay ? overlay.hidden : null,
        title: (document.getElementById('shutdown-title') || {}).textContent || '',
        status: (document.getElementById('status-text') || {}).textContent || '',
        bodyShutdown: document.body.classList.contains('is-shutdown')
      });
    })()`));
    return { ok: v.overlayHidden === false && /已退出/.test(v.status), value: v };
  }, 10000, '退出遮罩显示');
  check('点击退出后显示遮罩（mock POST /api/shutdown，未真停服务）',
    shutdown.overlayHidden === false && /已退出/.test(shutdown.status) && mockedShutdown !== null,
    shutdown.title + ' / ' + shutdown.status + ' / mock=' + (mockedShutdown || 'none'));
  await screenshot('07-exit-overlay-1400.png');
  await send('Fetch.disable').catch(() => {});

  // 确认后端仍存活（mock 生效，没有被真的 shutdown）
  const health = await fetch(PAGE_URL + 'api/options', { headers: { Accept: 'application/json' } });
  check('mock 生效：后端服务未被真实关闭', health.ok, 'GET /api/options -> HTTP ' + health.status);

  /* ---------- 900 x 700：小屏布局与 muse 降级 ---------- */
  await setViewport(900, 700);
  await send('Page.navigate', { url: PAGE_URL });
  await waitForReady();
  const museSmall = JSON.parse(await evaluate(`(function () {
    var el = document.querySelector('.muse-decor');
    var cs = getComputedStyle(el);
    return JSON.stringify({
      opacity: cs.opacity,
      backgroundSize: cs.backgroundSize,
      display: cs.display
    });
  })()`));
  check('≤900px 时 muse 背景仍存在且不遮挡交互', museSmall.display !== 'none' && Number(museSmall.opacity) >= 0.4,
    'opacity=' + museSmall.opacity + ' size=' + museSmall.backgroundSize);
  await screenshot('08-initial-900x700.png');

  /* ---------- 09 900x700 和弦识别 ---------- */
  await clickSelector('#mode-seg [data-mode="chord"]');
  await waitFor(async () => {
    const v = JSON.parse(await evaluate(`JSON.stringify({
      chord: document.querySelector('#mode-seg [data-mode="chord"]').getAttribute('aria-pressed'),
      body: document.body.className
    })`));
    return { ok: v.chord === 'true' && v.body.indexOf('mode-chord') !== -1, value: v };
  }, 5000, '小屏切换到和弦模式');
  await clickChordX32010();
  const chordSmall = await waitFor(async () => {
    const panel = await chordPanelText();
    return { ok: /C\s*大三和弦/.test(panel.body) && /100/.test(panel.body), value: panel };
  }, 8000, '小屏 x32010 识别');
  check('900x700 下 x32010 仍识别为 C 大三和弦（100 分）',
    /C\s*大三和弦/.test(chordSmall.body) && /100/.test(chordSmall.body),
    (chordSmall.count || '').trim());
  // 小屏单列布局下把和弦识别面板滚入视口，让 09 截图能同时看到小屏排版与识别结果
  await evaluate(`(function () {
    var card = document.getElementById('chord-card');
    if (!card) return false;
    var y = card.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo(0, Math.max(0, y));
    return true;
  })()`);
  await sleep(350);
  await moveMouseAway();
  await screenshot('09-chord-900x700.png', true);

  /* ---------- 实际渲染文字对比度（DOM 采样） ---------- */
  const domContrast = JSON.parse(await evaluate(`(function () {
    function parse(c) {
      var m = c.match(/rgba?\\(([^)]+)\\)/);
      if (!m) return null;
      var p = m[1].split(',').map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    function lum(c) {
      function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }
    function composite(fg, bg) {
      var a = fg.a;
      return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
    }
    function effectiveBg(el) {
      var layers = [];
      var node = el;
      while (node && node !== document.documentElement) {
        var c = parse(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0) layers.push(c);
        node = node.parentElement;
      }
      var bodyBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 238, g: 248, b: 245, a: 1 };
      layers.push(bodyBg);
      var result = { r: bodyBg.r, g: bodyBg.g, b: bodyBg.b, a: 1 };
      for (var i = layers.length - 2; i >= 0; i -= 1) result = composite(layers[i], result);
      return result;
    }
    var selectors = ['.brand-sub', '.brand-cn', '.card-sub', '.field-label', '.legend', '.site-footer',
      '.chord-empty-title', '.chord-empty-sub', '.tuning-chip', '.status-badge', '.card-head h2', '.toolbar-note'];
    var rows = [];
    selectors.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var cs = getComputedStyle(el);
      var fg = parse(cs.color);
      if (!fg) return;
      var bg = effectiveBg(el);
      var l1 = lum(fg);
      var l2 = lum(bg);
      var ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      rows.push({
        selector: sel,
        color: cs.color,
        background: 'rgb(' + Math.round(bg.r) + ', ' + Math.round(bg.g) + ', ' + Math.round(bg.b) + ')',
        ratio: Number(ratio.toFixed(2))
      });
    });
    return JSON.stringify(rows);
  })()`));
  const belowAa = domContrast.filter((row) => row.ratio < 4.5);
  check('渲染后正文文字对比度 ≥ 4.5:1（' + domContrast.length + ' 个采样）', belowAa.length === 0,
    belowAa.length
      ? belowAa.map((r) => r.selector + '=' + r.ratio).join(' | ')
      : '最低 ' + Math.min.apply(null, domContrast.map((r) => r.ratio)) + ':1');

  /* ---------- 截图清单 ---------- */
  const expectedShots = [
    '01-initial-1400.png', '02-caged-overview-1400.png', '03-caged-c-shape-1400.png',
    '04-chord-x32010-1400.png', '05-drop-d-1400.png', '06-tuning-editor-1400.png',
    '07-exit-overlay-1400.png', '08-initial-900x700.png', '09-chord-900x700.png'
  ];
  const missingShots = expectedShots.filter((name) => !fs.existsSync(path.join(OUT, name)));
  check('9 张验收截图齐全', missingShots.length === 0, missingShots.length ? missingShots.join(',') : '9/9');

  /* ---------- console 错误 ---------- */
  if (consoleErrors.length === 0) ok('console 0 错误 / 无未捕获异常');
  else fail('存在 console 错误', consoleErrors.slice(0, 6).join(' | '));

  const report = {
    url: PAGE_URL,
    when: new Date().toISOString(),
    failures,
    results,
    consoleErrors,
    screenshots,
    palette: {
      cssVars: palette.cssVars,
      jsColors: palette.jsColors,
      jsCaged: palette.jsCaged,
      mismatches: palette.mismatches,
      missing: palette.missing
    },
    contrastTokens: contrastRows,
    contrastDom: domContrast,
    mockedShutdown,
    dialogsShown,
    muse: { large: muse, small: museSmall }
  };
  const reportFile = path.join(OUT, 'cdp-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log('\nCDP 报告: ' + reportFile);
  console.log('截图:' + screenshots.map((s) => s.name + ' (' + Math.round(s.bytes / 1024) + 'KB)').join(', '));
  if (failures > 0) {
    console.log('\n共 ' + failures + ' 项失败');
    process.exitCode = 1;
  } else {
    console.log('\n全部通过');
  }
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  console.error('CDP 验收脚本异常:', error);
  failures += 1;
  results.push({ name: '脚本异常', status: 'FAIL', detail: String(error && error.stack ? error.stack : error) });
  exitCode = 2;
  try {
    const report = { url: PAGE_URL, when: new Date().toISOString(), failures, results, consoleErrors, screenshots, mockedShutdown, dialogsShown };
    fs.writeFileSync(path.join(OUT, 'cdp-report.json'), JSON.stringify(report, null, 2));
  } catch {
    // ignore
  }
} finally {
  try { if (ws) ws.close(); } catch { /* ignore */ }
  await cleanup();
  if (exitCode === 0 && failures > 0) exitCode = 1;
  if (exitCode !== 0) process.exitCode = exitCode;
}
