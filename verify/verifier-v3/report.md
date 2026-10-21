# yinjie v1.0 独立验收报告（verifier-v3）

- 日期：2026-10-20
- 验收员：独立验证 agent（verifier），与交付方 / Lead 相互独立
- 被测对象：`D:\STUDY\code\yinjie` 全仓 + `target/yinjie-1.0.0.jar` + `dist/yinjie-1.0.0.zip`
- 权限边界：只写 `verify/verifier-v3/`；未修改任何交付文件；未停止 8090 开发服务（PID 44492，全程存活）
- 方法：不采信 Lead / 前端报告结论，逐项独立执行命令、读镜像/读像素、比对哈希；前端主题报告的 40 项 CDP 自检因会写 `verify/frontend-blue/`（超出写权限）而改为**读取其报告 JSON + 独立视觉复核 + 独立 CDP 13/26 项复测**。

## 结论

**PASS —— 8/8 项验收全部通过，0 FAIL。交付物（jar / zip / 源码静态资源 / README / docs / 启动脚本）未发现必须修复的问题。**

在**验证记录文件**中发现 4 处 LOW / INFO 级文档不一致（不计入交付物缺陷，不影响验收结论），见 §10。

| # | 验收项 | 结果 | 关键证据 |
| --- | --- | --- | --- |
| 1 | `mvn -B test` | **PASS** | 56 tests / 0 failures / 0 errors / 0 skipped，BUILD SUCCESS（复跑两次一致）；`verify/verifier-v3/mvn-test.log` |
| 2 | 品牌 / 旧路径卫生 | **PASS** | src、README、docs、bat、pom、tools、jar 内静态资源旧品牌命中数均为 **0**；仅 `verify/frontend-blue/*`（断言用）与 `verify/archive/`（历史归档，按任务放行）含旧串 |
| 3 | README / docs/api.md 与实现一致 | **PASS** | 端点 6/6 对齐 `ApiController`；17 音阶 / 14 根音 / 6 调弦与 `/api/options` 实测一致；4 个截图引用全部存在；docs 品牌 yinjie；dist 内 README/docs 与源码逐字节一致 |
| 4 | 发布包干净环境复测 | **PASS** | sha256 双产物匹配；解压仅 4 文件、无 src/pom/mvnw；8093 干净启动；5 个静态资源 + health + title 均 200；api-sweep **174/174**、cdp-check **13/13**、cdp-v2 **26/26**；真实 `/api/shutdown` 后 8093 确认关闭；临时目录已清理 |
| 5 | `启动yinjie.bat` 静态审查 | **PASS** | release/dev 双布局、8090 预检、needs-build.ps1（实测输出 `False`）、mvnw→mvn fallback 均存在且逻辑正确；**未对 8090 执行** |
| 6 | 视觉复核（浅色主题） | **PASS** | 6 张截图逐张目检：浅色冰蓝→薄荷绿底色、背景线稿大面积可见（顶/左/右/底）、半透明白玻璃面板、深青正文、无深色主题残留；9 张截图名称/字节数与报告声称**逐项一致** |
| 7 | jar 内容 | **PASS** | 5 个静态资源齐全、`Main-Class: org.springframework.boot.loader.launch.JarLauncher`、`Start-Class: com.yinjie.YinjieApplication`；50 个 class 与当前 `target/classes` 样本比对 SAME |
| 8 | 复核报告矛盾 / 夸大点 | **PASS（含 4 处 LOW 记录）** | 详见 §10：均为验证记录文档问题，无夸大交付能力；所有量化声明可用证据支撑 |

自动化检查合计独立执行 **269 项**（56 JUnit + 174 REST + 13 CDP v1 + 26 CDP v2），另加 7 个 HTTP 探针、约 30 次 grep/哈希/镜像检查、6 张截图目检。

---

## 1. 构建与测试（项 1）

```bash
MVN="$HOME/.m2/wrapper/dists/apache-maven-3.10.0/2aaba761688b1a6ea5a46e7e5f4d5406ed7a75ee8da95e5e3079863a23461c9b/bin/mvn"
"$MVN" -B test    # 两次执行（第一次即时观察，第二次留存日志）
```

关键输出（`verify/verifier-v3/mvn-test.log`）：

