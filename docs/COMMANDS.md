# Local commands and where they run

Run from this repository root in PowerShell, Bash or a terminal with Node.js 22.13 or newer. The exact tested runtime is 22.23.2 in `.nvmrc`, also used by the manual-only CI workflow.

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

## Editing the extracted state model

Edit the TypeScript files under `reference/source`, then regenerate their runnable copies:

```bash
npm run build:reference
npm test
```

`npm test` first checks the generated files against their source and then runs both test suites. Generation uses Node's built-in experimental type-stripping API, with no downloaded compiler or npm dependencies; its warning is expected. This strips syntax and does not typecheck the complete original application. When upgrading the tested Node version, inspect any generated-code differences and rerun the checks.

## If the preview will not start

The default is `http://127.0.0.1:8788`; use that exact address rather than `localhost`, because the Host check is deliberate. If the port is occupied, choose an unused port, for example:

```powershell
$env:PORT = '8790'
npm run preview
```

```bash
PORT=8790 npm run preview
```

Use the address printed by the process. PORT must be an integer from 1024 to 65535; the preview never accepts writes or serves arbitrary repository files.
