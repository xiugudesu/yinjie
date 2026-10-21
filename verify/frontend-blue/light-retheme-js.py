# -*- coding: utf-8 -*-
"""v3.1 light retheme for js/app.js + audio.js header + index.html brand/favicon."""
import pathlib
import re

ROOT = pathlib.Path("src/main/resources/static")
JS = ROOT / "js/app.js"
AUDIO = ROOT / "js/audio.js"
HTML = ROOT / "index.html"

js = JS.read_text(encoding="utf-8")


def sub(old, new, text, count=1, name=""):
    if text.count(old) < count:
        raise SystemExit(f"pattern missing ({name or old[:60]!r}) count={text.count(old)}")
    return text.replace(old, new, count)


# --------------------------------------------------------------- COLORS ------
OLD_COLORS = """  var COLORS = {
    bg: "#04121a",
    panel: "#0a2230",
    panel2: "#0e2b39",
    panelActive: "#174653",
    board: "#0d2933",
    boardEdge: "#1e5b68",
    text: "#e8f6f3",
    muted: "#a6c6ca",
    mutedDark: "#74959c",
    primary: "#4df0c8",
    primaryDark: "#0f766e",
    accent: "#b6f36a",
    accentHover: "#d3ff9c",
    blue: "#38cee8",
    good: "#34d399",
    bad: "#fb7185",
    warning: "#fbbf24",
    line: "#1c4452",
    focus: "#7dd3fc",
    brass: "#8fc6d4",
    paper: "#dff8f2",
    shadow: "#020a0e"
  };"""
NEW_COLORS = """  // v3.1 浅色主题：与 css/app.css 的 :root 颜色 token 逐值一致，
  // 保证 legend / CAGED 图例与 canvas 内的圆点、琴弦上色完全同步。
  var COLORS = {
    bg: "#eef8f5",
    panel: "#ffffff",
    panel2: "#f2fbf8",
    panelActive: "#d9ece6",
    board: "#f2fbf9",
    boardEdge: "#bfdcd5",
    text: "#083b3a",
    muted: "#3f6b6b",
    mutedDark: "#35615f",
    primary: "#0d9488",
    primaryDark: "#115e59",
    accent: "#059669",
    accentHover: "#10b981",
    blue: "#0284c7",
    good: "#047857",
    bad: "#e11d48",
    warning: "#b45309",
    line: "#cfe6e1",
    focus: "#0284c7",
    brass: "#8fb2ac",
    paper: "#466a6e",
    shadow: "#0f3f42"
  };"""
js = sub(OLD_COLORS, NEW_COLORS, js, name="COLORS")

OLD_CAGED = """  var CAGED_SHAPE_COLORS = {
    C: "#2dd4bf",
    A: "#34d399",
    G: "#a3e635",
    E: "#22d3ee",
    D: "#38bdf8"
  };"""
NEW_CAGED = """  var CAGED_SHAPE_COLORS = {
    C: "#0d9488",
    A: "#059669",
    G: "#65a30d",
    E: "#0891b2",
    D: "#2563eb"
  };"""
js = sub(OLD_CAGED, NEW_CAGED, js, name="CAGED_SHAPE_COLORS")

js = sub(
    '  // 亮色圆点/按钮上的深色墨色文字（与 CSS 中 #04201c 一致）\n'
    '  var INK_DARK = "#04201c";',
    '  // 深色圆点/按钮上的反白文字（浅色主题下强调色都是中深色，用白字）\n'
    '  var INK_DARK = "#ffffff";',
    js,
    name="INK_DARK",
)

