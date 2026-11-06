resource "newrelic_synthetics_secure_credential" "account_id" {
  key         = "NR_ACCOUNT_ID"
  value       = tostring(var.account_id)
  description = "Account ID for IntellistackStatus event ingest"
}

resource "newrelic_synthetics_secure_credential" "insert_key" {
  key         = "NR_INSERT_KEY"
  value       = var.insert_key
  description = "Ingest license key for IntellistackStatus event ingest"
}

resource "newrelic_synthetics_secure_credential" "region" {
  key         = "NR_REGION"
  value       = var.region
  description = "Datacenter region for the Event API"
}

resource "newrelic_synthetics_script_monitor" "intellistack_status" {
  name             = "Intellistack Status Check"
  type             = "SCRIPT_BROWSER"
  status           = "ENABLED"
  period           = var.period
  locations_public = var.locations_public

  script                = file("${path.module}/intellistack-status-check.js")
  runtime_type          = "CHROME_BROWSER"
  runtime_type_version  = "100"
  script_language       = "JAVASCRIPT"
  enable_screenshot_on_failure_and_script = true

  depends_on = [
    newrelic_synthetics_secure_credential.account_id,
    newrelic_synthetics_secure_credential.insert_key,
    newrelic_synthetics_secure_credential.region,
  ]
}
