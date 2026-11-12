# Validation — November 12, 2026

- **18 original extracted-source Node tests passed**, with no skipped or failed cases.
- The local demonstration ran the extracted state model through report selection and two synthetic part receipts to `saved_for_scanning`.
- Headless Edge checked the local page at 1440px and 390px, with nonlocal requests blocked; neither layout overflowed, and the linked JSON demonstration returned the expected state/receipts.
- Four Terraform files parsed as HCL and passed `terraform fmt -check`. No provider-schema validation, plan or apply was performed for this extracted child module.
- TypeScript state source/tests were syntax-transpiled to the committed MJS files; this is not a full application typecheck. Minimal adapters supply the original error interface and component-type list.

[Machine-readable results](validation-results.json) · [Historical implementation evidence](IMPLEMENTATION.md)

The offline tests check state transitions, exact selection, malformed/oversized capture rejection, partial save/retry, changed-link/credential/lease rejection, target validation and safe staff views. Test PDF buffers/manifests are deliberately synthetic. They do not prove real PDF integrity, a live authentication denial, provider browser rendering, cloud storage permissions or scan completion.

No cloud resources were started, no new provider search/order was run, no reports or credentials were uploaded and no hosted CI was dispatched. Screenshots show the running fictional local demonstration. There is no new live production acceptance claim.
