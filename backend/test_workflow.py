"""Tests for the audit-driven fixes: classifier context rules, extraction normalisation, shared identifiers,
re-import dedup, analyst workflow + audit log, hash re-verification, export, platform/direction and image intake.

All data is invented. Phones are 90000000xx, handles/UPIs are test.* placeholders.
"""
import io
import json
import os
import sqlite3
import tempfile
from pathlib import Path

_db_dir = tempfile.TemporaryDirectory()
os.environ.setdefault("PRAHARI_DB_PATH", str(Path(_db_dir.name) / "workflow.db"))

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

import casework
import main
from classifier import classify_text, detect_direction
from extractor import extract_entities, normalize_for_extraction

client = TestClient(main.app)
ZW = "​"


def flagged(text):
    return bool(classify_text(text)["categories"])


# ----------------------------------------------------------------------------------------------------- classifier
def test_single_strong_keyword_needs_a_second_signal():
    for text in ["Chitta village in Himachal is beautiful, trekking plans for December",
                 "Chitta village fair on Sunday", "my cousin Katta lives in Pune", "I saw the word chitta in a story"]:
        assert not flagged(text), text
    assert flagged("chitta available 5g, DM")
    assert flagged("12 bore gun without licence, Bharatpur")


def test_demo_outputs_are_unchanged():
    a = classify_text("Pure white available. 5g = ₹8000. DM @seller_raj.")
    assert a["categories"] == ["DRUGS"] and a["confidence"] == 0.87
    b = classify_text("Selling fully KYC verified current account with ATM card + net-banking kit. ₹15000. UPI raj.pay@oksbi")
    assert b["categories"] == ["FINANCIAL"] and b["confidence"] == 0.99
    for seed in main.SEED_INTERCEPTS:
        assert flagged(seed["text"]), seed["channel"]


def test_news_warnings_and_shop_notices_are_not_flagged():
    for text in ["Police seized 5 kg of ganja from a truck near the highway; two arrested, officials said.",
                 "Beware: fake Aadhaar card scams are rising, never share OTP. Report to the cybercrime portal",
                 "Driving license renewal assistance at RTO, call our CSC 9000000033 for appointment",
                 "Lost my ATM card yesterday near the bus stand, please call 9000000053 if found",
                 "Monday mood: need chai like it is chitta lol"]:
        assert not flagged(text), text
    # ...but an explicit offer still flags even when the post mentions police
    assert flagged("Not police, original chitta available 5g, delivery Jaipur, DM")


def test_single_emoji_and_goods_do_not_flag():
    assert not flagged("Snow ❄️ fun in Manali trip, book your package, call 9000000002")
    assert not flagged("Fresh maal (goods) available at wholesale rate, call 9000000001")
    assert flagged("🔥🔥 ❄️ 5g 📦 DM")


def test_lookalike_letters_and_new_spellings_are_caught():
    for text in ["сhitta available 5g DM now", "kаtta available 32 bore DM", "gɑnja οpium available delivery",
                 "cheeta ready 5g dm", "kaata ready delivery dm"]:
        assert flagged(text), text
    assert not flagged("Привет, как дела? Встретимся в среду")   # real Cyrillic is left alone


def test_sim_card_trade_is_flagged_but_ordinary_sim_posts_are_not():
    for text in ["Pre-activated SIM cards available in bulk, no KYC, fresh stock, whatsapp 9000000061",
                 "Fake KYC sim cards sell, 100 pieces ready, dm @test_sim01",
                 "Sim card kit ready, bulk supply, delivery by courier"]:
        assert classify_text(text)["categories"] == ["FINANCIAL"], text
    for text in ["Jio new prepaid plan: 28 days 2GB per day, recharge now at our shop, call 9000000063",
                 "Lost sim card? Visit the store with Aadhaar to get a duplicate sim, no extra charge",
                 "Airtel postpaid offer: free sim and 5G data, available at all stores, terms apply"]:
        assert not flagged(text), text


def test_direction_is_detected():
    assert detect_direction("chitta available 5g") == "SELL"
    assert detect_direction("need chitta 5g urgently, buyer here") == "BUY"
    assert detect_direction("bank account on rent, kiraya 5k") == "RENT_OFFER"
    assert detect_direction("need bank account on rent, kiraya chahiye") == "RENT_WANTED"
    assert detect_direction("hello") == "UNKNOWN"
    assert classify_text("Desi katta available, call 9000000011")["direction"] == "SELL"


