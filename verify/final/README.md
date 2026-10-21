# yinjie v1.0 集成验收记录（verify/final）

- 日期：2026-10-20
- 本目录用途：记录 **浅色 v3.1 主题 + 独立发布包** 的最终集成门禁（Lead 执行），与 `verify/frontend-blue/report.md`（前端主题专报告）、`verify/verifier-v3/`（独立验证报告）互为补充。
- 被测对象：`target/yinjie-1.0.0.jar` 与 `dist/yinjie-1.0.0.zip`（**v3.1.1 性能修复 + 启动脚本修复 + 自动安装 Java（v1.0.2）后重建**：前端仅 `static/css/app.css`、`static/js/app.js` 变化；`启动yinjie.bat` 修复编码与 Java 检测；Java 代码/测试未动）。

## 1. 构建产物

| 产物 | 大小 | SHA-256 |
| --- | --- | --- |
| `target/yinjie-1.0.0.jar` | 20,881,879 B | `EED793DC1D48EC7543D2E8787199F923FBA5094320DD7F9DD7C6F9490E8E2CCD` |
| `dist/yinjie/yinjie.jar` | 20,881,879 B | 同上（由 build-dist.ps1 从 target 拷贝） |
| `dist/yinjie-1.0.0.zip` | 19,037,741 B | `55917C834CE32AF7BBEB8BE6C22F652D4F9EA414DE3CC37DD10AA33BE85E978A` |

> 历史：性能修复前（浅色 v3.1 首版）jar `f44c514…` / zip `1ae93321…`；性能修复后首版 zip `f3b8de4d…`；启动脚本修复版 zip `f825b2f6…`；README 增加「更新日志」后的 zip `4d8fc9d2…` 与修复文档转义后的最终 zip `916a8379…`。jar 自 `eed793dc…` 起未再变化，后两次重建只改 `启动yinjie.bat` 与 `README.md`。此后加入「没有 Java 时自动下载安装」特性（v1.0.2）又重建 3 次：zip `6f32f9cd…`（19,037,559 B，新增 `tools\ensure-java.ps1` + README v1.0.2）→ `7409925e…`（19,037,581 B，`启动yinjie.bat` 加 `YINJIE_NO_BROWSER` 开关）→ 最终 `55917c83…`（19,037,741 B，`启动yinjie.bat` 加 `YINJIE_FORCE_DOWNLOAD` 诊断开关）；期间 jar 字节仍未变。

构建命令：停掉 8090 服务后 `mvn -B clean package`（Maven 3.10.0 / JDK 27 运行，编译目标 Java 21）→ **56 个测试全部通过**：

```
[INFO] Tests run: 56, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

> 注意（Windows 文件锁）：`spring-boot:repackage` 需要重命名 jar，若 8090 正用该 jar 运行会报
> `Unable to rename '...\target\yinjie-1.0.0.jar' to '...jar.original'`；因此重打包前必须先停服务。

发布包内容（`tools/build-dist.ps1`，zip 根为 `yinjie\`）：

```
yinjie\yinjie.jar             20,881,879 B
yinjie\启动yinjie.bat               4,795 B
yinjie\README.md                20,586 B
yinjie\docs\api.md               9,319 B
yinjie\tools\ensure-java.ps1     6,154 B
```

包内无 `src/`、`pom.xml`、`mvnw.cmd`（已验证），jar 内嵌全部静态资源（index.html / css / js / img/muse.png）。

## 2. 空环境门禁（干净释放包，不依赖源码与 Maven）

1. `Expand-Archive dist\yinjie-1.0.0.zip` 到全新临时目录；
2. `java -jar yinjie.jar --server.port=8091` 启动；
3. 结果：
   - `/api/health` → `{"app":"yinjie","status":"ok"}`；
   - `/` → `<title>yinjie · 音阶指板工坊</title>`；
   - `/css/app.css` 200 / 59,191 B、`/js/app.js` 200 / 99,367 B、`/js/audio.js` 200 / 4,947 B、`/img/muse.png` 200 / 847,398 B（全部来自 jar 内嵌静态资源）。

### 2.1 REST API 全量冒烟（对 8091 干净包）

```
python verify/api-sweep.py http://127.0.0.1:8091
→ 全部 174 项通过（174 PASS / 0 FAIL）
```

日志：`api-sweep-8091.log`。

### 2.2 浏览器交互回归（对 8091 干净包，headless Edge + CDP）

```
node verify/cdp-check.mjs http://127.0.0.1:8091
→ 13 PASS / 0 FAIL / 0 console error（含 x32010 鼠标点选识别 C 大三和弦、原位信息、Esc、键盘空格、调式/根音切换）

