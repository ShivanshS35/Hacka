"""Score Prahari on the PS02 demo dataset with our own labels (eval/ps02_labels.json).

Usage:  python backend/eval/eval_ps02.py /path/to/PS02_demo_data [--split dev|test|all] [--show-errors]

The dataset itself is not in this repository. Labels are keyed by the SHA-256 of each post's exact text, so the
file contains no post text. They are OUR labels, not the official answer key (which only judges have).

Metrics are post-weighted (every one of the 1,787 text posts counts) and also per unique text.
"Illegal" = DRUGS / ARMS / DOCUMENTS / FINANCIAL. BUYER_QUERY (buyer questions with no seller details) is reported
separately: the rules are not expected to flag a bare "rate kya hai?".
The dev / test split is by template family (numbers, handles and place names masked), so near-copies of a test post
never sit in dev.
"""
import argparse
import csv
import glob
import hashlib
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from classifier import classify_text  # noqa: E402

CATS = ("DRUGS", "ARMS", "DOCUMENTS", "FINANCIAL")
PLACES = r"jaipur|jodhpur|kota|ajmer|alwar|bikaner|sikar|udaipur|pushkar|bharatpur|dholpur|sri ganganagar|hanumangarh"


def flat(t):
    return t if isinstance(t, str) else "".join(x if isinstance(x, str) else x.get("text", "") for x in t)


def load_posts(root):
    posts = []
    for f in sorted(glob.glob(os.path.join(root, "01_telegram_exports", "*", "result.json"))):
        ch = os.path.basename(os.path.dirname(f))
        for m in json.load(open(f, encoding="utf-8"))["messages"]:
            if m.get("type") == "message" and flat(m.get("text", "")).strip():
                posts.append((ch, flat(m["text"]).strip()))
    sm = os.path.join(root, "02_social_media", "posts.csv")
    if os.path.exists(sm):
        for r in csv.DictReader(open(sm, encoding="utf-8-sig")):
            if r["text"].strip():
                posts.append(("social:" + r["platform"], r["text"].strip()))
    return posts


def family(text):
    t = text.lower()
    t = re.sub(r"[0-9०-९]+", "#", t)
    t = re.sub(r"@\w+|\S+@\S+|\b[t]\w{33}\b", "@x", t)
    t = re.sub(PLACES, "<place>", t)
    t = re.sub(r"[!@0]", "", t)   # leetspeak variants of the same template share a family
    return re.sub(r"\s+", " ", t)


def split_of(text):
    return "test" if int(hashlib.sha256(family(text).encode()).hexdigest(), 16) % 2 else "dev"


def ratio(a, b):
    return a / b if b else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--split", default="all", choices=["all", "dev", "test"])
    ap.add_argument("--show-errors", action="store_true")
    args = ap.parse_args()
    labels = json.load(open(os.path.join(HERE, "ps02_labels.json"), encoding="utf-8"))["labels"]
    posts = load_posts(args.root)
    t0 = time.perf_counter()
    cache = {}
    tp = fp = fn = tn = 0
    per = defaultdict(Counter)
    uniq = defaultdict(Counter)
    q_flagged = q_total = 0
    errors = Counter()
    for ch, text in posts:
        if args.split != "all" and split_of(text) != args.split:
            continue
        gold = labels.get(hashlib.sha256(text.encode("utf-8")).hexdigest())
        if gold is None:
            continue
        if text not in cache:
            cache[text] = classify_text(text)
        cats = cache[text]["categories"]
        pred = cats[0] if cats else "NONE"
        if gold == "BUYER_QUERY":
            q_total += 1
            q_flagged += bool(cats)
            continue
        g_ill, p_ill = gold != "NONE", bool(cats)
        tp += g_ill and p_ill
        fp += (not g_ill) and p_ill
        fn += g_ill and not p_ill
        tn += (not g_ill) and not p_ill
        for c in CATS:
            per[c]["tp"] += gold == c and c in cats
            per[c]["fp"] += gold != c and pred == c
            per[c]["fn"] += gold == c and c not in cats
        if (gold == "NONE") != (pred == "NONE") or (gold != "NONE" and gold not in cats):
            errors[(gold, pred, text)] += 1
        u = uniq[text]
        u["gold"], u["ok"] = gold, int(gold == pred or (gold != "NONE" and gold in cats))
    elapsed = (time.perf_counter() - t0) * 1000
    P, R = ratio(tp, tp + fp), ratio(tp, tp + fn)
    F1 = ratio(2 * P * R, P + R)
    n = tp + fp + fn + tn
    print(f"split={args.split}  posts={n} (+{q_total} buyer questions)  unique texts={len(uniq)}  "
          f"{elapsed / max(1, len(cache)):.2f} ms per unique text")
    print(f"ILLEGAL vs NORMAL  precision={P:.1%}  recall={R:.1%}  F1={F1:.3f}  accuracy={ratio(tp + tn, n):.1%}  "
          f"(tp={tp} fp={fp} fn={fn} tn={tn})")
    for c in CATS:
        x = per[c]
        p, r = ratio(x["tp"], x["tp"] + x["fp"]), ratio(x["tp"], x["tp"] + x["fn"])
        print(f"  {c:<10} precision={p:.1%} recall={r:.1%}  (tp={x['tp']} fp={x['fp']} fn={x['fn']})")
    print(f"BUYER_QUERY flagged {q_flagged}/{q_total} (not expected; shown for information)")
    print(f"unique texts correct: {sum(u['ok'] for u in uniq.values())}/{len(uniq)}")
    if args.show_errors:
        for (g, p, t), k in sorted(errors.items(), key=lambda kv: -kv[1]):
            print(f"  x{k:<3} gold={g:<9} pred={p:<9} {t[:120]}")


if __name__ == "__main__":
    main()
