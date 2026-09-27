$ErrorActionPreference = 'Stop'

$root = Join-Path $PSScriptRoot 'dist'
$game = Join-Path $root 'Isobara.html'

if (-not (Test-Path -LiteralPath $game -PathType Leaf)) {
    Write-Host 'ERROR: dist\Isobara.html was not found.' -ForegroundColor Red
    Write-Host ('Expected: ' + $game)
    exit 1
}

$rootFull = [System.IO.Path]::GetFullPath($root)
if (-not $rootFull.EndsWith([System.IO.Path]::DirectorySeparatorChar.ToString())) {
    $rootFull += [System.IO.Path]::DirectorySeparatorChar
}

$listener = $null
$port = 0
foreach ($candidate in 8765..8795) {
    try {
        $tryListener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $candidate)
        $tryListener.Start()
        $listener = $tryListener
        $port = $candidate
        break
    }
    catch {
        if ($tryListener) {
            try { $tryListener.Stop() } catch {}
        }
    }
}

if (-not $listener) {
    Write-Host 'ERROR: Could not open a localhost port (8765-8795).' -ForegroundColor Red
    exit 1
}

function Get-ContentType([string]$path) {
    switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.htm'  { return 'text/html; charset=utf-8' }
        '.js'   { return 'text/javascript; charset=utf-8' }
        '.mjs'  { return 'text/javascript; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.gif'  { return 'image/gif' }
        '.webp' { return 'image/webp' }
        '.svg'  { return 'image/svg+xml' }
        '.ico'  { return 'image/x-icon' }
        '.wasm' { return 'application/wasm' }
        '.mp3'  { return 'audio/mpeg' }
        '.ogg'  { return 'audio/ogg' }
        '.wav'  { return 'audio/wav' }
        default { return 'application/octet-stream' }
    }
}

function Send-Response($stream, [int]$statusCode, [string]$statusText, [string]$contentType, [byte[]]$body, [bool]$sendBody) {
    if ($null -eq $body) { $body = New-Object byte[] 0 }
    $headers = "HTTP/1.1 $statusCode $statusText`r`n" +
               "Content-Type: $contentType`r`n" +
               "Content-Length: $($body.Length)`r`n" +
               "Cache-Control: no-store`r`n" +
               "X-Content-Type-Options: nosniff`r`n" +
               "Connection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($sendBody -and $body.Length -gt 0) {
        $stream.Write($body, 0, $body.Length)
    }
    $stream.Flush()
}

$url = "http://127.0.0.1:$port/Isobara.html"
Write-Host ''
Write-Host 'ISOBARA local server is running.' -ForegroundColor Green
Write-Host ('URL: ' + $url)
Write-Host 'Keep this window open while playing. Press Ctrl+C or close it to stop the server.'
Write-Host ''

Start-Process $url

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.NoDelay = $true
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
            $requestLine = $reader.ReadLine()

            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line -or $line.Length -eq 0) { break }
            }

            if ($requestLine -notmatch '^(GET|HEAD)\s+([^\s]+)\s+HTTP/') {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Bad Request')
                Send-Response $stream 400 'Bad Request' 'text/plain; charset=utf-8' $body $true
                continue
            }

            $method = $Matches[1]
            $rawTarget = $Matches[2]
            $rawPath = ($rawTarget -split '\?', 2)[0]
            $urlPath = [System.Uri]::UnescapeDataString($rawPath)

            if ($urlPath -eq '/') { $urlPath = '/Isobara.html' }
            $relative = $urlPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relative))

            if (-not $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
                Send-Response $stream 403 'Forbidden' 'text/plain; charset=utf-8' $body ($method -eq 'GET')
                continue
            }

            if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
                Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $body ($method -eq 'GET')
                continue
            }

            $body = [System.IO.File]::ReadAllBytes($fullPath)
            $contentType = Get-ContentType $fullPath
            Send-Response $stream 200 'OK' $contentType $body ($method -eq 'GET')
        }
        catch {
            try {
                if ($stream) {
                    $body = [System.Text.Encoding]::UTF8.GetBytes('Internal Server Error')
                    Send-Response $stream 500 'Internal Server Error' 'text/plain; charset=utf-8' $body $true
                }
            } catch {}
        }
        finally {
            if ($reader) { try { $reader.Dispose() } catch {} }
            if ($stream) { try { $stream.Dispose() } catch {} }
            try { $client.Close() } catch {}
        }
    }
}
finally {
    if ($listener) { $listener.Stop() }
}
