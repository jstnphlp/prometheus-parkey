# Prioritized physical verification and local form

**Begin with Poblacion's six existing owner-requested visits.** This reduces
known evidence gaps without claiming that Poblacion is a validated commercial
winner. Cubao has the strongest published operator-portfolio lead; BGC is a
useful estate comparison; Tomas Morato needs a narrowly scoped implementation
and legal/access check. [The hotspot comparison](ncr-hotspot-comparison.md)
distinguishes evidence-readiness priorities from a final launch ranking.

The complete [checklist JSON](../data/ncr-research/fieldwork-checklist.json) covers
**all 5,427 candidate IDs**. Each has full permitted-source coordinates, a
constructed Google Maps search link (navigation only), current evidence/status,
remote-established facts, remaining uncertainties, exact question keys,
proposed visit periods, permission instructions, readiness impact and issue IDs.
Shared question/period/instruction registries in the same file supply the full
wording. No map-provider place content was imported. Source anchors and prior
owner navigation notes are not confirmed vehicle entrances or permission to park.

The practical first selection contains **66 candidates in 12 route pockets**,
including **24 first-wave tasks** across Poblacion, Cubao, BGC and Tomas Morato.
All six owner tasks and three existing owner navigation references are retained.
The [CSV](../data/ncr-research/fieldwork-checklist.csv) expands the full questions
and instructions for the 66 planned tasks; it does not require visiting all
5,427 source objects before a focused pilot can be reviewed.

## Use the private structured form

1. Open [ncr-fieldwork-form.html](ncr-fieldwork-form.html) locally in a browser.
2. Load the committed fieldwork-checklist.json with its file picker. Choose a
   route or candidate. The form shows original source facts and uncertainties.
3. Make the actual on-site observation from a lawful public/authorized approach.
   Record existence, visitor conditions, observed operation, actual posted
   fees/hours, entrance coordinate only if personally observed, notes and time.
4. Optional permitted photographs are processed locally to PNG to strip EXIF;
   avoid faces, plates and private information. Up to three bounded photos are
   embedded in the private export. Nothing is uploaded to a public service.
5. Attest to actual observation and privacy/permission handling, then export the
   unreviewed submission. Missing facts stay unknown. Do not enter a fictional
   visit to advance a phase gate.
6. Reconcile the export locally; keep photos/submissions out of Git:

```powershell
node scripts/ncr-fieldwork-submit.mjs path/to/field-submission.json data/ncr-research output/ncr/field-submissions
```

The CLI validates source-version/ID, actual nonfuture visit time, attestation,
notes, bounded fact vocabularies and PNG evidence; it serializes ledger writers and uses atomic commits. Retrying an identical
submission returns the existing receipt without duplicating evidence; interrupted
archives recover from the still-present validated input. Conflicting archived
content is rejected. It archives private evidence and appends a review event. **The receipt
remains unverified and publicationApproved=false.** An accountable human must
review the evidence, resolve the matching issues and separately record any
physical evidence/publication decision. No HTTP approval endpoint exists.

## Route pockets and candidate-specific visits

Route order and distances use straight lines between research anchors, not
validated walking/driving directions. Check lawful crossings, access, signage
and safe approaches yourself. Permission is needed before entering private or
restricted property and before recording evidence where the operator requires it.
Do not park to test uncertain street legality. The full ordinance's current IRR
phase and posted enforcement must be checked for Tomas Morato; its phased Sunday
06:00?10:00 rule cannot be treated as a blanket all-Sunday closure.

### poblacion-owner-north

Priority 1. Preserved owner visit requests; continuity, not commercial ranking.

Weeknight 18:00–21:00, contrasted with Friday/Saturday evening; proposed sampling, not confirmed business hours.

