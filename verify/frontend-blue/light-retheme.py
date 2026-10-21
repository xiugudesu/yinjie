# -*- coding: utf-8 -*-
"""v3.1 light icy-blue-green retheme for src/main/resources/static/css/app.css.

One-shot, deterministic: remaps every hard-coded dark-theme literal to the light
palette, rewrites :root / body / body::before / .muse-decor, adds body::after
readability wash, then appends the "light glass" override layer.
"""
import pathlib
import re
import sys

CSS_PATH = pathlib.Path("src/main/resources/static/css/app.css")
css = CSS_PATH.read_text(encoding="utf-8")
orig_len = len(css)

# ---------------------------------------------------------------- new :root --
NEW_ROOT = """:root {
  color-scheme: light;

  /* ---- 冰蓝 → 薄荷绿浅色底（#f4fcf9 / #e6f6f1 / #d5ede9 层次） --------- */
  --bg: #eef8f5;
  --header: #ffffff;
  --panel: #ffffff;
  --panel-2: #f2fbf8;
  --panel-hover: #e6f4ef;
  --panel-active: #d9ece6;

  /* ---- 文字：深青，正文对比度 ≥ WCAG AA --------------------------- */
  --text: #083b3a;
  --muted: #3f6b6b;
  --muted-dark: #35615f;

  /* ---- 强调色：teal / emerald / sky -------------------------------- */
  --primary: #0d9488;
  --primary-hover: #0f766e;
  --primary-dark: #115e59;
  --accent: #059669;
  --accent-hover: #10b981;
  --accent-dark: #047857;
  --blue: #0284c7;
  --good: #047857;
  --bad: #e11d48;
  --warning: #b45309;
  --line: #cfe6e1;
  --line-bright: #a7cfc8;
  --focus: #0284c7;
  --brass: #8fb2ac;
  --paper: #466a6e;
  --shadow: #0f3f42;
  --board: #f2fbf9;
  --board-edge: #bfdcd5;

  /* CAGED 五个形状色（与 js/app.js 的 CAGED_SHAPE_COLORS 完全一致） */
  --caged-c: #0d9488;
  --caged-a: #059669;
  --caged-g: #65a30d;
  --caged-e: #0891b2;
  --caged-d: #2563eb;

  /* muse.png 全页背景装饰层（不再局限于右下角） */
  --muse-opacity: 0.66;
  --muse-size: auto 112vh;
  --muse-position: right -6% top -8%;

  --font-ui: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC",
    "Source Han Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Avenir Next", "Futura", "Trebuchet MS", "PingFang SC",
    "Microsoft YaHei", sans-serif;
  --font-mono: "Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;

  --radius-lg: 18px;
  --radius-md: 12px;
  --radius-sm: 8px;
  --card-shadow: 0 26px 64px -40px rgba(15, 63, 66, 0.52),
    0 1px 0 rgba(255, 255, 255, 0.85) inset;
}
"""

# ---------------------------------------------------------------- new body ---
NEW_BODY = """body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  background-color: var(--bg);
  background-image:
    radial-gradient(1200px 620px at 8% -10%, rgba(13, 148, 136, 0.13), transparent 62%),
    radial-gradient(1000px 520px at 104% 0%, rgba(2, 132, 199, 0.1), transparent 60%),
    radial-gradient(900px 640px at 50% 118%, rgba(5, 150, 105, 0.09), transparent 66%),
    linear-gradient(168deg, #f4fcf9 0%, #eff9f6 32%, #e6f6f1 64%, #d5ede9 100%);
  background-attachment: fixed;
}
"""

NEW_BEFORE = """body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.5;
  background-image: repeating-linear-gradient(
    115deg,
    rgba(15, 63, 66, 0.022) 0 1px,
    transparent 1px 9px
  );
}
"""

MUSE_COMMENT_OLD_START = "/* --------------------------------------------------------------------------\n   muse.png decorative layer"
MUSE_COMMENT_NEW = """/* --------------------------------------------------------------------------
   muse.png decorative layer — full-page fixed background art.
   放大铺满右侧/中部（background-size auto 112vh），multiply 混合让青绿色
   线稿在白底上自然融合；radial-gradient mask 让左缘与四角渐隐。
   pointer-events:none 不拦截交互；z-index 0 位于内容（.app-main z-index 1）
   之下，只作为背景。全页面积由 --muse-size / --muse-position / opacity 控制。
   -------------------------------------------------------------------------- */
"""

