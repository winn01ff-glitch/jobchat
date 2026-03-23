$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:7070/")
$listener.Start()
Write-Host "Server running on http://localhost:7070"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $url = $req.Url.LocalPath
    if ($url -eq "/") { $url = "/index.html" }

    $basePath = "c:\Users\user\Documents\QuanLyTuyenDung"
    $filePath = Join-Path $basePath ($url.TrimStart("/") -replace "/", "\")

    if (Test-Path $filePath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()

        $mimeTypes = @{
            ".html" = "text/html;charset=utf-8"
            ".css"  = "text/css;charset=utf-8"
            ".js"   = "application/javascript;charset=utf-8"
            ".json" = "application/json;charset=utf-8"
            ".mp3"  = "audio/mpeg"
            ".png"  = "image/png"
            ".jpg"  = "image/jpeg"
            ".svg"  = "image/svg+xml"
            ".ico"  = "image/x-icon"
        }

        if ($mimeTypes.ContainsKey($ext)) {
            $res.ContentType = $mimeTypes[$ext]
        } else {
            $res.ContentType = "application/octet-stream"
        }

        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found: $url")
        $res.OutputStream.Write($msg, 0, $msg.Length)
    }

    $res.Close()
}
