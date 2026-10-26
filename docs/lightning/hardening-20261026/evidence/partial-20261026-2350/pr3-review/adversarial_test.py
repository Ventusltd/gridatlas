"""pr3-review adversarial tests for Ventusltd/lightning PR #3 (head d4caf9e).

Harness: self-fixture. Real 408-flash archive rebuilt in temp dirs from the
committed feed (same as tests/test_parquet_store.py); synthetic TEST- ids only
in temp dirs, built with synthetic=True. Nothing is written into the worktree.

Each test asserts the CORRECT behaviour; a failing test is a finding.
Run: WT=<worktree> python3 -m unittest adversarial_test -v   (from this folder)
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

WT = Path(os.environ["WT"]).resolve()
sys.path.insert(0, str(WT))
sys.path.insert(0, str(WT / "tests"))

import duckdb  # noqa: E402
import pyarrow.parquet as pq  # noqa: E402

import history  # noqa: E402
import parquet_store as ps  # noqa: E402
import rollups  # noqa: E402
import verify_parquet as vp  # noqa: E402
from collect import build_feature  # noqa: E402
from test_parquet_store import NOW, real_archive, refresh_manifest, rewrite  # noqa: E402


def tree_bytes(root: Path) -> dict:
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}


class Real(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.dir = Path(cls.temp.name)
        cls.archive = real_archive(cls.dir)
        cls.store = cls.dir / "parquet"
        ps.build(cls.archive, cls.store, run_id="adv-1")
        vp.verify(cls.archive, cls.store)  # sanity: untampered store passes

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def copy(self) -> Path:
        target = Path(tempfile.mkdtemp(dir=self.dir)) / "parquet"
        shutil.copytree(self.store, target)
        return target

    def assert_verify_fails(self, store: Path):
        with self.assertRaises((vp.VerifyError, ValueError)):
            vp.verify(self.archive, store)

    # ---- determinism -------------------------------------------------
    def test_D1_two_fresh_builds_byte_identical(self):
        a = Path(tempfile.mkdtemp(dir=self.dir)) / "p"
        b = Path(tempfile.mkdtemp(dir=self.dir)) / "p"
        ps.build(self.archive, a, run_id="same")
        ps.build(self.archive, b, run_id="same")
        self.assertEqual(tree_bytes(a), tree_bytes(b))

    def test_D2_fresh_builds_in_other_process_timezones_byte_identical(self):
        outs = {}
        for tz in ("UTC", "Europe/London", "America/New_York", "Asia/Kolkata"):
            out = Path(tempfile.mkdtemp(dir=self.dir)) / "p"
            env = dict(os.environ, TZ=tz, PYTHONHASHSEED="random")
            subprocess.run([sys.executable, str(WT / "parquet_store.py"), "build", "--archive-dir", str(self.archive),
                            "--out", str(out), "--run-id", "same"], cwd=str(WT), env=env, check=True,
                           capture_output=True)
            outs[tz] = tree_bytes(out)
        base = outs.pop("UTC")
        for tz, got in outs.items():
            self.assertEqual(got, base, tz)

    # ---- timezone of the persisted DuckDB file -------------------------
    def test_T1_duckdb_file_reopened_in_local_timezone_keeps_utc_days(self):
        out = Path(tempfile.mkdtemp(dir=self.dir)) / "lightning.duckdb"
        rollups.main(["duckdb", "--store", str(self.store), "--out", str(out)])
        expect = {r["date"]: r["flash_count"] for r in pq.read_table(self.store / "rollups/daily.parquet").to_pylist()}
        bad = {}
        for tz in ("Europe/London", "America/New_York", "Asia/Kolkata"):
            con = duckdb.connect(str(out), read_only=True)
            con.execute(f"SET TimeZone = '{tz}'")  # what a fresh session on a non-UTC host starts with
            got = dict(con.execute("SELECT date, flash_count FROM daily_optical_flashes").fetchall())
            con.close()
            diff = {d: (expect[d], got.get(d)) for d in expect if expect[d] != got.get(d)}
            if diff:
                bad[tz] = diff
        self.assertEqual(bad, {}, "daily view buckets by the session time zone, not UTC")

    def test_T2_default_session_timezone_of_duckdb_file(self):
        out = Path(tempfile.mkdtemp(dir=self.dir)) / "lightning.duckdb"
        rollups.main(["duckdb", "--store", str(self.store), "--out", str(out)])
        code = ("import duckdb,sys; c=duckdb.connect(sys.argv[1], read_only=True);"
                "print(c.execute(\"SELECT current_setting('TimeZone')\").fetchone()[0])")
        tz = subprocess.run([sys.executable, "-c", code, str(out)], env=dict(os.environ, TZ="America/New_York"),
                            capture_output=True, text=True, check=True).stdout.strip()
        self.assertEqual(tz, "UTC", "a reopened lightning.duckdb does not pin the session to UTC")

    # ---- verifier gaps: product and builder drift together ---------------
    def test_V1_unsearched_hour_relabelled_observed_zero(self):
        store = self.copy()
        days = {d["date"]: d for d in pq.read_table(store / "coverage/days.parquet").to_pylist()}
        target = None
        for f in sorted(store.glob("rollups/hourly/*/*/*.parquet")):
            rows = pq.read_table(f).to_pylist()
            for r in rows:
                if r["coverage"] == "none" and days[r["date"]]["count_state"] == "observed":
                    target = (f, r["hour_utc"])
                    break
            if target:
                break
        self.assertIsNotNone(target, "fixture: need an UNKNOWN hour inside a searched day")

        def mutate(rows):
            r = next(x for x in rows if x["hour_utc"] == target[1])
            r.update(coverage="full", count_state="observed", hours_observed=1.0, scanned_seconds=3600,
                     basis="scan_window", flash_count=0)
        rewrite(target[0], mutate)
        refresh_manifest(store)
        self.assert_verify_fails(store)

    def test_V2_unsearched_slot_relabelled_full_zero(self):
        store = self.copy()
        f = sorted(store.glob("coverage/slots/*/*/*.parquet"))[-1]

        def mutate(rows):
            r = next(x for x in rows if x["coverage"] == "none")
            r.update(coverage="full", scanned_seconds=600, basis="scan_window", flash_count=0)
        rewrite(f, mutate)
        refresh_manifest(store)
        self.assert_verify_fails(store)

    def test_V3_daily_rollup_hours_inflated(self):
        store = self.copy()

        def mutate(rows):
            r = next(x for x in rows if x["coverage"] == "partial")
            r.update(hours_observed=24.0, scanned_seconds=86400)
        rewrite(store / "rollups/daily.parquet", mutate)
        refresh_manifest(store)
        self.assert_verify_fails(store)

    def test_V4_headline_claims_complete_coverage(self):
        store = self.copy()
        path = store / "rollups/headline.json"
        head = json.loads(path.read_text())
        self.assertEqual(head["archive"]["count_state"], "lower_bound_partial_coverage")
        head["archive"]["count_state"] = "complete"
        head["substations"]["count_state"] = "complete"
        path.write_text(json.dumps(head, separators=(",", ":"), ensure_ascii=False) + "\n")
        refresh_manifest(store)
        self.assert_verify_fails(store)

    def test_V5_episode_edges_claimed_searched(self):
        store = self.copy()

        def mutate(rows):
            r = next(x for x in rows if x["coverage"] != "complete")
            r.update(searched_30min_before=True, searched_30min_after=True, coverage="complete")
        rewrite(store / "rollups/storm_episodes.parquet", mutate)
        refresh_manifest(store)
        self.assert_verify_fails(store)

    def test_V6_proximity_daily_hours_inflated(self):
        store = self.copy()

        def mutate(rows):
            rows[0].update(hours_observed=24.0, coverage="full")
        rewrite(store / "rollups/substation_optical_flash_proximity_daily.parquet", mutate)
        refresh_manifest(store)
        self.assert_verify_fails(store)

    # ---- semantics observations -----------------------------------------
    def test_S1_hourly_hours_sum_equals_day_hours(self):
        """Each searched day's hours_observed equals the sum of its hourly hours_observed."""
        days = {d["date"]: d for d in pq.read_table(self.store / "coverage/days.parquet").to_pylist()}
        hourly = vp.read_rows(self.store, "rollups/hourly/year=*/month=*/*.parquet")
        sums = {}
        for h in hourly:
            sums[h["date"]] = sums.get(h["date"], 0) + (h["scanned_seconds"] or 0)
        diff = {d.isoformat(): (row["scanned_seconds"], sums.get(d, 0)) for d, row in days.items()
                if row["count_state"] == "observed" and row["scanned_seconds"] != sums.get(d, 0)}
        print("\n[S1] day scanned_seconds vs sum(hourly):", diff)
        self.assertEqual(diff, {})


