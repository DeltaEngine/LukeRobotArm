# Compress G: assembly HEVC ultrawides to public/AssemblyNN.mp4 (720² H.264) + poster JPGs.
# ffmpeg: C:\code\ffmpeg-8.1.1-full_build-shared\bin
$ErrorActionPreference = 'Continue'

$Ffmpeg = 'C:\code\ffmpeg-8.1.1-full_build-shared\bin\ffmpeg.exe'
$Ffprobe = 'C:\code\ffmpeg-8.1.1-full_build-shared\bin\ffprobe.exe'
$SrcDir = 'G:\Shared drives\Luke\RawImages\Assembly\Animation'
$OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'public'
$DetectVf = "scale=iw/4:ih/4,gblur=sigma=1,lutyuv=y='if(gte(val,230),0,255)',cropdetect=24:2:0"
$MaxKb = 400
# Per-clip square X (source px). 13 = gripper insert: keep the gripper on the left.
$XOverride = @{ 13 = 800 }

function Even([int]$n) { $n - ($n % 2) }

function Get-XCrop([string]$src, [int]$iw) {
  $log = & $Ffmpeg -hide_banner -i $src -vf $DetectVf -f null - 2>&1 | ForEach-Object { "$_" } | Out-String
  $crops = [regex]::Matches($log, 'crop=(\d+):(\d+):(\d+):(\d+)')
  if ($crops.Count -eq 0) { return @{ X = 0; W = Even $iw } }
  $frameW = [Math]::Max(1, [int]($iw / 4))
  $boxes = @()
  foreach ($m in $crops) {
    $w = [int]$m.Groups[1].Value
    $x = [int]$m.Groups[3].Value
    $boxes += ,@{ X = $x; W = $w }
  }
  $tight = @($boxes | Where-Object { $_.W -lt 0.85 * $frameW })
  if ($tight.Count -ge 8) { $boxes = $tight }
  $x1 = 99999
  $x2 = 0
  foreach ($b in $boxes) {
    if ($b.X -lt $x1) { $x1 = $b.X }
    if ($b.X + $b.W -gt $x2) { $x2 = $b.X + $b.W }
  }
  $centers = @($boxes | ForEach-Object { $_.X + $_.W / 2 })
  $cx = [int]((($centers | Measure-Object -Average).Average) * 4)
  $x1 *= 4
  $x2 *= 4
  $mrg = [int]($iw * 0.08)
  $x1 = [Math]::Max(0, $x1 - $mrg)
  $x2 = [Math]::Min($iw, $x2 + $mrg)
  $x1 = Even $x1
  $w = Even ($x2 - $x1)
  if ($x1 + $w -gt $iw) { $w = Even ($iw - $x1) }
  if ($w -lt 2) { $x1 = 0; $w = Even $iw }
  @{ X = $x1; W = $w; Cx = $cx }
}

if (-not (Test-Path -LiteralPath $Ffmpeg)) { throw "ffmpeg missing: $Ffmpeg" }
if (-not (Test-Path -LiteralPath $SrcDir)) { throw "source missing: $SrcDir" }

$total = 0
1..15 | ForEach-Object {
  $n = $_
  $src = Join-Path $SrcDir "$n.mp4"
  $id = '{0:D2}' -f $n
  $mp4 = Join-Path $OutDir "Assembly$id.mp4"
  $jpg = Join-Path $OutDir "Assembly$id.jpg"
  if (-not (Test-Path -LiteralPath $src)) { throw "missing $src" }

  $wh = (& $Ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 $src).Split(',')
  $iw = [int]$wh[0]
  $ih = [int]$wh[1]
  $crop = Get-XCrop $src $iw
  # Inner square: full source height, no pad. Center the square on the CAD in X.
  $side = Even $ih
  if ($side -gt $iw) { $side = Even $iw }
  $cx = if ($crop.Cx) { [int]$crop.Cx } else { [int](($crop.X + $crop.W / 2)) }
  $x = Even ([int]($cx - $side / 2))
  if ($XOverride.ContainsKey($n)) { $x = Even ([int]$XOverride[$n]) }
  if ($x -lt 0) { $x = 0 }
  if ($x + $side -gt $iw) { $x = Even ($iw - $side) }
  $vf = "crop=${side}:${side}:${x}:0,scale=720:720:flags=lanczos,mpdecimate,fps=12"

  Write-Host "Assembly$id  $($iw)x$ih  content x=$($crop.X)+$($crop.W)  square $side @ $x"
  & $Ffmpeg -y -hide_banner -loglevel error -i $src -an -vf $vf `
    -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.1 `
    -crf 30 -preset slow -tune stillimage -movflags +faststart $mp4
  if ($LASTEXITCODE) { throw "ffmpeg encode failed $n" }
  & $Ffmpeg -y -hide_banner -loglevel error -i $mp4 -frames:v 1 -q:v 3 $jpg
  if ($LASTEXITCODE) { throw "ffmpeg poster failed $n" }

  $kb = [int]((Get-Item -LiteralPath $mp4).Length / 1KB)
  $total += $kb
  $flag = if ($kb -gt $MaxKb) { '  ** over 400KB' } else { '' }
  Write-Host ("  {0} KB  poster {1} KB{2}" -f $kb, [int]((Get-Item -LiteralPath $jpg).Length / 1KB), $flag)
}

Write-Host ("TOTAL {0} KB ({1:N1} MB)" -f $total, ($total / 1024))
