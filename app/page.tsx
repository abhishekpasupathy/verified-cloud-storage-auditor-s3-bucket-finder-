"use client";

import { FormEvent, useState } from "react";

type Result = { name: string; provider: string; status: string; httpStatus?: number };
type Verification = { token: string; record: string; instructions: string };

export default function Home() {
  const [domain, setDomain] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");

  async function getToken(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setVerified(false); setResults([]); setLogs([]);
    try {
      const response = await fetch("/api/verify-domain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create a challenge");
      setDomain(data.domain); setVerification(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Request failed"); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!verification) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/verify-domain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain, token: verification.token }) });
      const data = await response.json();
      if (!data.verified) throw new Error(data.error ?? "TXT record not found yet");
      setVerified(true); setLogs(["DNS ownership verified. You can now begin the audit."]);
    } catch (err) { setError(err instanceof Error ? err.message : "Verification failed"); }
    finally { setBusy(false); }
  }

  function startScan() {
    if (!verification) return; setBusy(true); setError(""); setResults([]); setLogs(["Opening audit stream…"]);
    const source = new EventSource(`/api/scan?domain=${encodeURIComponent(domain)}&verifiedToken=${encodeURIComponent(verification.token)}`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; message?: string } & Result;
      if (data.type === "status" && data.message) setLogs((old) => [...old, data.message!]);
      if (data.type === "result") setResults((old) => [...old, data]);
      if (data.type === "done") { setLogs((old) => [...old, "Audit complete."]); setBusy(false); source.close(); }
    };
    source.onerror = () => { setError("The scan connection closed unexpectedly."); setBusy(false); source.close(); };
  }

  return <main>
    <section className="hero"><p className="eyebrow">AUTHORIZED SECURITY AUDITING</p><h1>Cloud Storage<br /><span>Exposure Auditor</span></h1><p>Find publicly reachable storage associated with domains you control. DNS proof is required before every scan.</p></section>
    <section className="panel">
      <form onSubmit={getToken}><label htmlFor="domain">Domain you own</label><div className="input-row"><input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" disabled={busy} required /><button disabled={busy}>{busy && !verification ? "Working…" : "Get verification token"}</button></div></form>
      {verification && <div className="challenge"><h2>1. Publish the DNS TXT record</h2><p>{verification.instructions}</p><code>{verification.record}</code><div className="actions"><button onClick={verify} disabled={busy || verified}>{verified ? "Domain verified" : "Verify TXT record"}</button>{verified && <button className="primary" onClick={startScan} disabled={busy}>{busy ? "Scanning…" : "Start scan"}</button>}</div></div>}
      {error && <p className="error">{error}</p>}
    </section>
    <section className="output"><div><h2>Live audit log</h2><div className="log" aria-live="polite">{logs.length ? logs.map((log, index) => <p key={`${log}-${index}`}>› {log}</p>) : <p>Awaiting verified domain.</p>}</div></div>
      <div><h2>Results <small>{results.length} checks</small></h2><div className="table-wrap"><table><thead><tr><th>Name</th><th>Provider</th><th>Result</th><th>HTTP</th></tr></thead><tbody>{results.map((result, index) => <tr key={`${result.name}-${result.provider}-${index}`}><td>{result.name}</td><td>{result.provider.replace("_", " ")}</td><td><span className={`badge ${result.status.toLowerCase()}`}>{result.status}</span></td><td>{result.httpStatus ?? "—"}</td></tr>)}{!results.length && <tr><td colSpan={4} className="empty">Results will appear as targets are checked.</td></tr>}</tbody></table></div></div>
    </section>
  </main>;
}
