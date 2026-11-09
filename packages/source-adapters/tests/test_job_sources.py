import json
import unittest
from hashlib import sha256
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from egypt_job_sources.sources import detail_url, page_url, parse_page, query


def jobicy_response(jobs=None, *, cursor=None, next_cursor=None):
    jobs = [] if jobs is None else jobs
    return {
        "success": True,
        "statusCode": 200,
        "jobCount": len(jobs),
        "jobs": jobs,
        "hasMore": next_cursor is not None,
        "nextCursor": next_cursor,
        "appliedFilters": {"count": 100, **({"cursor": cursor} if cursor is not None else {})},
        "apiVersion": "2.2.19",
        "lastUpdate": jobs[0]["pubDate"] if jobs else "",
    }


class EgyptSourceTests(unittest.TestCase):
    def test_country_only_and_opaque_cursor(self):
        self.assertIn("country=EG", page_url("himalayas", 2))
        self.assertEqual(page_url("jobicy"), "https://jobicy.com/api/jobs?count=100")
        cursor_url = page_url("jobicy", cursor="a+b&c")
        self.assertIn("cursor=a%2Bb%26c", cursor_url)
        self.assertEqual(parse_qs(urlsplit(cursor_url).query), {"count": ["100"], "cursor": ["a+b&c"]})
        with self.assertRaises(ValueError):
            page_url("jobicy", 2)
        with self.assertRaises(ValueError):
            page_url("jobicy", cursor=" ")
        with self.assertRaises(ValueError):
            query("jobicy", taxonomy=True, cursor="opaque")

    def test_blocked_page_is_not_zero_results(self):
        with patch("egypt_job_sources.sources.read", side_effect=RuntimeError("HTTP 403")):
            result = query("bayt")
        self.assertEqual(result["status"], "source_limited")
        self.assertNotIn("listings", result)
        with self.assertRaises(ValueError):
            parse_page("bayt", "<html>Access denied</html>", "https://www.bayt.com/en/egypt/jobs/")

    def test_more_results_require_cursor_and_keep_restrictions(self):
        with self.assertRaises(ValueError):
            payload = jobicy_response()
            payload["hasMore"] = True
            parse_page("jobicy", json.dumps(payload), page_url("jobicy"))
        result = parse_page(
            "himalayas",
            '{"jobs":[{"locationRestrictions":["Egypt"],"description":"<p>Full</p>"}],"totalCount":21}',
            "",
        )
        self.assertEqual(result["listings"][0]["locationRestrictions"], ["Egypt"])
        self.assertEqual(result["reported_total"], 21)

    def test_jobicy_preserves_full_body_and_exact_source_evidence(self):
        job = {
            "id": 123456,
            "url": "https://jobicy.com/jobs/example",
            "jobGeo": "Anywhere",
            "jobType": ["Part-Time"],
            "jobExcerpt": "A teaser",
            "jobDescription": "<p>Full <strong>original</strong> HTML.</p>",
            "pubDate": "2026-11-09T07:12:24+00:00",
        }
        first = page_url("jobicy")
        next_cursor = "opaque+a&b"
        response = json.dumps(jobicy_response([job], next_cursor=next_cursor))
        with patch("egypt_job_sources.sources.read_response", return_value=(response, first)) as read:
            result = query("jobicy")
        read.assert_called_once_with(first)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["listings"], [job])
        self.assertEqual(result["requested_url"], first)
        self.assertEqual(result["resolved_url"], first)
        self.assertEqual(result["response_sha256"], sha256(response.encode()).hexdigest())
        self.assertEqual(result["applied_filters"], {"count": 100})
        self.assertEqual(result["returned_count"], 1)
        self.assertEqual(result["returned_limit"], 100)
        self.assertIsNone(result["reported_total"])
        self.assertEqual(result["source_last_update"], job["pubDate"])
        self.assertIs(result["has_more"], True)
        self.assertEqual(result["next_cursor"], next_cursor)

        final = page_url("jobicy", cursor=next_cursor)
        response = json.dumps(jobicy_response(cursor=next_cursor))
        with patch("egypt_job_sources.sources.read_response", return_value=(response, final)) as read:
            result = query("jobicy", cursor=next_cursor)
        read.assert_called_once_with(final)
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["applied_filters"], {"count": 100, "cursor": next_cursor})
        self.assertEqual(result["listings"], [])
        self.assertIs(result["has_more"], False)
        self.assertIsNone(result["next_cursor"])

    def test_jobicy_contract_failures_do_not_become_terminal_or_empty_success(self):
        cursor = "previous+cursor"
        requested = page_url("jobicy", cursor=cursor)
        valid = jobicy_response(cursor=cursor)
        bad = (
            {**valid, "success": "true"},
            {**valid, "statusCode": 400},
            {**valid, "statusCode": 200.0},
            {**valid, "jobCount": False},
            {**valid, "jobCount": 1},
            jobicy_response([{"pubDate": "2026-11-09T07:12:24+00:00"}] * 101, cursor=cursor),
            {**valid, "jobs": "missing"},
            {**valid, "hasMore": "false"},
            {key: value for key, value in valid.items() if key != "nextCursor"},
            {**valid, "nextCursor": "contradicts-terminal"},
            {**valid, "hasMore": True, "nextCursor": ""},
            {**valid, "hasMore": True, "nextCursor": cursor},
            {**valid, "appliedFilters": {"count": 200, "cursor": cursor}},
            {**valid, "appliedFilters": {"count": 100}},
            {**valid, "appliedFilters": {"count": 100, "cursor": "different"}},
            {**valid, "appliedFilters": {"count": 100, "cursor": cursor, "geo": "usa"}},
        )
        for response in bad:
            with self.subTest(response=response), patch(
                "egypt_job_sources.sources.read_response", return_value=(json.dumps(response), requested)
            ):
                result = query("jobicy", cursor=cursor)
                self.assertEqual(result["status"], "source_limited")
                self.assertNotIn("listings", result)
                self.assertNotIn("has_more", result)

    def test_detail_cannot_fetch_credentials_or_arbitrary_hosts(self):
        for url in [
            "https://evil.test/en/egypt/jobs/example-123/",
            "https://u:p@www.bayt.com/en/egypt/jobs/example-123/",
            "https://www.bayt.com/en/egypt/jobs/example-123/?token=secret",
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                detail_url("bayt", url)


if __name__ == "__main__":
    unittest.main()
