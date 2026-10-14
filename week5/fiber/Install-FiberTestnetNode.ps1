param([Parameter(Mandatory = $true)][ValidateSet('A', 'B')][string]$Node)

$ErrorActionPreference = 'Stop'
$localRoot = Join-Path $PSScriptRoot '.local'
$nodeDirectory = Join-Path $localRoot ('node' + $Node)
$toolsDirectory = Join-Path $PSScriptRoot 'tools'
$installerPath = Join-Path $toolsDirectory 'install-v0.9.1.ps1'

# The upstream installer moves nonempty installations aside. Refuse any existing
# node here so a repeated command cannot move state or replace a wallet.
if (Test-Path -LiteralPath $nodeDirectory) {
    throw "Already exists: $nodeDirectory. Do not reinstall; use start-node.ps1."
}
if (-not [Environment]::Is64BitOperatingSystem) { throw 'Windows x64 required.' }
New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null

$env:INSTALL_REF = 'v0.9.1'
$env:FNN_VERSION = '0.9.1'
$env:CKB_CLI_VERSION = '1.12.0'
$env:NETWORK = 'testnet'
$env:CKB_RPC_URL = 'https://testnet.ckbapp.dev/'
$env:NO_PROXY = '127.0.0.1,localhost'

Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/nervosnetwork/fiber/v0.9.1/tools/install/install.ps1' -OutFile $installerPath
Write-Host 'Official v0.9.1 installer downloaded. Choose 1 (new account).'
Write-Host 'Keep wallet passwords private. At the final Start now prompt choose n.'
Write-Host 'Do not rerun if setup is partial; inspect the existing directory first.'
Write-Host ('Installer SHA256: ' + (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash)

# A child shell keeps the upstream installer's exit and Set-Location contained.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath -InstallDir $nodeDirectory -Network testnet
if ($LASTEXITCODE -ne 0) { throw "Installer failed ($LASTEXITCODE). Preserve $nodeDirectory and inspect output." }
