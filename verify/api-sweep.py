# -*- coding: utf-8 -*-
"""yinjie REST API 冒烟测试（无第三方依赖，标准库 urllib）。

用法: python verify/api-sweep.py [base_url]
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090").rstrip("/")
failures = []
checks = []


def check(name, condition, detail=""):
    checks.append((name, bool(condition), detail))
    if not condition:
        failures.append(name + (": " + str(detail) if detail != "" else ""))
    print(("PASS  " if condition else "FAIL  ") + name + (" — " + str(detail) if detail else ""))


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def post(path, payload):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def positions(shape):
    return [{"string": s, "fret": f} for (s, f) in shape]


# ---------------------------------------------------------------- options
options = get("/api/options")
check("options: 14 个根音拼写", len(options["roots"]) == 14, len(options["roots"]))
check("options: 17 种音阶", len(options["scales"]) == 17, len(options["scales"]))
check("options: 6 个调弦预设", len(options["tunings"]) == 6, [t["id"] for t in options["tunings"]])
check("options: 默认调弦 standard",
      options.get("defaultTuning") == "standard" and options["tunings"][0]["id"] == "standard",
      options.get("defaultTuning"))
check("options: 每个预设 6 弦且有 tuningParam",
      all(len(t["strings"]) == 6 and t.get("tuningParam") for t in options["tunings"]),
      [t.get("tuningParam") for t in options["tunings"]])
check("options: 标准调弦 6 弦空弦音",
      [(s["number"], s["openName"]) for s in options["tunings"][0]["strings"]]
      == [(6, "E"), (5, "A"), (4, "D"), (3, "G"), (2, "B"), (1, "E")],
      options["tunings"][0]["strings"])
check("options: 品域 0-24", options["fretRange"] == {"min": 0, "max": 24}, options["fretRange"])

# ---------------------------------------------------------------- fretboard
scale_cases = [
    ("C", "major", 0, 12, ["C", "D", "E", "F", "G", "A", "B"]),
    ("A", "natural-minor", 0, 12, ["A", "B", "C", "D", "E", "F", "G"]),
    ("F#", "major", 0, 12, ["F#", "G#", "A#", "B", "C#", "D#", "E#"]),
    ("F", "major", 0, 12, ["F", "G", "A", "Bb", "C", "D", "E"]),
    ("Bb", "dorian", 0, 12, ["Bb", "C", "Db", "Eb", "F", "G", "Ab"]),
    ("A", "blues", 0, 12, ["A", "C", "D", "D#", "E", "G"]),
    ("C", "harmonic-minor", 0, 12, ["C", "D", "Eb", "F", "G", "Ab", "B"]),
    ("Eb", "lydian", 0, 24, ["Eb", "F", "G", "A", "Bb", "C", "D"]),
    ("B", "locrian", 0, 12, ["B", "C", "D", "E", "F", "G", "A"]),
    ("D", "mixolydian", 0, 12, ["D", "E", "F#", "G", "A", "B", "C"]),
    ("G", "major-pentatonic", 0, 12, ["G", "A", "B", "D", "E"]),
    ("C", "whole-tone", 0, 12, ["C", "D", "E", "F#", "G#", "A#"]),
]

for root, scale_id, fret_from, fret_to, expected_notes in scale_cases:
    query = urllib.parse.urlencode(
        {"rootName": root, "scaleId": scale_id, "fretFrom": fret_from, "fretTo": fret_to})
    data = get("/api/fretboard?" + query)
    names = [note["name"] for note in data["scale"]["notes"]]
    check("fretboard %s %s 音阶拼写" % (root, scale_id), names == expected_notes, names)
    strings = data["strings"]
    expected_cells = len(strings) * (fret_to - fret_from + 1)
    check("fretboard %s %s 格数 %d" % (root, scale_id, expected_cells), len(data["cells"]) == expected_cells,
          len(data["cells"]))
    bad = [cell for cell in data["cells"] if cell["inScale"] != (cell["degreeLabel"] != "")]
    check("fretboard %s %s 音阶内标记一致" % (root, scale_id), not bad, bad[:2])
    roots = [cell for cell in data["cells"] if cell["isRoot"]]
    check("fretboard %s %s 根音格均在音阶内" % (root, scale_id), all(cell["inScale"] for cell in roots))
    check("fretboard %s %s 根音格存在" % (root, scale_id), len(roots) > 0, len(roots))

# ---------------------------------------------------------------- chord identify
shape_cases = [
    ("C x32010", [(1, 3), (2, 2), (3, 0), (4, 1), (5, 0)], "C", "完整匹配"),
    ("Am x02210", [(1, 0), (2, 2), (3, 2), (4, 1), (5, 0)], "Am", "完整匹配"),
    ("G 320003", [(0, 3), (1, 2), (2, 0), (3, 0), (4, 0), (5, 3)], "G", "完整匹配"),
    ("E7 020100", [(0, 0), (1, 2), (2, 0), (3, 1), (4, 0), (5, 0)], "E7", "完整匹配"),
    ("Dm7 xx0211", [(2, 0), (3, 2), (4, 1), (5, 1)], "Dm7", "完整匹配"),
    ("F 133211", [(0, 1), (1, 3), (2, 3), (3, 2), (4, 1), (5, 1)], "F", "完整匹配"),
    ("B7 x21202", [(1, 2), (2, 1), (3, 2), (4, 0), (5, 2)], "B7", "完整匹配"),
    ("Dsus4 xx0233", [(2, 0), (3, 2), (4, 3), (5, 3)], "Dsus4", "完整匹配"),
    ("Cmaj7 x32000", [(1, 3), (2, 2), (3, 0), (4, 0), (5, 0)], "Cmaj7", "完整匹配"),
    ("C/E 032010", [(0, 0), (1, 3), (2, 2), (3, 0), (4, 1), (5, 0)], "C/E", "完整匹配"),
    ("E5 022xxx", [(0, 0), (1, 2), (2, 2)], "E5", "完整匹配"),
    ("Dm xx0231", [(2, 0), (3, 2), (4, 3), (5, 1)], "Dm", "完整匹配"),
]

for label, shape, expected_symbol, expected_match in shape_cases:
    data = post("/api/chord/identify", {"positions": positions(shape), "scaleId": "major", "rootName": "C"})
    chord = data["chord"]
    check("identify %s 识别和弦" % label, chord is not None, "无结果" if chord is None else "")
    if not chord:
        continue
    check("identify %s 符号=%s" % (label, expected_symbol), chord["symbol"] == expected_symbol, chord["symbol"])
    check("identify %s 匹配类型=%s" % (label, expected_match), chord["matchType"] == expected_match,
          chord["matchType"])
    check("identify %s 无缺失/额外音" % label, not chord["missing"] and not chord["extra"],
          "missing=%s extra=%s" % (chord["missing"], chord["extra"]))
    check("identify %s 构成音齐全" % label, all(tone["present"] for tone in chord["tones"]))
    check("identify %s score>=90" % label, chord["score"] >= 90, chord["score"])
    check("identify %s 选中音标注" % label, len(data["selection"]) == len(shape), len(data["selection"]))

# 拼写：Eb 调上下文 Eb 大三和弦 x68886 -> Eb G Bb
data = post("/api/chord/identify", {"positions": positions([(1, 6), (2, 8), (3, 8), (4, 8), (5, 6)]),
                                    "scaleId": "major", "rootName": "Eb"})
eb_chord = data["chord"]
check("identify Eb 调上下文 Eb 和弦符号", eb_chord is not None and eb_chord["symbol"] == "Eb",
      eb_chord["symbol"] if eb_chord else None)
check("identify Eb 调和弦拼写 Eb-G-Bb",
      eb_chord is not None and [tone["noteName"] for tone in eb_chord["tones"]] == ["Eb", "G", "Bb"],
      [tone["noteName"] for tone in eb_chord["tones"]] if eb_chord else None)
check("identify Eb 调和弦无缺失/额外音", eb_chord is not None and not eb_chord["missing"] and not eb_chord["extra"],
      ("missing=%s extra=%s" % (eb_chord["missing"], eb_chord["extra"])) if eb_chord else None)

# 错误处理
try:
    post("/api/chord/identify", {"positions": [{"string": 9, "fret": 0}]})
    check("identify 非法弦号返回 400", False)
except urllib.error.HTTPError as error:
    body = json.loads(error.read().decode("utf-8"))
    check("identify 非法弦号返回 400", error.code == 400 and "error" in body, error.code)

try:
    get("/api/fretboard?rootName=H&scaleId=major")
    check("fretboard 非法根音返回 400", False)
except urllib.error.HTTPError as error:
    check("fretboard 非法根音返回 400", error.code == 400, error.code)

# ---------------------------------------------------------------- v2: tunings
def fretboard_query(**params):
    return get("/api/fretboard?" + urllib.parse.urlencode(params))


drop_d = fretboard_query(rootName="C", scaleId="major", tuning="D2,A2,D3,G3,B3,E4")
check("tuning Drop D：6 弦空弦 D/38",
      (drop_d["strings"][0]["openName"], drop_d["strings"][0]["openMidi"]) == ("D", 38),
      drop_d["strings"][0])
check("tuning Drop D：6 弦 0 品为 D 音阶内二级",
      drop_d["cells"][0]["noteName"] == "D" and drop_d["cells"][0]["degreeLabel"] == "2",
      drop_d["cells"][0])
dadgad = fretboard_query(rootName="C", scaleId="major", tuning="D2,A2,D3,G3,A3,D4")
check("tuning DADGAD：2 弦 A/57、1 弦 D/62",
      (dadgad["strings"][4]["openMidi"], dadgad["strings"][5]["openMidi"]) == (57, 62),
      [(s["openName"], s["openMidi"]) for s in dadgad["strings"]])
custom = fretboard_query(rootName="C", scaleId="major", tuning="D3,A2,D3,G3,B3,E4")
check("tuning 自定义：6 弦空弦 D3/50 且 0 品音高 50",
      (custom["strings"][0]["openName"], custom["strings"][0]["openMidi"], custom["cells"][0]["midi"])
      == ("D", 50, 50),
      custom["strings"][0])

# 非法 tuning 参数 → 400
for bad in ["E2,A2,D3", "E2,A2,D3,G3,B3,H4", "E2,A2,D3,G3,B3,E9"]:
    try:
        get("/api/fretboard?rootName=C&scaleId=major&tuning=" + urllib.parse.quote(bad))
        check("tuning 非法参数返回 400: " + bad, False)
    except urllib.error.HTTPError as error:
        check("tuning 非法参数返回 400: " + bad, error.code == 400, error.code)

# identify 携带 tuning：Drop D 三根空弦 6/5/4 弦 → D5
data = post("/api/chord/identify", {"positions": positions([(0, 0), (1, 0), (2, 0)]),
                                    "scaleId": "major", "rootName": "C",
                                    "tuning": "D2,A2,D3,G3,B3,E4"})
drop_chord = data["chord"]
check("identify Drop D 三空弦 → D5",
      drop_chord is not None and drop_chord["symbol"] == "D5",
      drop_chord["symbol"] if drop_chord else None)
check("identify Drop D 低音为 6 弦 0 品 D",
      drop_chord is not None and drop_chord["bass"]["fret"] == 0 and drop_chord["bass"]["noteName"] == "D"
      and drop_chord["bass"]["pitchClass"] == 2,
      drop_chord["bass"] if drop_chord else None)
data = post("/api/chord/identify", {"positions": positions([(1, 3), (2, 2), (3, 0), (4, 1), (5, 0)]),
                                    "scaleId": "major", "rootName": "C",
                                    "tuning": "E2,A2,D3,G3,B3,E4"})
check("identify 标准调弦参数下 x32010 仍为 C",
      data["chord"] is not None and data["chord"]["symbol"] == "C",
      data["chord"]["symbol"] if data["chord"] else None)

# ---------------------------------------------------------------- v2: CAGED
caged = get("/api/caged?rootName=C&scaleId=major")
check("caged C 大调 5 个形状且顺序 C,A,G,E,D",
      [shape["id"] for shape in caged["shapes"]] == ["C", "A", "G", "E", "D"],
      [shape["id"] for shape in caged["shapes"]])
check("caged order 字段", caged.get("order") == ["C", "A", "G", "E", "D"], caged.get("order"))
by_id = {shape["id"]: shape for shape in caged["shapes"]}
check("caged C 形状锚 5 弦 3 品、窗口 0–4",
      by_id["C"]["anchor"]["string"] == 1 and by_id["C"]["anchor"]["stringNumber"] == 5
      and by_id["C"]["anchor"]["fret"] == 3 and (by_id["C"]["fretFrom"], by_id["C"]["fretTo"]) == (0, 4),
      by_id["C"]["anchor"])
check("caged 每个形状都有 chordTones 与 cells",
      all(shape["chordTones"] and shape["cells"] for shape in caged["shapes"]),
      [(shape["id"], len(shape["chordTones"]), len(shape["cells"])) for shape in caged["shapes"]])
caged_fs = get("/api/caged?rootName=F%23&scaleId=major")
check("caged F# 大调 C 形状锚 9 品",
      {s["id"]: s for s in caged_fs["shapes"]}["C"]["anchor"]["fret"] == 9,
      {s["id"]: s for s in caged_fs["shapes"]}["C"]["anchor"])
caged_drop = get("/api/caged?rootName=C&scaleId=major&tuning=D2,A2,D3,G3,B3,E4")
check("caged 随 Drop D 调弦变化（E 形状锚 6 弦 10 品）",
      {s["id"]: s for s in caged_drop["shapes"]}["E"]["anchor"]["fret"] == 10,
      {s["id"]: s for s in caged_drop["shapes"]}["E"]["anchor"])
caged_clip = get("/api/caged?rootName=C&scaleId=major&fretFrom=0&fretTo=3")
check("caged 窗口裁剪后可只剩部分形状",
      0 < len(caged_clip["shapes"]) < 5,
      [shape["id"] for shape in caged_clip["shapes"]])

# ---------------------------------------------------------------- static
with urllib.request.urlopen(BASE + "/", timeout=15) as response:
    html = response.read().decode("utf-8")
    check("静态首页 200 且包含产品名",
          response.status == 200 and "yinjie" in html.lower() and "音阶指板工坊" in html,
          response.status)

print()
if failures:
    print("共 %d 项失败:" % len(failures))
    for item in failures:
        print(" -", item)
    sys.exit(1)
print("全部 %d 项检查通过" % len(checks))
