param(
  [Parameter(Mandatory = $false)]
  [string[]]$Endpoints = @("192.168.10.1:7777", "192.168.10.2:7778", "192.168.10.3:7779"),

  [Parameter(Mandatory = $false)]
  [int]$TimeoutMs = 1500
)

function Parse-Endpoint {
  param([string]$Endpoint)
  $parts = $Endpoint.Split(":")
  if ($parts.Count -ne 2) {
    throw "Endpoint invalide: $Endpoint (format attendu: IP:PORT)"
  }
  return [PSCustomObject]@{
    Host = $parts[0]
    Port = [int]$parts[1]
  }
}

Write-Host "=== Sprint1 Connectivity Test ===" -ForegroundColor Cyan
Write-Host "Test des endpoints: $($Endpoints -join ', ')"
Write-Host ""

$results = @()

foreach ($endpoint in $Endpoints) {
  $e = Parse-Endpoint -Endpoint $endpoint

  $pingOk = Test-Connection -ComputerName $e.Host -Count 1 -Quiet -ErrorAction SilentlyContinue
  $tcpOk = $false

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($e.Host, $e.Port, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if ($connected -and $client.Connected) {
      $client.EndConnect($async)
      $tcpOk = $true
    }
    $client.Close()
  } catch {
    $tcpOk = $false
  }

  $results += [PSCustomObject]@{
    Endpoint = $endpoint
    Ping     = if ($pingOk) { "OK" } else { "FAIL" }
    TcpPort  = if ($tcpOk) { "OPEN" } else { "CLOSED/UNREACHABLE" }
  }
}

$results | Format-Table -AutoSize

$failCount = @($results | Where-Object { $_.Ping -ne "OK" -or $_.TcpPort -ne "OPEN" }).Count
if ($failCount -gt 0) {
  Write-Host ""
  Write-Host "Resultat: ECHEC ($failCount endpoint(s) non joignable(s))." -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "Resultat: OK (tous les noeuds repondent)." -ForegroundColor Green
exit 0
