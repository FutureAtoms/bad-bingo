# Repository Guidelines

## Project Status

**Current Completion: ~50-55%** - Foundation is solid, services layer well-designed, but real-time multi-user sync and end-to-end flows have critical gaps.

**Last Audit:** 2024-12-30
**Security/Release Update:** 2025-12-30
- Added env-based Supabase config + `.env.example`
- Hardened Android network/backup settings and disabled mixed content in Capacitor
- Added security and Play Store release checklists
- Added dev-only logging for auth/push paths
- Added gitignore rules for secrets and build artifacts
- Added GCP Secret Manager upload/fetch scripts for env + Firebase configs

**Recent Fixes:** 2025-12-31
- Added auth fallback navigation so the app exits login after a session is established
- Refreshed friends list after sending requests to avoid needing an app restart

---

## 🔴 CRITICAL IMPLEMENTATION GAPS

### CRITICAL (Core Loop Incomplete)

1. **Shared bet feed isn't real:**
   - Bets are generated client-side per user and re-created on every load
   - Friends don't see the same daily batches or 2-hour windows
   - No server-side bet scheduling or batch assignment
   - **Files:** `components/SwipeFeed.tsx`, `services/bets.ts`, `services/geminiService.ts:216` (fallback still has `Math.random()`)

2. **Real-time swipe sync missing:**
   - Swipes correctly recorded in `bb_bet_participants`
   - BUT no realtime subscription for friend's swipe
   - User must refresh to see if friend swiped
   - No push notification when clash forms
   - **Files:** `components/SwipeFeed.tsx`, `services/bets.ts`, `App.tsx`

3. **Proof system partially wired:**
   - Storage paths used (not data URLs) ✅
   - BUT: `CameraProof.tsx` expects `userId`/`clashId` props that App.tsx doesn't pass
   - Signed URLs implemented ✅
   - View-once enforcement in DB ✅ but not fully tested in UI
   - Video/location/time proofs not implemented
   - No watermark overlay or anti-screenshot
   - **Files:** `components/CameraProof.tsx`, `components/ProofVault.tsx`, `services/proofs.ts`, `services/clashes.ts`, `App.tsx:815-821`

4. **Clash screen uses local AI bets:**
   - `Clash.tsx` emits incomplete `ActiveBet` objects (missing required fields)
   - Can't create real DB clashes from this data
   - **Files:** `components/Clash.tsx`, `App.tsx`

### HIGH (Major Feature Gaps)

1. **Recovery mechanics incomplete:**
   - **Beg:** Uses mock proof and auto-dare, no real dare pool
   - **Borrow:** `canBorrow()` not called, no scheduled interest accrual, repo seizure never triggered
   - **Steal:** Defense windows not enforced in UI, `defendSteal` not invoked, UI can credit coins even when `completeSteal` fails
   - **Files:** `components/BegScreen.tsx`, `components/BorrowScreen.tsx`, `components/StealMinigame.tsx`, `components/DefenseMinigame.tsx`, `services/steals.ts`, `services/economy.ts`

2. **Social/relationship depth shallow:**
   - No mutual heat confirmation UI
   - No LDR/location logic (fields exist but unused)
   - Profile-based bet personalization not backed by full profile data
   - Onboarding only collects: name, age, gender, riskProfile
   - Missing: work, school, pets, siblings, location
   - **Files:** `components/AddFriend.tsx`, `components/Profile.tsx`, `components/Onboarding.tsx`, `services/friends.ts`

3. **Economy loop gaps:**
   - Stake locking works ✅
   - Pot settlement works ✅
   - BUT: Allowance claim UI disabled
   - Transaction history is placeholder
   - No automatic interest accrual scheduler
   - **Files:** `App.tsx`, `components/Wallet.tsx`, `services/economy.ts`

4. **ChallengeFriend not wired:**
   - Group/all-friends selection exists in `services/multiplayerBets.ts`
   - UI exists in `ChallengeFriend.tsx`
   - NOT connected - props mismatch
   - **Files:** `components/ChallengeFriend.tsx`, `services/multiplayerBets.ts`, `App.tsx`

