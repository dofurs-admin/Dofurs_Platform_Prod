## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- In Codex, the reliable explicit skill invocation is `$graphify ...`; do not rely on `/graphify ...`
- `$graphify ...` is a Codex skill trigger, not a Bash subcommand like `graphify .`
- A successful TypeScript-backed Codex build should leave `graphify-out/.graphify_runtime.json` with `runtime: typescript`
- If the user asks to build, update, query, path, or explain the graph, use the installed `graphify` skill instead of ad-hoc file traversal
- After modifying code files in this session, run `npx graphify hook-rebuild` to keep the graph current

## mobile development tracking

- `MOBILE_APP_DEVELOPMENT_READINESS_TRACKER.md` is the current source of truth for customer and provider mobile development readiness
- Before changing `dofurs-mobile/**` or mobile-facing backend/auth/payment APIs, read the tracker and select the highest-priority relevant incomplete item
- After mobile work, update the affected checklist, feature matrix, validation log, and decision log; only mark an item complete after its documented validation succeeds
- Do not treat no-op lint/test scripts, route existence, or API wiring alone as completed or device-verified functionality

## CRM development tracking

- `CRM_DEVELOPMENT_TRACKER.md` is the current source of truth for the in-house CRM (lead pipeline, sheet import, sales workflow, deployment readiness)
- Before changing `lib/crm/**`, `app/api/admin/crm/**`, `components/dashboard/admin/tabs/CrmTab.tsx`, CRM migrations, or CRM-related env/cron configuration, read the tracker and select the highest-priority relevant incomplete item
- After every CRM change, update the affected phase checklist, data notes, validation log, and decision log in the same session; only mark `[x]` after documented validation succeeds
- Do not treat route existence, API wiring, or no-op lint/test scripts as completed functionality

## Gaze development tracking

- `GAZE_DEVELOPMENT_TRACKER.md` is the current source of truth for the Gaze geographic operations view, including the CRM lead layer
- Before changing `app/api/admin/gaze/**`, `components/dashboard/admin/gaze/**`, `components/dashboard/admin/tabs/GazeTab.tsx`, `lib/gaze/**`, or area data in `lib/service-areas.ts`, read the tracker and select the highest-priority relevant incomplete item
- After every Gaze change, update the layer checklist, data notes, validation log, and decision log in the same session; every new map symbol must have a legend entry, and optional-data fallbacks must `console.warn` rather than degrade silently