| Candidate and source ID                                                    | Source latitude, longitude | Navigation/search                                                                          |
| -------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| Riki Carreon Parking Lot ? `overture:620ef9f8-b42c-441f-8761-e3add2216d41` | 14.5671261, 121.03067135   | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5671261%2C121.03067135) |
| Osmeña St ? `overture:7fabad6f-f325-4893-912e-4cb137964c6b`                | 14.568952, 121.030627      | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.568952%2C121.030627)    |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### poblacion-owner-south

Priority 1. Preserved owner visit requests; continuity, not commercial ranking.

Weeknight 18:00–21:00, contrasted with Friday/Saturday evening; proposed sampling, not confirmed business hours.

| Candidate and source ID                                                                              | Source latitude, longitude       | Navigation/search                                                                                  |
| ---------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| PNB Open Parking (Global Parking Management, Inc.) ? `overture:38024824-5637-48f6-a42e-147ed4d01cd4` | 14.55963283, 121.02931275        | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55963283%2C121.02931275)        |
| Parking lot ? `overture:bb11755f-b787-4b40-97cd-fa40f87c02b2`                                        | 14.55942293, 121.02786011        | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55942293%2C121.02786011)        |
| Buendia Ext'n Service Road ? `overture:9525f048-4c7b-4f40-9441-78f3fe1bacc3`                         | 14.561345273705, 121.02624477048 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.561345273705%2C121.02624477048) |
| Classica 1 Parking Garage ? `overture:cc3d1478-11cf-44b0-b8ee-4b1be6b904c7`                          | 14.56122542, 121.02405134        | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.56122542%2C121.02405134)        |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### cubao-sample

Priority 2. Official estate parking guide names investigation leads; no measured shortage.

Ordinary retail period and a documented Coliseum event or weekend/payday period; confirm the actual event calendar.

| Candidate and source ID                                                                          | Source latitude, longitude             | Navigation/search                                                                                        |
| ------------------------------------------------------------------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Gateway Underground Parking ? `osm:node/1556858539:Point`                                        | 14.6215489, 121.0536173                | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.6215489%2C121.0536173)                |
| Puregold supermarket parking entrance and exit ? `overture:85da438d-1272-42f9-8b64-2fbc49b63fa2` | 14.62154899, 121.05343481              | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.62154899%2C121.05343481)              |
| Parking Garage South ? `osm:way/184362727:MultiPolygon`                                          | 14.6198503, 121.05368544999999         | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.6198503%2C121.05368544999999)         |
| SM Cubao Carpark ? `overture:f4af3f9b-f11d-47d7-8e22-f0541781cbc5`                               | 14.61843384, 121.05590289              | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.61843384%2C121.05590289)              |
| Parking Lot P3 ? `overture:6be7eeb2-a024-451a-9865-67f76c02a6d5`                                 | 14.618118329344734, 121.05615505254417 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.618118329344734%2C121.05615505254417) |
| Parking Grounds, Anonas Lrt City Center ? `overture:47b8ebfa-c677-49d9-93d7-11ce5d54f488`        | 14.627151787591032, 121.06436591698997 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.627151787591032%2C121.06436591698997) |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### bgc-sample

Priority 3. Estate FAQ/parking inquiry channel supports remote evidence access; no operator commitment.

Weekday 08:00–10:00 office arrivals and an evening retail/dining period.

| Candidate and source ID                                       | Source latitude, longitude       | Navigation/search                                                                                  |
| ------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Gallery Parkade ? `osm:node/13333195701:Point`                | 14.5484672, 121.0507511          | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5484672%2C121.0507511)          |
| One Parkade ? `osm:way/37554027:MultiPolygon`                 | 14.550138, 121.04978514999999    | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.550138%2C121.04978514999999)    |
| One Parkade ? `overture:19e7e4a2-d6c4-4553-a51c-6f806066c022` | 14.55025473, 121.04970694        | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55025473%2C121.04970694)        |
| Central South ? `osm:way/205968628:MultiPolygon`              | 14.5504697, 121.048765           | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5504697%2C121.048765)           |
| Two Parkade ? `osm:way/37554033:MultiPolygon`                 | 14.551688200000001, 121.05030365 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.551688200000001%2C121.05030365) |
| B7 Parking ? `overture:e7adad62-3230-40bb-a11e-f682af8b0aef`  | 14.55075135, 121.05208868        | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55075135%2C121.05208868)        |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### tomas-morato-sample

