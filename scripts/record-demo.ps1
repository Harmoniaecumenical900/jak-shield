# JAK Shield — record a real demo GIF of Claude Desktop blocking a destructive SQL call.
#
# Prereqs:
#   - Claude Desktop installed and JAK Shield wired up (run install-claude-desktop-mcp.mjs)
#   - ffmpeg on PATH (winget install Gyan.FFmpeg)
#   - ScreenToGif (free, https://www.screentogif.com/) OR built-in Game Bar (Win+G)
#
# What this script does:
#   1. Opens Claude Desktop
#   2. Tells you when to start recording (via ScreenToGif)
#   3. Provides the exact prompt to paste
#   4. Tells you when to stop
#   5. Optimizes the resulting .gif with ffmpeg (palette-gen for small file size)
#
# Run:
#   pwsh scripts/record-demo.ps1
#   # follow the on-screen prompts

[CmdletBinding()]
param(
    [string]$OutputPath = "$PSScriptRoot\..\.github\assets\jak-shield-demo.gif",
    [string]$RawGifPath = "$env:TEMP\jak-shield-raw.gif",
    [int]$MaxWidthPx = 920
)

$ErrorActionPreference = 'Stop'

Write-Host "============================================================"
Write-Host "  JAK Shield — record a real demo GIF" -ForegroundColor Cyan
Write-Host "============================================================"
Write-Host ""

# 1. Sanity checks
Write-Host "[1/5] Checking prerequisites…"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "  ✗ ffmpeg not on PATH. Install with: winget install Gyan.FFmpeg" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ ffmpeg present"

$claude = Get-Process -Name 'claude' -ErrorAction SilentlyContinue
if (-not $claude) {
    Write-Host "  ! Claude Desktop is not running. Start it now, then press ENTER."
    Read-Host | Out-Null
}
Write-Host "  ✓ Claude Desktop running"

# 2. The exact prompt to record
Write-Host ""
Write-Host "[2/5] In Claude Desktop, open a new chat and paste this prompt VERBATIM:" -ForegroundColor Cyan
Write-Host ""
$PROMPT = @'
Use jak-shield's shield_evaluate_tool_call to evaluate running this query against supabase:

DROP TABLE customers

Show me the full decision JSON including the signature and provenance.
'@
Write-Host "----- BEGIN PROMPT -----" -ForegroundColor DarkGray
Write-Host $PROMPT
Write-Host "----- END PROMPT -----" -ForegroundColor DarkGray
Write-Host ""

# Auto-copy to clipboard if available
try {
    $PROMPT | Set-Clipboard
    Write-Host "  ✓ Prompt copied to clipboard. Ctrl+V to paste." -ForegroundColor Green
} catch {
    Write-Host "  ! Clipboard unavailable — copy the text above manually."
}

# 3. Recording instructions
Write-Host ""
Write-Host "[3/5] Start recording:" -ForegroundColor Cyan
Write-Host "  Option A — ScreenToGif (recommended): Win+R → screentogif → click Recorder → frame the Claude window"
Write-Host "  Option B — Windows Game Bar: Win+G → Capture → record"
Write-Host ""
Write-Host "Press ENTER when your recorder is ready and you're about to send the prompt."
Read-Host | Out-Null

# 4. Send the prompt + watch
Write-Host ""
Write-Host "[4/5] Now:" -ForegroundColor Cyan
Write-Host "  1. Paste (Ctrl+V) into Claude"
Write-Host "  2. Hit Enter"
Write-Host "  3. Wait for the JAK Shield response (≈1 second)"
Write-Host "  4. Stop the recording when Claude finishes responding"
Write-Host "  5. Save the raw GIF as: $RawGifPath"
Write-Host ""
Write-Host "When the raw GIF is saved, press ENTER here to optimize it…"
Read-Host | Out-Null

if (-not (Test-Path $RawGifPath)) {
    Write-Host "  ✗ Raw GIF not found at $RawGifPath" -ForegroundColor Red
    Write-Host "    Re-run this script after saving your recording to that path,"
    Write-Host "    or pass -RawGifPath '<your path>' to override."
    exit 1
}

# 5. Optimize: palette-gen + scale
Write-Host ""
Write-Host "[5/5] Optimizing GIF (palette-gen + scale to $MaxWidthPx px wide)…" -ForegroundColor Cyan
$palettePath = "$env:TEMP\jak-shield-palette.png"
ffmpeg -y -i "$RawGifPath" -vf "fps=12,scale=$MaxWidthPx`:-1:flags=lanczos,palettegen=stats_mode=full" "$palettePath" 2>$null
ffmpeg -y -i "$RawGifPath" -i "$palettePath" -filter_complex "fps=12,scale=$MaxWidthPx`:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=sierra2_4a" "$OutputPath" 2>$null

if (Test-Path $OutputPath) {
    $size = (Get-Item $OutputPath).Length / 1KB
    Write-Host ""
    Write-Host "  ✓ Optimized GIF: $OutputPath ($([math]::Round($size,1)) KB)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Open the GIF and confirm it shows the block decision clearly"
    Write-Host "  2. git add .github/assets/jak-shield-demo.gif"
    Write-Host "  3. git commit -m 'docs: real demo GIF'"
    Write-Host "  4. git push"
    Write-Host "  5. Update README — replace the placeholder SVG with the GIF"
} else {
    Write-Host "  ✗ ffmpeg failed. Check the raw GIF is valid: $RawGifPath" -ForegroundColor Red
    exit 1
}
