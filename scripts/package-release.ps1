# Copyright (C) 2026 Tide Card contributors
# SPDX-License-Identifier: GPL-3.0-only

$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$distRoot = Join-Path $taskRoot 'dist'
& node (Join-Path $PSScriptRoot 'build-release.mjs') --check
if ($LASTEXITCODE -ne 0) { throw 'Release integrity check failed. Build and test before packaging.' }
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-FileList($directories, $files) {
    $result = [Collections.Generic.List[string]]::new()
    foreach ($file in $files) { $result.Add($file) }
    foreach ($directory in $directories) {
        $absolute = [IO.Path]::GetFullPath((Join-Path $taskRoot $directory))
        if (-not $absolute.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Source path is outside the project.' }
        foreach ($file in Get-ChildItem -LiteralPath $absolute -File -Recurse) {
            $relative = $file.FullName.Substring($taskRoot.Length + 1).Replace('\', '/')
            $result.Add($relative)
        }
    }
    return @($result | Sort-Object -Unique)
}

function Write-Package($name, $files) {
    $temporary = Join-Path $distRoot ($name + '.new.zip')
    $destination = Join-Path $distRoot ($name + '.zip')
    foreach ($target in @($temporary, $destination)) {
        if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($target)) -ne $distRoot) { throw 'Package path is outside dist.' }
    }
    $output = [IO.File]::Open($temporary, [IO.FileMode]::Create)
    $archive = [IO.Compression.ZipArchive]::new($output, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            $entry = $archive.CreateEntry($file.Replace('\', '/'), [IO.Compression.CompressionLevel]::Optimal)
            $source = [IO.File]::OpenRead((Join-Path $taskRoot $file))
            $target = $entry.Open()
            try { $source.CopyTo($target) } finally { $source.Dispose(); $target.Dispose() }
        }
    } finally { $archive.Dispose(); $output.Dispose() }

    # Verify all archived bytes, including licenses and bundled source, before replacing the old ZIP.
    $archive = [IO.Compression.ZipFile]::OpenRead($temporary)
    try {
        if ($archive.Entries.Count -ne $files.Count) { throw 'Unexpected package contents.' }
        foreach ($file in $files) {
            $entry = $archive.GetEntry($file.Replace('\', '/'))
            if (-not $entry) { throw "Missing archived file: $file" }
            $stream = $entry.Open()
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
            finally { $stream.Dispose(); $sha.Dispose() }
            $expected = (Get-FileHash -LiteralPath (Join-Path $taskRoot $file) -Algorithm SHA256).Hash
            if ($actual -ne $expected) { throw "Archived file differs: $file" }
        }
    } finally { $archive.Dispose() }
    Move-Item -LiteralPath $temporary -Destination $destination -Force
    Write-Host "Packaged and verified: $destination"
}

$base = @('server.mjs', 'release.json', 'LICENSE', 'README.md', 'package.json', 'package-lock.json')
$source = Get-FileList @('src', 'public', 'scripts', 'tests', 'docs') ($base + @(
    '启动游戏.cmd', '.gitignore', '.gitattributes', '.prettierrc.json', '.prettierignore',
    'third_party/nodejs/LICENSE'
))
Write-Package 'fish-source' $source

$server = Get-FileList @('src', 'public', 'docs') ($base + @('scripts/build-release.mjs', 'dist/fish-source.zip'))
Write-Package 'fish-server-update' $server

$installerName = 'third_party/nodejs/node-v24.21.0-x64.msi'
$installerHash = (Get-FileHash -LiteralPath (Join-Path $taskRoot $installerName) -Algorithm SHA256).Hash
if ($installerHash -ne 'BB0EAEE134F9357F22AEA915EE793343E627AEFC1E66488164BAC6915BCE2CAC') {
    throw 'The bundled Node installer differs from the verified vendor file.'
}
Write-Package 'fish-windows-launcher' ($source + @($installerName, 'dist/fish-source.zip'))
