# Build your own from scratch: Fowler Background Report Retrieval

Your own saved-PDF retrieval exercise with an exact fictional person/reference, a protected local provider stub and a capture manifest.

Start with a new folder, your own files and your own accounts. The numbered steps below describe the build; no portfolio repository checkout is required. The existing implementation/evidence elsewhere in this repository is a separate reference, not a claim that your new build has already passed.

## Prerequisites

Python, ReportLab, requests and pypdf in a virtual environment. The local stub has no Fowler credentials, provider login or paid order capability; live vendor integration requires your own approved provider contract/API.

Use Bash on Linux/macOS/WSL for Bash blocks and PowerShell for PowerShell blocks. Select the tool versions supported by the official sources below, record the versions you actually install and retain generated dependency locks. Cloud resources, scanner downloads, logs and external AI calls can create costs; review the stated scope before enabling them.

## Create your project folder

Choose a new folder name. These first commands create a blank project; an optional `git init` gives it its own history. Create parent directories in your editor when a later step introduces a nested file.

```bash
mkdir my-fowler-background-report-retrieval
cd my-fowler-background-report-retrieval
git init
```

Create `.gitignore` before saving credentials or build outputs:

```gitignore
.venv/
node_modules/
.env
.env.*
local.settings.json
credentials.json
token.json
*.pem
*.key
*.tfstate*
*.tfplan
.terraform/
private*/
captures/
backups/
batch.json
reports/
out/
app-config.local.yaml
```

The source/file snippets are a starting implementation you type or paste into the named files. Replace `YOUR_*`, names, regions and addresses only with values from your own lab; do not place real client/employee records in a test project. Keep your terminal in this project root unless a step explicitly changes directory.

Before a first commit, set your own repository-local author with `git config user.name "YOUR_NAME"` and `git config user.email "YOUR_PUBLIC_COMMIT_EMAIL"`. Review `git status --short` and the staged diff before publishing; ignored local files are not a substitute for reviewing what you upload.

## Step 1 — Define the report ownership contract

**Where:** A new request.json file.

Write a stable fictional employee ID, provider reference and expected source host, keeping report creation/order separate from retrieval. A name match alone must not choose a background report.

Create **`request.json`** with the following contents:

```json
{"employee_id":"LAB-001","provider_reference":"REPORT-001","source":"local-provider-stub"}
```

**Check before continuing:** You can identify the exact permitted person/report pair.

## Step 2 — Create a PDF you own

**Where:** Your new project folder.

Install the libraries below and create make_report.py. This PDF is fictional test content, so no report or employee finding is published.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install reportlab requests pypdf
.venv/bin/python -m pip freeze > requirements.lock.txt
```

Create **`make_report.py`** with the following contents:

```python
from pathlib import Path
from reportlab.pdfgen import canvas
Path('provider').mkdir(exist_ok=True)
c = canvas.Canvas('provider/report.pdf')
c.drawString(72, 740, 'FICTIONAL REPORT - LAB-001 - REPORT-001')
c.drawString(72, 710, 'Retrieval test only; no real background finding.')
c.save()
```

**Check before continuing:** provider/report.pdf is a real parseable PDF.

## Step 3 — Start your local provider stub

**Where:** One terminal in the project root.

Generate the PDF, then serve only the provider directory on loopback. This is a controlled file source for your worker, not a vendor authentication simulation.

```bash
.venv/bin/python make_report.py
.venv/bin/python -m http.server 8890 --bind 127.0.0.1 --directory provider
```

**Check before continuing:** The PDF is available only through your local test endpoint.

## Step 4 — Write your bounded retriever

**Where:** Your editor.

Create retrieve.py below. It limits the downloaded bytes, refuses redirects, parses the PDF and binds the saved copy to the fictional request; it does not infer a finding from the PDF text.

Create **`retrieve.py`** with the following contents:

```python
from pathlib import Path
from datetime import datetime, timezone
import hashlib, io, json
import requests
from pypdf import PdfReader
request = json.loads(Path('request.json').read_text())
if request != {'employee_id':'LAB-001','provider_reference':'REPORT-001','source':'local-provider-stub'}:
    raise ValueError('Review the exact fictional request before adapting this example')
