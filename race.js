// race.js: basic race room with presence and start-time countdown
(async () => {
  // Initialize Supabase client
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);
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
  // If no raceId in URL, show race creation UI
  if (!raceId) {
    const lobbyDiv = document.getElementById('lobby');
    // Setup UI: select mode and create button
    lobbyDiv.innerHTML = `
      <h2>Create a New Race</h2>
      <label><input type="radio" name="mode" value="copy" checked> Copy Mode</label>
      <label><input type="radio" name="mode" value="send"> Send Mode</label>
      <button id="create-button">Create Race</button>
    `;
    document.getElementById('create-button').addEventListener('click', async () => {
      // Determine selected mode
      const mode = document.querySelector('input[name="mode"]:checked').value;
      // Generate a short random race ID
      const newId = Math.random().toString(36).substring(2, 10);
      // Generate a sequence of characters (e.g., 20 random alphanumerics)
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
      const seq = Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]);
      // Insert new race record
      const { error } = await supabaseClient.from('races').insert([{ id: newId, mode, sequence: seq }]);
      if (error) {
        console.error('Error creating race:', error);
        alert('Could not create race. See console for details.');
      } else {
        // Redirect to this page with race ID
        window.location.search = '?id=' + newId;
      }
    });
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
  function renderPresence(state) {
    listEl.innerHTML = '';
    Object.values(state).forEach((arr) => {
      arr.forEach((p) => {
        const li = document.createElement('li');
        li.textContent = p.user;
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
    console.log('[race] postgres_changes payload:', race);
    if (race.start_time && !hasStarted) {
      console.log('[race] triggering handleStart for:', race.start_time);
      handleStart(new Date(race.start_time).getTime());
    }
  });
  // subscribe and register presence
  await channel.subscribe();
  await channel.track({ user: username });

  // Get references for countdown UI
  const countdownEl = document.getElementById('countdown');
  const timerEl = document.getElementById('countdown-timer');
  let countdownInterval = null;

  // Retrieve user ID from session
  let userId = null;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    userId = session?.user?.id || null;
  } catch (e) {
    console.error('Error retrieving session for userId', e);
  }

  // Load sequence and initial start_time
  let sequence = [];
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
    if (race.start_time) {
      handleStart(new Date(race.start_time).getTime());
    }
  }
  await loadRace();
  // Fallback polling if realtime update misses: check for start_time every second
  (function pollStartTime() {
    const poll = setInterval(async () => {
      if (hasStarted) return clearInterval(poll);
      const { data: race, error } = await supabaseClient
        .from('races').select('start_time').eq('id', raceId).single();
      if (!error && race?.start_time) {
        clearInterval(poll);
        handleStart(new Date(race.start_time).getTime());
      }
    }, 1000);
  })();


  /**
   * handleStart: hide lobby, show countdown, then trigger race stream
   */
  function handleStart(targetTime) {
    hasStarted = true;
    document.getElementById('lobby').style.display = 'none';
    countdownEl.style.display = 'block';
    const tick = () => {
      const diff = (targetTime - Date.now()) / 1000;
      timerEl.textContent = Math.max(Math.ceil(diff), 0);
      if (diff <= 0) {
        clearInterval(countdownInterval);
        countdownEl.style.display = 'none';
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
    async function playNext() {
      if (currentIndex >= sequence.length) {
        console.log('Race finished');
        return;
      }
      const char = sequence[currentIndex];
      await playMorse(char);
      const questionStart = Date.now();
      const onKeyDown = async (e) => {
        const answer = e.key.toLowerCase();
        const correct = answer === char;
        const time_ms = Date.now() - questionStart;
        const { error } = await supabaseClient.from('answers').insert([{
          race_id: raceId,
          user_id: userId,
          username,
          char,
          answer,
          correct,
          time_ms
        }]);
        if (error) console.error('Error recording answer:', error);
        document.removeEventListener('keydown', onKeyDown);
        currentIndex++;
        if (!correct) {
          await playErrorSound();
        }
        playNext();
      };
      document.addEventListener('keydown', onKeyDown);
    }
    playNext();
  }

  // Handle start-button click: set start_time = now+15s
  document.getElementById('start-button').addEventListener('click', async () => {
    const startTime = new Date(Date.now() + 15000).toISOString();
    const { error } = await supabaseClient
      .from('races')
      .update({ start_time: startTime })
      .eq('id', raceId);
    if (error) console.error('Error setting race start_time:', error);
  });
})();