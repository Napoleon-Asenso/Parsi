$ErrorActionPreference = "Stop"

$root   = "C:\Dev\Parsi"
$cache  = "$env:LOCALAPPDATA\npm-cache\_cacache"
$idx    = Join-Path $cache "index-v5"
$content= Join-Path $cache "content-v2"

# name(host) -> target install path node_modules/<dir>
$targets = @{
  "zod-3.24.1.tgz"         = "C:\Dev\Parsi\node_modules\zod"
  "@types/node-22.10.5.tgz"= "C:\Dev\Parsi\node_modules\@types\node"
}

function Get-ContentPathFromIntegrity([string]$integrity) {
  # integrity looks like "sha512-BASE64..." where BASE64 is 64 bytes -> hex key
  if ($integrity -notmatch "^sha512-") { throw "unsupported integrity: $integrity" }
  $b64 = $integrity.Substring(7)
  $bytes = [Convert]::FromBase64String($b64)
  # first 2 hex chars / next 2 / rest -> cacache content-v2 layout
  $hex = [System.BitConverter]::ToString($bytes).Replace("-","").ToLower()
  $dir1 = $hex.Substring(0,2); $dir2 = $hex.Substring(2,2); $dir3 = $hex.Substring(4)
  return (Join-Path $content (Join-Path $dir1 (Join-Path $dir2 $dir3))).Replace($hex, "")
}

# Step 1: scan index-v5 metadata files for the two registry tarballs
$entries = @{}   # 'zod-3.24.1.tgz' -> @{ file=...; integrity=... }
Get-ChildItem -LiteralPath $idx -File | ForEach-Object {
  $txt = Get-Content -LiteralPath $_.FullName -Raw
  foreach ($tbn in $targets.Keys) {
    if ($txt -like "*$tbn*") {
      $m = [regex]::Match($txt, '"integrity"\s*:\s*"([^"]+)"')
      if ($m.Success) {
        $entries[$tbn] = @{ file = $_.FullName; integrity = $m.Groups[1].Value }
      }
    }
  }
}

Write-Output ("found entries: " + (($entries.Keys | Sort-Object) -join ", "))
if ($entries.Count -ne $targets.Count) { Write-Output "INCOMPLETE - cannot fully repair"; exit 2 }

# Step 2: for each, locate content blob, verify gzip magic, extract to target
foreach ($tbn in $entries.Keys) {
  $e = $entries[$tbn]
  $blob = Get-ContentPathFromIntegrity $e.integrity
  if (-not (Test-Path -LiteralPath $blob)) { Write-Output "MISSING BLOB for $tbn -> $blob"; exit 3 }
  $fs = [System.IO.File]::OpenRead($blob)
  $magic = New-Object byte[] 2; $null = $fs.Read($magic,0,2)
  $fs.Close()
  if (-not ($magic[0] -eq 0x1F -and $magic[1] -eq 0x8B)) { Write-Output "BAD MAGIC for $tbn"; exit 4 }

  $tgz = Join-Path $root (".repair-$tbn.tgz")
  Copy-Item -LiteralPath $blob -Destination $tgz -Force

  $instantSelf = New-Item -ItemType Directory -Path (Join-Path $root (".repair-" + $tbn)) -Force
  $tmpDir = $instantSelf.FullName

  tar.exe -xzf $tgz -C $tmpDir
  if ($LASTEXITCODE -ne 0) { Write-Output "tar failed for $tbn"; exit 5 }
  Remove-Item -LiteralPath $tgz -Force

  $pkgDir = Join-Path $tmpDir "package"
  if (-not (Test-Path -LiteralPath $pkgDir)) { Write-Output "no package/ inside $tbn"; exit 6 }

  $dest = $targets[$tbn]
  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
  [System.IO.Directory]::Move($pkgDir, $dest)
  Remove-Item -LiteralPath $tmpDir -Recurse -Force

  Write-Output ("OK installed $tbn -> $dest")
}

Write-Output "ALL OK"
