import re
from typing import Dict, List, Any, Optional

# Multi-dialect slang database for Indian Law Enforcement & OSINT
SLANG_DICTIONARY: Dict[str, List[Dict[str, Any]]] = {
    "DRUGS": [
        {"terms": ["pure white", "white", "chitta", "chita", "चिट्टा"], "weight": 0.96},
        {"terms": ["afeem", "opium", "अफ़ीम", "doda post", "dodapost", "doda"], "weight": 0.94},
        {"terms": ["charas", "चिलम", "malana", "hashish", "bhang", "ganja", "गांजा"], "weight": 0.92},
        {"terms": ["mdma", "mephedrone", "meow meow", "ecstasy", "molly"], "weight": 0.97},
        {"terms": ["smack", "heroin", "brown sugar", "पुड़िया", "pudiya"], "weight": 0.96},
        {"terms": ["maal", "maal available", "stuff available", "score", "consignment"], "weight": 0.88},
        {"terms": ["5g", "10g", "pouch", "leaf", "weed", "ice", "meth"], "weight": 0.84},
        {"terms": ["border delivery", "drop point", "packet drop", "consignment ready"], "weight": 0.89},
        {"terms": ["🔥", "❄️", "🌿", "💊", "💉", "🍁"], "weight": 0.75},
    ],
    "ARMS": [
        {"terms": ["desi katta", "katta", "कट्टा", "देशी कट्टा"], "weight": 0.98},
        {"terms": [".32 bore", "32 bore", ".315 bore", "315 bore", "315 बोर", ".12 bore"], "weight": 0.97},
        {"terms": ["tamancha", "तमंचा", "sixer", "revolver"], "weight": 0.96},
        {"terms": ["pistol", "पिस्तौल", "glock", "beretta", "star pistol"], "weight": 0.95},
        {"terms": ["cartridge", "cartridges", "round", "rounds", "raund", "kartus", "कारतूस"], "weight": 0.93},
        {"terms": ["bandook", "weapon", "magazine", "ammo", "firearm", "hathiyar", "हथियार"], "weight": 0.90},
        {"terms": ["delivery by hand", "bypass delivery", "border pickup", "shekhawati weapon"], "weight": 0.88},
        {"terms": ["🔫", "💥", "🎯", "💣"], "weight": 0.74},
    ],
    "DOCUMENTS": [
        {"terms": ["fake aadhaar", "fake aadhar", "फ़र्ज़ी आधार", "duplicate aadhaar"], "weight": 0.98},
        {"terms": ["fake pan", "pan card set", "pan bypass", "फ़र्ज़ी पैन"], "weight": 0.96},
        {"terms": ["marksheet", "degree", "diploma", "10th marksheet", "12th marksheet"], "weight": 0.94},
        {"terms": ["driving license", "dl original", "rc original", "registration certificate"], "weight": 0.92},
        {"terms": ["hologram verified", "hologram", "sarkari job pass", "biometric bypass"], "weight": 0.95},
        {"terms": ["3 din me delivery", "home delivery original pvc", "pvc card set"], "weight": 0.88},
        {"terms": ["🪪", "📄", "🖨️", "✍️"], "weight": 0.72},
    ],
    "FINANCIAL": [
        {"terms": ["kyc verified account", "fully kyc", "full kyc", "kyc account"], "weight": 0.97},
        {"terms": ["mule account", "mule", "current account", "saving account", "खाता rent"], "weight": 0.96},
        {"terms": ["atm card", "atm kit", "net-banking kit", "cheque book", "debit card kit"], "weight": 0.95},
        {"terms": ["kiraya pe", "account kiraya", "rent account", "account for rent"], "weight": 0.96},
        {"terms": ["usdt arbitrage", "crypto arbitrage", "usdt buy sell", "hawala cash"], "weight": 0.90},
        {"terms": ["daily limit 50l", "fullz kit", "withdrawal limit", "corporate account"], "weight": 0.92},
        {"terms": ["💳", "🏧", "💰", "🏦", "💸"], "weight": 0.73},
    ]
}

def classify_text(text: str) -> Dict[str, Any]:
    lower = text.lower()
    matched_categories = []
    all_matched_terms = []

    for category, term_groups in SLANG_DICTIONARY.items():
        category_max_weight = 0.0
        found_terms = []

        for group in term_groups:
            for term in group["terms"]:
                if term.lower() in lower:
                    found_terms.append(term)
                    if group["weight"] > category_max_weight:
                        category_max_weight = group["weight"]

        if found_terms:
            # Multi-term boost: multiple slang tokens increase conviction
            boost = min(0.03 * (len(found_terms) - 1), 0.08)
            final_score = min(category_max_weight + boost, 0.99)
            matched_categories.append({
                "category": category,
                "score": final_score,
                "terms": list(set(found_terms))
            })
            all_matched_terms.extend(found_terms)

    # Sort categories by confidence descending
    matched_categories.sort(key=lambda x: x["score"], reverse=True)

    if matched_categories:
        categories = [c["category"] for c in matched_categories]
        confidence = matched_categories[0]["score"]
    else:
        categories = []
        confidence = 0.0

    return {
        "categories": categories,
        "confidence": round(confidence, 2),
        "matched_slang": list(set(all_matched_terms)),
        "primary_category": categories[0] if categories else None
    }
