import asyncio
import hashlib
import os
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from pydantic import ValidationError

_db_dir = tempfile.TemporaryDirectory()
os.environ["PRAHARI_DB_PATH"] = str(Path(_db_dir.name) / "test.db")

from fastapi import HTTPException, UploadFile
from main import ChannelScanRequest, DISTRICT_COUNTS, INTERCEPTS_STORE, TextScanRequest, ingest_dataset_file, process_and_store_post
from extractor import extract_entities
from classifier import classify_text
from telegram_scraper import TelegramPreviewError, scrape_public_telegram_channel
from graph_engine import DynamicEntityGraph


class IngestionTests(unittest.TestCase):
    def test_api_models_bound_text_and_channel_requests(self):
        with self.assertRaises(ValidationError):
            TextScanRequest(text="")
        with self.assertRaises(ValidationError):
            TextScanRequest(text="x" * 50_001)
        with self.assertRaises(ValidationError):
            ChannelScanRequest(channel="@sample", limit=51)

    def test_district_counts_have_no_invented_baseline(self):
        self.assertEqual(DISTRICT_COUNTS["jaipur"], 2)
        self.assertNotEqual(DISTRICT_COUNTS["jaipur"], 43)

    def test_content_hash_and_provenance_are_honest(self):
        record = process_and_store_post("analyst", "A sample analyst note")
        self.assertEqual(record["sha256"], hashlib.sha256(b"A sample analyst note").hexdigest())
        self.assertEqual(record["sha256Scope"], "UTF-8 rawText bytes")
        self.assertEqual(record["sourceType"], "ANALYST_SUBMISSION")
        self.assertFalse(record["verified"])
        self.assertFalse(record["section65B"]["certified"])

    def test_failed_persistence_does_not_publish_an_in_memory_record(self):
        existing_count = len(INTERCEPTS_STORE)
        with patch("main.save_to_db", side_effect=RuntimeError("disk unavailable")):
            with self.assertRaises(RuntimeError):
                process_and_store_post("analyst", "This record must not be published")
        self.assertEqual(len(INTERCEPTS_STORE), existing_count)

    def test_csv_quoted_commas_and_newlines(self):
        content = b'channel,text,timestamp,source\n@sample,"First line, with comma\nsecond line",2026-01-02T03:04:05Z,export batch 7\n'
        upload = UploadFile(filename="messages.csv", file=__import__("io").BytesIO(content))
        response = asyncio.run(ingest_dataset_file(upload))
        self.assertEqual(response["ingested_count"], 1)
        self.assertEqual(response["records"][0]["rawText"], "First line, with comma\nsecond line")
        self.assertEqual(response["records"][0]["sourceType"], "UPLOADED_DATASET")
        self.assertEqual(response["records"][0]["sourceTimestamp"], "2026-01-02T03:04:05Z")
        self.assertEqual(response["records"][0]["sourceReference"], "export batch 7")

    def test_csv_requires_header(self):
        upload = UploadFile(filename="bad.csv", file=__import__("io").BytesIO(b'just one plain line\n'))
        with self.assertRaises(HTTPException) as exc:
            asyncio.run(ingest_dataset_file(upload))
        self.assertEqual(exc.exception.status_code, 400)
        self.assertIn("header", exc.exception.detail)

    def test_empty_valid_csv_returns_unprocessable(self):
        upload = UploadFile(filename="empty.csv", file=__import__("io").BytesIO(b'text,channel\n,\n'))
        with self.assertRaises(HTTPException) as exc:
            asyncio.run(ingest_dataset_file(upload))
        self.assertEqual(exc.exception.status_code, 422)

    def test_unknown_location_is_not_defaulted_to_jaipur(self):
        self.assertEqual(extract_entities("No location mentioned")['district_id'], "unknown")
        self.assertEqual(extract_entities("Sri Ganganagar delivery")['district_id'], "sri-ganganagar")

    def test_unmatched_text_is_not_defaulted_to_financial(self):
        result = classify_text("A neutral note with no known indicators")
        self.assertEqual(result["categories"], [])
        self.assertIsNone(result["primary_category"])
        self.assertEqual(result["confidence"], 0.0)

    def test_classifier_ignores_terms_inside_other_words(self):
        result = classify_text("The price is around a whitebuilding with a degreeprogram.")
        self.assertEqual(result["categories"], [])

    def test_classifier_does_not_flag_generic_white_description(self):
        result = classify_text("The price is around a white building.")
        self.assertEqual(result["categories"], [])

    def test_classifier_still_matches_a_word_as_a_word(self):
        self.assertIn("DRUGS", classify_text("A small bag of ice is available")["categories"])

    def test_extractor_does_not_call_email_a_handle_or_upi(self):
        entities = extract_entities("Contact a@gmail.com for details")
        self.assertEqual(entities["upis"], [])
        self.assertEqual(entities["handles"], [])

    def test_phone_with_country_prefix_is_not_also_a_bank_account(self):
        entities = extract_entities("Call 919876543210")
        self.assertIn("9876543210", entities["phones"])
        self.assertNotIn("919876543210", entities["bank_accounts"])

    def test_graph_links_bank_account_and_ifsc_entities(self):
        graph = DynamicEntityGraph()
        graph.ingest_intercept({
            "id": "test_post",
            "channel": "@sample",
            "categories": [],
            "entities": {"bankAccounts": ["123456789012"], "ifscCodes": ["ABCD0123456"]},
        })
        self.assertEqual(graph.nodes["test_post"]["category"], "UNCLASSIFIED")
        self.assertEqual(graph.nodes["123456789012"]["type"], "bank_account")
        self.assertEqual(graph.nodes["ABCD0123456"]["type"], "ifsc")
        self.assertEqual(len(graph.edges), 2)

    def test_different_wallets_with_same_visible_ends_stay_separate(self):
        graph = DynamicEntityGraph()
        graph.ingest_intercept({"id":"p1","channel":"@one","categories":[],"entities":{"wallets":["bc1qaaaa1111111111111111111111111111111zxyz"]}})
        graph.ingest_intercept({"id":"p2","channel":"@two","categories":[],"entities":{"wallets":["bc1qbbbb2222222222222222222222222222222zxyz"]}})
        wallets = [node for node in graph.nodes.values() if node["type"] == "crypto"]
        self.assertEqual(len(wallets), 2)

    def test_unavailable_telegram_preview_returns_no_synthetic_rows(self):
        class Response:
            status_code = 404
            text = ""

        class Client:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return False

            async def get(self, *_args, **_kwargs):
                return Response()

        with patch("telegram_scraper.httpx.AsyncClient", return_value=Client()):
            with self.assertRaises(TelegramPreviewError):
                asyncio.run(scrape_public_telegram_channel("missing_channel"))

    def test_generic_words_do_not_flag_harmless_text(self):
        text = "Price of tea, a round of drinks, white shirt, 5g network, degree from college"
        self.assertEqual(classify_text(text)["categories"], [])

    def test_current_account_is_not_rent_account(self):
        self.assertNotIn("rent account", classify_text("I need a current account for my shop")["matched_slang"])

    def test_alerts_have_stable_id_risk_and_evidence(self):
        from analytics import build_alerts
        post = process_and_store_post("@x", "Pure white chitta, pay UPI test.id@oksbi", source_type="ANALYST_SUBMISSION")
        alert = next(a for a in build_alerts([post]) if a["postId"] == post["id"])
        self.assertTrue(alert["alertId"].startswith("ALRT-"))
        self.assertEqual(alert["evidence"]["sha256"], post["sha256"])
        self.assertIn(alert["riskLevel"], {"LOW", "MEDIUM", "HIGH"})

    def test_near_duplicate_ads_across_channels_are_grouped(self):
        from analytics import find_coordinated
        posts = [
            {"id": "1", "channel": "@a", "rawText": "Fully KYC verified current account with ATM card available for rent, Jaipur"},
            {"id": "2", "channel": "@b", "rawText": "Full KYC verifed current account with ATM card available for rent Jaipur!!"},
            {"id": "3", "channel": "@c", "rawText": "Desi katta with 10 raund, Alwar pickup only"},
        ]
        groups = find_coordinated(posts)
        self.assertEqual(len(groups), 1)
        self.assertTrue(groups[0]["crossChannel"])
        self.assertEqual(sorted(groups[0]["postIds"]), ["1", "2"])