node verify/cdp-v2-check.mjs http://127.0.0.1:8091
→ 26 PASS / 0 FAIL / 0 console error（音阶/和弦模式门控、点选识别、播放和弦、CAGED 总览/单形状、Drop D、自定义调弦编辑器、真实退出停机）
→ 最后一步真实调用 POST /api/shutdown，8091 端口已确认关闭（进程退出）
```

日志：`cdp-check-8091.log`、`cdp-v2-8091.log`。
> 本次修复了 `verify/cdp-check.mjs` 的一处陈旧假设：v2 起页面默认「音阶模式」点击只试听、不组和弦，脚本现在会先切到「和弦模式」再做点选断言（脚本内已注释说明）。

### 2.3 最终 zip 复核（README 更新后重新 build-dist）

重新解压最终 `dist/yinjie-1.0.0.zip` 到全新临时目录，`java -jar yinjie.jar --server.port=8092`：
`/api/health` → `{"app":"yinjie","status":"ok"}`、`<title>yinjie · 音阶指板工坊</title>`、`/img/muse.png` 200 / 847,398 B；
`/css/app.css` 200 / 59,191 B、`/js/app.js` 200 / 99,367 B；`POST /api/shutdown` 返回 `{"status":"shutting_down",...}` 后 8092 端口确认关闭（优雅停机）。完整记录见 `gate-8092.log`（已按重建后的 zip 重新生成）。

### 2.4 启动脚本（`启动yinjie.bat`）修复与实机验证

用户反馈「脚本打不开」，实测根因都在启动脚本（与 jar/前端无关）：

1. **编码**：脚本原为 UTF-8 无 BOM，而中文 Windows 的 `cmd` 默认代码页 936（GBK）。cmd 会把 `if (...)` / `for (...)` 括号块整体按 GBK 读取，块内中文字节被误判后吞掉引号/反斜杠，报 `'R"' 不是内部或外部命令` 之类错误后直接退出。
2. **Java 检测逻辑 bug**：`where java` 成功后变量被设为裸命令名 `java`，随后却用 `if not exist "java"` 校验（把命令名当文件路径），必然判不存在，于是误报「找不到 java」——即使已装 JDK 也无法启动。

修复：脚本按 **ANSI/GBK + CRLF** 保存；Java 查找改为「PATH → `JAVA_HOME\bin\java.exe` → 扫描 Program Files 下 Java / Eclipse Adoptium / Microsoft / Amazon Corretto / Zulu / 32 位 Java」，全部找不到才提示并 pause；启动前打印实际使用的 Java 路径。

实机验证（最终 zip 解压到全新目录运行 `启动yinjie.bat`）：

- `health={"status":"ok","app":"yinjie"}`、`<title>yinjie · 音阶指板工坊</title>`、`/js/app.js` 99,367 B；
- 另一项测试：清空 `PATH` 与 `JAVA_HOME` 后仍能自动扫描到 `C:\Program Files\Java\jdk-27\bin\java.exe` 并进入启动流程。
- v1.0.2 起，Java 查找顺序为「PATH → `JAVA_HOME` → 随包 `runtime\jre21` → 扫描 Program Files」，全部找不到时自动下载安装 JRE 21（见 §2.5）。

### 2.5 自动下载安装 Java（v1.0.2）端到端验证

组件：`tools/ensure-java.ps1`（stdout 只输出 java.exe 路径，供 `启动yinjie.bat` 的 `for /f` 捕获）；`启动yinjie.bat` 检测不到 Java 时调用它下载 `Eclipse Temurin JRE 21 → Temurin JDK 21 → Microsoft OpenJDK 21`，解压到包内 `runtime\jre21\`；下载优先用系统自带 `curl.exe`（`--fail --max-time 900`），老系统回退 `Invoke-WebRequest`。`YINJIE_FORCE_DOWNLOAD=1` 可跳过本机检测强制走下载分支（诊断用）。

最终 zip（`55917c83…`）解压到全新临时目录实测（日志 `auto-java-install.log`）：

1. **强制下载分支**：63.4s 完成下载 + 安装（Eclipse Temurin 两个源在本机网络下失败，自动回退到 Microsoft OpenJDK 并成功），`runtime\jre21\bin\java.exe` 存在，`java -version` = `openjdk 21.0.12.1`；服务启动，`/api/health` ok、`<title>` 含「音阶指板工坊」；
2. **本机已有 Java**：不设开关启动，直接使用系统 Java 25.0.4.1（3.1s 就绪）；
3. **本机无 Java、包内已有 runtime**：用仅含 `C:\Windows\System32` 的 PATH 启动，脚本自动复用 `runtime\jre21\bin\java.exe`（Java 21.0.12.1，6.2s 就绪，health ok）；
4. 二次启动不会重复下载（下载结果为包内 `runtime\jre21\`，可在删除后重新触发）。

## 3. 开发服务（8090，file-first 静态资源 + 最新 jar）

```
python verify/api-sweep.py http://127.0.0.1:8090   → 174 PASS / 0 FAIL
node verify/cdp-check.mjs http://127.0.0.1:8090     → 13 PASS / 0 FAIL
node verify/frontend-blue/cdp-verify.mjs            → 40 PASS / 0 FAIL（前端主题专检）
node verify/frontend-blue/perf-probe.mjs            → 帧间隔 16.7ms 稳定 60fps、>32ms 卡顿帧 0（性能回归）
```

日志：`api-sweep-8090.log`、`cdp-check-8090.log`。

## 4. 本目录清单

| 文件 | 说明 |
| --- | --- |
| `01-dist-initial-1400.png` | 干净包 1400×900 初始界面（浅色冰蓝绿 + 全页线稿背景） |
| `02-dist-initial-900x700.png` | 干净包 900×700 初始界面 |
| `03-dist-chord-x32010-1600.png` | 干净包点选 x32010 → C 大三和弦 100 分（1600×1100） |
| `04-dist-shutdown-overlay-1600.png` | 干净包真实退出后的「服务已停止」遮罩（1600×1100） |
| `api-sweep-8091.log` / `api-sweep-8090.log` | REST 冒烟 174 项日志 |
| `cdp-check-8091.log` / `cdp-check-8090.log` | v1 交互回归日志（13 项） |
| `cdp-v2-8091.log` | v2 交互回归日志（26 项，含真实停机） |
| `../frontend-blue/perf-probe.mjs` | 帧间隔探针（性能修复前后对比，见前端报告 §11） |
| `gate-8092.log` | 最终 zip（重建后）复核：解压→8092 启动→health/title/css/js/muse→优雅停机（§2.3） |
| `auto-java-install.log` | 发布包「没有 Java 时自动下载安装」端到端验证：强制下载、系统 Java、复用 runtime 三条路径（§2.5） |

## 5. 独立验收（verifier，task-4）

独立 agent 复核结论：**PASS — 8/8 项全部通过，0 FAIL**（`mvn test` 56 / 0；干净包 8093：api-sweep 174/174、cdp-check 13/13、cdp-v2 26/26 且真实停机成功；品牌旧串命中 0；jar 内 class 与当前 `target/classes` 样本一致；README 端点 6/6 对齐）。报告见 `verify/verifier-v3/report.md`，日志与 `cdp-out/` 截图在同目录。

其 §10 记录的 4 处 LOW/INFO 级「验证记录文档」问题已由 Lead 复核修正（不涉及交付物）：

1. `verify/frontend-blue/report.md` 的 `app.css` 大小/行数改为实际的 59,191 B / 3,080 行（v3.1.1 性能修复后）；
2. 同上文件更正 README 引用截图为四张（01/02/04/06）；
3. `verify/final` 的 03/04 截图按其真实视口改名为 `*-1600.png`（1600×1100）；
4. 补存最终 zip 复测记录 `gate-8092.log` 并在 §2.3 引用。

### 5.1 增量复核：v3.1.1 性能修复后重建（verifier，第二次）

独立 agent 对重建产物做了增量复核：**PASS，无意外差异**。

- sha256 / 大小全部匹配：jar `eed793dc…`（20,881,879 B）、zip `f3b8de4d…`（19,032,518 B）；dist 4 文件清单一致；
- 干净包 8093（全新解压）：`/api/health` / `<title>` / `app.css 59,191 B` / `app.js 99,367 B` / `muse.png 847,398 B` 全 200；`api-sweep 174/174`、`cdp-check 13/13`、console 0 错误；
- jar 内 5 个静态资源与源码 sha256 全同，类字节抽样 4/4 与 `target/classes` 相同（Java 未动）；确认 `app.css` 中 `backdrop-filter`/`mix-blend-mode` 均为 0，`app.js` 仅剩琴板/琴枕 2 处单次 `shadowBlur`；
- 预期内差异仅静态资源体积：css −3,722 B、js −3,252 B、README +576 B、jar −326 B、zip +58 B。
- 该轮复核针对 zip `f3b8de4d…`；其后为修复启动脚本与补充 README「更新日志」，zip 又重建两次（`f825b2f6…` → 最终 `4d8fc9d2…`），期间 **jar 字节未变**（`eed793dc…` 仍适用），bat/README 变更已由 Lead 实测。
- 报告：`verify/verifier-v3/report.md` §13（226–321 行）；日志 `api-sweep-8093-v311.log`、`cdp-check-v311.log`、`cdp-out311/`。


## 6. 已知限制

- 背景可见度 vs 可读性：玻璃面板 alpha 取 0.5–0.66，实测背景线稿可见面积 35.6%（1400×900）/ 38.4%（900×700），最差真实像素文字对比度 4.81:1（仍 ≥ WCAG AA）；继续调透会先牺牲小字可读性。
- 性能（v3.1.1 已优化）：为保证拖动/悬停顺滑，前端不使用 `backdrop-filter` 与全页 `mix-blend-mode`，canvas 也不再逐音符画阴影；实测悬停扫动帧间隔 59–64ms → 稳定 16.7ms（60fps）、卡顿帧 0。代价是失去「毛玻璃」观感，面板仍为半透明白、背景线稿更清晰。
- 自动下载 Java 需要联网（约 45MB，仅首次）：本机实测 Temurin（GitHub）连接会被重置/超时，脚本自动回退到 Microsoft OpenJDK 成功；若公司网络全部源不可达，会提示 Adoptium 手动下载地址。
- 本工具仅监听 `127.0.0.1:8090`（`application.properties` 可改），「退出」按钮会停止本地服务。
