# Related worker Terraform

The child module is extracted from the actual retrieval-worker definition. Names and fixed environment endpoints were generalized; there is no root provider/backend, environment input file or deployment workflow. It is source for study, not a one-command deployment.

It describes a dedicated managed identity, exact-secret reader assignment, API application role, registry pull, Manual one-shot job with zero automatic replica retries, exact-job start assignment, private capture container and a prefix-scoped checkpoint lifecycle rule. Registry pull is scoped to the supplied registry in this extraction; it does not claim repository-only pull permissions.

Compose it only after independently reviewing target IDs, allowed API origin, identity/RBAC, private connectivity, DNS, image digest and policy ownership. The generalized validation cannot establish that a supplied endpoint is your trusted deployment. The lifecycle-policy resource owns the account's full policy: preserve every existing rule or use a separate owned account. Its optional SAM retention rule is retained to show the original shared-policy ownership; it is not Fowler functionality.

No private endpoint or SQL database is created here. A private container ACL does not establish private network reachability. Published worker source/image, readable credentials, API permissions, storage access and a running scan path each require separate deployment acceptance.
