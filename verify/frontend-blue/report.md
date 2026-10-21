# yinjie v3.1 浅色冰蓝绿主题 · 前端验收报告

> ⚠️ **v3.1.1 性能修复（2026-10-20 晚）**：用户反馈「很卡 / 鼠标拖动出现延迟」后，已移除全部 `backdrop-filter`、`muse-decor` 的 `mix-blend-mode`，以及逐音符 canvas 阴影；实测帧间隔从 59–64ms 降到稳定 16.7ms（60fps）、卡顿帧（>32ms）从 154–156 帧降到 0。本文 §3 / §4.2 / §7.2 / §8 / §9 中关于 blur / multiply / 逐音符阴影的描述为 v3.1.0 历史实现，**最新实现与性能数据见文末 §11**。

- 日期：2026-10-20
- 范围：`src/main/resources/static/**`（index.html / css/app.css / js/app.js / js/audio.js / img/muse.png）
- 验收基线：http://127.0.0.1:8090 （静态资源 file-first，改完刷新即生效；**未重启、未关闭服务，未重新打包**）
- 结论：**全部验收项通过** —— CDP 自检 **40 项 PASS / 0 失败 / console 0 错误**；9 张截图齐全；退出按钮 mock 之后后端服务仍然存活。
- 本次目标：把「太黑」的深色 v3 改为**浅色冰蓝→薄荷绿主题**，卡片改为半透明玻璃，`muse.png` 从右下角小装饰升级为**全页放大的固定背景层**（用户原话：「背景不要这么黑,透明点,大块大块的露出我的图片背景」）。

---

## 1. 改动文件与要点

| 文件 | 行数 / 大小 | 改动 |
| --- | --- | --- |
| `src/main/resources/static/index.html` | 290 行 / 14,713 B | `color-scheme` 改 light；favicon（浅底 + teal pick + 浅弦）；品牌 SVG 渐变改 teal；其余 DOM 结构 / id / 脚本顺序未动 |
| `src/main/resources/static/css/app.css` | 3,080 行 / 59,191 B | 全量调色板由深色改浅色（脚本机械重映射 210 处字面量 + 手工覆盖层）；`:root` 浅色 token、`body` 浅色渐变、`body::before` 淡斜纹、`.muse-decor` 全页背景层、`body::after` 白色柔光；末尾追加约 260 行「半透明面板 + 浅色组件」覆盖层与响应式；v3.1.1 移除 14 条 `backdrop-filter` 与 `.muse-decor` 的 `mix-blend-mode`（性能修复）|
| `src/main/resources/static/js/app.js` | 3,088 行 / 99,367 B | 文件头注释；`COLORS` 全量换浅色（与 CSS 变量逐一对应）；`CAGED_SHAPE_COLORS` 换 600 系；`INK_DARK` 改 `#ffffff`；`draw / drawNoteMarker / drawCagedLayer / drawCagedTone` 内带 alpha 的原始深色字面量换浅色；指板改为浅色琴板；v3.1.1 移除逐音符 `shadowBlur`（悬停重绘热点） |
| `src/main/resources/static/js/audio.js` | 157 行 / 4,947 B | 仅文件头注释，无颜色逻辑 |
| `src/main/resources/static/img/muse.png` | 1,231×1,441 / 847,398 B | 由 `background/20260110_003715.jpg` 重新生成透明线稿（单色青墨染色，见 §4） |
| `verify/frontend-blue/cdp-verify.mjs` | 38,773 B | CDP 全流程验收入口；本次改为浅色断言（调色板一致性、muse 全页背景、浅色主题、真实像素/DOM 对比度）并输出 `cdp-report.json` |
| `verify/frontend-blue/light-retheme.py` / `light-retheme-js.py` | 25,129 / 10,562 B | 一次性浅色迁移脚本（本报告「前后值」的数据来源，保留作迁移记录） |
| `verify/frontend-blue/report.md` | 本文件 | v3.1 验收报告（覆盖 v3 深色版报告，截图文件名不变） |