# ----------------------------------------------------------------------------------------------------- extractor
@pytest.mark.parametrize("text", [
    "call 9 0 0 0 0 0 0 0 0 1 for stock", "call 9000 000 001 for stock", f"call 9000{ZW}000001 for stock",
    "call ९००००००००१ now", "call ９００００００००१ now",
    "call nine zero zero zero zero zero zero zero zero one", "call nau shunya shunya shunya shunya shunya shunya shunya shunya ek",
    "call 9 zero zero zero zero zero zero zero zero 1", "call +91 90000 00001", "call 919000000001",
])
def test_obfuscated_phone_numbers_are_extracted(text):
    assert extract_entities(text)["phones"] == ["9000000001"], text


@pytest.mark.parametrize("text", [
    "pay test.user (at) upi", "pay test.user [at] upi", "pay test.user at upi", "pay test dot user at upi",
    "pay test.user@ upi", "pay TEST.USER@UPI", f"pay test.u{ZW}ser@upi", "pay tеst.user@upi",
])
def test_obfuscated_upi_ids_are_extracted_and_lowercased(text):
    assert extract_entities(text)["upis"] == ["test.user@upi"], text


def test_ordinary_english_is_not_turned_into_a_upi_or_phone():
    r = extract_entities("let us meet at upi counter, I have 5 6 7 apples and 2 3 4 oranges")
    assert r["upis"] == [] and r["phones"] == []
    assert extract_entities("ek do teen char")["phones"] == []


def test_handles_and_wallets_are_case_normalised():
    r = extract_entities("DM @Seller_Raj or @seller_raj, eth 0xAbCdEf0123456789aBcDeF0123456789abcdef01")
    assert r["handles"] == ["@seller_raj"]
    assert r["wallets"] == ["0xabcdef0123456789abcdef0123456789abcdef01"]


def test_long_account_number_is_not_mistaken_for_a_phone():
    r = extract_entities("account 1236789012345 IFSC HDFC0001234")
    assert r["phones"] == [] and r["bank_accounts"] == ["1236789012345"]


def test_generic_identifiers_are_reported_as_shared_not_linked():
    r = extract_entities("contact @admin or @support, call 9999999999, helpline 18001234567, DM @real_seller_9")
    assert r["handles"] == ["@real_seller_9"]
    assert r["phones"] == [] and r["bank_accounts"] == []
    kinds = {(s["type"], s["value"]) for s in r["shared"]}
    assert ("handle", "@admin") in kinds and ("phone", "9999999999") in kinds and ("bank_account", "18001234567") in kinds


def test_raw_text_and_hash_are_never_changed_by_normalisation():
    text = f"ch{ZW}itta available 5g call 9000{ZW}000001"
    r = client.post("/api/scan/text", json={"text": text, "channel": "@norm_raw_check"}).json()
    assert r["rawText"] == text
    import hashlib
    assert r["sha256"] == hashlib.sha256(text.encode("utf-8")).hexdigest()
    assert normalize_for_extraction(text) != text   # the normalised view is separate


# ----------------------------------------------------------------------------------------------------- risk / graph
def _alert_for(post_id):
    return next(a for a in client.get("/api/alerts?limit=200").json() if a["postId"] == post_id)


def test_shared_handle_does_not_add_cross_channel_risk_but_real_one_does():
    a1 = client.post("/api/scan/text", json={"text": "chitta available 5g, DM @admin", "channel": "@sh_a"}).json()
    a2 = client.post("/api/scan/text", json={"text": "chitta available 10g, DM @admin", "channel": "@sh_b"}).json()
    for r in (a1, a2):
        assert not any("2+ channels" in x for x in _alert_for(r["id"])["riskReasons"])
    assert "@admin" not in main.ENTITY_GRAPH.nodes
    b1 = client.post("/api/scan/text", json={"text": "chitta available 5g, DM @tier2_seller", "channel": "@sh_c"}).json()
    b2 = client.post("/api/scan/text", json={"text": "chitta available 10g, DM @Tier2_Seller", "channel": "@sh_d"}).json()
    assert any("2+ channels" in x for x in _alert_for(b2["id"])["riskReasons"])
    assert main.ENTITY_GRAPH.nodes["@tier2_seller"]["isHero"] is True   # mixed case merged into one node
    assert b1["entities"]["handles"] == ["@tier2_seller"]


