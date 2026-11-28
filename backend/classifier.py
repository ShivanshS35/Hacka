import re
import unicodedata
from typing import Dict, List, Any, Optional, Tuple

# Multi-dialect slang database for Indian Law Enforcement & OSINT.
#
# Each group has a weight (how strongly the term signals the category) and an optional
# "ambiguous" flag. Ambiguous terms are ordinary words in other contexts ("mule", "pistol",
# "weed out", "cartridge", "driving license"). On their own they are NOT flagged; they count
# only when the post also reads like an offer to sell/supply (see COMMERCE_RE), and even then
# they are capped below the "confident" level so a Gemini second opinion is requested.
SLANG_DICTIONARY: Dict[str, List[Dict[str, Any]]] = {
    "DRUGS": [
        {"terms": ["chitta", "chita", "cheeta", "chhita", "chiita", "चिट्टा", "चीटा"], "weight": 0.96},
        {"terms": ["pure white"], "weight": 0.96, "ambiguous": True},
        {"terms": ["afeem", "अफ़ीम", "doda post", "dodapost"], "weight": 0.94},
        {"terms": ["opium", "doda"], "weight": 0.94, "ambiguous": True},
        {"terms": ["ganja", "गांजा", "hashish", "malana"], "weight": 0.92},
        {"terms": ["charas", "चिलम", "bhang"], "weight": 0.92, "ambiguous": True},
        {"terms": ["mdma", "mephedrone", "meow meow"], "weight": 0.97},
        {"terms": ["ecstasy", "molly"], "weight": 0.97, "ambiguous": True},
        {"terms": ["heroin", "smack", "brown sugar", "पुड़िया", "pudiya"], "weight": 0.96, "ambiguous": True},
        {"terms": ["maal available", "stuff available"], "weight": 0.88},
        {"terms": ["maal"], "weight": 0.88, "ambiguous": True},
        {"terms": ["score", "consignment"], "weight": 0.60},
        {"terms": ["weed", "meth", "ice"], "weight": 0.84, "ambiguous": True},
        {"terms": ["5g", "10g", "pouch", "leaf"], "weight": 0.60},
        {"terms": ["border delivery", "drop point", "packet drop", "consignment ready"], "weight": 0.89},
        {"terms": ["🔥", "❄️", "🌿", "💊", "💉", "🍁"], "weight": 0.75, "ambiguous": True},
    ],
    "ARMS": [
        {"terms": ["desi katta", "desi kata", "katta", "kaata", "kattaa", "कट्टा", "देशी कट्टा"], "weight": 0.98},
        {"terms": ["kata"], "weight": 0.95, "ambiguous": True},
        {"terms": [".32 bore", "32 bore", ".315 bore", "315 bore", "315 बोर", ".12 bore", "12 bore", "7.65 bore"], "weight": 0.97},
        {"terms": ["country made pistol", "country made gun", "country-made", "desi pistol", "desi gun", "desi revolver"], "weight": 0.95},
        {"terms": ["tamancha", "तमंचा"], "weight": 0.96},
        {"terms": ["sixer", "revolver"], "weight": 0.96, "ambiguous": True},
        {"terms": ["pistol", "पिस्तौल", "glock", "beretta", "star pistol"], "weight": 0.95, "ambiguous": True},
        {"terms": ["raund", "kartus"], "weight": 0.93},
        {"terms": ["cartridge", "cartridges", "कारतूस"], "weight": 0.93, "ambiguous": True},
        {"terms": ["round", "rounds"], "weight": 0.50},
        {"terms": ["bandook", "weapon", "magazine", "ammo", "firearm", "hathiyar", "हथियार"], "weight": 0.90, "ambiguous": True},
        {"terms": ["delivery by hand", "bypass delivery", "border pickup", "shekhawati weapon"], "weight": 0.88},
        {"terms": ["🔫", "💥", "🎯", "💣"], "weight": 0.74, "ambiguous": True},
    ],
    "DOCUMENTS": [
        {"terms": ["fake aadhaar", "fake aadhar", "फ़र्ज़ी आधार", "duplicate aadhaar", "forged aadhaar", "forged aadhar"], "weight": 0.98},
        {"terms": ["fake pan", "pan card set", "pan bypass", "फ़र्ज़ी पैन", "forged pan", "pan card forged", "fake id", "fake license", "fake licence"], "weight": 0.96},
        {"terms": ["fake marksheet", "fake degree", "fake certificate", "fake documents", "fake rc", "fake voter id",
                   "fake passport", "fake visa", "fake ration card", "nakli aadhar", "nakli aadhaar", "nakli pan",
                   "nakli license", "nakli licence", "bogus marksheet", "bogus degree", "nakli marksheet", "nakli degree",
                   "nakli certificate", "nakli documents", "nakli passport"], "weight": 0.94},
        {"terms": ["10th marksheet", "12th marksheet"], "weight": 0.94, "ambiguous": True},
        {"terms": ["marksheet", "degree", "diploma"], "weight": 0.55},
        {"terms": ["forged", "forgery"], "weight": 0.75, "ambiguous": True},
        {"terms": ["driving license", "driving licence", "dl original", "rc original", "registration certificate"], "weight": 0.92, "ambiguous": True},
        {"terms": ["hologram verified", "sarkari job pass", "biometric bypass"], "weight": 0.95},
        {"terms": ["hologram"], "weight": 0.95, "ambiguous": True},
        {"terms": ["3 din me delivery", "home delivery original pvc", "pvc card set"], "weight": 0.88},
        {"terms": ["🪪", "📄", "🖨️", "✍️"], "weight": 0.72, "ambiguous": True},
    ],
    "FINANCIAL": [
        {"terms": ["kyc verified account", "fully kyc", "full kyc"], "weight": 0.97},
        {"terms": ["kyc account"], "weight": 0.97, "ambiguous": True},
        {"terms": ["mule account", "खाता rent"], "weight": 0.96},
        {"terms": ["mule"], "weight": 0.96, "ambiguous": True},
        {"terms": ["current account", "saving account"], "weight": 0.60},
        {"terms": ["atm kit", "net-banking kit", "debit card kit", "netbanking kit", "net banking kit", "passbook kit",
                   "login kit", "bank logins", "netbanking logins", "net-banking logins", "net-banking id", "netbanking id",
                   "atm cards with pin", "atm card with pin"], "weight": 0.95},
        {"terms": ["atm card", "cheque book"], "weight": 0.95, "ambiguous": True},
        {"terms": ["kiraya pe", "account kiraya", "rent account", "account for rent", "account on rent",
                   "accounts on rent", "account rent", "account kiraye", "bank account on rent"], "weight": 0.96},
        {"terms": ["usdt buy sell", "hawala cash", "hawala transfer"], "weight": 0.90},
        # SIM cards sold for fraud (no KYC, bulk, OTP access). Plain "sim card" is ordinary and is not a term.
        {"terms": ["pre-activated sim", "preactivated sim", "pre activated sim", "fake kyc sim", "no kyc sim", "sim no kyc",
                   "sim without kyc", "sim cards without kyc", "sim card without kyc", "sim without documents",
                   "sim cards without documents", "sim card without documents", "sim without id", "verified sim",
                   "sim card kit", "sim kit", "bulk sim", "bulk sims", "sim box"], "weight": 0.95},
        {"terms": ["usdt arbitrage", "crypto arbitrage"], "weight": 0.90, "ambiguous": True},
        {"terms": ["daily limit 50l", "fullz kit"], "weight": 0.92},
        {"terms": ["withdrawal limit", "corporate account"], "weight": 0.92, "ambiguous": True},
        {"terms": ["💳", "🏧", "💰", "🏦", "💸"], "weight": 0.73, "ambiguous": True},
    ]
}

