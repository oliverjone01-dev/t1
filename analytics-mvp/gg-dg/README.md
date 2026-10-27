# GG&DG · Домгласс

Production: **https://dash.genglas.ru/gg-dg/**, separate DG login. GitHub stores source and development history. Both former Pages routes are removed (404), without redirects.

The page retains Company, Sales Department and Offered Deals. No DG plan exists; all plan controls, notices, calendar plan strips and the sales-health block are omitted. Removed widgets are listed in metric-spec.json. The main conversion funnel is vertical and retains the DG lead / qualified-lead / sale counts. Deals/Sales sits beside Count/Amount. Prepayment is the default global amount.

## Data and privacy

Candidates are leads with source UC_NQ3QUI (Заявка с ДГ), plus parent leads explicitly linked from direct DG category49 deals. Every candidate requires a bound incoming email whose actual From mailbox domain is exactly domglass.ru. Original CRM sources are preserved; non-DG-source parents require admitted direct-deal and sender proofs, checked again by the builder. Outgoing replies and sender display names do not qualify. Positive email bindings are checked; unavailable metadata aborts publication. Leads without qualifying incoming evidence and deals linked to explicitly rejected source-DG leads are excluded. Deals require that source or an eligible lead link. Pagination, totals, unique IDs and owner scopes are checked. History, tasks, touches and production records are restricted to those IDs. Shared contact/company activity is excluded. Category 49 and RUB are required. Unsupported values, stale input or source drift stop publication.

The shared GG database lacks source IDs, lead links and extended reasons. DG therefore uses an independent server collector and a dedicated Bitrix environment file. Never source the general GG environment or invoke gg-poll, gg-job, their alert wrappers, OpenAI APIs or Telegram APIs for DG work.

The browser receives only sanitized scoped records. Customer record titles, photos and credentials remain excluded. Directly bound communication subjects/text and lead-reason details are included for the requested transparency; contact masking and URL/secret redaction apply. Major lead-reason categories retain the operational dictionary. IDs remain plain text. CRM and other dashboard links are removed before DOM insertion. No raw snapshot or password may enter Git.

## Metrics and interaction

Distribution deals use the creation cohort and budget. Sales reuse the selected GG sale event, date basis and amount. Every category is retained; zero totals show gray rings. Distribution categories open searchable, sortable tables; the lead funnel is static and details remain in the calendar. The lead-refusal diagram and legend are read-only; detailed refusal reasons are in the calendar. Related DG deals may come from other dates and are labelled accordingly.

Calendar includes all eligible leads/deals, not only the offer cohort. Rows: created leads, lead refusals by reason, created deals, Forming TЗ open stock, KP sent, prepayment, production, shipping, success and deal refusal. WIP is stage C49:PREPARATION at the bucket end capped by snapshot time; its period total is the final stock, never a sum of daily stocks. Other stages use the first historical entry; refusals use the first failed semantic status. Dates use Europe/Moscow. Stage rows overlap and are not additive. Lead amounts use known RUB opportunity; deal amounts use the selected budget/prepayment field. Missing/foreign-currency lead amounts are flagged rather than converted. Manager attribution is the current CRM assignee.

The calendar expands to managers, records and the Dialog-style event table (time, author, channel, full text, status/deadline). Each deal includes the originating eligible lead history, deduplicated by source event ID. Communications are counted separately from tasks, notes and stage changes. Open-record history is not cut to the selected interval; rows have a neutral background. Sanitized events share the authenticated HTML snapshot; protected per-record JSON remains compatible.

Fresh communications use Bitrix activity BINDINGS and lead/deal timeline comments with complete pagination. Non-primary bindings are checked with crm.activity.binding.list. The existing localhost18764 Dialog read-only API supplies historical extras, including already stored transcripts. It has no AI or bot calls; the backend requests only current DG L/D keys and postfilters every event by original entity stage. Cache generation/import version is checked before/after pagination; cache failure is explicit. CRM failure/incomplete pages or stage drift abort publication. The archive freshness and CRM freshness are displayed independently. No new model analysis, external API credentials, shared database grants or browser proxy are introduced. Existing upstream transcript speaker roles/direction guesses are labelled as inferred.

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

## Calendar presentation

The calendar is one GG ROP heat matrix: stages in the left column, dates across the same rows, totals on the right. Stage -> responsible -> record -> communication expansion stays inline. GG table spacing, typography and borders are reused. Each responsible, record and communication table has an independent bounded scroll viewport with sticky headings. Levels are visibly indented. Colored markers distinguish stage rows; every level requires a separate click. Refusal records include a separate sanitized CRM reason column. Extra drilldown summaries, reason chips and the stock-caption text are removed; WIP remains the final open stock.

Sanitized unique communication events are embedded in the authenticated HTML snapshot and indexed per allowed record. An open page never mixes its counters with a newer server generation, preventing history errors during the 15-minute refresh. The protected per-record JSON files remain available for compatibility. No new source records or external connections are introduced. Sorting and all available events remain. Entity decoding, contact masks and URL redaction apply before publication; browser rendering escapes every value.

Selected responsible details appear directly beneath the responsible heat row, before the next responsible; the selected manager summary is not repeated. Record history remains beneath its record. Technical events have muted text and a purple badge without background fills. Native email HTML style/script blocks and standalone archived Outlook VML rules are removed without changing record/event membership or ordinary message prose.
