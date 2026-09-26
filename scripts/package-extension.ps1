$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Package only runtime files from the working tree, independent of the caller's directory.
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = [string]$manifest.version
if ($version -notmatch '^\d+(\.\d+){0,3}$') {
    throw "Invalid extension version: $version"
}

$sourcePaths = @(
    $manifestPath
    (Join-Path $projectRoot 'src')
    (Join-Path $projectRoot 'rules')
)
foreach ($sourcePath in $sourcePaths) {
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Missing runtime path: $sourcePath"
    }
    $items = @((Get-Item -LiteralPath $sourcePath))
    if (Test-Path -LiteralPath $sourcePath -PathType Container) {
        $items += @(Get-ChildItem -LiteralPath $sourcePath -Recurse -Force)
    }
    foreach ($item in $items) {
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            throw "Runtime paths must not contain symbolic links or junctions: $($item.FullName)"
        }
    }
}

$outputDirectory = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$archiveName = "NoRedirect-v$version.zip"
$archivePath = Join-Path $outputDirectory $archiveName
Compress-Archive -LiteralPath $sourcePaths -DestinationPath $archivePath -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if (-not $archive.GetEntry('manifest.json')) {
        throw 'The archive must contain manifest.json at its root.'
    }
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName -notmatch '^(manifest\.json$|src[/\\]|rules[/\\])') {
            throw "Unexpected archive entry: $($entry.FullName)"
        }
    }
} finally {
    $archive.Dispose()
}

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$stream = [System.IO.File]::OpenRead($archivePath)
try {
    $hash = [System.BitConverter]::ToString($sha256.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
} finally {
    $stream.Dispose()
    $sha256.Dispose()
}
$checksumPath = Join-Path $outputDirectory "$archiveName.sha256"
"$hash  $archiveName" | Set-Content -LiteralPath $checksumPath -Encoding ASCII
Write-Output "Package: $archivePath"
Write-Output "SHA256:  $checksumPath"
