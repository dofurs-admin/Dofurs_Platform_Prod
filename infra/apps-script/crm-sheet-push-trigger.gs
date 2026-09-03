/**
 * Dofurs CRM — Google Sheet push trigger ("new lead row → import now").
 *
 * Companion to infra/supabase/migrations/101_crm_automation_pg_cron.sql.
 * The 5-minute pg_cron import is the fallback safety net; this script makes
 * the import run within SECONDS of a new row landing in the sheet by POSTing
 * the existing production import endpoint with the shared automation secret
 * (same auth path the cron runners use; idempotent + lock-protected).
 *
 * INSTALL (one-time, ~2 minutes, must be done by the spreadsheet owner):
 *   1. Open the leads spreadsheet → Extensions → Apps Script.
 *   2. Replace any placeholder code with this entire file.
 *   3. Replace ENDPOINT_SECRET below with the CRM_SHEET_IMPORT_SECRET value
 *      (the same value set on the Render web service).
 *   4. Save, then Run → testNow once and approve the authorization prompt
 *      (external request permission). Check Executions: expect a 200 and a
 *      "Poked import endpoint" log. The CRM "Automation health" panel should
 *      show a fresh meta-sheet-import heartbeat within a minute.
 *   5. Triggers (clock icon) → Add Trigger → onSheetChange → event source
 *      "From spreadsheet" → event type "On change" → Save.
 *   6. End-to-end test: add a dummy lead row (test phone 99999xxxxx) to a
 *      leads tab and confirm the lead appears in the CRM, then clean it up.
 *
 * HOW IT WORKS / LIMITS (read before changing):
 *   - Installable onChange triggers do NOT expose which sheet changed, so the
 *     script pokes on any INSERT/EDIT change and lets the SERVER's tab
 *     allow-list (GOOGLE_SHEETS_LEADS_TABS) decide what to import. A poke on
 *     an irrelevant tab just runs an idempotent scan that imports nothing.
 *   - Some programmatic writers do not fire Apps Script triggers at all —
 *     that is exactly why the pg_cron 5-minute import stays as the fallback.
 *     After installing, verify the trigger fires for YOUR row source (step 6).
 *   - Debounce: rapid back-to-back changes coalesce into one poke (the import
 *     scans the whole sheet every time, so nothing is lost).
 *   - 409 responses mean another import holds the lock — the in-flight run
 *     will pick up the new rows; treated as success.
 *   - Apps Script quotas are ample: 20k URL fetches/day (one per poke) and a
 *     30 s import per poke. At very high lead volume the debounce and the
 *     pg_cron fallback keep coverage complete.
 *   - The import run takes ~25–30 s today. If it ever outgrows the script's
 *     fetch window, the server still completes the run — only this script's
 *     log line would be cut short.
 */

var ENDPOINT = 'https://dofurs.in/api/admin/crm/imports/meta-sheet';
var ENDPOINT_SECRET = '<PASTE_THE_CRM_SHEET_IMPORT_SECRET_HERE>';
var DEBOUNCE_SECONDS = 20;

/**
 * Installable "On change" trigger handler (added in step 5 of the install
 * instructions). INSERT = new rows (how lead-sync tools append leads);
 * EDIT covers tools that rewrite cells. REMOVE/FORMAT changes never carry
 * new leads, so they are ignored.
 */
function onSheetChange(e) {
  try {
    if (!e || !e.changeType) {
      return;
    }
    if (e.changeType !== 'INSERT' && e.changeType !== 'EDIT') {
      return;
    }
    pokeImportEndpoint('onChange:' + e.changeType);
  } catch (error) {
    console.error('onSheetChange failed: ' + error);
  }
}

/** Sends the "run the import now" request to the production endpoint. */
function pokeImportEndpoint(reason) {
  var props = PropertiesService.getScriptProperties();
  var lastPokeMs = Number(props.getProperty('last_poke_ms') || 0);
  var now = Date.now();

  if (now - lastPokeMs < DEBOUNCE_SECONDS * 1000) {
    console.log(
      'Skipped poke (' + reason + ') — debounced, an import already ran less than ' +
        DEBOUNCE_SECONDS + 's ago and scans every row anyway.',
    );
    return;
  }
  props.setProperty('last_poke_ms', String(now));

  var response = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { authorization: 'Bearer ' + ENDPOINT_SECRET },
    payload: JSON.stringify({ dryRun: false }),
    muteHttpExceptions: true,
    followRedirects: true,
  });

  var status = response.getResponseCode();
  if (status === 200 || status === 201) {
    console.log(
      'Poked import endpoint (' + reason + ') → ' + status + ' ' +
        response.getContentText().slice(0, 300),
    );
  } else if (status === 409) {
    console.log(
      'Import already running (lock held) → 409 — the in-flight run picks up the new rows.',
    );
  } else if (status === 401) {
    console.error(
      'REJECTED 401 — ENDPOINT_SECRET does not match CRM_SHEET_IMPORT_SECRET on the web ' +
        'service. Fix the secret in this script (line ENDPOINT_SECRET).',
    );
  } else {
    console.error(
      'Import endpoint returned ' + status + ': ' + response.getContentText().slice(0, 300),
    );
  }
}

/** Manual verification helper — run this once from the editor (install step 4). */
function testNow() {
  pokeImportEndpoint('manual-test');
}
