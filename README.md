# Verified Cloud Storage Auditor

An ownership-gated web auditor for publicly reachable AWS S3, Google Cloud Storage, and Azure Blob Storage names suggested by certificate-transparency data. It checks only bucket/container reachability; it never lists or downloads storage contents.

## Setup

Requires Node.js 18.17+.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, request a verification challenge, publish the shown `bucket-finder-verify=<token>` TXT value on the domain itself, then verify it and run the scan. Agentic mode needs `GROQ_API_KEY`; deterministic mode does not.

The optional standalone agent needs Python 3.9+, the `groq` package (`pip install groq`), and a `GROQ_API_KEY` environment variable. Get this key from the [Groq Console](https://console.groq.com/keys). The Vercel agentic endpoint uses the same key server-side.

```bash
GROQ_API_KEY=... python3 agent.py --domain example.com
```

On macOS/Linux, to use the key for the current terminal session:

```bash
export GROQ_API_KEY="your_key_here"
python3 agent.py --domain example.com
```

## Deploying the web app to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/new), import the repository and leave the framework preset as **Next.js**.
3. Add `GROQ_API_KEY` as an environment variable for Production, Preview, and Development. Do not prefix it with `NEXT_PUBLIC_`.
4. Deploy. The API routes explicitly use Vercel's Node.js runtime and the scan has a 50-second work budget within its 60-second limit.

Agentic mode uses Groq tool calling, with exactly two server-enforced tools: CT-subdomain lookup and candidate reachability checks. It can only check names created from the verified domain's CT data, is capped at 12 tool-call rounds and 80 checks, and cannot list or download objects.

## Authorized use only

Use this tool only to audit domains you control or have explicit permission to test. The web scan requires a DNS TXT challenge-response for the exact domain before it can run; this is intentionally designed to prevent arbitrary-domain scanning. The separate Python agent has the same authorized-use requirement and must only be run after the operator has verified ownership outside the script.