NEW_MUSE = """.muse-decor {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: url("../img/muse.png");
  background-repeat: no-repeat;
  background-position: var(--muse-position);
  background-size: var(--muse-size);
  opacity: var(--muse-opacity);
  mix-blend-mode: multiply;
  -webkit-mask-image: radial-gradient(
    118% 128% at 80% 46%,
    #000 0%,
    #000 46%,
    rgba(0, 0, 0, 0.55) 74%,
    transparent 93%
  );
  mask-image: radial-gradient(
    118% 128% at 80% 46%,
    #000 0%,
    #000 46%,
    rgba(0, 0, 0, 0.55) 74%,
    transparent 93%
  );
}

/* 左侧文字区很淡的白色径向遮罩，保证正文可读性（叠在 muse 之上、内容之下） */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 880px 780px at 0% 46%,
      rgba(255, 255, 255, 0.74) 0%,
      rgba(255, 255, 255, 0.44) 42%,
      rgba(255, 255, 255, 0) 76%
    ),
    linear-gradient(180deg, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0) 20%);
}
"""

# ------------------------------------------------------- literal remap tables -
HEX_MAP = {
    "#04201c": "#ffffff",
    "#ffc0ca": "#9f1239",
    "#9cf0d0": "#047857",
    "#ffe08a": "#92400e",
    "#8ce6c8": "#047857",
    "#fda4af": "#be123c",
    "#ffd0d8": "#9f1239",
    "#0a202a": "#ffffff",
    "#8fe3f2": "#075985",
    "#8ff5e4": "#115e59",
    "#c9fff4": "#ffffff",
    "#071820": "#f0faf7",
    "#0b2431": "#ffffff",
    "#081a24": "#f4fcf9",
}

# triple -> (new rgb, alpha factor, alpha cap, alpha floor)
RGBA_MAP = {
    (28, 68, 82): ((15, 63, 66), 0.32, None, None),
    (182, 243, 106): ((5, 150, 105), 0.55, None, None),
    (251, 113, 133): ((225, 29, 72), 0.7, None, None),
    (4, 18, 26): ((15, 63, 66), 0.3, None, None),
    (77, 240, 200): ((13, 148, 136), 0.75, None, None),
    (14, 43, 57): ((255, 255, 255), 0.85, 0.72, None),
    (0, 0, 0): ((15, 63, 66), 0.35, None, None),
    (251, 191, 36): ((180, 83, 9), 0.7, None, None),
    (56, 206, 232): ((2, 132, 199), 0.6, None, None),
    (52, 211, 153): ((5, 150, 105), 0.7, None, None),
    (44, 99, 115): ((15, 63, 66), 0.3, None, None),
    (143, 198, 212): ((79, 119, 114), 0.7, None, None),
    (166, 198, 202): ((63, 107, 107), 1.25, 1.0, None),
    (10, 34, 48): ((244, 252, 249), 1.0, None, None),
    (23, 70, 83): ((230, 244, 239), 0.75, None, None),
    (2, 10, 14): ((15, 63, 66), 0.4, None, None),
    (223, 248, 242): ((255, 255, 255), 3.0, 0.5, None),
    (6, 26, 35): ((255, 255, 255), 0.82, 0.72, None),
    (125, 211, 252): ((2, 132, 199), 0.9, None, None),
    (15, 118, 110): ((15, 118, 110), 0.9, None, None),
    (10, 32, 42): ((244, 252, 249), 1.0, None, None),
    (255, 255, 255): ((255, 255, 255), 2.0, 0.55, None),
    (18, 56, 70): ((255, 255, 255), 2.0, 0.78, None),
    (20, 184, 166): ((13, 148, 136), 1.0, None, None),
    (5, 22, 30): ((255, 255, 255), 1.4, 0.8, None),
    (6, 22, 30): ((255, 255, 255), 0.82, 0.72, None),
    (4, 32, 28): ((255, 255, 255), 1.2, 0.9, None),
    (108, 245, 218): ((13, 148, 136), 1.0, None, None),
    (13, 148, 136): ((15, 118, 110), 1.0, None, None),
    (116, 149, 156): ((53, 97, 95), 1.0, None, None),
}