FLAG_THRESHOLD = 0.70
AMBIGUOUS_CAP = 0.80          # ambiguous terms + sale context: flagged but never "confident"
AMBIGUOUS_NO_CONTEXT = 0.60   # ambiguous terms alone: below FLAG_THRESHOLD, not flagged
AMBIGUOUS_CORROBORATED = 0.86 # ambiguous term + a second matched term + sale context

# Words and entities that make a post read like an offer to sell or supply something.
COMMERCE_RE = re.compile(
    r"(?<!\w)(available|avail|delivery|deliver|dm|whatsapp|contact|call me|call now|rates?|price|cod|"
    r"pick-?up|ready|in stock|stock|supply|for sale|sale|selling|sell|buy|rent|kiraya|kiraye|kirya|escrow|"
    r"payment|advance|upi|paytm|gpay|phonepe|dispatch|shipping|hand to hand|milega|milegi|chahiye|bhejo|"
    r"bulk|commission|payout|mil jaye(ga|gi|nge)|milenge|mil jayenge|उपलब्ध|डिलीवरी|संपर्क)(?!\w)"
    r"|(?<!\w)[6-9]\d{9}(?!\d)|(?<![\w])@[A-Za-z0-9_]{4,32}|\bbc1[a-z0-9]{10,}|\b0x[a-fA-F0-9]{20,}",
    re.IGNORECASE,
)
# Documents: words that signal forgery. Finance: words that signal an account "kit" for sale.
FORGERY_RE = re.compile(
    r"(?<!\w)(fake|nakli|naqli|bogus|forged|duplicate|jugaad|bypass|original-looking|without (test|exam|licen[cs]e))(?!\w)",
    re.IGNORECASE,
)
UNLICENSED_RE = re.compile(r"(?<!\w)((with)?out|no) (licen[cs]e|papers|permit|paperwork)(?!\w)", re.IGNORECASE)
ACCOUNT_KIT_RE = re.compile(
    r"(?<!\w)(kit|passbook|sim|login|logins|credentials|verified accounts?|no kyc|otc)(?!\w)", re.IGNORECASE
)
# Words that make a post read like a trade offer rather than just contact details. "call"/"dm"/phone numbers
# alone are not enough once the post reads like news, a warning or an ordinary shop notice.
EXPLICIT_SALE_RE = re.compile(
    r"(?<!\w)(available|avail|selling|sell|for sale|sale|rates?|price|in stock|stock|ready|delivery|deliver|supply|"
    r"escrow|cod|dispatch(ed)?|bulk|milega|milegi|chahiye|hand to hand|kiraya|kiraye|उपलब्ध|डिलीवरी)(?!\w)",
    re.IGNORECASE,
)
# News, warnings, awareness posts, official-service notices and toys. Contact details do not make these a sale.
REPORTING_RE = re.compile(
    r"(?<!\w)(police|seized|seizure|recovered|arrest(ed)?|busted|raid(ed)?|nabbed|jailed|court|verdict|ncb|news|"
    r"headline|reported|warning|beware|scam(s|mers?)?|fraudsters?|awareness|alert|how to|step by step|steps to|"
    r"apply for|renewal|renew|assistance|csc|rto|toy|replica|airsoft|story|novel|movie|film|song|lol|lost my|"
    r"never share|prepaid|postpaid|recharge|esim|terms apply)(?!\w)",
    re.IGNORECASE,
)
# Ordinary trade words. With these, a lone ambiguous word ("maal" = goods) is not enough to flag.
LEGIT_TRADE_RE = re.compile(
    r"(?<!\w)(goods|wholesale|retail|showroom|garments?|clothes|clothing|fabric|furniture|groceries|grocery|"
    r"electronics|sarees?|snacks|restaurant|tea|chai)(?!\w)",
    re.IGNORECASE,
)
# Phrases where an otherwise suspicious word is clearly harmless; removed before matching.
NEGATIVE_PHRASES = re.compile(
    r"(?<!\w)(weed out|weed killer|weedkiller|weed control|weeding|ice cream|ice cubes?|ice packs?|ice age|"
    r"ice hockey|ice skating|dry ice|black ice|ice cold|printer cartridges?|ink cartridges?|pistol shooting|"
    r"brown sugar (cookies?|cake|syrup)|molly (is|was)|the beatles)(?!\w)",
    re.IGNORECASE,
)

