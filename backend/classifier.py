import re
from typing import Dict, List, Any, Optional

# Multi-dialect slang database for Indian Law Enforcement & OSINT
SLANG_DICTIONARY: Dict[str, List[Dict[str, Any]]] = {
    "DRUGS": [
        # Keep the phrase, but not the generic word "white" on its own.
        {"terms": ["pure white", "chitta", "chita", "चिट्टा"], "weight": 0.96},
        {"terms": ["afeem", "opium", "अफ़ीम", "doda post", "dodapost", "doda"], "weight": 0.94},
        {"terms": ["charas", "चिलम", "malana", "hashish", "bhang", "ganja", "गांजा"], "weight": 0.92},
        {"terms": ["mdma", "mephedrone", "meow meow", "ecstasy", "molly"], "weight": 0.97},
        {"terms": ["smack", "heroin", "brown sugar", "पुड़िया", "pudiya"], "weight": 0.96},
        {"terms": ["maal", "maal available", "stuff available"], "weight": 0.88},
        {"terms": ["score", "consignment"], "weight": 0.60},
        {"terms": ["weed", "meth", "ice"], "weight": 0.84},
        {"terms": ["5g", "10g", "pouch", "leaf"], "weight": 0.60},
        {"terms": ["border delivery", "drop point", "packet drop", "consignment ready"], "weight": 0.89},
        {"terms": ["🔥", "❄️", "🌿", "💊", "💉", "🍁"], "weight": 0.75},
    ],
    "ARMS": [
        {"terms": ["desi katta", "katta", "कट्टा", "देशी कट्टा"], "weight": 0.98},
        {"terms": [".32 bore", "32 bore", ".315 bore", "315 bore", "315 बोर", ".12 bore"], "weight": 0.97},
        {"terms": ["tamancha", "तमंचा", "sixer", "revolver"], "weight": 0.96},
        {"terms": ["pistol", "पिस्तौल", "glock", "beretta", "star pistol"], "weight": 0.95},
        {"terms": ["cartridge", "cartridges", "raund", "kartus", "कारतूस"], "weight": 0.93},
        {"terms": ["round", "rounds"], "weight": 0.50},
        {"terms": ["bandook", "weapon", "magazine", "ammo", "firearm", "hathiyar", "हथियार"], "weight": 0.90},
        {"terms": ["delivery by hand", "bypass delivery", "border pickup", "shekhawati weapon"], "weight": 0.88},
        {"terms": ["🔫", "💥", "🎯", "💣"], "weight": 0.74},
    ],
    "DOCUMENTS": [
        {"terms": ["fake aadhaar", "fake aadhar", "फ़र्ज़ी आधार", "duplicate aadhaar"], "weight": 0.98},
        {"terms": ["fake pan", "pan card set", "pan bypass", "फ़र्ज़ी पैन"], "weight": 0.96},
        {"terms": ["10th marksheet", "12th marksheet", "fake marksheet", "fake degree"], "weight": 0.94},
        {"terms": ["marksheet", "degree", "diploma"], "weight": 0.55},
        {"terms": ["driving license", "dl original", "rc original", "registration certificate"], "weight": 0.92},
        {"terms": ["hologram verified", "hologram", "sarkari job pass", "biometric bypass"], "weight": 0.95},
        {"terms": ["3 din me delivery", "home delivery original pvc", "pvc card set"], "weight": 0.88},
        {"terms": ["🪪", "📄", "🖨️", "✍️"], "weight": 0.72},
    ],
    "FINANCIAL": [
        {"terms": ["kyc verified account", "fully kyc", "full kyc", "kyc account"], "weight": 0.97},
        {"terms": ["mule account", "mule", "खाता rent"], "weight": 0.96},
        {"terms": ["current account", "saving account"], "weight": 0.60},
        {"terms": ["atm card", "atm kit", "net-banking kit", "cheque book", "debit card kit"], "weight": 0.95},
        {"terms": ["kiraya pe", "account kiraya", "rent account", "account for rent"], "weight": 0.96},
        {"terms": ["usdt arbitrage", "crypto arbitrage", "usdt buy sell", "hawala cash"], "weight": 0.90},
        {"terms": ["daily limit 50l", "fullz kit", "withdrawal limit", "corporate account"], "weight": 0.92},
        {"terms": ["💳", "🏧", "💰", "🏦", "💸"], "weight": 0.73},
    ]
}

FLAG_THRESHOLD = 0.70


def classify_text(text: str) -> Dict[str, Any]:
    lower = text.lower()
    matched_categories = []
    all_matched_terms = []

    for category, term_groups in SLANG_DICTIONARY.items():
        category_max_weight = 0.0
        found_terms = []

        for group in term_groups:
            for term in group["terms"]:
                # Match whole words so terms such as "ice", "round", and
                # "white" do not match inside ordinary words like "price".
                escaped = re.escape(term.lower())
                if re.fullmatch(r"\w+", term, flags=re.UNICODE):
                    pattern = rf"(?<!\w){escaped}(?!\w)"
                else:
                    pattern = rf"(?<!\w){escaped}(?!\w)"
                if re.search(pattern, lower, flags=re.UNICODE):
                    found_terms.append(term)
                    if group["weight"] > category_max_weight:
                        category_max_weight = group["weight"]

        if found_terms:
            # A display score based on rule matches, not a calibrated probability.
            boost = min(0.01 * (len(found_terms) - 1), 0.03)
            final_score = min(category_max_weight + boost, 0.99)
            matched_categories.append({
                "category": category,
                "score": final_score,
                "terms": list(set(found_terms))
            })
            all_matched_terms.extend(found_terms)

    # Sort categories by confidence descending
    matched_categories.sort(key=lambda x: x["score"], reverse=True)

    # Weak, generic words alone (e.g. "round", "degree") are not enough to flag a post.
    matched_categories = [c for c in matched_categories if c["score"] >= FLAG_THRESHOLD]
    all_matched_terms = [t for c in matched_categories for t in c["terms"]]

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
