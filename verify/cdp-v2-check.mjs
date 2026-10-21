// yinjie v2 浏览器端交互自检（Edge headless + CDP，无第三方依赖）
// 覆盖：音阶/和弦模式门控、点选识别、播放和弦、CAGED 总览与单形状、Drop D 调弦、
//       自定义调弦编辑器、真实「退出」停机流程。
// 用法：先启动 Edge：
//   msedge --headless=new --remote-debugging-port=9223 --user-data-dir=<dir> --window-size=1600,1100 about:blank
// 然后：node cdp-v2-check.mjs [http://127.0.0.1:8090/]
// 注意：最后一步会真的调用 POST /api/shutdown（不带 mock），会停掉被测服务；用完请自行重启。
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9223';
const PAGE_URL = process.argv[2] || 'http://127.0.0.1:8090/';
const BASE_URL = new URL(PAGE_URL).origin;
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
function check(name, condition, detail) {
  if (condition) ok(name, detail);
  else fail(name, detail);
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

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await predicate();
    if (last && last.ok) return last.value;
    await sleep(150);
  }
  throw new Error('等待超时: ' + label + ' (last=' + JSON.stringify(last) + ')');
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
  await sleep(220);
}

async function mouseMove(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(260);
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  return file;
}

async function clickSelector(selector) {
  await evaluate(`(function () {
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('missing ' + ${JSON.stringify(selector)});
    el.click();
    return true;
  })()`);
  await sleep(350);
}

