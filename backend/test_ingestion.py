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


if __name__ == "__main__":
    unittest.main()
