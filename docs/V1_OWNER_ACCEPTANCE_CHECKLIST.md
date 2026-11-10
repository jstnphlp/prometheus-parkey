# Parkey V1 owner acceptance checklist

Use Windows 11 and the existing Android Studio AVD `Parkey_A0_API35`:
Android 15/API 35, Google APIs x86_64, host GPU, 2 cores and 2048 MiB RAM.
The emulator binary version may be 37; the guest Android image must be API 35.
These are owner acceptance checks, not evidence of physical-device performance.

The tested local APK is `output/ncr/v1-a4/app-release-final.apk` (ignored local
artifact), SHA-256
`ec9f3f374d90465973fdca148580c9b527ab23bb95b1bb16652cc33639c0d08f`.
It is an x86_64 release variant signed with a local development key, not a
store-ready build. It contains application source `c38f130` and native config
`be2366d`; the later changes are tests, evidence and documentation. No production
search provider was supplied to this test APK. An unavailable-search message is
the expected result in that configuration.

## Check on your Windows emulator

Record any failure with the APK identity, steps, expected/actual result and a
screenshot. Reuse the installed tested build if present; avoid clearing app data
before the saved-state check.

- [ ] Open Parkey and pan/zoom the map. Parking markers and labels render; Map
      info includes OpenStreetMap/Overture attribution. No research controls or
      private candidate records appear in the release build.
- [ ] Open Search. With the test APK's missing provider, expect a clear service
      unavailable message and working Back to map. Before release, repeat with
      an approved configured provider: search a destination, select a result,
      inspect nearby parking and verify failure/retry behavior. A missing-provider
      result does not prove configured destination search works.
- [ ] Apply parking-type and price filters, including a combination with no
      matches. The empty state explains how to clear filters. Unknown fees must
      not appear as free parking; distances must not imply a driving route unless
      a route was actually calculated.
- [ ] Open parking details, then press Android Back. Details close and the map
      remains open. Check source information, restrictions and clear unknown
      fees/hours. Empty or failed photos show a fallback. The approved photo
      catalog is currently empty; photos must not be invented to fill it.
- [ ] Save and unsave a place, save a parked-car location, force-stop/reopen
      Parkey and check persistence. A saved reminder must not grant parking
      approval or imply that a space is available.
- [ ] Deny location permission and turn Location services off. Manual map
      browsing remains usable and location guidance is clear. Restore permission
      and Location services, then retry. Use the emulator's Location controls to
      set a test location; this does not verify real GPS accuracy.
- [ ] Turn both emulator Wi-Fi and mobile data off. Expect an offline notice and
      safe saved-state access. Uncached tiles/data can be unavailable. Restore
      both connections and check recovery without restarting the app.
- [ ] Try Directions only where approved access information permits it. Missing,
      restricted, expired or revoked approval must block parking navigation.
      Check parked-car Walk back opens external Google Maps. No real parking
      entrance is approved merely because this handoff works.
- [ ] Enable larger text and TalkBack. Check readable labels, focus order,
      announced controls and activation of Map/Saved/You. Listen to speech and
      assess usability personally. Restore your preferred accessibility settings.
- [ ] Confirm the app stays discovery-only: no reservation, payment, QR entry,
      inventory or guaranteed-availability flow. Analytics collection stays off.

## Obtain before production release

These do not prevent local engineering acceptance. They remain release blockers
and can be assigned to external testers or reviewers; owning a phone or Mac is
not required to carry out the Windows checklist above.

- [ ] Physical Android smoke tests, actual GPS/navigation behavior, cold/warm
      P50/P95 performance and memory measurements on representative hardware.
- [ ] Native iOS build and device/simulator checks, including VoiceOver. No iOS
      or physical Android pass has been claimed.
- [ ] Human accessibility/usability review, including TalkBack speech and
      practical touch targets on real hardware.
- [ ] Reviewed production map/search/routing/backend configuration, provider
      terms, privacy disclosures and any required consent. Keep analytics off
      until the separate canonical Track D gates are satisfied.
- [ ] Approved public parking records, verified location/access evidence and
      authorized vehicle entrances. Review actual fees/hours/restrictions and
      licensing, credits and location matching for each published photo.
- [ ] Production Android signing, required release architectures/versioning and
      store build validation; equivalent iOS signing/distribution when applicable.
- [ ] Independent code/privacy review and explicit production release approval.
      Merging PRs does not authorize deployment, hosted database changes or
      private research publication.

Gate evidence: [canonical plan](V1_EXECUTION_PLAN.md),
[A4 completion report](V1_A4_COMPLETION.md) and
[native validation receipt](evidence/v1-a4-validation/receipt.json).