# ------------------------------------------------------------ draw() ---------
js = sub(
    '    ctx.shadowColor = "rgba(0,0,0,0.55)";\n'
    '    ctx.shadowBlur = 20;\n'
    '    ctx.shadowOffsetY = 8;',
    '    ctx.shadowColor = "rgba(15,63,66,0.24)";\n'
    '    ctx.shadowBlur = 18;\n'
    '    ctx.shadowOffsetY = 6;',
    js,
    name="board shadow",
)
js = sub(
    "ctx.fillStyle = blendColor(COLORS.board, COLORS.panelActive, 0.1 + (band % 3) * 0.035);",
    "ctx.fillStyle = blendColor(COLORS.board, COLORS.boardEdge, 0.12 + (band % 3) * 0.04);",
    js,
    name="grain",
)
js = sub(
    '    sheen.addColorStop(0, "rgba(223,248,242,0.06)");\n'
    '    sheen.addColorStop(0.42, "rgba(223,248,242,0.0)");\n'
    '    sheen.addColorStop(1, "rgba(2,10,14,0.28)");',
    '    sheen.addColorStop(0, "rgba(255,255,255,0.58)");\n'
    '    sheen.addColorStop(0.46, "rgba(255,255,255,0.0)");\n'
    '    sheen.addColorStop(1, "rgba(15,63,66,0.05)");',
    js,
    name="sheen",
)
js = sub(
    '        ctx.shadowColor = "rgba(0,0,0,0.6)";\n'
    "        ctx.shadowBlur = 6;\n"
    "        ctx.shadowOffsetY = 2;",
    '        ctx.shadowColor = "rgba(15,63,66,0.25)";\n'
    "        ctx.shadowBlur = 6;\n"
    "        ctx.shadowOffsetY = 2;",
    js,
    name="nut shadow",
)
js = sub(
    '        ctx.strokeStyle = "rgba(2,10,14,0.5)";',
    '        ctx.strokeStyle = "rgba(15,63,66,0.12)";',
    js,
    name="fret shadow",
)
js = sub(
    "ctx.fillStyle = rgba(COLORS.blue, 0.82);",
    "ctx.fillStyle = rgba(COLORS.blue, 0.5);",
    js,
    name="inlay",
)
js = sub(
    '      ctx.strokeStyle = "rgba(2,10,14,0.6)";\n'
    "      ctx.lineWidth = thickness + 2;",
    '      ctx.strokeStyle = "rgba(15,63,66,0.22)";\n'
    "      ctx.lineWidth = thickness + 2;",
    js,
    name="string shadow",
)
js = sub(
    '    ctx.strokeStyle = "rgba(223,248,242,0.08)";',
    '    ctx.strokeStyle = "rgba(255,255,255,0.78)";',
    js,
    name="rim highlight",
)
js = sub(
    'ctx.fillStyle = fretNumber === 0 ? "rgba(116,149,156,0.85)" : "rgba(166,198,202,0.82)";',
    'ctx.fillStyle = fretNumber === 0 ? "rgba(15,118,110,0.9)" : "rgba(53,97,95,0.72)";',
    js,
    name="fret numbers",
)
js = sub(
    'ctx.fillStyle = labelHover ? COLORS.focus : "rgba(166,198,202,0.9)";',
    'ctx.fillStyle = labelHover ? COLORS.focus : "rgba(63,107,107,0.95)";',
    js,
    name="string labels",
)

# ------------------------------------------------------ drawNoteMarker() -----
js = sub(
    '    ctx.shadowColor = "rgba(2,10,14,0.6)";\n'
    "    ctx.shadowBlur = 5;\n"
    "    ctx.shadowOffsetY = 1.5;",
    '    ctx.shadowColor = "rgba(15,63,66,0.22)";\n'
    "    ctx.shadowBlur = 5;\n"
    "    ctx.shadowOffsetY = 1.5;",
    js,
    name="marker shadow",
)
js = sub(
    '      fill = "rgba(223,248,242,0.08)";\n'
    '      stroke = "rgba(166,198,202,0.42)";\n'
    '      textColor = "rgba(166,198,202,0.85)";',
    '      fill = "rgba(15,63,66,0.055)";\n'
    '      stroke = "rgba(53,97,95,0.32)";\n'
    '      textColor = "rgba(53,97,95,0.78)";',
    js,
    name="non-scale marker",
)
js = sub(
    '      ctx.strokeStyle = "rgba(2,10,14,0.8)";\n'
    "      ctx.lineWidth = 2;",
    '      ctx.strokeStyle = "rgba(255,255,255,0.92)";\n'
    "      ctx.lineWidth = 2;",
    js,
    name="selected ring",
)
js = sub(
    "    } else if (isSelected && cell.isRoot) {\n"
    "      ctx.strokeStyle = COLORS.primary;",
    "    } else if (isSelected && cell.isRoot) {\n"
    '      ctx.strokeStyle = "rgba(255,255,255,0.95)";',
    js,
    name="selected root ring",
)
js = sub(
    "      ctx.strokeStyle = rgba(COLORS.bg, 0.85);",
    '      ctx.strokeStyle = "rgba(255,255,255,0.95)";',
    js,
    name="default marker ring",
)
js = sub(
    "ctx.fillStyle = cell.isRoot ? rgba(INK_DARK, 0.78) : textColor;",
    'ctx.fillStyle = cell.isRoot ? "rgba(255,255,255,0.82)" : textColor;',
    js,
    name="root secondary text",
)
js = sub(
    "      ctx.strokeStyle = rgba(COLORS.focus, 0.9);",
    '      ctx.strokeStyle = "rgba(2,132,199,0.95)";',
    js,
    name="hover ring",
)

