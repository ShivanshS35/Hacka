import bisect
import re
import hashlib
from typing import Dict, List, Any

# Regular Expression Patterns for Indian OSINT & Crime Extraction
REGEX_PATTERNS = {
    "phone": r"(?:(?:\+91|91|0)[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}\b",
    "upi": r"[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}",
    "telegram": r"@[a-zA-Z0-9_]{4,32}\b",
    "crypto_btc": r"\bbc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{14,87}\b|\b[13][a-zA-HJ-NP-Z0-9]{25,39}\b",
    "crypto_eth_usdt": r"0x[a-fA-F0-9]{40}\b",
    "crypto_tron": r"T[A-Za-z1-9]{33}\b",
    "bank_account": r"\b\d{9,18}\b",
    "ifsc": r"\b[A-Z]{4}0[A-Z0-9]{6}\b"
}

RAJASTHAN_DISTRICT_SYNONYMS = {
    "jaipur": ["jaipur", "जयपुर", "pink city", "mansarovar", "malviya nagar", "vaishali nagar"],
    "jodhpur": ["jodhpur", "जोधपुर", "sun city", "marwar"],
    "alwar": ["alwar", "अलवर", "mewat"],
    "khairthal-tijara": ["khairthal", "tijara", "bhiwadi", "khairthal-tijara", "खैरथल", "तिजारा", "भिवाड़ी"],
    "kotputli-behror": ["kotputli", "behror", "neemrana", "kotputli-behror", "कोटपूतली", "बहरोड़", "नीमराना"],
    "kota": ["kota", "कोटा", "chambal"],
    "bikaner": ["bikaner", "बीकानेर", "nokha"],
    "sri-ganganagar": ["sri ganganagar", "ganganagar", "गंगानगर", "hindumalkot"],
    "sikar": ["sikar", "सीकर", "shekhawati", "khetri"],
    "ajmer": ["ajmer", "अजमेर", "kishangarh", "pushkar"],
    "beawar": ["beawar", "ब्यावर"],
    "udaipur": ["udaipur", "उदयपुर", "mewar"],
    "bharatpur": ["bharatpur", "भरतपुर", "kaman"],
    "deeg": ["deeg", "डीग"],
    "barmer": ["barmer", "बाड़मेर"],
    "balotra": ["balotra", "बालोतरा"],
    "jaisalmer": ["jaisalmer", "जैसलमेर", "pokhran"],
    "phalodi": ["phalodi", "फलोदी", "osian"],
    "nagaur": ["nagaur", "नागौर", "makrana"],
    "didwana-kuchaman": ["didwana", "kuchaman", "didwana-kuchaman", "डीडवाना", "कुचामन"],
    "pali": ["pali", "पाली", "sojat"],
    "bhilwara": ["bhilwara", "भीलवाड़ा"],
    "chittorgarh": ["chittorgarh", "चित्तौड़गढ़"],
    "jhunjhunu": ["jhunjhunu", "झुंझुनू", "chirawa"],
    "churu": ["churu", "चूरू", "sadulpur"],
    "hanumangarh": ["hanumangarh", "हनुमानगढ़", "nohar"],
    "dholpur": ["dholpur", "धौलपुर"],
    "dausa": ["dausa", "दौसा", "bandikui"],
    "sawai-madhopur": ["sawai madhopur", "sawai-madhopur", "सवाई माधोपुर", "ranthambore"],
    "tonk": ["tonk", "टोंक"],
    "bundi": ["bundi", "बूंदी"],
    "baran": ["baran", "बारां"],
    "jhalawar": ["jhalawar", "झालावाड़"],
    "sirohi": ["sirohi", "सिरोही", "abu road"],
    "jalore": ["jalore", "जालोर", "sanchore"],
    "rajsamand": ["rajsamand", "राजसमंद", "nathdwara"],
    "dungarpur": ["dungarpur", "डूंगरपुर"],
    "salumbar": ["salumbar", "सलूंबर"],
    "banswara": ["banswara", "बांसवाड़ा"],
    "pratapgarh": ["pratapgarh", "प्रतापगढ़"],
    "karauli": ["karauli", "करौली"]
}

_UPI_LEFT_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_")
_ASCII_LETTERS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
_UPI_MAX_LEFT = 256
_UPI_MAX_RIGHT = 64
_EMAIL_MAX_LEFT = 320
_EMAIL_MAX_RIGHT = 255


def _is_word(ch: str) -> bool:
    return ch.isalnum() or ch == "_"


