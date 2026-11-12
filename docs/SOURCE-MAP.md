# Source map and changes

`source-provenance.json` records the private implementation paths and content fingerprints used for this extraction, without private repository URLs or data. Public provider URLs use reports.example.invalid.

- `reference/report-retrieval.mjs`: original browser/candidate/capture adapter, with provider origin replaced. The public review also rejects query strings to match the state-model URL policy.
- `reference/applicant-candidates.test.mjs`: original offline exact-selection tests, with the same origin replacement.
- `reference/careops-evidence.mjs` and its tests: original local-operator file/target/receipt validation, with no supplied credentials or actual API target. The public review normalizes malformed base-URL errors so supplied values are not echoed. This delegated local-operator client is not the hosted worker transport.
- `reference/source/fowlerRetrieval.ts` and its test: original transition rules and tests; only imports and provider origin were adapted. Generated `.mjs` siblings let the tests run without installing a TypeScript toolchain. `scripts/build-reference.mjs` uses Node type stripping and adjusts only the runtime import locations; `npm test` fails if these generated files drift.
- `reference/boundaries.mjs`: minimal local error/type-list adapters. These do not replace the private authentication or document-intake implementation.
- `infra/modules/retrieval-worker`: related actual Terraform child module with generalized naming/target validation; account-wide policy ownership is explicitly retained.
- `demo`: a new fictional presentation around the extracted state model, not the private React UI.

The SQL store, full Functions handlers, protected viewer and scan processor are described but not copied into a falsely standalone deployment. No live configuration, applicant report or provider credential is included.

The public review changes are recorded in [REVIEW.md](REVIEW.md). They have not been deployed back to the operational platform.
