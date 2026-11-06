# Metro Manila development preview

The existing Expo app now has an internal Metro Manila map backed by the frozen
5,427-observation research snapshot. **No new NCR records are approved for public
display.** The default public projection returns no candidates. Opening the
private research mode is an explicit development action, not publication.

Use Node 24 and the pinned pnpm version after `pnpm install --frozen-lockfile`.
Start these in separate terminals from the repository root:

```powershell
node scripts/ncr-preview-server.mjs --development-preview --port 8090
```

To attach the separately versioned parking-name review queue, pass its JSON or
gzip report explicitly:

```powershell
node scripts/ncr-preview-server.mjs --development-preview --port 8090 --enrichment data/ncr-enrichment/2026-11-05/name-enrichment.json.gz
```

For the fresh destination-description package, use:

```powershell
node scripts/ncr-preview-server.mjs --development-preview --port 8090 --enrichment data/ncr-destinations/2026-11-05/destination-enrichment.json.gz
```

The server requires the queue's frozen source hashes and complete facility-group
membership to match the original research snapshot. It rejects claimed name,
operator, visit, visitor-access or publication approvals in this attachment.
Private detail responses include `nameReview.enrichment`, with proposed names,
classifications, source evidence, property/operator clues and coordinate-based
Google Maps/Waze review links. A nearby property remains a context clue. These
links identify original source anchors, not confirmed driving entrances or
permission to copy a map provider's listings. The map keeps each original source
name, geometry and clustering. Private map labels may show the separate
**Parking near [Destination]** description; the attachment does not change the
official source name or public eligibility. Private record details add a **Parking-name review** section
with the separate proposal, readable classification, source links and uncertain
nearby/property/operator clues. Select **All research (including unnamed)** in
the category sheet to reach remaining unnamed records; the default name filter is
**Named or near destinations (research)**. Cross-source name matches and distinctive
source names remain separate filters. Other retained group coordinates
have review links too, with no driving action. The client rejects malformed
attachments and any enrichment in public responses. The full evidence queue
remains available in exported review files. Changing the attached report
invalidates private pagination cursors. Public
responses and public data versions never include the attachment.

```powershell
$env:CI = '1'
pnpm.cmd --filter @parkey/mobile web --host localhost --port 8088 --clear
```

Open `http://localhost:8088/ncr-research`, or follow the development link under
the Poblacion map's information panel. Select **Private research**
to inspect actual research objects. The optional `CI=1` setting provides a stable
review session without file watching; `--clear` rebuilds Metro's cache. Restart
the review server after changing code. The API listens on 127.0.0.1; the app, Host,
client and Origin checks require loopback. The private endpoint additionally
requires the development CLI flag and explicit request header. It refuses
production mode. Do not expose this service through a tunnel or public host.

The map fills the entire screen. Compact controls sit above it; area selection,
categories, source information, a searchable location list and record details
open in dismissible modal sheets. Long research text never resizes the map.

At the user's request, the client now loads the **complete NCR snapshot once**,
instead of fetching another viewport after each movement. Private mode retrieves
all 5,427 records in 11 bounded API pages and only displays a consistent complete
snapshot. Panning, zooming, area shortcuts and category filters use the loaded
records. MapLibre clusters observations locally; those counts are not parking
capacity or available spaces. A mode-scoped in-memory cache avoids loading the
private snapshot again when returning from public mode. Nothing is persisted.
Manual refresh reloads the snapshot. Failed or canceled loads show no partial
dataset, and public mode always goes through server publication review.

Filters distinguish lots, garages, unspecified facilities, street segments,
entrances and individual bays. Zoom in to inspect original source geometry.
Research anchors are not confirmed driving entrances. There is no candidate
driving action. Restricted candidates appear only in explicit private research
mode with warnings.

Each detail separates research, online corroboration, operator confirmation,
physical verification and publication approval. Unknown fees, hours, capacity
and live availability stay unknown. Attribution and source links accompany the
data. The application bundles no raw NCR research archive. Existing Poblacion
decisions and its offline fallback remain in their original pipeline.

The server rereads and validates review/publication ledgers for each request.
Public records require a current, source-bound, field-scoped human display
approval plus affirmative licensing, safety and visitor-access review. Private,
restricted, closed, prohibited, unsafe, child/street and unresolved records fail
closed. Approval is independent of physical verification. The client clears
failed/stale public results, rejects expired reviews, cancels superseded dataset
loads and does not persist the public projection.

See [licensing and publication controls](ncr-licensing-publication.md) before any
future distribution. Public hosting, database integration and release approval
remain separate work. This preview does not modify a database or deploy an app.

## Executed verification

The [Phase 1 execution record](../data/ncr-research/phase1-verification.json)
contains actual commands/results. Browser tests cover desktop Chromium and a
Pixel 7 Chromium viewport, the actual frozen research API, empty public output,
clusters, category filters, geometry/warnings and return to the pilot. Synthetic
approval/sensor/field-form fixtures are labeled and do not create actual human
approvals or visits. Native Android smoke testing ran on the existing Pixel 10 Pro Android 17 AVD
with the installed development client and current Metro code: public-empty,
private overview, BGC details, warnings, public clearing and return to the pilot.
It exposed and verified a correction for missing cluster-count glyphs; both maps
now request the supported Noto Sans Bold stack. No new native APK or iOS device/
simulator was built or tested.

The [full-screen UI execution record](../data/ncr-research/ncr-ui-verification.json)
contains the subsequent layout/data-loading tests and actual normal-preview
smoke results. The earlier Android smoke below predates this full-screen
continuation; the new native renderer was typechecked, not rerun on a device.