if __name__ == "__main__":
    unittest.main()


def test_gemini_key_header_parsing():
    from gemini_key import key_from_header, check_key
    assert key_from_header(None) is None
    assert key_from_header("short") is None
    assert key_from_header("  AIzaFakeKey1234567890  ") == "AIzaFakeKey1234567890"
    assert check_key(None)["valid"] is False


def test_gemini_check_endpoint_never_echoes_key():
    from fastapi.testclient import TestClient
    import main
    r = TestClient(main.app).post("/api/gemini/check", headers={"X-Gemini-Key": "AIzaFakeKey1234567890"})
    assert r.status_code == 200
    assert "AIzaFakeKey1234567890" not in r.text


def test_classifier_eval_numbers_match_site_claims():
    """The landing page quotes ~97% precision / ~65% recall on the synthetic set; keep that honest."""
    from eval_classifier import evaluate
    r = evaluate()
    assert r["n"] == 60
    assert round(r["precision"] * 100, 1) == 96.9
    assert round(r["recall"] * 100, 1) == 64.6


def _fake_gemini(monkeypatch, payload, counter):
    import gemini_classifier as g
    g._cache.clear(); g._recent.clear(); g._total_calls = 0
    def fake_call(text, key):
        counter.append(key)
        return (payload, None) if payload is not None else (None, "http_429")
    monkeypatch.setattr(g, "_call", fake_call)
    return g


