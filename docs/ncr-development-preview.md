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

```powershell
pnpm.cmd --filter @parkey/mobile web --host localhost --port 8088
```

Open `http://localhost:8088/ncr-research`, or follow the development link under
the Poblacion map's information panel. Select **Open private research preview**
to inspect actual research objects. The API listens on 127.0.0.1; the app, Host,
client and Origin checks require loopback. The private endpoint additionally
requires the development CLI flag and explicit request header. It refuses
production mode. Do not expose this service through a tunnel or public host.

The 11 study windows and NCR overview use viewport-based loading, zoom-based
clusters, bounded pagination and filters for lots, garages, unspecified
facilities, street segments, entrances and individual bays. Zoom in to inspect
the retained source geometry. Source anchors are not confirmed driving
entrances, including when a mapped object is itself tagged as an entrance.
There is no candidate driving action. Restricted candidates appear only in the
explicit private research mode with warnings.

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
failed/stale public results, rejects expired item/cluster reviews, cancels stale
viewport requests and does not persist the public projection.

See [licensing and publication controls](ncr-licensing-publication.md) before any
future distribution. Public hosting, database integration and release approval
remain separate work. This preview does not modify a database or deploy an app.

## Executed verification

The [Phase 1 execution record](../data/ncr-research/phase1-verification.json)
contains actual commands/results. Browser tests cover desktop Chromium and a
Pixel 7 Chromium viewport, the actual frozen research API, empty public output,
clusters, category filters, geometry/warnings and return to the pilot. Synthetic
approval/sensor/field-form fixtures are labeled and do not create actual human
approvals or visits. Native map code is typechecked; no physical Android/iOS
device or native simulator was run on this host.
