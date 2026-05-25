$path = "Digital viyabari.pem"
# Grant current user full control and remove all others
icacls $path /reset
icacls $path /inheritance:r
icacls $path /grant:r "$($env:username):R"

$users = @("ec2-user", "ubuntu", "admin", "bitnami", "root")
foreach ($user in $users) {
    Write-Host "Testing user: $user..."
    ssh -i $path -o StrictHostKeyChecking=no -o ConnectTimeout=5 "${user}@3.86.4.100" "echo 'Success as $user'" 2>&1 | Write-Host
}