未改动：后端 Java、README、docs、tools、`启动yinjie.bat`、其他 verify 脚本、`dist/` 旧产物。
> 注：README 引用的四张截图（`01-initial-1400.png`、`02-caged-overview-1400.png`、`04-chord-x32010-1400.png`、`06-tuning-editor-1400.png`）文件名与路径保持不变，本次已覆盖为新版。

### 品牌统一（沿用 v3，全文无旧残留）
| 位置 | 改前 | 改后 |
| --- | --- | --- |
| `<title>` | Fretboard Studio · 电吉他指板工坊 | yinjie · 音阶指板工坊 |
| meta description | Fretboard Studio 电吉他指板工坊：音阶可视化与和弦识别工具。 | yinjie 音阶指板工坊：电吉他音阶可视化与和弦识别工具。 |
| header `.brand-latin` / `.brand-cn` | Fretboard Studio / 电吉他指板工坊 | yinjie / 音阶指板工坊 |
| footer | Fretboard Studio · 电吉他指板工坊 | yinjie · 音阶指板工坊 |
| 退出遮罩提示 | ……请重新运行 fretboard-web 的启动脚本。 | ……请重新运行 yinjie 的启动脚本。 |
| app.css / app.js / audio.js 文件头 | Fretboard Studio · 电吉他指板工坊 | yinjie · 音阶指板工坊 |

CDP 断言：可见文本与 HTML 中 `Fretboard Studio` / `fretboard-web` / `电吉他指板工坊` 均为 `[]`（类名/id 中的 `fretboard` 功能标识保留）。

---

## 2. 配色变量前后值（深色 v3 → 浅色 v3.1）

全部定义在 `css/app.css :root`，并由 `js/app.js` 的 `COLORS` 镜像；CDP 逐项比对 23/23 一致。

| 变量 | 深色 v3 | 浅色 v3.1 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#04121a` | `#eef8f5` | 页面底色（冰蓝） |
| `--header` | `#061a23` | `#ffffff` | 顶栏（半透明白玻璃） |
| `--panel` | `#0a2230` | `#ffffff` | 面板基色 |
| `--panel-2` | `#0e2b39` | `#f2fbf8` | 面板浅层 |
| `--panel-hover` | `#123846` | `#e6f4ef` | 悬停 |
| `--panel-active` | `#174653` | `#d9ece6` | 选中 |
| `--text` | `#e8f6f3` | `#083b3a` | 主文字（冷白 → 深青） |
| `--muted` | `#a6c6ca` | `#3f6b6b` | 次要文字 |
| `--muted-dark` | `#74959c` | `#35615f` | 弱文字 |
| `--primary` | `#4df0c8` | `#0f766e` | 主强调 teal-700 |
| `--primary-hover` | `#6cf5da` | `#0d9488` | teal-600 |
| `--primary-dark` | `#0f766e` | `#115e59` | teal-800 |
| `--accent` | `#b6f36a` | `#047857` | 选中/高亮 emerald-700 |
| `--accent-hover` | `#d3ff9c` | `#059669` | emerald-600 |
| `--accent-dark` | `#407848` | `#065f46` | emerald-800 |
| `--blue` | `#38cee8` | `#0369a1` | 音阶内音（sky-700） |
| `--good` | `#34d399` | `#047857` | 成功/已连接 |
| `--bad` | `#fb7185` | `#e11d48` | 错误（rose-600） |
| `--warning` | `#fbbf24` | `#b45309` | 警告（amber-700） |
| `--line` | `#1c4452` | `#cfe6e1` | 分隔线 |
| `--line-bright` | `#2c6373` | `#a7cfc8` | 强分隔线 |
| `--focus` | `#7dd3fc` | `#0284c7` | 焦点环（sky-600） |
| `--brass` | `#8fc6d4` | `#8fb2ac` | 品丝（金属灰绿） |
| `--paper` | `#dff8f2` | `#466a6e` | 琴弦 / 琴枕深青 |
| `--shadow` | `#020a0e` | `#0f3f42` | 阴影基色 |
| `--board` | `#0d2933` | `#e9f6f2` | 指板琴面（深色 → 浅薄荷） |
| `--board-edge` | `#1e5b68` | `#b3d5cd` | 琴板边沿 |
| `--caged-c` | `#2dd4bf` | `#0d9488` | CAGED C 形 |
| `--caged-a` | `#34d399` | `#059669` | CAGED A 形 |
| `--caged-g` | `#a3e635` | `#65a30d` | CAGED G 形 |
| `--caged-e` | `#22d3ee` | `#0891b2` | CAGED E 形 |
| `--caged-d` | `#2563eb` | `#2563eb` | CAGED D 形（sky-600） |
| `--muse-opacity` / `--muse-size` / `--muse-position` | `0.2` / `min(70vh,620px)` / 右下单点装饰 | `0.8` / `125% auto` / `58% 12%` | 全页背景取景 |
| `color-scheme` | `dark` | `light` | 原生控件/滚动条 |

