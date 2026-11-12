locals {
  suffix       = var.target.environment == "production" ? "prod" : "np"
  job_name     = "job-demo-fowler-retrieve-${local.suffix}"
  job_id       = "${var.target.resource_group_id}/providers/Microsoft.App/jobs/${local.job_name}"
  secret_scope = "${var.target.vault_id}/secrets/fowler-provider-credentials"
}

resource "azurerm_user_assigned_identity" "worker" {
  name                = "id-demo-fowler-retrieve-${local.suffix}-001"
  resource_group_name = var.target.resource_group_name
  location            = var.target.location
  tags                = var.target.tags
}

resource "azurerm_role_assignment" "worker_read" {
  scope              = local.secret_scope
  role_definition_id = var.target.credential_reader_role_id
  principal_id       = azurerm_user_assigned_identity.worker.principal_id
  principal_type     = "ServicePrincipal"
}
resource "azurerm_role_assignment" "image_pull" {
  scope                = var.target.registry_id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.worker.principal_id
  principal_type       = "ServicePrincipal"
}
resource "azuread_app_role_assignment" "worker_api" {
  app_role_id         = var.target.api_worker_app_role_id
  principal_object_id = azurerm_user_assigned_identity.worker.principal_id
  resource_object_id  = var.target.api_service_principal_id
}
resource "azapi_resource" "job" {
  type      = "Microsoft.App/jobs@2025-01-01"
  name      = local.job_name
  parent_id = var.target.resource_group_id
  location  = var.target.location
  tags      = var.target.tags
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.worker.id]
  }
  body = {
    properties = {
      environmentId       = var.target.container_environment_id
      workloadProfileName = "Consumption"
      configuration = {
        triggerType         = "Manual"
        replicaTimeout      = 300
        replicaRetryLimit   = 0
        manualTriggerConfig = { parallelism = 1, replicaCompletionCount = 1 }
        registries          = [{ server = var.target.registry_server, identity = azurerm_user_assigned_identity.worker.id }]
      }
      template = {
        containers = [{
          name      = "fowler-retrieve"
          image     = "${var.target.registry_server}/fowler/retrieval@${var.target.image_digest}"
          command   = ["node"]
          args      = ["scripts/fowler/run-retrieval.mjs"]
          resources = { cpu = 1, memory = "2Gi" }
          env = [
            { name = "AZURE_CLIENT_ID", value = azurerm_user_assigned_identity.worker.client_id },
            { name = "FOWLER_KEY_VAULT_URL", value = var.target.vault_url },
            { name = "FOWLER_API_BASE_URL", value = var.target.api_base_url },
            { name = "FOWLER_API_SCOPE", value = var.target.api_scope },
          ]
        }]
      }
    }
  }
  depends_on = [azurerm_role_assignment.image_pull, azurerm_role_assignment.worker_read, azuread_app_role_assignment.worker_api]
}
resource "azurerm_role_assignment" "api_start" {
  scope              = azapi_resource.job.id
  role_definition_id = var.target.job_start_role_id
  principal_id       = var.target.api_principal_id
  principal_type     = "ServicePrincipal"
}

# ARM-managed container creation works while the data plane stays private.
resource "azapi_resource" "staging" {
  type      = "Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01"
  name      = "fowler-retrieval-${local.suffix}"
  parent_id = "${var.target.staging_storage_account_id}/blobServices/default"
  body      = { properties = { publicAccess = "None" } }
}
# Dedicated prefix only. Accepted documents use the separate staff intake path.
# Preflight must establish no unmanaged lifecycle policy before adoption/apply.
resource "azurerm_storage_management_policy" "checkpoint_retention" {
  storage_account_id = var.target.staging_storage_account_id
  rule {
    name    = "expire-fowler-checkpoints"
    enabled = true
    filters {
      prefix_match = ["fowler-retrieval-${local.suffix}/fowler-retrieval/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob { delete_after_days_since_creation_greater_than = 2 }
    }
  }
  # One account-wide policy owner preserves the existing Fowler rule. SAM's
  # recovery window is seven days; its isolated prefix retains an extra day.
  dynamic "rule" {
    for_each = var.target.sam_browser_retention ? [1] : []
    content {
      name    = "expire-sam-browser-checkpoints"
      enabled = true
      filters {
        prefix_match = ["sam-browser-staging-${local.suffix}/sam-browser/"]
        blob_types   = ["blockBlob"]
      }
      actions {
        base_blob { delete_after_days_since_creation_greater_than = 8 }
      }
    }
  }
}
