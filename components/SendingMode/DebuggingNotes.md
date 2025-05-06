# SendingMode Debugging Notes

## Current Issues

### Issue 1: Mastery scores not being aggregated/calculated correctly

**Root Cause Analysis:**
- While `calculatePointsForTime` function in SendingMode looks similar to TrainingMode, there are subtle differences in how they're applied.
- SendingMode processes response time in milliseconds until the calculation, whereas TrainingMode uses seconds throughout.
- The formula in SendingMode (line 208-214):
  ```javascript
  const calculatePointsForTime = useCallback((responseTime: number) => {
    const seconds = responseTime / 1000;
    if (seconds <= MIN_RESPONSE_TIME) return 1;
    if (seconds >= MAX_RESPONSE_TIME) return 0;
    
    // Linear scale between min and max response times
    return 1 - ((seconds - MIN_RESPONSE_TIME) / (MAX_RESPONSE_TIME - MIN_RESPONSE_TIME));
  }, []);
  ```
- The calculation should be scaling points between 0 and 1 based on response time
- There may be an issue with `charStartTime` not being set correctly or timing issues in the callbacks.

### Issue 2: Characters from other levels are being presented incorrectly

**Root Cause Analysis:**
- Characters from level 4 (the lowest uncompleted level) are being presented regardless of selected level
- In private window with no completed levels, only level 1 characters appear
- This strongly suggests the character selection is tied to the "first incomplete level" logic, not the UI-selected level

**Key evidence:**
1. In AppStateContext.tsx (lines 130-147), there's logic to select the first incomplete level during initialization:
   ```javascript
   // Determine initial selected level: first incomplete or last
   if (trainingLevels.length > 0) {
     const firstIncomplete = trainingLevels.find(
       level => !initialState.completedLevels.includes(level.id)
     );
     
     const selectedLevel = firstIncomplete 
       ? firstIncomplete
       : trainingLevels[trainingLevels.length - 1];
       
     initialState.selectedLevelId = selectedLevel.id;
     
     // Set the character set to match the selected level
     initialState.chars = [...selectedLevel.chars];
   }
   ```

2. Both SendingMode and TrainingMode are using the same `selectNextCharacter` utility function, but with different outcomes.

3. The issue appears when:
   - In a browser with levels 1-3 completed, level 4 is the lowest incomplete level
   - Characters from level 4 appear regardless of selected level
   - In a private window (no completed levels), only level 1 characters appear

4. When switching levels in the UI, the context state (`state.chars` and `state.charPoints`) might not be correctly reinitializing for the new level.

## Preliminary Testing Ideas

1. **For Issue 1 (Mastery Scoring):**
   - Add console.log statements to track `charStartTime`, `responseTime`, and the result of `calculatePointsForTime`
   - Verify that timing measurements are consistent between when characters are presented and when they're calculated

2. **For Issue 2 (Wrong Level Characters):**
   - Track the actual characters presented vs. expected characters for the selected level
   - Check if `state.chars` and `currentLevel.chars` are properly synchronized when switching levels
   - Investigate if the character selection logic is improperly defaulting to the first incomplete level's character set

## Comparison with TrainingMode

TrainingMode correctly handles both issues:
1. It properly calculates points based on response time
2. It correctly presents characters from the selected level

Key differences to investigate:
- How the level initialization happens when switching levels
- How character points are updated and tracked
- How the level selection affects the character set

This is likely a synchronization or state management issue rather than a bug in the algorithms themselves, as the same selection utility is used by both components.