补充：`:root` 新增 `--card-shadow: 0 26px 64px -40px rgba(15,63,66,.52), 0 1px 0 rgba(255,255,255,.85) inset`、`--muse-*` 三件套；body 背景为
`linear-gradient(168deg, #f7fdfb 0%, #edf9f5 34%, #e2f3ee 68%, #d8ece7 100%)` + 三团淡 teal/sky/emerald radial 光晕。

---

## 3. 半透明面板实现（v3.1.1 起无 backdrop-filter）

| 层 | 实现 |
| --- | --- |
| `.app-main` / 内容 | `position: relative; z-index: 1`（背景层在 z-index 0，自然透出） |
| `.card`（基类） | `background: rgba(255,255,255,.55)`；`border: 1px solid rgba(15,63,66,.12)`；`box-shadow: var(--card-shadow)`；**无 backdrop-filter**（v3.1.0 曾有 `blur(12px)`，v3.1.1 为拖动流畅性移除） |
| `.fretboard-card` | `rgba(255,255,255,.5)`（大卡片更透） |
| `.scale-card` / `.chord-card` | `.62` / `.56` |
| `.toolbar-card` | `.66`（小控件多，稍实以保证可读） |
| `.card-head` | `linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,.26))`，下边框 `rgba(15,63,66,.1)` |
| `.site-header` | `linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.84))` + 细下边框 + 柔和投影（无 blur） |
| `.site-footer` | `rgba(255,255,255,.36)`（无 blur） |
| 小控件（select / .btn / .segmented / kbd / chip / badge） | `rgba(255,255,255,.55–.78)` + `1px rgba(15,63,66,.12–.16)` 边框；激活态用 teal 渐变 + 白字 |
| `.canvas-wrap` | 近白玻璃渐变 + 内高光；`.canvas-overlay` 白雾、`.canvas-tooltip` / `.toast` 近白实色（无 blur） |
| 响应式 | ≤900px：header `.72`、toolbar `.64`、fretboard `.34`、scale/chord `.3`；≤620px：scale/chord `.8` |
| 遮罩 | `.shutdown-overlay` `rgba(15,63,66,.32)`（v3.1.1 移除 blur），`.shutdown-card` 近白 `.94–.96` |

层叠顺序：`body` 渐变（z 0）→ `body::before` 斜纹（z 0）→ `.muse-decor`（z 0）→ `body::after` 白柔光（z 0）→ 内容（z 1）→ sticky header（z 30）→ 退出遮罩（z 90）。`muse-decor` 为 `position: fixed; inset: 0; pointer-events: none`，不拦截任何点击/键盘。

---

## 4. muse.png：全页放大的背景层