# ----------------------------------------------------------------------------------------------------- dedup + platform
def test_reimporting_the_same_file_does_not_create_duplicates():
    csv_bytes = ("channel,text,timestamp,platform\n"
                 "@dd_chan,chitta available 5g dm @dd_seller,2026-02-01T10:00:00Z,telegram\n"
                 "@dd_chan,Pure white 10g ready dm @dd_seller,2026-02-01T11:00:00Z,WhatsApp\n").encode()
    first = client.post("/api/ingest/file", files={"file": ("dd.csv", csv_bytes, "text/csv")}).json()
    assert first["ingested_count"] == 2 and first["duplicates_skipped"] == 0
    assert [r["platform"] for r in first["records"]] == ["TELEGRAM", "WHATSAPP"]
    before = len(main.INTERCEPTS_STORE)
    second = client.post("/api/ingest/file", files={"file": ("dd.csv", csv_bytes, "text/csv")}).json()
    assert second["ingested_count"] == 0 and second["duplicates_skipped"] == 2
    assert len(main.INTERCEPTS_STORE) == before
    # same text in a DIFFERENT channel is a genuine cross-channel repost, not a duplicate
    other = csv_bytes.replace(b"@dd_chan", b"@dd_other")
    third = client.post("/api/ingest/file", files={"file": ("dd2.csv", other, "text/csv")}).json()
    assert third["ingested_count"] == 2


def test_manual_scan_of_identical_text_returns_the_existing_record():
    body = {"text": "dedupe me: chitta available 5g dm @dd_manual", "channel": "@dd_manual_chan"}
    a = client.post("/api/scan/text", json=body).json()
    b = client.post("/api/scan/text", json=body).json()
    assert b["id"] == a["id"] and b["duplicate"] is True


def test_platform_is_normalised_and_defaults_to_unknown():
    assert main.normalize_platform("whatsapp") == "WHATSAPP"
    assert main.normalize_platform("Twitter") == "X"
    assert main.normalize_platform("telegram ") == "TELEGRAM"
    assert main.normalize_platform("") == "UNKNOWN"
    assert main.normalize_platform("darknet market") == "OTHER"
    r = client.post("/api/scan/text", json={"text": "platform check chitta 5g available", "channel": "@pf_a", "platform": "instagram"}).json()
    assert r["platform"] == "INSTAGRAM" and r["direction"] == "SELL"
    assert {s["platform"] for s in main.INTERCEPTS_STORE if s["sourceType"] == "SYNTHETIC_DEMO"} <= {"TELEGRAM", "UNKNOWN"}


# ----------------------------------------------------------------------------------------------------- workflow + audit
def test_status_workflow_history_and_audit_chain():
    r = client.post("/api/scan/text", json={"text": "workflow chitta available 5g dm @wf_seller", "channel": "@wf_chan", "analyst": "SI Sharma"}).json()
    pid = r["id"]
    assert client.get(f"/api/dossier/{pid}").json()["analystStatus"] == "NEW"
    bad = client.post(f"/api/posts/{pid}/status", json={"status": "DELETED"})
    assert bad.status_code == 422
    assert client.post("/api/posts/nope/status", json={"status": "REVIEWING"}).status_code == 404
    ok = client.post(f"/api/posts/{pid}/status", json={"status": "reviewing", "note": "checking handle", "analyst": "SI Sharma"}).json()
    assert ok["status"] == "REVIEWING" and ok["previous"] == "NEW"
    client.post(f"/api/posts/{pid}/status", json={"status": "ESCALATED", "note": "to cyber cell", "analyst": "SI Sharma"})
    alert = _alert_for(pid)
    assert alert["analystStatus"] == "ESCALATED" and alert["analystNote"] == "to cyber cell"
    assert any(a["postId"] == pid for a in client.get("/api/alerts?status=escalated").json())
    assert not any(a["postId"] == pid for a in client.get("/api/alerts?status=closed").json())
    actions = [h["action"] for h in client.get(f"/api/posts/{pid}/history").json()]
    assert actions[0] == "STATUS_CHANGE" and "INGEST" in actions
    # the stored evidence is untouched by working the case
    assert main.casework.verify_hash(main.DB_PATH, pid)["match"] is True
    assert client.get("/api/audit/verify").json()["ok"] is True


