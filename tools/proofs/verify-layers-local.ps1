param(
  [Parameter(Mandatory=$true)][string]$DataRoot,
  [Parameter(Mandatory=$true)][string]$GpuPython,
  [string]$CpuPython = 'python',
  [string]$OutputDirectory = 'work/local-layer-ci'
)
$ErrorActionPreference = 'Stop'
Push-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
try {
  New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
  function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    # Windows PowerShell wraps native stderr warnings as errors. The native
    # exit code, not a CuPy environment warning, determines success.
    $PreviousPreference = $ErrorActionPreference
    try { $ErrorActionPreference = 'Continue'; & $Executable @Arguments }
    finally { $ErrorActionPreference = $PreviousPreference }
    if ($LASTEXITCODE -ne 0) { throw "Verification failed: $Executable $Arguments" }
  }
  Invoke-Checked node @('tools/scope/verify-compose.mjs')
  Invoke-Checked node @('tools/proofs/run-current.mjs')
  Invoke-Checked node @('tools/proofs/prepare-layer-census.mjs')
  Invoke-Checked $CpuPython @('tools/proofs/layer-census.py','--data-root',$DataRoot,'--out',"$OutputDirectory/census")
  Invoke-Checked $GpuPython @('tools/proofs/layer-census-gpu.py','--input',"$OutputDirectory/census")
  foreach ($Width in @(1440,393)) {
    Invoke-Checked node @('tools/proofs/all-layer-clicks.browser.mjs','--width',"$Width",'--out',"$OutputDirectory/browser-$Width")
  }
  Invoke-Checked node @('tools/proofs/all-controls.browser.mjs')
  Invoke-Checked node @('tools/scope/loop.mjs','lint')
  Write-Output "PASS: CPU/CuPy parity and real Chrome desktop/Android touch-emulation layer interactions. Receipts: $OutputDirectory"
} finally { Pop-Location }