### 4.1 图片重新生成（透明 + 青绿融合）
- 源图：`background/20260110_003715.jpg`（1,231×1,441 RGB，236,898 B，白底青绿铅笔线稿，仓库内原图未改）。
- 算法（Pillow）：`alpha = clip((250 − L) / 96, 0, 1) ** 0.45`，其中 `L = 0.2126R + 0.7152G + 0.0722B`；`alpha < 0.015` 置 0；RGB 三通道统一为深青墨 **`rgb(8, 62, 56)`**；`optimize=True` 保存 PNG。
- 结果：`src/main/resources/static/img/muse.png` = 1,231×1,441 RGBA，**847,398 B < 1.2 MB**；染色单色方案在浅底上呈现干净统一的青绿线稿（若保留原图多色水彩会到 1.88 MB，超限）。
- 取景：背景尺寸 `125% auto`，即 1400×900 视口下图片宽约 1750px（约 1.4× 原始分辨率），位置 `58% 12%`，放大后仍清晰；≤900px 时位置 `64% 12%`。

### 4.2 CSS 实现
```css
.muse-decor {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: url("../img/muse.png") no-repeat 58% 12% / 125% auto;
  opacity: .8;
  mask-image: radial-gradient(172% 158% at 46% 42%, #000 0%, #000 86%,
              rgba(0,0,0,.86) 95%, transparent 100%);
}
```
- v3.1.0 曾用 `mix-blend-mode: multiply` 融合白纸区域；v3.1.1 因全页 fixed 混合层每帧都要回读背景、明显拖慢合成而**移除**，改为普通叠加。PNG 自带透明通道，线稿观感基本不变（见 §11）。`opacity .8` 落在要求的 0.55–0.8 区间。
- 径向 `mask` 只在最外缘渐隐（86% 处才开始），避免硬边，同时尽量保留画面面积。
- `body::after` 再叠加很淡的白色柔光：顶部 15% 渐变 + 左缘 `radial-gradient(46% 60% at 0% 40%, rgba(255,255,255,.22), transparent 78%)`，用于保住左侧品牌区与正文的可读性（叠在 muse 之上、内容之下）。
- 响应式：≤900px 保持 `opacity .8 / 125% auto / 64% 12%`；≤620px 降为 `opacity .42 / auto 96vh / right -4% top -2%`（窄屏避免压过内容）。

### 4.3 背景可见面积实测（1400×900）
方法：同一页面截两张图——正常渲染 vs `document.querySelector('.muse-decor').style.display='none'`，用 Pillow 逐像素求差，统计差值超过阈值的像素占比。

| 视口 | Δ>3 | Δ>4 | **Δ>6** | Δ>10 | 最大差值 |
| --- | --- | --- | --- | --- | --- |
| 1400×900 | 38.2% | 37.3% | **35.6%** | 31.2% | 152/255 |
| 900×700 | 41.8% | 40.6% | **38.4%** | 32.5% | 152/255 |

即「明显看到线稿」的面积约 **35.6%（大屏）/ 38.4%（小屏）**，落在需求的 30–40% 区间内；Δ>10 的强可见像素也占 31–32%。

---

## 5. canvas 指板：浅色琴板与 THEME 同步

### 5.1 设计取舍
- 指板改为**浅色不透明琴板**（`#e9f6f2` 薄荷白 + 灰绿品丝 + 深青琴弦），与浅页面协调；琴板保持不透明是有意为之：试过半透明板面，图片的深色排线会透过琴板形成大片鬼影，严重影响音名/指位判读，故回退。
- 音名标记（在浅底上全部重新算过对比度）：
  - 选中音：实心 `--accent #047857` + 白字 + 白色外环；
  - 根音：实心 `--primary #0f766e` + 白字 + 白色外环；
  - 音阶内音：白底 `rgba(255,255,255,.92)` + `--blue #0369a1` 描边 + 深青字 `#083b3a`；
  - 音阶外音：极淡墨绿底/边/字（不抢视线）。