def _find_at_matches(text: str):
    """Single linear pass over every '@' to find UPI-like handles and email spans.

    Replaces two unanchored regexes that took quadratic time on crafted input such as
    'a.a.a.a...@x' (50 KB took about 8 s and froze the server). Each '@' is expanded
    left and right by at most a fixed number of characters, so total work is linear.
    """
    upis: List[tuple] = []     # (start, end) spans of UPI-like matches
    emails: List[tuple] = []   # (start, end) spans of email addresses
    last_upi_end = 0
    last_email_end = 0
    n = len(text)
    i = text.find("@")
    while i != -1:
        # ---- UPI: [A-Za-z0-9._-]{2,256} @ [A-Za-z]{2,64}
        s = i
        floor = max(last_upi_end, i - _UPI_MAX_LEFT)
        while s > floor and text[s - 1] in _UPI_LEFT_CHARS:
            s -= 1
        e = i + 1
        ceil = min(n, i + 1 + _UPI_MAX_RIGHT)
        while e < ceil and text[e] in _ASCII_LETTERS:
            e += 1
        if i - s >= 2 and e - (i + 1) >= 2:
            upis.append((s, e))
            last_upi_end = e

        # ---- Email: \b[\w.+-]+ @ [\w.-]+\.[A-Za-z]{2,}\b   (only used to exclude false UPIs)
        s = i
        floor = max(last_email_end, i - _EMAIL_MAX_LEFT)
        while s > floor and (_is_word(text[s - 1]) or text[s - 1] in ".+-"):
            s -= 1
        while s < i and not _is_word(text[s]):   # \b needs a word character at the start
            s += 1
        if s < i:
            r_end = i + 1
            r_ceil = min(n, i + 1 + _EMAIL_MAX_RIGHT)
            while r_end < r_ceil and (_is_word(text[r_end]) or text[r_end] in ".-"):
                r_end += 1
            chosen = -1
            for end in range(r_end, i + 1, -1):
                nxt = text[end] if end < n else ""
                if nxt and _is_word(nxt):
                    continue
                k = end
                while k > i + 1 and text[k - 1] in _ASCII_LETTERS:
                    k -= 1
                if end - k >= 2 and k - 1 > i + 1 and text[k - 1] == ".":
                    chosen = end
                    break
            if chosen != -1:
                emails.append((s, chosen))
                last_email_end = chosen
        i = text.find("@", i + 1)
    return upis, emails


def _inside_any(spans: List[tuple], starts: List[int], start: int, end: int) -> bool:
    """Spans are sorted and non-overlapping, so only the nearest earlier span can contain [start, end]."""
    idx = bisect.bisect_right(starts, start) - 1
    return idx >= 0 and spans[idx][0] <= start and end <= spans[idx][1]


def extract_entities(text: str) -> Dict[str, Any]:
    # 1. UPI addresses (linear scan; see _find_at_matches)
    upi_spans, email_spans = _find_at_matches(text)
    email_starts = [a for a, _ in email_spans]
    upis = list({text[a:b] for a, b in upi_spans if not _inside_any(email_spans, email_starts, a, b)})

    # 2. Telegram Handles
    upi_suffixes = "\n".join({u[u.find("@"):].lower() for u in upis})
    dropped, seen = set(), []
    for m in re.finditer(REGEX_PATTERNS["telegram"], text):
        h = m.group(0)
        seen.append(h)
        if _inside_any(email_spans, email_starts, m.start(), m.start() + 1):
            dropped.add(h)
    handles = [h for h in set(seen) if h not in dropped and h.lower() not in upi_suffixes]

    # 3. Cryptocurrency Wallets (BTC, ETH, TRON USDT)
    btc_wallets = list(set(re.findall(REGEX_PATTERNS["crypto_btc"], text)))
    eth_wallets = list(set(re.findall(REGEX_PATTERNS["crypto_eth_usdt"], text)))
    tron_wallets = list(set(re.findall(REGEX_PATTERNS["crypto_tron"], text)))
    wallets = list(set(btc_wallets + eth_wallets + tron_wallets))

    # 4. Indian Phone Numbers
    phone_matches = re.findall(REGEX_PATTERNS["phone"], text)
    cleaned_phones = []
    for p in phone_matches:
        num = re.sub(r"[-.\s]", "", p)
        if len(num) >= 10:
            cleaned_phones.append(num[-10:])
    phones = list(set(cleaned_phones))

    # 5. Bank Accounts & IFSC
    ifsc_codes = list(set(re.findall(REGEX_PATTERNS["ifsc"], text)))
    raw_bank_matches = re.findall(REGEX_PATTERNS["bank_account"], text)
    # Filter out numbers that were already parsed as phone numbers
    phone_digits = {re.sub(r"\D", "", match)[-10:] for match in phone_matches}
    bank_accounts = [b for b in set(raw_bank_matches)
                     if re.sub(r"\D", "", b)[-10:] not in phone_digits]

    # 6. Rajasthan District Nexus
    lower = text.lower()
    detected_district = "unknown"
    for dist_id, synonyms in RAJASTHAN_DISTRICT_SYNONYMS.items():
        if any(syn in lower for syn in synonyms):
            detected_district = dist_id
            break

    return {
        "upis": upis,
        "phones": phones,
        "handles": handles,
        "wallets": wallets,
        "bank_accounts": bank_accounts,
        "ifsc_codes": ifsc_codes,
        "district_id": detected_district
    }

def generate_sha256(text: str) -> str:
    """Computes tamper-evident SHA-256 hash for forensic chain-of-custody"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
