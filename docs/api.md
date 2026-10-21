# yinjie API 契约

本文档是前后端唯一权威契约，描述 yinjie 当前版本实现的全部 REST 接口与前端交互规格。当前契约的关键约定：

- 所有与指板相关的接口都接受可选查询参数 `tuning`（自定义调弦）；
- `/api/options` 的 `tunings` 为**预设列表**（每项含 `english`、`tuningParam`）；
- `GET /api/caged` 提供 CAGED 系统指板图，供音阶模式使用；
- `POST /api/shutdown` 供页面「退出」按钮调用，关闭服务；
- `POST /api/chord/identify` 请求体支持可选 `tuning`。

## 0. 调弦参数 `tuning`

格式：**6 个「音名+八度」用逗号分隔，顺序固定为 6 弦→1 弦（低音弦→高音弦）**，例如：

| 调弦 | tuning 参数值 |
| --- | --- |
| 标准调弦 E-A-D-G-B-E | `E2,A2,D3,G3,B3,E4` |
| Drop D | `D2,A2,D3,G3,B3,E4` |
| 降半音 | `Eb2,Ab2,Db3,Gb3,Bb3,Eb4` |
| DADGAD | `D2,A2,D3,G3,A3,D4` |
| Open G | `D2,G2,D3,G3,B3,D4` |
| Open D | `D2,A2,D3,F#3,A3,D4` |

- 音名规则：`A`–`G` + 可选 `#` 或 `b` + 八度数字（0–8），大小写不敏感；也接受 Unicode 的 `♯`/`♭`。
- 省略 `tuning` 时等价于标准调弦。
- 非法格式（个数不是 6、音名非法、八度越界、MIDI 越界）→ `400 {"error":"..."}`。
- 注意：调弦可以不是「低→高」严格递增（例如某些特殊调弦），后端按给定顺序使用，不做升序校验。

## 1. `GET /api/health`

```json
{"app":"yinjie","status":"ok"}
```

## 2. `GET /api/options`

字段：`appName`、`productName`、`roots`、`scales`、`fretRange`、`defaults`。
`tunings` 是预设列表（6 项），每项：

```json
{
  "id": "standard",
  "name": "标准调弦",
  "english": "Standard E-A-D-G-B-E",
  "tuningParam": "E2,A2,D3,G3,B3,E4",
  "strings": [
    {"index": 0, "number": 6, "openName": "E", "openMidi": 40, "openPitchClass": 4},
    ... 6 项（index 0 = 6 弦 = 低音弦）...
  ]
}
```

预设 id 顺序：`standard`、`drop-d`、`half-step-down`、`dadgad`、`open-g`、`open-d`。
另有 `defaultTuning: "standard"`。前端「自定义…」不需要后端预设，把用户选择的 6 个音按上面的格式拼成 `tuning` 参数即可。

## 3. `GET /api/fretboard`

查询参数：`rootName`、`scaleId`、`fretFrom`、`fretTo`、`accidental`、**`tuning`（可选）**。

响应结构：

- `strings[i].openName/openMidi/openPitchClass` 按所选调弦；
- `cells[i].midi/pitchClass/noteName` 按所选调弦；
- `scale.notes`、`rootPitchClass` 不受调弦影响。

## 4. `POST /api/chord/identify`

请求体：

```json
{
  "positions": [{"string": 0, "fret": 5}],
  "scaleId": "major",
  "rootName": "C",
  "tuning": "D2,A2,D3,G3,B3,E4"
}
```

- `tuning` 可选；省略 = 标准调弦。
- `selection[]`、`chord.bass`、`chord.tones` 的 `name/noteName` 都按该调弦 + 当前音阶拼写规则计算。
- 其它字段保持不变（`chord` 可为 null；`alternatives`、`hints` 保留）。

## 5. `GET /api/caged`

CAGED 系统指板图：把大调音阶在指板上的 5 个把位（C/A/G/E/D 五个和弦形状）算出来，供音阶模式下的「总览 / 各个部分」显示。

查询参数：

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `rootName` | 否 | `C` | 音阶根音，14 种拼写之一 |
| `scaleId` | 否 | `major` | 音阶 id；CAGED 形状本身按大三和弦骨架计算，音阶只影响窗内显示的音与级数 |
| `tuning` | 否 | 标准调弦 | 同上 |
| `fretFrom` / `fretTo` | 否 | `0` / `24` | 裁剪范围 |

响应：

```json
{
  "rootName": "C",
  "rootPitchClass": 0,
  "scaleId": "major",
  "scaleName": "自然大调（Ionian）",
  "tuning": "E2,A2,D3,G3,B3,E4",
  "shapes": [
    {
      "id": "C",
      "index": 1,
      "name": "C 形状",
      "english": "C Shape",
      "fretFrom": 0,
      "fretTo": 4,
      "anchor": {"string": 1, "stringNumber": 5, "fret": 3, "noteName": "C", "pitchClass": 0},
      "chordTones": [
        {"string": 1, "stringNumber": 5, "fret": 3, "noteName": "C", "pitchClass": 0, "role": "根音"},
        {"string": 2, "stringNumber": 4, "fret": 2, "noteName": "E", "pitchClass": 4, "role": "大三音"},
        {"string": 3, "stringNumber": 3, "fret": 0, "noteName": "G", "pitchClass": 7, "role": "纯五音"},
        {"string": 4, "stringNumber": 2, "fret": 1, "noteName": "C", "pitchClass": 0, "role": "根音"},
        {"string": 5, "stringNumber": 1, "fret": 0, "noteName": "E", "pitchClass": 4, "role": "大三音"}
      ],
      "cells": [
        {"string": 4, "stringNumber": 5, "fret": 0, "noteName": "A", "pitchClass": 9, "degreeLabel": "6", "inScale": true, "isRoot": false},
        ... 窗口内所有在音阶内的格子 ...
      ],
      "description": "C 形状：根音落在 5 弦 3 品，窗口 0–4 品。"
    },
    ... index 2..5（A、G、E、D 形状）...
  ],
  "order": ["C", "A", "G", "E", "D"]
}
```

