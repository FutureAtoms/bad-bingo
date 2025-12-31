# Bad Bingo Security Checklist

Use this as a living checklist. Items marked "Required" are expected for a production release.

## Secrets and Configuration
- [ ] Required: Store all secrets in environment variables (`.env.local`) and never commit them.
- [ ] Required: Remove tracked secrets from git history (client secret JSON, keystores, APKs).
- [ ] Required: Rotate Supabase anon keys and OAuth client secrets after removal.
- [ ] Required: Use separate Supabase projects/keys for dev vs prod.

## Authentication and Authorization
- [ ] Required: Verify Supabase RLS policies for every table and storage bucket.
- [ ] Required: Confirm RLS denies cross-user access for `bb_*` tables.
- [ ] Required: Ensure storage buckets are private and accessed via signed URLs.
- [ ] Required: Review OAuth redirect URIs for exact match and least privilege.

## Data Protection
- [ ] Required: Encrypt sensitive proof metadata at rest if policy requires it.
- [ ] Required: Enforce proof retention and automatic deletion schedules.
- [ ] Required: Validate proof upload paths (no data URLs, no public URLs).
- [ ] Optional: Add watermark + anti-screenshot enforcement for proofs.

## Client Security
- [ ] Required: Disable cleartext traffic (Android) and mixed content (Capacitor).
- [ ] Required: Disable Android backups for app data with tokens.
- [ ] Required: Strip debug logs in production builds.
- [ ] Required: Remove CDN script/style dependencies or add SRI + strict CSP.
- [ ] Optional: Add runtime app integrity checks (Play Integrity / SafetyNet).
- [ ] Optional: Add certificate pinning for Supabase and push endpoints.

## Network and Abuse Controls
- [ ] Required: Add rate limiting for auth, bet creation, and proof endpoints.
- [ ] Required: Add abuse monitoring for spam, bot activity, and brute force.
- [ ] Optional: Add IP/device fingerprinting for anomalous activity.

## Monitoring and Incident Response
- [ ] Required: Centralize error reporting (Sentry/Crashlytics).
- [ ] Required: Define security contact and incident response process.
- [ ] Optional: Add audit logs for admin actions and moderation.

## Dependency and Build Security
- [ ] Required: Run `npm audit` and fix high/critical issues.
- [ ] Required: Lock dependency versions and review transitive updates.
- [ ] Required: Enable ProGuard/R8 for release builds.
- [ ] Optional: Add automated dependency scanning in CI.

## Privacy and Compliance
- [ ] Required: Publish privacy policy and data retention policy.
- [ ] Required: Ensure age-gate logic is enforced for 18+ requirement.
- [ ] Required: Provide data export and deletion path for users.
