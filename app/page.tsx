"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseBrowser";

type Result = { name: string; provider: string; status: string; httpStatus?: number };
type Verification = { token: string; record: string; instructions: string };
type ScanHistory = { id: string; domain: string; mode: string; started_at: string; checks: number; public_findings: number; results: Result[] };

export default function Home() {
  const [domain, setDomain] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [agentic, setAgentic] = useState(false);
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [history, setHistory] = useState<ScanHistory[]>([]);

  async function loadHistory() {
    if (!userEmail) return;
    const response = await fetch("/api/history");
    if (response.ok) setHistory((await response.json()).scans);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? ""));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { void loadHistory(); }, [userEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!isSupabaseConfigured) { setAuthMessage("Supabase is not configured yet. Follow the README setup."); return; }
    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setAuthMessage(signInError ? signInError.message : "Check your email for the secure sign-in link.");
  }

  async function signOut() {
    if (isSupabaseConfigured) await createBrowserSupabaseClient().auth.signOut();
    setUserEmail(""); setHistory([]);
  }

  function downloadCsv() {
    const rows = [["name", "provider", "status", "http_status"], ...results.map((item) => [item.name, item.provider, item.status, String(item.httpStatus ?? "")])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = `storage-audit-${domain || "results"}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

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
    if (!verification) return;
    if (!userEmail) { setError("Sign in with email before starting a scan."); return; }
    setBusy(true); setError(""); setResults([]); setLogs(["Opening audit stream…"]);
    const endpoint = agentic ? "/api/agent-scan" : "/api/scan";
    const source = new EventSource(`${endpoint}?domain=${encodeURIComponent(domain)}&verifiedToken=${encodeURIComponent(verification.token)}`);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; message?: string } & Result;
      if (data.type === "status" && data.message) setLogs((old) => [...old, data.message!]);
      if (data.type === "summary" && data.message) setLogs((old) => [...old, `Agent summary: ${data.message!}`]);
      if (data.type === "result") setResults((old) => [...old, data]);
      if (data.type === "done") { setLogs((old) => [...old, "Audit complete."]); setBusy(false); source.close(); void loadHistory(); }
    };
    source.onerror = () => { setError("The scan connection closed unexpectedly."); setBusy(false); source.close(); };
  }

  return <main>
    <section className="panel"><h2>Account</h2>{userEmail ? <div className="actions"><span>Signed in as {userEmail}</span><button type="button" onClick={signOut}>Sign out</button></div> : <form onSubmit={signIn}><div className="input-row"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><button>Sign in by email</button></div></form>}{authMessage && <p>{authMessage}</p>}{!isSupabaseConfigured && <p className="error">Authentication needs Supabase environment variables. See README.</p>}</section>
    <section className="hero"><p className="eyebrow">AUTHORIZED SECURITY AUDITING</p><h1>Verified Cloud<br /><span>Storage Auditor</span></h1><p>Find publicly reachable storage associated with domains you control. DNS proof is required before every scan.</p></section>
    <section className="panel">
      <form onSubmit={getToken}><label htmlFor="domain">Domain you own</label><div className="input-row"><input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" disabled={busy} required /><button disabled={busy}>{busy && !verification ? "Working…" : "Get verification token"}</button></div></form>
      {verification && <div className="challenge"><h2>1. Publish the DNS TXT record</h2><p>{verification.instructions}</p><code>{verification.record}</code><div className="actions"><button onClick={verify} disabled={busy || verified}>{verified ? "Domain verified" : "Verify TXT record"}</button>{verified && <><label className="mode"><input type="checkbox" checked={agentic} onChange={(event) => setAgentic(event.target.checked)} /> Agentic mode (uses Groq)</label><button className="primary" onClick={startScan} disabled={busy}>{busy ? "Scanning…" : agentic ? "Start agentic scan" : "Start scan"}</button></>}</div></div>}
      {error && <p className="error">{error}</p>}
    </section>
    <section className="output"><div><h2>Live audit log</h2><div className="log" aria-live="polite">{logs.length ? logs.map((log, index) => <p key={`${log}-${index}`}>› {log}</p>) : <p>Awaiting verified domain.</p>}</div></div>
      <div><h2>Results <small>{results.length} checks</small></h2>{results.length > 0 && <button type="button" onClick={downloadCsv}>Download CSV</button>}<div className="table-wrap"><table><thead><tr><th>Name</th><th>Provider</th><th>Result</th><th>HTTP</th></tr></thead><tbody>{results.map((result, index) => <tr key={`${result.name}-${result.provider}-${index}`}><td>{result.name}</td><td>{result.provider.replace("_", " ")}</td><td><span className={`badge ${result.status.toLowerCase()}`}>{result.status}</span></td><td>{result.httpStatus ?? "—"}</td></tr>)}{!results.length && <tr><td colSpan={4} className="empty">Results will appear as targets are checked.</td></tr>}</tbody></table></div></div>
    </section>
    {userEmail && <section className="panel"><h2>Scan history</h2><div className="table-wrap"><table><thead><tr><th>Domain</th><th>Mode</th><th>Started</th><th>Checks</th><th>Public</th></tr></thead><tbody>{history.map((scan) => <tr key={scan.id}><td>{scan.domain}</td><td>{scan.mode}</td><td>{new Date(scan.started_at).toLocaleString()}</td><td>{scan.checks}</td><td>{scan.public_findings}</td></tr>)}{!history.length && <tr><td colSpan={5} className="empty">Your completed scans will appear here.</td></tr>}</tbody></table></div></section>}
  </main>;
}
