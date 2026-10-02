"""Offline /subscribe regressions. Stdlib only; no real contacts or API calls.

Run: python3 -B -m unittest discover -s tests -p 'test_subscribe.py' -v
"""
import concurrent.futures
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import urllib.error


SITE_ROOT = Path(os.environ.get("SITE_ROOT", Path(__file__).resolve().parents[1]))
SOURCE = SITE_ROOT / "concierge-server" / "server.py"
if not SOURCE.exists():  # Allow testing the isolated authoring draft.
    SOURCE = Path(__file__).with_name("server.py")
with tempfile.TemporaryDirectory() as import_data:
    # Do not load real environment keys or touch the app's data directory.
    with patch.dict(os.environ, {"CONCIERGE_DATA_DIR": import_data}, clear=True):
        spec = importlib.util.spec_from_file_location("subscribe_backend", SOURCE)
        backend = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(backend)


class Response:
    def __init__(self, data, status=200, raw=None):
        self.status = status
        self.body = raw if raw is not None else json.dumps({"data": data}).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, size=-1):
        return self.body if size < 0 else self.body[:size]


class SubscribeTests(unittest.TestCase):
    EMAIL = "test.person+asset@example.invalid"
    SNAPSHOT = "funnel=2call; biz=insurance; lead_type=veteran; leads=100; pickups=60; booked=30; showed=20; closes=10; spend=1000; premium=1200; cost_per_policy=100.00; lead_close_rate=10.0%"

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.journal = Path(self.temp.name) / "subscribe-requests.jsonl"
        self.addCleanup(patch.stopall)
        patch.object(backend, "SUBSCRIBE_FILE", str(self.journal)).start()
        patch.dict(backend.CFG, {"mailerlite_api_key": "offline-test-key", "newsletter_group_id": ""}).start()
        self.provider = patch.object(backend.urllib.request, "urlopen", side_effect=AssertionError("unexpected provider access")).start()

    def payload(self, **changes):
        result = {"email": self.EMAIL, "name": "Test Person", "source": "playbook", "fields": {}}
        result.update(changes)
        return result

    def consent_payload(self, **changes):
        return self.payload(newsletter_consent=True, consent_version=backend.NEWSLETTER_CONSENT_VERSION, **changes)

    def events(self):
        return [json.loads(line) for line in self.journal.read_text().splitlines()] if self.journal.exists() else []

    def handle(self, payload, headers=None):
        handler = object.__new__(backend.Handler)
        handler.headers = headers or {"Origin": backend.CORS_ALLOW[0], "Referer": backend.CORS_ALLOW[0] + "/free-playbook?email=private#fragment"}
        responses = []
        handler._json = lambda status, data: responses.append((status, data))
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            handler._handle_subscribe(payload, "192.0.2.10")
        for sensitive in (self.EMAIL, "Test Person", "funnel=", "offline-test-key"):
            self.assertNotIn(sensitive, stdout.getvalue())
        self.assertEqual(len(responses), 1)
        return responses[0]

    def provider_success(self, source="playbook", new=False, returned_status="active"):
        group = backend.MAILERLITE_GROUPS[source]

        def request(req, **kwargs):
            if req.get_method() == "GET":
                if new:
                    raise urllib.error.HTTPError(req.full_url, 404, "Not found", None, None)
                return Response({"id": "777", "status": "active", "groups": [{"id": "legacy-unrelated"}]})
            if req.full_url == backend.MAILERLITE_SUBSCRIBERS_URL:
                return Response({"id": "777", "status": returned_status, "groups": [{"id": group}, {"id": "legacy-unrelated"}]}, 201 if new else 200)
            return Response({"id": backend.CFG["newsletter_group_id"]}, 201)

        self.provider.side_effect = request

    def assert_captured(self, data):
        self.assertTrue(data["ok"])
        self.assertEqual(data["delivery"], {"status": "captured", "email_sent": False})

    def test_omitted_and_false_consent_do_not_add_newsletter_group(self):
        backend.CFG["newsletter_group_id"] = "999"
        for consent in (None, False):
            with self.subTest(consent=consent):
                self.provider.reset_mock()
                self.provider_success()
                payload = self.payload() if consent is None else self.payload(newsletter_consent=consent)
                status, data = self.handle(payload)
                self.assertEqual(status, 200)
                self.assert_captured(data)
                self.assertEqual(data["newsletter"], {"status": "not_requested"})
                self.assertEqual(self.provider.call_count, 2)
                self.assertFalse(self.events()[-2]["newsletter"]["requested"])
                self.assertIsNone(self.events()[-2]["newsletter"]["consent_description"])

    def test_true_requires_exact_supported_version(self):
        for version in (None, "", "v0", 1, [], {}):
            with self.subTest(version=version):
                status, _ = self.handle(self.payload(newsletter_consent=True, consent_version=version))
                self.assertEqual(status, 400)
        self.provider.assert_not_called()
        self.assertFalse(self.journal.exists())

    def test_consent_must_be_json_boolean(self):
        for consent in ("false", "true", 0, 1, None, [], {}):
            with self.subTest(consent=consent):
                self.assertEqual(self.handle(self.payload(newsletter_consent=consent))[0], 400)
        self.provider.assert_not_called()

    def test_unchecked_cannot_attach_consent_version(self):
        self.assertEqual(self.handle(self.payload(newsletter_consent=False, consent_version=backend.NEWSLETTER_CONSENT_VERSION))[0], 400)
        self.provider.assert_not_called()

    def test_invalid_email_types_and_addresses(self):
        for email in (None, 1, [], {}, "a@@example.com", "a@example", "a@-example.com", "a@ex_ample.com", "a..b@example.com", ".a@example.com", "a.@example.com", "a\nb@example.com", "a@example.com\r\nBcc:x@y.com", "a" * 65 + "@example.com", "a@" + "x" * 64 + ".com"):
            with self.subTest(email=email):
                self.assertEqual(self.handle(self.payload(email=email))[0], 400)
        self.provider.assert_not_called()

    def test_valid_addresses_and_name_source_limits(self):
        for email in ("a@example.com", self.EMAIL, "agent.o'brien@example.com"):
            self.assertIsNone(backend.validate_subscribe(self.payload(email=email))[1])
        for changes in ({"name": []}, {"name": "x" * 101}, {"name": "a\nb"}, {"name": "\ud800"}, {"source": None}, {"source": "newsletter"}, {"source": "Free Lead Ads Swipe"}):
            self.assertEqual(self.handle(self.payload(**changes))[0], 400)
        self.provider.assert_not_called()

    def test_reserved_or_arbitrary_fields_rejected(self):
        for fields in ({"name": "override"}, {"status": "active"}, {"groups": ["999"]}, {"consent_version": "v1"}, {"custom": "x"}, [], None, {"funnel_snapshot": None}):
            with self.subTest(fields=fields):
                self.assertEqual(self.handle(self.payload(fields=fields))[0], 400)
        self.provider.assert_not_called()

    def test_calculator_snapshot_is_bounded_private_and_preserved(self):
        for consent in (False, True):
            with self.subTest(consent=consent):
                self.provider.reset_mock()
                self.provider_success("calculator")
                payload = self.payload(source="calculator", fields={"funnel_snapshot": self.SNAPSHOT}, newsletter_consent=consent)
                if consent:
                    payload["consent_version"] = backend.NEWSLETTER_CONSENT_VERSION
                status, data = self.handle(payload)
                self.assertEqual(status, 200)
                self.assert_captured(data)
                request = self.events()[-2]
                self.assertEqual(request["delivery"]["fields"]["funnel_snapshot"], self.SNAPSHOT)
                self.assertTrue(request["request_id"])
                body = json.loads(self.provider.call_args_list[1].args[0].data)
                self.assertEqual(body["fields"], {"name": "Test Person"})
                self.assertNotIn("funnel_snapshot", json.dumps(body))
                self.assertNotIn(self.SNAPSHOT, json.dumps(body))

    def test_legacy_one_call_snapshot_without_hidden_counts_valid(self):
        snapshot = "funnel=1call; biz=other; leads=20; pickups=10; closes=0; spend=0; premium=100"
        entry, err = backend.validate_subscribe(self.payload(source="calculator", fields={"funnel_snapshot": snapshot}))
        self.assertIsNone(err)
        self.assertEqual(entry["fields"]["funnel_snapshot"], snapshot)

    def test_bad_calculator_snapshots_rejected(self):
        snapshots = ("x" * 2001, "", {}, "funnel=1call; biz=insurance; leads=NaN", "funnel=1call; biz=insurance; leads=inf", "funnel=1call; biz=insurance; leads=1e9", "funnel=1call; biz=insurance; leads=-1", "funnel=1call; biz=insurance; leads=1.5", "funnel=1call; biz=insurance; leads=1000000001", "funnel=1call; biz=insurance; lead_close_rate=101%", "funnel=2call; biz=insurance; leads=10; pickups=11", "funnel=1call; biz=insurance; booked=1", "funnel=1call; biz=insurance; name=intrusion", "funnel=1call; biz=insurance; leads=10; leads=20", "funnel=3call; biz=insurance", "funnel=1call; biz=unknown", "funnel=1call; biz=insurance; lead_type=unknown", "funnel=1call", "funnel=1call; biz=insurance;")
        for snapshot in snapshots:
            with self.subTest(snapshot=snapshot):
                self.assertEqual(self.handle(self.payload(source="calculator", fields={"funnel_snapshot": snapshot}))[0], 400)
        self.assertEqual(self.handle(self.payload(fields={"funnel_snapshot": self.SNAPSHOT}))[0], 400)
        self.provider.assert_not_called()

    def test_newsletter_unconfigured_keeps_asset_request_successful(self):
        self.provider_success()
        status, data = self.handle(self.consent_payload())
        self.assertEqual(status, 200)
        self.assert_captured(data)
        self.assertEqual(data["newsletter"], {"status": "pending", "reason": "not_configured"})
        record = self.events()[0]
        self.assertEqual(record["newsletter"]["consent_version"], backend.NEWSLETTER_CONSENT_VERSION)
        self.assertEqual(record["newsletter"]["consent_label"], backend.NEWSLETTER_CONSENT_LABEL)
        self.assertEqual(record["newsletter"]["consent_description"], backend.NEWSLETTER_CONSENT_DESCRIPTION)
        self.assertEqual(record["newsletter"]["cadence"], "occasional")
        self.assertEqual(record["origin"], backend.CORS_ALLOW[0])
        self.assertEqual(record["page_path"], "/free-playbook")
        self.assertNotIn("private", json.dumps(record))
        self.assertEqual(self.provider.call_count, 2)

    def test_missing_api_key_still_captures_request(self):
        backend.CFG["mailerlite_api_key"] = ""
        status, data = self.handle(self.consent_payload())
        self.assertEqual(status, 200)
        self.assert_captured(data)
        self.assertEqual(data["newsletter"]["status"], "pending")
        self.assertEqual(len(self.events()), 2)
        self.provider.assert_not_called()

    def test_request_fsync_precedes_every_provider_call(self):
        calls = []
        real_fsync = backend.os.fsync
        def fsync(fd):
            calls.append("directory_fsync" if stat.S_ISDIR(os.fstat(fd).st_mode) else "file_fsync")
            real_fsync(fd)
        def provider(*args, **kwargs):
            self.assertEqual(calls[:2], ["file_fsync", "directory_fsync"])
            self.assertEqual(self.events()[0]["event"], "request")
            calls.append("provider")
            raise TimeoutError("offline failure")
        self.provider.side_effect = provider
        with patch.object(backend.os, "fsync", side_effect=fsync):
            status, data = self.handle(self.consent_payload())
        self.assertEqual(status, 200)
        self.assertEqual(data["newsletter"]["reason"], "provider_error")

    def test_initial_journal_failure_blocks_all_provider_calls(self):
        with patch.object(backend, "append_subscribe_event", side_effect=OSError("disk full")):
            status, data = self.handle(self.consent_payload())
        self.assertEqual(status, 503)
        self.assertEqual(data, {"error": "capture_unavailable"})
        self.provider.assert_not_called()

    def test_initial_fsync_failure_blocks_all_provider_calls(self):
        with patch.object(backend.os, "fsync", side_effect=OSError("sync failed")):
            self.assertEqual(self.handle(self.consent_payload())[0], 503)
        self.provider.assert_not_called()

    def test_directory_fsync_failure_blocks_all_provider_calls(self):
        real_fsync = backend.os.fsync
        def fail_directory(fd):
            if stat.S_ISDIR(os.fstat(fd).st_mode):
                raise OSError("directory sync failed")
            return real_fsync(fd)
        with patch.object(backend.os, "fsync", side_effect=fail_directory):
            self.assertEqual(self.handle(self.consent_payload())[0], 503)
        self.assertEqual(self.events(), [])
        self.provider.assert_not_called()

    def test_outcome_failure_does_not_falsely_acknowledge(self):
        self.provider_success()
        append = backend.append_subscribe_event
        def fail_outcome(entry):
            if entry["event"] == "outcome":
                raise OSError("disk full")
            append(entry)
        with patch.object(backend, "append_subscribe_event", side_effect=fail_outcome):
            self.assertEqual(self.handle(self.consent_payload())[0], 503)
        self.assertEqual(len(self.events()), 1)
        self.assertEqual(self.events()[0]["event"], "request")

    def test_only_confirmed_404_allows_new_contact_create(self):
        self.provider_success(new=True)
        status, _ = self.handle(self.payload())
        self.assertEqual(status, 200)
        self.assertEqual([c.args[0].get_method() for c in self.provider.call_args_list], ["GET", "POST"])
        for code in (401, 403, 422, 429, 500):
            with self.subTest(code=code):
                self.provider.reset_mock()
                self.provider.side_effect = urllib.error.HTTPError("https://offline.invalid", code, "offline", None, None)
                status, data = self.handle(self.consent_payload())
                self.assertEqual(status, 200)
                self.assertEqual(data["newsletter"]["reason"], "provider_error")
                self.assertEqual(self.provider.call_count, 1)

    def test_all_suppressed_and_unconfirmed_contacts_unchanged(self):
        backend.CFG["newsletter_group_id"] = "999"
        for provider_status in ("unsubscribed", "bounced", "junk", "unconfirmed"):
            with self.subTest(provider_status=provider_status):
                self.provider.reset_mock()
                self.provider.side_effect = lambda *a, **k: Response({"id": "777", "status": provider_status})
                status, data = self.handle(self.consent_payload())
                self.assertEqual(status, 200)
                self.assertEqual(data["newsletter"], {"status": "pending", "reason": "suppressed"})
                self.assertEqual(self.provider.call_count, 1)
                self.assertEqual(self.provider.call_args.args[0].get_method(), "GET")

    def test_unknown_missing_or_malformed_provider_state_never_upserts(self):
        for response in (Response({"id": "777", "status": "unknown"}), Response({"id": "777", "status": []}), Response({"id": "777", "status": {}}), Response({"id": "777"}), Response(None), Response({}, raw=b"not json"), Response({}, raw=b"{}"), Response({}, raw=b"x" * 131073)):
            with self.subTest(response=response):
                self.provider.reset_mock()
                self.provider.side_effect = lambda *a, **k: response
                status, data = self.handle(self.consent_payload())
                self.assertEqual(status, 200)
                self.assertEqual(data["newsletter"]["reason"], "provider_error")
                self.assertEqual(self.provider.call_count, 1)

    def test_purpose_specific_groups_and_no_reactivation_parameters(self):
        backend.CFG["newsletter_group_id"] = "999"
        for source in backend.MAILERLITE_GROUPS:
            with self.subTest(source=source):
                self.provider.reset_mock()
                self.provider_success(source)
                status, data = self.handle(self.consent_payload(source=source))
                self.assertEqual(status, 200)
                self.assertEqual(data["newsletter"], {"status": "subscribed"})
                asset = self.provider.call_args_list[1].args[0]
                body = json.loads(asset.data)
                self.assertEqual(set(body), {"email", "fields", "groups"})
                self.assertEqual(body["groups"], [backend.MAILERLITE_GROUPS[source]])
                newsletter = self.provider.call_args_list[2].args[0]
                self.assertEqual(newsletter.full_url, backend.MAILERLITE_SUBSCRIBERS_URL + "/777/groups/999")
                self.assertIsNone(newsletter.data)

    def test_asset_group_cannot_double_as_newsletter_group(self):
        for group in list(backend.MAILERLITE_GROUPS.values()) + ["invalid", "x" * 40]:
            with self.subTest(group=group):
                self.provider.reset_mock()
                backend.CFG["newsletter_group_id"] = group
                self.provider_success()
                status, data = self.handle(self.consent_payload())
                self.assertEqual(status, 200)
                self.assertEqual(data["newsletter"], {"status": "pending", "reason": "not_configured"})
                self.assertEqual(self.provider.call_count, 2)

    def test_returned_suppression_does_not_enroll_newsletter(self):
        backend.CFG["newsletter_group_id"] = "999"
        self.provider_success(returned_status="unsubscribed")
        status, data = self.handle(self.consent_payload())
        self.assertEqual(status, 200)
        self.assertEqual(data["newsletter"]["reason"], "suppressed")
        self.assertEqual(self.provider.call_count, 2)

    def test_newsletter_failed_or_wrong_group_not_claimed_subscribed(self):
        backend.CFG["newsletter_group_id"] = "999"
        for last in (TimeoutError("offline"), Response({"id": "different"})):
            with self.subTest(last=last):
                self.provider.reset_mock()
                self.provider.side_effect = [Response({"id": "777", "status": "active"}), Response({"id": "777", "status": "active", "groups": [{"id": backend.MAILERLITE_GROUPS["playbook"]}]}), last]
                status, data = self.handle(self.consent_payload())
                self.assertEqual(status, 200)
                self.assertEqual(data["newsletter"], {"status": "pending", "reason": "provider_error"})

    def test_asset_response_must_confirm_group_and_active_status(self):
        for result in ({"id": "777", "status": "active", "groups": []}, {"id": "bad-id", "status": "active"}, {"id": "777", "status": "unknown"}, {"id": "777", "status": []}, {"id": "777", "status": {}}):
            self.provider.reset_mock()
            self.provider.side_effect = [Response({"id": "777", "status": "active"}), Response(result)]
            status, data = self.handle(self.consent_payload())
            self.assertEqual(status, 200)
            self.assertEqual(data["newsletter"]["reason"], "provider_error")
            self.assertEqual(self.provider.call_count, 2)

    def test_safe_path_origin_and_malformed_referer(self):
        backend.CFG["mailerlite_api_key"] = ""
        for headers in ({"Origin": "https://untrusted.invalid", "Referer": "https://untrusted.invalid/private"}, {"Referer": "https://[bad"}, {"Origin": backend.CORS_ALLOW[0], "Referer": backend.CORS_ALLOW[0] + "/bad%0Apath"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.handle(self.payload(), headers)[0], 200)
                self.assertEqual(self.events()[-2]["page_path"], "")
                self.assertIn(self.events()[-2]["origin"], ("", backend.CORS_ALLOW[0]))

    def test_client_page_retained_with_allowed_origin_and_origin_only_referrer(self):
        backend.CFG["mailerlite_api_key"] = ""
        page = "/blog/insurance-lead-follow-up-speed"
        headers = {"Origin": backend.CORS_ALLOW[0], "Referer": backend.CORS_ALLOW[0] + "/"}
        self.assertEqual(self.handle(self.payload(page=page), headers)[0], 200)
        self.assertEqual(self.events()[-2]["page_path"], page)
        self.assertEqual(self.events()[-2]["page_path_source"], "client")

    def test_unsafe_client_page_uses_safe_referrer_or_empty(self):
        backend.CFG["mailerlite_api_key"] = ""
        bad_pages = ("/blog?email=private", "/blog#private", "https://untrusted.invalid/blog", "//untrusted.invalid/blog", "/bad\npath", "/bad\x00path", "/blog\\private", "/../private", "/./private", "/" + "x" * 240, None, [], {})
        for page in bad_pages:
            for referrer in (backend.CORS_ALLOW[0] + "/free-playbook?secret=private", backend.CORS_ALLOW[0]):
                with self.subTest(page=page, referrer=referrer):
                    headers = {"Origin": backend.CORS_ALLOW[0], "Referer": referrer}
                    self.assertEqual(self.handle(self.payload(page=page), headers)[0], 200)
                    record = self.events()[-2]
                    expected = "/free-playbook" if "/free-playbook" in referrer else ""
                    self.assertEqual(record["page_path"], expected)
                    self.assertEqual(record["page_path_source"], "referer" if expected else None)
                    self.assertNotIn("private", json.dumps(record))

    def test_client_page_requires_allowed_origin_and_missing_page_is_compatible(self):
        backend.CFG["mailerlite_api_key"] = ""
        for headers in ({"Referer": backend.CORS_ALLOW[0] + "/free-playbook"}, {"Origin": "https://untrusted.invalid", "Referer": backend.CORS_ALLOW[0] + "/free-playbook"}):
            self.assertEqual(self.handle(self.payload(page="/blog/insurance-lead-follow-up-speed"), headers)[0], 200)
            self.assertEqual(self.events()[-2]["page_path"], "/free-playbook")
            self.assertEqual(self.events()[-2]["page_path_source"], "referer")
        self.assertEqual(self.handle(self.payload())[0], 200)
        self.assertEqual(self.events()[-2]["page_path"], "/free-playbook")
        self.assertEqual(self.events()[-2]["page_path_source"], "referer")

    def test_private_permissions_and_concurrent_integral_lines(self):
        # Direct journal calls use no provider and expose no PII in the test output.
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda n: backend.append_subscribe_event({"event": "request", "request_id": str(n), "text": "x" * 1000}), range(40)))
        events = self.events()
        self.assertEqual(len(events), 40)
        self.assertEqual({e["request_id"] for e in events}, {str(n) for n in range(40)})
        self.assertEqual(stat.S_IMODE(self.journal.stat().st_mode), 0o600)
        self.provider.assert_not_called()

    def test_partial_write_failure_rolls_back_before_next_append(self):
        backend.append_subscribe_event({"event": "request", "request_id": "kept"})
        real_write = backend.os.write
        writes = []
        def partial_write(fd, data):
            writes.append(True)
            if len(writes) == 1:
                return real_write(fd, data[:12])
            raise OSError("interrupted append")
        with patch.object(backend.os, "write", side_effect=partial_write):
            with self.assertRaises(OSError):
                backend.append_subscribe_event({"event": "request", "request_id": "failed"})
        backend.append_subscribe_event({"event": "request", "request_id": "next"})
        self.assertEqual([e["request_id"] for e in self.events()], ["kept", "next"])
        self.provider.assert_not_called()

    def test_torn_final_record_recovered_after_interruption(self):
        self.journal.write_bytes(b'{"event":"request","request_id":"kept"}\n{"event":"reque')
        backend.append_subscribe_event({"event": "request", "request_id": "next"})
        self.assertEqual([e["request_id"] for e in self.events()], ["kept", "next"])
        self.assertEqual(stat.S_IMODE(self.journal.stat().st_mode), 0o600)
        self.provider.assert_not_called()


if __name__ == "__main__":
    unittest.main()