- CAGED：每个把位窗口用各自的 shapeColor（`CAGED_SHAPE_COLORS`，见下）画半透明填充、描边、标签胶囊；`drawCagedTone` 中 R=teal-700 白字 + 白环、3=emerald-700 白字、5=白底 + sky 描边 + 深青字（白字在 sky 上对比不足，已改深字）。

### 5.2 与 CSS 变量的同步方式
- `js/app.js` 顶部 `COLORS` 与 `css :root` 逐值镜像（23 个 token）；CAGED 五色 `CAGED_SHAPE_COLORS = { C:#0d9488, A:#059669, G:#65a30d, E:#0891b2, D:#2563eb }` 对应 `--caged-c/a/g/e/d`。
- `cdp-verify.mjs` 在验收时从 CSS 文本解析 `:root{...}`、从 JS 文本解析 `var COLORS={...}` / `var CAGED_SHAPE_COLORS={...}`，**自动比对 23/23 + 5/5 全一致**，避免「图例与琴弦上色不同」。
- CAGED 图例圆点 `.dot-caged` 为五色 135° 渐变（`rgb(13,148,136) → rgb(5,150,105) → rgb(101,163,13) → rgb(8,145,178) → rgb(37,99,235)`），CDP 断言其 `background-image` 与五色 token 对应。

---

## 6. 对比度（WCAG AA）

三套测量互为补充，全部 ≥ 4.5:1：

1. **token 组合（13 组，纯色）**：最低 `#466a6e` on `--board #e9f6f2` = **5.34:1**；`--text/#083b3a` on 白 = 12.37、`--muted #3f6b6b` on 白 = 5.95、白字 on `--primary` = 5.47、白字 on `--accent` = 5.48、白字 on `--blue` = 5.93。
2. **页面 DOM 合成采样（9 个元素，逐层 composite backgroundColor，1400×900 实际渲染）**：最低 **5.65:1**（`.card-sub` / `.legend`），`.brand-sub` 5.82、`.site-footer` 5.66、`.tuning-chip` 12.27、`.card-head h2` 11.74。
3. **真实像素采样（保留 muse 背景，按元素 rect 上方实测页面背景色）**：最低 **4.81:1**（`.legend`），`.formula-chip` 5.04，其余 5.63–11.99:1 —— 即图片背景透出的最坏情况下正文仍满足 AA。

补充：强调色主要用于**填充 + 白字**（≥5.47:1）；`--bad/--warning` 文字用深色变体（`#9f1239` / `#92400e`）。截图 09 中 900×700 小屏同样通过（DOM 采样在 900 视口下执行）。

---

## 7. CDP 验证流程与结果

### 7.1 流程
`node verify/frontend-blue/cdp-verify.mjs`（无第三方依赖，Node 24 内置 fetch/WebSocket）：
1. 自启 headless Edge：`msedge --headless=new --disable-gpu --hide-scrollbars --no-first-run --remote-debugging-port=9224 --user-data-dir=<临时目录> --window-size=1400,900 about:blank`；
2. `PUT /json/new` 开标签页 → WebSocket 连 CDP：`Page.enable` / `Runtime.enable` / `Log.enable`；
3. **Mock 退出**：`Fetch.enable` 拦截 `POST /api/shutdown`，`Fetch.fulfillRequest` 返回 `200 {"status":"stopping"}`（**绝不真的请求后端**）；`Page.javascriptDialogOpening` 自动 `accept`（跳过确认框）；
4. `Emulation.setDeviceMetricsOverride` 切换 1400×900 / 900×700；按视口滚动到指板几何坐标点选 x32010（`boarad geometry` 复刻前端公式）；
5. 每步 `Page.captureScreenshot`（PNG）写 `verify/frontend-blue/`；收集 `Runtime.exceptionThrown` / `console.error` / `Log.entryAdded(error)`；
6. 结束 `Browser.close` + 清理临时 profile；输出 `cdp-report.json`。

