$BaseUrl = "http://localhost:4000"
$OrgId = 1

Write-Host "Health..."
Invoke-RestMethod "$BaseUrl/health" -Method GET | ConvertTo-Json -Depth 10

Write-Host "Metrics overview..."
Invoke-RestMethod "$BaseUrl/metrics/overview?org_id=$OrgId" -Method GET | ConvertTo-Json -Depth 10

Write-Host "Recent event logs..."
Invoke-RestMethod "$BaseUrl/event-logs?org_id=$OrgId&limit=5" -Method GET | ConvertTo-Json -Depth 10
