/* ==========================================================================
   yinjie · 音阶指板工坊 — front-end application
   Vanilla JS. Talks to the Spring Boot JSON API; owns the canvas fretboard,
   the selection state and the chord/scale panels. No external dependencies.
   COLORS below mirror css/app.css :root tokens 1:1 (canvas markers, legend
   and panels therefore always agree).
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------------ */

  var API = {
    options: "/api/options",
    fretboard: "/api/fretboard",
    identify: "/api/chord/identify",
    caged: "/api/caged",
    shutdown: "/api/shutdown"
  };

  var BOARD = {
    left: 78,
    right: 26,
    top: 44,
    bottomPad: 82,
    boardPad: 18
  };

  var INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

  var FONT_UI = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';
  var FONT_MONO = '"Cascadia Mono", Consolas, "SFMono-Regular", monospace';

  // v3.1 浅色主题：与 css/app.css 的 :root 颜色 token 逐值一致，
  // 保证 legend / CAGED 图例与 canvas 内的圆点、琴弦上色完全同步。
  var COLORS = {
    bg: "#eef8f5",
    panel: "#ffffff",
    panel2: "#f2fbf8",
    panelActive: "#d9ece6",
    board: "#e9f6f2",
    boardEdge: "#b3d5cd",
    text: "#083b3a",
    muted: "#3f6b6b",
    mutedDark: "#35615f",
    primary: "#0f766e",
    primaryDark: "#115e59",
    accent: "#047857",
    accentHover: "#059669",
    blue: "#0369a1",
    good: "#047857",
    bad: "#e11d48",
    warning: "#b45309",
    line: "#cfe6e1",
    focus: "#0284c7",
    brass: "#8fb2ac",
    paper: "#466a6e",
    shadow: "#0f3f42"
  };

  // CAGED 五形状配色：与 css/app.css 的 --caged-c/a/g/e/d 一一对应，
  // 使图例渐变、把位窗口描边与琴弦上的五音上色完全一致。
  var CAGED_SHAPE_COLORS = {
    C: "#0d9488",
    A: "#059669",
    G: "#65a30d",
    E: "#0891b2",
    D: "#2563eb"
  };
  var CAGED_SHAPE_ORDER = ["C", "A", "G", "E", "D"];

  // 深色圆点/按钮上的反白文字（浅色主题下强调色都是中深色，用白字）
  var INK_DARK = "#ffffff";

  var DEFAULT_HOVER_TEXT = "悬停查看音名与级数，点击品格即可加入和弦识别。";
  var SCALE_HOVER_TEXT = "音阶模式：悬停查看音名与级数，点击品格试听该音。";
  var CAGED_HOVER_TEXT = "CAGED 模式：高亮把位窗口，根音 / 三音 / 五音以强调色标出。";
  var SHUTDOWN_TEXT = "本地后端服务正在关闭，现在可以关闭此页面了。";

  var TUNING_NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  var CUSTOM_TUNING_VALUE = "__custom__";

  var DISPLAY_MODES = { notes: "notes", degrees: "degrees", both: "both" };

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */

  var state = {
    options: null,
    fretboard: null,
    cellMap: null,
    geom: null,
    rootName: "C",
    scaleId: "major",
    fretFrom: 0,
    fretTo: 24,
    accidental: "auto",
    resolvedAccidental: "sharp",
    displayMode: DISPLAY_MODES.both,
    equalSpacing: false,
    showNonScale: false,
    soundOn: true,
    selected: new Map(),
    roles: new Map(),
    identify: null,
    focus: { string: 0, fret: 0 },
    hasFocus: false,
    hover: null,
    bootstrapped: false,
    mode: "scale",
    tuningId: null,
    tuningParam: null,
    tuningName: "标准调弦",
    tuningPresets: [],
    tuningSupported: false,
    cagedView: "overview",
    cagedPart: "all",
    caged: null,
    cagedError: false,
    cagedSeq: 0,
    customDraft: null,
    shutdown: false
  };

  var els = {};
  var fretboardSeq = 0;
  var identifySeq = 0;
  var identifyTimer = null;
  var drawFrame = null;
  var toastTimer = null;
  var identifyPending = false;
  var lastStrumKey = null;
  var hasUserGesture = false;

  /* ------------------------------------------------------------------------
     Tiny DOM helpers
     ------------------------------------------------------------------------ */

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  }

  function clearNode(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function append(parent) {
    for (var index = 1; index < arguments.length; index += 1) {
      var child = arguments[index];
      if (child) {
        parent.appendChild(child);
      }
    }
    return parent;
  }

  function sectionLabel(text) {
    return el("div", "section-label", text);
  }

  function roundRectPath(ctx, x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function blendColor(fromHex, toHex, amount) {
    var a = parseHex(fromHex);
    var b = parseHex(toHex);
    var t = Math.max(0, Math.min(1, amount));
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  function parseHex(hex) {
    var value = String(hex).replace("#", "");
    if (value.length === 3) {
      value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rgba(hex, alpha) {
    var c = parseHex(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + alpha + ")";
  }

  function cellKey(stringIndex, fret) {
    return stringIndex + ":" + fret;
  }

  /* ------------------------------------------------------------------------
     Status / error / toast
     ------------------------------------------------------------------------ */

  function setStatus(mode, text) {
    if (!els.statusBadge) {
      return;
    }
    els.statusBadge.classList.remove("is-loading", "is-ok", "is-error");
    if (mode) {
      els.statusBadge.classList.add("is-" + mode);
    }
    els.statusText.textContent = text;
  }

  function showError(message) {
    els.errorText.textContent = message;
    els.errorBanner.hidden = false;
  }

  function hideError() {
    els.errorBanner.hidden = true;
    els.errorText.textContent = "";
  }

  function errorDetail(error) {
    if (!error || !error.message) {
      return "";
    }
    var message = String(error.message);
    if (/failed to fetch|networkerror|load failed|network error/i.test(message)) {
      return "";
    }
    if (message.length > 120) {
      message = message.slice(0, 117) + "…";
    }
    return "（" + message + "）";
  }

  function showToast(message, isError) {
    if (!els.toast) {
      return;
    }
    els.toast.textContent = message;
    els.toast.classList.toggle("is-error", !!isError);
    els.toast.hidden = false;
    window.requestAnimationFrame(function () {
      els.toast.classList.add("is-visible");
    });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
      window.setTimeout(function () {
        if (!els.toast.classList.contains("is-visible")) {
          els.toast.hidden = true;
        }
      }, 260);
    }, 2300);
  }

  function setCanvasOverlay(visible, text, spinning) {
    if (!els.canvasOverlay) {
      return;
    }
    els.canvasOverlay.hidden = !visible;
    if (text) {
      els.canvasOverlayText.textContent = text;
    }
    var spinner = els.canvasOverlay.querySelector(".spinner");
    if (spinner) {
      spinner.style.display = spinning === false ? "none" : "";
    }
  }

  /* ------------------------------------------------------------------------
     Options bootstrap
     ------------------------------------------------------------------------ */

  async function loadOptions() {
    setStatus("loading", "正在连接…");
    hideError();
    setCanvasOverlay(true, "正在载入音阶…", true);
    els.rootSelect.disabled = true;
    els.scaleSelect.disabled = true;

    trippedAudio();

    try {
      var response = await fetch(API.options, { headers: { Accept: "application/json" } });
      var payload = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : "HTTP " + response.status);
      }
      if (!payload || !Array.isArray(payload.roots) || !Array.isArray(payload.scales) || !payload.scales.length) {
        throw new Error("返回数据缺少根音或音阶列表");
      }
      state.options = payload;
      applyOptions(payload);
      setStatus("loading", "正在载入指板…");
      await loadFretboard();
    } catch (error) {
      setStatus("error", "连接失败");
      showError(
        "无法连接后端服务（GET /api/options）。请确认 Spring Boot 已启动于 http://127.0.0.1:8090，然后点击「重新连接」。" +
          errorDetail(error)
      );
      setCanvasOverlay(true, "无法载入数据，请确认后端服务已启动", false);
    }
  }

  function trippedAudio() {
    if (!window.FretAudio) {
      if (els.soundToggle) {
        els.soundToggle.checked = false;
        els.soundToggle.disabled = true;
      }
      return;
    }
    window.FretAudio.setEnabled(state.soundOn);
  }

  /* ------------------------------------------------------------------------
     Tuning helpers
     ------------------------------------------------------------------------ */

  function normalizeAccidental(text) {
    return String(text || "")
      .replace(/♯/g, "#")
      .replace(/♭/g, "b");
  }

  function parseTuningParam(param) {
    if (!param || typeof param !== "string") {
      return null;
    }
    var parts = normalizeAccidental(param).split(",");
    if (parts.length !== 6) {
      return null;
    }
    var parsed = [];
    for (var index = 0; index < parts.length; index += 1) {
      var match = /^\s*([A-Ga-g])([#b]?)(-?\d+)\s*$/.exec(parts[index]);
      if (!match) {
        return null;
      }
      parsed.push({
        name: match[1].toUpperCase() + match[2],
        octave: Number(match[3])
      });
    }
    return parsed;
  }

  function formatTuningString(items) {
    return items
      .map(function (item) {
        return item.name + item.octave;
      })
      .join(",");
  }

  function findTuningPreset(id) {
    var presets = state.tuningPresets || [];
    for (var index = 0; index < presets.length; index += 1) {
      if (presets[index].id === id) {
        return presets[index];
      }
    }
    return null;
  }

  function buildTuningSelect() {
    if (!els.tuningSelect) {
      return;
    }
    clearNode(els.tuningSelect);
    state.tuningPresets.forEach(function (preset) {
      var option = el("option", null, preset.name || preset.id);
      option.value = preset.id;
      if (preset.english) {
        option.title = preset.english;
      }
      els.tuningSelect.appendChild(option);
    });
    var custom = el("option", null, "自定义…");
    custom.value = CUSTOM_TUNING_VALUE;
    els.tuningSelect.appendChild(custom);
    if (state.tuningId) {
      els.tuningSelect.value = state.tuningId;
    }
  }

  function setTuningPreset(preset) {
    if (!preset) {
      return;
    }
    state.tuningId = preset.id;
    state.tuningParam = preset.tuningParam || null;
    state.tuningName = preset.name || preset.id;
    if (els.tuningSelect) {
      els.tuningSelect.value = preset.id;
    }
    closeTuningEditor();
    updateTuningUi();
    refreshFretboard();
    refreshCaged(true);
  }

  function updateTuningUi() {
    if (els.tuningText) {
      els.tuningText.textContent = state.tuningName;
    }
    if (els.tuningChip) {
      els.tuningChip.title = "当前调弦：" + state.tuningName;
    }
    if (els.footerTuning) {
      var names = activeStrings()
        .map(function (item) {
          return item.openName;
        })
        .join("–");
      els.footerTuning.textContent = state.tuningName + (names ? " " + names : "");
    }
  }

  /**
   * Strings used for the fretboard gutter labels. When the backend has not yet
   * applied the requested tuning (older API), the labels still reflect the
   * user's choice; once v2 is live both agree.
   */
  function activeStrings() {
    var parsed = parseTuningParam(state.tuningParam);
    var payloadStrings = state.fretboard && Array.isArray(state.fretboard.strings) ? state.fretboard.strings : [];
    if (parsed && parsed.length === 6) {
      return parsed.map(function (item, index) {
        return {
          index: index,
          number: 6 - index,
          openName: item.name,
          octave: item.octave
        };
      });
    }
    return payloadStrings;
  }

  function syncTuningFromOptions(options, isFirstLoad) {
    state.tuningPresets = Array.isArray(options.tunings) ? options.tunings : [];
    state.tuningSupported = state.tuningPresets.some(function (preset) {
      return typeof preset.tuningParam === "string" && preset.tuningParam.length > 0;
    });
    var wanted = !isFirstLoad && state.tuningId && state.tuningId !== CUSTOM_TUNING_VALUE ? state.tuningId : null;
    var preset = wanted ? findTuningPreset(wanted) : null;
    if (!preset) {
      var defaultId = options.defaultTuning;
      preset = (defaultId && findTuningPreset(defaultId)) || state.tuningPresets[0] || null;
    }
    if (preset) {
      state.tuningId = preset.id;
      state.tuningParam = preset.tuningParam || null;
      state.tuningName = preset.name || preset.id;
    } else if (!state.tuningId) {
      state.tuningId = "standard";
      state.tuningParam = "E2,A2,D3,G3,B3,E4";
      state.tuningName = "标准调弦";
    }
    buildTuningSelect();
    updateTuningUi();
  }

  function refreshFretboardSafe() {
    invalidateIdentify();
    refreshFretboard();
  }

  function applyOptions(options) {
    var roots = options.roots;
    var scales = options.scales;
    var defaults = options.defaults || {};

    clearNode(els.rootSelect);
    roots.forEach(function (root) {
      var option = el("option", null, root.name);
      option.value = root.name;
      els.rootSelect.appendChild(option);
    });

    clearNode(els.scaleSelect);
    var groups = new Map();
    scales.forEach(function (scale) {
      var category = scale.category || "其他";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category).push(scale);
    });
    groups.forEach(function (items, category) {
      var group = el("optgroup");
      group.label = category;
      items.forEach(function (scale) {
        var option = el("option", null, scale.name || scale.id);
        option.value = scale.id;
        group.appendChild(option);
      });
      els.scaleSelect.appendChild(group);
    });

    var range = options.fretRange || {};
    var minFret = typeof range.min === "number" ? range.min : 0;
    var maxFret = typeof range.max === "number" ? range.max : 24;
    var isFirstLoad = !state.bootstrapped;

    // Keep the user's current context when the options are reloaded (e.g. after
    // a failed request + "重新连接"); only the very first load uses the defaults.
    var wantedRoot = isFirstLoad ? defaults.rootName : state.rootName;
    var wantedScale = isFirstLoad ? defaults.scaleId : state.scaleId;
    var wantedFrom =
      isFirstLoad && typeof defaults.fretFrom === "number" ? defaults.fretFrom : state.fretFrom;
    var wantedTo = isFirstLoad && typeof defaults.fretTo === "number" ? defaults.fretTo : state.fretTo;

    var scaleExists = scales.some(function (scale) {
      return scale.id === wantedScale;
    });
    var rootExists = roots.some(function (root) {
      return root.name === wantedRoot;
    });

    state.rootName = rootExists && wantedRoot ? wantedRoot : roots[0].name;
    state.scaleId = scaleExists && wantedScale ? wantedScale : scales[0].id;
    state.fretFrom = clamp(typeof wantedFrom === "number" ? wantedFrom : minFret, minFret, maxFret);
    state.fretTo = clamp(typeof wantedTo === "number" ? wantedTo : maxFret, minFret, maxFret);
    if (state.fretTo < state.fretFrom) {
      var swap = state.fretFrom;
      state.fretFrom = state.fretTo;
      state.fretTo = swap;
    }
    if (isFirstLoad && defaults.accidental) {
      state.accidental = defaults.accidental;
    }

    els.rootSelect.value = state.rootName;
    els.scaleSelect.value = state.scaleId;
    els.rootSelect.disabled = false;
    els.scaleSelect.disabled = false;

    syncRangeButtons();
    syncTuningFromOptions(options, isFirstLoad);

    state.focus = {
      string: 0,
      fret: clamp(3, state.fretFrom, state.fretTo)
    };

    state.bootstrapped = true;
  }

  /* ------------------------------------------------------------------------
     Fretboard data
     ------------------------------------------------------------------------ */

  async function loadFretboard() {
    var seq = (fretboardSeq += 1);
    if (!state.fretboard) {
      setCanvasOverlay(true, "正在计算指板…", true);
    }
    setStatus("loading", "正在载入指板…");
    invalidateIdentify();

    var params = new URLSearchParams();
    params.set("rootName", state.rootName);
    params.set("scaleId", state.scaleId);
    params.set("fretFrom", String(state.fretFrom));
    params.set("fretTo", String(state.fretTo));
    params.set("accidental", state.accidental || "auto");
    if (state.tuningParam) {
      params.set("tuning", state.tuningParam);
    }

    try {
      var response = await fetch(API.fretboard + "?" + params.toString(), {
        headers: { Accept: "application/json" }
      });
      var payload = await response.json().catch(function () {
        return null;
      });
      if (seq !== fretboardSeq) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : "HTTP " + response.status);
      }
      if (!payload || !Array.isArray(payload.cells) || !Array.isArray(payload.strings)) {
        throw new Error("指板数据不完整");
      }
      applyFretboard(payload);
      hideError();
      setStatus("ok", "已连接");
      setCanvasOverlay(false);
      scheduleIdentify();
      refreshCaged(true);
    } catch (error) {
      if (seq !== fretboardSeq) {
        return;
      }
      setStatus("error", "载入失败");
      showError("无法加载指板数据（GET /api/fretboard）。后端返回异常或音阶参数无效。" + errorDetail(error));
      setCanvasOverlay(true, "指板数据加载失败", false);
      renderChordError("指板数据加载失败，请重试或点击「重新连接」。");
    }
  }

  function applyFretboard(payload) {
    state.fretboard = payload;
    state.resolvedAccidental = payload.accidental || "auto";
    state.rootName = payload.rootName || state.rootName;

    var map = new Map();
    var frets = [];
    payload.cells.forEach(function (cell) {
      if (!cell) {
        return;
      }
      map.set(cellKey(cell.string, cell.fret), cell);
      if (frets.indexOf(cell.fret) === -1 && cell.fret >= state.fretFrom && cell.fret <= state.fretTo) {
        frets.push(cell.fret);
      }
    });
    state.cellMap = map;

    // Drop selections that are no longer renderable in the current fret window.
    var self = state.selected;
    Array.from(self.keys()).forEach(function (key) {
      var parts = key.split(":");
      var fret = Number(parts[1]);
      if (!map.has(key) || fret < state.fretFrom || fret > state.fretTo) {
        self.delete(key);
        state.roles.delete(key);
      }
    });

    state.focus.fret = clamp(state.focus.fret, state.fretFrom, state.fretTo);
    state.focus.string = clamp(state.focus.string, 0, (payload.strings.length || 6) - 1);

    renderScaleCard(payload);
    updateFretboardSub(payload);
    updateSelectionChrome();
    updateHoverDefault();
    updateCanvasAriaLabel();
    scheduleDraw();
  }

  function updateFretboardSub(payload) {
    var scale = payload.scale || {};
    var suffix = "";
    if (isCagedActive()) {
      suffix = state.cagedError
        ? " · CAGED 数据暂不可用"
        : " · CAGED " + (state.cagedPart === "all" ? "全部形状" : state.cagedPart + " 形状");
    } else if (state.mode === "scale") {
      suffix = " · 音阶模式";
    }
    els.fretboardSub.textContent =
      (scale.name || "音阶") +
      " · 根音 " +
      (payload.rootName || state.rootName) +
      " · " +
      state.fretFrom +
      "–" +
      state.fretTo +
      " 品" +
      suffix;
  }

  /* ------------------------------------------------------------------------
     Geometry
     ------------------------------------------------------------------------ */

  function buildGeometry(width, height) {
    var strings = state.fretboard && Array.isArray(state.fretboard.strings) ? state.fretboard.strings : [];
    var stringCount = strings.length || 6;
    var left = BOARD.left;
    var top = BOARD.top;
    var boardHeight = Math.max(height - BOARD.bottomPad, 1);
    var boardWidth = Math.max(width - left - BOARD.right, 1);

    var frets = [];
    for (var fret = state.fretFrom; fret <= state.fretTo; fret += 1) {
      frets.push(fret);
    }
    if (!frets.length) {
      frets = [state.fretFrom];
    }

    var weights = frets.map(function (item) {
      if (state.equalSpacing) {
        return 1;
      }
      if (item === 0) {
        return (1 - Math.pow(2, -1 / 12)) * 0.72;
      }
      return Math.pow(2, -(item - 1) / 12) - Math.pow(2, -item / 12);
    });
    var total = weights.reduce(function (sum, item) {
      return sum + item;
    }, 0);
    if (!(total > 0)) {
      total = 1;
    }

    var boundaries = [left];
    for (var index = 0; index < frets.length; index += 1) {
      boundaries.push(boundaries[index] + (boardWidth * weights[index]) / total);
    }
    boundaries[boundaries.length - 1] = left + boardWidth;

    var gap = (boardHeight * 0.86) / Math.max(1, stringCount - 1);
    var centerY = top + boardHeight / 2;

    return {
      left: left,
      top: top,
      right: BOARD.right,
      boardHeight: boardHeight,
      boardWidth: boardWidth,
      boardTop: top - BOARD.boardPad,
      boardLeft: left,
      boardW: boardWidth,
      boardH: boardHeight + BOARD.boardPad * 2,
      frets: frets,
      boundaries: boundaries,
      gap: gap,
      centerY: centerY,
      stringCount: stringCount,
      stringY: function (stringIndex) {
        return centerY + (stringCount - 1 - stringIndex - (stringCount - 1) / 2) * gap;
      },
      colWidth: function (columnIndex) {
        return boundaries[columnIndex + 1] - boundaries[columnIndex];
      },
      colCenter: function (columnIndex) {
        return (boundaries[columnIndex] + boundaries[columnIndex + 1]) / 2;
      }
    };
  }

  /* ------------------------------------------------------------------------
     Drawing
     ------------------------------------------------------------------------ */

  function scheduleDraw() {
    if (drawFrame !== null) {
      return;
    }
    drawFrame = window.requestAnimationFrame(function () {
      drawFrame = null;
      draw();
    });
  }

  function draw() {
    var canvas = els.canvas;
    if (!canvas) {
      return;
    }
    var rect = els.canvasWrap.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width));
    var height = Math.max(1, Math.round(rect.height));
    var dpr = window.devicePixelRatio || 1;
    var pixelWidth = Math.round(width * dpr);
    var pixelHeight = Math.round(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var geom = buildGeometry(width, height);
    state.geom = geom;

    if (!state.fretboard || !state.cellMap) {
      return;
    }

    var boardX = geom.boardLeft;
    var boardY = geom.boardTop;
    var boardW = geom.boardW;
    var boardH = geom.boardH;

    /* --- board slab + shadow ------------------------------------------- */
    ctx.save();
    ctx.shadowColor = "rgba(15,63,66,0.24)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    roundRectPath(ctx, boardX, boardY, boardW, boardH, 10);
    ctx.fillStyle = COLORS.board;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, boardX, boardY, boardW, boardH, 10);
    ctx.clip();

    // grain bands (reference: 9 vertical bands blended toward panel_active)
    var grainHeight = (geom.boardHeight + 32) / 9;
    for (var band = 0; band < 9; band += 1) {
      var bandY = geom.top - 16 + band * grainHeight;
      ctx.fillStyle = blendColor(COLORS.board, COLORS.boardEdge, 0.12 + (band % 3) * 0.04);
      ctx.fillRect(boardX + 3, bandY, boardW - 6, grainHeight + 1);
    }

    // cool sheen toward the light source
    var sheen = ctx.createLinearGradient(0, boardY, 0, boardY + boardH);
    sheen.addColorStop(0, "rgba(255,255,255,0.58)");
    sheen.addColorStop(0.46, "rgba(255,255,255,0.0)");
    sheen.addColorStop(1, "rgba(15,63,66,0.05)");
    ctx.fillStyle = sheen;
    ctx.fillRect(boardX, boardY, boardW, boardH);

    /* --- frets + nut --------------------------------------------------- */
    ctx.lineCap = "butt";
    for (var wire = 1; wire < geom.boundaries.length - 1; wire += 1) {
      var wireX = geom.boundaries[wire];
      var isNut = state.fretFrom === 0 && wire === 1;
      if (isNut) {
        ctx.save();
        ctx.shadowColor = "rgba(15,63,66,0.25)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.strokeStyle = COLORS.paper;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(wireX, boardY + 2);
        ctx.lineTo(wireX, boardY + boardH - 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = COLORS.brass;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wireX, boardY + 2);
        ctx.lineTo(wireX, boardY + boardH - 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(15,63,66,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wireX + 1.4, boardY + 2);
        ctx.lineTo(wireX + 1.4, boardY + boardH - 2);
        ctx.stroke();
      }
    }

    /* --- inlays -------------------------------------------------------- */
    ctx.save();
    ctx.fillStyle = rgba(COLORS.blue, 0.5);
    INLAY_FRETS.forEach(function (fret) {
      var column = geom.frets.indexOf(fret);
      if (column === -1) {
        return;
      }
      var dotX = geom.colCenter(column);
      var dotY = geom.top + geom.boardHeight / 2;
      if (fret === 12 || fret === 24) {
        ctx.beginPath();
        ctx.arc(dotX, dotY - 21, 4, 0, Math.PI * 2);
        ctx.arc(dotX, dotY + 21, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    /* --- strings ------------------------------------------------------- */
    for (var stringIndex = 0; stringIndex < geom.stringCount; stringIndex += 1) {
      var stringY = geom.stringY(stringIndex);
      var thickness = Math.max(1, 3.3 - stringIndex * 0.42);
      ctx.strokeStyle = "rgba(15,63,66,0.22)";
      ctx.lineWidth = thickness + 2;
      ctx.beginPath();
      ctx.moveTo(boardX, stringY + 1.4);
      ctx.lineTo(boardX + boardW, stringY + 1.4);
      ctx.stroke();
      ctx.strokeStyle = COLORS.paper;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(boardX, stringY);
      ctx.lineTo(boardX + boardW, stringY);
      ctx.stroke();
    }

    /* --- note markers -------------------------------------------------- */
    var hover = state.hover;
    for (var s = 0; s < geom.stringCount; s += 1) {
      for (var col = 0; col < geom.frets.length; col += 1) {
        var fret = geom.frets[col];
        var key = cellKey(s, fret);
        var cell = state.cellMap.get(key);
        if (!cell) {
          continue;
        }
        var isSelected = state.mode === "chord" && state.selected.has(key);
        if (!cell.inScale && !state.showNonScale && !isSelected) {
          continue;
        }
        var radius = Math.min(17, Math.max(12, geom.colWidth(col) * 0.25));
        drawNoteMarker(ctx, geom, cell, col, s, radius, isSelected, hover && hover.string === s && hover.fret === fret);
      }
    }

    drawCagedLayer(ctx, geom);

    ctx.restore();

    /* --- board rim ----------------------------------------------------- */
    ctx.save();
    roundRectPath(ctx, boardX, boardY, boardW, boardH, 10);
    ctx.strokeStyle = COLORS.boardEdge;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.78)";
    ctx.lineWidth = 1;
    roundRectPath(ctx, boardX + 2, boardY + 2, boardW - 4, boardH - 4, 8);
    ctx.stroke();
    ctx.restore();

    /* --- fret numbers above the board ---------------------------------- */
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var narrowestColumn = Infinity;
    for (var widthIndex = 0; widthIndex < geom.frets.length; widthIndex += 1) {
      narrowestColumn = Math.min(narrowestColumn, geom.colWidth(widthIndex));
    }
    var numberFont = narrowestColumn >= 22 ? 10.5 : Math.max(7.6, Math.min(10.5, narrowestColumn * 0.6));
    ctx.font = "600 " + numberFont.toFixed(1) + "px " + FONT_UI;
    for (var numberIndex = 0; numberIndex < geom.frets.length; numberIndex += 1) {
      var fretNumber = geom.frets[numberIndex];
      var numberX = geom.colCenter(numberIndex);
      ctx.fillStyle = fretNumber === 0 ? "rgba(15,118,110,0.9)" : "rgba(53,97,95,0.72)";
      ctx.fillText(String(fretNumber), numberX, geom.top - 27);
    }
    ctx.restore();

    /* --- string labels in the left gutter ------------------------------ */
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    var visibleStrings = activeStrings();
    for (var labelIndex = 0; labelIndex < visibleStrings.length; labelIndex += 1) {
      var tuningString = visibleStrings[labelIndex] || {};
      var label = (tuningString.number !== undefined ? tuningString.number : 6 - labelIndex) + "弦 " + (tuningString.openName || "");
      var labelHover = hover && hover.string === labelIndex;
      ctx.font = (labelHover ? "700 11.5px " : "600 11px ") + FONT_UI;
      ctx.fillStyle = labelHover ? COLORS.focus : "rgba(63,107,107,0.95)";
      ctx.fillText(label, geom.left - 10, geom.stringY(labelIndex));
    }
    ctx.restore();

    /* --- keyboard focus cursor ----------------------------------------- */
    if (state.hasFocus) {
      drawFocusCursor(ctx, geom);
    }
  }

  function drawNoteMarker(ctx, geom, cell, column, stringIndex, radius, isSelected, isHovered) {
    var x = geom.colCenter(column);
    var y = geom.stringY(stringIndex);
    var key = cellKey(stringIndex, geom.frets[column]);
    var fill;
    var stroke = null;
    var textColor = COLORS.text;
    var labelLines = [];
    var bold = false;

    if (isSelected) {
      var roleInfo = state.roles.get(key);
      var roleLabel = roleInfo && roleInfo.role ? roleInfo.role : "";
      if (roleLabel === "1") {
        roleLabel = "R";
      }
      if (!roleLabel) {
        roleLabel = cell.degreeLabel || cell.noteName || "";
      }
      fill = COLORS.accent;
      textColor = INK_DARK;
      labelLines = [roleLabel];
      bold = true;
      radius = radius + Math.max(2.5, radius * 0.16);
    } else if (cell.isRoot) {
      fill = COLORS.primary;
      textColor = INK_DARK;
      labelLines = markerLabelLines(cell, true);
      bold = true;
    } else if (cell.inScale) {
      fill = COLORS.blue;
      textColor = INK_DARK;
      labelLines = markerLabelLines(cell, false);
    } else {
      fill = "rgba(15,63,66,0.055)";
      stroke = "rgba(53,97,95,0.32)";
      textColor = "rgba(53,97,95,0.78)";
      labelLines = [cell.noteName || ""];
    }

    // 直接填充，不做逐个标记的 canvas shadow（一屏 140+ 个标记，shadowBlur 是悬停/拖动卡顿的主要来源之一）
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    if (isSelected && !cell.isRoot) {
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isSelected && cell.isRoot) {
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, radius + 1.6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, radius - 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // label
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = textColor;
    if (labelLines.length > 1) {
      var nameFont = clamp(radius * 0.85, 8.5, 13);
      var degreeFont = clamp(radius * 0.66, 7, 10);
      ctx.font = (bold ? "700 " : "600 ") + nameFont.toFixed(1) + "px " + FONT_UI;
      ctx.fillText(labelLines[0], x, y - (nameFont * 0.5 + 0.6));
      ctx.fillStyle = cell.isRoot ? "rgba(255,255,255,0.82)" : textColor;
      ctx.font = (bold ? "700 " : "600 ") + degreeFont.toFixed(1) + "px " + FONT_UI;
      ctx.fillText(labelLines[1], x, y + (degreeFont * 0.5 + 0.4));
    } else {
      var singleFont = clamp(radius * 1.02, 9.5, 14);
      ctx.font = (bold ? "700 " : "600 ") + singleFont.toFixed(1) + "px " + FONT_UI;
      ctx.fillText(labelLines[0] || "", x, y + 0.3);
    }
    ctx.restore();

    if (isHovered && !isSelected) {
      ctx.save();
      ctx.strokeStyle = "rgba(2,132,199,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function markerLabelLines(cell, isRoot) {
    var mode = state.displayMode;
    if (mode === DISPLAY_MODES.notes) {
      return [cell.noteName || ""];
    }
    var degree = cell.degreeLabel || "";
    if (!degree && state.showNonScale) {
      degree = cell.chromaticLabel || "";
    }
    if (mode === DISPLAY_MODES.degrees) {
      return [degree || cell.noteName || ""];
    }
    return [cell.noteName || "", degree || cell.noteName || ""];
  }

  function drawFocusCursor(ctx, geom) {
    var focused = state.focus;
    if (!focused) {
      return;
    }
    var column = geom.frets.indexOf(focused.fret);
    if (column === -1 || focused.string < 0 || focused.string >= geom.stringCount) {
      return;
    }
    var x1 = geom.boundaries[column] + 3;
    var x2 = geom.boundaries[column + 1] - 3;
    var y = geom.stringY(focused.string);
    var half = geom.gap * 0.36;
    ctx.save();
    ctx.strokeStyle = COLORS.focus;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    roundRectPath(ctx, x1, y - half, Math.max(4, x2 - x1), half * 2, 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     Hit testing / hover
     ------------------------------------------------------------------------ */

  function hitTest(clientX, clientY) {
    var geom = state.geom;
    if (!geom || !state.fretboard || !state.cellMap) {
      return null;
    }
    var rect = els.canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    if (x < geom.boundaries[0] - 1 || x > geom.boundaries[geom.boundaries.length - 1] + 1) {
      return null;
    }
    if (y < geom.boardTop || y > geom.boardTop + geom.boardH) {
      return null;
    }

    var column = -1;
    for (var index = 0; index < geom.frets.length; index += 1) {
      if (x >= geom.boundaries[index] && x <= geom.boundaries[index + 1]) {
        column = index;
        break;
      }
    }
    if (column === -1) {
      return null;
    }

    var stringIndex = 0;
    var bestDistance = Infinity;
    for (var s = 0; s < geom.stringCount; s += 1) {
      var distance = Math.abs(geom.stringY(s) - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        stringIndex = s;
      }
    }

    var fret = geom.frets[column];
    var cell = state.cellMap.get(cellKey(stringIndex, fret)) || null;
    return {
      string: stringIndex,
      fret: fret,
      cell: cell
    };
  }

  function onPointerMove(event) {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") {
      return;
    }
    var hit = hitTest(event.clientX, event.clientY);
    if (!hit) {
      if (state.hover) {
        state.hover = null;
        hideTooltip();
        updateHoverDefault();
        scheduleDraw();
      }
      return;
    }
    var changed = !state.hover || state.hover.string !== hit.string || state.hover.fret !== hit.fret;
    state.hover = { string: hit.string, fret: hit.fret, cell: hit.cell };
    updateHoverInfo(hit);
    showTooltip(event.clientX, event.clientY, hit);
    if (changed) {
      scheduleDraw();
    }
  }

  function onPointerLeave() {
    if (!state.hover) {
      return;
    }
    state.hover = null;
    hideTooltip();
    updateHoverDefault();
    scheduleDraw();
  }

  function stringNumberOfCell(hit) {
    var strings = state.fretboard && state.fretboard.strings ? state.fretboard.strings : [];
    var tuningString = strings[hit.string];
    if (tuningString && tuningString.number !== undefined) {
      return tuningString.number;
    }
    return 6 - hit.string;
  }

  function intervalNameForCell(cell) {
    if (!cell || !state.fretboard || !state.fretboard.scale) {
      return "";
    }
    var notes = state.fretboard.scale.notes || [];
    for (var index = 0; index < notes.length; index += 1) {
      if (notes[index].pitchClass === cell.pitchClass) {
        return notes[index].intervalName || "";
      }
    }
    return "";
  }

  function updateHoverInfo(hit) {
    if (!hit || !hit.cell) {
      updateHoverDefault();
      return;
    }
    var cell = hit.cell;
    var number = stringNumberOfCell(hit);
    var degree = cell.degreeLabel || cell.chromaticLabel || "—";
    var interval = intervalNameForCell(cell);
    var roleInfo = state.roles.get(cellKey(hit.string, hit.fret));

    clearNode(els.hoverInfo);
    els.hoverInfo.classList.add("is-active");
    els.hoverInfo.appendChild(document.createTextNode(number + "弦 · " + hit.fret + "品"));
    els.hoverInfo.appendChild(el("span", "info-sep", "|"));
    var noteLabel = el("b", null, cell.noteName || "—");
    els.hoverInfo.appendChild(noteLabel);
    els.hoverInfo.appendChild(document.createTextNode(" 级数 " + degree));
    if (interval) {
      els.hoverInfo.appendChild(el("span", "info-sep", "·"));
      els.hoverInfo.appendChild(document.createTextNode(interval));
    }
    if (!cell.inScale) {
      els.hoverInfo.appendChild(el("span", "info-sep", "·"));
      els.hoverInfo.appendChild(el("span", null, "音阶外音（半音级数 " + (cell.chromaticLabel || "—") + "）"));
    }
    if (roleInfo && roleInfo.roleName) {
      els.hoverInfo.appendChild(el("span", "info-sep", "·"));
      els.hoverInfo.appendChild(el("span", null, "和弦角色 " + roleInfo.roleName));
    }
  }

  function updateHoverDefault() {
    if (!els.hoverInfo) {
      return;
    }
    els.hoverInfo.classList.remove("is-active");
    clearNode(els.hoverInfo);
    if (state.mode !== "chord") {
      els.hoverInfo.textContent = isCagedActive() ? CAGED_HOVER_TEXT : SCALE_HOVER_TEXT;
      return;
    }
    if (state.selected.size) {
      els.hoverInfo.textContent =
        "已选 " + state.selected.size + " 个音 · 继续点选可补充和弦音，Esc 清空选择。";
    } else {
      els.hoverInfo.textContent = DEFAULT_HOVER_TEXT;
    }
  }

  function showTooltip(clientX, clientY, hit) {
    if (!els.tooltip || !hit || !hit.cell) {
      return;
    }
    var cell = hit.cell;
    var number = stringNumberOfCell(hit);
    var interval = intervalNameForCell(cell);
    var roleInfo = state.roles.get(cellKey(hit.string, hit.fret));

    clearNode(els.tooltip);
    els.tooltip.appendChild(el("div", "tooltip-top", "第 " + number + " 弦 · " + hit.fret + " 品"));

    var noteRow = el("div", "tooltip-note");
    noteRow.appendChild(el("b", null, cell.noteName || "—"));
    var degree = cell.degreeLabel;
    noteRow.appendChild(el("span", null, degree ? "级数 " + degree : cell.inScale ? "" : "音阶外音"));
    els.tooltip.appendChild(noteRow);

    var meta = el("div", "tooltip-meta");
    var intervalSpan = el("em", cell.inScale ? null : "is-out", interval || (cell.inScale ? "音阶内音" : "半音级数 " + (cell.chromaticLabel || "—")));
    meta.appendChild(intervalSpan);
    if (!cell.inScale) {
      meta.appendChild(document.createTextNode(" · " + (cell.chromaticLabel || "")));
    }
    els.tooltip.appendChild(meta);

    if (roleInfo && roleInfo.roleName) {
      els.tooltip.appendChild(el("div", "tooltip-role", "和弦角色 · " + roleInfo.roleName));
    }

    els.tooltip.hidden = false;
    var offsetX = 16;
    var offsetY = 18;
    var width = els.tooltip.offsetWidth;
    var height = els.tooltip.offsetHeight;
    var left = clientX + offsetX;
    var top = clientY + offsetY;
    if (left + width > window.innerWidth - 10) {
      left = clientX - width - offsetX;
    }
    if (top + height > window.innerHeight - 10) {
      top = clientY - height - offsetY;
    }
    els.tooltip.style.left = Math.max(8, left) + "px";
    els.tooltip.style.top = Math.max(8, top) + "px";
  }

  function hideTooltip() {
    if (els.tooltip) {
      els.tooltip.hidden = true;
    }
  }

  /* ------------------------------------------------------------------------
     Selection
     ------------------------------------------------------------------------ */

  function handleCellActivate(hit) {
    if (!hit || !state.fretboard) {
      return;
    }
    if (state.mode === "chord") {
      toggleCell(hit);
    } else {
      playScaleNote(hit);
    }
  }

  function toggleCell(hit) {
    if (!hit || !state.fretboard || state.mode !== "chord") {
      return;
    }
    var key = cellKey(hit.string, hit.fret);
    if (state.selected.has(key)) {
      state.selected.delete(key);
      state.roles.delete(key);
      playToggleSound(hit, false);
    } else {
      state.selected.set(key, { string: hit.string, fret: hit.fret });
      state.roles.delete(key);
      playToggleSound(hit, true);
    }
    state.focus = { string: hit.string, fret: hit.fret };
    state.hasFocus = true;
    invalidateIdentify();
    updateSelectionChrome();
    scheduleDraw();
    scheduleIdentify();
  }

  function playToggleSound(hit, added) {
    if (!state.soundOn || !window.FretAudio || !hit || !hit.cell) {
      return;
    }
    hasUserGesture = true;
    if (added) {
      window.FretAudio.pluck(hit.cell.midi, { velocity: 0.42, duration: 1.8 });
    } else {
      window.FretAudio.pluck(Math.max(28, hit.cell.midi - 12), { velocity: 0.16, duration: 0.42 });
    }
  }

  function clearSelection() {
    if (state.mode !== "chord" || !state.selected.size) {
      return;
    }
    state.selected.clear();
    state.roles.clear();
    invalidateIdentify();
    setIdentifyPending(false);
    lastStrumKey = null;
    state.identify = null;
    renderChordEmpty();
    updateSelectionChrome();
    scheduleDraw();
    showToast("已清空所选音");
  }

  function updateSelectionChrome() {
    var count = state.selected.size;
    els.clearButton.disabled = state.mode !== "chord" || count === 0;
    if (state.mode !== "chord") {
      els.chordCount.textContent = "音阶模式 · 试听音符";
    } else if (!count) {
      els.chordCount.textContent = "尚未选择音";
    } else {
      els.chordCount.textContent = "已选 " + count + " 个音";
    }
    updateHoverDefault();
    updatePlayButton();
    updateCanvasAriaLabel();
  }

  function sortedSelected() {
    var items = [];
    state.selected.forEach(function (position) {
      items.push({ string: position.string, fret: position.fret });
    });
    items.sort(function (a, b) {
      if (a.string !== b.string) {
        return a.string - b.string;
      }
      return a.fret - b.fret;
    });
    return items;
  }

  /* ------------------------------------------------------------------------
     Identify
     ------------------------------------------------------------------------ */

  function invalidateIdentify() {
    identifySeq += 1;
    identifyPending = false;
    setIdentifyPending(false);
  }

  function setIdentifyPending(pending) {
    identifyPending = pending;
    if (els.identifySpinner) {
      els.identifySpinner.hidden = !pending;
    }
  }

  function scheduleIdentify() {
    invalidateIdentify();
    if (state.mode !== "chord") {
      state.identify = null;
      state.roles.clear();
      lastStrumKey = null;
      renderModeGate();
      return;
    }
    if (!state.fretboard) {
      return;
    }
    if (!state.selected.size) {
      state.identify = null;
      state.roles.clear();
      lastStrumKey = null;
      renderChordEmpty();
      return;
    }
    window.clearTimeout(identifyTimer);
    identifyTimer = window.setTimeout(identifyNow, 30);
  }

  async function identifyNow() {
    var positions = sortedSelected();
    if (!positions.length) {
      state.identify = null;
      state.roles.clear();
      renderChordEmpty();
      return;
    }
    var seq = (identifySeq += 1);
    setIdentifyPending(true);
    var rootName = state.fretboard ? state.fretboard.rootName : state.rootName;
    var scaleId = state.fretboard && state.fretboard.scale ? state.fretboard.scale.id : state.scaleId;

    try {
      var response = await fetch(API.identify, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          positions: positions,
          scaleId: scaleId,
          rootName: rootName,
          tuning: state.tuningParam || undefined
        })
      });
      var payload = await response.json().catch(function () {
        return null;
      });
      if (seq !== identifySeq) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload && payload.error ? payload.error : "HTTP " + response.status);
      }
      if (!payload) {
        throw new Error("识别结果为空");
      }
      state.identify = payload;
      applyRoles(payload);
      renderChordPanel(payload);
      strumIfChordChanged(payload);
      scheduleDraw();
    } catch (error) {
      if (seq !== identifySeq) {
        return;
      }
      renderChordError("和弦识别请求失败。" + errorDetail(error));
    } finally {
      if (seq === identifySeq) {
        setIdentifyPending(false);
      }
    }
  }

  function applyRoles(payload) {
    state.roles.clear();
    var selection = payload && Array.isArray(payload.selection) ? payload.selection : [];
    selection.forEach(function (item) {
      if (!item) {
        return;
      }
      state.roles.set(cellKey(item.string, item.fret), {
        role: item.chordRole || "",
        roleName: item.chordRoleName || ""
      });
    });
  }

  function strumIfChordChanged(payload) {
    if (!state.soundOn || !window.FretAudio || !hasUserGesture) {
      return;
    }
    var chord = payload && payload.chord;
    if (!chord) {
      lastStrumKey = null;
      return;
    }
    var key = (chord.symbol || "") + "|" + (chord.inversion || "") + "|" + (chord.rootPitchClass !== undefined ? chord.rootPitchClass : "");
    if (key === lastStrumKey) {
      return;
    }
    lastStrumKey = key;
    var selection = Array.isArray(payload.selection) ? payload.selection : [];
    var midis = selection
      .map(function (item) {
        return item && typeof item.midi === "number" ? item.midi : null;
      })
      .filter(function (item) {
        return item !== null;
      });
    if (midis.length) {
      window.FretAudio.strum(midis, { velocity: 0.22, spread: 0.028, duration: 2.1 });
    }
  }

  /* ------------------------------------------------------------------------
     Scale card
     ------------------------------------------------------------------------ */

  function renderScaleCard(payload) {
    var scale = payload.scale || {};
    var notes = Array.isArray(scale.notes) ? scale.notes : [];
    var formula = Array.isArray(scale.formula) ? scale.formula : [];

    els.scaleName.textContent = scale.name || "—";
    els.scaleEnglish.textContent = scale.english || "";
    var accidentalLabel = "自动记谱";
    if (state.resolvedAccidental === "flat") {
      accidentalLabel = "降号记谱";
    } else if (state.resolvedAccidental === "sharp") {
      accidentalLabel = "升号记谱";
    }
    els.scaleSub.textContent =
      notes.length +
      " 个音 · " +
      accidentalLabel +
      (scale.category ? " · " + scale.category : "");

    if (scale.category) {
      els.scaleCategory.textContent = scale.category;
      els.scaleCategory.hidden = false;
    } else {
      els.scaleCategory.hidden = true;
    }

    clearNode(els.formulaChips);
    formula.forEach(function (degree) {
      els.formulaChips.appendChild(el("span", "formula-chip", degree));
    });

    clearNode(els.noteChips);
    notes.forEach(function (note) {
      var chip = el("span", "note-chip" + (note.isRoot ? " is-root" : ""));
      chip.appendChild(document.createTextNode(note.name || "—"));
      if (note.degreeLabel) {
        chip.appendChild(el("small", null, note.degreeLabel));
      }
      if (note.pitchClass !== undefined && payload.rootPitchClass !== undefined && note.pitchClass === payload.rootPitchClass) {
        chip.classList.add("is-root");
      }
      els.noteChips.appendChild(chip);
    });

    clearNode(els.intervalList);
    notes.forEach(function (note) {
      var row = el("div", "interval-row");
      row.appendChild(el("span", "interval-degree", note.degreeLabel || ""));
      row.appendChild(el("span", "interval-name", note.intervalName || ""));
      els.intervalList.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------------
     Chord card
     ------------------------------------------------------------------------ */

  function updateChordFade() {
    if (!els.chordFade) {
      return;
    }
    var body = els.chordBody;
    var overflow = body.scrollHeight - body.clientHeight;
    if (overflow <= 4) {
      els.chordFade.hidden = true;
      return;
    }
    els.chordFade.hidden = body.scrollTop >= overflow - 6;
  }

  function scheduleChordFade() {
    window.requestAnimationFrame(updateChordFade);
  }

  function renderChordEmpty() {
    clearNode(els.chordBody);
    var wrap = el("div", "chord-empty");
    var icon = el("span", "chord-empty-icon", "♬");
    icon.setAttribute("aria-hidden", "true");
    append(
      wrap,
      icon,
      el("p", "chord-empty-title", "在指板上点选品格，开始识别和弦"),
      el("p", "chord-empty-sub", "选中的音会标注和弦角色，并给出匹配度、转位与替代和弦建议。")
    );
    els.chordBody.appendChild(wrap);
    els.chordCount.textContent = "尚未选择音";
    setIdentifyPending(false);
    updatePlayButton();
    scheduleChordFade();
  }

  function renderChordError(message) {
    clearNode(els.chordBody);
    var wrap = el("div", "chord-error");
    var icon = el("span", "error-icon", "!");
    icon.setAttribute("aria-hidden", "true");
    append(wrap, icon, el("span", null, message));
    els.chordBody.appendChild(wrap);
    if (state.selected.size) {
      els.chordCount.textContent = "已选 " + state.selected.size + " 个音";
    }
    scheduleChordFade();
  }

  function renderChordPanel(payload) {
    clearNode(els.chordBody);
    var count = typeof payload.count === "number" ? payload.count : state.selected.size;
    var context = [];
    if (payload.scaleRootName) {
      context.push(payload.scaleRootName);
    }
    if (payload.scaleName) {
      context.push(payload.scaleName);
    }
    els.chordCount.textContent =
      "已选 " + count + " 个音" + (context.length ? " · " + context.join(" ") : "");

    if (payload.chord) {
      renderRecognizedChord(payload);
    } else {
      renderUnrecognized(payload);
    }

    renderAlternatives(payload);
    renderHints(payload);
    updatePlayButton();
    scheduleChordFade();
  }

  function renderRecognizedChord(payload) {
    var chord = payload.chord;
    var body = els.chordBody;

    var hero = el("div", "chord-hero");
    hero.appendChild(el("span", "chord-symbol", chord.symbol || "—"));
    if (chord.name && chord.name !== chord.symbol) {
      hero.appendChild(el("span", "chord-name", chord.name));
    }
    body.appendChild(hero);

    var badges = el("div", "badge-row");
    if (chord.qualityName) {
      badges.appendChild(el("span", "badge badge-primary", chord.qualityName));
    }
    if (chord.matchType) {
      badges.appendChild(el("span", matchBadgeClass(chord.matchType), chord.matchType));
    }
    if (chord.inversion) {
      badges.appendChild(el("span", "badge badge-blue", chord.inversion));
    }
    if (chord.suffix) {
      badges.appendChild(el("span", "badge", "后缀 " + chord.suffix));
    }
    if (chord.bass && chord.rootPitchClass !== undefined && chord.bass.pitchClass !== chord.rootPitchClass) {
      badges.appendChild(el("span", "badge badge-warning", "斜杠低音 " + (chord.bass.noteName || "")));
    }
    if (badges.childNodes.length) {
      body.appendChild(badges);
    }

    if (typeof chord.score === "number") {
      var scoreRow = el("div", "score-row");
      scoreRow.appendChild(el("span", "score-label", "匹配度"));
      var track = el("div", "score-track");
      var fill = el("div", "score-fill");
      track.appendChild(fill);
      scoreRow.appendChild(track);
      scoreRow.appendChild(el("span", "score-value", Math.round(chord.score) + " 分"));
      body.appendChild(scoreRow);
      var pct = clamp(Math.round(chord.score), 0, 100);
      window.requestAnimationFrame(function () {
        fill.style.width = pct + "%";
      });
    }

    var meta = el("div", "meta-grid");
    meta.appendChild(metaItem("转位", chord.inversion || "—"));
    if (chord.bass) {
      var bassValue = el("span", "meta-value");
      bassValue.appendChild(el("span", "slash", chord.bass.noteName || "—"));
      var bassDetail = [];
      if (chord.bass.stringNumber !== undefined) {
        bassDetail.push(chord.bass.stringNumber + "弦");
      }
      if (chord.bass.fret !== undefined) {
        bassDetail.push(chord.bass.fret + "品");
      }
      if (bassDetail.length) {
        bassValue.appendChild(document.createTextNode(" · " + bassDetail.join("")));
      }
      meta.appendChild(metaItemNode("低音", bassValue));
    }
    body.appendChild(meta);

    if (Array.isArray(chord.tones) && chord.tones.length) {
      body.appendChild(sectionLabel("和弦构成音"));
      var tones = el("div", "tone-chips");
      chord.tones.forEach(function (tone) {
        var chip = el("span", "tone-chip" + (tone.present ? "" : " is-missing"));
        chip.appendChild(el("span", "tone-degree", tone.degreeLabel || ""));
        chip.appendChild(el("span", "tone-note", tone.noteName || "—"));
        if (tone.role) {
          chip.appendChild(el("span", "tone-role", tone.role));
        }
        if (!tone.present) {
          chip.title = "和弦理论音，指板上未出现";
        }
        tones.appendChild(chip);
      });
      body.appendChild(tones);
    }

    appendIssueRow(body, "缺少音", chord.missing, false);
    appendIssueRow(body, "额外音", chord.extra, true);

    if (chord.description) {
      body.appendChild(el("p", "description", chord.description));
    }

    if (chord.shapeHint) {
      var hint = el("div", "shape-hint");
      hint.appendChild(el("span", "shape-hint-label", "常见指型"));
      hint.appendChild(el("span", "shape-hint-value", chord.shapeHint));
      body.appendChild(hint);
    }
  }

  function renderUnrecognized(payload) {
    var body = els.chordBody;
    var count = typeof payload.count === "number" ? payload.count : state.selected.size;

    var wrap = el("div", "unrecognized");
    var head = el("div", "unrecognized-head");
    var icon = el("span", "unrecognized-icon", "?");
    icon.setAttribute("aria-hidden", "true");
    var textWrap = el("div");
    textWrap.appendChild(el("p", "unrecognized-title", "暂未匹配到常用和弦"));
    textWrap.appendChild(
      el("p", "unrecognized-sub", "已选 " + count + " 个音，可尝试增删音或更换音阶上下文。")
    );
    append(head, icon, textWrap);
    wrap.appendChild(head);
    body.appendChild(wrap);

    var selection = Array.isArray(payload.selection) && payload.selection.length ? payload.selection : null;
    body.appendChild(sectionLabel("选中音"));
    var chips = el("div", "selected-summary");
    if (selection) {
      selection.forEach(function (item) {
        if (!item) {
          return;
        }
        var chip = el("span", "selected-chip" + (item.inScale ? "" : " is-out"));
        chip.appendChild(el("b", null, item.noteName || "—"));
        var meta = [];
        if (item.stringNumber !== undefined && item.fret !== undefined) {
          meta.push(item.stringNumber + "弦" + item.fret + "品");
        }
        if (item.scaleDegreeLabel) {
          meta.push("级数 " + item.scaleDegreeLabel);
        }
        if (meta.length) {
          chip.appendChild(el("small", null, meta.join(" · ")));
        }
        chips.appendChild(chip);
      });
    } else {
      sortedSelected().forEach(function (position) {
        var cell = state.cellMap.get(cellKey(position.string, position.fret));
        var chip = el("span", "selected-chip" + (cell && cell.inScale ? "" : " is-out"));
        chip.appendChild(el("b", null, (cell && cell.noteName) || "—"));
        chip.appendChild(el("small", null, (6 - position.string) + "弦" + position.fret + "品"));
        chips.appendChild(chip);
      });
    }
    body.appendChild(chips);
  }

  function metaItem(label, value) {
    return metaItemNode(label, el("span", "meta-value", value));
  }

  function metaItemNode(label, valueNode) {
    var item = el("div", "meta-item");
    item.appendChild(el("span", "meta-label", label));
    item.appendChild(valueNode);
    return item;
  }

  function matchBadgeClass(matchType) {
    if (matchType === "完整匹配") {
      return "badge badge-good";
    }
    if (matchType === "省略音") {
      return "badge badge-warning";
    }
    return "badge badge-bad";
  }

  function issueLabel(item) {
    if (item === null || item === undefined) {
      return "";
    }
    if (typeof item === "string" || typeof item === "number") {
      return String(item);
    }
    if (typeof item === "object") {
      var parts = [];
      if (item.degreeLabel) {
        parts.push(item.degreeLabel);
      }
      if (item.noteName) {
        parts.push(item.noteName);
      }
      if (!parts.length && item.role) {
        parts.push(item.role);
      }
      if (!parts.length && item.name) {
        parts.push(item.name);
      }
      return parts.join(" · ") || "—";
    }
    return String(item);
  }

  function appendIssueRow(parent, label, items, isExtra) {
    if (!Array.isArray(items) || !items.length) {
      return;
    }
    var row = el("div", "missing-row");
    row.appendChild(el("span", "label", label));
    items.forEach(function (item) {
      var chip = el("span", "missing-chip" + (isExtra ? " extra" : ""), issueLabel(item));
      row.appendChild(chip);
    });
    parent.appendChild(row);
  }

  function renderAlternatives(payload) {
    var alternatives = Array.isArray(payload.alternatives) ? payload.alternatives.filter(Boolean) : [];
    if (!alternatives.length) {
      return;
    }
    var body = els.chordBody;
    body.appendChild(sectionLabel("替代与近似"));
    var list = el("div", "alt-list");
    var detail = el("div", "alt-detail");
    detail.hidden = true;

    alternatives.forEach(function (alt, index) {
      var button = el("button", "alt-item");
      button.type = "button";
      button.appendChild(el("span", "alt-symbol", alt.symbol || "—"));
      var nameParts = [];
      if (alt.rootName) {
        nameParts.push(alt.rootName);
      }
      if (alt.qualityName) {
        nameParts.push(alt.qualityName);
      }
      button.appendChild(el("span", "alt-name", nameParts.join(" ")));

      var badges = el("span", "alt-badges");
      if (alt.matchType) {
        badges.appendChild(el("span", matchBadgeClass(alt.matchType), alt.matchType));
      }
      button.appendChild(badges);
      if (typeof alt.score === "number") {
        button.appendChild(el("span", "alt-score", Math.round(alt.score) + "分"));
      }

      button.addEventListener("click", function () {
        var active = list.querySelectorAll(".alt-item.is-active");
        for (var i = 0; i < active.length; i += 1) {
          active[i].classList.remove("is-active");
        }
        button.classList.add("is-active");
        fillAltDetail(detail, alt, index);
      });

      list.appendChild(button);
    });

    body.appendChild(list);
    body.appendChild(detail);

    var footer = el("div", "chord-footer");
    if (payload.scaleRootName || payload.scaleName) {
      footer.appendChild(el("span", null, "参考音阶：" + (payload.scaleRootName || "") + " " + (payload.scaleName || "")));
    }
    footer.appendChild(el("span", null, "选中 " + (payload.count !== undefined ? payload.count : state.selected.size) + " 个音"));
    if (payload.chord && payload.chord.symbol) {
      footer.appendChild(el("span", null, "最佳匹配：" + payload.chord.symbol));
    }
    body.appendChild(footer);
  }

  function fillAltDetail(detail, alt, index) {
    clearNode(detail);
    detail.hidden = false;

    detail.appendChild(altMetaItem("完整名称", alt.name || "—"));
    if (alt.matchType) {
      detail.appendChild(altMetaItem("匹配程度", alt.matchType));
    }
    if (alt.inversion) {
      detail.appendChild(altMetaItem("转位", alt.inversion));
    }
    if (typeof alt.score === "number") {
      detail.appendChild(altMetaItem("匹配得分", Math.round(alt.score) + " 分"));
    }
    if (alt.rootName) {
      detail.appendChild(altMetaItem("根音", alt.rootName));
    }
    if (alt.qualityName) {
      detail.appendChild(altMetaItem("性质", alt.qualityName));
    }

    var missing = Array.isArray(alt.missing) ? alt.missing : [];
    var extra = Array.isArray(alt.extra) ? alt.extra : [];
    if (missing.length) {
      detail.appendChild(altMetaItem("缺少音", missing.map(issueLabel).join("、")));
    }
    if (extra.length) {
      detail.appendChild(altMetaItem("额外音", extra.map(issueLabel).join("、")));
    }

    var note = el(
      "p",
      "alt-detail-note",
      "这是指板上所选音可以构成的另一种和弦解释，点击其他候选可切换查看。"
    );
    detail.appendChild(note);
    scheduleChordFade();
  }

  function altMetaItem(label, value) {
    var item = el("div", "meta-item");
    item.appendChild(el("span", "meta-label", label));
    item.appendChild(el("span", "meta-value", value));
    return item;
  }

  function renderHints(payload) {
    var hints = Array.isArray(payload.hints) ? payload.hints.filter(function (hint) {
      return typeof hint === "string" && hint.trim();
    }) : [];
    if (!hints.length) {
      return;
    }
    var body = els.chordBody;
    body.appendChild(sectionLabel("提示"));
    var list = el("ul", "hints");
    hints.forEach(function (hint) {
      list.appendChild(el("li", null, hint));
    });
    body.appendChild(list);
  }

  /* ------------------------------------------------------------------------
     Controls / event wiring
     ------------------------------------------------------------------------ */

  /* ------------------------------------------------------------------------
     v2 — modes, tunings, CAGED, playback, shutdown
     ------------------------------------------------------------------------ */

  function isCagedActive() {
    return state.mode === "scale" && state.cagedView === "caged";
  }

  function updatePlayButton() {
    if (!els.playButton) {
      return;
    }
    var enabled = state.mode === "chord" && state.selected.size > 0 && !!(state.identify && state.identify.chord);
    els.playButton.disabled = !enabled;
    els.playButton.title = enabled
      ? "按低弦到高弦依次拨响当前所选和弦音"
      : state.mode !== "chord"
        ? "切换到和弦模式后可播放所选和弦"
        : "先点选品格组成和弦";
  }

  function updateCanvasAriaLabel() {
    var base =
      state.mode === "chord"
        ? "吉他指板（和弦模式），已选 " +
          state.selected.size +
          " 个音。方向键移动焦点，回车或空格选择音，Esc 清空所选。"
        : "吉他指板（音阶模式），方向键移动焦点，回车或空格试听音符。点击品格试听。";
    els.canvas.setAttribute("aria-label", base);
  }

  function syncModeUi() {
    document.body.classList.toggle("mode-scale", state.mode === "scale");
    document.body.classList.toggle("mode-chord", state.mode === "chord");
    Array.prototype.forEach.call(document.querySelectorAll("#mode-seg .seg-btn"), function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-mode") === state.mode));
    });
    if (els.cagedViewField) {
      els.cagedViewField.hidden = state.mode !== "scale";
    }
    if (els.cagedPartField) {
      els.cagedPartField.hidden = !isCagedActive();
    }
    if (els.cagedLegend) {
      els.cagedLegend.hidden = !isCagedActive();
    }
    if (els.legendSelected) {
      els.legendSelected.hidden = state.mode !== "chord";
    }
    if (els.clearButton) {
      els.clearButton.disabled = state.mode !== "chord" || state.selected.size === 0;
    }
    updatePlayButton();
    updateCanvasAriaLabel();
    updateHoverDefault();
    scheduleDraw();
  }

  function setMode(mode) {
    if (mode !== "scale" && mode !== "chord") {
      return;
    }
    if (state.mode === mode) {
      return;
    }
    state.mode = mode;
    invalidateIdentify();
    if (mode === "scale") {
      // Leaving chord mode: the note selection / chord result is not kept.
      state.selected.clear();
      state.roles.clear();
      state.identify = null;
      lastStrumKey = null;
      renderModeGate();
      closeTuningEditorIfIdle();
    } else {
      state.caged = null;
      state.cagedError = false;
      renderChordEmpty();
      scheduleIdentify();
    }
    syncModeUi();
    updateFretboardSub(state.fretboard || {});
    if (state.fretboard) {
      state.focus.fret = clamp(state.focus.fret, state.fretFrom, state.fretTo);
    }
    if (state.mode === "scale" && isCagedActive()) {
      refreshCaged(true);
    }
    scheduleDraw();
  }

  function renderModeGate() {
    clearNode(els.chordBody);
    var wrap = el("div", "chord-mode-gate");
    var icon = el("span", "gate-icon", "♬");
    icon.setAttribute("aria-hidden", "true");
    append(
      wrap,
      icon,
      el("p", "gate-title", "当前为音阶模式"),
      el("p", "gate-sub", "点击品格只会试听该音，不会加入和弦识别。切换到和弦模式后即可点选品格、识别和弦并播放。")
    );
    var button = el("button", "btn btn-primary btn-sm", "切换到和弦模式");
    button.type = "button";
    button.addEventListener("click", function () {
      setMode("chord");
    });
    wrap.appendChild(button);
    els.chordBody.appendChild(wrap);
    if (els.chordCount) {
      els.chordCount.textContent = "音阶模式 · 试听音符";
    }
    setIdentifyPending(false);
    scheduleChordFade();
  }

  function playScaleNote(hit) {
    if (!hit || !hit.cell) {
      return;
    }
    state.focus = { string: hit.string, fret: hit.fret };
    state.hasFocus = true;
    if (state.soundOn && window.FretAudio) {
      hasUserGesture = true;
      window.FretAudio.pluck(hit.cell.midi, { velocity: 0.44, duration: 1.9 });
    }
    var number = stringNumberOfCell(hit);
    var cell = hit.cell;
    clearNode(els.hoverInfo);
    els.hoverInfo.classList.add("is-active");
    els.hoverInfo.appendChild(document.createTextNode("试听 " + number + "弦 · " + hit.fret + "品 · "));
    els.hoverInfo.appendChild(el("b", null, cell.noteName || "—"));
    els.hoverInfo.appendChild(
      document.createTextNode(" 级数 " + (cell.degreeLabel || cell.chromaticLabel || "—"))
    );
    if (state.cagedView === "caged") {
      els.hoverInfo.appendChild(el("span", "info-sep", "·"));
      els.hoverInfo.appendChild(document.createTextNode("CAGED 把位模式"));
    }
    scheduleDraw();
  }

  function playSelectedChord() {
    if (state.mode !== "chord" || !state.selected.size) {
      return;
    }
    var keys = Array.from(state.selected.keys());
    keys.sort(function (a, b) {
      var left = a.split(":");
      var right = b.split(":");
      return Number(left[0]) - Number(right[0]) || Number(left[1]) - Number(right[1]);
    });
    var midis = keys
      .map(function (key) {
        var parts = key.split(":");
        var cell = state.cellMap ? state.cellMap.get(key) : null;
        return cell && typeof cell.midi === "number" ? cell.midi : null;
      })
      .filter(function (item) {
        return item !== null;
      });
    if (!midis.length && state.identify && Array.isArray(state.identify.selection)) {
      midis = state.identify.selection
        .slice()
        .sort(function (a, b) {
          return a.string - b.string;
        })
        .map(function (item) {
          return item.midi;
        })
        .filter(function (item) {
          return typeof item === "number";
        });
    }
    if (!window.FretAudio || !midis.length) {
      return;
    }
    hasUserGesture = true;
    var wasEnabled = window.FretAudio.isEnabled();
    window.FretAudio.setEnabled(true);
    window.FretAudio.strum(midis, { velocity: 0.34, spread: 0.05, duration: 2.3 });
    if (!wasEnabled) {
      window.setTimeout(function () {
        window.FretAudio.setEnabled(state.soundOn);
      }, 300);
    }
    showToast("播放所选和弦：" + midis.length + " 个音");
  }

  /* --- custom tuning editor ------------------------------------------- */

  function midiToEditorName(midi) {
    var sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return sharpNames[((midi % 12) + 12) % 12];
  }

  function currentTuningItems() {
    var parsed = parseTuningParam(state.tuningParam);
    if (parsed && parsed.length === 6) {
      return parsed;
    }
    var strings = state.fretboard && Array.isArray(state.fretboard.strings) ? state.fretboard.strings : [];
    if (strings.length === 6) {
      return strings.map(function (item) {
        var midi = typeof item.openMidi === "number" ? item.openMidi : 40;
        return { name: midiToEditorName(midi), octave: Math.floor(midi / 12) - 1 };
      });
    }
    return [
      { name: "E", octave: 2 },
      { name: "A", octave: 2 },
      { name: "D", octave: 3 },
      { name: "G", octave: 3 },
      { name: "B", octave: 3 },
      { name: "E", octave: 4 }
    ];
  }

  function tuningNoteOptions() {
    var pitchClasses = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    var names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    var options = [];
    for (var octave = 1; octave <= 7; octave += 1) {
      for (var index = 0; index < pitchClasses.length; index += 1) {
        var midi = 12 * (octave + 1) + pitchClasses[index];
        if (midi < 28 || midi > 100) {
          continue;
        }
        options.push({ value: names[index] + octave, label: names[index] + octave });
      }
    }
    return options;
  }

  function closeTuningEditor() {
    if (els.tuningEditor) {
      els.tuningEditor.hidden = true;
    }
  }

  function closeTuningEditorIfIdle() {
    if (els.tuningSelect && els.tuningSelect.value !== CUSTOM_TUNING_VALUE) {
      closeTuningEditor();
    }
  }

  function openTuningEditor() {
    if (!els.customFields || !els.tuningEditor) {
      return;
    }
    var items = currentTuningItems();
    var options = tuningNoteOptions();
    clearNode(els.customFields);
    items.forEach(function (item, index) {
      var slot = el("label", "tuning-slot");
      slot.appendChild(el("span", "tuning-slot-label", 6 - index + " 弦"));
      var select = document.createElement("select");
      select.className = "tuning-slot-select";
      select.setAttribute("aria-label", 6 - index + " 弦空弦音");
      options.forEach(function (option) {
        var node = document.createElement("option");
        node.value = option.value;
        node.textContent = option.label;
        select.appendChild(node);
      });
      var wanted = (item.name || "E") + item.octave;
      select.value = wanted;
      if (!select.value) {
        select.value = "E" + (item.octave || 2);
      }
      slot.appendChild(select);
      els.customFields.appendChild(slot);
    });
    state.customDraft = items;
    els.tuningEditor.hidden = false;
    els.tuningSelect.value = CUSTOM_TUNING_VALUE;
  }

  function applyCustomTuning() {
    if (!els.customFields) {
      return;
    }
    var selects = els.customFields.querySelectorAll("select");
    if (selects.length !== 6) {
      return;
    }
    var items = [];
    for (var index = 0; index < selects.length; index += 1) {
      var match = /^([A-G][#b]?)(\d+)$/.exec(selects[index].value);
      if (!match) {
        showToast("自定义调弦格式不正确", true);
        return;
      }
      items.push({ name: match[1], octave: Number(match[2]) });
    }
    state.tuningId = CUSTOM_TUNING_VALUE;
    state.tuningParam = formatTuningString(items);
    state.tuningName = "自定义调弦";
    if (els.tuningSelect) {
      els.tuningSelect.value = CUSTOM_TUNING_VALUE;
    }
    updateTuningUi();
    if (state.tuningSupported) {
      showToast("已应用自定义调弦：" + state.tuningParam);
    } else {
      showToast("已更新调弦标签：" + state.tuningParam + "（后端 v2 调弦参数尚未就绪）", true);
    }
    refreshFretboard();
    refreshCaged(true);
    closeTuningEditor();
  }

  function resetTuningToStandard() {
    var preset = findTuningPreset("standard") || (state.tuningPresets.length ? state.tuningPresets[0] : null);
    if (!preset) {
      state.tuningId = "standard";
      state.tuningParam = "E2,A2,D3,G3,B3,E4";
      state.tuningName = "标准调弦";
      closeTuningEditor();
      updateTuningUi();
      refreshFretboard();
      refreshCaged(true);
      return;
    }
    setTuningPreset(preset);
    showToast("已恢复标准调弦");
  }

  /* --- CAGED ---------------------------------------------------------- */

  function syncCagedUi() {
    Array.prototype.forEach.call(document.querySelectorAll("#view-seg .seg-btn"), function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-view") === state.cagedView));
    });
    if (els.cagedPartField) {
      els.cagedPartField.hidden = !isCagedActive();
    }
    if (els.cagedLegend) {
      els.cagedLegend.hidden = !isCagedActive();
    }
    if (els.cagedPartSelect) {
      els.cagedPartSelect.value = state.cagedPart;
    }
    updateFretboardSub(state.fretboard || {});
    scheduleDraw();
  }

  function setCagedView(view) {
    if (view !== "overview" && view !== "caged") {
      return;
    }
    if (state.cagedView === view) {
      return;
    }
    state.cagedView = view;
    if (view === "overview") {
      state.caged = null;
      state.cagedError = false;
    }
    syncCagedUi();
    if (isCagedActive()) {
      refreshCaged(true);
    }
  }

  function setCagedPart(part) {
    if (!part) {
      return;
    }
    state.cagedPart = part;
    if (els.cagedPartSelect) {
      els.cagedPartSelect.value = part;
    }
    updateFretboardSub(state.fretboard || {});
    scheduleDraw();
  }

  function refreshCaged(force) {
    if (!isCagedActive()) {
      if (state.caged || state.cagedError) {
        state.caged = null;
        state.cagedError = false;
        scheduleDraw();
      }
      return;
    }
    if (!state.fretboard) {
      return;
    }
    var seq = (state.cagedSeq += 1);
    var params = new URLSearchParams();
    params.set("rootName", state.rootName);
    params.set("scaleId", state.scaleId);
    params.set("fretFrom", String(state.fretFrom));
    params.set("fretTo", String(state.fretTo));
    if (state.tuningParam) {
      params.set("tuning", state.tuningParam);
    }
    fetch(API.caged + "?" + params.toString(), { headers: { Accept: "application/json" } })
      .then(function (response) {
        return response.json().catch(function () {
          return null;
        }).then(function (payload) {
          return { response: response, payload: payload };
        });
      })
      .then(function (result) {
        if (seq !== state.cagedSeq) {
          return;
        }
        if (!result.response.ok) {
          throw new Error(result.payload && result.payload.error ? result.payload.error : "HTTP " + result.response.status);
        }
        if (!result.payload || !Array.isArray(result.payload.shapes)) {
          throw new Error("CAGED 数据不完整");
        }
        state.caged = result.payload;
        state.cagedError = false;
        if (state.cagedPart === "all" && Array.isArray(result.payload.order) && result.payload.order.length) {
          state.cagedPart = "all";
        }
        updateFretboardSub(state.fretboard || {});
        scheduleDraw();
      })
      .catch(function (error) {
        if (seq !== state.cagedSeq) {
          return;
        }
        state.caged = null;
        state.cagedError = true;
        updateFretboardSub(state.fretboard || {});
        scheduleDraw();
        if (!refreshCaged.warned) {
          refreshCaged.warned = true;
          showToast("CAGED 把位数据暂不可用：" + (error && error.message ? error.message : "接口未就绪"), true);
        }
      });
  }

  function drawCagedLayer(ctx, geom) {
    if (!isCagedActive()) {
      return;
    }
    var boardX = geom.boardLeft;
    var boardY = geom.boardTop;
    var boardW = geom.boardW;
    var boardH = geom.boardH;

    ctx.save();
    ctx.fillStyle = rgba(COLORS.bg, 0.7);
    ctx.fillRect(boardX, boardY, boardW, boardH);

    if (!state.caged || !Array.isArray(state.caged.shapes) || !state.caged.shapes.length) {
      ctx.fillStyle = "rgba(15,63,66,0.85)";
      ctx.font = "600 12.5px " + FONT_UI;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        state.cagedError ? "CAGED 把位数据暂不可用（接口未就绪）" : "正在载入 CAGED 把位…",
        boardX + boardW / 2,
        boardY + boardH / 2
      );
      ctx.restore();
      return;
    }

    var shapes = state.caged.shapes;
    if (state.cagedPart !== "all") {
      shapes = shapes.filter(function (shape) {
        return shape.id === state.cagedPart;
      });
    }
    var lastColumn = geom.frets.length - 1;
    var isSingle = state.cagedPart !== "all";

    shapes.forEach(function (shape, shapeIndex) {
      var fromFret = Math.max(shape.fretFrom, geom.frets[0]);
      var toFret = Math.min(shape.fretTo, geom.frets[lastColumn]);
      var startColumn = geom.frets.indexOf(fromFret);
      if (startColumn === -1) {
        return;
      }
      var endColumn = geom.frets.indexOf(toFret);
      var x1 = geom.boundaries[startColumn];
      var x2 = endColumn === -1 ? geom.boundaries[geom.boundaries.length - 1] : geom.boundaries[endColumn + 1];
      if (x2 - x1 < 16) {
        x2 = x1 + 16;
      }

      // 每个 CAGED 形状用自己的颜色（与图例五色渐变、--caged-* 变量一致）
      var shapeKey = String(shape.id || shape.name || "").toUpperCase();
      var shapeColor = CAGED_SHAPE_COLORS[shapeKey] || COLORS.accent;

      ctx.save();
      roundRectPath(ctx, x1 + 2, boardY + 3, Math.max(12, x2 - x1 - 4), boardH - 6, 9);
      ctx.fillStyle = rgba(shapeColor, isSingle ? 0.14 : 0.09);
      ctx.fill();
      ctx.strokeStyle = rgba(shapeColor, isSingle ? 0.85 : 0.42);
      ctx.lineWidth = isSingle ? 2 : 1.2;
      ctx.stroke();

      var shapeLabel = shape.id || shape.name || "";
      var labelX = (x1 + x2) / 2;
      var labelY = boardY + 14;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 12px " + FONT_UI;
      var labelWidth = ctx.measureText(shapeLabel).width + 14;
      roundRectPath(ctx, labelX - labelWidth / 2, labelY - 9, labelWidth, 18, 9);
      ctx.fillStyle = rgba(COLORS.bg, 0.86);
      ctx.fill();
      ctx.strokeStyle = rgba(shapeColor, isSingle ? 0.85 : 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = blendColor(shapeColor, COLORS.text, 0.45);
      ctx.fillText(shapeLabel, labelX, labelY + 0.5);
      ctx.restore();

      var cells = Array.isArray(shape.cells) ? shape.cells : [];
      cells.forEach(function (cell) {
        var column = geom.frets.indexOf(cell.fret);
        if (column === -1) {
          return;
        }
        if (cell.string < 0 || cell.string >= geom.stringCount) {
          return;
        }
        var cellRadius = Math.min(15, Math.max(10, geom.colWidth(column) * 0.22));
        var hovered = state.hover && state.hover.string === cell.string && state.hover.fret === cell.fret;
        drawNoteMarker(ctx, geom, cell, column, cell.string, cellRadius, false, hovered);
      });

      var tones = Array.isArray(shape.chordTones) ? shape.chordTones : [];
      tones.forEach(function (tone) {
        var column = geom.frets.indexOf(tone.fret);
        if (column === -1 || tone.string < 0 || tone.string >= geom.stringCount) {
          return;
        }
        drawCagedTone(ctx, geom, tone, column);
      });
    });

    ctx.restore();
  }

  function drawCagedTone(ctx, geom, tone, column) {
    var x = geom.colCenter(column);
    var y = geom.stringY(tone.string);
    var radius = Math.min(17, Math.max(12.5, geom.colWidth(column) * 0.26));
    var role = tone.role || "";
    var label = "R";
    var fill = COLORS.primary;
    if (role.indexOf("三") !== -1) {
      label = "3";
      fill = COLORS.accent;
    } else if (role.indexOf("五") !== -1) {
      label = "5";
      fill = COLORS.blue;
    }
    var isRoot = label === "R";

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // 根音最亮：补一圈 paper 亮色外环，与「根音 > 三音 > 五音」的层级一致
    if (isRoot) {
      ctx.strokeStyle = "rgba(13,148,136,0.85)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK_DARK;
    ctx.font = "700 " + clamp(radius * 0.82, 9, 13).toFixed(1) + "px " + FONT_UI;
    ctx.fillText(label, x, y + 0.5);
    ctx.restore();
  }

  /* --- shutdown ------------------------------------------------------- */

  function showShutdownOverlay(text) {
    if (!els.shutdownOverlay) {
      return;
    }
    els.shutdownText.textContent = text || SHUTDOWN_TEXT;
    els.shutdownOverlay.hidden = false;
    document.body.classList.add("is-shutdown");
    if (els.retryButton) {
      els.retryButton.disabled = true;
    }
    if (els.exitButton) {
      els.exitButton.disabled = true;
    }
  }

  function requestShutdown() {
    if (state.shutdown) {
      return;
    }
    var confirmed = window.confirm(
      "确定退出并停止本地服务吗？\n\n页面会显示「服务已停止」，之后可以关闭此标签页。\n如需再次使用，请重新运行启动脚本。"
    );
    if (!confirmed) {
      return;
    }
    state.shutdown = true;
    if (els.exitButton) {
      els.exitButton.disabled = true;
    }
    hideError();
    setStatus("loading", "正在停止服务…");

    fetch(API.shutdown, { method: "POST", headers: { Accept: "application/json" } })
      .then(function (response) {
        return response.json().catch(function () {
          return null;
        }).then(function (payload) {
          return { response: response, payload: payload };
        });
      })
      .then(function (result) {
        if (!result.response.ok) {
          throw new Error(result.payload && result.payload.error ? result.payload.error : "HTTP " + result.response.status);
        }
        setStatus("idle", "已退出");
        showShutdownOverlay(SHUTDOWN_TEXT);
      })
      .catch(function (error) {
        var message = error && error.message ? String(error.message) : "";
        if (/failed to fetch|networkerror|load failed|network error/i.test(message)) {
          // The socket often drops as the server exits: treat as stopping.
          setStatus("idle", "已退出");
          showShutdownOverlay("已向本地服务发出退出请求。若本页仍可操作，请手动关闭启动窗口（Ctrl+C）。");
          return;
        }
        state.shutdown = false;
        if (els.exitButton) {
          els.exitButton.disabled = false;
        }
        setStatus("error", "退出失败");
        showError("无法停止本地服务（POST /api/shutdown）。请手动关闭启动窗口或按 Ctrl+C。" + errorDetail(error));
      });
  }

  function syncRangeButtons() {
    Array.prototype.forEach.call(document.querySelectorAll(".seg-btn[data-from]"), function (button) {
      var from = Number(button.getAttribute("data-from"));
      var to = Number(button.getAttribute("data-to"));
      button.setAttribute("aria-pressed", String(from === state.fretFrom && to === state.fretTo));
    });
  }

  function syncSpacingButtons() {
    Array.prototype.forEach.call(document.querySelectorAll(".seg-btn[data-spacing]"), function (button) {
      var value = button.getAttribute("data-spacing");
      button.setAttribute("aria-pressed", String(value === "equal" ? state.equalSpacing : !state.equalSpacing));
    });
  }

  function refreshFretboard() {
    invalidateIdentify();
    scheduleDraw();
    loadFretboard();
  }

  function bindControls() {
    els.rootSelect.addEventListener("change", function () {
      state.rootName = els.rootSelect.value;
      refreshFretboard();
    });

    els.scaleSelect.addEventListener("change", function () {
      state.scaleId = els.scaleSelect.value;
      refreshFretboard();
    });

    Array.prototype.forEach.call(document.querySelectorAll(".seg-btn[data-from]"), function (button) {
      button.addEventListener("click", function () {
        var from = Number(button.getAttribute("data-from"));
        var to = Number(button.getAttribute("data-to"));
        if (from === state.fretFrom && to === state.fretTo) {
          return;
        }
        state.fretFrom = from;
        state.fretTo = to;
        syncRangeButtons();
        pruneSelectionToRange();
        refreshFretboard();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll(".seg-btn[data-spacing]"), function (button) {
      button.addEventListener("click", function () {
        state.equalSpacing = button.getAttribute("data-spacing") === "equal";
        syncSpacingButtons();
        scheduleDraw();
      });
    });

    els.displaySelect.addEventListener("change", function () {
      var value = els.displaySelect.value;
      state.displayMode = DISPLAY_MODES[value] || DISPLAY_MODES.both;
      scheduleDraw();
    });

    els.nonscaleToggle.addEventListener("change", function () {
      state.showNonScale = els.nonscaleToggle.checked;
      els.nonscaleText.textContent = state.showNonScale ? "显示" : "隐藏";
      scheduleDraw();
    });

    els.soundToggle.addEventListener("change", function () {
      state.soundOn = els.soundToggle.checked;
      els.soundText.textContent = state.soundOn ? "开启" : "静音";
      if (window.FretAudio) {
        window.FretAudio.setEnabled(state.soundOn);
      }
    });

    els.clearButton.addEventListener("click", clearSelection);

    els.retryButton.addEventListener("click", function () {
      hideError();
      loadOptions();
    });

    Array.prototype.forEach.call(document.querySelectorAll("#mode-seg .seg-btn"), function (button) {
      button.addEventListener("click", function () {
        setMode(button.getAttribute("data-mode"));
      });
    });

    if (els.tuningSelect) {
      els.tuningSelect.addEventListener("change", function () {
        var value = els.tuningSelect.value;
        if (value === CUSTOM_TUNING_VALUE) {
          openTuningEditor();
          return;
        }
        var preset = findTuningPreset(value);
        if (preset) {
          setTuningPreset(preset);
        }
      });
    }

    if (els.customApply) {
      els.customApply.addEventListener("click", applyCustomTuning);
    }

    if (els.customReset) {
      els.customReset.addEventListener("click", resetTuningToStandard);
    }

    Array.prototype.forEach.call(document.querySelectorAll("#view-seg .seg-btn"), function (button) {
      button.addEventListener("click", function () {
        setCagedView(button.getAttribute("data-view"));
      });
    });

    if (els.cagedPartSelect) {
      els.cagedPartSelect.addEventListener("change", function () {
        setCagedPart(els.cagedPartSelect.value);
      });
    }

    if (els.playButton) {
      els.playButton.addEventListener("click", playSelectedChord);
    }

    if (els.exitButton) {
      els.exitButton.addEventListener("click", requestShutdown);
    }
  }

  function pruneSelectionToRange() {
    var self = state.selected;
    var roles = state.roles;
    Array.from(self.keys()).forEach(function (key) {
      var parts = key.split(":");
      var fret = Number(parts[1]);
      if (fret < state.fretFrom || fret > state.fretTo) {
        self.delete(key);
        roles.delete(key);
      }
    });
    state.focus.fret = clamp(state.focus.fret, state.fretFrom, state.fretTo);
    updateSelectionChrome();
    if (!self.size) {
      renderChordEmpty();
    }
  }

  function bindCanvas() {
    var canvas = els.canvas;

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", function (event) {
      hideTooltip();
      if (event.pointerType && event.pointerType !== "mouse") {
        // let touch generate a click
        return;
      }
    });

    canvas.addEventListener("click", function (event) {
      var hit = hitTest(event.clientX, event.clientY);
      if (hit) {
        handleCellActivate(hit);
      }
    });

    canvas.addEventListener("keydown", function (event) {
      var handled = true;
      var focus = state.focus || { string: 0, fret: state.fretFrom };
      var stringCount = state.fretboard && state.fretboard.strings ? state.fretboard.strings.length : 6;

      switch (event.key) {
        case "ArrowLeft":
          focus.fret -= 1;
          break;
        case "ArrowRight":
          focus.fret += 1;
          break;
        case "ArrowUp":
          focus.string -= 1;
          break;
        case "ArrowDown":
          focus.string += 1;
          break;
        case "Enter":
        case " ":
        case "Spacebar":
          var hit = hitTestFromFocus();
          if (hit) {
            handleCellActivate(hit);
          }
          break;
        case "Escape":
        case "Esc":
          if (state.mode === "chord") {
            clearSelection();
          }
          break;
        default:
          handled = false;
      }

      if (!handled) {
        return;
      }
      event.preventDefault();

      focus.fret = clamp(focus.fret, state.fretFrom, state.fretTo);
      focus.string = clamp(focus.string, 0, stringCount - 1);
      state.focus = focus;
      state.hasFocus = true;
      var focusedCell = state.cellMap ? state.cellMap.get(cellKey(focus.string, focus.fret)) : null;
      if (focusedCell) {
        var hitForInfo = { string: focus.string, fret: focus.fret, cell: focusedCell };
        updateHoverInfo(hitForInfo);
        var point = cellToClient(focus.string, focus.fret);
        if (point) {
          showTooltip(point.x, point.y, hitForInfo);
        }
      } else {
        hideTooltip();
        updateHoverDefault();
      }
      scheduleDraw();
    });

    canvas.addEventListener("focus", function () {
      state.hasFocus = true;
      scheduleDraw();
    });

    canvas.addEventListener("blur", function () {
      state.hasFocus = false;
      hideTooltip();
      scheduleDraw();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" && event.key !== "Esc") {
        return;
      }
      var target = event.target;
      var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
      if (tag === "select" || tag === "input" || tag === "textarea") {
        return;
      }
      if (document.activeElement === canvas) {
        return;
      }
      if (state.mode === "chord" && state.selected.size) {
        clearSelection();
      }
    });

    window.addEventListener("scroll", hideTooltip, { passive: true });
  }

  function hitTestFromFocus() {
    var focus = state.focus;
    if (!focus || !state.cellMap) {
      return null;
    }
    var cell = state.cellMap.get(cellKey(focus.string, focus.fret));
    return { string: focus.string, fret: focus.fret, cell: cell || null };
  }

  function cellToClient(stringIndex, fret) {
    var geom = state.geom;
    if (!geom) {
      return null;
    }
    var column = geom.frets.indexOf(fret);
    if (column === -1) {
      return null;
    }
    var rect = els.canvas.getBoundingClientRect();
    return {
      x: rect.left + geom.colCenter(column),
      y: rect.top + geom.stringY(stringIndex)
    };
  }

  function bindResize() {
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(function () {
        scheduleDraw();
        scheduleChordFade();
      });
      observer.observe(els.canvasWrap);
      observer.observe(els.chordBody);
    }
    window.addEventListener("resize", function () {
      scheduleDraw();
      scheduleChordFade();
    });
    els.chordBody.addEventListener("scroll", updateChordFade, { passive: true });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  function cacheElements() {
    els.rootSelect = $("root-select");
    els.scaleSelect = $("scale-select");
    els.displaySelect = $("display-select");
    els.nonscaleToggle = $("nonscale-toggle");
    els.nonscaleText = $("nonscale-text");
    els.soundToggle = $("sound-toggle");
    els.soundText = $("sound-text");
    els.clearButton = $("clear-button");
    els.retryButton = $("retry-button");
    els.errorBanner = $("error-banner");
    els.errorText = $("error-text");
    els.statusBadge = $("status-badge");
    els.statusText = $("status-text");
    els.tuningChip = $("tuning-chip");
    els.tuningText = $("tuning-text");
    els.canvasWrap = $("canvas-wrap");
    els.canvas = $("fretboard");
    els.tooltip = $("canvas-tooltip");
    els.canvasOverlay = $("canvas-overlay");
    els.canvasOverlayText = $("canvas-overlay-text");
    els.fretboardSub = $("fretboard-sub");
    els.scaleName = $("scale-name");
    els.scaleEnglish = $("scale-english");
    els.scaleSub = $("scale-sub");
    els.scaleCategory = $("scale-category");
    els.formulaChips = $("formula-chips");
    els.noteChips = $("note-chips");
    els.intervalList = $("interval-list");
    els.chordBody = $("chord-body");
    els.chordFade = $("chord-fade");
    els.chordCount = $("chord-count");
    els.identifySpinner = $("identify-spinner");
    els.hoverInfo = $("hover-info");
    els.toast = $("toast");
    els.modeSeg = $("mode-seg");
    els.tuningSelect = $("tuning-select");
    els.tuningEditor = $("tuning-editor");
    els.customFields = $("custom-tuning-fields");
    els.customApply = $("custom-tuning-apply");
    els.customReset = $("custom-tuning-reset");
    els.cagedViewField = $("caged-view-field");
    els.cagedPartField = $("caged-part-field");
    els.cagedPartSelect = $("caged-part-select");
    els.cagedLegend = $("caged-legend");
    els.legendSelected = $("legend-selected");
    els.playButton = $("play-chord-button");
    els.exitButton = $("exit-button");
    els.footerTuning = $("footer-tuning");
    els.shutdownOverlay = $("shutdown-overlay");
    els.shutdownText = $("shutdown-text");
  }

  function init() {
    cacheElements();
    els.displaySelect.value = "both";
    state.displayMode = DISPLAY_MODES.both;
    state.mode = "scale";
    syncSpacingButtons();
    syncRangeButtons();
    syncModeUi();
    syncCagedUi();
    renderModeGate();

    bindControls();
    bindCanvas();
    bindResize();

    els.nonscaleText.textContent = "隐藏";
    els.soundText.textContent = "开启";
    els.clearButton.disabled = true;
    updateTuningUi();

    loadOptions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