# ----------------------------------------------------- drawCagedLayer() ------
js = sub(
    '      ctx.fillStyle = "rgba(223,248,242,0.85)";',
    '      ctx.fillStyle = "rgba(15,63,66,0.85)";',
    js,
    name="caged loading text",
)
js = sub(
    "      ctx.fillStyle = rgba(shapeColor, isSingle ? 0.15 : 0.07);\n"
    "      ctx.fill();\n"
    "      ctx.strokeStyle = rgba(shapeColor, isSingle ? 0.92 : 0.5);",
    "      ctx.fillStyle = rgba(shapeColor, isSingle ? 0.14 : 0.09);\n"
    "      ctx.fill();\n"
    "      ctx.strokeStyle = rgba(shapeColor, isSingle ? 0.85 : 0.42);",
    js,
    name="caged window alpha",
)
js = sub(
    "      ctx.fillStyle = rgba(COLORS.bg, 0.72);\n"
    "      ctx.fill();\n"
    "      ctx.strokeStyle = rgba(shapeColor, isSingle ? 0.92 : 0.55);\n"
    "      ctx.lineWidth = 1;\n"
    "      ctx.stroke();\n"
    "      ctx.fillStyle = rgba(shapeColor, 0.98);",
    "      ctx.fillStyle = rgba(COLORS.bg, 0.86);\n"
    "      ctx.fill();\n"
    "      ctx.strokeStyle = rgba(shapeColor, isSingle ? 0.85 : 0.5);\n"
    "      ctx.lineWidth = 1;\n"
    "      ctx.stroke();\n"
    "      ctx.fillStyle = blendColor(shapeColor, COLORS.text, 0.45);",
    js,
    name="caged label chip",
)

# ----------------------------------------------------- drawCagedTone() ------
js = sub(
    '    ctx.shadowColor = "rgba(2,10,14,0.65)";',
    '    ctx.shadowColor = "rgba(15,63,66,0.26)";',
    js,
    name="caged tone shadow",
)
js = sub(
    "    ctx.strokeStyle = rgba(COLORS.bg, 0.9);\n"
    "    ctx.lineWidth = 2;",
    '    ctx.strokeStyle = "rgba(255,255,255,0.95)";\n'
    "    ctx.lineWidth = 2;",
    js,
    name="caged tone ring",
)
js = sub(
    "      ctx.strokeStyle = rgba(COLORS.paper, 0.9);",
    '      ctx.strokeStyle = "rgba(13,148,136,0.85)";',
    js,
    name="caged root halo",
)

JS.write_text(js, encoding="utf-8")

# ------------------------------------------------------------- audio.js -----
audio = AUDIO.read_text(encoding="utf-8")
audio = sub(
    "yinjie · 音阶指板工坊 — WebAudio pluck synthesis",
    "yinjie · 音阶指板工坊 — WebAudio pluck synthesis",
    audio,
    name="audio header sanity",
)
AUDIO.write_text(audio, encoding="utf-8")

# -------------------------------------------------------------- index.html ---
html = HTML.read_text(encoding="utf-8")
html = sub('<meta name="color-scheme" content="dark">',
           '<meta name="color-scheme" content="light">', html, name="color-scheme")
html = sub(
    "%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%2304121a'/%3E"
    "%3Cpath%20d='M32%208c10%200%2017%207%2017%2016%200%207-5%2012-5%2018%200%208-5%2012-12%2012s-12-4-12-12c0-6-5-11-5-18%200-9%207-16%2017-16z'%20fill='%234df0c8'/%3E"
    "%3Cpath%20d='M18%2026h28M19%2033h26M21%2040h22M24%2047h16'%20stroke='%23dff8f2'",
    "%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%23eef8f5'/%3E"
    "%3Cpath%20d='M32%208c10%200%2017%207%2017%2016%200%207-5%2012-5%2018%200%208-5%2012-12%2012s-12-4-12-12c0-6-5-11-5-18%200-9%207-16%2017-16z'%20fill='%230f766e'/%3E"
    "%3Cpath%20d='M18%2026h28M19%2033h26M21%2040h22M24%2047h16'%20stroke='%23f4fcf9'",
    html,
    name="favicon",
)
html = sub(
    '<stop offset="0%" stop-color="#5ff5d8"></stop>\n'
    '                <stop offset="100%" stop-color="#14b8a6"></stop>',
    '<stop offset="0%" stop-color="#14b8a6"></stop>\n'
    '                <stop offset="100%" stop-color="#0f766e"></stop>',
    html,
    name="logo gradient",
)
html = sub('stroke="#dff8f2" stroke-width="1.7"',
           'stroke="#f4fcf9" stroke-width="1.7"', html, name="logo strings")
html = sub('<circle cx="22" cy="15.4" r="2.2" fill="#04201c"></circle>',
           '<circle cx="22" cy="15.4" r="2.2" fill="#0b3f3a"></circle>',
           html, name="logo dot")
HTML.write_text(html, encoding="utf-8")

print("app.js patched")
print("index.html patched")
