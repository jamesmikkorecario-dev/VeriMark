param(
  [string]$EvidenceName = ('capture-' + (Get-Date -Format 'yyyyMMdd-HHmmss')),
  [int]$Port = 3107
)
$ErrorActionPreference = 'Stop'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
$env:PLAYWRIGHT_PORT = [string]$Port
# Run from repository root; uses installed dependencies only. Does not stop other servers.
npx playwright test e2e/motion.spec.ts --project=chromium-1440 --project=chromium-390 --workers=1
$testExit = $LASTEXITCODE
$destination = Join-Path 'artifacts/m1-motion' $EvidenceName
New-Item -ItemType Directory -Force $destination | Out-Null
Copy-Item -Path 'test-results/*' -Destination $destination -Recurse -Force
@{
  source = (git rev-parse HEAD)
  chromeChannel = 'chrome'
  captured = (Get-Date -Format o)
  exitCode = $testExit
  command = 'npx playwright test e2e/motion.spec.ts --project=chromium-1440 --project=chromium-390 --workers=1'
} | ConvertTo-Json | Set-Content (Join-Path $destination 'manifest.json')
Write-Output "Evidence: $destination (video.webm, trace.zip, timeline JSON, PNG frame samples)"
exit $testExit
