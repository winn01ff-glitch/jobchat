$envs = @("production", "preview", "development")
$vars = @{
    "SMTP_HOST" = "smtp.gmail.com"
    "SMTP_PORT" = "587"
    "SMTP_USER" = "uphillpayslip@gmail.com"
    "SMTP_PASS" = "fvmspgnfwsuuplep"
}
foreach ($var in $vars.Keys) {
    foreach ($env in $envs) {
        Write-Host "Adding $var to $env..."
        cmd /c npx vercel env add $var $env --value $vars[$var] --yes --force
    }
}
