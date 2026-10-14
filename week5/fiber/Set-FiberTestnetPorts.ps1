param([Parameter(Mandatory = $true)][ValidateSet('A', 'B')][string]$Node)

$ErrorActionPreference = 'Stop'
$nodeDirectory = Join-Path $PSScriptRoot ('.local\node' + $Node)
$configPath = Join-Path $nodeDirectory 'config.yml'
$backupPath = Join-Path $nodeDirectory 'config.before-week05.yml'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Install the node first.' }
if (Test-Path -LiteralPath $backupPath) { throw 'Already configured. Inspect config.yml instead of rerunning.' }
$config = [System.IO.File]::ReadAllText($configPath)
if ($config -notmatch '(?m)^\s+chain:\s*testnet\s*$') { throw 'Only Testnet is supported.' }
if ($config -notmatch 'rpc_url:\s*"https://testnet\.ckbapp\.dev/"') { throw 'Unexpected CKB RPC. Inspect config before proceeding.' }
if ($config -match '(?m)^\s+auto_accept_channel_ckb_funding_amount:') { throw 'Existing funding policy; inspect it manually.' }
if (-not $config.Contains('/ip4/0.0.0.0/tcp/8228') -or -not $config.Contains('127.0.0.1:8227')) {
    throw 'Unexpected port configuration; preserve existing configuration.'
}

$p2pPort = if ($Node -eq 'A') { 8228 } else { 8238 }
$rpcPort = if ($Node -eq 'A') { 8227 } else { 8237 }
$config = $config.Replace('/ip4/0.0.0.0/tcp/8228', "/ip4/127.0.0.1/tcp/$p2pPort")
$config = $config.Replace('127.0.0.1:8227', "127.0.0.1:$rpcPort")
$config = $config.Replace('announce_listening_addr: true', 'announce_listening_addr: false')
$config = [regex]::Replace($config, '(?m)^fiber:\r?$', "fiber:`n  announced_node_name: `"CKBuilder-Week05-$Node`"`n  auto_accept_channel_ckb_funding_amount: 0")
Copy-Item -LiteralPath $configPath -Destination $backupPath -ErrorAction Stop
[System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))
Write-Host "Node $Node configured: RPC $rpcPort, P2P $p2pPort, manual channel acceptance, Testnet."
Write-Host "Original configuration preserved: $backupPath"