def test_gemini_not_called_without_key_or_when_lexicon_is_confident(monkeypatch):
    calls = []
    g = _fake_gemini(monkeypatch, {"category": "DRUGS", "confidence": 0.9, "reason": "x", "slang": []}, calls)
    assert g.hybrid_classify("snow milega kya", None)["ai"]["assisted"] is False
    assert g.hybrid_classify("Pure white available 5g", "AIzaFakeKey1234567890")["ai"]["assisted"] is False
    assert calls == []


def test_gemini_fills_lexicon_gap_and_falls_back(monkeypatch):
    calls = []
    g = _fake_gemini(monkeypatch, {"category": "DRUGS", "confidence": 0.9, "reason": "coded drug sale", "slang": ["snow"]}, calls)
    r = g.hybrid_classify("snow milega kya, ek gram", "AIzaFakeKey1234567890")
    assert r["categories"] == ["DRUGS"] and r["ai"]["assisted"] and calls == ["AIzaFakeKey1234567890"]
    g.hybrid_classify("snow milega kya, ek gram", "AIzaFakeKey1234567890")  # cached
    assert len(calls) == 1
    g2 = _fake_gemini(monkeypatch, None, [])
    assert g2.hybrid_classify("hello friends", "AIzaFakeKey1234567890")["categories"] == []


def test_gemini_ignores_garbage_and_none(monkeypatch):
    g = _fake_gemini(monkeypatch, {"category": "NONE", "confidence": 0.99, "reason": "", "slang": []}, [])
    assert g.hybrid_classify("Happy Diwali", "AIzaFakeKey1234567890")["ai"]["assisted"] is False
    assert g._clean({"category": "HACKED", "confidence": 1}) is None
    assert g._clean({"category": "ARMS", "confidence": "abc"}) is None


def test_gemini_budget_cap(monkeypatch):
    g = _fake_gemini(monkeypatch, {"category": "ARMS", "confidence": 0.9, "reason": "", "slang": []}, [])
    monkeypatch.setattr(g, "MAX_TOTAL_CALLS", 1)
    assert g.hybrid_classify("kuch aur aa gaya hai A", "AIzaFakeKey1234567890")["ai"]["assisted"]
    assert not g.hybrid_classify("kuch aur aa gaya hai B", "AIzaFakeKey1234567890")["ai"]["assisted"]