def fmt_alpha(a):
    if a >= 0.999:
        return "1"
    s = f"{round(a, 3):.3f}".rstrip("0").rstrip(".")
    return s or "0"


def remap_rgba(match):
    r, g, b = (int(match.group(i)) for i in (1, 2, 3))
    a = float(match.group(4))
    entry = RGBA_MAP.get((r, g, b))
    if entry is None:
        raise SystemExit(f"unmapped rgba triple: {(r, g, b)}")
    (nr, ng, nb), factor, cap, floor = entry
    na = a * factor
    if (r, g, b) == (255, 255, 255) and a < 0.05:
        nr, ng, nb, na = 15, 63, 66, 0.045
    if cap is not None:
        na = min(na, cap)
    if floor is not None:
        na = max(na, floor)
    return f"rgba({nr}, {ng}, {nb}, {fmt_alpha(na)})"


# ---------------------------------------------------------------- transform ---
root_match = re.search(r"^:root \{.*?^\}\n", css, re.M | re.S)
if not root_match:
    raise SystemExit(":root block not found")
root_block = root_match.group(0)
rest = css[: root_match.start()] + css[root_match.end():]

# 1) file header theme description
rest = rest.replace(
    "   Theme: deep blue-green stage (teal / emerald / lime / cyan / sky) with\n"
    "   cold translucent panels.  The color tokens below are mirrored 1:1 by the\n"
    "   COLORS table in js/app.js, so CSS legend and canvas markers never differ.",
    "   Theme: light icy blue-green (teal / emerald / sky) with translucent glass\n"
    "   panels over a full-page muse.png line-art background.  The color tokens\n"
    "   below are mirrored 1:1 by the COLORS table in js/app.js, so legend colours\n"
    "   and canvas markers never differ.",
)

# 2) hex literals
hex_re = re.compile(r"#[0-9a-fA-F]{6}\b")
hex_hits = 0


def repl_hex(m):
    global hex_hits
    val = m.group(0).lower()
    if val in HEX_MAP:
        hex_hits += 1
        return HEX_MAP[val]
    return m.group(0)


rest = hex_re.sub(repl_hex, rest)

# 3) rgba literals
rgba_re = re.compile(
    r"rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9.]+)\s*\)"
)
rest, rgba_hits = rgba_re.subn(remap_rgba, rest)

# 4) body rule
body_match = re.search(r"^body \{[^}]*\}\n", rest, re.M)
if not body_match:
    raise SystemExit("body rule not found")
rest = rest[: body_match.start()] + NEW_BODY + rest[body_match.end():]

# 5) body::before rule
before_match = re.search(r"^body::before \{[^}]*\}\n", rest, re.M)
if not before_match:
    raise SystemExit("body::before rule not found")
rest = rest[: before_match.start()] + NEW_BEFORE + rest[before_match.end():]

# 6) muse comment + muse rule (rule has no nested braces)
comment_start = rest.find(MUSE_COMMENT_OLD_START)
if comment_start == -1:
    raise SystemExit("muse comment not found")
comment_end = rest.find("*/\n", comment_start) + 3
rest = rest[:comment_start] + MUSE_COMMENT_NEW + rest[comment_end:]

muse_match = re.search(r"^\.muse-decor \{[^}]*\}\n", rest, re.M)
if not muse_match:
    raise SystemExit(".muse-decor rule not found")
rest = rest[: muse_match.start()] + NEW_MUSE + rest[muse_match.end():]

# 7) new root
css = NEW_ROOT + rest

