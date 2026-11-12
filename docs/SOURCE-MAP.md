# Source map and changes

`source-provenance.json` records the private implementation paths and content fingerprints used for this extraction, without private repository URLs or data. Public provider URLs use reports.example.invalid.

- `reference/report-retrieval.mjs`: original browser/candidate/capture adapter, with provider origin replaced.
- `reference/applicant-candidates.test.mjs`: original offline exact-selection tests, with the same origin replacement.
- `reference/careops-evidence.mjs` and its tests: original file/target/receipt validation, with no supplied credentials or actual API target.
- `reference/source/fowlerRetrieval.ts` and its test: original transition rules and tests; only imports and provider origin were adapted. Generated `.mjs` siblings let the tests run without installing a TypeScript toolchain.
- `reference/boundaries.mjs`: minimal local error/type-list adapters. These do not replace the private authentication or document-intake implementation.
- `infra/modules/retrieval-worker`: related actual Terraform child module with generalized naming/target validation; account-wide policy ownership is explicitly retained.
- `demo`: a new fictional presentation around the extracted state model, not the private React UI.

The SQL store, full Functions handlers, protected viewer and scan processor are described but not copied into a falsely standalone deployment. No live configuration, applicant report or provider credential is included.
