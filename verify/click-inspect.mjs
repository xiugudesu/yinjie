// 调试：逐个点击计算坐标，读取面板中“选中音” chip 的真实弦/品，验证点击命中映射。
import { setTimeout as sleep } from 'node:timers/promises';

const CDP = 'http://127.0.0.1:9223';
const PAGE_URL = 'http://127.0.0.1:8090/';
const BOARD = { left: 78, right: 26, top: 44, bottomPad: 82 };

function geometry(rect) {
  const { width, height } = rect;
  const boardHeight = Math.max(height - BOARD.bottomPad, 1);
  const boardWidth = Math.max(width - BOARD.left - BOARD.right, 1);
  const frets = [];
  for (let f = 0; f <= 24; f += 1) frets.push(f);
  const weights = frets.map((f) =>
    f === 0 ? (1 - Math.pow(2, -1 / 12)) * 0.72 : Math.pow(2, -(f - 1) / 12) - Math.pow(2, -f / 12));
  const total = weights.reduce((a, b) => a + b, 0);
  const boundaries = [BOARD.left];
  for (let i = 0; i < frets.length; i += 1) boundaries.push(boundaries[i] + (boardWidth * weights[i]) / total);
  boundaries[boundaries.length - 1] = BOARD.left + boardWidth;
  const gap = (boardHeight * 0.86) / 5;
  const centerY = BOARD.top + boardHeight / 2;
  return {
    colCenter: (fret) => (boundaries[fret] + boundaries[fret + 1]) / 2,
    stringY: (s) => centerY + (5 - s - 2.5) * gap,
  };
}

async function main() {
  const created = await fetch(CDP + '/json/new?about:blank', { method: 'PUT' });
  const target = await created.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('ws')); });
  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (!m.id) return;
    const e = pending.get(m.id);
    if (!e) return;
    pending.delete(m.id);
    m.error ? e.reject(new Error(JSON.stringify(m.error))) : e.resolve(m.result);
  };
  const send = (method, params = {}) => {
    const id = ++nextId;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  };
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(2600);

  const rect = JSON.parse(await evaluate(`(function(){var r=document.getElementById('fretboard').getBoundingClientRect();return JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height});})()`));
  const geom = geometry(rect);
  const targets = [[1, 3], [2, 2], [3, 0], [4, 1], [5, 0]];

  const readPanel = () => evaluate(`(function(){
    var chips = Array.from(document.querySelectorAll('#chord-body .selected-chip')).map(function(el){return el.textContent.trim();});
    return JSON.stringify({count:(document.getElementById('chord-count')||{}).textContent||'', chips: chips});
  })()`);

  for (const [string, fret] of targets) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.left + geom.colCenter(fret), y: rect.top + geom.stringY(string) });
    await sleep(100);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.left + geom.colCenter(fret), y: rect.top + geom.stringY(string), button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.left + geom.colCenter(fret), y: rect.top + geom.stringY(string), button: 'left', buttons: 0, clickCount: 1 });
    await sleep(350);
    const panel = JSON.parse(await readPanel());
    console.log(`click intended (string=${string}, fret=${fret}) ->`, JSON.stringify(panel));
  }

  // 清空后逐个单独点击，验证每个命中的真实格子
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);
  console.log('--- 单点验证 ---');
  for (const [string, fret] of targets) {
    const x = rect.left + geom.colCenter(fret);
    const y = rect.top + geom.stringY(string);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(350);
    const panel = JSON.parse(await readPanel());
    console.log(`single intended (${string},${fret}) ->`, JSON.stringify(panel.chips || panel));
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(250);
  }
  ws.close();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