Priority 4. Time-dependent ordinance implementation needs legal and site evidence.

Weeknight dining period plus a Sunday 06:00–10:00 corridor/signage observation, after checking the implemented ordinance phase.

| Candidate and source ID                                                         | Source latitude, longitude             | Navigation/search                                                                                        |
| ------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SunShine Boulevard ? `osm:way/354208701:MultiPolygon`                           | 14.63761635, 121.0279806               | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.63761635%2C121.0279806)               |
| ll Terrazzo Basement Parking ? `overture:a0c54917-b216-427c-8a3d-16e3cb06768c`  | 14.635695, 121.0311859                 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.635695%2C121.0311859)                 |
| ABS-CBN ELJCC Parking ? `overture:f701ec5c-6bab-40b9-bec3-a36fbcff65ec`         | 14.63878118, 121.03601995              | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.63878118%2C121.03601995)              |
| Vanilla Cafe ? `overture:2f32433a-de3b-42ed-b059-05e8717bc5a2`                  | 14.64065437, 121.03617638              | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.64065437%2C121.03617638)              |
| Triumph Square Public Parking ? `overture:874a69ef-bcb8-4702-84e0-0ec49f20f204` | 14.64223017, 121.03516163              | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.64223017%2C121.03516163)              |
| Steel Parking 1 Eton Centris ? `overture:72f9b7b1-5312-4183-ac3d-dbbbb0e66f70`  | 14.639979840228985, 121.04089658987817 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.639979840228985%2C121.04089658987817) |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### binondo-sample

Priority 5. Contrasting investigation sample; no validated commercial ranking.

Weekday midday errands and a contrasting weekend period; distinguish loading from parking.

| Candidate and source ID                                                        | Source latitude, longitude      | Navigation/search                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pay Parking ? `osm:way/183944627:MultiPolygon`                                 | 14.598239249999999, 120.9768584 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.598239249999999%2C120.9768584) |
| Pacific Center Parking ? `osm:way/807067437:MultiPolygon`                      | 14.5987695, 120.9763634         | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5987695%2C120.9763634)         |
| Alex Parking Lot ? `overture:4c1f007f-5635-4b39-9090-4c75096ece1f`             | 14.60186272, 120.97579237       | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.60186272%2C120.97579237)       |
| Lucky Chinatown Mall Parking ? `overture:4ebabaee-5fd3-4d1d-86f5-da6a77859654` | 14.60259861, 120.97388306       | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.60259861%2C120.97388306)       |
| Yellow Parking ? `overture:a8c50451-a375-4e1b-b385-be6b351384f1`               | 14.59979466, 120.9730606        | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.59979466%2C120.9730606)        |
| Soler Car Park ? `osm:way/809153622:MultiPolygon`                              | 14.60389795, 120.9773094        | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.60389795%2C120.9773094)        |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### makati-cbd-sample

Priority 6. Contrasting investigation sample; no validated commercial ranking.

Weekday office-arrival period and a contrasting evening or weekend retail period.

| Candidate and source ID                                                               | Source latitude, longitude     | Navigation/search                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| Paseo Center Parking ? `osm:way/155775865:MultiPolygon`                               | 14.55819715, 121.02278155      | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55819715%2C121.02278155)      |
| Paseo center parking ? `overture:d6ff6302-0143-43f7-95bf-3e85927b404d`                | 14.55788445, 121.02266756      | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55788445%2C121.02266756)      |
| open parking valero access road 3 ? `overture:e5880746-efed-4b4f-a085-f9b2ea64043a`   | 14.55840335, 121.02243852      | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55840335%2C121.02243852)      |
| Insular Valero Professional Parking ? `overture:ef49f48f-311d-409d-9303-87a511d0dc5f` | 14.55788695, 121.02188177      | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55788695%2C121.02188177)      |
| Valero Carpark 1 Building ? `osm:way/34901956:MultiPolygon`                           | 14.5579794, 121.02136060000001 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5579794%2C121.02136060000001) |
| Tower One Basement Parking ? `overture:6e06dad7-6df8-4957-93e2-3362631be8d2`          | 14.55700537, 121.02230016      | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.55700537%2C121.02230016)      |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### ortigas-sample