class Synthetic(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.dir = Path(self.temp.name)
        self.archive = self.dir / "history"

    def tearDown(self):
        self.temp.cleanup()

    def flash(self, when, i, lon=-1.5, lat=52.5):
        return build_feature(lon, lat, when, "TEST-product", i)

    def scan(self, a, b):
        return history.successful_scan(a.isoformat(), b.isoformat(), 18)

    def test_E1_episode_next_to_shard_lost_day_is_not_complete(self):
        """An episode ending 5 min before a shard_lost day must not claim its after-edge was searched."""
        lost_day = (NOW - timedelta(days=2)).replace(hour=0, minute=0, second=0, microsecond=0)
        t_before = lost_day - timedelta(minutes=5, seconds=-30)       # 23:55:30 the day before
        t_lost = lost_day + timedelta(minutes=10, seconds=30)          # inside the day that will be lost
        later = NOW - timedelta(hours=3)
        flashes = [self.flash(t_before, 1), self.flash(t_lost, 2), self.flash(later, 3)]
        history.archive_observations(self.archive, flashes, now=NOW,
                                     scanned_window=self.scan(NOW - timedelta(days=4), NOW))
        index = json.loads((self.archive / "index.json").read_text())
        row = next(r for r in index["days"] if r["date"] == lost_day.date().isoformat())
        (self.archive / row["path"]).unlink()
        row["shard_lost"] = True
        (self.archive / "index.json").write_text(json.dumps(index))
        store = self.dir / "parquet"
        ps.build(self.archive, store, run_id="r", synthetic=True)
        vp.verify(self.archive, store, allow_synthetic=True)
        eps = pq.read_table(store / "rollups/storm_episodes.parquet").to_pylist()
        first = eps[0]
        print("\n[E1] episode before lost day:", {k: first[k] for k in
              ("start_utc", "flash_count", "searched_30min_after", "coverage")})
        self.assertFalse(first["searched_30min_after"], "shard_lost time counted as searched for the episode edge")
        self.assertNotEqual(first["coverage"], "complete")

    def test_Z1_zero_searched_hours_must_not_publish_zero_proximity(self):
        """An index with no searched time: proximity counts must be UNKNOWN, not 0."""
        history.archive_observations(self.archive, [], now=NOW)
        store = self.dir / "parquet"
        ps.build(self.archive, store, run_id="r", synthetic=True)
        vp.verify(self.archive, store, allow_synthetic=True)
        rows = pq.read_table(store / "rollups/substation_optical_flash_proximity.parquet").to_pylist()
        r = rows[0]
        print("\n[Z1] first proximity row:", {k: r[k] for k in ("optical_flash_proximity_10km", "hours_observed",
                                                               "hours_expected", "count_state")})
        head = json.loads((store / "rollups/headline.json").read_text())
        print("[Z1] headline archive:", head["archive"]["flashes"], head["archive"]["hours_observed"],
              head["archive"]["count_state"])
        self.assertTrue(r["hours_observed"] == 0)
        self.assertIsNone(r["optical_flash_proximity_10km"], "0 published for an archive with 0 searched hours")


if __name__ == "__main__":
    unittest.main()
