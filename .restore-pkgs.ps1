$ErrorActionPreference = "Stop"

$rootdir = "C:\Dev\Parsi"
$cache   = Join-Path $env:LOCALAPPDATA "npm-cache\_cacache"
$idxDir  = Join-Path $cache "index-v5"
$blobDir = Join-Path $cache "content-v2"

# cache-key filename (as it appears in the registry tarball URL) -> install dest
$targets = @{
  "zod-3.24.1.tgz"             = Join-Path $rootdir "node_modules\zod"
  "node-22.10.5.tgz"           = Join-Path $rootdir "node_modules\@types\node"
}

function Resolve-Blob([string]$tarballKey) {
  foreach ($meta in Get-ChildItem -LiteralPath $idxDir -File) {
    $parsed = $null
    try { $parsed = Get-Content -LiteralPath $meta.FullName -Raw | ConvertFrom-Json } catch { continue }
    if ($null -eq $parsed.integrity) { continue }
    if ($null -ne $parsed.key -and ($parsed.key -notlike ("*" + $tarballKey + "*"))) { continue }
    if ($parsed.integrity -notlike "sha512-*") { continue }
    $hex = ([System.BitConverter]::ToString([Convert]::FromBase64String($parsed.integrity.Substring(7)))).Replace("-", "").ToLower()
    $p = Join-Path (Join-Path (Join-Path $blobDir "sha512") ("\" + $hex.Substring(0,2) + "\" + $hex.Substring(2,2) + "\" + $hex.Substring(4))) ""
    if (Test-Path -LiteralPath $p) { return $p }
  }
  return $null
}

foreach ($key in $targets.Keys) {
  $dest = $targets[$key]

  $blob = Resolve-Blob $key
  if ($null -eq $blob) { Write-Output ("MISSING_CACHE_ENTRY {0}" -f $key); continue }

  $tmp = Join-Path $rootdir (".restore-" + [System.IO.Path]::GetFileNameWithoutExtension($key))
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $tgz = Join-Path $tmp "pkg.tgz"

  Copy-Item -LiteralPath $blob -Destination $tgz
  tar.exe -xzf $tgz -C $tmp
  if ($LASTEXITCODE -ne 0) { Write-Output ("TAR_FAIL {0}" -f $key); continue }

  $pkg = Join-Path $tmp "package"
  if (-not (Test-Path -LiteralPath $pkg)) { Write-Output ("NO_PACKAGE_DIR {0}" -f $key); continue }

  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
  [System.IO.Directory]::Move($pkg, $dest)
  Remove-Item -LiteralPath $tmp -Recurse -Force

  Write-Output ("RESTORED {0} -> {1}" -f $key, $dest)
}

Write-Output "RESTORE_PASS_DONE"
