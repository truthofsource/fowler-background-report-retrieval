# Repository review — November 12, 2026

## Fixed

1. **Generated code had no reproduction path.** Added a dependency-free generation/check command and made source/runtime consistency a prerequisite of every npm test run. The tested Node version is recorded in `.nvmrc` and reused by manual CI.
2. **Report URL policy differed between adapters.** The browser adapter now rejects query strings like the durable state model. A regression test exercises both paths; embedded credentials, foreign hosts and fragments also remain rejected.
3. **Malformed base-URL errors could expose the supplied value.** The evidence-client constructor now uses a bounded configuration error. A malformed upload response remains unconfirmed and never automatically resends.
4. **The diagram implied direct browser writes to Blob Storage.** It now shows captured bytes passing through the API's verified staging adapter. The local-operator evidence client and hosted worker transport are described separately.
5. **Preview failures were poorly explained.** Added strict port validation, readable startup errors, explicit method responses and server tests for local Host/Origin checks, unknown files and denied writes.

## Still outside this public reference

- Real provider navigation/capture, SQL transactions, Blob immutability, trusted scanner results, real token/role checks and protected PDF rendering need the full platform and separate live acceptance.
- The state model trusts verified actor/context inputs supplied by the calling API. The minimal extraction adapter does not authenticate them.
- The Terraform child module is not a complete deployment; the worker image entrypoint is part of the full platform, not built by this repository. HCL parsing/format checks do not prove provider schemas, network readiness or permissions.
- Its registry pull remains registry-scoped. The lifecycle resource owns the account-wide policy, including the retained optional SAM rule; existing policy rules must be preserved.
- Node type stripping is experimental and does not perform a full application typecheck. Runtime upgrades require review of generated output.
- These public-reference corrections are not a release or fix to the live workforce platform. No cloud resources, provider sessions, emails or employee data were changed during this review.
