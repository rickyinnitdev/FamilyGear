$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'build'
New-Item -ItemType Directory -Force $iconRoot | Out-Null
$sizes = @(16,24,32,48,64,128,256)
$images = @()
foreach ($size in $sizes) {
  $bitmap = [Drawing.Bitmap]::new($size, $size)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([Drawing.Color]::FromArgb(255,16,18,17))
  $graphics.ScaleTransform(($size / 128.0), ($size / 128.0))
  $pen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(255,211,237,155), 10)
  $pen.StartCap = $pen.EndCap = [Drawing.Drawing2D.LineCap]::Square
  $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Miter
  $m = [Drawing.PointF[]]@([Drawing.PointF]::new(22,92),[Drawing.PointF]::new(22,36),[Drawing.PointF]::new(44,60),[Drawing.PointF]::new(66,36),[Drawing.PointF]::new(66,92))
  $graphics.DrawLines($pen, $m)
  $graphics.DrawLine($pen,82,36,82,92)
  $graphics.DrawLine($pen,82,64,110,36)
  $graphics.DrawLine($pen,82,64,110,92)
  $stream = [IO.MemoryStream]::new()
  $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
  $images += ,$stream.ToArray()
  if ($size -eq 256) { [IO.File]::WriteAllBytes((Join-Path $iconRoot 'icon.png'), $stream.ToArray()) }
  $stream.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$icoStream = [IO.MemoryStream]::new()
$writer = [IO.BinaryWriter]::new($icoStream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($index = 0; $index -lt $sizes.Count; $index++) {
  $dimension = if ($sizes[$index] -eq 256) { 0 } else { $sizes[$index] }
  $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
  $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$images[$index].Length); $writer.Write([uint32]$offset)
  $offset += $images[$index].Length
}
foreach ($image in $images) { $writer.Write([byte[]]$image) }
$writer.Flush()
[IO.File]::WriteAllBytes((Join-Path $iconRoot 'icon.ico'), $icoStream.ToArray())
$writer.Dispose(); $icoStream.Dispose()
