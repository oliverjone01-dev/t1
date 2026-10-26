# GG&DG · Домгласс

Production: **https://dash.genglas.ru/gg-dg/**, separate DG login. GitHub stores source and development history. Both former Pages routes are removed (404), without redirects.

The page retains Company, Sales Department and Offered Deals. No DG plan exists; all plan controls, notices, calendar plan strips and the sales-health block are omitted. Removed widgets are listed in metric-spec.json. The main conversion funnel is vertical and retains the DG lead / qualified-lead / sale counts. Deals/Sales sits beside Count/Amount. Prepayment is the default global amount.

## Data and privacy

Leads require exact source UC_NQ3QUI (Заявка с ДГ). Deals require that source or an eligible lead link. Pagination, totals, unique IDs and owner scopes are checked. History, tasks, touches and production records are restricted to those IDs. Shared contact/company activity is excluded. Category 49 and RUB are required. Unsupported values, stale input or source drift stop publication.

The shared GG database lacks source IDs, lead links and extended reasons. DG therefore uses an independent server collector and a dedicated Bitrix environment file. Never source the general GG environment or invoke gg-poll, gg-job, their alert wrappers, OpenAI APIs or Telegram APIs for DG work.

The browser receives only sanitized scoped records. Customer titles, contacts, task subjects, arbitrary comments, photos and credentials are excluded. Lead reasons use a strict operational label dictionary. IDs remain plain text. CRM and other dashboard links are removed before DOM insertion. No raw snapshot or password may enter Git.

## Metrics and interaction

Distribution deals use the creation cohort and budget. Sales reuse the selected GG sale event, date basis and amount. Every category is retained; zero totals show gray rings. Categories and lead refusal segments open searchable, sortable tables. Related DG deals may come from other dates and are labelled accordingly.

Calendar WIP is a stock at bucket end. Other rows count lifecycle events and cannot be summed across stages. Production is first C49:FINAL_INVOICE, shipping first C49:2, completion first C49:WON. Won deals without completion history use the close date. The offer cohort remains; skipped stages are not invented. Calendar amounts use the selected global amount.

Moscow calendar dates are used. Comparison uses the previous adjacent interval of equal inclusive length (7 vs previous 7, 30 vs previous 30, likewise for custom ranges). A zero/missing previous value shows neutral 0% with a tooltip. A nonzero base uses the calculated relative change.

## Verification

Node 22.23+ is required. Set GG_REFERENCE_ROOT to a GG analytics root and run node --test analytics-mvp/gg-dg/check-widgets.cjs. Tests use synthetic records without network or credentials. Also check desktop/phone layout, filters, zero sales, drilldowns and navigation.

collect-widgets.cjs adapts the four reference files from rop-dashboard-v1. Run the generated collector only with the dedicated Bitrix setting. build-widgets.cjs validates the private snapshot, then builds HTML/v.txt/manifest. Reference files are pinned inside each code release and hashed in release.json.

## VPS operation

vps/install.py accepts an audited JSON package over authenticated SSH stdin: fingerprint, gitCommit, files (relative paths to base64 source), reference (four base64 files), referenceSha256, username=domglass, and the locally generated password. Keep the package/password out of Git and process arguments.

The installer creates a dedicated gg-dg service account, private source/state, a separate nginx password file and route include. It validates a fresh build before exposing the route, tests nginx before reload, and verifies that DG credentials cannot open other dashboards or the shared API.

- Source: /srv/gg/dg/code/releases/<fingerprint>, with a current symlink.
- Private state: /srv/gg/dg/state. Bitrix environment: /etc/gg-dg/bitrix.env, root-only.
- Authenticated files: /srv/gg/dg-www/current/index.html and v.txt. This root is outside the shared importer scan and has no legacy fallback.
- gg-dg-refresh.timer runs every 15 minutes and after startup. Its service limits CPU/memory and has no notification hooks. Publication is atomic; five releases remain for rollback. Failed collection keeps the last successful page and logs only the failed stage.
- TLS /gg-dg/ uses its own realm and password file. Common root/API routes still require GG credentials. CSP limits connections to this origin and existing font providers.

Rollback by restoring the previous DG code and web symlinks. Nginx backups are under /srv/gg/dg/rollback; validate with nginx -t before reload. Never replace the shared GG root or restart unrelated applications. Review deployment code before each update.

See CHANGELOG.md and metric-spec.json for development history and exact formulas.
