# Verified Cloud Storage Auditor

An ownership-gated, full-stack cloud-security platform for finding potentially exposed AWS S3, Google Cloud Storage, and Azure Blob Storage endpoints associated with a domain the user controls.

> **Defensive use only:** the application verifies DNS ownership before any real audit. It checks endpoint reachability only—it never lists, downloads, or modifies storage contents.

## The Problem

Cloud storage is one of the easiest places for an organization to accidentally expose data. A bucket, blob container, or storage endpoint can become reachable because of an overly permissive access policy, a forgotten development resource, an old backup, or infrastructure that was created outside the team's normal inventory process.

The difficult part is not simply checking whether one known bucket is public. In real environments, teams may have many subdomains, project names, environments, static-asset stores, backups, and legacy resources. Cloud storage names are also not necessarily visible from the main application domain.

Traditional approaches have two major problems:

1. **Manual discovery does not scale.** Security engineers may need to inspect DNS, cloud consoles, certificates, old infrastructure, and application configuration to build a useful list of storage candidates.
2. **Unrestricted enumeration is unsafe.** A tool that blindly guesses or enumerates arbitrary bucket names can cross authorization boundaries and create unnecessary network traffic.

This project addresses the discovery problem while deliberately keeping the scanner constrained to domains the operator has demonstrated control over.

## The Solution

Verified Cloud Storage Auditor turns cloud-storage exposure checking into a controlled workflow:

```text
User signs in
     ↓
Enters a domain they control
     ↓
Application generates a random DNS TXT challenge
     ↓
User publishes the challenge on the domain
     ↓
Server verifies the TXT record
     ↓
Certificate Transparency data provides domain-associated subdomains
     ↓
Candidate engine prioritizes likely storage names
     ↓
Exact set de-duplication removes duplicate candidates
     ↓
Bounded checks test S3 / GCS / Azure endpoints
     ↓
Results stream to the dashboard in real time
     ↓
Findings can be reviewed, exported, and stored in scan history
```

The important design principle is **ownership before discovery**. The tool does not allow the web scanner to operate against an arbitrary domain first and ask questions later. The DNS challenge is the authorization gate that must succeed before candidate discovery and provider checks are performed.

## Why DNS Verification Matters

A domain name by itself is not proof that the person using the application is authorized to assess it. The application therefore generates a random TXT challenge such as:

```text
bucket-finder-verify=RANDOM_TOKEN
```

The operator publishes that value in the domain's DNS. The server then resolves the domain's TXT records and requires an exact match.

This creates a simple proof-of-control mechanism:

```text
                 Can the user change DNS?
                         │
                    ┌────▼────┐
                    │   DNS   │
                    │ TXT     │
                    │ challenge│
                    └────┬────┘
                         │
                 Exact token match?
                    /           \
                  NO             YES
                  ↓                ↓
             Block scan       Allow audit
```

This is intentionally stronger than asking the user to type a domain into a form and assuming it is theirs.

## How the Discovery Problem Is Solved

Once ownership is verified, the scanner needs useful candidate names without performing unrestricted brute force.

### 1. Certificate Transparency discovery

The application queries Certificate Transparency data for subdomains associated with the verified domain. CT records can reveal names such as:

```text
app.example.com
static.example.com
assets.example.com
api.example.com
staging.example.com
```

These names provide real infrastructure-derived signals instead of relying only on a large dictionary.

### 2. Candidate generation

The candidate engine extracts labels and useful tokens from the CT-derived names and combines them with controlled storage-related terms. A uniform-cost / best-first strategy prioritizes more promising combinations.

### 3. De-duplication

An exact `Set` prevents the same candidate from being processed repeatedly. The candidate set is also hard-limited to keep the scan bounded.

```text
CT subdomains
     ↓
Extract labels/tokens
     ↓
Weighted candidate combinations
     ↓
Uniform-cost / best-first ordering
     ↓
Exact set de-duplication
     ↓
Maximum candidate limit
```

## How Storage Exposure Is Detected

For each bounded candidate, the application constructs provider-specific endpoint patterns and performs an HTTP `HEAD` request. It does **not** download objects or enumerate files.

Supported endpoint families include:

```text
AWS S3
https://<candidate>.s3.amazonaws.com/

Google Cloud Storage
https://storage.googleapis.com/<candidate>/

Azure Blob Storage
https://<candidate>.blob.core.windows.net/
```

The response is classified into application-level states:

| HTTP / request result | Classification | Meaning |
|---|---|---|
| 200 | `PUBLIC` | Endpoint responded successfully to the unauthenticated reachability check |
| 403 | `EXISTS_PRIVATE` | Endpoint responded but denied access |
| 404 | `NOT_FOUND` | Endpoint was not found at the tested URL |
| Other | `UNKNOWN` | Response did not match the explicit classifications |
| Request failure | `ERROR` | Timeout or network/request failure |

A `PUBLIC` result is therefore a **reachability signal**, not proof that the resource belongs to the domain or that sensitive files are present. Final security conclusions should be validated by the authorized cloud owner.

## What Makes the Solution Safer

The project deliberately includes several guardrails:

- DNS ownership verification before web scanning
- Bounded candidate generation
- Maximum 60 generated candidates
- Bounded concurrency for provider checks
- Five-second request timeouts
- A 50-second serverless scan work budget
- Agentic mode limited to 12 rounds and 80 checks
- Server-enforced tool boundaries for the AI agent
- No object listing
- No object downloading
- No cloud-resource modification

These constraints make the project suitable as a defensive auditing demonstration rather than an unrestricted bucket-enumeration tool.

## AI Agent: Why It Is Useful

