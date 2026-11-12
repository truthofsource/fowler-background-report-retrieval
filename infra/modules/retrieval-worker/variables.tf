# No defaults: composing this module requires a reviewed environment-specific target.
variable "target" {
  type = object({
    environment                = string
    location                   = string
    resource_group_name        = string
    resource_group_id          = string
    container_environment_id   = string
    registry_id                = string
    registry_server            = string
    image_digest               = string
    vault_id                   = string
    vault_url                  = string
    api_principal_id           = string
    api_service_principal_id   = string
    api_worker_app_role_id     = string
    api_base_url               = string
    api_scope                  = string
    credential_reader_role_id  = string
    job_start_role_id          = string
    staging_storage_account_id = string
    staging_storage_url        = string
    sam_browser_retention      = optional(bool, false)
    tags                       = map(string)
  })
  validation {
    condition     = contains(["nonproduction", "production"], var.target.environment) && can(regex("^sha256:[a-f0-9]{64}$", var.target.image_digest))
    error_message = "Select nonproduction/production and an immutable SHA-256 image digest."
  }
  validation {
    condition     = can(regex("^https://[a-zA-Z0-9-]+\\.azurewebsites\\.net$", var.target.api_base_url))
    error_message = "Supply the reviewed API origin; this public extraction has no configured production target."
  }
  validation {
    condition     = can(regex("^https://[a-zA-Z0-9-]{3,24}\\.vault\\.azure\\.net/?$", var.target.vault_url)) && can(regex("^[a-z0-9]+\\.azurecr\\.io$", var.target.registry_server))
    error_message = "Use reviewed Azure Key Vault and registry endpoints."
  }
}
