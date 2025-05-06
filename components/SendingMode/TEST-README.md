# SendingMode Component Test Suite

This test suite was created to diagnose and fix two specific issues in the SendingMode component:

1. **Mastery scores not being aggregated correctly**
2. **Characters from the wrong level being presented**

## Quick Start

Run all tests:

```bash
npm run test:all
```

Run only unit tests:

```bash
npm run test:unit
```

Run only E2E tests:

```bash
npm run test:e2e
```

Run E2E tests with visual UI:

```bash
npm run test:e2e:ui
```

## Root Cause Analysis

Before creating these tests, we performed a root cause analysis of the issues (see `DebuggingNotes.md`). The tests are designed to confirm these root causes and provide a regression test suite for the fixes.

### Issue 1: Mastery Scores Not Aggregating

**Suspected Root Cause:**
- The `calculatePointsForTime` function in SendingMode is not being applied correctly
- Timing inconsistencies between when characters are presented and when scores are calculated

**Tests To Verify:**
- Unit test of the points calculation formula
- E2E test of the full flow to verify points accumulate

### Issue 2: Wrong Level Characters

**Suspected Root Cause:**
- The context's state initialization logic is using the "first incomplete level" logic instead of respecting the UI-selected level
- When `state.selectedLevelId` changes, SendingMode isn't reinitializing `state.chars` and `state.charPoints` correctly

**Tests To Verify:**
- Unit test of character selection with different level inputs
- E2E test that switches between levels and verifies characters

## Test Structure

### Unit Tests
- `__tests__/components/SendingMode.test.tsx`: Tests component functions in isolation

### E2E Tests
- `e2e/sending-mode.spec.ts`: Tests the full user experience in a browser

### Configuration
- `jest.config.js`: Updated to include the new tests
- `playwright.config.ts`: Configuration for E2E testing

## What The Tests Verify

1. **Point Calculation Logic**:
   - Points scale correctly from 0 to 1 based on response time
   - Fast responses (under MIN_RESPONSE_TIME) get full points
   - Slow responses (over MAX_RESPONSE_TIME) get zero points
   - Responses in between get a linearly scaled point value

2. **Character Selection Logic**:
   - Characters are selected only from the current level's character set
   - Level switching updates the character set correctly
   - The "first incomplete level" logic doesn't override explicitly selected levels

3. **Level Switching Flow**:
   - Navigating to a specific level shows characters from that level
   - After completing a character, the next character is still from the same level
   - Levels can be changed mid-session and the character set updates correctly

## Expected Output

When the issues are fixed, all tests should pass, confirming:

1. Points are calculated correctly based on response time
2. Points accumulate with each correct answer
3. Characters are selected only from the current level
4. Level changes update the character set correctly

## Coverage Limitations

These tests focus specifically on the identified issues and may not cover:
- Every edge case in the SendingMode component
- All possible user interactions
- Cross-browser compatibility (Playwright tests run in specified browsers only)
- Performance testing

## Next Steps

After confirming the root causes with these tests:

1. Implement fixes for the identified issues
2. Run the tests to verify the fixes work
3. Consider expanding the test suite to cover more functionality