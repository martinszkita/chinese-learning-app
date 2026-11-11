# Dynamic material architecture

## Runtime flow

`index.html` loads service modules and registers `ChineseApp.start`. `bootstrap.js` requests `/api/materials` and starts the UI only after the response passes schema validation. A failed request shows a loading error; it never silently falls back to an out-of-date hardcoded lesson set.

The initial transport is same-origin HTTP. `js/data/repository.js` is the browser-facing boundary; `server/material-store.cjs` is the database boundary. A future PostgreSQL/Supabase implementation should implement the same material contract and preserve IDs. The existing SQLite SQL migration is SQLite-specific and will need a PostgreSQL migration, not a direct copy.

Classic JavaScript module wrappers are used to share code between the existing browser runtime and Node tests without a bundler. Modules expose small named APIs under `ChineseApp`; lesson globals are not loaded by the application. `app.js` still coordinates views and UI events and can be split into view/controller modules incrementally.

## Data model

| Table | Responsibility |
| --- | --- |
| `collections` | A lesson dialogue, midterm or reading passage; title and source metadata |
| `sections` | Ordered dialogue/vocabulary/examples/questions/reading groups |
| `items` | Stable content ID, Traditional Chinese, optional Simplified override, Pinyin, translation, aliases and revision |
| `section_items` | Placement of content in a section: order, speaker, vocabulary category and recording |
| `assets` | Audio/image/PDF reference and provider/voice metadata; binary files stay outside the database |
| `jobs` | Initial schema for future import/audio generation jobs; no worker is enabled yet |
| `app_meta` | Schema and one-time migration markers |

A content item can appear in multiple places with different speakers or recordings. Updating its text retains its ID. Reordering a dialogue affects placements rather than content identity. `revision` prevents a client from overwriting a newer edit.

The first migration preserves the old content, word order, source URLs and existing numbered audio paths. Seed IDs are assigned once and persisted. New records receive UUIDs. Seed metadata retains original Chinese keys so old browser progress and personal lists can still resolve an item after a text correction. Progress/list sync is not yet stored on the server: this refactor preserves browser storage and adds stable IDs before a later authenticated migration.

## API contract

All responses are JSON; error responses have `{ "error": "..." }`. The snapshot has `schemaVersion: 1`, `collections`, `sections`, `items`, `sectionItems`, and `assets` arrays.

| Method and route | Request/result |
| --- | --- |
| `GET /api/materials` | Complete validated material snapshot |
| `POST /api/collections` | `{lessonNumber, dialogNumber, title}` → collection and three empty sections |
| `POST /api/sections/:id/items` | Content fields, or `itemId` for reuse; optional speaker/category → item and placement |
| `PATCH /api/items/:id` | `expectedRevision` plus editable content fields; returns 409 on stale revisions |
| `POST /api/placements/:id/audio` | `{path, provider?, voice?}` → attached audio asset; identical retries reuse the asset |

After mutation, load a fresh snapshot to update views. API changes are durable without modifying files or redeploying the frontend. The current API intentionally has no delete operation, binary upload endpoint or administrative editing screen.

## Deployment boundary

The included Node server is a **local single-user development backend**, bound to `127.0.0.1`. It rejects foreign browser origins and unrecognized Host headers, validates JSON, uses parameterized SQL, limits request sizes, and serves only allowlisted public files. Database files, environment files, server code and archived lesson scripts cannot be downloaded through it. Audio supports byte ranges for playback and seeking.

Authentication, roles, multi-user ownership policies, cloud file storage and an external-service worker are not implemented by this refactor. Add them before exposing write endpoints publicly. Keep ElevenLabs/administrative credentials on the server. The browser repository may be adapted to an authenticated API while keeping the same schema.

## Audio generation

`server/audio-materials.cjs` queries the database for generation plans. Both ElevenLabs and local macOS generators use it, so newly added DB material is included. Completed audio is attached through the same repository method as future uploads. `--dry-run` does not call a provider or attach audio. The legacy `materials/audio/materials.js` mapping and lesson scripts remain only as migration fixtures; editing them has no effect on an already seeded database.

## Next increments

1. Build an authenticated material editor that consumes the existing repository methods.
2. Add upload/storage endpoints with asset ownership and file validation.
3. Implement import/TTS workers with retries, per-job status and cost controls.
4. Migrate browser progress and lists to authenticated user records by stable item ID.
5. Introduce PostgreSQL/Supabase behind the repository contract when cloud access is needed.
