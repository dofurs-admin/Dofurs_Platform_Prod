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
