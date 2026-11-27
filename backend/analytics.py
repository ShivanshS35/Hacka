"""Alerts (risk-scored, evidence-sealed) and coordinated-ad similarity.

Alert ids are derived from the post's SHA-256 so they are stable across restarts.
The SHA-256 is a content digest of rawText only (see README: not a legal certificate).
"""
from typing import Any, Dict, List

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SIMILARITY_THRESHOLD = 0.65


def risk_for(post: Dict[str, Any], identifier_channels: Dict[str, int]) -> Dict[str, Any]:
    """Transparent, additive risk score. Each reason is returned so it can be shown as evidence."""
    reasons: List[str] = []
    score = 0
    cats = post.get("categories") or []
    conf = post.get("confidence", 0) or 0
    ents = post.get("entities", {})
    if conf >= 0.9:
        score += 2; reasons.append("strong slang match")
    elif conf >= 0.7:
        score += 1; reasons.append("moderate slang match")
    if len(cats) > 1:
        score += 1; reasons.append("multiple categories")
    ids = [*ents.get("upis", []), *ents.get("phones", []), *ents.get("handles", []), *ents.get("wallets", []),
           *ents.get("bankAccounts", [])]
    if ids:
        score += 1; reasons.append("contact/payment identifier present")
    reused = [i for i in ids if identifier_channels.get(i, 0) >= 2]
    if reused:
        score += 2; reasons.append(f"identifier seen in 2+ channels ({len(reused)})")
    if "FINANCIAL" in cats and (ents.get("bankAccounts") or ents.get("upis")):
        score += 1; reasons.append("financial ad with account/UPI detail")
    level = "HIGH" if score >= 5 else "MEDIUM" if score >= 3 else "LOW"
    return {"riskLevel": level, "riskScore": score, "riskReasons": reasons}


def build_alerts(posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flagged = [p for p in posts if p.get("categories")]
    channels_by_id: Dict[str, set] = {}
    for p in flagged:
        e = p.get("entities", {})
        for i in [*e.get("upis", []), *e.get("phones", []), *e.get("handles", []), *e.get("wallets", []),
                  *e.get("bankAccounts", [])]:
            channels_by_id.setdefault(i, set()).add(p.get("channel", ""))
    counts = {k: len(v) for k, v in channels_by_id.items()}
    alerts = []
    for p in flagged:
        day = (p.get("capturedAtUtc") or p.get("timestamp") or "")[:10] or "0000-00-00"
        sha = p.get("sha256", "")
        alerts.append({
            "alertId": f"ALRT-{day}-{int(sha[:8], 16) % 10000:04d}" if sha else f"ALRT-{day}-{p['id']}",
            "postId": p["id"],
            "channel": p.get("channel"),
            "categories": p.get("categories"),
            "confidence": p.get("confidence"),
            "matchedSlang": p.get("matchedSlang"),
            "entities": p.get("entities"),
            "districtId": p.get("districtId"),
            "evidence": {
                "text": p.get("rawText"),
                "capturedAtUtc": p.get("capturedAtUtc"),
                "sourceType": p.get("sourceType"),
                "sha256": sha,
                "sha256Scope": p.get("sha256Scope", "UTF-8 rawText bytes"),
            },
            **risk_for(p, counts),
        })
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    alerts.sort(key=lambda a: (order[a["riskLevel"]], -a["riskScore"]))
    return alerts


def find_coordinated(posts: List[Dict[str, Any]], threshold: float = SIMILARITY_THRESHOLD) -> List[Dict[str, Any]]:
    """Group near-duplicate ads (char n-gram TF-IDF cosine; robust to Hinglish spelling variants)."""
    docs = [p for p in posts if p.get("rawText")]
    if len(docs) < 2:
        return []
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), lowercase=True)
    sim = cosine_similarity(vec.fit_transform([p["rawText"] for p in docs]))
    parent = list(range(len(docs)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(docs)):
        for j in range(i + 1, len(docs)):
            if sim[i][j] >= threshold:
                parent[find(i)] = find(j)
    groups: Dict[int, List[int]] = {}
    for i in range(len(docs)):
        groups.setdefault(find(i), []).append(i)
    out = []
    for members in groups.values():
        if len(members) < 2:
            continue
        chans = sorted({docs[m]["channel"] for m in members})
        best = max(sim[a][b] for a in members for b in members if a != b)
        out.append({
            "size": len(members),
            "channels": chans,
            "crossChannel": len(chans) > 1,
            "maxSimilarity": round(float(best), 2),
            "postIds": [docs[m]["id"] for m in members],
        })
    out.sort(key=lambda g: (-g["crossChannel"], -g["size"]))
    return out