```
[INFO] Tests run: 56, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  8.831 s
```

- 未执行 `package`（按任务要求，避免 8090 占用 jar 导致 `Unable to rename ... jar.original`）。
- 额外交叉验证「jar 与当前源码一致」：`unzip -p dist/yinjie/yinjie.jar BOOT-INF/classes/...` 与 `target/classes/...` 抽样 4 个 class（ApiController / YinjieApplication / ScaleCatalog / ChordIdentifier）sha256 **全部 SAME**；class 总数两边均 50；`find src pom.xml 启动yinjie.bat tools docs README.md -newer dist/yinjie-1.0.0.zip` 为空 → 发布包确由当前源码构建。

## 2. 品牌 / 旧路径卫生（项 2）

```bash
grep -rIn -E 'Fretboard Studio|fretboard-web|电吉他指板工坊|FretBoard-Trainer|com\.fretboard' \
  README.md docs/ 启动yinjie.bat pom.xml tools/ src/     # → 0 行
grep -rIl 'com\.fretboard' src/                          # → 0 文件
# jar 内 index.html / app.css / app.js / audio.js 旧品牌命中合计 → total=0
```

- 源码 `src/main/java` 全为 `com.yinjie.*`，无 `com.fretboard` 残留。
- jar 内 `index.html:7-8`：`meta description` 与 `<title>` 均为 yinjie；`index.html:34/267/280` 品牌与退出提示均为 yinjie（`unzip -p ... | grep`）。
- 旧品牌字符串仅出现在：
  - `verify/frontend-blue/report.md:30-37`、`verify/frontend-blue/cdp-verify.mjs:574-587`、`verify/frontend-blue/cdp-report.json:47` —— **断言/对照表用途**（验证旧串不存在），非交付文本；
  - `verify/archive/**` —— **历史归档**（旧品牌/旧路径文本日志），按任务说明允许保留，本报告已注明并排除。
- 类名/id 中的 `fretboard` 功能标识保留（如 `fretboard-card`），属正常实现命名，非品牌残留。

## 3. README / docs/api.md 一致性（项 3）

**端点表 vs 实现**（`src/main/java/com/yinjie/web/ApiController.java:26,44-90`）：

| README 表 (`README.md:144-151`) | 实现 |
| --- | --- |
| GET `/api/health` | `@GetMapping("/health")` :44 |
| GET `/api/options` | :50 |
| GET `/api/fretboard` | :60 |
| GET `/api/caged` | :71 |
| POST `/api/chord/identify` | :81 |
| POST `/api/shutdown` | :89 |

**数值声明 vs 实测**（`curl /api/options` → `verify/verifier-v3/options-8093.json`）：

- `scales` = **17**，id 与 README.md:59-63 的 5+7+4+1 分组完全对应（major…whole-tone）；
- `roots` = **14**：C, C#, Db, D, Eb, E, F, F#, Gb, G, Ab, A, Bb, B（README.md:64）；
- `tunings` = **6**：standard, drop-d, half-step-down, dadgad, open-g, open-d，`defaultTuning=standard`（README.md:79，`TuningCatalog.java:15-23`）；`fretRange 0–24`。
- `appName=yinjie`；`productName` codepoints `0x97f3 0x9636 0x6307 0x677f 0x5de5 0x574a`（= 音阶指板工坊，正确；终端 GBK 显示乱码仅为控制台编码）。
- 启动方式与 `src/main/resources/application.properties` 一致：`server.port=8090`、`server.address=127.0.0.1`、static file-first；README.md:17-43 的 bat / `mvn spring-boot:run` / `java -jar target/yinjie-1.0.0.jar` 三种方式与 pom `<java.version>21</java.version>`（pom.xml:22）自洽。
- 截图引用存在性：README.md:9/54/75/82 四个 `verify/frontend-blue/*.png` 全部 EXISTS。
- `docs/api.md:1` 品牌为 yinjie；`dist/yinjie/docs/api.md` 与 `docs/api.md` md5 相同（`90f73c0d…`），`dist/yinjie/README.md` 与根 README md5 相同（`2ad200a4…`）。
- 目录树：README.md:112-138 列出的 pom/README/bat/docs/tools/src 各级路径全部存在（抽查 8 项 OK）。INFO 级小差异见 §10-⑤。