# Quantities are a trade signal for drugs/arms ("5 gram", "10 pcs") but not for accounts.
QUANTITY_RE = re.compile(
    r"(?<!\w)(\d+(\.\d+)?|ek|do|teen|char|paanch)\s?(g|gm|gms|gram|grams|kg|kgs|kilo|pcs|pieces|pills?|tabs?|tablets?|packets?|pouch(es)?)(?!\w)",
    re.IGNORECASE,
)

# Obfuscation handling: people write "c h i t t a", "ch1tta", "ｃｈｉｔｔａ" or add invisible characters.
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})
_SPACED_LETTERS = re.compile(r"(?<!\w)(?:\w[ \t.\-_*]){2,}\w(?!\w)")
_WORDLIKE_TERM = re.compile(r"[a-z][a-z ]{3,}[a-z]")  # only plain-letter terms of 5+ chars use obfuscation variants


# Letters from other scripts that look like Latin letters (Cyrillic, Greek, Latin Extended). They are mapped
# to ASCII only inside a word that already contains an ASCII letter, so genuine Cyrillic/Greek text is untouched.
HOMOGLYPHS = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j", "ѕ": "s",
    "ԁ": "d", "һ": "h", "ɡ": "g", "ɑ": "a", "ᴀ": "a", "ο": "o", "ν": "v", "ι": "i", "κ": "k", "ρ": "p",
    "τ": "t", "α": "a", "ε": "e", "ϲ": "c", "ⅰ": "i", "ӏ": "l", "ո": "n", "օ": "o", "ս": "u",
    "А": "a", "В": "b", "Е": "e", "К": "k", "М": "m", "Н": "h", "О": "o", "Р": "p", "С": "c", "Т": "t", "Х": "x",
    "Α": "a", "Β": "b", "Ε": "e", "Ζ": "z", "Η": "h", "Ι": "i", "Κ": "k", "Μ": "m", "Ν": "n", "Ο": "o", "Ρ": "p",
    "Τ": "t", "Υ": "y", "Χ": "x",
}
_HOMOGLYPH_TABLE = {ord(k): v for k, v in HOMOGLYPHS.items()}
_ASCII_ALPHA = re.compile(r"[A-Za-z]")


