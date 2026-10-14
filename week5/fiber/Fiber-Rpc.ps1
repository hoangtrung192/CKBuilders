# Dot-source this file in the control terminal. No RPC is sent at load time.
$script:FiberTestnetGenesis = '0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606'
$script:FiberEvidenceDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'evidence\fiber'

function Invoke-FiberWire {
    param([string]$Uri, [string]$Method, [object[]]$Parameters = @())
    $body = @{ jsonrpc = '2.0'; id = 1; method = $Method; params = @($Parameters) } | ConvertTo-Json -Depth 30 -Compress
    $response = Invoke-RestMethod -Uri $Uri -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30 -ErrorAction Stop
    if ($null -ne $response.error) { throw ($response.error | ConvertTo-Json -Depth 10 -Compress) }
    return $response.result
}

function Invoke-FiberRpc {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('A', 'B')][string]$Node,
        [Parameter(Mandatory = $true)][ValidateSet('node_info', 'list_peers', 'connect_peer', 'open_channel', 'accept_channel', 'list_channels', 'new_invoice', 'send_payment', 'get_payment', 'get_invoice')][string]$Method,
        [hashtable]$Parameters
    )
    $uri = if ($Node -eq 'A') { 'http://127.0.0.1:8227/' } else { 'http://127.0.0.1:8237/' }
    $info = Invoke-FiberWire -Uri $uri -Method 'node_info'
    if ($info.chain_hash -ne $script:FiberTestnetGenesis) { throw 'Node is not on CKB Testnet; stopping.' }
    if ($Method -eq 'node_info') { return $info }
    $arguments = @()
    if ($null -ne $Parameters) { $arguments = @($Parameters) }
    $result = Invoke-FiberWire -Uri $uri -Method $Method -Parameters $arguments
    # Payment RPCs include a learned preimage; keep it out of displayed evidence.
    if ($Method -in @('send_payment', 'get_payment')) {
        return $result | Select-Object payment_hash, status, fee, failed_error, created_at, last_updated_at
    }
    return $result
}

function Export-FiberEvidence {
    param(
        [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9-]+$')][string]$Name,
        [Parameter(Mandatory = $true)][object]$Data
    )
    # Use only the public results shown in README. Never pass key material here.
    $json = $Data | ConvertTo-Json -Depth 30
    if ($json -match '(?i)"(?:private_key|privateKey|seed|password|payment_preimage)"\s*:') {
        throw 'Sensitive field detected; select public fields before saving.'
    }
    New-Item -ItemType Directory -Path $script:FiberEvidenceDirectory -Force | Out-Null
    $recordedAt = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(7))
    $filename = '{0}-{1}-{2}.json' -f $Name, $recordedAt.ToString('yyyyMMdd-HHmmss-fff'), [Guid]::NewGuid().ToString('N').Substring(0, 6)
    $path = Join-Path $script:FiberEvidenceDirectory $filename
    @{ recorded_at = $recordedAt.ToString('o'); network = 'CKB Testnet'; data = $Data } | ConvertTo-Json -Depth 35 | Set-Content -LiteralPath $path -Encoding UTF8
    Write-Host ('Saved public evidence: ' + $path)
}
