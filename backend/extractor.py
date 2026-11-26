import re
import hashlib
from typing import Dict, List, Any

# Regular Expression Patterns for Indian OSINT & Crime Extraction
REGEX_PATTERNS = {
    "phone": r"(?:(?:\+91|91|0)[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}\b",
    "upi": r"[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}",
    "telegram": r"@[a-zA-Z0-9_]{4,32}\b",
    "crypto_btc": r"(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b",
    "crypto_eth_usdt": r"0x[a-fA-F0-9]{40}\b",
    "crypto_tron": r"T[A-Za-z1-9]{33}\b",
    "bank_account": r"\b\d{9,18}\b",
    "ifsc": r"\b[A-Z]{4}0[A-Z0-9]{6}\b"
}

RAJASTHAN_DISTRICT_SYNONYMS = {
    "jaipur": ["jaipur", "जयपुर", "pink city", "mansarovar", "malviya nagar", "vaishali nagar"],
    "jodhpur": ["jodhpur", "जोधपुर", "sun city", "marwar"],
    "alwar": ["alwar", "अलवर", "bhiwadi", "neemrana", "mewat"],
    "kota": ["kota", "कोटा", "chambal"],
    "bikaner": ["bikaner", "बीकानेर", "nokha"],
    "sri-ganganagar": ["sri ganganagar", "ganganagar", "गंगानगर", "hindumalkot"],
    "sikar": ["sikar", "सीकर", "shekhawati", "khetri"],
    "ajmer": ["ajmer", "अजमेर", "kishangarh", "pushkar"],
    "udaipur": ["udaipur", "उदयपुर", "mewar"],
    "bharatpur": ["bharatpur", "भरतपुर", "deeg", "kaman"],
    "barmer": ["barmer", "बाड़मेर", "balotra"],
    "jaisalmer": ["jaisalmer", "जैसलमेर", "pokhran"],
    "nagaur": ["nagaur", "नागौर", "didwana", "makrana"],
    "pali": ["pali", "पाली", "sojat"],
    "bhilwara": ["bhilwara", "भीलवाड़ा"],
    "chittorgarh": ["chittorgarh", "चित्तौड़गढ़"],
    "jhunjhunu": ["jhunjhunu", "झुंझुनू", "chirawa"],
    "churu": ["churu", "चूरू", "sadulpur"],
    "hanumangarh": ["hanumangarh", "हनुमानगढ़", "nohar"],
    "dholpur": ["dholpur", "धौलपुर"],
    "dausa": ["dausa", "दौसा", "bandikui"],
    "sawaimadhopur": ["sawai madhopur", "सवाई माधोपुर", "ranthambore"],
    "tonk": ["tonk", "टोंक"],
    "bundli": ["bundi", "बूंदी"],
    "baran": ["baran", "बारां"],
    "jhalawar": ["jhalawar", "झालावाड़"],
    "sirohi": ["sirohi", "सिरोही", "abu road"],
    "jalore": ["jalore", "जालोर", "sanchore"],
    "rajsamand": ["rajsamand", "राजसमंद", "nathdwara"],
    "dungarpur": ["dungarpur", "डूंगरपुर"],
    "banswara": ["banswara", "बांसवाड़ा"],
    "pratapgarh": ["pratapgarh", "प्रतापगढ़"],
    "karauli": ["karauli", "करौली"]
}

def extract_entities(text: str) -> Dict[str, Any]:
    # 1. UPI addresses
    upis = list(set(re.findall(REGEX_PATTERNS["upi"], text, re.IGNORECASE)))

    # 2. Telegram Handles
    raw_handles = list(set(re.findall(REGEX_PATTERNS["telegram"], text)))
    handles = [h for h in raw_handles if not any(h.lower() in u.lower() for u in upis)]

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
    bank_accounts = [
        b for b in set(raw_bank_matches)
        if b not in phones and len(b) >= 9 and len(b) <= 18
    ]

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