### 7.2 结果：40 项 PASS / 0 失败
- 页面加载：`badge=已连接`，副标题 `自然大调（Ionian） · 根音 C · 0–24 品 · 音阶模式`；
- 品牌：`<title>`、header、meta description、footer、退出提示全部为新品牌，页面无旧品牌残留 `[]`；
- 配色：CSS/JS 23/23 + CAGED 5/5 一致；token 对比度最低 5.34；DOM 对比度最低 5.65；
- 浅色主题：`color-scheme=light`，body 计算背景 `rgb(238,248,245)`；
- muse：`opacity 0.8 / mix-blend-mode normal（v3.1.1）/ background-size 125% auto / position 58% 12% / pointer-events none / z-index 0 / mask 生效 / 覆盖 1400×900 / 宽度 ≥ 视口 120%`；≤900px 时仍存在且不遮挡；
- CAGED：图例五色渐变、总览副标题 `CAGED 全部形状`、C 形状副标题 `CAGED C 形状`；
- **和弦识别 x32010**：`已选 5 个音 · C 自然大调（Ionian）`，面板 `C / C 大三和弦 / 大三和弦 / 完整匹配 / 原位 / 匹配度 100 分 / 转位 原位 / 低音 C · 5弦3品 / 和弦构成音 1 C 根音 3 E 大三音 5 G 纯五音`（与 v2 行为一致）；
- Drop D：header chip 与 select 均 `Drop D 调弦`，footer `Drop D 调弦 D–A–D–G–B–E`；
- 调弦编辑器：6 个弦位下拉 `D2,A2,D3,G3,B3,E4`；
- **退出遮罩（mock）**：遮罩标题 `服务已停止`、状态 `已退出`，被拦截的请求 URL `http://127.0.0.1:8090/api/shutdown`；随后 `GET /api/options → HTTP 200`，证明服务未被真停；
- 900×700：x32010 仍识别为 C 大三和弦 100 分；
- **console 0 错误 / 未捕获异常 0**；9 张截图齐全。

### 7.3 截图清单

| 文件 | 内容 | 大小 |
| --- | --- | --- |
| `01-initial-1400.png` | 默认音阶模式（1400×900） | 1,107,490 B |
| `02-caged-overview-1400.png` | CAGED 总览（五色把位窗口） | 1,099,778 B |
| `03-caged-c-shape-1400.png` | CAGED 单个 C 形状 | 1,071,206 B |
| `04-chord-x32010-1400.png` | 和弦模式点选 C 标准调弦 x32010 → C 大三和弦 100 分 | 1,148,519 B |
| `05-drop-d-1400.png` | Drop D 调弦 | 1,072,341 B |
| `06-tuning-editor-1400.png` | 自定义调弦编辑器（Drop D 值 D2/A2/D3/G3/B3/E4） | 1,030,128 B |
| `07-exit-overlay-1400.png` | 退出遮罩（POST /api/shutdown 已 mock） | 917,323 B |
| `08-initial-900x700.png` | 900×700 小屏默认音阶模式 | 653,063 B |
| `09-chord-900x700.png` | 900×700 小屏和弦识别结果 | 844,511 B |

---

## 8. 与深色 v3 的差异

