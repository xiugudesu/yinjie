# yinjie 自动获取 Java 运行时（由 启动yinjie.bat 在检测不到 Java 时调用）
#
# 输出协议：stdout 只输出 java.exe 的绝对路径（供 cmd 的 for /f 捕获）；
#           所有进度/错误信息写 stderr。
#
# 行为：
#   1) 若 <应用目录>\runtime\jre21\bin\java.exe 已存在，直接输出该路径；
#   2) 扫描 JAVA_HOME 与 Program Files 下常见 JDK 安装位置，找到则输出；
#   3) 都没有时，从前几个官方源下载 Eclipse Temurin JRE 21（约 45MB），
#      解压安装到 <应用目录>\runtime\jre21（无需管理员权限、不写注册表）；
#   4) 全部失败时退出码 1，并提示手动安装地址。
#
# 调试：设置环境变量 YINJIE_FORCE_DOWNLOAD=1 可跳过第 1/2 步，强制验证下载流程。

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $root 'runtime'
$jreDir = Join-Path $runtimeRoot 'jre21'
$localJava = Join-Path $jreDir 'bin\java.exe'

function Write-Err([string]$message) {
    [Console]::Error.WriteLine('[ensure-java] ' + $message)
}

if ((-not $env:YINJIE_FORCE_DOWNLOAD) -and (Test-Path -LiteralPath $localJava)) {
    Write-Output $localJava
    exit 0
}

if (-not $env:YINJIE_FORCE_DOWNLOAD) {
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:JAVA_HOME) {
        $candidates.Add((Join-Path $env:JAVA_HOME 'bin\java.exe'))
    }
    $bases = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { $_ }
    $patterns = @(
        'Java\latest\bin\java.exe',
        'Java\jdk*\bin\java.exe',
        'Eclipse Adoptium\jdk*\bin\java.exe',
        'Microsoft\jdk*\bin\java.exe',
        'Amazon Corretto\jdk*\bin\java.exe',
        'Zulu\zulu*\bin\java.exe'
    )
    foreach ($base in $bases) {
        foreach ($pattern in $patterns) {
            $found = @(Get-ChildItem -Path (Join-Path $base $pattern) -ErrorAction SilentlyContinue |
                Sort-Object FullName -Descending)
            foreach ($item in $found) {
                if ($item) { $candidates.Add($item.FullName) }
            }
        }
    }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            Write-Err ('本机已有 Java：' + $candidate)
            Write-Output $candidate
            exit 0
        }
    }
}

# ------------------------------------------------------------------ 下载安装
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $arch = 'aarch64' } else { $arch = 'x64' }
$adoptiumBase = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/' + $arch + '/'
$sources = @(
    @{ Name = 'Eclipse Temurin JRE 21'; Url = ($adoptiumBase + 'jre/hotspot/normal/eclipse?project=jdk') },
    @{ Name = 'Eclipse Temurin JDK 21'; Url = ($adoptiumBase + 'jdk/hotspot/normal/eclipse?project=jdk') }
)
if ($arch -eq 'aarch64') {
    $sources += @{ Name = 'Microsoft OpenJDK 21'; Url = 'https://aka.ms/download-jdk/microsoft-jdk-21-windows-aarch64.zip' }
} else {
    $sources += @{ Name = 'Microsoft OpenJDK 21'; Url = 'https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip' }
}

$tempRoot = Join-Path $env:TEMP ('yinjie-java-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -Path $tempRoot -ItemType Directory -Force | Out-Null
$zipPath = Join-Path $tempRoot 'java.zip'
$downloaded = $false

try {
    foreach ($source in $sources) {
        try {
            Write-Err ('正在下载 ' + $source.Name + '（首次约 45MB，需要联网）…')
            $curl = Join-Path $env:SystemRoot "System32\curl.exe"
            if (Test-Path -LiteralPath $curl) {
                # curl.exe 比 Invoke-WebRequest 更快更稳（Windows 10 1803+ 自带）
                & $curl -L --fail --silent --show-error --max-time 900 -o $zipPath $source.Url
                if ($LASTEXITCODE -ne 0) { throw ("curl 退出码 " + $LASTEXITCODE) }
            } else {
                Invoke-WebRequest -Uri $source.Url -OutFile $zipPath -UseBasicParsing -TimeoutSec 900
            }
            if ((Test-Path -LiteralPath $zipPath) -and ((Get-Item -LiteralPath $zipPath).Length -gt 10485760)) {
                $downloaded = $true
                break
            }
            Write-Err '下载文件过小，换下一个下载源…'
            Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Err ('下载失败：' + $_.Exception.Message)
            Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
        }
    }
    if (-not $downloaded) { throw '所有下载源均失败（可能无法联网）' }

    Write-Err '正在解压 Java 运行时…'
    Expand-Archive -LiteralPath $zipPath -DestinationPath $tempRoot -Force
    $javaFound = @(Get-ChildItem -Path $tempRoot -Recurse -Filter 'java.exe' -ErrorAction SilentlyContinue |
        Where-Object { $_.Directory.Name -eq 'bin' } |
        Sort-Object FullName)
    if ($javaFound.Count -eq 0) { throw '解压后未找到 java.exe' }

    $extractedRoot = Split-Path -Parent $javaFound[0].Directory.FullName
    if (Test-Path -LiteralPath $jreDir) {
        Remove-Item -LiteralPath $jreDir -Recurse -Force
    }
    New-Item -Path $runtimeRoot -ItemType Directory -Force | Out-Null
    Move-Item -LiteralPath $extractedRoot -Destination $jreDir -Force

    $installedJava = Join-Path $jreDir 'bin\java.exe'
    if (-not (Test-Path -LiteralPath $installedJava)) { throw '安装后未找到 java.exe' }
    Write-Err 'Java 运行时安装完成。'
    Write-Output $installedJava
} catch {
    Write-Err ('自动获取 Java 失败：' + $_.Exception.Message)
    Write-Err '请手动安装 JDK/JRE 21+ 后重试：https://adoptium.net/temurin/releases/?version=21'
    exit 1
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
