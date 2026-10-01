$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
& node (Join-Path $PSScriptRoot 'build-release.mjs') --check
if ($LASTEXITCODE -ne 0) { throw '发布文件校验失败，请先完成发布清单与测试。' }
$manifest = Get-Content -LiteralPath (Join-Path $taskRoot 'release.json') -Raw | ConvertFrom-Json
$shared = @('server.mjs', 'room-store.mjs', 'engine.mjs', 'release-integrity.mjs', 'release.json', 'public', '服务端更新说明.md')
$installer = Join-Path $taskRoot 'node-v24.21.0-x64.msi'
if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash -ne 'BB0EAEE134F9357F22AEA915EE793343E627AEFC1E66488164BAC6915BCE2CAC') {
    throw 'Node 备用安装包与已验证的文件不符。'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Write-Package($name, $inputs) {
    $temporary = Join-Path $taskRoot ($name + '.new.zip')
    $destination = Join-Path $taskRoot ($name + '.zip')
    foreach ($target in @($temporary, $destination)) {
        if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($target)) -ne $taskRoot) { throw '打包目标超出项目目录。' }
    }
    Compress-Archive -LiteralPath @($inputs | ForEach-Object { Join-Path $taskRoot $_ }) -DestinationPath $temporary -Force
    $archive = [IO.Compression.ZipFile]::OpenRead($temporary)
    try {
        foreach ($property in $manifest.files.PSObject.Properties) {
            $entry = $archive.Entries | Where-Object { $_.FullName.Replace('\','/') -eq $property.Name }
            if (@($entry).Count -ne 1) { throw "压缩包缺少或重复文件：$($property.Name)" }
            $stream = $entry.Open()
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
            finally { $stream.Dispose(); $sha.Dispose() }
            if ($actual -ne $property.Value) { throw "压缩包校验失败：$($property.Name)" }
        }
        foreach ($file in @('release.json', '服务端更新说明.md')) {
            $entry = $archive.Entries | Where-Object { $_.FullName.Replace('\','/') -eq $file }
            if (@($entry).Count -ne 1) { throw "压缩包缺少文件：$file" }
            $reader = [IO.StreamReader]::new($entry.Open())
            try { $actual = $reader.ReadToEnd() } finally { $reader.Dispose() }
            if ($actual -ne [IO.File]::ReadAllText((Join-Path $taskRoot $file))) { throw "压缩包说明或清单不一致：$file" }
        }
    } finally { $archive.Dispose() }
    Move-Item -LiteralPath $temporary -Destination $destination -Force
    Write-Host "已打包并检查：$destination"
}
Write-Package 'fish-server-update' $shared
Write-Package 'fish-windows-launcher' ($shared + @('启动游戏.cmd','README.md','introduction.md','HTTPS部署指南.md','scripts','node-v24.21.0-x64.msi'))