async function setSelect(selector, value) {
  await evaluate(`(function () {
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) throw new Error('missing ' + ${JSON.stringify(selector)});
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(350);
}

async function chordPanelText() {
  return JSON.parse(await evaluate(`(function () {
    var body = document.getElementById('chord-body');
    var count = document.getElementById('chord-count');
    var play = document.getElementById('play-chord-button');
    return JSON.stringify({
      count: count ? count.textContent : '',
      body: body ? body.innerText : '',
      playDisabled: play ? play.disabled : null,
    });
  })()`));
}

async function toastText() {
  return evaluate(`(function () {
    var t = document.getElementById('toast');
    return t && !t.hidden ? t.textContent : '';
  })()`);
}

function base64Json(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
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
    if (message.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      return;
    }
    if (message.method === 'Fetch.requestPaused') {
      send('Fetch.continueRequest', { requestId: message.params.requestId }).catch(() => {});
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
  ok('页面加载完成并连上后端', `badge="${ready.badgeText}"`);

  // ---- 1. 默认音阶模式 ----
  let modeInfo = JSON.parse(await evaluate(`(function () {
    return JSON.stringify({
      scale: document.querySelector('#mode-seg [data-mode="scale"]').getAttribute('aria-pressed'),
      chord: document.querySelector('#mode-seg [data-mode="chord"]').getAttribute('aria-pressed'),
      body: document.body.className,
      cagedViewHidden: document.getElementById('caged-view-field').hidden,
      legendSelectedHidden: document.getElementById('legend-selected').hidden,
    });
  })()`));
  check('默认处于音阶模式', modeInfo.scale === 'true' && modeInfo.chord === 'false' && modeInfo.body.includes('mode-scale'), JSON.stringify(modeInfo));
  check('音阶模式显示音阶视图控件、隐藏选中图例', modeInfo.cagedViewHidden === false && modeInfo.legendSelectedHidden === true);

  // ---- 2. 音阶模式点击只试听、不加入和弦识别 ----
  let rect = await getCanvasRect();
  let geom = buildGeometry(rect, 0, 24);
  await mouseClick(rect.left + geom.colCenter(3), rect.top + geom.stringY(2));
  await sleep(500);
  let panel = await chordPanelText();
  check('音阶模式点击品格不加入和弦选择', /音阶模式/.test(panel.body) || /试听/.test(panel.count), panel.count);
  check('音阶模式播放和弦按钮禁用', panel.playDisabled === true);

  // ---- 3. 切换到和弦模式 ----
  await clickSelector('#mode-seg [data-mode="chord"]');
  await sleep(500);
  modeInfo = JSON.parse(await evaluate(`(function () {
    return JSON.stringify({
      chord: document.querySelector('#mode-seg [data-mode="chord"]').getAttribute('aria-pressed'),
      body: document.body.className,
      cagedViewHidden: document.getElementById('caged-view-field').hidden,
    });
  })()`));
  check('切换到和弦模式', modeInfo.chord === 'true' && modeInfo.body.includes('mode-chord'), JSON.stringify(modeInfo));
  check('和弦模式隐藏音阶视图控件（CAGED 仅音阶模式可用）', modeInfo.cagedViewHidden === true);

  // ---- 4. 点选 x32010 识别 C 大三和弦 + 播放 ----
  rect = await getCanvasRect();
  geom = buildGeometry(rect, 0, 24);
  for (const [string, fret] of [[1, 3], [2, 2], [3, 0], [4, 1], [5, 0]]) {
    await mouseClick(rect.left + geom.colCenter(fret), rect.top + geom.stringY(string));
  }
  await sleep(900);
  panel = await chordPanelText();
  check('和弦模式点选 x32010 识别为 C 大三和弦', /C\s*大三和弦/.test(panel.body) && /\bC\b/.test(panel.body), panel.count);
  check('展示原位与 100 分匹配度', panel.body.includes('原位') && panel.body.includes('100'), panel.body.slice(0, 120));
  check('播放和弦按钮可用', panel.playDisabled === false);
  const beforePlay = await toastText();
  await clickSelector('#play-chord-button');
  await sleep(700);
  const afterPlay = await toastText();
  panel = await chordPanelText();
  const playToastOk = /播放/.test(afterPlay) && !/失败|错误/.test(afterPlay);
  check('点击播放和弦有反馈且不报错、结果保持',
    playToastOk && panel.playDisabled === false && /C\s*大三和弦/.test(panel.body),
    `${beforePlay ? beforePlay + ' -> ' : ''}${afterPlay}`);
  ok('和弦模式截图已保存', await screenshot('v2-chord-c-major.png'));

  // ---- 5. CAGED 总览 / 单形状（音阶模式） ----
  await clickSelector('#mode-seg [data-mode="scale"]');
  await sleep(400);
  await clickSelector('#view-seg [data-view="caged"]');
  await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      return JSON.stringify({
        partHidden: document.getElementById('caged-part-field').hidden,
        legendHidden: document.getElementById('caged-legend').hidden,
        sub: document.getElementById('fretboard-sub').textContent,
      });
    })()`));
    return { ok: v.partHidden === false && v.legendHidden === false && /CAGED/.test(v.sub), value: v };
  }, 8000, 'CAGED 总览加载');
  const cagedAll = JSON.parse(await evaluate(`(function () {
    return JSON.stringify({
      sub: document.getElementById('fretboard-sub').textContent,
      legend: document.getElementById('caged-legend').textContent.trim(),
    });
  })()`));
  ok('CAGED 总览：部分选择器与图例可见', `sub="${cagedAll.sub}" legend="${cagedAll.legend}"`);
  ok('CAGED 总览截图已保存', await screenshot('v2-caged-overview.png'));

  await setSelect('#caged-part-select', 'C');
  const cagedSingle = await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      return JSON.stringify({ sub: document.getElementById('fretboard-sub').textContent });
    })()`));
    return { ok: /CAGED\s*C\s*形状/.test(v.sub), value: v };
  }, 6000, 'CAGED C 形状');
  ok('CAGED 单形状：切到 C 形状', cagedSingle.sub);
  ok('CAGED C 形状截图已保存', await screenshot('v2-caged-c-shape.png'));

  // ---- 6. Drop D 调弦 ----
  await setSelect('#tuning-select', 'drop-d');
  const dropD = await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      var overlay = document.getElementById('canvas-overlay');
      var hidden = !overlay || overlay.hidden || getComputedStyle(overlay).display === 'none' ||
        getComputedStyle(overlay).opacity === '0';
      return JSON.stringify({
        tuning: document.getElementById('tuning-text').textContent,
        footer: document.getElementById('footer-tuning').textContent,
        sub: document.getElementById('fretboard-sub').textContent,
        hidden: hidden,
      });
    })()`));
    return { ok: /Drop D/i.test(v.tuning) && v.hidden === true, value: v };
  }, 9000, 'Drop D 调弦生效');
  ok('调弦切换为 Drop D', `${dropD.tuning} / ${dropD.footer}`);

  rect = await getCanvasRect();
  geom = buildGeometry(rect, 0, 24);
  await mouseMove(rect.left + geom.colCenter(0), rect.top + geom.stringY(0));
  const tooltip = JSON.parse(await evaluate(`(function () {
    var t = document.getElementById('canvas-tooltip');
    return JSON.stringify({ hidden: t.hidden, text: t.innerText });
  })()`));
  check('Drop D 下 6 弦空弦显示 D', tooltip.hidden === false && /第 6 弦/.test(tooltip.text) && /D/.test(tooltip.text), tooltip.text.replace(/\n/g, ' | '));
  ok('Drop D 截图已保存', await screenshot('v2-drop-d.png'));

  // ---- 7. 自定义调弦编辑器 ----
  await setSelect('#tuning-select', '__custom__');
  const editor = JSON.parse(await evaluate(`(function () {
    var box = document.getElementById('tuning-editor');
    var selects = box ? Array.prototype.slice.call(box.querySelectorAll('select')) : [];
    return JSON.stringify({ hidden: box.hidden, count: selects.length, values: selects.map(function (s) { return s.value; }) });
  })()`));
  check('自定义调弦编辑器展开且有 6 个弦位', editor.hidden === false && editor.count === 6, editor.values.join(','));
  ok('自定义调弦编辑器截图已保存', await screenshot('v2-tuning-editor.png'));

  await clickSelector('#custom-tuning-reset');
  const reset = await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      return JSON.stringify({ tuning: document.getElementById('tuning-text').textContent });
    })()`));
    return { ok: /标准调弦/.test(v.tuning), value: v };
  }, 8000, '恢复标准调弦');
  ok('恢复标准调弦', reset.tuning);

  // ---- 8. 真实退出（POST /api/shutdown，会停掉被测服务） ----
  await clickSelector('#exit-button');
  const shutdown = await waitFor(async () => {
    const v = JSON.parse(await evaluate(`(function () {
      var overlay = document.getElementById('shutdown-overlay');
      return JSON.stringify({
        overlayHidden: overlay ? overlay.hidden : null,
        title: (document.getElementById('shutdown-title') || {}).textContent || '',
        status: (document.getElementById('status-text') || {}).textContent || '',
        bodyShutdown: document.body.classList.contains('is-shutdown'),
      });
    })()`));
    return { ok: v.overlayHidden === false && /已退出/.test(v.status), value: v };
  }, 10000, '退出遮罩显示');
  ok('点击退出后显示「服务已停止」遮罩', `${shutdown.title} / ${shutdown.status}`);
  ok('退出遮罩截图已保存', await screenshot('v2-shutdown.png'));

  let stopped = false;
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(BASE_URL + '/api/health');
      if (!res.ok) stopped = true;
      await sleep(300);
    } catch {
      stopped = true;
      break;
    }
    if (stopped) break;
  }
  check('后端进程在退出后停止（/api/health 不可达）', stopped);

  // ---- 控制台错误汇总 ----
  if (consoleErrors.length === 0) ok('无 console 错误 / 未捕获异常');
  else fail('存在 console 错误', consoleErrors.slice(0, 5).join(' | '));

  const report = { url: PAGE_URL, when: new Date().toISOString(), failures, results, consoleErrors };
  const reportFile = path.join(OUT_DIR, 'cdp-v2-report.json');
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
