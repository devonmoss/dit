(function() {
  const totalChars = 50;
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  const morseMap = {
    'a':'.-','b':'-...','c':'-.-.','d':'-..','e':'.','f':'..-.','g':'--.',
    'h':'....','i':'..','j':'.---','k':'-.-','l':'.-..','m':'--','n':'-.',
    'o':'---','p':'.--.','q':'--.-','r':'.-.','s':'...','t':'-','u':'..-',
    'v':'...-','w':'.--','x':'-..-','y':'-.--','z':'--..',
    '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....',
    '6':'-....','7':'--...','8':'---..','9':'----.'
  };
  let currentIndex = 0;
  let firstTryCount = 0;
  const mistakesMap = {};
  let currentChar = '';
  let currentMistakes = 0;
  let startTime = null;
  let waitingForInput = false;
  let wpm = 20; // words per minute
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
  // initialize speed slider display
  speedSlider.value = wpm;
  speedLabel.textContent = wpm + ' WPM';

  startButton.addEventListener('click', startTest);
  menuToggle.addEventListener('click', () => {
    menu.classList.toggle('open');
  });
  speedSlider.addEventListener('input', (e) => {
    wpm = parseInt(e.target.value, 10);
    unit = 1200 / wpm;
    speedLabel.textContent = wpm + ' WPM';
  });
  replayButton.addEventListener('click', () => {
    if (!audioContext) return;
    waitingForInput = false;
    playMorse(currentChar).then(() => {
      waitingForInput = true;
    });
  });
  hintButton.addEventListener('click', () => {
    const symbols = morseMap[currentChar];
    const visual = symbols
      .split('')
      .map(s => s === '.' ? '·' : '–')
      .join(' ');
    hintDiv.textContent = visual;
  });

  function startTest() {
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
      playMorse(currentChar).then(() => {
        waitingForInput = true;
      });
    }
  }

  function finishTest() {
    const endTime = Date.now();
    const elapsedSec = (endTime - startTime) / 1000;
    const accuracy = ((firstTryCount / totalChars) * 100).toFixed(2);
    const wpm = ((totalChars / 5) / (elapsedSec / 60)).toFixed(2);
    const struggles = Object.entries(mistakesMap)
      .filter(([c, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    let html = `<p>Test complete!</p>`;
    html += `<p>Accuracy: ${accuracy}%</p>`;
    html += `<p>Speed: ${wpm} WPM</p>`;
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

  document.addEventListener('keydown', handleKeydown);
})();