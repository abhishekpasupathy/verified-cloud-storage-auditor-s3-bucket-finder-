# Cloud Storage Exposure Auditor

An ownership-gated web auditor for publicly reachable AWS S3, Google Cloud Storage, and Azure Blob Storage names suggested by certificate-transparency data.

## Setup

Requires Node.js 18.17+.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, request a verification challenge, publish the shown `bucket-finder-verify=<token>` TXT value on the domain itself, then verify it and run the scan. The Next.js app needs no environment variables. Deploy it to Vercel normally.

The optional standalone agent needs Python 3.9+, the `groq` package (`pip install groq`), and a `GROQ_API_KEY` environment variable:

```bash
GROQ_API_KEY=... python3 agent.py --domain example.com
```

## Authorized use only

Use this tool only to audit domains you control or have explicit permission to test. The web scan requires a DNS TXT challenge-response for the exact domain before it can run; this is intentionally designed to prevent arbitrary-domain scanning. The separate Python agent has the same authorized-use requirement and must only be run after the operator has verified ownership outside the script.
