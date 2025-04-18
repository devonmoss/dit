(function() {
  const totalChars = 50;
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
  let currentIndex = 0;
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
  // select character set and rules based on selected level
  const lvl = (window.trainingLevels || []).find(l => l.id === selectedId) || { chars: defaultChars, type: 'standard', strikeLimit: null };
  chars = [...lvl.chars];
  if (lvl.type === 'checkpoint') {
    strikeLimit = lvl.strikeLimit || null;
    strikeCount = 0;
  } else {
    strikeLimit = null;
  }
  // reset test state variables
    currentIndex = 0;
    firstTryCount = 0;
    // clear mistakes map
    for (const k in mistakesMap) delete mistakesMap[k];
    // clear UI
    resultsDiv.innerHTML = '';
    progressDiv.style.display = '';
    statusDiv.style.display = '';
    statusDiv.textContent = '';
    // reset replay count and set up action hints and key handling
    replayCount = 0;
    actionHints.textContent = 'Tab: Replay, Esc: End Test';
    document.addEventListener('keydown', handleKeydown);
    // hide start button
    startButton.style.display = 'none';
    progressDiv.textContent = `Character 0 of ${totalChars}`;
    // initialize speed controls
    speedLabel.textContent = wpm + ' WPM';
    speedSlider.value = wpm;
    // show replay/hint controls
    document.getElementById('controls').style.display = 'block';
    startTime = Date.now();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    nextChar();
  }

  async function nextChar() {
    if (currentIndex >= totalChars) {
      finishTest();
      return;
    }
    currentIndex++;
    progressDiv.textContent = `Character ${currentIndex} of ${totalChars}`;
    currentChar = chars[Math.floor(Math.random() * chars.length)];
    currentMistakes = 0;
    statusDiv.textContent = '';
    statusDiv.classList.remove('success');
    statusDiv.classList.remove('error');
    waitingForInput = false;
    hintDiv.textContent = '';
    await playMorse(currentChar);
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
      if (currentMistakes === 0) {
        firstTryCount++;
      }
      statusDiv.textContent = 'Correct!';
      statusDiv.classList.remove('error');
      statusDiv.classList.add('success');
      setTimeout(nextChar, unit);
    } else {
      // incorrect: increment mistakes, replay sound
      currentMistakes++;
      mistakesMap[currentChar] = (mistakesMap[currentChar] || 0) + 1;
      statusDiv.textContent = 'Incorrect! Try again.';
      statusDiv.classList.remove('success');
      statusDiv.classList.add('error');
      waitingForInput = false;
      // checkpoint strike logic
      if (strikeLimit !== null) {
        strikeCount++;
        if (strikeCount >= strikeLimit) {
          finishTest();
          return;
        }
      }
      playMorse(currentChar).then(() => {
        waitingForInput = true;
      });
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
    const attempted = currentIndex;
    const endTime = Date.now();
    const elapsedSec = (endTime - startTime) / 1000;
    const accuracy = ((firstTryCount / attempted) * 100).toFixed(2);
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
    let html = `<p>Test complete!</p>`;
    html += `<p>Accuracy: ${accuracy}%</p>`;
    html += `<p>Time: <span title="${tooltipTime}">${displayTime}</span></p>`;
    html += `<p>Completed: ${attempted}/${totalChars}</p>`;
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