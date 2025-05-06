import React, { useState, useRef } from 'react';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SendingModeDebugPanel');

interface DebugPanelProps {
  state: any;
  currentLevel: any;
  testStartTime: number | null;
  currentChar: string;
  currentCharRef: React.RefObject<string>;
  recentlyMasteredCharRef: React.RefObject<string | null>;
  responseTimes: { char: string; time: number }[];
  mistakesMap: Record<string, number>;
  localCharPointsRef: React.RefObject<Record<string, number>>;
  lastPickerInputs: {
    levelId: string;
    levelName: string;
    levelChars: string[];
    stateChars: string[];
    pointsSnapshot: Record<string, number>;
    recentlyMasteredChar: string | null;
  } | null;
  TARGET_POINTS: number;
  feedbackState: 'none' | 'correct' | 'incorrect';
  charStartTime: number | null;
  charStartTimeRef: React.RefObject<number>;
}

/**
 * Debug panel component for SendingMode used in development
 */
const SendingModeDebugPanel: React.FC<DebugPanelProps> = ({
  state,
  currentLevel,
  testStartTime,
  currentChar,
  currentCharRef,
  recentlyMasteredCharRef,
  responseTimes,
  mistakesMap,
  localCharPointsRef,
  lastPickerInputs,
  TARGET_POINTS,
  feedbackState,
  charStartTime,
  charStartTimeRef,
}) => {
  // State for copy button status
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  // Function to copy debug state to clipboard
  const copyDebugStateToClipboard = () => {
    // Gather all the debug information
    const debugInfo = {
      timestamp: new Date().toISOString(),
      currentLevel: {
        id: state.selectedLevelId,
        name: currentLevel?.name || 'Unknown',
        levelChars: currentLevel?.chars || [],
        type: currentLevel?.type || 'unknown'
      },
      testStatus: {
        active: state.testActive,
        testStartTime: testStartTime ? new Date(testStartTime).toISOString() : null,
        currentChar: currentChar,
        currentCharRef: currentCharRef.current,
        recentlyMasteredChar: recentlyMasteredCharRef.current,
        responseTimes: responseTimes,
        mistakesCount: Object.keys(mistakesMap).length
      },
      appState: {
        chars: state.chars,
        charPoints: state.charPoints
      },
      localState: {
        charPoints: localCharPointsRef.current
      },
      masteryStatus: {
        levelChars: currentLevel?.chars || [],
        masteryPoints: currentLevel?.chars.map(c => ({
          char: c,
          statePoints: state.charPoints[c] || 0,
          localPoints: localCharPointsRef.current?.[c] || 0,
          effectivePoints: Math.max(state.charPoints[c] || 0, localCharPointsRef.current?.[c] || 0),
          isMastered: Math.max(state.charPoints[c] || 0, localCharPointsRef.current?.[c] || 0) >= TARGET_POINTS
        })) || [],
        allMastered: currentLevel?.chars.every(c => 
          Math.max(state.charPoints[c] || 0, localCharPointsRef.current?.[c] || 0) >= TARGET_POINTS
        ) || false
      },
      // Add the character selection debug info
      characterSelectionDebug: lastPickerInputs ? {
        levelId: lastPickerInputs.levelId,
        levelName: lastPickerInputs.levelName,
        levelChars: lastPickerInputs.levelChars,
        stateChars: lastPickerInputs.stateChars,
        recentlyMasteredChar: lastPickerInputs.recentlyMasteredChar,
        mismatchDetected: lastPickerInputs.levelChars.join(',') !== lastPickerInputs.stateChars.join(','),
        invalidCharsInState: lastPickerInputs.stateChars.filter(c => !lastPickerInputs.levelChars.includes(c)),
        currentCharInvalid: currentChar ? !lastPickerInputs.levelChars.includes(currentChar) : false,
        pointsSnapshot: lastPickerInputs.pointsSnapshot
      } : null
    };
    
    // Format as JSON with pretty printing
    const debugText = JSON.stringify(debugInfo, null, 2);
    
    // Create a text block with markdown formatting
    const clipboardText = `\`\`\`json\n${debugText}\n\`\`\``;
    
    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(clipboardText)
        .then(() => {
          // Show visual confirmation
          setCopyStatus('copied');
          // Reset after a delay
          setTimeout(() => setCopyStatus('idle'), 2000);
        })
        .catch(err => {
          logger.error('Failed to copy debug state:', err);
          setCopyStatus('error');
          setTimeout(() => setCopyStatus('idle'), 2000);
        });
    } else {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = clipboardText;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopyStatus('copied');
          setTimeout(() => setCopyStatus('idle'), 2000);
        } else {
          setCopyStatus('error');
          setTimeout(() => setCopyStatus('idle'), 2000);
        }
      } catch (err: unknown) {
        logger.error('Failed to copy debug state:', err);
        setCopyStatus('error');
        setTimeout(() => setCopyStatus('idle'), 2000);
      }
      
      document.body.removeChild(textArea);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white',
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '500px',
      maxHeight: '90vh',
      overflow: 'auto',
      border: '1px solid #666'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '5px', 
        borderBottom: '1px solid #555', 
        paddingBottom: '5px'
      }}>
        <div style={{fontWeight: 'bold', fontSize: '14px'}}>
          COMPLETE STATE DIAGNOSTICS
        </div>
        <div 
          onClick={copyDebugStateToClipboard}
          style={{
            fontSize: '16px',
            cursor: 'pointer',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '3px',
            background: copyStatus === 'idle' ? 'transparent' : 
                       copyStatus === 'copied' ? 'rgba(0,80,0,0.5)' : 
                       'rgba(80,0,0,0.5)',
            transition: 'background-color 0.2s'
          }}
          title="Copy debug data to clipboard"
        >
          {copyStatus === 'idle' && (
            <span style={{opacity: 0.8}}>📋</span>
          )}
          {copyStatus === 'copied' && (
            <span style={{color: '#5f5', fontWeight: 'bold'}}>✓</span>
          )}
          {copyStatus === 'error' && (
            <span style={{color: '#f55'}}>✗</span>
          )}
        </div>
      </div>
      
      {/* Current Level Information - Highlighted at top */}
      <div style={{
        marginBottom: '10px',
        padding: '5px',
        backgroundColor: 'rgba(100,100,0,0.3)',
        border: '1px solid #aa8',
        borderRadius: '4px'
      }}>
        <div style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '4px'}}>
          CURRENT LEVEL STATUS
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <div>
            <span style={{color: '#ffb'}}>{currentLevel?.name || 'Unknown Level'}</span> 
            (<span style={{color: '#ffb'}}>{state.selectedLevelId}</span>)
          </div>
          <div>
            Test Active: <span style={{color: state.testActive ? '#8f8' : '#f88'}}>{state.testActive ? 'YES' : 'NO'}</span>
          </div>
        </div>
        <div style={{marginTop: '3px'}}>
          <div>Level Characters: <span style={{color: '#ffb'}}>{currentLevel?.chars.join(', ')}</span></div>
          <div>AppState Characters: <span style={{color: '#ffb'}}>{state.chars.join(', ')}</span></div>
        </div>
        <div style={{marginTop: '3px'}}>
          <div>
            Mastery: {(state.chars.filter(c => (state.charPoints[c] || 0) >= TARGET_POINTS).length)} of {state.chars.length} characters mastered
          </div>
        </div>
      </div>
      
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
        {/* Level Completion Tracker */}
        <div style={{
          border: '1px solid #444', 
          padding: '5px', 
          backgroundColor: 'rgba(0,100,100,0.2)'
        }}>
          <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>
            Level Completion Status
          </div>
          <div>
            <div>Last Checked: <span style={{color: '#8ff'}}>
              {(localCharPointsRef.current && Object.keys(localCharPointsRef.current).length > 0) ? 'Yes' : 'Not yet'}
            </span></div>
            <div style={{marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px'}}>
              {currentLevel && currentLevel.chars.map(char => {
                const statePoints = state.charPoints[char] || 0;
                const localPoints = localCharPointsRef.current?.[char] || 0;
                const effectivePoints = Math.max(statePoints, localPoints);
                const isMastered = effectivePoints >= TARGET_POINTS;
                return (
                  <div key={char} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '1px 3px',
                    backgroundColor: isMastered ? 'rgba(0,50,0,0.3)' : 'rgba(50,0,0,0.3)',
                    borderRadius: '2px'
                  }}>
                    <div>Character: <span style={{color: '#8ff'}}>{char}</span></div>
                    <div>
                      <span style={{color: isMastered ? '#8f8' : '#f88'}}>
                        {effectivePoints.toFixed(2)}/{TARGET_POINTS}
                      </span>
                      <span style={{marginLeft: '5px'}}>
                        {isMastered ? '✅' : '❌'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop: '5px', borderTop: '1px solid #444', paddingTop: '3px'}}>
              <div>
                All Mastered: <span style={{
                  color: currentLevel && currentLevel.chars.every(c => 
                    Math.max(state.charPoints[c] || 0, localCharPointsRef.current?.[c] || 0) >= TARGET_POINTS
                  ) ? '#8f8' : '#f88'
                }}>
                  {currentLevel && currentLevel.chars.every(c => 
                    Math.max(state.charPoints[c] || 0, localCharPointsRef.current?.[c] || 0) >= TARGET_POINTS
                  ) ? 'YES' : 'NO'}
                </span>
              </div>
              
              {/* Level completion indicator */}
              {currentLevel && currentLevel.chars.every(c => 
                Math.max(state.charPoints[c] || 0, localCharPointsRef.current?.[c] || 0) >= TARGET_POINTS
              ) && (
                <div style={{
                  marginTop: '5px',
                  padding: '4px',
                  background: 'rgba(0,100,0,0.5)',
                  borderRadius: '3px',
                  fontWeight: 'bold',
                  color: '#5f5',
                  textAlign: 'center'
                }}>
                  🏆 LEVEL COMPLETED 🏆
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* New section for character selection */}
        <div style={{
          border: '1px solid #444', 
          padding: '5px', 
          backgroundColor: 'rgba(100,50,0,0.2)',
          marginTop: '10px'
        }}>
          <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>
            Character Selection Pool
          </div>
          <div>
            <div>Recently Mastered: <span style={{color: '#ffaa66'}}>{recentlyMasteredCharRef.current || 'None'}</span></div>
            <div style={{marginTop: '5px'}}>
              <div style={{fontWeight: 'bold'}}>Character Selection Status:</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px'}}>
                {currentLevel && currentLevel.chars.map(char => {
                  const statePoints = state.charPoints[char] || 0;
                  const localPoints = localCharPointsRef.current?.[char] || 0;
                  const effectivePoints = Math.max(statePoints, localPoints);
                  const isMastered = effectivePoints >= TARGET_POINTS;
                  const isRecentlyMastered = char === recentlyMasteredCharRef.current;
                  
                  let selectionStatus = '';
                  let statusColor = '#fff';
                  const COMPLETED_WEIGHT = 0.2; // Duplicating constant from parent
                  
                  if (isRecentlyMastered) {
                    selectionStatus = 'SKIPPED (recently mastered)';
                    statusColor = '#ff8';
                  } else if (isMastered) {
                    selectionStatus = `REDUCED CHANCE (${(COMPLETED_WEIGHT * 100).toFixed(0)}%)`;
                    statusColor = '#8f8';
                  } else {
                    selectionStatus = 'PRIORITIZED';
                    statusColor = '#f88';
                  }
                  
                  return (
                    <div key={char} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '1px 3px',
                      backgroundColor: isRecentlyMastered ? 'rgba(80,80,0,0.3)' : 
                                     isMastered ? 'rgba(0,50,0,0.3)' : 'rgba(50,0,0,0.3)',
                      borderRadius: '2px'
                    }}>
                      <div>
                        <span style={{color: char === currentChar ? '#ff5' : '#fff'}}>{char}</span>
                        {char === currentChar && <span style={{marginLeft: '5px', color: '#ff5'}}>← CURRENT</span>}
                      </div>
                      <div style={{color: statusColor}}>
                        {selectionStatus}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{marginTop: '5px', fontSize: '11px', fontStyle: 'italic', color: '#ccc'}}>
              Characters with higher point values are less likely to be selected. 
              Recently mastered characters are temporarily excluded.
            </div>
          </div>
        </div>
        
        <div style={{border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(0,50,0,0.2)'}}>
          <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>AppState Context</div>
          <div>Level ID: <span style={{color: '#8fff8f'}}>{state.selectedLevelId}</span></div>
          <div>Level Name: <span style={{color: '#8fff8f'}}>{currentLevel?.name || 'Unknown'}</span></div>
          <div>Test Active: <span style={{color: '#8fff8f'}}>{state.testActive ? 'Yes' : 'No'}</span></div>
          <div style={{marginTop: '5px'}}>
            <div style={{fontWeight: 'bold'}}>Chars from AppState:</div>
            <div style={{color: '#8fff8f'}}>{state.chars.join(', ')}</div>
          </div>
          <div style={{marginTop: '5px'}}>
            <div style={{fontWeight: 'bold'}}>Points from AppState:</div>
            <div>
              {Object.entries(state.charPoints).length > 0 ? (
                <table style={{borderCollapse: 'collapse', width: '100%'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>Char</th>
                      <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>Points</th>
                      <th style={{textAlign: 'center', padding: '2px', borderBottom: '1px solid #444'}}>Mastered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(state.charPoints).map(([char, points]) => (
                      <tr key={char}>
                        <td style={{padding: '1px'}}>{char}</td>
                        <td style={{textAlign: 'right', padding: '1px'}}>{(points as number).toFixed(2)}</td>
                        <td style={{textAlign: 'center', padding: '1px'}}>{(points as number) >= TARGET_POINTS ? '✅' : '❌'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <span style={{color: '#aaa', fontStyle: 'italic'}}>No points recorded</span>
              )}
            </div>
          </div>
        </div>
        
        <div style={{border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(0,50,0,0.2)'}}>
          <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>Local Component State</div>
          <div>Current Char: <span style={{color: '#ff8f8f'}}>{currentChar || '(none)'}</span></div>
          <div>Current Char Ref: <span style={{color: '#ff8f8f'}}>{currentCharRef.current || '(none)'}</span></div>
          <div>Feedback State: <span style={{color: '#ff8f8f'}}>{feedbackState}</span></div>
          <div>Test Start Time: <span style={{color: '#ff8f8f'}}>{testStartTime ? new Date(testStartTime).toISOString() : 'Not started'}</span></div>
          <div>Char Start Time: <span style={{color: '#ff8f8f'}}>{charStartTime ? new Date(charStartTime).toISOString() : 'Not started'}</span></div>
          <div>Char Start Time Ref: <span style={{color: '#ff8f8f'}}>{charStartTimeRef.current ? new Date(charStartTimeRef.current).toISOString() : 'Not set'}</span></div>
          <div>Recently Mastered: <span style={{color: '#ff8f8f'}}>{recentlyMasteredCharRef.current || 'None'}</span></div>
          <div>Response Times: <span style={{color: '#ff8f8f'}}>{responseTimes.length} records</span></div>
          
          <div style={{marginTop: '5px'}}>
            <div style={{fontWeight: 'bold'}}>Local Points Tracking:</div>
            <div>
              {localCharPointsRef.current && Object.keys(localCharPointsRef.current).length > 0 ? (
                <table style={{borderCollapse: 'collapse', width: '100%'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>Char</th>
                      <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>Local</th>
                      <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>AppState</th>
                      <th style={{textAlign: 'center', padding: '2px', borderBottom: '1px solid #444'}}>Match?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(localCharPointsRef.current).map(([char, points]) => {
                      const appPoints = state.charPoints[char] || 0;
                      const match = Math.abs(points - appPoints) < 0.001; // Float comparison
                      return (
                        <tr key={char}>
                          <td style={{padding: '1px'}}>{char}</td>
                          <td style={{textAlign: 'right', padding: '1px'}}>{(points as number).toFixed(2)}</td>
                          <td style={{textAlign: 'right', padding: '1px'}}>{appPoints.toFixed(2)}</td>
                          <td style={{textAlign: 'center', padding: '1px', color: match ? 'green' : 'red'}}>{match ? '✓' : '✗'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <span style={{color: '#aaa', fontStyle: 'italic'}}>No local points recorded</span>
              )}
            </div>
          </div>
        </div>
        
        <div style={{border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(0,0,50,0.2)'}}>
          <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>Response History</div>
          <div>
            {responseTimes.length > 0 ? (
              <table style={{borderCollapse: 'collapse', width: '100%'}}>
                <thead>
                  <tr>
                    <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>#</th>
                    <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>Char</th>
                    <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>Time (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {responseTimes.map((rt, idx) => (
                    <tr key={idx}>
                      <td style={{padding: '1px'}}>{idx + 1}</td>
                      <td style={{padding: '1px'}}>{rt.char}</td>
                      <td style={{textAlign: 'right', padding: '1px'}}>{rt.time.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span style={{color: '#aaa', fontStyle: 'italic'}}>No responses recorded</span>
            )}
          </div>
        </div>
        
        <div style={{border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(50,50,0,0.2)'}}>
          <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>Level Definition</div>
          {currentLevel ? (
            <>
              <div>ID: <span style={{color: '#ffff8f'}}>{currentLevel.id}</span></div>
              <div>Name: <span style={{color: '#ffff8f'}}>{currentLevel.name}</span></div>
              <div>Type: <span style={{color: '#ffff8f'}}>{currentLevel.type}</span></div>
              <div>Chars from level definition: <span style={{color: '#ffff8f'}}>{currentLevel.chars.join(', ')}</span></div>
              {currentLevel.type === 'checkpoint' && currentLevel.strikeLimit && (
                <div>Strike Limit: <span style={{color: '#ffff8f'}}>{currentLevel.strikeLimit}</span></div>
              )}
            </>
          ) : (
            <span style={{color: '#aaa', fontStyle: 'italic'}}>No level definition found</span>
          )}
        </div>
        
        {/* Mismatch detection */}
        {currentLevel && (() => {
          const levelChars = currentLevel.chars;
          const stateChars = state.chars;
          const sameLength = levelChars.length === stateChars.length;
          const allPresent = levelChars.every(c => stateChars.includes(c));
          const noExtras = stateChars.every(c => levelChars.includes(c));
          const match = sameLength && allPresent && noExtras;
          
          if (!match) {
            return (
              <div style={{
                border: '2px solid #f00', 
                padding: '5px', 
                backgroundColor: 'rgba(100,0,0,0.5)',
                marginTop: '10px',
                color: '#faa'
              }}>
                <div style={{fontWeight: 'bold', color: '#f55'}}>⚠️ CHARACTER MISMATCH DETECTED!</div>
                <div>Level chars: {levelChars.join(', ')}</div>
                <div>State chars: {stateChars.join(', ')}</div>
                <div>Same length: {sameLength ? 'Yes' : 'No'}</div>
                <div>All present: {allPresent ? 'Yes' : 'No'}</div>
                <div>No extras: {noExtras ? 'Yes' : 'No'}</div>
                <div style={{marginTop: '5px', fontStyle: 'italic', color: '#fcc'}}>
                  This indicates a state synchronization problem
                </div>
              </div>
            );
          }
          return null;
        })()}
        
        <div style={{marginTop: '10px', border: '1px solid #444', padding: '5px', backgroundColor: 'rgba(50,0,50,0.2)'}}>
          <div style={{fontWeight: 'bold', marginBottom: '2px', borderBottom: '1px solid #444', paddingBottom: '2px'}}>
            Complete Character Tracking
          </div>
          <div>
            <table style={{borderCollapse: 'collapse', width: '100%'}}>
              <thead>
                <tr>
                  <th style={{textAlign: 'left', padding: '2px', borderBottom: '1px solid #444'}}>Char</th>
                  <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>Local Points</th>
                  <th style={{textAlign: 'right', padding: '2px', borderBottom: '1px solid #444'}}>AppState Points</th>
                  <th style={{textAlign: 'center', padding: '2px', borderBottom: '1px solid #444'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {currentLevel && currentLevel.chars.map(char => {
                  const localPoints = localCharPointsRef.current?.[char] || 0;
                  const appPoints = state.charPoints[char] || 0;
                  const effectivePoints = Math.max(localPoints, appPoints);
                  const isMastered = effectivePoints >= TARGET_POINTS;
                  const isAttempted = effectivePoints > 0;
                  
                  return (
                    <tr key={char} style={{
                      backgroundColor: char === currentChar ? 'rgba(255,255,0,0.15)' : 'transparent'
                    }}>
                      <td style={{padding: '1px', fontWeight: char === currentChar ? 'bold' : 'normal'}}>
                        {char}{char === currentChar ? ' ←' : ''}
                      </td>
                      <td style={{textAlign: 'right', padding: '1px'}}>{localPoints.toFixed(2)}</td>
                      <td style={{textAlign: 'right', padding: '1px'}}>{appPoints.toFixed(2)}</td>
                      <td style={{textAlign: 'center', padding: '1px'}}>
                        {!isAttempted && (
                          <span style={{color: '#aaa'}}>Not attempted</span>
                        )}
                        {isAttempted && !isMastered && (
                          <span style={{color: '#f88'}}>In progress</span>
                        )}
                        {isMastered && (
                          <span style={{color: '#8f8'}}>Mastered ✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{marginTop: '5px', fontSize: '11px', color: '#ccc'}}>
            Shows all characters in the current level regardless of whether they've been attempted.
          </div>
        </div>
        
        {/* Character Picker Debug Widget */}
        <div style={{
          marginTop: '15px', 
          border: '2px solid #f00', 
          padding: '5px', 
          backgroundColor: 'rgba(80,0,0,0.3)'
        }}>
          <div style={{
            fontWeight: 'bold', 
            marginBottom: '2px', 
            borderBottom: '1px solid #f88', 
            paddingBottom: '2px', 
            color: '#f88'
          }}>
            🔍 CHARACTER SELECTION DEBUG
          </div>
          
          {lastPickerInputs ? (
            <div>
              <div style={{marginBottom: '5px'}}>
                <div><strong>Last Character Selection:</strong></div>
                <div>Level: <span style={{color: '#f88'}}>{lastPickerInputs.levelName} ({lastPickerInputs.levelId})</span></div>
                <div>Current Char: <span style={{color: '#f88'}}>{currentChar || '(none)'}</span></div>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '5px',
                padding: '4px',
                backgroundColor: 'rgba(50,0,0,0.4)',
                borderRadius: '3px'
              }}>
                <div>
                  <div><strong>⚠️ Level Chars Used:</strong></div>
                  <div style={{color: '#f88'}}>{lastPickerInputs.levelChars.join(', ')}</div>
                </div>
                <div>
                  <div><strong>⚠️ State Chars:</strong></div>
                  <div style={{color: '#f88'}}>{lastPickerInputs.stateChars.join(', ')}</div>
                </div>
              </div>
              
              <div style={{marginBottom: '5px'}}>
                <div><strong>Recently Mastered:</strong> <span style={{color: '#f88'}}>{lastPickerInputs.recentlyMasteredChar || 'None'}</span></div>
              </div>
              
              <div>
                <div><strong>Character Point Snapshot:</strong></div>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign: 'left', borderBottom: '1px solid #666'}}>Char</th>
                      <th style={{textAlign: 'right', borderBottom: '1px solid #666'}}>Points</th>
                      <th style={{textAlign: 'center', borderBottom: '1px solid #666'}}>In Level?</th>
                      <th style={{textAlign: 'center', borderBottom: '1px solid #666'}}>In State?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(lastPickerInputs.pointsSnapshot).map(([char, points]) => {
                      const inLevel = lastPickerInputs.levelChars.includes(char);
                      const inState = lastPickerInputs.stateChars.includes(char);
                      const isCurrent = char === currentChar;
                      
                      return (
                        <tr key={char} style={{
                          backgroundColor: isCurrent ? 'rgba(80,80,0,0.3)' : 'transparent',
                          color: isCurrent ? '#ff0' : (inLevel ? '#fff' : '#a55')
                        }}>
                          <td style={{padding: '1px'}}>{char} {isCurrent && '←'}</td>
                          <td style={{textAlign: 'right', padding: '1px'}}>{(points as number).toFixed(2)}</td>
                          <td style={{textAlign: 'center', padding: '1px', color: inLevel ? '#8f8' : '#f55'}}>
                            {inLevel ? '✓' : '✗'}
                          </td>
                          <td style={{textAlign: 'center', padding: '1px', color: inState ? '#8f8' : '#f55'}}>
                            {inState ? '✓' : '✗'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div style={{marginTop: '8px', padding: '3px', backgroundColor: 'rgba(80,0,0,0.5)', borderRadius: '3px'}}>
                <div style={{color: '#f55', fontWeight: 'bold'}}>CHARACTER MISMATCH DETECTION:</div>
                <div>
                  {lastPickerInputs.levelChars.join(',') !== lastPickerInputs.stateChars.join(',') ? (
                    <div style={{color: '#f55'}}>
                      ⚠️ <strong>MISMATCH DETECTED:</strong> Level chars and State chars are different!
                    </div>
                  ) : (
                    <div style={{color: '#8f8'}}>
                      Level chars and State chars match correctly.
                    </div>
                  )}
                </div>
                {lastPickerInputs.stateChars.some(c => !lastPickerInputs.levelChars.includes(c)) && (
                  <div style={{color: '#f55', marginTop: '3px'}}>
                    Found characters in State that don't belong in current level: 
                    <strong>{lastPickerInputs.stateChars.filter(c => !lastPickerInputs.levelChars.includes(c)).join(', ')}</strong>
                  </div>
                )}
                {currentChar && !lastPickerInputs.levelChars.includes(currentChar) && (
                  <div style={{color: '#f00', marginTop: '3px', fontWeight: 'bold'}}>
                    🚨 CRITICAL: Current char "{currentChar}" is not in level chars!
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{color: '#aaa', fontStyle: 'italic'}}>No character selection recorded yet</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SendingModeDebugPanel;