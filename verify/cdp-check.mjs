// yinjie 浏览器端交互自检（Edge headless + CDP，无第三方依赖）
// 用法：先启动 Edge：
//   msedge --headless=new --remote-debugging-port=9223 --user-data-dir=<dir> --window-size=1600,1100 about:blank
// 然后：node cdp-check.mjs [http://127.0.0.1:8090/]
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9223';
const PAGE_URL = process.argv[2] || 'http://127.0.0.1:8090/';
const OUT_DIR = process.env.OUT_DIR || path.dirname(fileURLToPath(import.meta.url));

const results = [];
const consoleErrors = [];
let failures = 0;

function ok(name, detail) {
  results.push({ name, status: 'PASS', detail });
  console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail) {
  failures += 1;
  results.push({ name, status: 'FAIL', detail });
  console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`);
}

async function getPageTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      // 优先新建一个干净的标签页，避开 Edge 首次运行对话框
      const created = await fetch(CDP + '/json/new?about:blank', { method: 'PUT' });
      if (created.ok) {
        const target = await created.json();
        if (target && target.webSocketDebuggerUrl) return target;
      }
    } catch {
      // ignore and fall back
    }
    try {
      const list = await (await fetch(CDP + '/json/list')).json();
      const page = list.find(
        (t) => t.type === 'page' && t.webSocketDebuggerUrl && !t.url.startsWith('edge://'));
      if (page) return page;
    } catch {
      // browser not ready yet
    }
    await sleep(250);
  }
  throw new Error('无法连接 Edge 调试端口 ' + CDP);
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

async function waitForReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(`(function () {
        var badge = document.getElementById('status-badge');
        var fb = document.getElementById('fretboard-sub');
        return JSON.stringify({
          readyState: document.readyState,
          badge: badge ? badge.className : '',
          badgeText: (document.getElementById('status-text') || {}).textContent || '',
          sub: fb ? fb.textContent : '',
          canvas: !!document.getElementById('fretboard'),
        });
      })()`);
      const info = JSON.parse(value);
      if (info.readyState === 'complete' && info.badge.includes('is-ok') && info.canvas) {
        return info;
      }
    } catch {
      // page not ready
    }
    await sleep(300);
  }
  throw new Error('页面在超时时间内未就绪');
}

/* ---------- 指板几何（与 FretboardCanvas 参考实现一致） ---------- */
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

async function keyPress(key, code, windowsVirtualKeyCode) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
  await sleep(180);
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  return file;
}

async function chordPanelText() {
  return evaluate(`(function () {
    var body = document.getElementById('chord-body');
    var count = document.getElementById('chord-count');
    return JSON.stringify({ count: count ? count.textContent : '', body: body ? body.innerText : '' });
  })()`);
}

async function main() {
  const target = await getPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('WebSocket 连接失败'));
  });
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
    if (message.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('exception: ' + JSON.stringify(message.params.exceptionDetails?.text || message.params));
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push('console.error: ' + message.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      consoleErrors.push('log.error: ' + message.params.entry.text);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false,
  });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1200);
  const ready = await waitForReady();
  ok('页面加载完成并连上后端', `sub="${ready.sub}" badge="${ready.badgeText}"`);

  // ---- 音阶构成面板 ----
  const scaleInfo = JSON.parse(await evaluate(`(function () {
    return JSON.stringify({
      name: (document.getElementById('scale-name') || {}).textContent || '',
      english: (document.getElementById('scale-english') || {}).textContent || '',
      chips: Array.from(document.querySelectorAll('#note-chips > *')).map(function (el) { return el.textContent.trim(); }),
      formula: Array.from(document.querySelectorAll('#formula-chips > *')).map(function (el) { return el.textContent.trim(); }),
      strings: Array.from(document.querySelectorAll('#canvas-wrap canvas')).length,
      fretSub: (document.getElementById('fretboard-sub') || {}).textContent || '',
    });
  })()`));
  if (scaleInfo.name.includes('自然大调')) ok('音阶面板显示 C 自然大调', scaleInfo.name);
  else fail('音阶面板显示自然大调', JSON.stringify(scaleInfo));
  if (scaleInfo.chips.length >= 7) ok('音阶音名 chips 渲染', scaleInfo.chips.join(','));
  else fail('音阶音名 chips 数量不足', JSON.stringify(scaleInfo.chips));
  if (scaleInfo.formula.length >= 7) ok('级数公式 chips 渲染', scaleInfo.formula.join(' '));
  else fail('级数公式 chips 数量不足', JSON.stringify(scaleInfo.formula));

  // ---- 切换音阶与根音（下拉 + change 事件） ----
  await evaluate(`(function () {
    var sel = document.getElementById('scale-select');
    sel.value = 'dorian';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(700);
  const dorianSub = await evaluate(`document.getElementById('fretboard-sub').textContent`);
  const dorianName = await evaluate(`document.getElementById('scale-name').textContent`);
  if (dorianName.includes('多利亚') || dorianSub.includes('多利亚')) {
    ok('切换到 Dorian 调式后重新加载', `${dorianName} / ${dorianSub}`);
  } else {
    fail('切换到 Dorian 调式', `${dorianName} / ${dorianSub}`);
  }

  await evaluate(`(function () {
    var root = document.getElementById('root-select');
    root.value = 'Eb';
    root.dispatchEvent(new Event('change', { bubbles: true }));
    var scale = document.getElementById('scale-select');
    scale.value = 'major';
    scale.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(900);
  const ebSub = await evaluate(`document.getElementById('fretboard-sub').textContent`);
  if (ebSub.includes('Eb')) ok('根音切换为 Eb 后指板重绘', ebSub);
  else fail('根音切换为 Eb', ebSub);

  // 复原 C 自然大调，并等待指板重载完成（覆盖层隐藏 + 副标题更新），避免在异步重绘中途点击
  await evaluate(`(function () {
    var root = document.getElementById('root-select');
    root.value = 'C';
    root.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  for (let i = 0; i < 40; i += 1) {
    const state = JSON.parse(await evaluate(`(function () {
      var overlay = document.getElementById('canvas-overlay');
      var sub = document.getElementById('fretboard-sub');
      var hidden = !overlay || overlay.hidden || getComputedStyle(overlay).display === 'none' ||
        getComputedStyle(overlay).opacity === '0' || overlay.classList.contains('is-hidden');
      return JSON.stringify({ hidden: hidden, sub: sub ? sub.textContent : '' });
    })()`));
    if (state.hidden && state.sub.includes('根音 C') && state.sub.includes('0–24')) break;
    await sleep(150);
  }
  await sleep(300);

  // ---- 切到和弦模式 ----
  // v2 起默认是「音阶模式」，点击品格只试听、不加入和弦选择；本脚本后面的
  // 点选识别 / 原位信息 / 键盘空格选择都必须在「和弦模式」下进行。
  await evaluate(`(function () {
    var btn = document.querySelector('.seg-btn[data-mode="chord"]');
    if (btn) btn.click();
    return true;
  })()`);
  for (let i = 0; i < 40; i += 1) {
    const sub = String(await evaluate(
      `(document.getElementById('fretboard-sub') || {}).textContent || ''`));
    if (sub.includes('和弦模式')) break;
    await sleep(150);
  }
  await sleep(300);

  // ---- 鼠标点选 C 大三和弦 x32010 ----
  const rect = await getCanvasRect();
  const geom = buildGeometry(rect, 0, 24);
  const positions = [
    [1, 3], [2, 2], [3, 0], [4, 1], [5, 0],
  ];
  for (const [string, fret] of positions) {
    const x = rect.left + geom.colCenter(fret);
    const y = rect.top + geom.stringY(string);
    await mouseClick(x, y);
  }
  await sleep(900);
  let panel = JSON.parse(await chordPanelText());
  const text = panel.body;
  if (/C\s*大三和弦/.test(text) && /x32010/.test(text)) {
    ok('鼠标点选 x32010 识别为 C 大三和弦（含指型提示）', panel.count);
  } else {
    fail('鼠标点选 x32010 和弦识别', text.slice(0, 300));
  }
  if (text.includes('原位')) ok('展示原位/转位信息');
  else fail('缺少原位/转位信息', text.slice(0, 200));
  const chordShot = await screenshot('ui-c-major-chord.png');
  ok('和弦面板截图已保存', chordShot);

  // ---- Esc 清空 ----
  await evaluate(`document.getElementById('fretboard').focus(); true`);
  await keyPress('Escape', 'Escape', 27);
  await sleep(600);
  panel = JSON.parse(await chordPanelText());
  if (panel.body.includes('尚未') || panel.body.includes('点选') || panel.body.trim() === '') {
    ok('Esc 清空选择', panel.count);
  } else {
    fail('Esc 清空选择', panel.body.slice(0, 200));
  }

  // ---- 键盘：方向键移动 + 空格选择 ----
  await evaluate(`document.getElementById('fretboard').focus(); true`);
  await keyPress('ArrowRight', 'ArrowRight', 39);
  await keyPress('ArrowRight', 'ArrowRight', 39);
  await keyPress(' ', 'Space', 32);
  await sleep(700);
  panel = JSON.parse(await chordPanelText());
  if (panel.count && /[1-9]/.test(panel.count)) {
    ok('键盘空格选择品格', panel.count);
  } else {
    fail('键盘空格选择品格', panel.count);
  }

  // ---- 清空后悬停提示 ----
  await evaluate(`document.getElementById('fretboard').focus(); true`);
  await keyPress('Escape', 'Escape', 27);
  await sleep(400);

  // ---- 音阶外音开关 & 等宽间距 ----
  await evaluate(`(function () {
    var toggle = document.getElementById('nonscale-toggle');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    var equal = document.querySelector('[data-spacing="equal"]');
    if (equal) equal.click();
    return true;
  })()`);
  await sleep(700);
  const layoutShot = await screenshot('ui-nonscale-equal.png');
  ok('音阶外音 / 等宽模式切换截图已保存', layoutShot);

  // ---- 控制台错误汇总 ----
  if (consoleErrors.length === 0) {
    ok('无 console 错误 / 未捕获异常');
  } else {
    fail('存在 console 错误', consoleErrors.join(' | '));
  }

  // ---- 输出报告 ----
  const report = { url: PAGE_URL, when: new Date().toISOString(), failures, results, consoleErrors };
  const reportFile = path.join(OUT_DIR, 'cdp-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log('\n报告: ' + reportFile);
  if (failures > 0) {
    console.log(`\n共 ${failures} 项失败`);
    process.exitCode = 1;
  } else {
    console.log('\n全部通过');
  }
  ws.close();
}

main().catch((error) => {
  console.error('自检脚本异常: ', error);
  process.exitCode = 2;
  try { if (ws) ws.close(); } catch { /* ignore */ }
});
