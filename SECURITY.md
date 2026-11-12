# Security boundaries

Use fictional data for this repository. Never submit credentials, real report files, SSNs, private person identifiers or provider-session state to issues or screenshots.

Public tests have no cloud credentials and use an invalid provider origin. The extracted state model assumes its caller has verified actor claims; it is not an authentication layer. Minimal boundary adapters exist only to run the extracted transition tests.

The full platform keeps staff actions separate from worker claim/completion, pins a credential version, checks current person links and requires trusted clean-file proof before protected downloads. No local test establishes live cloud permissions or employment eligibility.
