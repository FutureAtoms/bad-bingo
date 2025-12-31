#!/bin/bash

# Bad Bingo - Production Quality Verification Script
# This script MUST be run after every micro task to ensure code quality
# Exit codes: 0 = all checks pass, 1 = failures detected

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Log functions
log_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ]; then
        echo -e "${RED}Error: Must be run from project root directory${NC}"
        exit 1
    fi
}

# 1. TypeScript Compilation Check
check_typescript() {
    log_header "TypeScript Compilation Check"

    if npx tsc --noEmit 2>/dev/null; then
        log_success "TypeScript compilation: No errors"
    else
        log_failure "TypeScript compilation: Errors detected"
        npx tsc --noEmit 2>&1 | head -50
        return 1
    fi
}

# 2. ESLint Check (if configured)
check_eslint() {
    log_header "ESLint Check"

    if [ -f ".eslintrc" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]; then
        if npx eslint . --ext .ts,.tsx --max-warnings 0 2>/dev/null; then
            log_success "ESLint: No errors or warnings"
        else
            log_warning "ESLint: Issues detected (check output above)"
        fi
    else
        log_info "ESLint: Not configured, skipping"
    fi
}

# 3. Unit Tests
check_unit_tests() {
    log_header "Unit Tests"

    if npm test -- --run --reporter=verbose 2>&1; then
        log_success "Unit tests: All passed"
    else
        log_failure "Unit tests: Some tests failed"
        return 1
    fi
}

# 4. Test Coverage Check
check_coverage() {
    log_header "Test Coverage"

    COVERAGE_OUTPUT=$(npm run test:coverage -- --run 2>&1 || true)

    # Extract coverage percentages
    STATEMENTS=$(echo "$COVERAGE_OUTPUT" | grep -E "^All files" | awk '{print $4}' | tr -d '%' || echo "0")
    BRANCHES=$(echo "$COVERAGE_OUTPUT" | grep -E "^All files" | awk '{print $6}' | tr -d '%' || echo "0")
    FUNCTIONS=$(echo "$COVERAGE_OUTPUT" | grep -E "^All files" | awk '{print $8}' | tr -d '%' || echo "0")
    LINES=$(echo "$COVERAGE_OUTPUT" | grep -E "^All files" | awk '{print $10}' | tr -d '%' || echo "0")

    MIN_COVERAGE=50

    if [ ! -z "$STATEMENTS" ] && [ "$STATEMENTS" != "0" ]; then
        if (( $(echo "$STATEMENTS >= $MIN_COVERAGE" | bc -l 2>/dev/null || echo 0) )); then
            log_success "Statements coverage: ${STATEMENTS}% (min: ${MIN_COVERAGE}%)"
        else
            log_warning "Statements coverage: ${STATEMENTS}% (below ${MIN_COVERAGE}% threshold)"
        fi
    else
        log_info "Coverage data not available, ensure tests exist"
    fi
}

# 5. Build Check
check_build() {
    log_header "Build Check"

    if npm run build 2>&1; then
        log_success "Build: Successful"
    else
        log_failure "Build: Failed"
        return 1
    fi
}

# 6. Check for Required Files
check_required_files() {
    log_header "Required Files Check"

    REQUIRED_FILES=(
        "package.json"
        "tsconfig.json"
        "vite.config.ts"
        "vitest.config.ts"
        "types.ts"
        "types/database.ts"
        "services/supabase.ts"
        "services/auth.ts"
        "services/economy.ts"
        "services/bets.ts"
        "services/clashes.ts"
        "services/steals.ts"
        "services/proofs.ts"
        "services/friends.ts"
        "services/notifications.ts"
        "App.tsx"
    )

    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$file" ]; then
            log_success "Found: $file"
        else
            log_failure "Missing: $file"
        fi
    done
}

# 7. Check for Required Test Files
check_test_files() {
    log_header "Test Files Check"

    REQUIRED_TESTS=(
        "__tests__/economy.test.ts"
        "__tests__/proofs.test.ts"
        "__tests__/types.test.ts"
    )

    for file in "${REQUIRED_TESTS[@]}"; do
        if [ -f "$file" ]; then
            log_success "Found test: $file"
        else
            log_warning "Missing test: $file"
        fi
    done

    # Check for service tests
    SERVICES=("auth" "bets" "clashes" "steals" "friends" "notifications")
    for service in "${SERVICES[@]}"; do
        if [ -f "__tests__/${service}.test.ts" ] || [ -f "__tests__/services/${service}.test.ts" ]; then
            log_success "Found test: ${service}.test.ts"
        else
            log_warning "Missing test for service: ${service}"
        fi
    done

    # Check for multiplayer bets tests (CRITICAL)
    if [ -f "__tests__/multiplayerBets.test.ts" ] || [ -f "__tests__/services/multiplayerBets.test.ts" ]; then
        log_success "Found test: multiplayerBets.test.ts"
    else
        log_failure "Missing CRITICAL test: multiplayerBets.test.ts"
    fi

    # Check for notification broadcast tests
    if [ -f "__tests__/notificationBroadcast.test.ts" ] || [ -f "__tests__/services/notificationBroadcast.test.ts" ]; then
        log_success "Found test: notificationBroadcast.test.ts"
    else
        log_warning "Missing test: notificationBroadcast.test.ts"
    fi
}

