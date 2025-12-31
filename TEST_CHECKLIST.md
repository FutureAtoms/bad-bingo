# Bad Bingo - Manual Test Checklist

Run through each test and mark [x] when passed.

## 1. Authentication & Onboarding

### Login
- [ ] App launches to login screen
- [ ] Google Sign-In button visible and tappable
- [ ] After Google auth, redirects to onboarding (new user) or swipe feed (existing user)

### Onboarding (New Users)
- [ ] Chat-style interrogation flow works
- [ ] All questions display correctly
- [ ] Risk profile generated at end
- [ ] Navigates to Tutorial after completion

### Tutorial (First-Time)
- [ ] Tutorial shows automatically after onboarding
- [ ] All 8 steps display correctly
- [ ] "Next" button advances steps
- [ ] "Back" button goes to previous step
- [ ] "Skip tutorial" link works
- [ ] "Let's Go!" on final step navigates to Swipe Feed
- [ ] Tutorial doesn't show again on next login

---

## 2. Navigation - Back Buttons

### From Profile (Criminal Record)
- [ ] Tap "You" in bottom nav to open Profile
- [ ] Back arrow (←) is visible in top-left
- [ ] **Back arrow is large enough to tap (48x48 touch target)**
- [ ] Tapping back arrow returns to Swipe Feed

### From Wallet (Stash)
- [ ] Tap "Stash" in bottom nav to open Wallet
- [ ] Back arrow (←) is visible in top-left
- [ ] **Back arrow is large enough to tap (48x48 touch target)**
- [ ] Tapping back arrow returns to Swipe Feed

### From Steal (Heist) Target Selection
- [ ] Tap "Heist" in bottom nav
- [ ] Friend selection screen appears
- [ ] Back arrow (←) is visible in top-left
- [ ] **Back arrow is large enough to tap (48x48 touch target)**
- [ ] Tapping back arrow returns to Swipe Feed

### From Rules (House Rules)
- [ ] Open Profile → Tap "House Rules"
- [ ] Rules page opens
- [ ] Back arrow (←) is visible in top-left
- [ ] **Back arrow is large enough to tap (48x48 touch target)**
- [ ] Tapping back arrow returns to Swipe Feed

### From Add Friend
- [ ] From Dashboard, tap "Recruit Another Victim"
- [ ] Add Friend screen opens
- [ ] Close button (×) is visible in top-left
- [ ] Tapping close returns to Swipe Feed

### From Clash (Arena)
- [ ] From Dashboard, tap "THROW DOWN" on a friend
- [ ] Clash screen opens
- [ ] Close button (×) is visible in top-left
- [ ] Tapping close returns to Swipe Feed

---

## 3. Bottom Navigation

### All Tabs Work
- [ ] "Arena" (fire icon) → Opens Swipe Feed
- [ ] "Pride" (users icon) → Opens Dashboard
- [ ] "Heist" (mask icon) → Opens Steal target selection
- [ ] "Stash" (wallet icon) → Opens Wallet
- [ ] "You" (cat icon) → Opens Profile

### Active State
- [ ] Current tab is highlighted in acid-green
- [ ] Other tabs are gray

---

## 4. Swipe Feed (Arena)

### Display
- [ ] Bet cards display with opponent info
- [ ] Stake amount shown
- [ ] Progress bar shows current position

### Swiping
- [ ] Swipe left shows "NAH" indicator
- [ ] Swipe right shows "BET!" indicator
- [ ] Card animates off screen on swipe
- [ ] New card appears after swipe

### Match/No Match
- [ ] Disagreement shows "CLAWS OUT!" overlay
- [ ] Agreement shows "yawns" overlay
- [ ] Vibration feedback on match

---

## 5. Dashboard (Pride)

### Display
- [ ] Bingo stash header shows correct balance
- [ ] Friend requests section (if any)
- [ ] Active bets section (if any)
- [ ] Friend list with relationship levels