# ----------------------------------------------------- append override layer --
OVERRIDES = r"""
/* ==========================================================================
   v3.1 light glass layer — 半透明玻璃面板，让 muse 背景成块透出。
   覆盖在上面的暗色主题规则之后，同优先级选择器后出现即生效。
   ========================================================================== */

/* ---- shell --------------------------------------------------------------- */
.skip-link {
  background: var(--primary-dark);
  color: #ffffff;
}

.site-header {
  background: rgba(255, 255, 255, 0.58);
  border-bottom: 1px solid rgba(15, 63, 66, 0.1);
  box-shadow: 0 14px 36px -32px rgba(15, 63, 66, 0.55);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
}

.brand-latin {
  color: var(--text);
}

.brand-cn {
  color: var(--primary-dark);
}

.brand-sep {
  color: var(--line-bright);
}

.brand-sub {
  color: var(--muted);
}

.tuning-chip {
  border-color: rgba(15, 63, 66, 0.14);
  background: rgba(255, 255, 255, 0.6);
  color: var(--text);
}

.tuning-dot {
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.14);
}

.status-badge {
  border-color: rgba(15, 63, 66, 0.14);
  background: rgba(255, 255, 255, 0.64);
  color: var(--text);
}

.status-badge.is-ok {
  color: var(--primary-dark);
  border-color: rgba(13, 148, 136, 0.32);
}

.status-badge.is-ok .status-dot {
  background: var(--good);
  box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.14);
}

.status-badge.is-error {
  color: #9f1239;
  border-color: rgba(225, 29, 72, 0.3);
}

.status-badge.is-idle {
  color: var(--muted);
}

.error-banner {
  border-color: rgba(225, 29, 72, 0.32);
  background: rgba(225, 29, 72, 0.08);
  color: #9f1239;
}

/* ---- glass cards --------------------------------------------------------- */
.card {
  border: 1px solid rgba(15, 63, 66, 0.12);
  background: rgba(255, 255, 255, 0.56);
  box-shadow: var(--card-shadow);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  backdrop-filter: blur(16px) saturate(150%);
}

/* 大块内容面板更透，让背景画成块透出来 */
.fretboard-card {
  background: rgba(255, 255, 255, 0.6);
}

.scale-card {
  background: rgba(255, 255, 255, 0.52);
}

.chord-card {
  background: rgba(255, 255, 255, 0.5);
}

/* 工具栏是密集小控件，稍实一点保证可读 */
.toolbar-card {
  background: rgba(255, 255, 255, 0.72);
}

.card-head {
  border-bottom-color: rgba(15, 63, 66, 0.1);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.08));
}

.card-head h2 {
  color: var(--text);
}

.card-sub {
  color: var(--muted);
}

.card-foot {
  border-top-color: rgba(15, 63, 66, 0.1);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.4));
}

/* ---- fretboard canvas ---------------------------------------------------- */
.canvas-wrap {
  border-color: rgba(15, 63, 66, 0.13);
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(13, 148, 136, 0.1), transparent 62%),
    radial-gradient(90% 70% at 50% 112%, rgba(2, 132, 199, 0.09), transparent 70%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(238, 250, 246, 0.78));
}

.canvas-overlay {
  background: rgba(244, 252, 249, 0.8);
  color: var(--muted);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.canvas-tooltip {
  border-color: rgba(15, 63, 66, 0.14);
  background: rgba(255, 255, 255, 0.94);
  color: var(--text);
  box-shadow: 0 20px 44px -30px rgba(15, 63, 66, 0.6);
}

.legend {
  color: var(--muted);
}

.legend .dot {
  border-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 1px rgba(15, 63, 66, 0.22);
}

/* ---- form controls ------------------------------------------------------- */
.field-label {
  color: var(--muted);
}

.select-wrap select {
  border-color: rgba(15, 63, 66, 0.16);
  background: rgba(255, 255, 255, 0.74);
  color: var(--text);
}

.select-wrap select:hover {
  border-color: var(--line-bright);
  background: rgba(255, 255, 255, 0.92);
}

.select-wrap select:focus-visible {
  border-color: var(--focus);
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.16);
}

.select-wrap select optgroup {
  background: #ffffff;
  color: var(--muted-dark);
}

.select-wrap select option {
  background: #ffffff;
  color: var(--text);
}

.select-chevron {
  color: var(--muted);
}

.segmented {
  border-color: rgba(15, 63, 66, 0.12);
  background: rgba(15, 63, 66, 0.05);
}

.seg-btn {
  color: var(--muted);
}

.seg-btn:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.62);
}

.seg-btn[aria-pressed="true"] {
  color: #ffffff;
  background: var(--primary);
  box-shadow: 0 10px 20px -14px rgba(15, 118, 110, 0.85);
}

.seg-btn[aria-pressed="true"]:hover {
  background: var(--primary-hover);
}

.switch-track {
  border-color: rgba(15, 63, 66, 0.18);
  background: rgba(15, 63, 66, 0.14);
}

.switch input:checked + .switch-track {
  background: var(--primary);
  border-color: var(--primary-dark);
}

.switch-thumb {
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(15, 63, 66, 0.28);
}

.switch-text {
  color: var(--muted);
}

.switch input:checked ~ .switch-text {
  color: var(--text);
}

.btn {
  border-color: rgba(15, 63, 66, 0.16);
  background: rgba(255, 255, 255, 0.64);
  color: var(--text);
}

.btn:hover {
  background: rgba(255, 255, 255, 0.92);
}

.btn-ghost {
  color: var(--muted);
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text);
}

.btn-primary {
  border-color: rgba(15, 118, 110, 0.36);
  background: linear-gradient(180deg, #0d9488, #0f766e);
  color: #ffffff;
  box-shadow: 0 14px 26px -18px rgba(15, 118, 110, 0.85);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #14b8a6, #0d9488);
}

.btn-primary:disabled {
  background: rgba(15, 118, 110, 0.42);
  color: rgba(255, 255, 255, 0.82);
}

.exit-btn {
  border-color: rgba(225, 29, 72, 0.26);
  background: rgba(255, 255, 255, 0.55);
  color: #9f1239;
}

.exit-btn:hover:not(:disabled) {
  border-color: rgba(225, 29, 72, 0.42);
  background: rgba(225, 29, 72, 0.08);
}

.tuning-editor {
  border-color: rgba(15, 63, 66, 0.12);
  background: rgba(255, 255, 255, 0.5);
}

.tuning-editor-hint {
  color: var(--muted);
}

.tuning-slot-label {
  color: var(--muted);
}

.tuning-slot select {
  border-color: rgba(15, 63, 66, 0.16);
  background: rgba(255, 255, 255, 0.78);
  color: var(--text);
}

.tuning-slot select:hover {
  border-color: var(--line-bright);
  background: rgba(255, 255, 255, 0.95);
}

.tuning-slot select:focus-visible {
  border-color: var(--focus);
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.16);
}

/* ---- scale card ---------------------------------------------------------- */
.scale-name {
  color: var(--text);
}

.scale-english {
  color: var(--muted);
}

.formula-chip,
.note-chip {
  border-color: rgba(15, 63, 66, 0.14);
  background: rgba(255, 255, 255, 0.62);
  color: var(--muted-dark);
}

.note-chip.is-root {
  border-color: rgba(13, 148, 136, 0.36);
  background: rgba(13, 148, 136, 0.12);
  color: var(--primary-dark);
}

.interval-degree {
  color: var(--primary-dark);
}

.interval-name {
  color: var(--muted-dark);
}

.interval-row {
  border-color: rgba(15, 63, 66, 0.08);
}

.skeleton-line {
  background: linear-gradient(90deg, rgba(15, 63, 66, 0.06), rgba(15, 63, 66, 0.12), rgba(15, 63, 66, 0.06));
}

/* ---- chord card ---------------------------------------------------------- */
.chord-body {
  scrollbar-color: rgba(15, 63, 66, 0.28) transparent;
}

.chord-fade {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.82));
}

.chord-fade::after {
  background: rgba(255, 255, 255, 0.82);
}

.chord-empty-icon {
  border-color: rgba(15, 63, 66, 0.18);
  color: var(--primary-dark);
}

.chord-empty-title {
  color: var(--text);
}

.chord-empty-sub {
  color: var(--muted);
}

.chord-symbol {
  color: var(--primary-dark);
  text-shadow: none;
}

.chord-name {
  color: var(--text);
}

.badge {
  border-color: rgba(15, 63, 66, 0.14);
  background: rgba(255, 255, 255, 0.6);
}

.badge-blue {
  border-color: rgba(2, 132, 199, 0.28);
  background: rgba(2, 132, 199, 0.1);
  color: #075985;
}

.badge-primary {
  border-color: rgba(15, 118, 110, 0.3);
  background: rgba(13, 148, 136, 0.12);
  color: var(--primary-dark);
}

.badge-good {
  border-color: rgba(4, 120, 87, 0.3);
  background: rgba(5, 150, 105, 0.12);
  color: #065f46;
}

.badge-warning {
  border-color: rgba(180, 83, 9, 0.3);
  background: rgba(180, 83, 9, 0.1);
  color: #92400e;
}

.badge-bad {
  border-color: rgba(225, 29, 72, 0.3);
  background: rgba(225, 29, 72, 0.1);
  color: #9f1239;
}

.score-track {
  background: rgba(15, 63, 66, 0.1);
}

.score-fill {
  background: linear-gradient(90deg, #059669, #0d9488);
}

.score-label,
.score-value {
  color: var(--muted-dark);
}

.meta-label {
  color: var(--muted);
}

.meta-value {
  color: var(--text);
}

.meta-item {
  border-color: rgba(15, 63, 66, 0.1);
  background: rgba(255, 255, 255, 0.42);
}

.section-label {
  color: var(--muted-dark);
}

.section-label::after {
  background: linear-gradient(90deg, rgba(15, 63, 66, 0.16), transparent);
}

.tone-chip {
  border-color: rgba(15, 63, 66, 0.14);
  background: rgba(255, 255, 255, 0.58);
}

.tone-chip .tone-degree {
  color: var(--primary-dark);
}

.tone-chip .tone-role {
  color: var(--muted-dark);
}

.tone-chip.is-missing {
  border-color: rgba(180, 83, 9, 0.3);
  background: rgba(180, 83, 9, 0.08);
}

.missing-row .label,
.missing-chip {
  color: var(--muted-dark);
}

.description {
  border-color: rgba(15, 63, 66, 0.12);
  background: rgba(255, 255, 255, 0.5);
  color: var(--muted-dark);
}

.shape-hint {
  color: var(--muted);
}

.shape-hint-label {
  color: var(--muted-dark);
}

.shape-hint-value {
  color: var(--primary-dark);
}

.hints {
  color: var(--muted);
}

.alt-item {
  border-color: rgba(15, 63, 66, 0.1);
  background: rgba(255, 255, 255, 0.44);
}

.alt-item:hover {
  background: rgba(255, 255, 255, 0.7);
}

.alt-item.is-active {
  border-color: rgba(13, 148, 136, 0.34);
  background: rgba(13, 148, 136, 0.1);
}

.alt-symbol {
  color: var(--text);
}

.alt-name {
  color: var(--muted-dark);
}

.alt-score {
  color: var(--muted);
}

.alt-detail {
  border-color: rgba(15, 63, 66, 0.1);
  background: rgba(255, 255, 255, 0.4);
}

.alt-detail-note,
.alt-detail-foot {
  color: var(--muted);
}

.chord-footer {
  border-color: rgba(15, 63, 66, 0.1);
  color: var(--muted);
}

.selected-chip {
  border-color: rgba(5, 150, 105, 0.3);
  background: rgba(5, 150, 105, 0.12);
  color: #065f46;
}

.selected-chip.is-out {
  border-color: rgba(180, 83, 9, 0.3);
  background: rgba(180, 83, 9, 0.1);
  color: #92400e;
}

.chord-mode-gate,
.unrecognized {
  border-color: rgba(15, 63, 66, 0.12);
  background: rgba(255, 255, 255, 0.42);
}

.chord-mode-gate .gate-title,
.unrecognized-title {
  color: var(--text);
}

.chord-mode-gate .gate-sub,
.unrecognized-sub {
  color: var(--muted);
}

.unrecognized-icon {
  color: var(--muted-dark);
}

.chord-error {
  border-color: rgba(225, 29, 72, 0.3);
  background: rgba(225, 29, 72, 0.08);
  color: #9f1239;
}

.chord-loading {
  color: var(--muted);
}

.spinner {
  border-color: rgba(15, 63, 66, 0.16);
  border-top-color: var(--primary);
}

/* ---- CAGED --------------------------------------------------------------- */
.dot-caged {
  background: linear-gradient(
    135deg,
    var(--caged-c) 0%,
    var(--caged-a) 25%,
    var(--caged-g) 50%,
    var(--caged-e) 75%,
    var(--caged-d) 100%
  );
}

/* ---- toast / footer / shutdown ------------------------------------------ */
.toast {
  border-color: rgba(15, 63, 66, 0.14);
  background: rgba(255, 255, 255, 0.94);
  color: var(--text);
  box-shadow: 0 22px 50px -34px rgba(15, 63, 66, 0.6);
}

.toast.is-error {
  border-color: rgba(225, 29, 72, 0.3);
  color: #9f1239;
}

.site-footer {
  border-top-color: rgba(15, 63, 66, 0.1);
  background: rgba(255, 255, 255, 0.4);
  color: var(--muted);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.footer-sep {
  color: var(--line-bright);
}

.shutdown-overlay {
  background: rgba(238, 248, 245, 0.72);
}

.shutdown-card {
  border-color: rgba(15, 63, 66, 0.14);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(246, 253, 251, 0.96));
  box-shadow: 0 34px 80px -44px rgba(15, 63, 66, 0.65);
}

.shutdown-icon {
  border-color: rgba(13, 148, 136, 0.35);
  color: var(--primary);
}

.shutdown-title {
  color: var(--text);
}

.shutdown-text {
  color: var(--muted);
}

.shutdown-hint {
  color: var(--muted-dark);
}

/* ---- responsive --------------------------------------------------------- */
@media (max-width: 900px) {
  .muse-decor {
    opacity: 0.46;
    background-size: auto 96vh;
    background-position: right -2% top -4%;
  }

  .site-header {
    background: rgba(255, 255, 255, 0.72);
  }

  .toolbar-card {
    background: rgba(255, 255, 255, 0.8);
  }

  .fretboard-card {
    background: rgba(255, 255, 255, 0.68);
  }

  .scale-card,
  .chord-card {
    background: rgba(255, 255, 255, 0.62);
  }
}

@media (max-width: 620px) {
  .muse-decor {
    display: block;
    opacity: 0.34;
    background-size: auto 86vh;
    background-position: right -4% top -2%;
  }

  .scale-card,
  .chord-card {
    background: rgba(255, 255, 255, 0.8);
  }

  .canvas-wrap {
    background:
      radial-gradient(120% 90% at 50% 0%, rgba(13, 148, 136, 0.08), transparent 62%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(240, 250, 247, 0.9));
  }
}
"""