def test_scan_endpoint_marks_ai_assisted(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    g = _fake_gemini(monkeypatch, {"category": "DRUGS", "confidence": 0.9, "reason": "coded", "slang": ["snow"]}, [])
    c = TestClient(main.app)
    r = c.post("/api/scan/text", json={"text": "snow milega kya zzq"}, headers={"X-Gemini-Key": "AIzaFakeKey1234567890"}).json()
    assert r["aiAssisted"] is True and r["categories"] == ["DRUGS"] and "AIza" not in str(r)
    r2 = c.post("/api/scan/text", json={"text": "snow milega kya zzr"}).json()
    assert r2["aiAssisted"] is False and r2["categories"] == []


def test_gemini_http_path_with_model_discovery(monkeypatch):
    """Exercise the real HTTP code against a local fake Gemini, including 404 -> model discovery."""
    import json, threading
    from http.server import BaseHTTPRequestHandler, HTTPServer
    import gemini_classifier as g
    seen = {"keys": [], "paths": []}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def _send(self, code, obj):
            b = json.dumps(obj).encode(); self.send_response(code)
            self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
            self.end_headers(); self.wfile.write(b)
        def do_GET(self):
            seen["keys"].append(self.headers.get("x-goog-api-key")); seen["paths"].append(self.path)
            self._send(200, {"models": [{"name": "models/gemini-test-flash", "supportedGenerationMethods": ["generateContent"]}]})
        def do_POST(self):
            seen["keys"].append(self.headers.get("x-goog-api-key")); seen["paths"].append(self.path)
            self.rfile.read(int(self.headers["Content-Length"]))
            if "gemini-test-flash" not in self.path:
                return self._send(404, {"error": "nope"})
            inner = {"category": "DRUGS", "confidence": 0.91, "reason": "coded drug sale", "slang": ["snow"]}
            self._send(200, {"candidates": [{"content": {"parts": [{"text": json.dumps(inner)}]}}]})

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        monkeypatch.setattr(g, "API_ROOT", f"http://127.0.0.1:{srv.server_port}/v1beta")
        monkeypatch.setattr(g, "_resolved_model", None)
        g._cache.clear(); g._recent.clear(); g._total_calls = 0
        r = g.hybrid_classify("snow milega kya, ek gram", "AIzaFakeKey1234567890")
        assert r["categories"] == ["DRUGS"] and r["ai"]["assisted"] and r["ai"]["model"] == "gemini-test-flash"
        assert set(seen["keys"]) == {"AIzaFakeKey1234567890"}          # key only in header
        assert not any("AIza" in p for p in seen["paths"])             # never in the URL
    finally:
        srv.shutdown()


def test_gemini_status_explains_outcome(monkeypatch):
    g = _fake_gemini(monkeypatch, None, [])
    assert g.hybrid_classify("random words here", None)["ai"]["status"] == "no_key"
    assert g.hybrid_classify("Pure white available 5g", "AIzaFakeKey1234567890")["ai"]["status"] == "lexicon_confident"
    assert g.hybrid_classify("kuch naya aa gaya", "AIzaFakeKey1234567890")["ai"]["status"] == "http_429"
    g2 = _fake_gemini(monkeypatch, {"category": "NONE", "confidence": 0.9, "reason": "benign", "slang": []}, [])
    assert g2.hybrid_classify("Happy Diwali friends", "AIzaFakeKey1234567890")["ai"]["status"] == "ai_says_none"


def test_gemini_check_runs_real_generation(monkeypatch):
    from fastapi.testclient import TestClient
    import main, gemini_key
    g = _fake_gemini(monkeypatch, {"category": "DRUGS", "confidence": 0.9, "reason": "r", "slang": ["snow"]}, [])
    monkeypatch.setattr(main, "check_key", lambda k: {"valid": True, "reason": "ok"})
    r = TestClient(main.app).post("/api/gemini/check", headers={"X-Gemini-Key": "AIzaFakeKey1234567890"}).json()
    assert r["generation"]["ok"] is True and r["generation"]["sample"] == "DRUGS"
    assert "AIza" not in str(r)


def test_gemini_model_fallback_reports_tried_and_available(monkeypatch):
    """Default names 404, key can only use another model: we must find it and report what we tried when none work."""
    import json, threading
    from http.server import BaseHTTPRequestHandler, HTTPServer
    import gemini_classifier as g
    usable = {"name": "gemini-3-flash"}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def _send(self, code, obj):
            b = json.dumps(obj).encode(); self.send_response(code)
            self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
            self.end_headers(); self.wfile.write(b)
        def do_GET(self):
            self._send(200, {"models": [
                {"name": "models/gemini-3-flash-image", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-3-pro", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-3-flash", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/embed-1", "supportedGenerationMethods": ["embedContent"]}]})
        def do_POST(self):
            self.rfile.read(int(self.headers["Content-Length"]))
            if usable["name"] and self.path.endswith(f"/{usable['name']}:generateContent"):
                inner = {"category": "DRUGS", "confidence": 0.9, "reason": "r", "slang": []}
                return self._send(200, {"candidates": [{"content": {"parts": [{"text": json.dumps(inner)}]}}]})
            self._send(404, {"error": "nope"})

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        monkeypatch.setattr(g, "API_ROOT", f"http://127.0.0.1:{srv.server_port}/v1beta")
        for reset in (None,):
            monkeypatch.setattr(g, "_resolved_model", None)
        g._cache.clear(); g._recent.clear(); g._total_calls = 0
        res = g.self_test("AIzaFakeKey1234567890")
        assert res["ok"] and res["model"] == "gemini-3-flash"      # flash ranked above image/pro variants
        usable["name"] = None                                      # now nothing works
        monkeypatch.setattr(g, "_resolved_model", None); g._recent.clear()
        res = g.self_test("AIzaFakeKey1234567890")
        assert not res["ok"] and res["status"] == "http_404"
        assert "gemini-3-flash" in res["tried"] and "gemini-3-flash" in res["available"] and "embed-1" not in res["available"]
    finally:
        srv.shutdown()
