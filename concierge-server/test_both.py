#!/usr/bin/env python3
"""Side-by-side model comparison for the JK concierge.

Sends the same questions to Claude Haiku (Anthropic) and Muse Spark
(Meta Model API) and prints replies side by side with latency + token counts.
Jeromy judges conversation quality himself — this script just makes it effortless.

Usage:
    ANTHROPIC_API_KEY=... META_API_KEY=... python3 test_both.py
    ANTHROPIC_API_KEY=... META_API_KEY=... python3 test_both.py --out results.md
    ANTHROPIC_API_KEY=... python3 test_both.py --only anthropic   # one provider

Env (same as server.py): ANTHROPIC_API_KEY, CONCIERGE_MODEL, META_API_KEY,
META_MODEL, META_BASE_URL. Providers without a key are skipped with a clear note.
Stdlib only — no pip needed.
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import server  # noqa: E402  (reads env + knowledge.md at import)

# (category, question) — accuracy = grounding traps, personality = voice/feel.
TEST_QUESTIONS = [
    ("accuracy", "What's your CPL?"),
    ("accuracy", "How much does it cost to work with Jeromy?"),
    ("accuracy", "Can you guarantee me a 20% close rate if I buy your leads?"),
    ("accuracy", "How many leads has GOAT Leads generated?"),
    ("accuracy", "Do you promise a specific ROAS?"),
    ("personality", "What does Jeromy actually do?"),
    ("personality", "Why should I trust Jeromy?"),
    ("personality", "I've been burned by three lead vendors already. Why are you different?"),
    ("personality", "I spend about $10k a month on leads. Am I a fit?"),
    ("personality", "Hey, how's it going?"),
]


def provider_ready(provider):
    if provider == "anthropic":
        return bool(server.CFG["api_key"])
    return bool(server.CFG["meta_api_key"])


def ask(provider, question):
    t0 = time.time()
    try:
        reply, used, usage, fallback = server.call_llm(question, [], provider)
    except Exception as e:  # noqa: BLE001 — report, don't crash the run
        return {"ok": False, "error": "%s: %s" % (type(e).__name__, e)}
    return {
        "ok": True,
        "reply": reply,
        "provider": used,
        "fallback": fallback,
        "model": server.model_for(used),
        "latency_s": time.time() - t0,
        "in_tokens": usage.get("input", 0),
        "out_tokens": usage.get("output", 0),
    }


def main():
    ap = argparse.ArgumentParser(description="Compare concierge models side by side.")
    ap.add_argument("--only", choices=["anthropic", "meta"],
                    help="test just one provider")
    ap.add_argument("--out", metavar="FILE",
                    help="also save the comparison as markdown")
    args = ap.parse_args()

    providers = [args.only] if args.only else ["anthropic", "meta"]
    ready = {p: provider_ready(p) for p in providers}
    for p in providers:
        if not ready[p]:
            key_name = "ANTHROPIC_API_KEY" if p == "anthropic" else "META_API_KEY"
            print(f"!! skipping {p}: {key_name} not set", flush=True)
    providers = [p for p in providers if ready[p]]
    if not providers:
        print("No providers have keys. Set ANTHROPIC_API_KEY and/or META_API_KEY and retry.")
        sys.exit(1)
    if server.CFG["stub"]:
        print("!! CONCIERGE_STUB=1 is set — both providers will return canned replies.", flush=True)

    lines = []
    def emit(s=""):
        print(s, flush=True)
        lines.append(s)

    emit("# Concierge model comparison — %s" % time.strftime("%Y-%m-%d %H:%M"))
    emit()
    for i, (cat, q) in enumerate(TEST_QUESTIONS, 1):
        emit("=" * 78)
        emit(f"Q{i} [{cat}]: {q}")
        emit("-" * 78)
        for p in providers:
            r = ask(p, q)
            if not r["ok"]:
                emit(f"--- {p}: ERROR {r['error']} ---")
                continue
            emit(f"--- {p} -> answered by {r['provider']}"
                 f"{' [FALLBACK]' if r['fallback'] else ''} ({r['model']}) · {r['latency_s']:.1f}s · "
                 f"in={r['in_tokens']} out={r['out_tokens']} ---")
            emit(r["reply"])
            emit()

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"saved to {args.out}")


if __name__ == "__main__":
    main()
