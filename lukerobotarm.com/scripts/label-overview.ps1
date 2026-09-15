# Draw Arm / Gripper / Top / Column / Base callouts on OverviewCropped.png → public/Assembly00.jpg
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$src = 'G:\Shared drives\Luke\RawImages\Assembly\OverviewCropped.png'
$dst = Join-Path (Split-Path -Parent $PSScriptRoot) 'public\Assembly00.jpg'
$cut = [System.Drawing.Bitmap]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap 720, 720, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.PixelOffsetMode = 'HighQuality'
$g.CompositingQuality = 'HighQuality'
$g.Clear([System.Drawing.Color]::White)
$g.DrawImage($cut, 0, 0, 720, 720)
$cut.Dispose()

$green = [System.Drawing.Color]::FromArgb(255, 124, 179, 66)
$ink = [System.Drawing.Color]::FromArgb(255, 50, 50, 50)
$edge = [System.Drawing.Color]::FromArgb(255, 90, 90, 90)
$fill = [System.Drawing.Color]::White
$pen = New-Object System.Drawing.Pen $green, 3
$dotBrush = New-Object System.Drawing.SolidBrush $green
$pillBrush = New-Object System.Drawing.SolidBrush $fill
$edgePen = New-Object System.Drawing.Pen $edge, 2
$font = [System.Drawing.Font]::new('Segoe UI', [float]22)
$textBrush = New-Object System.Drawing.SolidBrush $ink
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'

function Add-RoundRect([System.Drawing.Drawing2D.GraphicsPath]$path, [int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
}

function Draw-Callout([string]$text, [int]$px, [int]$py, [int]$ax, [int]$ay) {
  $sz = $g.MeasureString($text, $font)
  $padX = 18
  $padY = 8
  $w = [int][Math]::Ceiling($sz.Width) + $padX * 2
  $h = [int][Math]::Ceiling($sz.Height) + $padY * 2
  $rect = New-Object System.Drawing.Rectangle $px, $py, $w, $h
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundRect $path $px $py $w $h 18
  $g.FillPath($pillBrush, $path)
  $g.DrawPath($edgePen, $path)
  $g.DrawString($text, $font, $textBrush, (New-Object System.Drawing.RectangleF $px, $py, $w, $h), $sf)

  $cx = $px + $w / 2
  $cy = $py + $h / 2
  $ex = if ($ax -ge $cx) { $px + $w } else { $px }
  $ey = $cy
  $g.DrawLine($pen, $ex, $ey, $ax, $ay)
  $g.FillEllipse($dotBrush, $ax - 7, $ay - 7, 14, 14)
}

# Dots sit on the part (sampled opaque pixels). Pills in empty white.
Draw-Callout 'Top'     268   6  165  28
Draw-Callout 'Column'    8 248  232 305
Draw-Callout 'Arm'     355  52  415 172
Draw-Callout 'Gripper' 505 555  600 420
Draw-Callout 'Base'     12 640  310 555

$g.Dispose()
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$enc = New-Object System.Drawing.Imaging.EncoderParameters 1
$enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [int64]90)
$bmp.Save($dst, $jpeg, $enc)
$bmp.Dispose()
Write-Host "Wrote $dst"
