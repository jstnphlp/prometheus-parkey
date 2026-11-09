# A3 parking details and data trust

**PASS for locally executable engineering checks.** Branch `codex/v1-a3-parking-data-trust`, [draft PR #26](https://github.com/jstnphlp/prometheus-parkey/pull/26). Implementation `4388ada`, final native test entry `0763bc9`. Depends on unmerged A0/A1/A2 draft PRs. No production or data-publication approval is granted.

## Implemented

- Unnamed garages, lots and streets retain actual classifications. Conflicting fee flags/amounts stay unknown, cannot match Free and retain raw evidence. Conflicting schedules suppress computed Open/Closed claims. Equivalent currency/hour spelling is accepted. Conflicting access retains its restriction; missing verification dates and malformed amenity counts remain unknown. No total capacity or vacancy claim.
- Legacy initial directions, retry, resume, next-parking, rerouting and external Maps handoff require fresh public entrance authorization. Exact identity or unambiguous canonical OSM identity must match. Entrance membership, expiry, visitor/operator approval, access and lifecycle restrictions remain mandatory. Network failure, timeout, cancellation, ambiguous/missing/revoked/expired records fail closed. No source anchor, map center, cache or generic shared website grants a route. Pilot targeted fresh lookup remains intact.
- Both discovery experiences share the reviewed photo catalog. Raw image/Commons/Mapillary tags and nearby images cannot publish photos. Known source identity takes precedence over reused IDs. Safe HTTPS URLs, credit, license and location matching are required. Eight-second image deadlines, resource keys and disposed attempts prevent stale image resurrection; source-link failures remain recoverable.
- **The approved catalog remains empty.** No actual photo, price, entrance or permission was invented. Future additions need documented licensing, credit, original source and exact location review. Source import/date is not field verification or proof of current conditions.

## Executed gate

| Check                                          | Result                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| Mobile unit suite                              | 242 passed, zero failures                                                   |
| Mobile/browser-test TypeScript                 | Passed                                                                      |
| Discovery/native harness/browser-test ESLint   | Passed, zero warnings                                                       |
| Scoped Prettier                                | Passed                                                                      |
| Browser trust/directions/unapproved navigation | 22 passed, desktop and mobile Chromium                                      |
| Full pilot browser regression                  | 36 passed, desktop and mobile Chromium                                      |
| API35 native trust matrix                      | Seven states passed with screenshots, layouts and behavioral tap assertions |

The [receipt](evidence/v1-a3-api35/receipt.json) binds screenshots and logs to hashes/source. Real `ParkingDetails` and `ParkingGallery` components run through an isolated development-only Metro entry, never a consumer route/backend. Screenshots say **SIMULATED NATIVE QA ONLY**. Known, missing, contradictory, restricted, expired, revoked and image-failure states passed. Go invoked its test callback only for current authorized fixtures; blocked states stayed at zero. Image failure retained fallback and test credit/license. No native/JS fatal error occurred in the cleared matrix log interval. This proves UI behavior, not actual parking approval.

Environment: Windows11, Parkey_A0_API35, Android15/API35/google APIs x86_64, emulator-5556, host NVIDIA RTX2050 GPU, WHPX, two cores/2048MiB, 720x1600/280dpi override. Reused version0.1.0/code2 development APK with current Metro JavaScript; SHA256 `d44de93e814045e42232de704d317d7556902031213ae68fe7c371dcd1149d47`. No newly built production APK is claimed.

## Reproduce and limitations

Start development Metro on localhost8096 with one worker and dotenv disabled. Run `python scripts/android_native_trust.py`, reverse ADB ports8096/8102, **force-stop** the development client and open `parkey://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8102`. Select QA states and tap Go; the counter must stay zero for missing/restricted/expired/revoked. Wait for image failure. Force-stop/reopen the ordinary localhost8096 manifest to return to discovery.

Before final evidence, corrected Windows UTF-8 decoding in the evidence reader and an incorrect assumption that the CLI exports enabled state. Real taps now verify suppression. Switching a running dev client between manifests hit an Expo dev-launcher React-context exception; force-stop before switching avoids it. This remains a development-client limitation, not evidence of production stability. One new unit fixture initially retained `sourceKind: sample`; correcting it to its intended OSM source made all242 pass. Assertions were not weakened.

Physical Android/iOS, production native build/provider validation, field/operator evidence, approved photographs, privacy/provider approval and external PR review remain release requirements. No admin repository, production database, deployment or analytics collection changed. A4 is next.

## Navigation review follow-up

Independent A4 review found delayed approval/consent/GPS responses could act after route exit, and rerouting did not update its stored arrival target when a reviewed entrance changed. These are fixed on the A3 branch in `613ab27`: route exit aborts fresh checks, context/generation fences cover lookup and consent dismissal, location completion checks the actual routing cancellation signal, and fresh reroutes update the target. Persisted consent and nearby-card directions remain supported. An independent scoped re-review found no remaining must-fix issue. Ten added desktop/mobile browser executions passed (five cases); mobile typecheck, scoped ESLint and242 units also passed. The receipt records the exact command and retained final runner stdout chunk. The native component matrix is unchanged; it never claimed to test these asynchronous navigation races. A3 CI at `e93656a` was green for validation/database/E2E; follow-up CI runs on this PR.

### Test setup stability follow-up

CI recovered two race-test setup failures on retry: a canceled response body was read late through CDP, and direct-link hydration did not always give the assumed Back history. Test-only follow-up `1686699` serves a validated synthetic record directly and opens selected parking through real map UI navigation; every original safety assertion remains. Twenty executions passed with two workers, repeat2 and retries0 on the A4 integration containing the same A3 navigation implementation. The raw log and source distinction are in the receipt. A preceding cold standalone stress run had28passes and two development Bundling timeouts before map assertions; retained in A4 evidence, not represented as passing or as a physical-device benchmark. No app timeout or assertion was increased.
