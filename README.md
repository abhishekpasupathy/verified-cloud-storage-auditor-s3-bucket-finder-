# Verified Cloud Storage Auditor

An ownership-gated, full-stack cloud-security project for finding potentially exposed AWS S3, Google Cloud Storage, and Azure Blob Storage endpoints associated with a domain the user controls.

> The application verifies DNS ownership before any real audit. It checks endpoint reachability only—it never lists, downloads, or modifies storage contents.

## Why this project exists

Storage exposure is a common cloud-security failure mode, but broad bucket enumeration is unsafe. This project is intentionally designed for defensive use: a user must publish a DNS TXT challenge on the exact domain before candidate discovery or provider checks are permitted.

## Features

- DNS TXT challenge-response ownership verification for every real audit
- Certificate Transparency (CT) log discovery of real subdomains
- A* / cheapest-first candidate generation over CT-derived labels
- SHA-256 Bloom-filter de-duplication
- Bounded-concurrency reachability checks for AWS S3, GCS, and Azure Blob Storage
- Live Server-Sent Events (SSE) audit progress and result table
- Optional Groq tool-calling agent that prioritizes permitted candidates
- Hard server-side limits: 12 agent rounds, 80 agent checks, 60 candidates, and a 50-second serverless work budget
- Standalone Python Groq agent for CLI-based authorized audits
- Passwordless email authentication, user-scoped scan history, and CSV export

## Architecture

```text
Browser → DNS ownership verification → Next.js API route
                                      ├─ CT-log subdomain lookup
                                      ├─ A* candidate generation + Bloom filter
                                      ├─ Provider HEAD checks (S3 / GCS / Azure)
                                      └─ SSE live results

Optional agentic route → Groq tool calling → same server-enforced CT and provider tools
```

## Tech stack

- Next.js 14 App Router, React 18, TypeScript
- Vercel-ready Node.js route handlers and SSE streaming
- Node DNS and Fetch APIs
- Groq SDK tool calling for agentic mode
- Python 3 standalone CLI agent

## Setup

Requires Node.js 18.17+.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, request a verification challenge, publish the shown `bucket-finder-verify=<token>` TXT value on the domain itself, then verify it and run the scan. Agentic mode needs `GROQ_API_KEY`; deterministic mode does not.

For local agentic mode, create an untracked `.env.local` file:

```text
GROQ_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Authentication and scan history setup

1. Create a free project at [Supabase](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to your deployed Vercel URL and add `https://your-app.vercel.app/auth/callback` to Redirect URLs.
4. Copy the Project URL and anon key from **Settings → API** into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Add those two variables to Vercel for Production, Preview, and Development, then redeploy.

The application uses passwordless email sign-in. Row Level Security in the supplied SQL ensures each user can read and update only their own scan history.

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
3. Add `GROQ_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables for Production, Preview, and Development. Do not prefix `GROQ_API_KEY` with `NEXT_PUBLIC_`.
4. Deploy. The API routes explicitly use Vercel's Node.js runtime and the scan has a 50-second work budget within its 60-second limit.

Agentic mode uses Groq tool calling, with exactly two server-enforced tools: CT-subdomain lookup and candidate reachability checks. It can only check names created from the verified domain's CT data, is capped at 12 tool-call rounds and 80 checks, and cannot list or download objects.

## How to run a real audit

1. Use a domain whose DNS you control. A shared `*.vercel.app` address cannot be verified.
2. Enter the apex domain (for example, `example.com`) in the app.
3. Copy the generated TXT value into your DNS provider using host/name `@`.
4. Wait for DNS propagation and choose **Verify TXT record**.
5. Start the normal scan, or enable agentic mode after configuring `GROQ_API_KEY`.

New domains with no CT-listed subdomains can return few or no candidates; that is expected.

## What this demonstrates

This is a useful portfolio project because it demonstrates secure-by-default product design, full-stack TypeScript, serverless deployment, real-time UX, bounded network automation, algorithmic candidate prioritization, cloud-provider HTTP behavior, and constrained LLM tool use. For an interview, be ready to explain why DNS verification, hard limits, and no-content-access are important design decisions.

## Tests

```bash
npm test
npm run build
```

The unit suite covers A* ordering, Bloom-filter membership, and CT-derived token weighting.

## Limitations

- An HTTP status is a reachability signal, not proof that a bucket belongs to the domain.
- CT logs may be incomplete or delayed.
- Shared Vercel subdomains cannot be used as verified domains.
- For larger authorized inventory reviews, use a queued worker and cloud-provider inventory APIs with explicit account authorization.

## Authorized use only

Use this tool only to audit domains you control or have explicit permission to test. The web scan requires a DNS TXT challenge-response for the exact domain before it can run; this is intentionally designed to prevent arbitrary-domain scanning. The separate Python agent has the same authorized-use requirement and must only be run after the operator has verified ownership outside the script.