## 4. 发布包干净环境复测（项 4，最高价值项）

**哈希与内容**（在全新目录解压）：

```bash
sha256sum target/yinjie-1.0.0.jar dist/yinjie/yinjie.jar dist/yinjie-1.0.0.zip
# f44c514ae79821be19810fe093bac9ffd1c1c2a0b3da1a2247a1b6d9a0d76235  target/yinjie-1.0.0.jar
# f44c514ae79821be19810fe093bac9ffd1c1c2a0b3da1a2247a1b6d9a0d76235  dist/yinjie/yinjie.jar
# 1ae93321ea95c6ad8a02a33ceb29c995386357f4e92ea2b7f944ac4ceba26d75  dist/yinjie-1.0.0.zip
```

与任务给定值**完全一致**。解压后（两种解压工具交叉验证）：

- 文件数 = **4**：`yinjie.jar`(20,882,205 B) / `启动yinjie.bat`(2,245 B) / `README.md`(15,569 B) / `docs/api.md`(9,319 B)；
- `find . -type d | grep -Ei 'src|pom|mvnw|META-INF'` → 空；无 `src/`、`pom.xml`、`mvnw.cmd`；
- 解压出的 bat 与仓库根 `启动yinjie.bat` sha256 相同（`88fdfbb4…`）；
- **zip 文件名编码**：bat 条目 UTF-8 标志位 `0x800` 已置位 → Windows `Expand-Archive` 解出正确文件名 `启动yinjie.bat`（实测）；git-bash 的 Info-ZIP `unzip` 显示为乱码是其本地编码处理问题，不是包缺陷。

**从该干净目录启动**（`java -jar yinjie.jar --server.port=8093`，工作目录即解压目录）：

| 资源 | 状态 | 大小 |
| --- | --- | --- |
| `/api/health` | 200 `{"app":"yinjie","status":"ok"}` | — |
| `/`（title=yinjie · 音阶指板工坊） | 200 | 14,713 B |
| `/css/app.css` | 200 | 62,913 B |
| `/js/app.js` | 200 | 102,619 B |
| `/js/audio.js` | 200 | 4,947 B |
| `/img/muse.png` | 200 | 847,398 B |

**三套回归（全部对 8093 干净包执行）**：

- `python verify/api-sweep.py http://127.0.0.1:8093` → **174 PASS / 0 FAIL**（「全部 174 项通过」；日志 `verify/verifier-v3/api-sweep-8093.log`，PASS=174 FAIL=0）；
- `CDP_URL=http://127.0.0.1:9333 OUT_DIR=verify/verifier-v3/cdp-out node verify/cdp-check.mjs http://127.0.0.1:8093/` → **13 PASS / 0 FAIL**（`verify/verifier-v3/cdp-check.log`，含 x32010 真实鼠标点选识别 C 大三和弦、Esc、键盘空格、调式/根音切换、console 0 错误）；
- `node verify/cdp-v2-check.mjs http://127.0.0.1:8093/` → **26 PASS / 0 FAIL**（`verify/verifier-v3/cdp-v2-check.log`；报告 `verify/verifier-v3/cdp-out/cdp-v2-report.json`：results=26、failures=0、consoleErrors=0）。

**停机验证**：cdp-v2 最后一步真实 `POST /api/shutdown`，后端返回后进程退出；随后 `netstat -ano | grep ':8093 ' | grep LISTENING` → **NO LISTENER**，`curl /api/health` → 000（不可达），后台 java 任务 exit code 0。第二轮回填日志后用 `curl -X POST /api/shutdown` 再次确认 `{"status":"shutting_down",...}` + `HTTP 200` + 8093 关闭。

**清理**：`verify/verifier-v3/tmp-release/`、`tmp-expand/` 已删除（`rm -rf` 后复查仅余日志与证据目录）。

## 5. `启动yinjie.bat` 静态审查（项 5，未执行）

逐行审查 `启动yinjie.bat:1-71`：

