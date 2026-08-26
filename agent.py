#!/usr/bin/env python3
# Authorized use only: run this agent only after you have independently verified
# that the operator owns the supplied domain through the application's DNS flow.
"""Groq tool-calling assistant for an ownership-authorized storage audit."""
import argparse
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from groq import Groq

MAX_ITERATIONS = 12
MAX_BUCKET_CHECKS = 80
VALID_PROVIDERS = {"aws", "gcs", "azure"}
DOMAIN_RE = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$", re.I)
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")

def fetch_ct_subdomains(domain: str) -> dict:
    """Fetch subdomains from crt.sh; domain restriction is enforced by the caller."""
    url = f"https://crt.sh/?q=%25.{urllib.parse.quote(domain)}&output=json"
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "CloudStorageExposureAuditor/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            entries = json.load(response)
        names = set()
        for entry in entries:
            for name in entry.get("name_value", "").splitlines():
                name = name.lower().removeprefix("*.").rstrip(".")
                if name.endswith("." + domain) and name != domain:
                    names.add(name)
        return {"subdomains": sorted(names)}
    except Exception as exc:
        return {"error": f"CT lookup failed: {exc}"}

def check_bucket_name(name: str, provider: str) -> dict:
    urls = {
        "aws": f"https://{name}.s3.amazonaws.com/",
        "gcs": f"https://storage.googleapis.com/{name}/",
        "azure": f"https://{name}.blob.core.windows.net/",
    }
    try:
        request = urllib.request.Request(urls[provider], method="HEAD", headers={"User-Agent": "CloudStorageExposureAuditor/1.0"})
        with urllib.request.urlopen(request, timeout=5) as response:
            code = response.status
    except urllib.error.HTTPError as exc:
        code = exc.code
    except Exception as exc:
        return {"name": name, "provider": provider, "status": "ERROR", "error": str(exc)}
    status = "PUBLIC" if code == 200 else "EXISTS_PRIVATE" if code == 403 else "NOT_FOUND" if code == 404 else "UNKNOWN"
    return {"name": name, "provider": provider, "status": status, "http_status": code}

TOOLS = [
    {"type": "function", "function": {"name": "fetch_ct_subdomains", "description": "Get certificate-transparency subdomains for the authorized domain.", "parameters": {"type": "object", "properties": {"domain": {"type": "string"}}, "required": ["domain"]}}},
    {"type": "function", "function": {"name": "check_bucket_name", "description": "Check one candidate bucket/container name on one cloud provider.", "parameters": {"type": "object", "properties": {"name": {"type": "string"}, "provider": {"type": "string", "enum": ["aws", "gcs", "azure"]}}, "required": ["name", "provider"]}}},
]

def run(domain: str) -> None:
    if not DOMAIN_RE.fullmatch(domain): raise SystemExit("Invalid domain")
    if not os.environ.get("GROQ_API_KEY"): raise SystemExit("GROQ_API_KEY is required")
    system = ("You are an authorized cloud-storage exposure audit assistant. First call fetch_ct_subdomains for the authorized domain. "
              "Derive candidates only from returned CT-log labels; do not blindly guess names. Prioritize names supported by that data. "
              "Stop exploring a naming pattern after repeated NOT_FOUND results. Use check_bucket_name judiciously, then provide a concise final summary of checks and potential exposures.")
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    messages = [{"role": "system", "content": system}, {"role": "user", "content": f"Audit only the ownership-verified domain: {domain}"}]
    checks = 0
    for _ in range(MAX_ITERATIONS):
        response = client.chat.completions.create(model="llama-3.3-70b-versatile", messages=messages, tools=TOOLS, tool_choice="auto", temperature=0.1)
        message = response.choices[0].message
        messages.append(message.model_dump())
        if not message.tool_calls:
            print(message.content or "Audit finished without a textual summary.")
            return
        for call in message.tool_calls:
            args = json.loads(call.function.arguments)
            if call.function.name == "fetch_ct_subdomains":
                result = fetch_ct_subdomains(domain) if args.get("domain", "").lower().rstrip(".") == domain else {"error": "Only the CLI-authorized domain may be queried."}
            elif call.function.name == "check_bucket_name":
                name, provider = str(args.get("name", "")).lower(), str(args.get("provider", "")).lower()
                if checks >= MAX_BUCKET_CHECKS: result = {"error": f"Hard cap of {MAX_BUCKET_CHECKS} bucket checks reached."}
                elif not NAME_RE.fullmatch(name) or provider not in VALID_PROVIDERS: result = {"error": "Invalid bucket name or provider."}
                else: checks += 1; result = check_bucket_name(name, provider)
            else: result = {"error": "Unknown tool"}
            messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)})
    print(f"Hard cap of {MAX_ITERATIONS} tool-call rounds reached after {checks} bucket checks. Review tool results above.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Authorized CT-informed storage exposure audit agent")
    parser.add_argument("--domain", required=True, help="Domain already verified by its operator")
    run(parser.parse_args().domain.lower().rstrip("."))
