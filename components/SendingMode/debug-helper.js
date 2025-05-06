/**
 * SendingMode Debugging Helper
 * 
 * This script adds global helper functions that will help you debug
 * issues in the SendingMode component using the browser console.
 *
 * Usage:
 * 1. Open your browser console
 * 2. Run any of the following commands:
 */

// Store for component state access
window.__ditDebugState = {
  appState: null,
  keyerState: null,
  timing: {}
};

// Save a global reference to important state
window.saveDebugState = (state, name) => {
  if (!window.__ditDebugState) {
    window.__ditDebugState = {};
  }
  window.__ditDebugState[name || 'state'] = state;
  console.log(`Debug state saved: ${name || 'state'}`, state);
  return state;
};

// Monitor character point changes
window.monitorCharPoints = () => {
  const originalUpdateCharPoints = window.__ditDebugState?.appState?.updateCharPoints;
  
  if (!originalUpdateCharPoints) {
    console.error('App state not available. Make sure to call saveAppState() first.');
    return;
  }
  
  window.__ditDebugState.appState.updateCharPoints = (char, points) => {
    console.log(`%c[CharPoints] Updated ${char} to ${points.toFixed(2)}`, 'color: #0ff; font-weight: bold');
    return originalUpdateCharPoints(char, points);
  };
  
  console.log('%cCharPoints monitoring activated', 'color: #0f0; font-weight: bold');
};

// Display character mastery status
window.showMasteryStatus = () => {
  if (!window.__ditDebugState?.appState) {
    console.error('App state not available. Make sure to call saveAppState() first.');
    return;
  }
  
  const TARGET_POINTS = 3; // Hard-coded for now
  const { chars, charPoints } = window.__ditDebugState.appState.state;
  
  console.log('%cCurrent Mastery Status:', 'color: #0f0; font-weight: bold');
  
  const status = chars.map(char => {
    const points = charPoints[char] || 0;
    const mastered = points >= TARGET_POINTS;
    return {
      char,
      points: points.toFixed(2),
      mastered
    };
  });
  
  console.table(status);
  
  const masteredCount = status.filter(s => s.mastered).length;
  console.log(`%c${masteredCount}/${chars.length} characters mastered`, 'color: #0f0');
  
  return status;
};

// Monitor character selection
window.monitorCharSelection = () => {
  if (!window.selectNextCharacter && typeof selectNextCharacter !== 'function') {
    console.error('selectNextCharacter function not found in global scope.');
    console.log('Add the following line to utils/characterSelection.ts:');
    console.log('window.selectNextCharacter = selectNextCharacter;');
    return;
  }
  
  const originalSelectNextChar = window.selectNextCharacter;
  
  window.selectNextCharacter = (chars, charPoints, targetPoints, recentlyMastered) => {
    console.log('%c[Character Selection]', 'color: #ff0; font-weight: bold');
    console.log('Chars:', chars);
    console.log('CharPoints:', charPoints);
    console.log('Recently mastered:', recentlyMastered);
    
    const result = originalSelectNextChar(chars, charPoints, targetPoints, recentlyMastered);
    console.log(`%cSelected character: ${result}`, 'color: #0f0');
    return result;
  };
  
  console.log('%cCharacter selection monitoring activated', 'color: #0f0; font-weight: bold');
};

// Timing debugging
window.startTiming = (name) => {
  if (!window.__ditDebugState.timing) {
    window.__ditDebugState.timing = {};
  }
  window.__ditDebugState.timing[name] = Date.now();
  console.log(`%c[Timing] Started ${name}`, 'color: #0ff');
};

window.endTiming = (name) => {
  if (!window.__ditDebugState.timing || !window.__ditDebugState.timing[name]) {
    console.error(`No timing data found for ${name}`);
    return;
  }
  
  const elapsed = Date.now() - window.__ditDebugState.timing[name];
  console.log(`%c[Timing] ${name}: ${elapsed}ms`, 'color: #0ff; font-weight: bold');
  return elapsed;
};

// Keydown/keyup hook
window.hookKeyEvents = () => {
  const originalKeyDown = document.onkeydown;
  const originalKeyUp = document.onkeyup;
  
  document.onkeydown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      console.log(`%c[Key] ${e.key} DOWN`, 'color: #f0f');
    }
    if (originalKeyDown) originalKeyDown(e);
  };
  
  document.onkeyup = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      console.log(`%c[Key] ${e.key} UP`, 'color: #f0f');
    }
    if (originalKeyUp) originalKeyUp(e);
  };
  
  console.log('%cKey event hooks installed', 'color: #0f0; font-weight: bold');
};

// Help command
window.ditDebugHelp = () => {
  console.log('%cDIT SendingMode Debug Commands:', 'color: #ff0; font-weight: bold; font-size: 14px');
  console.log('%csaveDebugState(state, name)', 'color: #0ff', '- Save any state object for inspection');
  console.log('%cmonitorCharPoints()', 'color: #0ff', '- Monitor character point updates');
  console.log('%cshowMasteryStatus()', 'color: #0ff', '- Show current character mastery status');
  console.log('%cmonitorCharSelection()', 'color: #0ff', '- Monitor character selection logic');
  console.log('%cstartTiming(name)', 'color: #0ff', '- Start timing an operation');
  console.log('%cendTiming(name)', 'color: #0ff', '- End timing and show elapsed time');
  console.log('%chookKeyEvents()', 'color: #0ff', '- Monitor key press events');
};

// Print a welcome message
console.log('%c🐛 DIT SendingMode Debug Helper loaded', 'color: #0f0; font-weight: bold; font-size: 14px');
console.log('Type %cditDebugHelp()', 'color: #ff0; font-weight: bold', 'to see available commands');

// Export as a module
if (typeof module !== 'undefined') {
  module.exports = {
    saveDebugState: window.saveDebugState,
    monitorCharPoints: window.monitorCharPoints,
    showMasteryStatus: window.showMasteryStatus,
    monitorCharSelection: window.monitorCharSelection,
    startTiming: window.startTiming,
    endTiming: window.endTiming,
    hookKeyEvents: window.hookKeyEvents,
    ditDebugHelp: window.ditDebugHelp
  };
}