| 维度 | 深色 v3 | 浅色 v3.1 |
| --- | --- | --- |
| 页面底色 | `#04121a → #0a2230 → #0d2b2f` 近黑深蓝绿 | `#f7fdfb → #edf9f5 → #e2f3ee → #d8ece7` 冰蓝→薄荷绿，`color-scheme: light` |
| 面板 | 深色半透明实色（`rgba(14,43,57,.92)`），冷色描边 | 白色半透明面板 `rgba(255,255,255,.5–.66)`（v3.1.1 无 blur），图片成块透出且拖动流畅 |
| 文字 | 冷白 `#e8f6f3` / `#a6c6ca` | 深青 `#083b3a` / `#3f6b6b` / `#35615f` |
| 强调色 | mint/lime 荧光（`#4df0c8` / `#b6f36a` / `#38cee8`） | teal/emerald/sky 600–800 系（`#0f766e` / `#047857` / `#0369a1`） |
| CAGED 五色 | 500 系亮色（`#2dd4bf` / `#34d399` / `#a3e635` / `#22d3ee` / `#2563eb`） | 600–700 深化（`#0d9488` / `#059669` / `#65a30d` / `#0891b2` / `#2563eb`） |
| 指板 | 深色琴板 `#0d2933` + 浅色品丝琴弦 | 浅薄荷琴板 `#e9f6f2` + 灰绿品丝 `#8fb2ac` + 深青琴弦 `#466a6e` |
| muse 装饰 | 右下角小装饰：`min(70vh,620px)`、opacity 0.2、soft-light、z 2、被卡片遮到几乎不可见 | 全页背景层：`125% auto`、opacity 0.8、无混合模式、z 0、可见面积 35.6%（大屏） |
| 功能/DOM/JS | — | 完全保留（音阶/和弦双模式、点选识别、CAGED、调弦器、扫弦试听、退出遮罩），无重写、无外部依赖 |

---

## 9. 已知取舍与风险

1. **背景可见度 vs 正文可读性**：为同时满足「30–40% 面积明显看到图」与「正文 AA」，玻璃透明度取需求规格的上限（大卡 .5–.66），并在左侧/顶部叠很淡白色柔光；实测可见面积 35.6%（1400×900）仍有 4.8:1 的最差文字对比度（`.legend`）。若再把玻璃调得更透，小字会先跌破 AA。
2. **muse.png 为单色青墨染色**：为把 1.23MP 彩色线稿压到 <1.2 MB（847 KB），丢弃了原图的多色水彩，仅保留「线稿 + 青绿」观感；放大到 125% 视口时是约 1.1–1.4× 上采样，背景层可接受轻微柔化。
3. **小屏背景存在感更强**：900×700 下可见面积 38.4%，卡片透明度相应提高（.3–.64）以保住文字；≤620px 降为 opacity .42 且窄屏隐藏侧栏布局，避免压过内容。
4. **合成性能（v3.1.1 已解决）**：v3.1.0 的 14 处 `backdrop-filter` + 全页 `mix-blend-mode: multiply` 会让每次悬停重绘触发大面积模糊/混合，实测 rAF 帧间隔 59–64ms（约 15–17fps）。v3.1.1 全部移除后稳定 16.7ms（60fps）；无 GPU 的极低端设备仍建议把浏览器硬件加速保持开启。
5. **真实像素对比度依赖背景采样**：图片背景下文字对比度随位置浮动，报告同时给出 token / DOM 合成 / 真实像素三套数据；最小余量出现在 CAGED 图例小字（4.81:1）。
6. **退出按钮行为未改**：仍为「确认框 → POST /api/shutdown → 遮罩」；验收时通过 CDP Fetch mock 验证，不改后端、不真关服务。
7. 未修改 README / docs / 后端 Java / 启动脚本；深色 v3 的静态文件备份在 `%TEMP%\yinjie-v3-dark-backup\`（本次覆盖前留档，如需回退可用）。

---

## 10. 复现

```bash
# 全流程验收（自启/自关 headless Edge，端口 9224，截图 + cdp-report.json 均写入 verify/frontend-blue/）
node verify/frontend-blue/cdp-verify.mjs