css = css.rstrip() + "\n" + OVERRIDES

# ---------------------------------------------------------------- sanity -----
if css.count("{") != css.count("}"):
    raise SystemExit(
        f"brace mismatch: {{={css.count('{')} }}={css.count('}')}"
    )

old_triples = [
    "28, 68, 82", "182, 243, 106", "251, 113, 133", "4, 18, 26",
    "77, 240, 200", "14, 43, 57", "251, 191, 36", "56, 206, 232",
    "52, 211, 153", "44, 99, 115", "143, 198, 212", "166, 198, 202",
    "10, 34, 48", "23, 70, 83", "2, 10, 14", "223, 248, 242",
    "6, 26, 35", "125, 211, 252", "18, 56, 70", "20, 184, 166",
    "5, 22, 30", "6, 22, 30", "4, 32, 28", "108, 245, 218",
    "116, 149, 156",
]
remain = [t for t in old_triples if t in css]
remain_hex = [
    h for h in HEX_MAP if h.lower() in css
]
print(f"css bytes: {orig_len} -> {len(css)}")
print(f"hex replacements: {hex_hits}, rgba replacements: {rgba_hits}")
print(f"remaining old rgba triples: {remain or 'none'}")
print(f"remaining old hex literals: {remain_hex or 'none'}")
print(f"line count: {css.count(chr(10)) + 1}")

CSS_PATH.write_text(css, encoding="utf-8")
print("written", CSS_PATH)
