// race.js: basic race room with presence and start-time countdown
(async () => {
  // Initialize Supabase client (shared instance)
  const supabaseClient = window.supabaseClient;

  // --- Morse playback utilities (self-contained) ---
  const morseMap = {
    a: ".-",    b: "-...",  c: "-.-.", d: "-..",  e: ".",
    f: "..-.", g: "--.",   h: "....", i: "..",   j: ".---",
    k: "-.-",   l: ".-..",  m: "--",   n: "-.",   o: "---",
    p: ".--.",  q: "--.-",  r: ".-.",  s: "...",  t: "-",
    u: "..-",   v: "...-",  w: ".--",  x: "-..-", y: "-.--",
    z: "--..",
    0: "-----", 1: ".----", 2: "..---",3: "...--",4: "....-",
    5: ".....", 6: "-....",7: "--...",8: "---..",9: "----."
  };
  // Playback timing: unit duration based on user WPM or default 20
  let wpm = parseInt(localStorage.getItem('morseWpm'), 10);
  if (isNaN(wpm) || wpm <= 0) wpm = 20;
  const unit = 1200 / wpm;
  // Audio setup
  // Audio setup: create context and gain node
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);
  // Unlock AudioContext on first user interaction (required by browser autoplay policies)
  const resumeAudio = () => {
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch((e) => console.warn('AudioContext resume failed:', e));
    }
  };
  ['click', 'keydown', 'touchstart'].forEach((evt) =>
    document.addEventListener(evt, resumeAudio, { once: true })
  );
  let volume = parseInt(localStorage.getItem('morseVolume'), 10);
  if (isNaN(volume) || volume < 0) volume = 75;
  gainNode.gain.value = volume / 100;
  // Helpers
  function wait(ms) { return new Promise(res => setTimeout(res, ms)); }
  async function playMorse(char) {
    const symbols = morseMap[char] || '';
    for (let symbol of symbols) {
      await playSymbol(symbol);
      await wait(unit);
    }
    // gap after char
    await wait(unit * 2);
  }
  function playSymbol(symbol) {
    return new Promise(res => {
      const duration = symbol === '.' ? unit : unit * 3;
      const osc = audioContext.createOscillator();
      osc.frequency.value = 600;
      osc.type = 'sine';
      osc.connect(gainNode);
      osc.start();
      setTimeout(() => { osc.stop(); res(); }, duration);
    });
  }
  function playErrorSound() {
    return new Promise(res => {
      const duration = 150;
      const osc = audioContext.createOscillator();
      osc.frequency.value = 300;
      osc.type = 'sine';
      osc.connect(gainNode);
      osc.start();
      setTimeout(() => { osc.stop(); res(); }, duration);
    });
  }

  // Preload sequence container (will be set from DB)
  let sequence = [];
  // Determine raceId from URL (query param 'id')
  const url = new URL(window.location.href);
  let raceId = url.searchParams.get('id');
  if (!raceId) {
    // Try parsing from pathname: /race/<id>
    const parts = window.location.pathname.split('/');
    if (parts.length >= 3 && parts[1] === 'race') {
      raceId = parts[2];
    }
  }
  // If no raceId provided, skip race logic (UI will present create control)
  if (!raceId) {
    return;
  }

  // Presence key per-browser per-race
  let presenceId = localStorage.getItem(`race-presence-${raceId}`);
  if (!presenceId) {
    presenceId = Math.random().toString(36).substring(2, 10);
    localStorage.setItem(`race-presence-${raceId}`, presenceId);
  }
  // Determine username: display name or fallback to presenceId
  let username = presenceId;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      const meta = session.user.user_metadata || {};
      username = meta.full_name || meta.name || presenceId;
    }
  } catch (e) {
    // ignore
  }

  // Setup a Realtime channel for race: presence + start_time updates
  const channel = supabaseClient.channel(`race:${raceId}`, {
    config: { presence: { key: presenceId } }
  });
  const listEl = document.getElementById('participant-list');
  // Track correct answers, errors, and finish info per user
  const correctCounts = {};
  const errorCounts = {};
  const finishTimes = {};
  const finishPlaces = {};
  let finishOrder = [];
  let raceStartTimestamp = null;
  // Flags and timers for fallback polling
  let startRealtimeActive = false;
  let answerRealtimeActive = false;
  let pollStartTimeTimeout = null;
  let pollStartTimeInterval = null;
  let pollAnswersTimeout = null;
  let pollAnswersInterval = null;
  // Feature flag to enable fallback polling at runtime (default off)
  // Set window.enableFallbackPolling = true before loading this script to enable
  const enableFallbackPolling = window.enableFallbackPolling === true;
  // Separate flags for start and answer fallback, consumed upon schedule
  let startPollingFallback = enableFallbackPolling;
  let answerPollingFallback = enableFallbackPolling;

  // Helper: format ordinal suffix (e.g., 1st, 2nd)
  function getOrdinal(n) {
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return n + 'st';
    if (j === 2 && k !== 12) return n + 'nd';
    if (j === 3 && k !== 13) return n + 'rd';
    return n + 'th';
  }
  // Helper: format duration (ms) as mm:ss.ss
  function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}:${seconds.padStart(5, '0')}`;
  }

  function renderPresence(state) {
    listEl.innerHTML = '';
    Object.values(state).forEach(arr => {
      arr.forEach(p => {
        const name = p.user;
        const count = correctCounts[name] || 0;
        const errors = errorCounts[name] || 0;
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        if (finishTimes[name] != null) {
          const place = finishPlaces[name];
          const ordinal = getOrdinal(place);
          const durationMs = finishTimes[name] - raceStartTimestamp;
          const mmss = formatDuration(durationMs);
          nameSpan.textContent = `${name} (${ordinal}, ${mmss}, errors: ${errors}) `;
        } else {
          nameSpan.textContent = `${name} `;
        }
        li.appendChild(nameSpan);
        if (finishTimes[name] == null) {
          const prog = document.createElement('progress');
          prog.value = count;
          prog.max = sequence.length;
          li.appendChild(prog);
        }
        listEl.appendChild(li);
      });
    });
  }
  // presence sync event
  channel.on('presence', { event: 'sync' }, () => {
    renderPresence(channel.presenceState());
  });
  // listen for race start_time updates via Postgres changes
  channel.on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'races', filter: `id=eq.${raceId}`
  }, ({ new: race }) => {
    // Mark that we received start_time update via websocket and stop fallback polling
    startRealtimeActive = true;
    clearTimeout(pollStartTimeTimeout);
    if (pollStartTimeInterval) {
      console.log('[race] Websocket update for start_time received, stopping polling fallback');
      clearInterval(pollStartTimeInterval);
      pollStartTimeInterval = null;
    }
    console.log('[race] postgres_changes payload:', race);
    if (race.start_time && !hasStarted) {
      console.log('[race] triggering handleStart for:', race.start_time);
      handleStart(new Date(race.start_time).getTime());
    }
  });
  // Listen for answers INSERTs to update per-player progress via the same channel
  channel.on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'answers', filter: `race_id=eq.${raceId}`
  }, ({ new: ans }) => {
    // Mark that we received answers update via websocket and stop fallback polling
    answerRealtimeActive = true;
    clearTimeout(pollAnswersTimeout);
    if (pollAnswersInterval) {
      console.log('[race] Websocket update for answers received, stopping polling fallback');
      clearInterval(pollAnswersInterval);
      pollAnswersInterval = null;
    }
    const user = ans.username;
    if (ans.correct) {
      correctCounts[user] = (correctCounts[user] || 0) + 1;
      // record finish info when user completes all questions
      if (correctCounts[user] === sequence.length && finishTimes[user] == null) {
        const finishTs = ans.created_at ? new Date(ans.created_at).getTime() : Date.now();
        finishTimes[user] = finishTs;
        finishOrder.push(user);
        finishPlaces[user] = finishOrder.length;
      }
    } else {
      errorCounts[user] = (errorCounts[user] || 0) + 1;
    }
    renderPresence(channel.presenceState());
  });
  // subscribe and register presence
  await channel.subscribe();
  await channel.track({ user: username });

  // Get references for countdown and race UI
  const countdownEl = document.getElementById('countdown');
  const timerEl = document.getElementById('countdown-timer');
  let countdownInterval = null;
  // Race UI elements (hidden until race starts)
  const raceContainer = document.getElementById('race-container');
  const progressInfo  = document.getElementById('progress-info');
  const feedbackEl    = document.getElementById('feedback');

  // Retrieve user ID from session
  let userId = null;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    userId = session?.user?.id || null;
  } catch (e) {
    console.error('Error retrieving session for userId', e);
  }

  // Load sequence and initial start_time
  let hasStarted = false;
  async function loadRace() {
    const { data: race, error } = await supabaseClient
      .from('races')
      .select('sequence, start_time')
      .eq('id', raceId)
      .single();
    if (error) {
      console.error('Error loading race:', error);
      return;
    }
    sequence = race.sequence || [];
    // render presence now that we know total questions
    renderPresence(channel.presenceState());
    if (race.start_time) {
      handleStart(new Date(race.start_time).getTime());
    }
  }
  // After initial load, schedule fallback polling if websocket updates do not arrive
  await loadRace();
  if (startPollingFallback && !hasStarted) {
    // consume fallback flag so it only runs once
    startPollingFallback = false;
    // Fallback for start_time: begin after delay if no websocket event
    pollStartTimeTimeout = setTimeout(() => {
      if (!startRealtimeActive && !hasStarted) {
        console.log('[race] No websocket start_time event received, falling back to polling start_time');
        pollStartTimeInterval = setInterval(async () => {
          if (hasStarted) {
            clearInterval(pollStartTimeInterval);
            return;
          }
          const { data: race, error } = await supabaseClient
            .from('races').select('start_time').eq('id', raceId).single();
          if (!error && race?.start_time) {
            console.log('[race] Detected start_time via polling');
            clearInterval(pollStartTimeInterval);
            handleStart(new Date(race.start_time).getTime());
          }
        }, 1000);
      }
    }, 2000);
  }


  /**
   * handleStart: hide lobby, show countdown, then trigger race stream
   */
  function handleStart(targetTime) {
    hasStarted = true;
    raceStartTimestamp = targetTime;
    // Clear fallback polling for start_time if scheduled or running
    if (pollStartTimeTimeout) {
      clearTimeout(pollStartTimeTimeout);
      pollStartTimeTimeout = null;
    }
    if (pollStartTimeInterval) {
      clearInterval(pollStartTimeInterval);
      pollStartTimeInterval = null;
    }
    // Fallback for answers: schedule polling after countdown start if enabled and no websocket events
    if (answerPollingFallback && !answerRealtimeActive) {
      // consume fallback flag so it only runs once
      answerPollingFallback = false;
      pollAnswersTimeout = setTimeout(() => {
        if (!answerRealtimeActive) {
          console.log('[race] No websocket answers events received, falling back to polling answers for progress');
          pollAnswersInterval = setInterval(async () => {
            const { data: answers, error: pollError } = await supabaseClient
              .from('answers')
              .select('username, correct, created_at')
              .eq('race_id', raceId)
              .order('created_at', { ascending: true });
            if (pollError) {
              console.error('Error polling answers for progress:', pollError);
              return;
            }
            Object.keys(correctCounts).forEach(u => delete correctCounts[u]);
            Object.keys(errorCounts).forEach(u => delete errorCounts[u]);
            finishOrder = [];
            Object.keys(finishTimes).forEach(u => delete finishTimes[u]);
            Object.keys(finishPlaces).forEach(u => delete finishPlaces[u]);
            answers.forEach(ans => {
              const user = ans.username;
              if (ans.correct) {
                correctCounts[user] = (correctCounts[user] || 0) + 1;
                if (correctCounts[user] === sequence.length && finishTimes[user] == null) {
                  const finishTs = ans.created_at ? new Date(ans.created_at).getTime() : Date.now();
                  finishTimes[user] = finishTs;
                  finishOrder.push(user);
                  finishPlaces[user] = finishOrder.length;
                }
              } else {
                errorCounts[user] = (errorCounts[user] || 0) + 1;
              }
            });
            renderPresence(channel.presenceState());
          }, 1000);
        }
      }, 2000);
    }
    // Hide start button but keep presence list visible
    const startBtn = document.getElementById('start-button');
    if (startBtn) startBtn.style.display = 'none';
    countdownEl.style.display = 'block';
    const tick = () => {
      const diff = (targetTime - Date.now()) / 1000;
      timerEl.textContent = Math.max(Math.ceil(diff), 0);
      if (diff <= 0) {
        clearInterval(countdownInterval);
        countdownEl.style.display = 'none';
        // show race UI
        if (raceContainer) raceContainer.style.display = 'block';
        startRace();
      }
    };
    tick();
    countdownInterval = setInterval(tick, 100);
  }

  /**
   * startRace: sequentially play and collect answers for each char
   */
  async function startRace() {
    let currentIndex = 0;
    // Update local progress display
    function updateProgress() {
      progressInfo.textContent = `Question ${currentIndex + 1} of ${sequence.length}`;
    }
    async function playNext() {
      if (currentIndex >= sequence.length) {
        feedbackEl.textContent = 'Race completed!';
        console.log('Race finished');
        return;
      }
      // Clear previous feedback and update progress
      feedbackEl.textContent = '';
      updateProgress();
      const char = sequence[currentIndex];
      await playMorse(char);
      const questionStart = Date.now();
      const onKeyDown = async (e) => {
        // Replay on Tab
        if (e.key === 'Tab') {
          e.preventDefault();
          await playMorse(char);
          return;
        }
        const key = e.key.toLowerCase();
        // Accept only alphanumeric keys
        if (!/^[a-z0-9]$/.test(key)) return;
        document.removeEventListener('keydown', onKeyDown);
        const correct = key === char;
        const time_ms = Date.now() - questionStart;
        const { error } = await supabaseClient.from('answers').insert([{
          race_id: raceId,
          user_id: userId,
          username,
          char,
          answer: key,
          correct,
          time_ms
        }]);
        if (error) console.error('Error recording answer:', error);
        if (correct) {
          feedbackEl.textContent = '✓';
          currentIndex++;
        } else {
          feedbackEl.textContent = '✗';
          await playErrorSound();
        }
        // Continue with next or retry
        playNext();
      };
      document.addEventListener('keydown', onKeyDown);
    }
    playNext();
  }

  // Handle race-start-button click: set start_time = now + 5s
  const raceStartBtn = document.getElementById('race-start-button');
  if (raceStartBtn) {
    raceStartBtn.addEventListener('click', async () => {
      const startTime = new Date(Date.now() + 5000).toISOString();
      const { error } = await supabaseClient
        .from('races')
        .update({ start_time: startTime })
        .eq('id', raceId);
      if (error) console.error('Error setting race start_time:', error);
    });
  }
})();