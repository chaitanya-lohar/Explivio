# F11 — Historical video migration plan (plan only; not executed)

> **Superseded on 2026-11-05:** at your request every historical video was **deleted** (not migrated), so this plan no longer applies. It is kept for reference.

Date: 2026-11-05. Running any of this needed your explicit approval.

## 1. Inventory (2026-11-05)

- **21 user runs** in `runs/`. 20 have no owner record yet (F10 legacy migration pending); 1 is owned and stored locally.
- **Size:** `runs/` is about 464 MB, including the pipeline's intermediate files. Only `video.mp4` files would be uploaded, roughly 4–20 MB each.
- **Not candidates:** `runs/m7-silent/`, `m7-gallery`, `voice-check` and logs. These are evaluation output, not user videos.

## 2. Preconditions

1. **F10 legacy ownership applied first** (`npm run db:legacy-ownership -- --apply`, after your approval). Every candidate must have an owner, because the key contains the owner's id.
2. **R2 verified:** `npm run r2:check` passes, and at least one new video has gone end to end through R2.
3. **Room under the free tier:** stored bytes plus the migration total must stay under 80% of 10 GB.

## 3. Strategy (a new script, `db:migrate-videos-r2`, to be written in a later phase)

1. **Select:** `videoProjects` records with `storage.kind = "local-run"`, a ready run and an existing `runs/<id>/video.mp4`.
2. **Dry run (default):**
   - list each candidate: id, owner, size, MD5, target key;
   - show the totals and the projected free-tier usage;
   - note anything skipped (missing file, not ready, no owner) with the reason.
   - No writes.
3. **Apply (`-- --apply`, after approval):** one video at a time:
   - HEAD the key and skip the PUT if the same MD5 is already there;
   - PUT with Content-MD5, then HEAD to verify;
   - only then set `storage` to the R2 shape (`uploaded`, size, MD5, type, `uploadedAt`, plus `migratedFrom: "local-run"`), using a conditional update on `storage.kind = "local-run"`.
4. **Stop conditions:** stop on the first authentication error or guard limit. Failures are reported and the record is left local.

## 4. Metadata strategy

- Only the `storage` field changes. Owner, title, dates and status are untouched.
- Both shapes keep working, so a half-finished migration is safe: migrated videos stream from R2 and the rest from disk.

## 5. Rollback

- **Database:** set `storage` back to `{ kind: "local-run", runId }` with a conditional update. The local file was never touched, so playback returns to disk immediately.
- **Objects:** objects can be deleted afterwards (DeleteObject is free), only after your approval and only the migrated keys listed in the apply report.
- **No local cleanup** is part of this plan. Removing files from `runs/` is a separate, later decision (F14 retention policy).