Priority 7. Contrasting investigation sample; no validated commercial ranking.

Weekday office-arrival period and a contrasting weekend mall period; check the responsible LGU.

| Candidate and source ID                                               | Source latitude, longitude             | Navigation/search                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| BDO Corporate Center Parking ? `osm:node/813134352:Point`             | 14.5860057, 121.0589386                | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5860057%2C121.0589386)                |
| ADB Covered Parking ? `overture:e3663ecf-6138-4fe8-8b6a-bd45efcbe21f` | 14.586017075275862, 121.05922735373613 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.586017075275862%2C121.05922735373613) |
| Work parking ? `overture:06752cf9-d5d1-4c87-8e8f-e4519b0b284e`        | 14.58574304, 121.05844303              | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.58574304%2C121.05844303)              |
| Open Parking ? `osm:way/807206493:MultiPolygon`                       | 14.58573305, 121.0583462               | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.58573305%2C121.0583462)               |
| Luvpark ? `overture:b3fe602b-f01f-4490-951c-d65c60c54de2`             | 14.5848723, 121.05806476               | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5848723%2C121.05806476)               |
| Podium Open Parking ? `overture:f04ff97d-4fb8-4223-9d33-02263325a087` | 14.58484962527811, 121.05894181624542  | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.58484962527811%2C121.05894181624542)  |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### moa-sample

Priority 8. Contrasting investigation sample; no validated commercial ranking.

Ordinary retail period and a separately documented event period.

| Candidate and source ID                                                  | Source latitude, longitude            | Navigation/search                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SM Mall of Asia North Wing Parking ? `osm:node/255060144:Point`          | 14.5369746, 120.9826653               | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5369746%2C120.9826653)               |
| SM MOA North Parking ? `overture:ecc4396b-27c6-4d32-959b-83c10501e575`   | 14.53713575, 120.98248376             | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.53713575%2C120.98248376)             |
| South Parking Building ? `overture:558397d7-f6d0-440b-ac59-57752d3441ef` | 14.53585166, 120.98100823             | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.53585166%2C120.98100823)             |
| SM Mall of Asia South Wing Parking ? `osm:node/26935335:Point`           | 14.5332848, 120.9815194               | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.5332848%2C120.9815194)               |
| South Parking ? `overture:33d29680-95a6-4552-9186-324599c5e97d`          | 14.53335249, 120.98247361             | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.53335249%2C120.98247361)             |
| MAAX Parking Building ? `overture:9ebc81f6-a7c8-42a9-b957-6e88b2f3a6de`  | 14.53107388756611, 120.98331938421332 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.53107388756611%2C120.98331938421332) |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### north-edsa-sample

Priority 9. Contrasting investigation sample; no validated commercial ranking.

Weekday commuting/office period and a contrasting weekend retail period.

| Candidate and source ID                                                                           | Source latitude, longitude             | Navigation/search                                                                                        |
| ------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SM City North EDSA Annex Parking ? `osm:node/965963205:Point`                                     | 14.6569293, 121.0267356                | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.6569293%2C121.0267356)                |
| SM the Annex Parking Garage ? `overture:6032bfe4-9ab2-441a-b942-be4272d6327c`                     | 14.6566664, 121.0260707                | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.6566664%2C121.0260707)                |
| Lopezes Parking Spaces at SMDC Grass Residences ? `overture:8df7e89d-d35e-4907-b2af-98c107c6ab26` | 14.65915992124, 121.02751493454        | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.65915992124%2C121.02751493454)        |
| Open Parking Lot ? `overture:6e62204f-44ec-4782-85ac-ae79f100825a`                                | 14.65740886, 121.02945604              | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.65740886%2C121.02945604)              |
| SM North EDSA Annex Parking ? `overture:c8152303-2413-4220-ab36-18d6dc02f89c`                     | 14.656997187926807, 121.03014203393207 | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.656997187926807%2C121.03014203393207) |
| SM North Interior Zone and The Car Park Plaza ? `osm:way/44667391:MultiPolygon`                   | 14.65765855, 121.03099445              | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.65765855%2C121.03099445)              |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### alabang-sample

