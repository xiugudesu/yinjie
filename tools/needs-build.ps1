# 供「启动yinjie.bat」调用：判断 target 下的 jar 是否需要用 Maven 重新打包。
# 输出：True = 建议重新打包；False = 直接运行现有 jar 即可。
#
# 说明：Spring Boot 的可复现构建会把 jar 文件与内部条目时间戳固定为 1980 年，
# 因此不能用 jar 的修改时间判断新旧；这里改用 target\classes 下最晚的 .class
# 文件与 src\main\java 下最晚的 .java 文件比较。若没有 target\classes（例如
# 用 IDE 构建后清理过中间产物），则视为 jar 可用，避免每次双击都要求 Maven。
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$jar = Join-Path $projectRoot 'target\yinjie-1.0.0.jar'
$javaSrc = Join-Path $projectRoot 'src\main\java'
$classes = Join-Path $projectRoot 'target\classes'

if (-not (Test-Path -LiteralPath $jar)) {
    'True'
    exit 0
}

if (-not (Test-Path -LiteralPath $classes)) {
    'False'
    exit 0
}

$newestSource = (Get-ChildItem -LiteralPath $javaSrc -Recurse -File -Filter '*.java' -ErrorAction SilentlyContinue |
        Measure-Object -Property LastWriteTime -Maximum).Maximum
$newestClass = (Get-ChildItem -LiteralPath $classes -Recurse -File -Filter '*.class' -ErrorAction SilentlyContinue |
        Measure-Object -Property LastWriteTime -Maximum).Maximum

if ($null -eq $newestSource -or $null -eq $newestClass) {
    'False'
    exit 0
}

if ($newestSource -gt $newestClass) {
    'True'
} else {
    'False'
}
