# Operations: alarms and what to do

This page covers what alerts when the public site or its data stops being
current, and what to do about each alarm. For the pull-request gate, see
`docs/CI.md`. For releases and rollback, see `docs/RELEASE.md`.

## Alarms

| alarm | raised by | condition | closed by |
| --- | --- | --- | --- |
| `live-bytes` issue (this repository) | the `live-bytes` job of `.github/workflows/202608301321-verify-live.yml` | After a push to main, or a dispatch that compares `main`, the public Pages site does not serve the committed bytes. The check covers `atlas/current.json`, `atlas/index.html`, every file `current.json` references and every `atlas/v/<gen>/` file, and allows 20 min for Pages/CDN lag. | the next passing check |
| `collector-stale` issue (Ventusltd/lightning) | the hourly collector, the data verifier and the collector watchdog | No collector heartbeat for 3 h, which is `late_after_utc` plus 90 min. Also raised after 3 failed collector runs in a row, for example when the EUMETSAT credentials are rejected. | the next healthy check |
| `feed-delivery` issue (Ventusltd/lightning) | the collector watchdog | `raw.githubusercontent.com/Ventusltd/lightning/main/data/...`, which the lightning overlay reads, is failing or more than an hour behind main. | the next passing probe |

Each alarm keeps **one** open issue per label. While a fault lasts, the issue
body is refreshed in place, which sends no notification. A comment is added
only when something new happens; for `live-bytes`, that means a new commit
that is still failing. The lightning alarms are documented in that
repository's `docs/OPERATIONS.md`.

## The `live-bytes` issue

### How it is raised

The step "Open, refresh or close the live-bytes issue" is in the existing
`live-bytes` job. No workflow was added, so the active-workflow budget in
`tools/scope/lib.mjs` and `STATE.md` is unchanged. The step runs
`tools/ci/live-bytes-issue.mjs` with the outcome of the step "Prove the public
site serves the committed bytes" and with `work/live-bytes.json`:

| outcome | issue |
| --- | --- |
| `failure` | It is opened, or refreshed. The body lists matched/checked paths, problems and up to 30 mismatches, and links the run. |
| `success` | Any open issue is closed, with a comment. |
| `superseded` (main moved during the check), `skipped`, `cancelled` | It is left alone; the newer run decides. |

- A dispatch that compares a ref other than `main` is an ad-hoc check, so it
  never touches the issue.
- The step has `continue-on-error`, so the job's red or green result is still
  the live-bytes verdict.
- Only this job has `issues: write`.

### What to do

1. Open the run linked in the issue and read its summary.
   - Each `MISMATCH` line names the path, the HTTP status, and the committed
     and live sizes.
   - The `gridatlas-live-bytes-<run>` artifact holds `live-bytes.json`.
2. **Pages did not deploy.** Every path is stale, or `atlas/current.json`
   still shows the previous generation.
   - Check **Actions → pages-build-deployment** for a failed or queued build.
     Re-run it, or push an empty commit.
   - Then dispatch **202608301321 Build, deploy and verify modular GridAtlas
     v9.5** with `mode=live-bytes`.
3. **One or a few paths differ.**
   - A file over the Pages size limit, a path that Jekyll ignores (`_` or `.`
     prefix without `.nojekyll`), or a CRLF/LF difference all show up this way.
   - Fix it in a PR. The PR gate's loader-identity and generation checks catch
     most of these before merge.
4. **The live site is wrong and main is right**, but Pages will not converge.
   Roll back with `docs/RELEASE.md` ("route C").
5. Close nothing by hand unless the alarm was wrong. The next passing check
   closes the issue and records the evidence.

### Checks without the network

```sh
node tools/ci/live-bytes-issue.mjs --self-test
```

The self-test drives the open, refresh, comment-on-new-commit, leave-alone
and close paths, and the closing of raced duplicates, against an in-memory
fake of the GitHub API.
