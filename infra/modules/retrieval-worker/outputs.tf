output "api_settings_disabled" {
  value = {
    FOWLER_RETRIEVAL_ENABLED                      = "false"
    FOWLER_RETRIEVAL_WORKER_OBJECT_ID             = azurerm_user_assigned_identity.worker.principal_id
    FOWLER_RETRIEVAL_WORKER_JOB_RESOURCE_ID       = azapi_resource.job.id
    FOWLER_RETRIEVAL_STORAGE_URL                  = var.target.staging_storage_url
    FOWLER_RETRIEVAL_CONTAINER                    = azapi_resource.staging.name
    "AzureWebJobs.fowlerRetrievalWorker.Disabled" = "true"
  }
}