def test_editing_an_old_audit_row_breaks_the_chain():
    client.post("/api/scan/text", json={"text": "audit tamper chitta available 5g dm", "channel": "@at_chan"})
    assert client.get("/api/audit/verify").json()["ok"] is True
    with sqlite3.connect(main.DB_PATH) as conn:
        row = conn.execute("SELECT id, actor FROM audit_log ORDER BY id LIMIT 1 OFFSET 1").fetchone()
        conn.execute("UPDATE audit_log SET actor = 'someone else' WHERE id = ?", (row[0],))
    broken = client.get("/api/audit/verify").json()
    assert broken["ok"] is False and broken["brokenAtId"] == row[0]
    with sqlite3.connect(main.DB_PATH) as conn:
        conn.execute("UPDATE audit_log SET actor = ? WHERE id = ?", (row[1], row[0]))
    assert client.get("/api/audit/verify").json()["ok"] is True


def test_verify_hash_detects_a_changed_stored_text():
    r = client.post("/api/scan/text", json={"text": "verify me: chitta available 5g dm", "channel": "@vh_chan"}).json()
    good = client.post(f"/api/dossier/{r['id']}/verify").json()
    assert good["match"] is True and good["recomputed"] == r["sha256"]
    with sqlite3.connect(main.DB_PATH) as conn:
        conn.execute("UPDATE intercepts SET raw_text = 'edited after capture' WHERE id = ?", (r["id"],))
    bad = client.post(f"/api/dossier/{r['id']}/verify").json()
    assert bad["match"] is False and bad["recomputed"] != r["sha256"]
    with sqlite3.connect(main.DB_PATH) as conn:
        conn.execute("UPDATE intercepts SET raw_text = ? WHERE id = ?", (r["rawText"], r["id"]))
    assert client.post(f"/api/dossier/{r['id']}/verify").json()["match"] is True
    assert client.post("/api/dossier/nope/verify").status_code == 404


# ----------------------------------------------------------------------------------------------------- export
def test_csv_export_neutralises_spreadsheet_formulas_and_logs_the_export():
    client.post("/api/scan/text", json={"text": "=HYPERLINK(\"http://x\") chitta available 5g dm", "channel": "@ex_chan"})
    res = client.get("/api/export?format=csv&analyst=SI%20Sharma")
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    import csv as _csv
    rows = list(_csv.DictReader(io.StringIO(res.text.lstrip("﻿"))))
    assert rows and {"alertId", "sha256", "analystStatus", "platform", "direction"} <= set(rows[0])
    texts = [r["text"] for r in rows]
    assert any(t.startswith("'=HYPERLINK") for t in texts)
    assert not any(t.startswith("=") for t in texts)
    js = client.get("/api/export?format=json").json()
    assert js["alerts"] and "not legal certificates" in js["note"]
    assert client.get("/api/export?format=xml").status_code == 422
    assert client.get("/api/audit?limit=5").json()[0]["action"] == "EXPORT"