# 8. Check Service Implementation Completeness
check_service_completeness() {
    log_header "Service Implementation Completeness"

    # Check economy service exports
    if grep -q "calculateStake" services/economy.ts && \
       grep -q "canClaimAllowance" services/economy.ts && \
       grep -q "claimAllowance" services/economy.ts && \
       grep -q "lockStake" services/economy.ts && \
       grep -q "awardClashWin" services/economy.ts; then
        log_success "Economy service: Core functions implemented"
    else
        log_warning "Economy service: Some core functions missing"
    fi

    # Check clashes service exports
    if grep -q "getActiveClashes" services/clashes.ts && \
       grep -q "submitProof" services/clashes.ts && \
       grep -q "viewProof" services/clashes.ts && \
       grep -q "resolveClash" services/clashes.ts; then
        log_success "Clashes service: Core functions implemented"
    else
        log_warning "Clashes service: Some core functions missing"
    fi

    # Check steals service exports
    if grep -q "initiateSteal" services/steals.ts && \
       grep -q "completeSteal" services/steals.ts && \
       grep -q "defendSteal" services/steals.ts; then
        log_success "Steals service: Core functions implemented"
    else
        log_warning "Steals service: Some core functions missing"
    fi

    # Check bets service exports
    if grep -q "getAvailableBets" services/bets.ts && \
       grep -q "createBet" services/bets.ts && \
       grep -q "swipeBet" services/bets.ts; then
        log_success "Bets service: Core functions implemented"
    else
        log_warning "Bets service: Some core functions missing"
    fi

    # Check multiplayer bets service exports (CRITICAL)
    if [ -f "services/multiplayerBets.ts" ]; then
        if grep -q "createMultiplayerBet" services/multiplayerBets.ts && \
           grep -q "notifyBetParticipants" services/multiplayerBets.ts && \
           grep -q "createBetForFriend" services/multiplayerBets.ts && \
           grep -q "createBetForGroup" services/multiplayerBets.ts && \
           grep -q "createBetForAllFriends" services/multiplayerBets.ts; then
            log_success "Multiplayer bets service: All functions implemented"
        else
            log_failure "Multiplayer bets service: Missing critical functions"
        fi
    else
        log_failure "Multiplayer bets service: File not found (services/multiplayerBets.ts)"
    fi

    # Check notification broadcasting service
    if [ -f "services/notificationBroadcast.ts" ]; then
        if grep -q "broadcastBetCreated" services/notificationBroadcast.ts && \
           grep -q "sendPushToUsers" services/notificationBroadcast.ts; then
            log_success "Notification broadcast service: Core functions implemented"
        else
            log_warning "Notification broadcast service: Some functions missing"
        fi
    else
        log_warning "Notification broadcast service: File not found"
    fi
}