r = requests.get('http://127.0.0.1:8890/report.pdf', timeout=20, stream=True, allow_redirects=False)
if r.status_code != 200: raise ValueError('PDF retrieval failed')
data = bytearray()
for part in r.iter_content(65536):
    data.extend(part)
    if len(data) > 10 * 1024 * 1024: raise ValueError('PDF exceeds limit')
pdf = PdfReader(io.BytesIO(data), strict=True)
if pdf.is_encrypted or not 1 <= len(pdf.pages) <= 100: raise ValueError('Unsupported PDF')
Path('captures').mkdir(exist_ok=True)
with Path('captures/LAB-001-REPORT-001.pdf').open('xb') as output: output.write(data)
manifest = {**request, 'retrieved_at': datetime.now(timezone.utc).isoformat(),
            'sha256': hashlib.sha256(data).hexdigest(), 'pages': len(pdf.pages)}
with Path('captures/LAB-001-REPORT-001.json').open('x') as output: json.dump(manifest, output, indent=2)
print({'saved': True, 'pages': len(pdf.pages)})
```

**Check before continuing:** The retriever records a person/reference/hash and refuses an existing capture filename.

## Step 5 — Run and inspect your saved evidence

**Where:** Second terminal in the same folder.

Run the retriever, open the saved PDF and compare the manifest hash with the captured bytes. Retry without deleting the prior capture to verify overwrite protection; on a partial/unknown save, inspect the files and reconcile rather than blindly ordering or retrieving again.

```bash
.venv/bin/python retrieve.py
sha256sum captures/LAB-001-REPORT-001.pdf
```

**Check before continuing:** Your saved report and manifest match the exact fictional request.

## Step 6 — Define the live-provider and access extensions

**Where:** Your worker/API design.

Replace the stub only after obtaining your own approved provider interface and exact-record authorization. Add malware scanning, a durable atomic capture/checkpoint, same-capture recovery, duplicate locking, protected PDF access and safe failure stages before calling it a production retrieval service.

**Check before continuing:** The tutorial's completed capture and the additional live-service controls are clearly separated.

## Step 7 — Record and close the lab

**Where:** Your terminals and files.

Save a value-free flow diagram and your successful/duplicate-failure observations, then stop the stub with Ctrl+C. Retain or remove only the fictional captures according to your lab retention decision.

**Check before continuing:** The reader can create the PDF source and retrieval worker without your existing report records.

## Verification and your own screenshots

| Evidence | What to record | Your result |
| --- | --- | --- |
| New build | Your own files/resource settings and tool versions | Not yet recorded |
| Working path | The actual successful request, configuration or recovery result | Not yet recorded |
| Failure boundary | A meaningful denied, malformed, stale or failed case | Not yet recorded |
| Recovery / cleanup | What you restored or removed and what remains billed | Not yet recorded |

Capture your own architecture/configuration, one working result and one failure/recovery result. Keep tokens, credentials, personal records and private identifiers out of public screenshots. Existing portfolio images are references, not evidence that you performed these steps.

## Troubleshooting order

1. Confirm the named file, working directory and selected tool/interpreter.
2. Check the exact input and resource/account selected for the failing step.
3. Separate identity permission, network/DNS reachability and application validation.
4. Keep the actual error and reconcile an unknown write outcome before repeating it; do not widen access or repeat paid operations blindly.

The numbered steps describe a build procedure. Local syntax checks, an accepted API request, a completed hosted operation and a human verification are different evidence levels; fill in the verification table with what you actually observed.

## Official implementation references

- [requests.readthedocs.io — advanced](https://requests.readthedocs.io/en/latest/user/advanced/)
- [pypdf.readthedocs.io — stable](https://pypdf.readthedocs.io/en/stable/)

The walkthrough layout follows the prerequisites → creation/configuration → test → verification → troubleshooting → cleanup pattern of the [Splunk project reference](https://github.com/davidharris6/splunk-siem-log-analysis). Its Splunk-specific settings are not copied into unrelated projects.
