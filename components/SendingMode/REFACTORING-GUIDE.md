# SendingMode Refactoring Guide

This guide explains how to refactor the SendingMode component to use local state instead of the global app state for character tracking. This approach fixes the synchronization issues identified in the DebuggingNotes.md file.

## Problem Summary

The current issues with the SendingMode component are:

1. **Character Points Calculation**: Points are not being calculated/aggregated correctly
2. **Level Characters**: Characters from the wrong level are being presented

These issues stem from synchronization problems between the component and the global app state.

## Solution: Use Local State Instead of Global State

The key change is to make SendingMode use the current level's characters directly instead of relying on `state.chars` and to maintain its own local copy of character points.

## Implementation Steps

I've created two new files that implement this approach:

1. `/components/SendingMode/SendingMode.v2.tsx` - Updated SendingMode component
2. `/components/MasteryDisplay/MasteryDisplay.v2.tsx` - Updated MasteryDisplay to accept custom state

### Step 1: Copy the New Files

1. Review the changes in the two new .v2.tsx files
2. Once you're satisfied with the changes, rename them to replace the original files

```bash
# From the project root
mv components/SendingMode/SendingMode.v2.tsx components/SendingMode/SendingMode.tsx
mv components/MasteryDisplay/MasteryDisplay.v2.tsx components/MasteryDisplay/MasteryDisplay.tsx
```

### Step 2: Key Changes in SendingMode

The major changes in the updated SendingMode component:

1. Added local state for character points:
   ```javascript
   const [localCharPoints, setLocalCharPoints] = useState<Record<string, number>>({});
   ```

2. Initialize local points when level changes:
   ```javascript
   useEffect(() => {
     if (currentLevel) {
       // Create local copy of character points for current level
       const levelCharPoints: Record<string, number> = {};
       currentLevel.chars.forEach(char => {
         levelCharPoints[char] = state.charPoints[char] || 0;
       });
       setLocalCharPoints(levelCharPoints);
     }
   }, [currentLevel, state.charPoints, state.selectedLevelId]);
   ```

3. Use current level's characters directly when picking next character:
   ```javascript
   const pickNextChar = useCallback(() => {
     if (!currentLevel) return '';
     
     return selectNextCharacter(
       currentLevel.chars,
       localCharPoints,
       TARGET_POINTS,
       recentlyMasteredCharRef.current
     );
   }, [currentLevel, localCharPoints]);
   ```

4. Update both local and global state when points change:
   ```javascript 
   const updateLocalPoints = useCallback((char: string, points: number) => {
     // Update local state
     setLocalCharPoints(prev => ({
       ...prev,
       [char]: points
     }));
     
     // Also update app state
     updateCharPoints(char, points);
   }, [updateCharPoints]);
   ```

5. Calculate mastery using local points:
   ```javascript
   const masteredCount = currentLevel ? 
     currentLevel.chars.filter(c => (localCharPoints[c] || 0) >= TARGET_POINTS).length : 0;
   ```

### Step 3: Key Changes to MasteryDisplay

The updated MasteryDisplay component accepts custom props:

```javascript
interface MasteryDisplayProps {
  targetPoints?: number;
  // Optional props to override AppState context
  charPoints?: Record<string, number>;
  chars?: string[];
}
```

### Step 4: Test the Changes

After implementing these changes:

1. Test the SendingMode with different levels
2. Verify that characters are presented correctly for each level
3. Check that mastery scores are calculated and displayed properly
4. Ensure that the correct characters are mastered and the component advances properly

## Why This Approach Works

1. **Direct Source of Truth**: Using the level's characters directly eliminates any synchronization issues
2. **Isolated State**: Local character points can't be affected by race conditions
3. **Still Synchronized**: We still update the global state for persistence
4. **More Predictable**: Component behavior is determined by its own state, not external factors

## Debugging

I've added extensive console logging to help troubleshoot any remaining issues:

- Character selection logic logs
- Points calculation logs
- Timing information
- State updates

You can test the component while viewing the console to track the flow of data.

## Additional Notes

1. The debug-helper.js file contains browser console utilities that can help diagnose issues
2. The changes maintain compatibility with the existing API of AppStateContext
3. This approach is similar to how the master branch handles character state

This refactoring should solve both identified issues while maintaining compatibility with the rest of the application.