# Local commands and where they run

Run from this repository root in PowerShell, Bash or a terminal with Node.js 22+.

```bash
node --version
npm test
npm run demo
npm run preview
```

The preview listens only on 127.0.0.1:8788. Open that exact address, follow the JSON link to run the state model, and use Ctrl+C to stop it. No password, Azure sign-in or API key is needed.

The public provider origin is example.invalid and cannot be used for live retrieval. Browser-capture functions require an authenticated, policy-restricted context supplied by the actual worker; this project does not supply one.

```bash
# Optional source-format check; no plan, apply or backend access
terraform fmt -check -recursive infra
```

Delete the local clone to remove this demonstration. It creates no cloud resources or persistent business records, and there is no cloud-destroy instruction to run.
