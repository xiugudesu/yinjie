@echo off
setlocal EnableDelayedExpansion
title yinjie - 音阶指板工坊

rem 切到脚本所在目录
cd /d "%~dp0"

rem ---- 1. 找 Java：PATH → JAVA_HOME → 随包下载的 runtime → Program Files 常见目录 ----
set "JAVA_CMD="

rem ---- 1.0 诊断开关：YINJIE_FORCE_DOWNLOAD=1 时跳过本机检测，强制下载自己的 JRE ----
if defined YINJIE_FORCE_DOWNLOAD (
    echo [提示] YINJIE_FORCE_DOWNLOAD 已设置：跳过本机 Java 检测，强制下载 JRE 21...
    if exist "tools\ensure-java.ps1" (
        for /f "delims=" %%J in ('powershell -NoProfile -ExecutionPolicy Bypass -File "tools\ensure-java.ps1"') do set "JAVA_CMD=%%J"
    )
    if not defined JAVA_CMD (
        echo [错误] 强制下载 Java 失败（请检查网络），或 tools\ensure-java.ps1 缺失。
        pause
        exit /b 1
    )
    echo [信息] 使用 Java: !JAVA_CMD!
    goto :java_ready
)
where java >nul 2>nul
if not errorlevel 1 set "JAVA_CMD=java"
if not defined JAVA_CMD if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_CMD=%JAVA_HOME%\bin\java.exe"
if not defined JAVA_CMD if exist "runtime\jre21\bin\java.exe" set "JAVA_CMD=%~dp0runtime\jre21\bin\java.exe"
if not defined JAVA_CMD call :scan_java

rem ---- 1.1 仍然找不到：自动下载 JRE 21 到 runtime\jre21（仅首次，需要联网）----
if not defined JAVA_CMD (
    if exist "tools\ensure-java.ps1" (
        echo [提示] 未检测到 Java，正在自动下载 JRE 21（首次约 45MB，需要联网）...
        for /f "delims=" %%J in ('powershell -NoProfile -ExecutionPolicy Bypass -File "tools\ensure-java.ps1"') do set "JAVA_CMD=%%J"
    )
)
if not defined JAVA_CMD (
    echo [错误] 找不到可用的 Java，且自动下载失败（可能无法联网）。
    echo        请手动安装 JDK/JRE 21+ 后重试，下载地址：
    echo        https://adoptium.net/temurin/releases/?version=21
    echo        或把 java.exe 所在目录加入 PATH 后重新双击本脚本。
    pause
    exit /b 1
)
echo [信息] 使用 Java: %JAVA_CMD%

:java_ready
rem ---- 2. 选择 jar：发布包 yinjie.jar / 开发布局 target\yinjie-1.0.0.jar ----
set "JAR=yinjie.jar"
set "NEED_BUILD=0"
if not exist "%JAR%" (
    if exist "target\yinjie-1.0.0.jar" (
        set "JAR=target\yinjie-1.0.0.jar"
    ) else (
        set "JAR=target\yinjie-1.0.0.jar"
        set "NEED_BUILD=1"
    )
)

rem ---- 3. 8090 已有服务：直接打开浏览器 ----
netstat -ano | findstr ":8090" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [提示] yinjie 已在 http://127.0.0.1:8090 运行，正在打开浏览器。
    if not defined YINJIE_NO_BROWSER start "" http://127.0.0.1:8090
    timeout /t 4 >nul
    exit /b 0
)

rem ---- 4. 开发布局：源码比 class 新则重新打包 ----
if "%NEED_BUILD%"=="0" if exist "tools\needs-build.ps1" (
    for /f "delims=" %%A in ('powershell -NoProfile -ExecutionPolicy Bypass -File "tools\needs-build.ps1"') do set "STALE=%%A"
    if /i "!STALE!"=="True" set "NEED_BUILD=1"
)

if "%NEED_BUILD%"=="1" (
    echo [1/2] 正在用 Maven 打包，首次启动或 Java 源码有更新时较慢...
    if exist "mvnw.cmd" (
        call mvnw.cmd -B -q -DskipTests package
    ) else (
        where mvn >nul 2>nul
        if errorlevel 1 (
            echo [错误] 找不到 Maven，当前目录也没有 mvnw.cmd。
            echo        请安装 Maven 并加入 PATH，或先用 IDE / mvn 打包。
            pause
            exit /b 1
        )
        call mvn -B -q -DskipTests package
    )
    if errorlevel 1 (
        echo [错误] 打包失败，请查看上方输出。
        pause
        exit /b 1
    )
)

echo [2/2] 启动 yinjie，浏览器将自动打开 http://127.0.0.1:8090
echo 关闭此窗口即可停止服务。
if not defined YINJIE_NO_BROWSER start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:8090"
"%JAVA_CMD%" -jar "%JAR%"

echo.
echo yinjie 已退出。
pause
exit /b 0

rem ---- 扫描常见 JDK 安装目录 ----
:scan_java
if exist "%ProgramFiles%\Java\latest\bin\java.exe" set "JAVA_CMD=%ProgramFiles%\Java\latest\bin\java.exe"
for /d %%D in ("%ProgramFiles%\Java\jdk*") do (
    if exist "%%~fD\bin\java.exe" if not defined JAVA_CMD set "JAVA_CMD=%%~fD\bin\java.exe"
)
for /d %%D in ("%ProgramFiles%\Eclipse Adoptium\jdk*") do (
    if exist "%%~fD\bin\java.exe" if not defined JAVA_CMD set "JAVA_CMD=%%~fD\bin\java.exe"
)
for /d %%D in ("%ProgramFiles%\Microsoft\jdk*") do (
    if exist "%%~fD\bin\java.exe" if not defined JAVA_CMD set "JAVA_CMD=%%~fD\bin\java.exe"
)
for /d %%D in ("%ProgramFiles%\Amazon Corretto\jdk*") do (
    if exist "%%~fD\bin\java.exe" if not defined JAVA_CMD set "JAVA_CMD=%%~fD\bin\java.exe"
)
for /d %%D in ("%ProgramFiles%\Zulu\zulu*") do (
    if exist "%%~fD\bin\java.exe" if not defined JAVA_CMD set "JAVA_CMD=%%~fD\bin\java.exe"
)
for /d %%D in ("%ProgramFiles(x86)%\Java\jdk*") do (
    if exist "%%~fD\bin\java.exe" if not defined JAVA_CMD set "JAVA_CMD=%%~fD\bin\java.exe"
)
exit /b 0
