"""Reproducible evaluation of the keyword classifier on a small synthetic labelled set.

Run:  python eval_classifier.py
All posts are invented for testing; no real data. The set is small, so treat the numbers as an
indicative prototype measurement, not a benchmark.
"""
import time
from classifier import classify_text

# (text, expected primary category or None for benign)
SET = [
    # DRUGS
    ("Pure white available, 5g packets, DM for rate", "DRUGS"),
    ("chitta ki delivery ho jayegi, border drop point", "DRUGS"),
    ("Fresh maal available in Jaipur, serious buyers only", "DRUGS"),
    ("charas and ganja home delivery 🌿", "DRUGS"),
    ("MDMA and meow meow party pack ready", "DRUGS"),
    ("afeem doda post available Barmer side", "DRUGS"),
    ("smack ki puriya milegi, call now", "DRUGS"),
    ("weed available bro, DM me", "DRUGS"),
    ("bhai kuch lena hai? supply aa gayi hai, DM karo", "DRUGS"),
    ("snow milega kya, ek gram ke liye", "DRUGS"),
    ("packet drop at the usual place, brown sugar", "DRUGS"),
    ("meth ice crystal 💉 discreet shipping", "DRUGS"),
    # ARMS
    ("Desi katta available, call 9876500000", "ARMS"),
    ("tamancha with 10 rounds, no questions", "ARMS"),
    (".32 bore pistol for sale Alwar", "ARMS"),
    ("315 bore country made gun available", "ARMS"),
    ("revolver and cartridges in stock 🔫", "ARMS"),
    ("katta chahiye? fresh stock, bypass check post", "ARMS"),
    ("sixer available, original, DM", "ARMS"),
    ("12 bore gun without licence, Bharatpur", "ARMS"),
    ("hathiyar ka sauda karna hai, rate batao", "ARMS"),
    ("country made pistol aur magazine mil jayegi", "ARMS"),
    ("live cartridges bulk, pistol ke liye", "ARMS"),
    ("desi pistol 7.65 fresh piece", "ARMS"),
    # DOCUMENTS
    ("Fake Aadhaar and PAN card set, WhatsApp now", "DOCUMENTS"),
    ("hologram verified marksheet, any university", "DOCUMENTS"),
    ("duplicate driving licence without test", "DOCUMENTS"),
    ("forged degree and migration certificate available", "DOCUMENTS"),
    ("fake RC book and number plate, vehicle papers", "DOCUMENTS"),
    ("nakli aadhar card banwana hai? contact", "DOCUMENTS"),
    ("original-looking passport and visa stamps", "DOCUMENTS"),
    ("fake voter id and ration card ready in 1 day", "DOCUMENTS"),
    ("bogus 10th 12th marksheet with hologram", "DOCUMENTS"),
    ("PAN card fake, instant biometric bypass", "DOCUMENTS"),
    ("income certificate and caste certificate jugaad", "DOCUMENTS"),
    ("fake Aadhaar for sim activation, kyc bypass", "DOCUMENTS"),
    # FINANCIAL
    ("KYC verified current account available for rent, ATM card included", "FINANCIAL"),
    ("mule account kirya pe available, daily payout", "FINANCIAL"),
    ("USDT crypto arbitrage rent your account, 5% commission", "FINANCIAL"),
    ("bank account rent pe do, net banking kit ready", "FINANCIAL"),
    ("fully kyc saving account with sim and ATM kit for sale", "FINANCIAL"),
    ("hawala transfer, no questions, UPI collect available", "FINANCIAL"),
    ("current account kirya par chahiye, 10k per month", "FINANCIAL"),
    ("send money via our payment account, fresh KYC", "FINANCIAL"),
    ("aapka account rent pe lenge, commission 15%", "FINANCIAL"),
    ("crypto USDT otc, cash to wallet, no kyc", "FINANCIAL"),
    ("net banking login kits for sale, verified accounts", "FINANCIAL"),
    ("ATM card with passbook and sim, verified", "FINANCIAL"),
    # BENIGN
    ("Happy Diwali everyone, stay safe", None),
    ("The price of petrol went up again today", None),
    ("Cricket match tonight, who is winning the toss?", None),
    ("Selling my old bicycle, good condition, Rs 3000", None),
    ("Need notes for DBMS exam, anyone?", None),
    ("My bank account statement is ready, need to submit for visa", None),
    ("Rent for the flat is due, please pay by UPI to landlord", None),
    ("Got my degree certificate from university today!", None),
    ("White shirt available in all sizes, free delivery", None),
    ("Police announced a gun safety awareness drive in Jaipur", None),
    ("Weed killer spray available for gardens", None),
    ("Rounds of interviews start tomorrow, wish me luck", None),
]


def evaluate():
    cats = ["DRUGS", "ARMS", "DOCUMENTS", "FINANCIAL"]
    tp = {c: 0 for c in cats}; fp = {c: 0 for c in cats}; fn = {c: 0 for c in cats}
    correct = 0; wrong = []
    t0 = time.perf_counter()
    for text, exp in SET:
        got = classify_text(text)["primary_category"]
        got = got if got in cats else None
        if got == exp:
            correct += 1
        else:
            wrong.append((text, exp, got))
        if exp and got == exp: tp[exp] += 1
        if exp and got != exp: fn[exp] += 1
        if got and got != exp: fp[got] += 1
    ms = (time.perf_counter() - t0) / len(SET) * 1000
    P = sum(tp.values()) / max(1, sum(tp.values()) + sum(fp.values()))
    R = sum(tp.values()) / max(1, sum(tp.values()) + sum(fn.values()))
    return {"n": len(SET), "accuracy": correct / len(SET), "precision": P, "recall": R,
            "ms_per_post": ms, "wrong": wrong}


if __name__ == "__main__":
    r = evaluate()
    print(f"posts={r['n']} accuracy={r['accuracy']:.1%} precision={r['precision']:.1%} "
          f"recall={r['recall']:.1%} avg={r['ms_per_post']:.3f} ms/post")
    for text, exp, got in r["wrong"]:
        print(f"  MISS expected={exp} got={got}: {text}")
