// 调试：把计算的鼠标坐标输入页面，读取应用自身的 hover/命中结果，校准几何映射。
import { setTimeout as sleep } from 'node:timers/promises';

const CDP = 'http://127.0.0.1:9223';
const PAGE_URL = 'http://127.0.0.1:8090/';

const BOARD = { left: 78, right: 26, top: 44, bottomPad: 82 };

function geometry(rect, fretFrom, fretTo) {
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
  for (let i = 0; i < frets.length; i += 1) boundaries.push(boundaries[i] + (boardWidth * weights[i]) / total);
  boundaries[boundaries.length - 1] = BOARD.left + boardWidth;
  const gap = (boardHeight * 0.86) / 5;
  const centerY = BOARD.top + boardHeight / 2;
  return {
    frets,
    boundaries,
    gap,
    centerY,
    colCenter(fret) {
      const index = frets.indexOf(fret);
      return (boundaries[index] + boundaries[index + 1]) / 2;
    },
    stringY(stringIndex) {
      return centerY + (5 - stringIndex - 2.5) * gap;
    },
  };
}

async function main() {
  const created = await fetch(CDP + '/json/new?about:blank', { method: 'PUT' });
  const target = await created.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('ws error'));
  });
  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
  };
  const send = (method, params = {}) => {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error('eval error: ' + JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(2500);

  const rectJson = await evaluate(`(function(){
    var el = document.getElementById('fretboard');
    var r = el.getBoundingClientRect();
    var wrap = document.getElementById('canvas-wrap').getBoundingClientRect();
    return JSON.stringify({
      canvas: {left:r.left, top:r.top, width:r.width, height:r.height},
      wrap: {left:wrap.left, top:wrap.top, width:wrap.width, height:wrap.height},
      canvasCssWidth: getComputedStyle(el).width,
      canvasCssHeight: getComputedStyle(el).height,
      dpr: window.devicePixelRatio,
    });
  })()`);
  console.log('rect:', rectJson);
  const info = JSON.parse(rectJson);
  const rect = info.canvas;
  const geom = geometry(rect, 0, 24);

  const readHover = () => evaluate(`(function(){
    var t = document.getElementById('canvas-tooltip');
    var h = document.getElementById('hover-info');
    return JSON.stringify({tooltip: t ? (t.textContent||'').trim() : '', hover: h ? (h.textContent||'').trim() : ''});
  })()`);

  for (let s = 0; s < 6; s += 1) {
    const x = rect.left + geom.colCenter(3);
    const y = rect.top + geom.stringY(s);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await sleep(150);
    const hover = JSON.parse(await readHover());
    console.log(`intended string=${s} fret=3 at (${(x - rect.left).toFixed(1)}, ${(y - rect.top).toFixed(1)}) ->`, JSON.stringify(hover));
  }

  // 水平方向：固定字符串 5（低 E 在最下）行，扫过若干品
  const yBottom = rect.top + geom.stringY(0);
  for (const fret of [0, 1, 2, 3, 5, 7, 8, 12, 24]) {
    const x = rect.left + geom.colCenter(fret);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: yBottom });
    await sleep(120);
    const hover = JSON.parse(await readHover());
    console.log(`intended fret=${fret} ->`, JSON.stringify(hover));
  }

  // 直接读取画布像素尺寸
  console.log('canvas attrs:', await evaluate(`(function(){var c=document.getElementById('fretboard');return JSON.stringify({w:c.width,h:c.height});})()`));

  ws.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
