variable "account_id" {
  type        = number
  description = "New Relic account ID"
}

variable "user_api_key" {
  type        = string
  sensitive   = true
  description = "New Relic User API key (NRAK-...) used by the Terraform provider"
}

variable "insert_key" {
  type        = string
  sensitive   = true
  description = "New Relic Ingest - License key used by the script to post IntellistackStatus events"
}

variable "region" {
  type        = string
  default     = "US"
  description = "New Relic region: US or EU"
}

variable "locations_public" {
  type        = list(string)
  default     = ["AWS_AP_SOUTHEAST_2"] # Sydney; single location avoids duplicate events
  description = "Public Synthetics locations to run from"
}

variable "period" {
  type        = string
  default     = "EVERY_5_MINUTES"
  description = "Monitor run frequency"
}