### MEDIUM (Wiring/Logic Breaks)

1. **CameraProof API mismatch:**
   ```typescript
   // CameraProof expects:
   { bet, userId, clashId, onClose, onSend: (storagePath, viewDurationHours, isViewOnce) => void }
   // App.tsx passes:
   { bet, onClose, onSend }  // Missing userId, clashId!
   ```
   - **Files:** `components/CameraProof.tsx:6-12`, `App.tsx:815-821`

2. **Same-swipe ("hairball") vs pending indistinguishable:**
   - `swipeBet()` only returns `{ clashCreated: boolean }`
   - Can't show quirky "same vote" outcomes in UX
   - **Files:** `services/bets.ts:134-237`, `components/SwipeFeed.tsx`

3. **Missing DB RPCs:**
   - Code references `increment`, `decrement`, `decrement_trust` RPCs
   - These are NOT defined in migrations - will fail in production
   - **Files:** `services/economy.ts`, `supabase/migrations/20251229000000_initial_schema.sql`

4. **Tables may not exist:**
   - Migration defines all tables, but may not have been run
   - Need to verify: `bb_clashes`, `bb_steals`, `bb_debts`, `bb_begs`, `bb_badges`, `bb_proofs`, `bb_reports`

5. **Push notification pipeline incomplete:**
   - Token storage exists ✅
   - Edge function exists (`send-push-notification`) ✅
   - BUT: No scheduled pushes for bet drops, clash alerts, steal alerts

6. **Settings toggles don't persist:**
   - Sound/haptics toggles exist in UI
   - Don't save to `bb_users` or affect audio state

7. **Age verification not implemented:**
   - Enum exists in `AppView`
   - No screen or routing

---

## Project Structure and Architecture

- Root-level app; entry is `index.tsx` and the main router is `App.tsx`.
- Screens and UI live in `components/` (SwipeFeed, Dashboard, Clash, CameraProof, Profile, etc.).
- Business logic is centralized in `services/` (auth, bets, clashes, economy, friends, proofs, steals, notifications, native, push).
- Supabase types live in `types/database.ts`; app enums/interfaces live in `types.ts`.
- Tests are in `__tests__/`, migrations in `supabase/migrations/`, mobile projects in `ios/` and `android/`.
- Voice guide in `BINGO_VOICE.md`; push setup notes in `FIREBASE_SETUP.md`.

