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


# Held-out set, written AFTER the lexicon was last changed and never used for tuning.
# (The first SET above was used while developing the lexicon, so its numbers are optimistic.)
HOLDOUT = [
    # DRUGS
    ("fresh chitta stock aaya hai, 2 gram minimum, Jaipur only", "DRUGS"),
    ("bro need pure white? tell me quantity, I deliver at your place", "DRUGS"),
    ("ganja supply from Odisha, 1 kg lots, cash payment", "DRUGS"),
    ("MD tablets and LSD stamps available, trusted seller, DM", "DRUGS"),
    ("opium doda post sale, truck delivery to Pratapgarh", "DRUGS"),
    ("heroin small packets 💉 hand to hand near bus stand", "DRUGS"),
    ("sulfa aur snow, dono mil jayega, rate DM me", "DRUGS"),
    # ARMS
    ("katta aur 4 cartridge ready, Dholpur pickup", "ARMS"),
    ("32 bore revolver, almost new, serious buyers", "ARMS"),
    ("bandook 12 bore double barrel without papers, Churu", "ARMS"),
    ("pistol with 2 magazines for sale, call 9812345670", "ARMS"),
    ("desi tamancha 315, fresh piece, rate fixed", "ARMS"),
    ("ammo bulk available, all calibres, DM", "ARMS"),
    # DOCUMENTS
    ("Aadhaar card nakli banwa dunga, 2 ghante me, WhatsApp karo", "DOCUMENTS"),
    ("fake PAN and driving licence combo, Sikar, contact", "DOCUMENTS"),
    ("B.Tech degree with hologram, any university, 15k", "DOCUMENTS"),
    ("forged 12th marksheet and TC ready, same day", "DOCUMENTS"),
    ("passport stamp jugaad, visa verification pass, serious only", "DOCUMENTS"),
    ("RC and insurance papers duplicate, vehicle sale ke liye", "DOCUMENTS"),
    # FINANCIAL
    ("current account rent pe chahiye, 20k monthly, KYC mere paas", "FINANCIAL"),
    ("mule account available, same day payout, Jodhpur", "FINANCIAL"),
    ("bank kit with sim and net banking for sale, verified", "FINANCIAL"),
    ("accounts on rent, fresh, daily limit 1 lakh", "FINANCIAL"),
    ("USDT buy sell at 91, cash settlement, no questions", "FINANCIAL"),
    ("paise ghumane wala account chahiye, commission milega", "FINANCIAL"),
    # BENIGN (including tricky look-alikes)
    ("Reminder: electricity bill due on 5th, pay via UPI to avoid late fee", None),
    ("Our school mule race on sports day was so funny", None),
    ("The police seized a large quantity of heroin near the border, SP said in a press briefing", None),
    ("Need a driving licence agent in Jaipur? RTO office is on Tonk road", None),
    ("Is weed legal in Canada? asking for a school debate", None),
    ("Selling my old laptop, 8GB RAM, call 9876012345", None),
    ("Pistol shooting trials at the sports complex tomorrow 10am", None),
    ("Chitta village in Himachal is beautiful, trekking plans for December", None),
    ("Home delivery of groceries available in Vaishali Nagar, WhatsApp to order", None),
    ("Aadhaar update camp this Saturday, carry original documents", None),
    ("How to open a current account for my startup? any bank suggestions", None),
    ("Ice cream available at half price today, hurry", None),
    ("Cricket: he hit three sixers in the last over!", None),
    ("The magazine is delivered every month, subscription 500 per year", None),
    ("Please do not buy fake products online, check seller ratings", None),
    ("My atm card got blocked, the bank sent a new one by post", None),
    ("Degree certificate attestation service for abroad jobs, apply at the university office", None),
    ("Bhai kal party hai, maal ready rakhna, cold drinks bhi", None),
    ("Rent a flat near Malviya Nagar, 2BHK, contact broker", None),
    ("score 10 out of 10 in the maths test, treat on me", None),
    ("Opium Wars were fought in the 19th century, today's history class", None),
    ("Bank holiday on Sunday, withdrawal limit at ATM is 20000 per day", None),
    ("The gun salute during the Republic Day parade was loud", None),
    ("Rare coin collection for sale, 10g silver coins, call me", None),
    ("Dm me for design work, logo and posters available", None),
]


def evaluate(dataset=None):
    dataset = SET if dataset is None else dataset
    cats = ["DRUGS", "ARMS", "DOCUMENTS", "FINANCIAL"]
    tp = {c: 0 for c in cats}; fp = {c: 0 for c in cats}; fn = {c: 0 for c in cats}
    correct = 0; wrong = []
    t0 = time.perf_counter()
    for text, exp in dataset:
        got = classify_text(text)["primary_category"]
        got = got if got in cats else None
        if got == exp:
            correct += 1
        else:
            wrong.append((text, exp, got))
        if exp and got == exp: tp[exp] += 1
        if exp and got != exp: fn[exp] += 1
        if got and got != exp: fp[got] += 1
    ms = (time.perf_counter() - t0) / len(dataset) * 1000
    P = sum(tp.values()) / max(1, sum(tp.values()) + sum(fp.values()))
    R = sum(tp.values()) / max(1, sum(tp.values()) + sum(fn.values()))
    return {"n": len(dataset), "accuracy": correct / len(dataset), "precision": P, "recall": R,
            "ms_per_post": ms, "wrong": wrong}


if __name__ == "__main__":
    for name, data in (("DEV (used while tuning)", SET), ("HOLDOUT (never tuned on)", HOLDOUT)):
        r = evaluate(data)
        print(f"[{name}] posts={r['n']} accuracy={r['accuracy']:.1%} precision={r['precision']:.1%} "
              f"recall={r['recall']:.1%} avg={r['ms_per_post']:.3f} ms/post")
        for text, exp, got in r["wrong"]:
            print(f"  WRONG expected={exp} got={got}: {text}")
