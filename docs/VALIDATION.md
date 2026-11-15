# Validation — November 12, 2026

> Placeholder screenshots were removed on November 15, 2026. Written test results below retain their original dates and scope; historical screenshot references describe earlier captures. Proper Azure and application screenshots are deferred. The illustrated architecture is a source-based explanation, not a live-service screenshot.

- **27 Node tests passed**: 18 original extracted-source tests plus 9 review regression tests, with no skipped or failed cases.
- The local demonstration ran the extracted state model through report selection and two synthetic part receipts to `saved_for_scanning`.
- Headless Edge checked the local page at 1440px and 390px, with nonlocal requests blocked; neither layout overflowed, and the linked JSON demonstration returned the expected state/receipts.
- Four Terraform files parsed as HCL and passed `terraform fmt -check`. No provider-schema validation, plan or apply was performed for this extracted child module.
- TypeScript state source/tests were stripped with the committed Node generation script, and the source/runtime drift check passed; this is not a full application typecheck. Minimal adapters supply the original error interface and component-type list.

[Machine-readable results](validation-results.json) · [Historical implementation evidence](IMPLEMENTATION.md)

The offline tests check state transitions, exact selection, malformed/oversized capture rejection, partial save/retry, changed-link/credential/lease rejection, target validation and safe staff views. Test PDF buffers/manifests are deliberately synthetic. They do not prove real PDF integrity, a live authentication denial, provider browser rendering, cloud storage permissions or scan completion.

No cloud resources were started, no new provider search/order was run, no reports or credentials were uploaded and no hosted CI was dispatched. Screenshots show the running fictional local demonstration. There is no new live production acceptance claim.

The nine new regression cases cover aligned report URL restrictions, safe configuration errors, a malformed upload response with no automatic resend, preview port validation, HTML/JSON responses, arbitrary-file refusal, Host/Origin rejection and write refusal. These are public-reference checks, not a live CareOps security assessment.