- `cd /d "%~dp0"`（:7）切到脚本目录；`chcp 65001`（:3）；
- **release 布局**：`RELEASE_JAR=yinjie.jar`（:10），存在即直接用（:12-14）；
- **dev 布局**：`DEV_JAR=target\yinjie-1.0.0.jar`（:11），release 不存在时回退，二者都没有则 `NEED_BUILD=1`（:14-21）；
- **8090 预检**：`netstat -ano | findstr /r /c:":8090 .*LISTENING"`（:31），已有服务则只开浏览器后 `exit /b 0`（:32-36）→ 避免重复启动，也避免打包时 jar 被占用；
- **needs-build.ps1**：`if "%NEED_BUILD%"=="0" if exist "tools\needs-build.ps1"` 调 PowerShell 取 `STALE`（:39-42）；本次实测 `powershell -File tools/needs-build.ps1` → `False`（脚本按 `target\classes` 与 `src\main\java` 时间戳比较，且考虑了 1980 固定时间戳的可复现构建，逻辑正确）；
- **mvnw → mvn fallback**：`if exist "mvnw.cmd" → call mvnw.cmd ... else where mvn → call mvn -B -q -DskipTests package`，均带错误分支（:44-64）；
- java 存在性预检（:23-28）、启动后延时开浏览器（:68）、`java -jar "%JAR%"`（:69）。
- 未发现破坏性命令；**本次未对该 bat 做任何实际执行**，尤其未触发 8090 分支。

## 6. 视觉复核（项 6）

逐张目检（`read` 工具查看原图渲染）：

| 截图 | 观察结果 |
| --- | --- |
| `verify/frontend-blue/01-initial-1400.png` | 浅冰蓝绿渐变底；背景吉他线稿在顶栏/左侧/右侧大面积露出；白色玻璃面板+模糊；深青正文；品牌「yinjie · 音阶指板工坊」；音阶模式默认 |
| `verify/frontend-blue/04-chord-x32010-1400.png` | 和弦模式，x32010 选中（E3/B1/G5/D3/A0），右侧 `C 大三和弦 / 完整匹配 / 原位 / 100 分 / 低音 C·5弦3品`；玻璃面板与浅色主题一致 |
| `verify/frontend-blue/07-exit-overlay-1400.png` | 浅色遮罩+白玻璃卡片：「服务已停止」、提示「如需再次使用，请重新运行 **yinjie** 的启动脚本」→ 无旧品牌残留 |
| `verify/frontend-blue/08-initial-900x700.png` | 900×700 布局正常、无横向滚动迹象；浅色主题、背景线稿仍可见 |
| `verify/final/01-dist-initial-1400.png` | 干净包 1400×900，与源码版视觉一致（团队验证记录） |
| `verify/final/03-dist-chord-x32010-1400.png` | 干净包点选 x32010 → C 大三 100 分；浅色主题成立（实际尺寸 1600×1100，见 §10-③） |

- **无深色主题残留**：页面 `color-scheme=light` 生效于原生控件；截图所有字/底色为深青+浅底。
- 报告声称的 **9 张截图名称/大小与实际文件逐项一致**（01:707,610 / 02:705,124 / 03:670,457 / 04:809,306 / 05:671,467 / 06:643,595 / 07:506,104 / 08:448,601 / 09:393,469 B，`ls -l` 实测全部相同）；尺寸 1400×900 与 900×700 也一致。
- `verify/frontend-blue/cdp-report.json`（只读复核）：`results=40`、`failures=0`、`consoleErrors=0`、`screenshots=9`、`palette.mismatches=[]`、`palette.missing=[]`，与报告「40 项 PASS / 23 token + 5 CAGED 一致」声明自洽。该 40 项脚本会写 `verify/frontend-blue/`（超出本人写权限），故未重跑，仅做记录复核 + 独立视觉与 CDP 13/26 项复测替代。

## 7. jar 内容（项 7）

`unzip -l dist/yinjie/yinjie.jar`（与 `target/yinjie-1.0.0.jar` sha256 相同）：

```
  62913 ... BOOT-INF/classes/static/css/app.css
 847398 ... BOOT-INF/classes/static/img/muse.png
  14713 ... BOOT-INF/classes/static/index.html
 102619 ... BOOT-INF/classes/static/js/app.js
   4947 ... BOOT-INF/classes/static/js/audio.js
```

