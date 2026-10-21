# yinjie 发布包构建脚本（PowerShell 7，兼容 Windows PowerShell 5.1）
#
# 用法（在任意目录均可执行）：
#   pwsh -NoProfile -File tools/build-dist.ps1
#
# 输入（均相对仓库根，由 $PSScriptRoot 推导，无硬编码绝对路径）：
#   target\yinjie-1.0.0.jar   由 `mvn -B package` 生成的 Spring Boot 可执行 jar（必须存在）
#   README.md                 项目说明
#   启动yinjie.bat             Windows 一键启动脚本
#   docs\                     文档目录（递归，含 api.md）
#   tools\ensure-java.ps1     启动脚本检测不到 Java 时自动下载 JRE 21 的辅助脚本
#
# 输出：
#   dist\yinjie\              发布目录：yinjie.jar、启动yinjie.bat、README.md、docs\、tools\ensure-java.ps1
#   dist\yinjie-1.0.0.zip     zip 根目录即 yinjie\ 文件夹（解压后得到 yinjie\...）
#
# 脚本幂等：重复执行会先清空 dist\yinjie\ 并覆盖同名 zip。
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host ('[build-dist] ' + $Message) -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host ('[build-dist] ' + $Message) -ForegroundColor Green
}

function Assert-Path {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw ('缺少' + $Label + '：' + $Path + '。请先在仓库根执行 mvn -B package 生成 target\yinjie-1.0.0.jar。')
    }
}

# ---------------------------------------------------------------- 路径
$repoRoot = Split-Path -Parent $PSScriptRoot
$jarPath = Join-Path $repoRoot 'target\yinjie-1.0.0.jar'
$batPath = Join-Path $repoRoot '启动yinjie.bat'
$readmePath = Join-Path $repoRoot 'README.md'
$docsPath = Join-Path $repoRoot 'docs'
$distRoot = Join-Path $repoRoot 'dist'
$stageDir = Join-Path $distRoot 'yinjie'
$zipPath = Join-Path $distRoot 'yinjie-1.0.0.zip'

Write-Step ('仓库根：' + $repoRoot)

# ---------------------------------------------------------------- 1. 校验输入
Write-Step '[1/5] 校验输入文件…'
Assert-Path -Path $jarPath -Label '构建产物'
Assert-Path -Path $batPath -Label '启动脚本'
Assert-Path -Path $readmePath -Label 'README'
Assert-Path -Path $docsPath -Label 'docs 目录'
Assert-Path -Path (Join-Path $docsPath 'api.md') -Label 'docs\api.md'
Write-Output ("   jar      : {0} ({1:N0} B)" -f $jarPath, (Get-Item -LiteralPath $jarPath).Length)
Write-Output ("   启动脚本 : {0}" -f $batPath)
Write-Output ("   文档     : {0}" -f $docsPath)

# ---------------------------------------------------------------- 2. 重建暂存目录
Write-Step '[2/5] 清空并重建 dist\yinjie\ …'
if (Test-Path -LiteralPath $stageDir) {
    Remove-Item -LiteralPath $stageDir -Recurse -Force
}
New-Item -Path $stageDir -ItemType Directory -Force | Out-Null
if (-not (Test-Path -LiteralPath $distRoot)) {
    New-Item -Path $distRoot -ItemType Directory -Force | Out-Null
}
Write-Output ('   ' + $stageDir)

# ---------------------------------------------------------------- 3. 拷贝发布内容
Write-Step '[3/5] 拷贝 jar / 启动脚本 / README / docs / tools …'
Copy-Item -LiteralPath $jarPath -Destination (Join-Path $stageDir 'yinjie.jar') -Force
Write-Output '   target\yinjie-1.0.0.jar -> dist\yinjie\yinjie.jar'
Copy-Item -LiteralPath $batPath -Destination $stageDir -Force
Write-Output '   启动yinjie.bat -> dist\yinjie\启动yinjie.bat'
Copy-Item -LiteralPath $readmePath -Destination $stageDir -Force
Write-Output '   README.md -> dist\yinjie\README.md'
Copy-Item -LiteralPath $docsPath -Destination $stageDir -Recurse -Force
Write-Output '   docs\ -> dist\yinjie\docs\'
# 自动下载 Java 的辅助脚本：启动脚本在本机没有 Java 时调用
$ensureJavaPath = Join-Path $repoRoot 'tools\ensure-java.ps1'
Assert-Path -Path $ensureJavaPath -Label 'Java 自动安装脚本'
$stageToolsDir = Join-Path $stageDir 'tools'
New-Item -Path $stageToolsDir -ItemType Directory -Force | Out-Null
Copy-Item -LiteralPath $ensureJavaPath -Destination $stageToolsDir -Force
Write-Output '   tools\ensure-java.ps1 -> dist\yinjie\tools\ensure-java.ps1'

# ---------------------------------------------------------------- 4. 生成 zip
Write-Step '[4/5] 生成 zip（根目录为 yinjie\）…'
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
# -Path 传目录本身：压缩包内条目以 yinjie\ 开头，解压后得到 yinjie\ 文件夹。
Compress-Archive -Path $stageDir -DestinationPath $zipPath -CompressionLevel Optimal -Force
Write-Output ('   {0} ({1:N0} B)' -f $zipPath, (Get-Item -LiteralPath $zipPath).Length)

# 自检：zip 内必须包含发布包关键文件（条目分隔符在 PS 5.1/7 下可能不同，统一比较）
Write-Step '   zip 结构自检…'
if (-not ('System.IO.Compression.ZipFile' -as [type])) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
}
$zipHandle = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entries = @($zipHandle.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
} finally {
    $zipHandle.Dispose()
}
$expected = @('yinjie/yinjie.jar', 'yinjie/启动yinjie.bat', 'yinjie/README.md', 'yinjie/docs/api.md', 'yinjie/tools/ensure-java.ps1')
$missing = @($expected | Where-Object { $entries -notcontains $_ })
if ($missing.Count -gt 0) {
    throw ('zip 缺少条目：' + ($missing -join '、'))
}
Write-Ok ('   zip 根为 yinjie\，共 ' + $entries.Count + ' 个条目，关键文件齐全')

# ---------------------------------------------------------------- 5. 输出清单
Write-Step '[5/5] 发布包文件清单：'
$files = @(Get-ChildItem -LiteralPath $stageDir -Recurse -File | Sort-Object FullName)
foreach ($file in $files) {
    $relative = $file.FullName.Substring($distRoot.Length + 1)
    Write-Output ("   {0,-42} {1,10:N0} B" -f $relative, $file.Length)
}
$zipSize = (Get-Item -LiteralPath $zipPath).Length
Write-Output ("   {0,-42} {1,10:N0} B" -f 'yinjie-1.0.0.zip（压缩包）', $zipSize)
Write-Ok ('完成：' + $files.Count + ' 个文件 + 1 个 zip。发布包解压后双击 启动yinjie.bat 即可运行（无需 Maven、无需 src/；本机没有 Java 时首次启动会自动下载 JRE 21）。')
