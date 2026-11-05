# NCR parking near destinations — private research labels

Parking near a restaurant, mall or attraction is useful to drivers even if an OSM/Overture parking object has no official business name. **This is a contextual phrase, not an official parking-facility name, and not evidence that vehicles can actually use the space.**

## Private map behavior

In `/ncr-research`, select **Open private research**, then the filter **Named or near destinations (research)** (the new default). Distinctively named parking observations and eligible unnamed facilities with an OSM-sourced nearby destination are shown. The original source name is immutable and remains visible in the detail panel. Alternative filters still include **Cross-source name matches**, **Distinctive source names**, and **All research (including unnamed)**.

The descriptor reads **Parking near [destination]**. A detail warning says the name is only a source-derived destination context, the straight-line approximation isn't a walking route, visitor access and an actual vehicle entrance are unverified, and nothing is approved for public discovery. The descriptor appears only in the private preview and is rejected by the public client/API path.

## Candidate destination types

- Priority: malls, shopping centers, museums, attractions, parks, cinemas, theaters, restaurants, food courts, hospitals, marketplaces and other recognizable trip destinations.
- Secondary: cafés, supermarkets, universities and hotels.
- Low priority with strict distance limit: commercial/retail/office buildings. Do not label unnamed parking by arbitrary distant properties.
- Not eligible: private residential properties, generic unnamed buildings, unsupported source licenses, unrecognized POI types, street segments, individual parking bays or standalone entrances.

Nearby candidates must have a dated/reproducible OSM provenance record from the existing research or a later separately licensed context snapshot. This pipeline accepts no copied Google Maps/Waze place names. Google Maps/Waze remain external coordinate-based human inspection links.

Distance is **source-feature straight-line proximity**, not route distance, walking time, destination intent, shared ownership or usable access. Different POI types have conservative maximum proximity limits (e.g. restaurant 75 m; malls 130 m, offices 35 m). An existing OSM property polygon containing the research anchor may qualify for context, but does not establish garage ownership or that the parking is inside a physically accessible portion of the property.

## Run tests

```powershell
node --test scripts/ncr-destination-labels.test.mjs scripts/ncr-preview-server.test.mjs
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test:e2e
```

The committed November 5 context snapshot covers malls/commercial buildings, hotels and several institutions. The newly supported restaurants, cafés, arts sites, museums, attractions and parks need a **new independently dated OSM extraction** with `scripts/extract-ncr-name-context.py` or `scripts/extract-ncr-name-context.sh`. Rebuild a separate versioned enrichment package and preserve source hashes/attribution. **Do not overwrite the signed November 5 snapshot or mark any older archive row as newly verified.**

## User review before public exposure

Even a useful descriptor must not itself authorize a parking listing. Before a facility can appear to drivers, a reviewer must independently check if the parking actually exists, is currently operating, visitor-accessible, legal, has a vehicle entrance, and meets the application's source-license and publication gates. Do not turn on public-mode labels by copying this research descriptor directly.

## Counters to track

Keep **official-name enrichment** distinct from **private descriptive-label coverage**. Count provisionally unnamed facility groups with a destination descriptor, without converting `unnamedAfter` or `credibleNameProposals` to a fabricated improvement. Track missing destinations, restricted records and unresolved access separately. Do not infer commercial demand merely from proximity to a restaurant or attraction.