`META-INF/MANIFEST.MF`：`Main-Class: org.springframework.boot.loader.launch.JarLauncher`、`Start-Class: com.yinjie.YinjieApplication`、`Implementation-Title: yinjie`、`Implementation-Version: 1.0.0`、`Spring-Boot-Version: 4.1.1`。静态资源齐全、入口正确，可 `java -jar` 直接运行（已实测）。

## 8. 服务与环境卫生

- 8090 开发服务：全程 `LISTENING` PID **44492**，结束前 `GET /api/health` → 200；**未被停止**。
- 8093 干净包：使用后已关闭（无 LISTENING、health 000）。
- 未发现 8091/8092 残留监听；未启动任何替代 GUI/服务。

---

## 9. 逐项证据文件清单（本目录）

| 文件 | 内容 |
| --- | --- |
| `report.md` | 本报告 |
| `mvn-test.log` | 第 2 次 `mvn -B test` 完整日志（56 tests / BUILD SUCCESS） |
| `api-sweep-8093.log` | 干净包 174 项 REST 冒烟日志（PASS=174 FAIL=0） |
| `cdp-check.log` | 干净包 CDP v1 交互日志（13 PASS / 0 FAIL） |
| `cdp-v2-check.log` | 干净包 CDP v2 交互日志（26 PASS / 0 FAIL，含真实停机） |
| `cdp-out/cdp-report.json` `cdp-out/cdp-v2-report.json` | 两套 CDP 结构化报告 |
| `cdp-out/*.png` | 本次复测生成的 7 张截图（v1 2 张 + v2 7 张，含 v2-shutdown.png） |
| `options-8093.json` | `/api/options` 实测响应（17/14/6 计数依据） |

## 10. 发现的问题（均为验证记录文档级，不涉及交付物）

| # | 严重级别 | 位置 | 问题 | 影响 / 建议 |
| --- | --- | --- | --- | --- |
| ① | **LOW** | `verify/frontend-blue/report.md:16` | 声称 `css/app.css` 为 `63,154 B`，实际源码/jar 均为 **62,913 B**（差 241 B）；同目录 `verify/final/README.md:43` 写的 62,913 B 才正确 | 仅验证报告记录陈旧；交付文件无问题。建议把该数字改为 62,913 B |
| ② | **INFO** | `verify/frontend-blue/report.md:25` | 称「README 引用的三张截图（01、04、06）」，但 README（20:41 更新，晚于报告 20:37）现引用**四张**（含 `02-caged-overview-1400.png`，README.md:75） | 纯记录漂移；4 个引用实测全部存在。建议更新措辞 |
| ③ | **LOW** | `verify/final/README.md:89-90` 及文件名 | `03-dist-chord-x32010-1400.png`、`04-dist-shutdown-overlay.png` 文件名带「1400」，实际尺寸均为 **1600×1100**（`file`/镜像实测） | 文件名与内容不符；内容本身正确（C 大三 100 分 / 服务已停止遮罩）。建议重命名或注明实际视口 |
| ④ | **INFO** | `verify/final/README.md:68-71` | 声称最终 zip 曾用 8092 复测并优雅停机，但 `verify/final/` 未保留 8092 日志 | 无法从证据复核该条；本次已在 8093 独立完成同等级复测（更强证据）。建议补日志或删该条 |
| ⑤ | **INFO** | `README.md:112-138` 目录树 | 树中未列 `background/`（README.md:104 正文引用了 `background/20260110_003715.jpg`）与根目录运行日志 | 纯文档完整性；不影响使用。建议目录树补一行 `background/` |
| ⑥ | **INFO** | 本机工具 | git-bash `unzip` 把 zip 内 `启动yinjie.bat` 显示为乱码 | 非包缺陷：条目 UTF-8 标志位 `0x800` 已置位，Windows `Expand-Archive` 解出正确中文名（已实测）。建议改用 Expand-Archive/资源管理器解压 |
| ⑦ | — | `verify/archive/**` | 含旧品牌（Fretboard Studio / fretboard-web / 电吉他指板工坊等）历史文本 | 按任务说明**允许保留**为历史归档；已在 §2 注明并从品牌卫生统计中排除 |