字段说明：

- `index`：CAGED 体系顺序（C=1、A=2、G=3、E=4、D=5）；`order` 固定为 `["C","A","G","E","D"]`。
- `fretFrom/fretTo`：该形状在指板上的**把位窗口**（已按 `fretFrom/fretTo` 裁剪，裁剪后可能变窄，但不会为空——若窗口完全落在请求范围外则该 shape 不返回/或退化为空 `cells`，前端应能处理 `cells: []`）。
- `chordTones`：该形状的大三和弦骨架音（用于更醒目的标记），按弦序低→高排列，每根发声音各一条（同一和弦音在不同弦上会重复出现，例如 C 形状为 C/E/G/C/E 共 5 条；A、G、E 形状各 5 条、D 形状 4 条，取决于该形状实际发声音数）；被闷掉的弦不出现在这里。
- `cells`：窗口内**在音阶内**的格子（未含音阶外音）；前端据此在窗口内画音阶音，窗口外置灰即可。
- 前端渲染建议：音阶模式选「CAGED」时，用 `/api/fretboard` 画完整指板但置灰，再用本接口的 `fretFrom..fretTo` 画高亮矩形，矩形内画 `cells` 音点并叠加 `chordTones` 标记；「总览」= 5 个窗口全部显示并标注 C/A/G/E/D；「某个部分」= 只高亮其中一个窗口、其余更暗。

## 6. `POST /api/shutdown`

请求体：无。

响应（200）：

```json
{"status": "shutting_down", "message": "服务正在关闭，可以关闭本页面。"}
```

返回响应后约 0.3–1 秒内进程退出（服务不可再访问）。前端「退出」按钮：二次确认 → 调用本接口 → 把连接状态改为「已退出」并提示可关闭页面；如果请求失败也要提示手动关闭（`Ctrl+C` / 关闭启动窗口）。

## 7. 错误响应

统一 `{"error": "中文错误信息"}`：

| 情况 | 状态码 |
| --- | --- |
| 业务参数非法（根音/音阶 id/品范围/位置越界/调弦格式错） | 400 |
| 请求体 JSON 语法错误 / 参数类型不匹配 | 400 |
| HTTP 方法不支持 | 405 |
| Content-Type 不支持 | 415 |
| 未知路径 / 未知静态资源 | 404（JSON） |
| 未预期异常 | 500（日志记录） |

## 8. 前端交互规格

### 模式切换

顶部工具栏新增分段控件：**「音阶模式」|「和弦模式」**（默认音阶模式）。

- **音阶模式**：指板只展示音阶（+ 可选 CAGED 显示）；点击品格仅播放该音（音效开启时），**不产生选择、不显示和弦识别**；显示 CAGED 相关控件。
- **和弦模式**：点击品格 = 选中/取消选中，实时调用 `POST /api/chord/identify`，右侧显示和弦卡；**只有此模式才能把音阶上的音组合成和弦**；播放和弦按钮在此模式可用。CAGED 控件隐藏。

### 工具栏

1. 模式分段控件（左起第一个）。
2. 调弦下拉：6 个预设 + 「自定义…」。「自定义…」展开 6 个下拉（6 弦→1 弦，选项音名+八度，范围 E1–E7 中合理候选），有「应用」「恢复标准调弦」按钮；应用后重新请求 `/api/fretboard`（及 `/api/caged`）并保留其它选择。
3. 音阶模式下显示「音阶视图」：**总览 / CAGED 形状**；选 CAGED 后显示「部分」下拉：**全部形状 / C 形状 / A 形状 / G 形状 / E 形状 / D 形状**。
4. 保留：根音、音阶、品域（0–12/0–24）、音名/级数/两者、真实/等宽品格、音阶外音、声音开关。

### 播放和弦

和弦模式右侧和弦卡内新增 **「▶ 播放和弦」** 按钮：把当前选中的品格从低弦到高弦依次拨响（约 30–60ms 间隔扫弦，使用 `js/audio.js` 的 WebAudio 合成），音效关闭时按钮仍可用（点击即临时发声，或按声音开关语义处理——建议按钮始终可发声）。识别失败/无选择时按钮禁用。

### 退出

页面 header 右侧新增 **「退出」** 按钮：`confirm` 二次确认（说明服务会停止）→ `POST /api/shutdown` → 连接状态显示「已退出」、显示遮罩/提示「服务已停止，可以关闭此页面」，并禁用重试按钮。

### 交互/风格

- 保持纯原生 HTML/CSS/JS、无 CDN、中文 UI、现有键盘操作与错误提示。
- 所有 API 请求携带当前 `tuning` 参数；切换模式/调弦/CAGED 显示不得丢失已选根音、音阶、品域。
- 900×700 及 1400×900 下无横向滚动；控制面板新增控件后仍保持一行排列（可换行）。