The project also includes an optional Groq tool-calling agent. The AI is not given unrestricted network access. Instead, the server exposes a small set of permitted tools for CT discovery and candidate reachability.

The agent can prioritize which permitted candidates/checks are most useful while the server remains responsible for authorization and hard limits.

```text
Verified domain
      ↓
Groq AI agent
      ↓
Choose from permitted tools
      ↓
┌──────────────────────────────┐
│ CT subdomain lookup          │
│ Candidate reachability check │
└──────────────────────────────┘
      ↓
Server enforces limits
      ↓
Results
```

This demonstrates **constrained agentic automation** rather than simply using an LLM to generate text.

## Architecture

```text
Browser / SaaS Dashboard
          │
          ├── GitHub OAuth / Supabase session
          │
          ▼
    Next.js API routes
          │
          ├── DNS ownership verification
          │
          ├── CT-log subdomain lookup
          │
          ├── Uniform-cost / best-first candidate generation
          │
          ├── Exact `Set`-based de-duplication
          │
          ├── S3 / GCS / Azure HEAD checks
          │
          └── SSE live audit stream
          │
          ▼
 Dashboard → Findings → CSV → Scan History

Optional:
Next.js agent route → Groq tool calling → same server-enforced tools
```

## Features

- DNS TXT challenge-response ownership verification for every real audit
- Certificate Transparency (CT) log discovery of real subdomains
- Uniform-cost / best-first candidate generation over CT-derived labels
- Exact `Set`-based candidate de-duplication
- Bounded-concurrency reachability checks for AWS S3, GCS, and Azure Blob Storage
- Live Server-Sent Events (SSE) audit progress and result table
- Optional Groq tool-calling agent that prioritizes permitted candidates
- Hard server-side limits: 12 agent rounds, 80 agent checks, 60 candidates, and a 50-second serverless work budget
- Standalone Python Groq agent for CLI-based authorized audits
- GitHub OAuth authentication, user-scoped scan history, and CSV export

## Tech Stack

- Next.js 14 App Router, React 18, TypeScript
- Vercel-ready Node.js route handlers and SSE streaming
- Supabase Auth and database with Row Level Security
- GitHub OAuth
- Node DNS and Fetch APIs
- Groq SDK tool calling for agentic mode
- Python 3 standalone CLI agent

## Setup

Requires Node.js 18.17+.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, sign in with GitHub, request a verification challenge, publish the shown `bucket-finder-verify=<token>` TXT value on the domain itself, verify it, then run the scan. Agentic mode needs `GROQ_API_KEY`; deterministic mode does not.

For local agentic mode, create an untracked `.env.local` file:

```text
GROQ_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Authentication and Scan History Setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it.
3. Configure GitHub OAuth in Supabase Authentication → Providers.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to your deployed Vercel URL and add `https://your-app.vercel.app/auth/callback` to Redirect URLs.
5. Copy the Project URL and anon/publishable key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Add those variables to Vercel for Production, Preview, and Development, then redeploy.

Row Level Security in the supplied SQL ensures each authenticated user can access only their own scan history.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the repository and use the **Next.js** framework preset.
3. Add `GROQ_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables for Production, Preview, and Development. Do not prefix `GROQ_API_KEY` with `NEXT_PUBLIC_`.
4. Deploy.
5. Configure the production URL in Supabase and GitHub OAuth redirect settings.

## How to Run a Real Audit

1. Use a domain whose DNS you control or have explicit authorization to test. A shared `*.vercel.app` address cannot be verified as a customer-owned domain.
2. Enter the apex domain, for example `example.com`.
3. Copy the generated TXT value into your DNS provider using host/name `@`.
4. Wait for DNS propagation and choose **Verify TXT record**.
5. Start the normal scan, or enable AI-assisted mode after configuring `GROQ_API_KEY`.
6. Review live results and export CSV when the scan completes.

New domains with no CT-listed subdomains can return few or no candidates; that is expected and does not prove that no cloud resources exist.

## What This Demonstrates

This project demonstrates more than a bucket checker. It combines:

- Secure-by-default authorization design
- Full-stack TypeScript and Next.js
- Authentication and user-scoped persistence
- DNS and Certificate Transparency data processing
- Algorithmic candidate prioritization
- Exact, bounded candidate de-duplication
- Concurrent network I/O and HTTP response classification
- Server-Sent Events for real-time UX
- Multi-cloud endpoint analysis
- Constrained LLM tool calling
- Serverless deployment and SaaS-style product design

For an interview, be ready to explain the central design trade-off: **how to discover useful storage candidates without turning the application into an unrestricted enumeration tool.**

## Tests

```bash
npm test
npm run build
```

The unit suite covers best-first ordering, exact candidate de-duplication and limits, and CT-derived token weighting.

## Authorized end-to-end POC

For a repeatable demonstration using an empty private S3 bucket and a domain you control, see [the authorized S3 detection POC](./poc/README.md). It includes Terraform, DNS/Certificate Transparency validation, expected scan evidence, and cleanup steps.

## Limitations

- An HTTP status is a reachability signal, not proof that a bucket belongs to the domain.
- CT logs may be incomplete or delayed.
- Candidate generation is intentionally bounded.
- Shared Vercel subdomains cannot be used as verified domains.
- For larger authorized inventory reviews, use queued workers and cloud-provider inventory APIs with explicit account authorization.

## Authorized Use Only

Use this tool only to audit domains you control or have explicit permission to test. The web scan requires a DNS TXT challenge-response for the exact domain before it can run; this is intentionally designed to prevent arbitrary-domain scanning. The separate Python agent has the same authorized-use requirement and must only be run after the operator has verified ownership outside the script.