**必须修复项：无。**（①②③⑤ 属验证/说明文档文字层面，交付 jar/zip/README/docs/bat 无需改动；是否修由 Lead 决定。）

## 11. 残余风险

1. **自检脚本的独立性**：`api-sweep.py`、`cdp-check.mjs`、`cdp-v2-check.mjs`、`cdp-verify.mjs` 均为项目自带脚本，虽由本验收员独立执行且全绿，但断言范围受脚本作者覆盖范围限制；不能等同于第三方认证。本次补充了哈希、镜像、源码-jar 字节比对等脚本外证据。
2. **前端 40 项 CDP 未重跑**：因脚本固定写入 `verify/frontend-blue/`（超出只写 `verify/verifier-v3/` 的权限），改为复核其 `cdp-report.json`（40/0/0、9 截图、palette 无不一致）+ 目检截图 + 独立 CDP 13/26 项。若需完全重跑，建议 Lead 在授权后执行。
3. **背景可见面积 35.6% / 38.4%** 为前端报告自测的像素差数据，本次仅做定性复核（截图目检确认大面积可见），未独立复现像素差统计。
4. **`启动yinjie.bat` 未端到端执行**（按指令不做，避免影响 8090 / 触发重打包）；仅静态审查 + `needs-build.ps1` 单独实测。发布包内 bat 的中文名与内容已通过解压+哈希验证。
5. **未从源码重新 `package`**：受 8090 jar 占用限制未跑 `mvn package`；但已用「jar 内 class 与当前 `target/classes` 抽样 sha256 相同 + 无新于发布包的源码 + 双产物哈希匹配」证明 jar 由当前源码构建。
6. **视觉判断主观性**：浅色主题/玻璃面板/线稿可见度以人眼目检为准；不同显示器可能有观感差异。
7. **zip 中文名兼容性**：UTF-8 标志位正确，Windows 自带解压正常；极老第三方解压工具（不识别 UTF-8 flag）可能显示乱码，属工具兼容性非交付缺陷。

## 12. 建议

1. 交付物无需改动，可判 **验收通过**。
2. 建议 Lead 顺手修正 ①②③ 三处验证记录文字（app.css 字节数、README 截图数量、final 截图文件名/尺寸），使报告与实物完全一致；④⑤ 可选。
3. 若后续改动前端或后端，务必重新 `mvn -B package` + `tools/build-dist.ps1`，并重跑 `api-sweep` + `cdp-check` + `cdp-v2`（最后一项须对干净包/空闲端口执行）。
4. 建议将 `verify/archive/` 在交付说明中标为历史归档（或移出发布仓），避免品牌扫描误报。
5. 建议在 CI 或验收清单中固化「双产物 sha256 + 干净包 4 文件结构 + 真实停机」三项，作为发布门禁。

---

# 13. 增量复核：v3.1.1 性能修复后重建（2026-10-20 晚）

- 触发：用户反馈「拖动卡顿」，交付方移除前端 14 处 `backdrop-filter`、muse 的 `mix-blend-mode`、canvas 逐音符 `shadowBlur`，随后**重建 jar/zip**（仅 `app.css`、`app.js` 变化，Java 未动）。
- 范围：本轮为**增量复核**（未重跑 20 分钟全套）。§1–§12 的旧结论对应旧产物（jar sha `f44c51…` / zip sha `1ae933…`），**已被本节新产物取代**；旧报告中的其余结论（品牌卫生、README/docs 一致性、bat 审查、jar 结构、视觉主题）仍适用。
- 时间：2026-10-20 21:36–21:40。环境：8090 = Lead 服务（未被触碰），8093 归本次使用，CDP 自建 headless Edge 于 9335（未占用 9334）。
- **结论：PASS**。sha256 双匹配、干净包门禁全绿、无意外资源/类变更。

## 13.1 产物哈希与大小

| 产物 | 大小（B） | sha256 | 与 Lead 提供值 |
| --- | --- | --- | --- |
| `target/yinjie-1.0.0.jar` | 20,881,879 | `eed793dc1d48ec7543d2e8787199f923fba5094320dd7f9dd7c6f9490e8e2ccd` | **匹配** |
| `dist/yinjie/yinjie.jar` | 20,881,879 | 同上 | **匹配**（与 target 同哈希） |
| `dist/yinjie-1.0.0.zip` | 19,032,518 | `f3b8de4defa2507d3583620f78077064241c889b3df786c167b0a2634bcbb38d` | **匹配** |

