(function() {
  // legacy total questions (placeholder to avoid undefined)
  let totalChars = 50;
  let currentIndex = 0;
  // number of points required to master each character
  const targetPoints = 3;
  // thresholds (in seconds)
  const fastThreshold = 0.5;
  const maxThreshold = 4.0;
  // weight for already mastered chars in question pool
  const completedWeight = 0.2;
  // character mastery points
  let charPoints = {};
  // timestamp when current character was played
  let questionStartTime = null;
  // default character set (a-z, 0-9)
  const defaultChars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  // current character set for this test (may vary by level)
  let chars = [...defaultChars];
  const morseMap = {
    'a':'.-','b':'-...','c':'-.-.','d':'-..','e':'.','f':'..-.','g':'--.',
    'h':'....','i':'..','j':'.---','k':'-.-','l':'.-..','m':'--','n':'-.',
    'o':'---','p':'.--.','q':'--.-','r':'.-.','s':'...','t':'-','u':'..-',
    'v':'...-','w':'.--','x':'-..-','y':'-.--','z':'--..',
    '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....',
    '6':'-....','7':'--...','8':'---..','9':'----.'
  };
  // let currentIndex = 0; // retired: using mastery-based flow
  let strikeLimit = null;
  let strikeCount = 0;
  let firstTryCount = 0;
  const mistakesMap = {};
  let currentChar = '';
  let currentMistakes = 0;
  let startTime = null;
  let waitingForInput = false;
  let replayCount = 0; // user-initiated replays
  // load preferred speed from localStorage or default to 20 WPM
  let wpm = (function() {
    const stored = parseInt(localStorage.getItem('morseWpm'), 10);
    return (stored && !isNaN(stored)) ? stored : 20;
  })();
  let unit = 1200 / wpm; // duration of one morse unit in ms
  let audioContext = null;

  const startButton = document.getElementById('start-button');
  const progressDiv = document.getElementById('progress');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  const menuToggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('menu');
  const speedSlider = document.getElementById('speed-slider');
  const speedLabel = document.getElementById('speed-label');
  const replayButton = document.getElementById('replay-button');
  const hintButton = document.getElementById('hint-button');
  const hintDiv = document.getElementById('hint');
  const actionHints = document.getElementById('action-hints');
  // load completed levels from localStorage
  let completedLevels = JSON.parse(localStorage.getItem('morseCompleted') || '[]');
  // determine initial selected level: first incomplete or last
  let selectedId = (window.trainingLevels && Array.isArray(window.trainingLevels))
    ? (window.trainingLevels.find(l => !completedLevels.includes(l.id)) || window.trainingLevels[window.trainingLevels.length-1]).id
    : null;
  // populate levels list in sidebar
  const levelsList = document.getElementById('levels-list');
  if (window.trainingLevels && Array.isArray(window.trainingLevels)) {
    window.trainingLevels.forEach(level => {
      const li = document.createElement('li');
      li.textContent = level.name;
      li.dataset.id = level.id;
      li.classList.add('level-item');
      if (completedLevels.includes(level.id)) li.classList.add('completed');
      if (selectedId === level.id) li.classList.add('selected');
      li.addEventListener('click', () => selectLevel(level.id));
      levelsList.appendChild(li);
    });
  }
  // current level display
  const currentLevelDiv = document.getElementById('current-level');
  function updateCurrentLevelDisplay() {
    const lvl = window.trainingLevels.find(l => l.id === selectedId);
    currentLevelDiv.textContent = lvl ? lvl.name : '';
  }
  updateCurrentLevelDisplay();
  function selectLevel(id) {
    selectedId = id;
    document.querySelectorAll('.level-item').forEach(el =>
      el.classList.toggle('selected', el.dataset.id === id)
    );
    updateCurrentLevelDisplay();
  }
  // initialize speed slider display
  speedSlider.value = wpm;
  speedLabel.textContent = wpm + ' WPM';

  startButton.addEventListener('click', startTest);
  menuToggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    menuToggle.classList.toggle('open', isOpen);
    // use arrow icon when open
    menuToggle.textContent = isOpen ? '<' : '☰';
  });
  speedSlider.addEventListener('input', (e) => {
    wpm = parseInt(e.target.value, 10);
    unit = 1200 / wpm;
    speedLabel.textContent = wpm + ' WPM';
    // persist preference
    localStorage.setItem('morseWpm', wpm);
  });
  function replayCurrent() {
    if (!audioContext) return;
    // count user-triggered replay
    replayCount++;
    waitingForInput = false;
    playMorse(currentChar).then(() => {
      waitingForInput = true;
    });
  }
  replayButton.addEventListener('click', replayCurrent);
  hintButton.addEventListener('click', () => {
    const symbols = morseMap[currentChar];
    const visual = symbols
      .split('')
      .map(s => s === '.' ? '·' : '–')
      .join(' ');
    hintDiv.textContent = visual;
  });

  function startTest() {
    // Initialize level and mastery state
    const lvl = (window.trainingLevels || []).find(l => l.id === selectedId) || { chars: defaultChars, type: 'standard' };
    chars = [...lvl.chars];
    // Reset per-char points
    charPoints = {};
    chars.forEach(c => { charPoints[c] = 0; });
    // Reset misc counters
    firstTryCount = 0;
    replayCount = 0;
    startTime = Date.now();
    // Clear mistakes
    for (const k in mistakesMap) delete mistakesMap[k];
    // UI setup
    resultsDiv.innerHTML = '';
    statusDiv.style.display = '';
    statusDiv.textContent = '';
    startButton.style.display = 'none';
    document.getElementById('controls').style.display = 'block';
    actionHints.textContent = 'Tab: Replay, Esc: End Test';
    document.addEventListener('keydown', handleKeydown);
    // Initialize audio
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // Show initial progress
    updateProgress();
    // Ask first question
    nextQuestion();
  }

  // pick next char based on mastery weights
  function pickNextChar() {
    const pool = [];
    chars.forEach(c => {
      const w = (charPoints[c] >= targetPoints ? completedWeight : 1);
      pool.push({ char: c, weight: w });
    });
    const totalW = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * totalW;
    for (const p of pool) {
      if (r < p.weight) return p.char;
      r -= p.weight;
    }
    return pool[pool.length - 1].char;
  }
  // update progress display: Mastered X/Y
  function updateProgress() {
    const mastered = chars.filter(c => charPoints[c] >= targetPoints).length;
    progressDiv.textContent = `Mastered: ${mastered}/${chars.length}`;
    // If all mastered, finish
    if (mastered === chars.length) {
      finishTest();
    }
  }
  async function nextQuestion() {
    currentChar = pickNextChar();
    currentMistakes = 0;
    statusDiv.textContent = '';
    statusDiv.classList.remove('success', 'error');
    hintDiv.textContent = '';
    waitingForInput = false;
    await playMorse(currentChar);
    questionStartTime = Date.now();
    waitingForInput = true;
  }

  function handleKeydown(e) {
    // Tab to replay, Escape to bail out
    if (e.key === 'Tab') {
      e.preventDefault();
      replayCurrent();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      finishTest();
      return;
    }
    if (!waitingForInput) return;
    const key = e.key.toLowerCase();
    if (key.length !== 1 || !chars.includes(key)) {
      return;
    }
    if (key === currentChar) {
      waitingForInput = false;
      // first-try count
      if (currentMistakes === 0) firstTryCount++;
      // calculate response time
      const delta = (Date.now() - questionStartTime) / 1000;
      let pts = 0;
      if (delta <= fastThreshold) pts = 1;
      else if (delta < maxThreshold) pts = (maxThreshold - delta) / maxThreshold;
      // award and clamp
      charPoints[currentChar] = Math.min(targetPoints, charPoints[currentChar] + pts);
      statusDiv.textContent = 'Correct!';
      statusDiv.classList.remove('error');
      statusDiv.classList.add('success');
      updateProgress();
      setTimeout(nextQuestion, unit);
    } else {
      // incorrect: increment mistakes, replay sound
      currentMistakes++;
      mistakesMap[currentChar] = (mistakesMap[currentChar] || 0) + 1;
      statusDiv.textContent = 'Incorrect! Try again.';
      statusDiv.classList.remove('success');
      statusDiv.classList.add('error');
      waitingForInput = false;
      // incorrect: lose one point
      charPoints[currentChar] = Math.max(0, charPoints[currentChar] - 1);
      // checkpoint strike logic
      if (strikeLimit !== null) {
        strikeCount++;
        if (strikeCount >= strikeLimit) {
          finishTest();
          return;
        }
      }
      // replay
      playMorse(currentChar).then(() => { waitingForInput = true; });
    }
  }

  // handler for summary action keys: Tab to repeat, Enter to next lesson
  function handleSummaryKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.removeEventListener('keydown', handleSummaryKeydown);
      // repeat same level
      startTest();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      document.removeEventListener('keydown', handleSummaryKeydown);
      // advance to next level if available
      if (window.trainingLevels && Array.isArray(window.trainingLevels)) {
        const idx = window.trainingLevels.findIndex(l => l.id === selectedId);
        if (idx >= 0 && idx < window.trainingLevels.length - 1) {
          const next = window.trainingLevels[idx + 1];
          selectLevel(next.id);
          startTest();
        }
      }
    }
  }
  function finishTest() {
    const endTime = Date.now();
    const elapsedSec = (endTime - startTime) / 1000;
    const struggles = Object.entries(mistakesMap)
      .filter(([c, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    // format time as MM:SS with hover tooltip for precise seconds
    const totalSec = elapsedSec;
    const minutes = Math.floor(totalSec / 60);
    const secondsInt = Math.floor(totalSec % 60);
    const pad = n => n.toString().padStart(2, '0');
    const displayTime = `${pad(minutes)}:${pad(secondsInt)}`;
    const tooltipTime = `${totalSec.toFixed(2)}s`;
    let html = `<p>Level Complete!</p>`;
    html += `<p>Time: <span title="${tooltipTime}">${displayTime}</span></p>`;
    html += `<p>Replays: ${replayCount}</p>`;
    if (struggles.length > 0) {
      html += '<p>Characters you struggled with:</p><ul>';
      struggles.forEach(([c, count]) => {
        html += `<li>${c.toUpperCase()}: ${count} mistake${count > 1 ? 's' : ''}</li>`;
      });
      html += '</ul>';
    }
    resultsDiv.innerHTML = html;
    progressDiv.style.display = 'none';
    statusDiv.style.display = 'none';
    // hide replay/hint controls
    document.getElementById('controls').style.display = 'none';
    hintDiv.textContent = '';
    waitingForInput = false;
    document.removeEventListener('keydown', handleKeydown);
    // mark current level completed and persist
    if (!completedLevels.includes(selectedId)) {
      completedLevels.push(selectedId);
      localStorage.setItem('morseCompleted', JSON.stringify(completedLevels));
      const completedEl = document.querySelector(`.level-item[data-id="${selectedId}"]`);
      if (completedEl) completedEl.classList.add('completed');
    }
    // show summary action hints: replay current or next lesson
    actionHints.textContent = 'Tab: Repeat Lesson, Enter: Next Lesson';
    document.addEventListener('keydown', handleSummaryKeydown);
  }

  function playMorse(char) {
    const symbols = morseMap[char];
    return new Promise(async (resolve) => {
      for (let i = 0; i < symbols.length; i++) {
        await playSymbol(symbols[i]);
        await wait(unit);
      }
      await wait(unit * 2);
      resolve();
    });
  }

  function playSymbol(symbol) {
    return new Promise((resolve) => {
      const duration = symbol === '.' ? unit : unit * 3;
      const osc = audioContext.createOscillator();
      osc.frequency.value = 600;
      osc.type = 'sine';
      osc.connect(audioContext.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        resolve();
      }, duration);
    });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

})();