## Build, Test, and Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Vite dev server (port 3000)
npm run build            # Production build
npm run preview          # Local preview of build
npm test                 # Run Vitest
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run cap:ios          # Open Xcode
npm run cap:android      # Open Android Studio
npm run mobile:build     # Build for mobile
npm run verify           # MANDATORY: Full verification after each task
```

## Coding Style and Naming Conventions

- TypeScript + React functional components; 2-space indentation and semicolons.
- Keep Tailwind utility classes and the existing color tokens from `index.html`.
- Add new screens by extending `AppView` in `types.ts` and wiring in `App.tsx`.

## Configuration and Secrets

- Set `VITE_GEMINI_API_KEY` in `.env.local` (NOT `GEMINI_API_KEY` or `API_KEY`).
- Supabase URL/anon key are read from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Push requires Firebase config (`android/app/google-services.json` per `FIREBASE_SETUP.md`).
- Use `scripts/gcloud-secrets-upload.sh` and `scripts/gcloud-secrets-fetch.sh` for Secret Manager workflows.
- Local edge-function env file is `secrets/edge.env` (generated by fetch script).

---

## Remaining Work Plan (Phased)

### Phase 1: Fix Critical Blockers (Day 1-2)

| # | Task | Files | Description |
|---|------|-------|-------------|
| 1.1 | Verify/create DB tables | Supabase Dashboard | Ensure `bb_clashes`, `bb_steals`, `bb_debts`, `bb_begs`, `bb_badges`, `bb_proofs`, `bb_reports` exist |
| 1.2 | Add missing DB RPCs | Migration file | Create `increment`, `decrement`, `decrement_trust` functions |
| 1.3 | Fix CameraProof props | `App.tsx`, `CameraProof.tsx` | Pass `userId`, `clashId` from App.tsx |
| 1.4 | Wire StealMinigame to DB | `StealMinigame.tsx`, `services/steals.ts` | Call `initiateSteal()`, `completeSteal()` |
| 1.5 | Remove gemini fallback random | `services/geminiService.ts:216` | Remove `friendVote: Math.random()` from fallback bets |
| 1.6 | Fix Clash.tsx bet object | `Clash.tsx` | Ensure it creates proper DB records |

### Phase 2: Complete Core Game Loop (Day 3-5)

| # | Task | Files | Description |
|---|------|-------|-------------|
| 2.1 | Add realtime bet subscription | `SwipeFeed.tsx`, `App.tsx` | Subscribe to `bb_bet_participants` changes |
| 2.2 | Add clash formation notification | `services/bets.ts` | Push + in-app notification when clash forms |
| 2.3 | Distinguish hairball vs pending | `services/bets.ts`, `SwipeFeed.tsx` | Return `matchType: 'clash' \| 'hairball' \| 'pending'` |
| 2.4 | Enable allowance claim | `Wallet.tsx` | Remove disabled state, wire to `claimAllowance()` |
| 2.5 | Wire transaction history | `Wallet.tsx`, `services/economy.ts` | Fetch from `bb_transactions` |
| 2.6 | Server-side bet generation | Edge Function | Create bet batches on schedule |

### Phase 3: Complete Recovery Mechanics (Day 6-8)

| # | Task | Files | Description |
|---|------|-------|-------------|
| 3.1 | Wire Beg with real dares | `BegScreen.tsx` | Dare pool, proof submission, reward on completion |
| 3.2 | Wire Borrow with `canBorrow()` | `BorrowScreen.tsx` | Check limits before borrowing |
| 3.3 | Implement interest accrual scheduler | Edge Function | Daily 10% compound interest |
| 3.4 | Implement repo seizure | Edge Function | Auto-seize when debt > 7 days overdue |
| 3.5 | Fix steal defense flow | `StealMinigame.tsx`, `DefenseMinigame.tsx` | Enforce 16s window, call `defendSteal()` |

### Phase 4: Profile & Relationship Enrichment (Day 9-11)

| # | Task | Files | Description |
|---|------|-------|-------------|
| 4.1 | Expand Onboarding | `Onboarding.tsx` | Add work/school/pets/siblings/location screens |
| 4.2 | Make Profile editable | `Profile.tsx` | Allow editing all fields |
| 4.3 | Heat level mutual consent | `AddFriend.tsx`, `services/friends.ts` | Both users confirm heat level |
| 4.4 | 24h heat change cooldown | `services/friends.ts` | Prevent rapid changes |
| 4.5 | Location/LDR detection | `services/friends.ts`, `services/native.ts` | Compare user locations |
| 4.6 | LDR-specific bets | `services/geminiService.ts` | Different bets for LDR friends |

### Phase 5: Scheduled Bets & Notifications (Day 12-14)

| # | Task | Files | Description |
|---|------|-------|-------------|
| 5.1 | Server-side bet batching | Edge Function cron | 3x daily batches |
| 5.2 | 2-hour expiry windows | `services/bets.ts`, `SwipeFeed.tsx` | Countdown timer |
| 5.3 | Push for bet drops | Edge Function | "New bets dropped!" notification |
| 5.4 | Push for clash alerts | `services/bets.ts` | "You have a clash!" notification |
| 5.5 | Deep linking | `NotificationCenter.tsx`, `App.tsx` | Tap → navigate to screen |
| 5.6 | Wire ChallengeFriend | `ChallengeFriend.tsx`, `services/multiplayerBets.ts` | Connect UI to service |

### Phase 6: Safety & Moderation (Day 15-17)

| # | Task | Files | Description |
|---|------|-------|-------------|
| 6.1 | Age verification screen | New `AgeVerification.tsx` | 18+ gate on first launch |
| 6.2 | Route age verification | `App.tsx` | Check and redirect |
| 6.3 | AI content moderation | `services/geminiService.ts` | Filter custom bets |
| 6.4 | Report mechanism UI | New `ReportModal.tsx` | Report bets/proofs/users |
| 6.5 | Settings persistence | `Settings.tsx`, `services/auth.ts` | Save to `bb_users` |

### Phase 7: Polish & Addiction Mechanics (Day 18-22)

- Video capture (5-15 seconds)
- Location/time proofs with metadata
- Proof watermark overlay
- Anti-screenshot detection
- Sound effects library
- Elaborate haptic patterns
- Variable reward animations
- Sarcastic notification pool from BINGO_VOICE.md
- Badge automation

### Phase 8: Production Readiness (Day 23-28)

- All tests passing >70% coverage
- Remove console.log statements
- Error boundaries
- Loading states (skeleton loaders)
- Offline mode handling
- Performance optimization
- Security review (RLS, input sanitization)
- App store assets

---

## Key File-to-Gap Mapping

| File | Issue | Priority |
|------|-------|----------|
| `App.tsx:815-821` | Missing `userId`/`clashId` props for CameraProof | CRITICAL |
| `services/geminiService.ts:216` | `friendVote: Math.random()` in fallback | CRITICAL |
| `StealMinigame.tsx` | UI only, doesn't call `initiateSteal()`/`completeSteal()` | CRITICAL |
| `Clash.tsx` | Emits incomplete ActiveBet, can't create real DB clashes | CRITICAL |
| `SwipeFeed.tsx` | No realtime subscription for friend swipes | HIGH |
| `services/bets.ts:134-237` | Can't distinguish hairball vs pending | HIGH |
| `services/economy.ts` | References undefined RPCs (`increment`, `decrement`) | HIGH |
| `Wallet.tsx` | Allowance claim disabled, history placeholder | MEDIUM |
| `BegScreen.tsx` | Fake dares, no real dare pool | MEDIUM |
| `BorrowScreen.tsx` | `canBorrow()` not called | MEDIUM |
| `DefenseMinigame.tsx` | `defendSteal()` not invoked | MEDIUM |
| `AddFriend.tsx` | Expects `user` prop not passed | MEDIUM |
| `Settings.tsx` | Toggles don't persist to DB | LOW |

---

## Feature Status Matrix

| Feature | Backend | Frontend | Wired | Notes |
|---------|---------|----------|-------|-------|
| User Auth | ✅ | ✅ | ✅ | Working |
| Profile CRUD | ✅ | 🟡 | 🟡 | Not editable |
| Friends List | ✅ | ✅ | ✅ | Working |
| Bet Generation | ✅ | ✅ | 🟡 | Client-side only |
| Swipe Recording | ✅ | ✅ | ✅ | Working |
| Clash Creation | ✅ | ✅ | ✅ | Working |
| Stake Locking | ✅ | ✅ | ✅ | Working |
| Proof Upload | ✅ | 🟡 | 🔴 | Props mismatch |
| Proof View-once | ✅ | 🟡 | 🟡 | DB works, UI untested |
| Clash Resolution | ✅ | ✅ | ✅ | Working |
| Allowance Claim | ✅ | 🔴 | 🔴 | UI disabled |
| Transaction History | ✅ | 🔴 | 🔴 | Placeholder |
| Steal Initiate | ✅ | 🔴 | 🔴 | Not wired |
| Steal Defense | ✅ | 🔴 | 🔴 | Not wired |
| Beg Flow | 🟡 | 🟡 | 🔴 | Fake dares |
| Borrow Flow | ✅ | 🟡 | 🔴 | canBorrow unused |
| Push Notifications | ✅ | ✅ | 🟡 | No scheduled pushes |
| Heat Mutual Consent | 🔴 | 🔴 | 🔴 | Not implemented |
| Video Proofs | 🔴 | 🔴 | 🔴 | Not implemented |

---

## Commit and Pull Request Guidelines

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`).
- PRs include a summary, linked issues, screenshots for UI changes, and config/env notes.
- MANDATORY: Run `npm run verify` before committing.
- MANDATORY: Update this file when completing tasks.