## 13.2 发布包结构（重新解压到全新目录 `verify/verifier-v3/tmp-release311/`）

`python -m zipfile` 解压（UTF-8 文件名正确处理）：

| 条目 | 大小（B） | UTF-8 flag | 说明 |
| --- | --- | --- | --- |
| `yinjie/yinjie.jar` | 20,881,879 | — | 哈希同 target |
| `yinjie/启动yinjie.bat` | 2,245 | **True** | 与仓库根 bat sha256 相同 `88fdfbb4…`，中文名解压正确 |
| `yinjie/README.md` | 16,145 | — | 与仓库根 README md5 相同 `f3f7c8fe…`（已更新，含性能说明） |
| `yinjie/docs/api.md` | 9,319 | — | 与源码 docs md5 相同 `90f73c0d…`（未变） |

- 解压后严格 **4 个文件 / 2 个目录（`yinjie/`、`yinjie/docs/`）**；`find -iname pom.xml / mvnw* / src` → 空；无多余额外文件。
- `README.md:11` 明确「发布包中不包含 `verify/` 与截图文件」，与实物一致；`README.md:104` 新增性能说明（不使用 backdrop-filter / mix-blend-mode / 逐音符 canvas 阴影）。

## 13.3 jar 内容与变更面核对

- `BOOT-INF/classes/static/` 共 5 个静态资源，**仅 css/js 变化**（旧值对照上一轮报告）：

| 资源 | 旧（B） | 新（B） | 变化 |
| --- | --- | --- | --- |
| `css/app.css` | 62,913 | **59,191** | −3,722 |
| `js/app.js` | 102,619 | **99,367** | −3,252 |
| `index.html` | 14,713 | 14,713 | 未变 |
| `js/audio.js` | 4,947 | 4,947 | 未变 |
| `img/muse.png` | 847,398 | 847,398 | 未变 |

- jar 条目总数 **232**，其中 `BOOT-INF/classes/com/yinjie/**/*.class` = **50**，`BOOT-INF/lib/*.jar` = **34**（Spring Boot 4.1.1 / Spring 7.0.9 / Jackson 3.1.5 / Tomcat 11.0.24 等），与上一轮类数一致；无新增/缺失业务类（清单见 §13.7 证据命令）。
- `META-INF/MANIFEST.MF` 关键字段与上轮一致：`Main-Class: org.springframework.boot.loader.launch.JarLauncher`、`Start-Class: com.yinjie.YinjieApplication`、`Implementation-Title: yinjie`、`Version 1.0.0`、`Java-Version: 21`、`Spring-Boot-Version: 4.1.1`。
- **Java 未变证据**：`unzip -p jar BOOT-INF/classes/<c>.class | sha256` 与当前 `target/classes/<c>.class` 抽样 4 个（ApiController / YinjieApplication / ScaleCatalog / ChordIdentifier）**全部 SAME**；`target/classes` 共 50 个 class；`find src pom.xml 启动yinjie.bat tools docs README.md -newer dist/yinjie-1.0.0.zip` → **空**（无源码新于发布包）；Java 源码 mtime 仍为 19:28。
- 源码静态资源与 jar 内静态资源 sha256 **5/5 SAME**（说明重建 jar 已包含最新 css/js）。

## 13.4 干净包门禁（8093，从 `tmp-release311/yinjie/` 直接 `java -jar yinjie.jar --server.port=8093`）

| 检查 | 结果 |
| --- | --- |
| `GET /api/health` | 200 `{"app":"yinjie","status":"ok"}` |
| `GET /` | 200，14,713 B，`<title>yinjie · 音阶指板工坊</title>` |
| `GET /css/app.css` | 200，**59,191 B**（符合新值） |
| `GET /js/app.js` | 200，**99,367 B**（符合新值） |
| `GET /img/muse.png` | 200，847,398 B |
| `GET /js/audio.js` | 200，4,947 B |
| `python verify/api-sweep.py http://127.0.0.1:8093` | **174 PASS / 0 FAIL**（「全部 174 项通过」；`api-sweep-8093-v311.log`） |
| `CDP_URL=http://127.0.0.1:9335 node verify/cdp-check.mjs http://127.0.0.1:8093/` | **13 PASS / 0 FAIL**，consoleErrors=0；`cdp-check-v311.log` + `cdp-out311/cdp-report.json` + 2 张截图 |