# 页面（服务保持运行，静态资源 file-first）
curl -s http://127.0.0.1:8090/ | head
```

一次性浅色迁移脚本（保留作记录，非验收必需）：`verify/frontend-blue/light-retheme.py`、`light-retheme-js.py`。


---

## 11. 性能修复（v3.1.1，2026-10-20 晚）

用户反馈（原话）：「你动了什么,帮我优化,现在很卡」「鼠标拖动出现延迟」。经定位是 v3.1.0 引入的 CSS 合成层与 canvas 逐标记阴影导致，已修复并复测。

### 11.1 定位方法

新增 `verify/frontend-blue/perf-probe.mjs`（无依赖，Node 24）：启动 headless Edge（CDP 9334）→ 打开 8090 → 用 `Input.dispatchMouseEvent` 以约 5ms 间隔在指板上连续扫动 160 个真实鼠标移动事件，同时页面内用 `requestAnimationFrame` 采样帧间隔，输出 avg / p50 / p95 / max / 卡顿帧（>32ms）数量；并通过注入临时 `<style>` 逐个排除可疑 CSS。

```bash
# 先起 headless Edge（示例）
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9334 --user-data-dir=%TEMP%\yinjie-perf-cdp --window-size=1400,900 --no-first-run --disable-gpu --hide-scrollbars about:blank
node verify/frontend-blue/perf-probe.mjs
```

### 11.2 测量结果（同一台机器 / 同一 headless Edge / 软件渲染）

| 场景（悬停扫动期间） | avg 帧间隔 | p95 | max | >32ms 卡顿帧 |
| --- | --- | --- | --- | --- |
| v3.1.0 基线（14 处 blur + multiply） | **59.0 / 64.2 ms** | 66.8 / 83.4 ms | 83.4 ms | **154 / 156** |
| 仅去掉 backdrop-filter | 18.3 ms | 33.3 ms | ~33 ms | 18 |
| 再去掉 muse multiply | **16.7 ms** | 16.8 ms | 16.8 ms | **0** |
| v3.1.1 最终（额外移除逐音符 canvas 阴影后复测） | **16.7 ms** | 16.7 ms | 16.8 ms | **0** |

结论：`backdrop-filter` 是主因（≈3.2× 帧间隔），全页 `mix-blend-mode` 次之；60fps 后 canvas 的逐音符 `shadowBlur` 仍占用每帧预算，一并移除。

### 11.3 改动清单（均只改前端样式/绘制，不动功能与 DOM）

- `css/app.css`：删除全部 **14 条** `backdrop-filter` / `-webkit-backdrop-filter`（header / card / footer / shutdown / canvas-overlay / canvas-tooltip 等）；删除 `.muse-decor` 的 `mix-blend-mode: multiply`。
- `js/app.js`：`drawNoteMarker` 去掉逐音符阴影（`shadowColor/shadowBlur=5/shadowOffsetY`，一屏 140+ 个标记、每次悬停重绘都画）；`drawCagedTone` 同样去掉 `shadowBlur=7`；保留琴板本体的一处大阴影与琴枕一处小阴影。
- 视觉效果：背景线稿去除模糊后反而更清晰、更大块（更贴合「大块大块露出图片」），面板仍是半透明白；实测 DOM 对比度最低 **5.65:1**（9 采样），仍过 AA。
- 缓存/加载：`app.css` 62,913 → **59,191 B**（-3,722 B），`app.js` 102,619 → **99,367 B**（-3,252 B）。

### 11.4 修复后的回归

- `node verify/frontend-blue/cdp-verify.mjs` → **40/40 PASS**、console 0 错误、9 张截图重新生成（`cdp-verify.mjs` 的 muse 断言已从「必须 multiply」改为「normal 或 multiply」，并注明原因）；
- `python verify/api-sweep.py http://127.0.0.1:8090` → **174/174 PASS**；`node verify/cdp-check.mjs` → **13/13 PASS**（点选 x32010 仍识别 C 大三和弦 100 分）；
- 视觉复核：背景线稿比 v3.1.0 更清楚、面板不再发灰，正文与控件可读性正常。

### 11.5 残余建议

- 若在无独显/核显很老的机器上仍觉得顿，可把 `img/muse.png` 再降采样一档（当前 1231×1441 / 847 KB）或把 `.muse-decor` 的 `opacity` 降到 .6；两者都是单行改动。
- 已保留 `perf-probe.mjs` 作为后续样式改动的回归工具。