def fold_homoglyphs(text: str) -> str:
    def fix(m: "re.Match[str]") -> str:
        tok = m.group(0)
        if _ASCII_ALPHA.search(tok) and any(ord(c) in _HOMOGLYPH_TABLE for c in tok):
            return tok.translate(_HOMOGLYPH_TABLE)
        return tok
    return re.sub(r"\S+", fix, text)


def _fold(text: str) -> str:
    """NFKC folds fullwidth and math-bold letters to ASCII; format characters (zero-width etc.) are removed;
    look-alike Cyrillic/Greek letters inside Latin words are mapped back to Latin."""
    text = unicodedata.normalize("NFKC", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Cf")
    return fold_homoglyphs(text).lower()


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text)


def _normalize(text: str) -> str:
    return _squash(_fold(text))


def _collapse_spaced_letters(text: str) -> str:
    return _SPACED_LETTERS.sub(lambda m: re.sub(r"[ \t.\-_*]", "", m.group(0)), text)


def _decode_leet(text: str) -> str:
    def fix(m: "re.Match[str]") -> str:
        tok = m.group(0)
        if any(c.isalpha() for c in tok) and any(c in "013457@$" for c in tok):
            return tok.translate(_LEET)
        return tok
    return re.sub(r"\S+", fix, text)


def _squeeze(text: str) -> str:
    """Collapse repeated letters: 'chiitta' -> 'chita'."""
    return re.sub(r"([a-z])\1+", r"\1", text)


def _compile(term: str) -> "re.Pattern[str]":
    return re.compile(rf"(?<!\w){re.escape(_normalize(term))}(?!\w)")


# Pre-compiled once: (category, term, weight, ambiguous, pattern, obfuscation_ok, squeezed_pattern_or_None)
_TERMS: List[Tuple[str, str, float, bool, "re.Pattern[str]", bool, Optional["re.Pattern[str]"], int]] = []
_GID = 0
for _cat, _groups in SLANG_DICTIONARY.items():
    for _g in _groups:
        _GID += 1   # every term in a group is one concept (spelling variants), so "chitta"+"chita" is one signal
        for _t in _g["terms"]:
            _norm = _normalize(_t)
            _wordlike = bool(_WORDLIKE_TERM.fullmatch(_norm))
            _sq = _squeeze(_norm)
            # Repeated-letter matching ("chiitta") only for terms that stay 5+ letters when squeezed,
            # otherwise ordinary words such as "kata" would match "katta".
            _fuzzy = re.compile(rf"(?<!\w){re.escape(_sq)}(?!\w)") if _wordlike and len(_sq) >= 5 else None
            _TERMS.append((_cat, _t, _g["weight"], bool(_g.get("ambiguous")), _compile(_t), _wordlike, _fuzzy, _GID))


BUY_RE = re.compile(
    r"(?<!\w)(looking for|looking to buy|want to buy|wanted|need|needed|require|required|requirement|chahiye|"
    r"lena hai|buyer|buyers|buying|will buy|ready to buy|paying)(?!\w)", re.IGNORECASE)
SELL_RE = re.compile(
    r"(?<!\w)(available|avail|selling|sell|for sale|sale|in stock|stock|supply|milega|milegi|dispatch(ed)?|"
    r"delivery|deliver|ready|rate|rates|price|cod|bulk|उपलब्ध)(?!\w)", re.IGNORECASE)
RENT_RE = re.compile(r"(?<!\w)(rent|rental|kiraya|kiraye|kirya|on hire)(?!\w)", re.IGNORECASE)


def detect_direction(text: str) -> str:
    """SELL / BUY / RENT_OFFER / RENT_WANTED / UNKNOWN. Keyword rules on the folded text; a hint, not a verdict."""
    norm = _normalize(text)
    buy, sell, rent = bool(BUY_RE.search(norm)), bool(SELL_RE.search(norm)), bool(RENT_RE.search(norm))
    if rent:
        return "RENT_WANTED" if buy and not sell else "RENT_OFFER"
    if buy and not sell:
        return "BUY"
    if sell:
        return "SELL"
    return "UNKNOWN"


