$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskOutput = Join-Path $taskRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
$taskZip = Join-Path $taskOutput 'VeriMark-workflow.zip'
Push-Location $taskRoot
try {
    # Committed, explicitly selected workflow paths only; no working files or Git metadata.
    git archive --format=zip "--output=$taskZip" HEAD -- AGENTS.md README.md CONTRIBUTING.md SECURITY.md CLAUDE.md START_DEVELOPMENT_PROMPT.md .env.example .gitignore agents docs tasks setup-inputs .claude .opencode .github templates prototypes tools
    if ($LASTEXITCODE -ne 0) { throw 'Workflow archive failed' }
    Get-Item -LiteralPath $taskZip | Select-Object FullName, Length
    Get-FileHash -LiteralPath $taskZip -Algorithm SHA256
} finally { Pop-Location }
