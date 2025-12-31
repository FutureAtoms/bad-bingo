# Play Store Release Checklist

## Build and Config
- [ ] Required: Update `versionCode` and `versionName` in `android/app/build.gradle`.
- [ ] Required: Set `minifyEnabled true` and `shrinkResources true` for release builds.
- [ ] Required: Configure release signing (keystore, `signingConfigs`).
- [ ] Required: Verify `targetSdkVersion` meets Play Store requirements.
- [ ] Required: Disable mixed content and cleartext traffic for release.
- [ ] Required: Remove debug logs and test flags before shipping.

## App Assets
- [ ] Required: App icon, adaptive icon, and splash screens reviewed.
- [ ] Required: 2-8 phone screenshots, 7-inch + 10-inch tablet screenshots (if tablet supported).
- [ ] Required: Feature graphic (1024x500) and promo text.

## Play Console Setup
- [ ] Required: App listing (title, short + full description).
- [ ] Required: Content rating questionnaire completed.
- [ ] Required: Target audience + age gate declared correctly (18+).
- [ ] Required: Data safety form completed and matches actual data usage.
- [ ] Required: Privacy policy URL added and publicly accessible.
- [ ] Required: In-app purchase declarations (if applicable).

## Compliance and Policies
- [ ] Required: Verify camera, location, and notifications are justified.
- [ ] Required: Confirm user-generated content reporting flows.
- [ ] Required: Enforce proof retention and report abuse handling.
- [ ] Required: Verify any gambling-like mechanics comply with policies.

## QA and Release
- [ ] Required: Run `npm run verify` and fix all failures.
- [ ] Required: Full device test on Android 12, 13, and 14.
- [ ] Required: Validate push notifications (foreground/background/quit).
- [ ] Required: Verify deep links for OAuth and notifications.
- [ ] Required: Verify offline behavior and error states.
- [ ] Required: Upload `.aab` (not `.apk`) to internal testing track first.
