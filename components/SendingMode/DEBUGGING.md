# SendingMode Debugging Guide

After comparing the code in our branch with the master branch, here are specific areas to check to fix the two main issues.

## Issue 1: Mastery scores not being aggregated/calculated correctly

### Key Difference:
- In the master branch, the audio and timing is managed directly without a hook
- Master's implementation holds key state in refs (`keyStateRef` and `sendQueueRef`)

### Debugging Steps:

1. Add console logs in the `handleCharacter` function to verify timing:

```javascript
const handleCharacter = useCallback((char: string) => {
  // Log timing information
  console.log(`[DEBUG] Received character: ${char}, target: ${currentCharRef.current}`);
  console.log(`[DEBUG] charStartTime: ${charStartTime}`);
  console.log(`[DEBUG] Response time: ${charStartTime ? (Date.now() - charStartTime) : 'N/A'}`);
  
  // ...rest of the function
}, [/* deps */]);
```

2. Check if `charStartTime` is being set properly when a new character is shown:

```javascript
// Present next question
const nextQuestion = useCallback(() => {
  const nextChar = pickNextChar();
  console.log(`[DEBUG] Next character selected: '${nextChar}'`);
  console.log(`[DEBUG] Setting charStartTime to current time`);
  
  // Set the start time for response time tracking
  const now = Date.now();
  setCharStartTime(now);
  console.log(`[DEBUG] charStartTime set to: ${now}`);
  
  // ...rest of the function
}, [/* deps */]);
```

3. Verify the points calculation:

```javascript
// Add this at the top of the calculatePointsForTime function
console.log(`[DEBUG] Calculating points for response time: ${responseTime}ms`);
```

## Issue 2: Characters from other levels being presented incorrectly

### Key Difference:
- Master implementation adds an extra check when switching levels
- Master has a more explicit level change effect

### Debugging Steps:

1. Add console logs in the level initialization effect:

```javascript
// Ensure level characters are correctly loaded on mount
useEffect(() => {
  if (currentLevel && state.chars.length > 0) {
    console.log('[DEBUG] Checking level characters on mount/update');
    console.log('[DEBUG] Current level:', state.selectedLevelId);
    console.log('[DEBUG] Expected chars:', currentLevel.chars);
    console.log('[DEBUG] Actual chars:', state.chars);
    
    // Compare arrays to see if they have the same characters
    const sameLength = levelChars.length === stateChars.length;
    const allCharsPresent = levelChars.every(c => stateChars.includes(c));
    const noExtraChars = stateChars.every(c => levelChars.includes(c));
    
    console.log('[DEBUG] Same length?', sameLength);
    console.log('[DEBUG] All chars present?', allCharsPresent);
    console.log('[DEBUG] No extra chars?', noExtraChars);
    
    // ...rest of the function
  }
}, [currentLevel, state.chars, state.selectedLevelId, selectLevel]);
```

2. Add logging in the character selection function:

```javascript
// In pickNextChar function
console.log('[DEBUG] Picking next character');
console.log('[DEBUG] Available chars:', state.chars);
console.log('[DEBUG] Current charPoints:', state.charPoints);
console.log('[DEBUG] Recently mastered:', recentlyMasteredCharRef.current);
// Then return selectNextCharacter result
```

## Debugging in the Browser

Here's how to use the debug-helper.js script:

1. Open your browser console
2. Add this code to expose internal state:

```javascript
// In the browser console
window.__sendingModeState = {
  appState: null, // Will be populated
  level: null,    // Will be populated
  timing: {}
};
```

3. Run these commands when testing:

```javascript
// In the browser console
ditDebugHelp()             // Show available commands
showMasteryStatus()        // Check mastery status
monitorCharPoints()        // Track points updates in real-time
hookKeyEvents()            // Monitor key events
```

## Master Branch Key Implementation Notes

The master branch does these key things differently:

1. Manages key state directly with refs to avoid stale closures
2. Processes morse code directly with timing-based gaps
3. Handles word detection with specific timing thresholds
4. Uses direct DOM event listeners rather than a hook
5. Has a simpler audio implementation

The easiest way to fix this might be to revert to the master implementation, but if you prefer to keep the hook approach, focus on these areas:

1. Make sure the `state.chars` matches the current level chars 
2. Verify the response timing calculation
3. Check that key events are properly captured
4. Ensure character mastery is tracked consistently

## Browser Console Commands

Run these in your browser console to debug:

```javascript
// Show character points
console.table(window.__sendingModeDebug.state.charPoints);

// Show current level chars
console.log(window.__sendingModeDebug.state.chars);

// Track key state
document.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
    console.log(`DEBUG KEY DOWN: ${e.key}`);
  }
});

document.addEventListener('keyup', e => {
  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
    console.log(`DEBUG KEY UP: ${e.key}`);
  }
});
```