### Beg Borrow Steal Buttons
- [ ] BEG button visible with cyan color
- [ ] BORROW button visible with pink color
- [ ] STEAL button visible with red color
- [ ] All three in a row (3-column grid)

### Friend Actions
- [ ] "THROW DOWN" button opens Clash
- [ ] "ROB 'EM" button opens Steal minigame

### Accept/Reject Friends
- [ ] Accept button (✓) accepts friend request
- [ ] Reject button (×) removes request

---

## 6. Steal Minigame

### Countdown
- [ ] 3-2-1 countdown before game starts

### Gameplay
- [ ] 60-second timer visible
- [ ] Tap counter shows progress (0/50)
- [ ] Potential loot % increases with taps
- [ ] Progress bar fills as you tap
- [ ] Paw button registers taps
- [ ] Vibration on each tap

### Defense Warning
- [ ] Red warning overlay appears during game
- [ ] 16-second defense timer shown
- [ ] Warning says target might check phone
- [ ] UI turns red during warning

### Outcomes
- [ ] **WIN**: Complete 50 taps → "CLEAN HEIST!" screen
- [ ] **TIMEOUT**: Timer expires → "TIME'S UP!" screen
- [ ] **CAUGHT**: Target catches you → "CAUGHT!" screen with double penalty
- [ ] Win shows stolen amount and trophy image
- [ ] Caught shows penalty (2x attempted steal)

---

## 7. Profile (Criminal Record)

### Display
- [ ] Avatar and name displayed
- [ ] Risk profile quote shown
- [ ] Stats grid (wins, losses, heists, bingos)
- [ ] Badges section
- [ ] History section

### House Rules Button
- [ ] "House Rules" button visible at bottom
- [ ] Tapping opens Rules page

---

## 8. Rules Page

### Navigation Tabs
- [ ] "Basics" tab works
- [ ] "Swipe" tab works
- [ ] "Friends" tab works
- [ ] "BBS" tab works
- [ ] "Proof" tab works

### Content
- [ ] Each section has relevant rules
- [ ] Intensity levels explained
- [ ] Steal mechanics explained (60s, 16s defense, double penalty)
- [ ] Proof timers explained

---

## 9. Wallet (Stash)

### Display
- [ ] Current balance shown large
- [ ] Debt shown if applicable
- [ ] Beg/Borrow buttons (disabled)
- [ ] Daily allowance section
- [ ] Transaction history

---

## 10. Notifications

### Display
- [ ] Toast notifications appear at top
- [ ] Correct icon for type (clash, robbery, proof, system)
- [ ] Auto-dismiss after 4 seconds
- [ ] Different border colors by priority

---

## 11. Camera Proof

### Access
- [ ] Clicking "PROVE IT" on active bet opens camera

### Functionality
- [ ] Camera preview shows
- [ ] Capture button works
- [ ] Timer selection (1H, 6H, 12H)
- [ ] View-once toggle
- [ ] "TRY AGAIN" retakes photo
- [ ] "SUBMIT EVIDENCE" sends proof

---

## 12. Add Friend Flow

### Search
- [ ] Input field for name
- [ ] "LOCK TARGET" button

### Survey
- [ ] 4 questions display
- [ ] Progress bar shows position
- [ ] Options are tappable

### Result
- [ ] Intensity level shown (Declawed/Fair Game/No Mercy)
- [ ] Description generated
- [ ] "DRAG THEM INTO THIS" confirms

---

## Known Issues to Verify Fixed

1. [x] Profile back button too small → Fixed with 48x48 touch target
2. [x] Wallet back button too small → Fixed with 48x48 touch target
3. [x] Steal target selection back button too small → Fixed with 48x48 touch target
4. [x] BEG/BORROW buttons had wrong names → Renamed to BEG/BORROW/STEAL

---

## Test Environment

- Device: _______________
- Android Version: _______________
- Date: _______________
- Tester: _______________
- Build: Debug APK

---

## Notes

_Add any bugs or issues found during testing:_

