terraform {
  required_version = ">= 1.3"

  required_providers {
    newrelic = {
      source  = "newrelic/newrelic"
      version = "~> 3.0"
    }
  }
}

provider "newrelic" {
  account_id = var.account_id
  api_key    = var.user_api_key # User API key (NRAK-...)
  region     = var.region
}