Priority 10. Contrasting investigation sample; no validated commercial ranking.

Weekday office period and a contrasting weekend retail period.

| Candidate and source ID                                                            | Source latitude, longitude | Navigation/search                                                                           |
| ---------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| Bellevue Parking Area ? `osm:way/547184326:MultiPolygon`                           | 14.4235617, 121.03984405   | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.4235617%2C121.03984405)  |
| Northgate Cyberzone by Filinvest ? `overture:0b7a5ffb-39ba-4ad4-b8f6-08f0e2645449` | 14.4228134, 121.0391591    | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.4228134%2C121.0391591)   |
| Parking CENA ? `overture:ef4315d3-eb58-4e72-8d4e-003243217535`                     | 14.42453476, 121.04139976  | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.42453476%2C121.04139976) |
| Plaza D Parking Area ? `overture:16cda62a-9345-4725-939d-2de50a51bdad`             | 14.42596, 121.0397         | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.42596%2C121.0397)        |
| Westgate Center Open Parking ? `overture:4818cea1-7ea9-4314-b4a5-3b96f453f732`     | 14.420671, 121.036333      | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.420671%2C121.036333)     |
| Bridgeway Pay Parking ? `overture:6d2b6ae8-561e-4d9d-84e6-55417eb572ff`            | 14.41867305, 121.04020267  | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.41867305%2C121.04020267) |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

### maginhawa-sample

Priority 11. Contrasting investigation sample; no validated commercial ranking.

Weeknight and weekend dining periods; account for resident access and current curb rules.

| Candidate and source ID                                                        | Source latitude, longitude | Navigation/search                                                                           |
| ------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------- |
| IBM Parking ? `osm:node/1014439154:Point`                                      | 14.6562944, 121.055213     | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.6562944%2C121.055213)    |
| Parking Area ? `overture:3ce10624-e38d-47c3-a82e-2f5457d02137`                 | 14.65681337, 121.05543014  | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.65681337%2C121.05543014) |
| UP Ayala Technohub Parking 2 ? `overture:3aee49f6-5718-4786-b233-f1de45e4c857` | 14.65672655, 121.05609071  | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.65672655%2C121.05609071) |
| Architecture ? `osm:node/2672516236:Point`                                     | 14.6521944, 121.0646389    | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.6521944%2C121.0646389)   |
| DCS Parking ? `osm:way/509622981:MultiPolygon`                                 | 14.64798235, 121.0685089   | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.64798235%2C121.0685089)  |
| Quezon Circle Carpark ? `osm:way/98592435:MultiPolygon`                        | 14.64911055, 121.05000815  | [Source anchor](https://www.google.com/maps/search/?api=1&query=14.64911055%2C121.05000815) |

All candidates in this pocket remain unverified and unapproved. The checklist/form
provides their individual established facts, unresolved issues and exact on-site
questions. Proposed time windows are sampling choices, not confirmed hours.

## Genuine human handoff

Only actual site observations, consenting driver interviews, authorized operator
conversations, accountable legal/commercial decisions and final launch/publication
selection remain human work. The form is not an interview or evidence of current
usable supply. After the first wave, compare actual access/entrance/operation
findings and refine the sample before commissioning a commercial launch ranking.
The machine-readable Phase 1 gate report remains blocked on these outcomes.
