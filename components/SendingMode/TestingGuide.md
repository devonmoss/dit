# SendingMode Testing Guide

This guide documents the test suite created to diagnose and fix issues in the SendingMode component.

## Issues Being Tested

1. **Issue 1: Mastery scores are not being aggregated correctly**
   - The component isn't properly calculating and accumulating mastery scores based on response time
   - Tests focus on the points calculation logic and state updates

2. **Issue 2: Characters from other levels are being presented**
   - Characters from the wrong level (usually the first incomplete level) are appearing instead of characters from the selected level
   - Tests verify that the correct character set is used for each level

## Test Approach

We've implemented a two-tier testing strategy:

1. **Unit Tests with Jest**: Testing core component logic in isolation
2. **E2E Tests with Playwright**: Testing the full user flow in a browser environment

## Running the Tests

### Prerequisites

Before running tests, install the required dependencies:

```bash
npm install
npx playwright install
```

### Unit Tests (Jest)

To run the unit tests:

```bash
npm run test:unit
```

This runs the test in `__tests__/components/SendingMode.test.tsx` which focuses on:
- Testing the point calculation formula for correct scaling
- Validating the character selection logic uses the right level's characters
- Checking that level changes properly update the character set

### E2E Tests (Playwright)

To run the E2E tests:

```bash
npm run test:e2e
```

This runs the tests in `e2e/sending-mode.spec.ts` which test:
- Full user flow of selecting characters and sending Morse code
- Correct character selection based on the current level
- Proper handling of level switching

For a visual/interactive test mode:

```bash
npm run test:e2e:ui
```

## Test Explanation

### Unit Tests (SendingMode.test.tsx)

1. **Points Calculation Test** 
   - Verifies the `calculatePointsForTime` formula works correctly
   - Tests various response times from very fast to very slow
   - Ensures the points scale properly between 0 and 1

2. **Character Selection Test**
   - Verifies that `selectNextCharacter` returns characters only from the specified level
   - Tests selection across multiple levels to ensure level-specific characters

3. **Level Switching Test**
   - Tests that changing levels properly updates the character set
   - Verifies that the UI and state stay synchronized when changing levels

### E2E Tests (sending-mode.spec.ts)

1. **Mastery Score Test**
   - Tests the full flow of sending characters and accumulating points
   - Sends multiple characters and verifies points increase correctly

2. **Level-Specific Character Test**
   - Sets up completed levels to test behavior with incomplete levels
   - Verifies characters come from the selected level, not the first incomplete level
   - Tests explicitly navigating to different levels

3. **Level Switching Test**
   - Tests the full flow of switching between levels
   - Verifies characters change appropriately when level changes

## Expected Behavior

After fixing the issues, the tests should confirm:

1. **For Issue 1:**
   - Points calculation scales correctly based on response time (faster = more points)
   - Points accumulate across multiple correct answers for the same character
   - Points persist correctly in the application state

2. **For Issue 2:**
   - Only characters from the selected level appear during practice
   - Explicitly navigating to a different level changes the character set correctly
   - The "first incomplete level" logic doesn't override the explicitly selected level

## Test Helper Functions

The E2E tests include helper functions for:
- Clearing and setting up localStorage to test different scenarios
- Simulating Morse code input by pressing arrow keys
- Checking the debug panel to verify internal state
- Managing level navigation and character verification

## Troubleshooting

If tests fail, look for:

1. Timing issues - Adjust timeouts if animations or transitions cause flakiness
2. Selector changes - Update CSS selectors if the component HTML structure changes
3. State inconsistencies - Check if the app state is properly initializing for each test

## Future Enhancements

The test suite could be expanded to include:
- Testing different response time scenarios more thoroughly
- Testing edge cases like browser refresh and session persistence
- Testing accessibility features
- Adding visual regression tests to catch UI issues