def classify_text(text: str) -> Dict[str, Any]:
    # Keep runs of spaces: in "k a t t a   a v a i l" they separate words. Harmless phrases are cut out
    # first so none of the obfuscation variants below can see them either.
    folded = NEGATIVE_PHRASES.sub(" ", _fold(text))
    norm = _squash(folded)
    # Variants only matter for plain-letter terms, so compute them once per post.
    collapsed = _squash(_collapse_spaced_letters(folded))
    decoded = _decode_leet(norm)
    squeezed = [_squeeze(v) for v in (norm, collapsed, decoded)]

    # Context words are looked for in every variant too, so "ch1tta deliv3ry" and "k a t t a  a v a i l" keep their sale context.
    views = (norm, collapsed, decoded)
    def seen(rx: "re.Pattern[str]") -> bool:
        return any(rx.search(v) for v in views)
    has_commerce = seen(COMMERCE_RE)
    has_quantity = seen(QUANTITY_RE)
    has_forgery = seen(FORGERY_RE)
    has_account_kit = seen(ACCOUNT_KIT_RE)
    has_unlicensed = seen(UNLICENSED_RE)
    # News/warnings/shop notices need an explicit offer to sell; contact details alone do not count.
    reporting_only = seen(REPORTING_RE) and not seen(EXPLICIT_SALE_RE)
    legit_trade = seen(LEGIT_TRADE_RE)

    per_category: Dict[str, Dict[str, Any]] = {}
    for category, term, weight, ambiguous, pattern, wordlike, fuzzy, gid in _TERMS:
        hit = bool(pattern.search(norm))
        if not hit and wordlike:
            hit = bool(pattern.search(collapsed)) or bool(pattern.search(decoded))
        if not hit and fuzzy is not None:
            hit = any(fuzzy.search(v) for v in squeezed)
        if not hit:
            continue
        entry = per_category.setdefault(category, {"strong": [], "ambiguous": [], "gids": set()})
        entry["ambiguous" if ambiguous else "strong"].append((term, weight))
        entry["gids"].add(gid)

    matched_categories = []
    for category, entry in per_category.items():
        strong, amb = entry["strong"], entry["ambiguous"]
        strong_score = max((w for _, w in strong), default=0.0)
        terms = sorted({t for t, _ in strong + amb})
        concepts = len(entry["gids"])
        sale_context = (
            has_commerce
            or (has_quantity and category in ("DRUGS", "ARMS"))
            or (has_unlicensed and category == "ARMS")
            or (has_forgery and category == "DOCUMENTS")
            or (has_account_kit and category == "FINANCIAL")
        )
        if reporting_only:
            sale_context = False
        # A strong keyword on its own is not enough ("Chitta village fair on Sunday", "my cousin Katta"):
        # it needs a sale context or at least one more matched term. News and warnings need an explicit offer.
        if strong and not (sale_context or (concepts >= 2 and not reporting_only)):
            strong_score = min(strong_score, AMBIGUOUS_NO_CONTEXT)
        amb_score = 0.0
        if amb:
            amb_max = max(w for _, w in amb)
            # Emoji alone are weak: one emoji plus a phone number is a holiday ad ("Snow ❄️ trip, call ..."),
            # so a category matched only by emoji needs two different emoji.
            emoji_only = not strong and all(not any(c.isalnum() for c in t) for t, _ in amb)
            if emoji_only and len({t for t, _ in amb}) < 2:
                sale_context = False
            # "maal" in a post about ordinary goods/wholesale is not a drug term on its own.
            if legit_trade and not strong:
                sale_context = False
            if sale_context:
                amb_score = min(amb_max, AMBIGUOUS_CAP)
                if concepts >= 2:   # another matched concept (even a weak one) corroborates
                    amb_score = max(amb_score, min(amb_max, AMBIGUOUS_CORROBORATED))
            else:
                amb_score = min(amb_max, AMBIGUOUS_NO_CONTEXT)
        base = max(strong_score, amb_score)
        # A display score based on rule matches, not a calibrated probability.
        boost = min(0.01 * (concepts - 1), 0.03)
        matched_categories.append({"category": category, "score": min(base + boost, 0.99), "terms": terms})

    matched_categories.sort(key=lambda x: x["score"], reverse=True)

    # Weak, generic words alone (e.g. "round", "degree", or "mule" with no sale context) are not enough to flag.
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
        "primary_category": categories[0] if categories else None,
        "direction": detect_direction(text) if categories else "UNKNOWN",
    }