# 9. Check for Common Issues
check_common_issues() {
    log_header "Common Issues Check"

    # Check for console.log in production code (excluding tests)
    CONSOLE_LOGS=$(grep -r "console.log" --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" --exclude-dir="node_modules" . 2>/dev/null | wc -l | tr -d ' ')
    if [ "$CONSOLE_LOGS" -gt 10 ]; then
        log_warning "Found $CONSOLE_LOGS console.log statements (consider removing for production)"
    else
        log_success "Console.log usage: Acceptable ($CONSOLE_LOGS statements)"
    fi

    # Check for 'any' type usage
    ANY_TYPES=$(grep -r ": any" --include="*.ts" --include="*.tsx" --exclude-dir="node_modules" . 2>/dev/null | wc -l | tr -d ' ')
    if [ "$ANY_TYPES" -gt 20 ]; then
        log_warning "Found $ANY_TYPES 'any' type usages (consider adding proper types)"
    else
        log_success "Type safety: Good ($ANY_TYPES 'any' usages)"
    fi

    # Check for TODO comments
    TODO_COMMENTS=$(grep -r "TODO" --include="*.ts" --include="*.tsx" --exclude-dir="node_modules" . 2>/dev/null | wc -l | tr -d ' ')
    if [ "$TODO_COMMENTS" -gt 0 ]; then
        log_info "Found $TODO_COMMENTS TODO comments"
    fi
}

# 10. Database Schema Check
check_database_schema() {
    log_header "Database Schema Check"

    if [ -f "supabase/migrations/20251229000000_initial_schema.sql" ]; then
        log_success "Initial migration file exists"

        # Check for required tables in migration
        REQUIRED_TABLES=("bb_users" "bb_friendships" "bb_bets" "bb_bet_participants" "bb_clashes" "bb_steals" "bb_debts" "bb_begs" "bb_badges" "bb_notifications" "bb_transactions" "bb_proofs" "bb_reports")

        for table in "${REQUIRED_TABLES[@]}"; do
            if grep -q "CREATE TABLE.*$table" supabase/migrations/20251229000000_initial_schema.sql 2>/dev/null; then
                log_success "Table defined: $table"
            else
                log_warning "Table missing in migration: $table"
            fi
        done
    else
        log_warning "Migration file not found"
    fi
}

# 11. Component Check
check_components() {
    log_header "Components Check"

    REQUIRED_COMPONENTS=(
        "components/Login.tsx"
        "components/Onboarding.tsx"
        "components/SwipeFeed.tsx"
        "components/Clash.tsx"
        "components/Dashboard.tsx"
        "components/Profile.tsx"
        "components/CameraProof.tsx"
        "components/StealMinigame.tsx"
        "components/AddFriend.tsx"
        "components/ChallengeFriend.tsx"
        "components/Rules.tsx"
        "components/WalkthroughTutorial.tsx"
    )

    for component in "${REQUIRED_COMPONENTS[@]}"; do
        if [ -f "$component" ]; then
            log_success "Component exists: $component"
        else
            log_warning "Component missing: $component"
        fi
    done

    # Check for optional but important components
    OPTIONAL_COMPONENTS=(
        "components/NotificationCenter.tsx"
        "components/ProofVault.tsx"
        "components/BegScreen.tsx"
        "components/BorrowScreen.tsx"
        "components/DefenseMinigame.tsx"
        "components/SettingsScreen.tsx"
    )

    for component in "${OPTIONAL_COMPONENTS[@]}"; do
        if [ -f "$component" ]; then
            log_success "Optional component exists: $component"
        else
            log_info "Optional component not yet implemented: $component"
        fi
    done
}

# 12. Implementation Checklist Verification
check_implementation_checklist() {
    log_header "Implementation Checklist Verification"

    # Check if App.tsx uses Supabase services
    if grep -q "localStorage" App.tsx; then
        log_warning "App.tsx still uses localStorage (should be wired to Supabase)"
    else
        log_success "App.tsx: No localStorage usage detected"
    fi

    # Check for Supabase integration
    if grep -q "supabase" App.tsx || grep -q "services/" App.tsx; then
        log_success "App.tsx: Supabase/services integration detected"
    else
        log_warning "App.tsx: Supabase integration may be missing"
    fi
}

# Summary
print_summary() {
    log_header "VERIFICATION SUMMARY"

    echo ""
    echo -e "  ${GREEN}Passed:${NC}   $TESTS_PASSED"
    echo -e "  ${RED}Failed:${NC}   $TESTS_FAILED"
    echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
    echo ""

    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  VERIFICATION FAILED - Fix issues before proceeding${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 1
    elif [ $WARNINGS -gt 5 ]; then
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}  VERIFICATION PASSED WITH WARNINGS - Review issues${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 0
    else
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  VERIFICATION PASSED - All checks successful${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 0
    fi
}

# Main execution
main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       BAD BINGO - Production Quality Verification        ║${NC}"
    echo -e "${BLUE}║            $(date '+%Y-%m-%d %H:%M:%S')                          ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"

    check_directory

    # Run all checks (continue even if some fail)
    check_required_files || true
    check_test_files || true
    check_typescript || true
    check_unit_tests || true
    check_service_completeness || true
    check_components || true
    check_database_schema || true
    check_common_issues || true
    check_implementation_checklist || true
    check_build || true

    print_summary
}

# Run with optional quick mode
if [ "$1" == "--quick" ]; then
    echo "Running quick verification (skipping build)..."
    check_directory
    check_required_files || true
    check_typescript || true
    check_unit_tests || true
    print_summary
else
    main
fi