CDP v1 覆盖真实鼠标点选 `x32010` → C 大三和弦、Esc、方向键+空格试听、调式/根音切换，全部通过。截图 `verify/verifier-v3/cdp-out311/ui-c-major-chord.png`（1600×1100）：浅色冰蓝绿主题、大面积背景线稿、玻璃面板（现为纯半透明、无模糊）、C 大三和弦 100 分、无深色残留 → 性能优化未造成视觉主题回归。

## 13.5 性能修复实现痕迹（补充核验）

| 检查 | 结果 |
| --- | --- |
| `app.css` 中 `backdrop-filter` | **0**（`-webkit-backdrop-filter` 也 0） |
| `app.css` 中 `mix-blend-mode` | **0**（muse 混合已移除） |
| `app.js` 中 `shadowBlur` | 3 处文本命中：`app.js:826`（整块指板**单次**阴影）、`:861`（单次描边阴影）、`:1041` 注释「直接填充，不做逐个标记的 canvas shadow（一屏 140+ 个标记…）」→ **逐音符 shadowBlur 确已移除**，剩余 2 处非逐音符，符合声明 |
| 剩余 `filter:` | 仅 `app.css:259` 一处 `filter: drop-shadow(...)`（静态元素、非每帧），可接受 |

## 13.6 与旧产物的差异清单

**预期内差异（全部对应本次性能修复重建）**：

1. `app.css` −3,722 B、`app.js` −3,252 B（移除 backdrop-filter / mix-blend / 逐音符阴影）；
2. `README.md` +576 B（新增性能说明与测量方法），docs/api.md、bat 未变；
3. jar 20,882,205 → **20,881,879**（−326 B）；zip 19,032,460 → **19,032,518**（+58 B，zip 重压缩差异）。

**意外差异：无。** 类数/类字节、lib 数量、index.html/audio.js/muse.png、MANIFEST、docs 均与上一轮一致；无新增文件、无旧文件缺失。

## 13.7 本轮证据文件

| 文件 | 内容 |
| --- | --- |
| `api-sweep-8093-v311.log` | 干净包 174 项 REST 冒烟（PASS=174 FAIL=0） |
| `cdp-check-v311.log` | 干净包 CDP v1（13 PASS / 0 FAIL / console 0） |
| `cdp-out311/cdp-report.json`、`cdp-out311/ui-*.png` | CDP 结构化报告与截图 |

sha256/大小/zip 清单/jar 清单/镜像比对/`find -newer` 等命令输出见本节各表；临时解压目录 `tmp-release311/` 与自建 8093 服务、9335 Edge 已在复核结束后清理/关闭。

## 13.8 本轮残余风险（增量范围）

1. 按 Lead 指定的增量范围，**未重跑** `mvn -B test`（56 tests）与 `cdp-v2-check`（26 项真实停机）：Java 类字节与已测构建完全一致、Java 源码 mtime 未变，故 56 项单测结论沿用；`/api/shutdown` 真实停机行为属后端，未改，沿用上轮 26/26 结论。如需严格执行全量门禁，可再跑一轮。
2. 前端 40 项 CDP 自检仍未重跑（`cdp-verify.mjs` 会写 `verify/frontend-blue/`，超出本验收员写权限），沿用上轮记录复核 + 本轮 13 项独立复测 + 视觉目检。
3. 性能收益本身（帧间隔 59–64ms → 60fps）来自交付方测量（`verify/frontend-blue/perf-probe.mjs`），本轮只验证「修复痕迹存在于产物且功能/视觉未回归」，未在验收环境复测 fps。
4. `app.css:259` 保留 1 处静态 `drop-shadow`、`app.js` 保留 2 处单次 canvas 阴影：均为一次性/低频绘制，非逐帧合成，判断对拖动性能影响可忽略。