# ----------------------------------------------------------------------------------------------------- images
def _png(text="SIM CARDS 100pcs CALL", size=(320, 200), shade=30, variant=False):
    img = Image.new("RGB", size, (shade, shade + 20, 90))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, size[0] - 20, 80], fill=(240, 240, 240))
    d.ellipse([40, 100, 140, 180], fill=(200, 40, 40))
    d.text((30, 40), text, fill=(0, 0, 0))
    if variant:
        img = img.resize((size[0] // 2, size[1] // 2)).resize(size)
    buf = io.BytesIO()
    img.save(buf, "PNG" if not variant else "JPEG")
    return buf.getvalue()


@pytest.fixture
def no_server_ocr(monkeypatch):
    """Behave like the free Render tier (no tesseract binary): the text comes from the browser."""
    monkeypatch.setattr(main.images, "server_ocr", lambda data: "")


def test_image_upload_hashes_links_near_duplicates_across_channels_and_scores_risk(no_server_ocr):
    a = client.post("/api/ingest/image", files={"file": ("a.png", _png(), "image/png")},
                    data={"channel": "@img_one", "ocrText": "Pre-activated SIM cards available in bulk, no KYC, dm @img_seller_1", "platform": "instagram"})
    assert a.status_code == 200, a.text
    a = a.json()
    assert a["sourceType"] == "UPLOADED_IMAGE" and a["platform"] == "INSTAGRAM"
    assert len(a["image"]["sha256"]) == 64 and len(a["image"]["phash"]) == 16
    assert a["categories"] == ["FINANCIAL"]
    assert "not stored" in a["image"]["note"]
    b = client.post("/api/ingest/image", files={"file": ("b.jpg", _png(variant=True), "image/jpeg")},
                    data={"channel": "@img_two", "ocrText": "Fresh sim stock bulk, pre-activated sim, whatsapp 9000000077"}).json()
    assert b["similarImages"] and b["similarImages"][0]["postId"] == a["id"] and b["similarImages"][0]["distance"] <= 10
    assert any(e["source"] == b["id"] and e["target"] == a["id"] and e["label"].startswith("SIMILAR IMAGE") for e in main.ENTITY_GRAPH.edges)
    assert any("near-identical image" in r for r in _alert_for(b["id"])["riskReasons"])
    groups = client.get("/api/image-matches").json()
    assert any({a["id"], b["id"]} <= set(g["postIds"]) and g["crossChannel"] for g in groups)
    # a clearly different picture is not matched
    other = Image.new("RGB", (320, 200), (250, 250, 250))
    ImageDraw.Draw(other).line([0, 0, 320, 200], fill=(0, 0, 0), width=9)
    buf = io.BytesIO(); other.save(buf, "PNG")
    c = client.post("/api/ingest/image", files={"file": ("c.png", buf.getvalue(), "image/png")},
                    data={"channel": "@img_three", "ocrText": "unrelated picture"}).json()
    assert not c["similarImages"]


def test_image_without_text_is_kept_by_hash_and_same_image_is_deduped(no_server_ocr):
    data = _png(text="NO WORDS", shade=77)
    first = client.post("/api/ingest/image", files={"file": ("n.png", data, "image/png")}, data={"channel": "@img_blank"}).json()
    assert first["image"]["ocrSource"] in ("none", "server_tesseract")
    again = client.post("/api/ingest/image", files={"file": ("n.png", data, "image/png")}, data={"channel": "@img_blank"}).json()
    assert again.get("duplicate") is True and again["id"] == first["id"]


def test_bad_images_are_rejected():
    assert client.post("/api/ingest/image", files={"file": ("x.png", b"not an image", "image/png")}).status_code == 400
    assert client.post("/api/ingest/image", files={"file": ("e.png", b"", "image/png")}).status_code == 400
    big = b"\x89PNG" + b"0" * (9 * 1024 * 1024)
    assert client.post("/api/ingest/image", files={"file": ("big.png", big, "image/png")}).status_code == 413


def test_perceptual_hash_is_stable_under_resize_and_far_apart_for_different_images():
    from images import dhash, hamming
    base = Image.open(io.BytesIO(_png()))
    small = base.resize((160, 100))
    assert hamming(dhash(base), dhash(small)) <= 6
    other = Image.new("RGB", (320, 200), (250, 250, 250))
    ImageDraw.Draw(other).line([0, 0, 320, 200], fill=(0, 0, 0), width=9)
    assert hamming(dhash(base), dhash(other)) > 10


def test_startup_rebuilds_similar_image_edges(tmp_path):
    """After a restart (cold start on Render) the graph is rebuilt from the database, image links included."""
    import subprocess, sys, textwrap
    db = tmp_path / "rebuild.db"
    script = textwrap.dedent(f"""
        import io, os, sys
        os.environ["PRAHARI_DB_PATH"] = {str(db)!r}
        sys.path.insert(0, {str(Path(__file__).parent)!r})
        from PIL import Image, ImageDraw
        from fastapi.testclient import TestClient
        import main
        def png(shade):
            im = Image.new("RGB", (200, 120), (shade, 60, 90)); ImageDraw.Draw(im).ellipse([20, 20, 120, 100], fill=(240, 240, 240))
            b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()
        c = TestClient(main.app)
        c.post("/api/ingest/image", files={{"file": ("a.png", png(30), "image/png")}}, data={{"channel": "@r1", "ocrText": "sim kit ready bulk supply"}})
        c.post("/api/ingest/image", files={{"file": ("b.png", png(31), "image/png")}}, data={{"channel": "@r2", "ocrText": "sim kit ready bulk supply today"}})
    """)
    subprocess.run([sys.executable, "-c", script], check=True, capture_output=True)
    check = textwrap.dedent(f"""
        import os, sys
        os.environ["PRAHARI_DB_PATH"] = {str(db)!r}
        sys.path.insert(0, {str(Path(__file__).parent)!r})
        import main
        print(sum(1 for e in main.ENTITY_GRAPH.edges if e["label"].startswith("SIMILAR IMAGE")))
    """)
    out = subprocess.run([sys.executable, "-c", check], check=True, capture_output=True, text=True).stdout.strip()
    assert out == "1"


@pytest.mark.skipif(not __import__("images").have_server_ocr(), reason="tesseract is not installed here")
def test_server_side_ocr_reads_text_from_an_image_when_tesseract_is_installed():
    from PIL import ImageFont
    img = Image.new("RGB", (900, 220), "white")
    try:
        font = ImageFont.load_default(size=64)
    except TypeError:
        pytest.skip("Pillow too old for a sized default font")
    ImageDraw.Draw(img).text((20, 60), "chitta available 5g", fill="black", font=font)
    buf = io.BytesIO(); img.save(buf, "PNG")
    r = client.post("/api/ingest/image", files={"file": ("ocr.png", buf.getvalue(), "image/png")}, data={"channel": "@ocr_chan"}).json()
    assert r["image"]["ocrSource"] == "server_tesseract"
    assert "chitta" in r["rawText"].lower() and r["categories"] == ["DRUGS"]


# ----------------------------------------------------------------------------------- PS02 demo-data patterns
# Written in the style of the PS02 demo dataset (not copied from it). Positives must flag; hard negatives must not.
PS02_POSITIVES = [
    ("g@nja / ch@ras / M.D sab milega 💯 Sikar side. number: 900 000 0101", "DRUGS"),
    ("🍀😮‍💨 + 💊🍬 dono available hai Kota me 🚀 inbox karo @test_party01", "DRUGS"),
    ("🍁🍁🍁 🛵💨 Ajmer 📲 ९००००००१०२", "DRUGS"),
    ("Your trusted 🔌 is back ❄️👃 premium only | Jodhpur drops daily", "DRUGS"),
    ("Weekend party ka saman ready hai 🎉😮‍💨 quality top. DM @test_party01", "DRUGS"),
    ("p!st0l / k@tta available 💯 payment sirf USDT", "ARMS"),
    ("Naya saman aaya hai bhai ⚙️ 'tools' fully fitted, trial ke saath", "ARMS"),
    ("Aadh@ar / P.A.N 'correction service' 100% same look ✅", "DOCUMENTS"),
    ("10th, 12th marksheet + degree verified type 🎓 urgent bhi milega", "DOCUMENTS"),
    ("S!M ready 📶 bulk me 📲 ९००००००१०३", "FINANCIAL"),
    ("eKYC done SIM kisi aur ke naam pe, seedha use karo", "FINANCIAL"),
    ("Indian virtual numbers for OTP, instant", "FINANCIAL"),
    ("Apna bank acc0unt do aur ghar baithe kamao, bas net banking details deni hai", "FINANCIAL"),
    ("Fresh + old vintage accounts ready 🏦 limit 50L+, freeze free guarantee", "FINANCIAL"),
    ("A.T.M kit + S!M bound ready hai, wholesale rate", "FINANCIAL"),
]
PS02_NEGATIVES = [
    "Chitta aur smack ka nasha chhodne ke liye free counselling, district hospital",
    "Agar koi 'current account rent' ka offer de to report karo, ye mule account fraud hai",
    "BGMI new M416 skin 🔫🔥 kisi ke paas redeem code hai?",
    "Diwali sale: toy guns and water pistols for kids 🔫💦",
    "Protein ka 'maal' original hai bhai, duplicate nahi, bill ke saath",
    "Naya SIM lene ke liye ab eKYC compulsory hai, store pe original Aadhaar le jaana",
    "Dual SIM wala phone chahiye dadi ke liye",
    "Apna Aadhaar PAN se link karwa lo, warna PAN inactive ho jayega",
    "नशा मुक्त राजस्थान: चिट्टा और स्मैक युवाओं की ज़िंदगी बर्बाद कर रहे हैं। सूचना दें।",
]


def test_ps02_style_positives_and_hard_negatives():
    for text, cat in PS02_POSITIVES:
        assert classify_text(text)["categories"][:1] == [cat], text
    for text in PS02_NEGATIVES:
        assert not flagged(text), text


def test_leetspeak_words_are_not_upi_ids_and_native_digits_are_phones():
    from extractor import extract_entities
    e = extract_entities("g@nja / ch@ras / sm@ck / Aadh@ar, pay test.pay@oksbi, call ९००००००१०४")
    assert e["upis"] == ["test.pay@oksbi"]
    assert e["phones"] == ["9000000104"]
