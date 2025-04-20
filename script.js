(function () {
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
  // delay after feedback (correct or incorrect) before next action (ms)
  const feedbackDelay = 750;
  // character mastery points
  let charPoints = {};
  // timestamp when current character was played
  let questionStartTime = null;
  // record of response times for each question in current test
  let responseTimes = [];
  // flag indicating an active test session
  let testActive = false;
  // flag for guided send test mode
  let guidedSendActive = false;
  // DOM container for mastery display
  const masteryContainer = document.getElementById("mastery-container");

  // Build the mastery circles for each char
  function generateMasteryDisplay() {
    masteryContainer.innerHTML = "";
    const level = window.trainingLevels.find((l) => l.id === selectedId) || {
      chars,
    };
    level.chars.forEach((c) => {
      // SVG circle: radius and circumference
      const r = 18;
      const cfs = 2 * Math.PI * r;
      const div = document.createElement("div");
      div.className = "char-master";
      div.dataset.char = c;
      div.innerHTML = `
        <svg><circle class="bg" cx="24" cy="24" r="${r}" stroke-dasharray="${cfs}" stroke-dashoffset="0" />
        <circle class="fg" cx="24" cy="24" r="${r}" stroke-dasharray="${cfs}" stroke-dashoffset="${cfs}" /></svg>
        <span class="char-label">${c.toUpperCase()}</span>
      `;
      masteryContainer.appendChild(div);
    });
  }

  // Update each circle fill by charPoints
  function updateMasteryDisplay() {
    masteryContainer.querySelectorAll(".char-master").forEach((el) => {
      const c = el.dataset.char;
      const pts = charPoints[c] || 0;
      const frac = Math.min(pts / targetPoints, 1);
      const circle = el.querySelector("circle.fg");
      const r = circle.getAttribute("r");
      const cfs = 2 * Math.PI * r;
      const offset = cfs * (1 - frac);
      circle.style.strokeDashoffset = offset;
    });
  }
  // default character set (a-z, 0-9)
  const defaultChars = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
  // current character set for this test (may vary by level)
  let chars = [...defaultChars];
  const morseMap = {
    a: ".-",
    b: "-...",
    c: "-.-.",
    d: "-..",
    e: ".",
    f: "..-.",
    g: "--.",
    h: "....",
    i: "..",
    j: ".---",
    k: "-.-",
    l: ".-..",
    m: "--",
    n: "-.",
    o: "---",
    p: ".--.",
    q: "--.-",
    r: ".-.",
    s: "...",
    t: "-",
    u: "..-",
    v: "...-",
    w: ".--",
    x: "-..-",
    y: "-.--",
    z: "--..",
    0: "-----",
    1: ".----",
    2: "..---",
    3: "...--",
    4: "....-",
    5: ".....",
    6: "-....",
    7: "--...",
    8: "---..",
    9: "----.",
  };
  // let currentIndex = 0; // retired: using mastery-based flow
  let strikeLimit = null;
  let strikeCount = 0;
  let firstTryCount = 0;
  const mistakesMap = {};
  let currentChar = "";
  let currentMistakes = 0;
  let startTime = null;
  let waitingForInput = false;
  let replayCount = 0; // user-initiated replays
  // load preferred speed from localStorage or default to 20 WPM
  let wpm = (function () {
    const stored = parseInt(localStorage.getItem("morseWpm"), 10);
    return stored && !isNaN(stored) ? stored : 20;
  })();
  let unit = 1200 / wpm; // duration of one morse unit in ms
  let audioContext = null;
  let gainNode = null; // Add gain node for volume control

  // load preferred volume from localStorage or default to 75
  let volume = (function () {
    const stored = parseInt(localStorage.getItem("morseVolume"), 10);
    return stored && !isNaN(stored) ? stored : 75;
  })();

  const startButton = document.getElementById("start-button");
  const progressDiv = document.getElementById("progress");
  const statusDiv = document.getElementById("status");
  const resultsDiv = document.getElementById("results");
  const menuToggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");
  const speedSlider = document.getElementById("speed-slider");
  const speedLabel = document.getElementById("speed-label");
  const volumeSlider = document.getElementById("volume-slider");
  const volumeLabel = document.getElementById("volume-label");
  const replayButton = document.getElementById("replay-button");
  const hintButton = document.getElementById("hint-button");
  const hintDiv = document.getElementById("hint");
  const actionHints = document.getElementById("action-hints");
  const strikesDiv = document.getElementById("strikes");
  // load completed levels from localStorage
  let completedLevels = JSON.parse(
    localStorage.getItem("morseCompleted") || "[]",
  );
  // determine initial selected level: first incomplete or last
  let selectedId =
    window.trainingLevels && Array.isArray(window.trainingLevels)
      ? (
          window.trainingLevels.find((l) => !completedLevels.includes(l.id)) ||
          window.trainingLevels[window.trainingLevels.length - 1]
        ).id
      : null;
  // populate levels list in sidebar
  const levelsList = document.getElementById("levels-list");
  if (window.trainingLevels && Array.isArray(window.trainingLevels)) {
    window.trainingLevels.forEach((level) => {
      const li = document.createElement("li");
      li.textContent = level.name;
      li.dataset.id = level.id;
      li.classList.add("level-item");
      if (completedLevels.includes(level.id)) li.classList.add("completed");
      if (selectedId === level.id) li.classList.add("selected");
      li.addEventListener("click", () => selectLevel(level.id));
      levelsList.appendChild(li);
    });
  }
  // current level display
  const currentLevelDiv = document.getElementById("current-level");
  function updateCurrentLevelDisplay() {
    const lvl = window.trainingLevels.find((l) => l.id === selectedId);
    currentLevelDiv.textContent = lvl ? lvl.name : "";
  }
  updateCurrentLevelDisplay();
  function selectLevel(id) {
    selectedId = id;
    document
      .querySelectorAll(".level-item")
      .forEach((el) => el.classList.toggle("selected", el.dataset.id === id));
    updateCurrentLevelDisplay();
  }
  // initialize speed slider display
  speedSlider.value = wpm;
  speedLabel.textContent = wpm + " WPM";

  // initialize volume slider display
  volumeSlider.value = volume;
  volumeLabel.textContent = volume + "%";

  startButton.addEventListener("click", startTest);
  menuToggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    menuToggle.classList.toggle("open", isOpen);
    // use arrow icon when open
    menuToggle.textContent = isOpen ? "<" : "☰";
  });
  speedSlider.addEventListener("input", (e) => {
    wpm = parseInt(e.target.value, 10);
    unit = 1200 / wpm;
    speedLabel.textContent = wpm + " WPM";
    // persist preference
    localStorage.setItem("morseWpm", wpm);
  });

  volumeSlider.addEventListener("input", (e) => {
    volume = parseInt(e.target.value, 10);
    volumeLabel.textContent = volume + "%";
    if (gainNode) {
      gainNode.gain.value = volume / 100;
    }
    localStorage.setItem("morseVolume", volume);
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
  replayButton.addEventListener("click", replayCurrent);
  hintButton.addEventListener("click", () => {
    const symbols = morseMap[currentChar];
    const visual = symbols
      .split("")
      .map((s) => (s === "." ? "·" : "–"))
      .join(" ");
    hintDiv.textContent = visual;
  });
  // Progress dashboard elements
  const viewProgressBtn = document.getElementById("view-progress-button");
  const progressDashboard = document.getElementById("progress-dashboard");
  const containerDiv = document.getElementById("container");
  // View user progress
  viewProgressBtn.addEventListener("click", async () => {
    // check login session
    const {
      data: { session },
    } = await window.supabaseClient.auth.getSession();
    if (!session || !session.user) {
      alert("Please log in to view your progress.");
      return;
    }
    // fetch progress records
    const { data, error } = await window.supabaseClient
      .from("progress")
      .select("level_id, time_sec, replays, mistakes, times, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading progress:", error);
      alert("Failed to load progress data.");
      return;
    }
    // build dashboard HTML
    let html = '<button id="back-to-trainer">Back to Trainer</button>';
    html += "<h2>My Progress</h2>";
    html +=
      "<table><thead><tr><th>Date</th><th>Level</th><th>Time</th><th>Replays</th><th>Mistakes</th><th>Avg Times</th></tr></thead><tbody>";
    data.forEach((row) => {
      const date = new Date(row.created_at).toLocaleString();
      const totalSec = row.time_sec;
      const mm = Math.floor(totalSec / 60)
        .toString()
        .padStart(2, "0");
      const ss = (totalSec % 60).toFixed(2).padStart(5, "0");
      const time = `${mm}:${ss}`;
      const mistakesList = Object.entries(row.mistakes || {})
        .map(([c, count]) => `${c.toUpperCase()}:${count}`)
        .join(", ");
      // average response times per character
      const timesList = Object.entries(row.times || {})
        .map(([c, t]) => `${c.toUpperCase()}:${t.toFixed(2)}s`)
        .join(", ");
      html += `<tr><td>${date}</td><td>${row.level_id}</td><td>${time}</td><td>${row.replays}</td><td>${mistakesList}</td><td>${timesList}</td></tr>`;
    });
    html += "</tbody></table>";
    progressDashboard.innerHTML = html;
    // close menu if open
    menu.classList.remove("open");
    menuToggle.classList.remove("open");
    menuToggle.textContent = "☰";
    // show dashboard
    containerDiv.style.display = "none";
    actionHints.style.display = "none";
    progressDashboard.style.display = "flex";
    // back button
    document.getElementById("back-to-trainer").addEventListener("click", () => {
      progressDashboard.style.display = "none";
      containerDiv.style.display = "flex";
      actionHints.style.display = "block";
    });
  });
  // Sending Trainer UI elements
  const sendingBtn = document.getElementById("sending-button");
  const sendingDiv = document.getElementById("sending-trainer");
  // Mode toggle setup (Copy vs Send)
  const modeCopyRadio = document.getElementById("mode-copy");
  const modeSendRadio = document.getElementById("mode-send");
  let currentMode = "copy";
  modeCopyRadio.addEventListener("change", () => {
    if (modeCopyRadio.checked) setMode("copy");
  });
  modeSendRadio.addEventListener("change", () => {
    if (modeSendRadio.checked) setMode("send");
  });
  function setMode(mode) {
    if (mode === currentMode) return;
    if (mode === "send" && testActive) finishTest(false);
    if (mode === "copy" && guidedSendActive) finishSendTest();
    currentMode = mode;
    renderMode();
  }
  function renderMode() {
    if (currentMode === "copy") {
      containerDiv.style.display = "flex";
      actionHints.style.display = "block";
      sendingDiv.style.display = "none";
      progressDashboard.style.display = "none";
      startButton.style.display = "inline-block";
    } else {
      containerDiv.style.display = "none";
      actionHints.style.display = "none";
      sendingDiv.style.display = "flex";
      progressDashboard.style.display = "none";
      startButton.style.display = "none";
      // reset send UI to initial state
      sendStartButton.style.display = "inline-block";
      sendResultsDiv.style.display = "none";
    }
  }
  // initialize mode view
  renderMode();

  const backFromSendingBtn = document.getElementById("back-from-sending");
  const sendStartButton = document.getElementById("send-start-button");
  const sendResultsDiv = document.getElementById("send-results");
  sendResultsDiv.style.display = "none";
  const sendCurrentMetaDiv = document.getElementById("send-current-meta");
  const sendingInstructions = document.getElementById("sending-instructions");
  // Start button for send mode
  sendStartButton.addEventListener("click", () => {
    startSendTest();
  });
  // const sendingDiv = document.getElementById("sending-trainer");
  // const backFromSendingBtn = document.getElementById("back-from-sending");
  const sendSpeedSlider = document.getElementById("send-speed-slider");
  const sendSpeedLabel = document.getElementById("send-speed-label");
  const keyerOutput = document.getElementById("keyer-output");
  const sendClearBtn = document.getElementById("send-clear-button");
  let sendingMode = false;
  // track paddle key states for squeeze functionality
  const keyState = { ArrowLeft: false, ArrowRight: false };
  // queue of user-triggered symbols to support taps during play
  const sendQueue = [];
  // inverse Morse map for decoding
  const invMorseMap = Object.fromEntries(
    Object.entries(morseMap).map(([k, v]) => [v, k]),
  );
  // buffer for current letter's symbols
  let codeBuffer = "";
  // buffer for decoded letters making current word
  let wordBuffer = "";
  // decoded text output
  const decodedDiv = document.getElementById("decoded-output");
  let sendWpm = (function () {
    const stored = parseInt(localStorage.getItem("morseSendWpm"), 10);
    return stored && !isNaN(stored) ? stored : 20;
  })();
  let sendUnit = 1200 / sendWpm;
  // Initialize send speed UI
  sendSpeedSlider.value = sendWpm;
  sendSpeedLabel.textContent = sendWpm;
  sendSpeedSlider.addEventListener("input", (e) => {
    sendWpm = parseInt(e.target.value, 10);
    sendUnit = 1200 / sendWpm;
    sendSpeedLabel.textContent = sendWpm;
    localStorage.setItem("morseSendWpm", sendWpm);
  });
  sendingBtn.addEventListener("click", () => {
    // Open sending trainer view
    sendingMode = true;
    containerDiv.style.display = "none";
    progressDashboard.style.display = "none";
    actionHints.style.display = "none";
    menu.classList.remove("open");
    menuToggle.classList.remove("open");
    menuToggle.textContent = "☰";
    sendingDiv.style.display = "flex";
    // capture paddle key events
    keyState.ArrowLeft = false;
    keyState.ArrowRight = false;
    document.addEventListener("keydown", sendKeydown);
    document.addEventListener("keyup", sendKeyup);
    // start send loop
    sendLoop();
  });
  backFromSendingBtn.addEventListener("click", () => {
    // Close sending trainer view
    sendingMode = false;
    sendingDiv.style.display = "none";
    containerDiv.style.display = "flex";
    actionHints.style.display = "block";
    document.removeEventListener("keydown", sendKeydown);
    document.removeEventListener("keyup", sendKeyup);
  });
  sendClearBtn.addEventListener("click", () => {
    keyerOutput.textContent = "";
    decodedDiv.textContent = "";
    codeBuffer = "";
    wordBuffer = "";
  });
  // called when a word has been fully sent (after word gap)
  function handleWordComplete(word) {
    console.log("Word complete:", word);
    // clear word buffer for next word
  }
  // Save original sending handler for free-run sending
  const originalHandleWordComplete = handleWordComplete;
  // Guided send test state and elements
  let sendChars = [];
  let sendCharPoints = {};
  let sendCurrentChar = "";
  let sendCurrentMistakes = 0;
  let sendQuestionStartTime = null;
  const sendMasteryContainer = document.getElementById(
    "send-mastery-container",
  );
  const sendCurrentLevelDiv = document.getElementById("send-current-level");
  const sendCurrentCharDiv = document.getElementById("send-current-char");
  const sendProgressDiv = document.getElementById("send-progress");
  const sendStatusDiv = document.getElementById("send-status");
  // Pick next send character weighted by mastery
  function pickNextSendChar() {
    const pool = sendChars.map((c) => ({
      char: c,
      weight: sendCharPoints[c] >= targetPoints ? completedWeight : 1,
    }));
    const totalW = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * totalW;
    for (const p of pool) {
      if (r < p.weight) return p.char;
      r -= p.weight;
    }
    return pool[pool.length - 1].char;
  }
  // Render mastery circles for send mode
  function generateSendMasteryDisplay() {
    sendMasteryContainer.innerHTML = "";
    sendChars.forEach((c) => {
      const r = 18;
      const cfs = 2 * Math.PI * r;
      const div = document.createElement("div");
      div.className = "char-master";
      div.dataset.char = c;
      div.innerHTML = `
        <svg><circle class="bg" cx="24" cy="24" r="${r}" stroke-dasharray="${cfs}" stroke-dashoffset="0" />
        <circle class="fg" cx="24" cy="24" r="${r}" stroke-dasharray="${cfs}" stroke-dashoffset="${cfs}" /></svg>
        <span class="char-label">${c.toUpperCase()}</span>
      `;
      sendMasteryContainer.appendChild(div);
    });
  }
  // Update mastery circles fill
  function updateSendMasteryDisplay() {
    sendMasteryContainer.querySelectorAll(".char-master").forEach((el) => {
      const c = el.dataset.char;
      const pts = sendCharPoints[c] || 0;
      const frac = Math.min(pts / targetPoints, 1);
      const circle = el.querySelector("circle.fg");
      const r = circle.getAttribute("r");
      const cfs = 2 * Math.PI * r;
      const offset = cfs * (1 - frac);
      circle.style.strokeDashoffset = offset;
    });
  }
  // Update progress text and finish when all mastered
  function updateSendProgress() {
    const mastered = sendChars.filter(
      (c) => sendCharPoints[c] >= targetPoints,
    ).length;
    sendProgressDiv.textContent = `Mastered: ${mastered}/${sendChars.length}`;
    if (mastered === sendChars.length) finishSendTest();
  }
  // Advance to next send question
  function nextSendQuestion() {
    sendCurrentChar = pickNextSendChar();
    sendCurrentMistakes = 0;
    const lvl = window.trainingLevels.find((l) => l.id === selectedId) || {};
    sendCurrentLevelDiv.textContent = lvl.name || "";
    sendCurrentCharDiv.textContent = sendCurrentChar.toUpperCase();
    sendStatusDiv.textContent = "";
    sendQuestionStartTime = Date.now();
  }
  // Start guided send test
  function startSendTest() {
    guidedSendActive = true;
    // initialize test metrics
    sendStartButton.style.display = 'none';
    sendResultsDiv.innerHTML = '';
    sendTestStartTime = Date.now();
    sendResponseTimes = [];
    sendMistakesMap = {};
    const lvl = window.trainingLevels.find((l) => l.id === selectedId) || {
      chars: defaultChars,
    };
    sendChars = [...lvl.chars];
    sendCharPoints = {};
    sendChars.forEach((c) => (sendCharPoints[c] = 0));
    keyerOutput.textContent = "";
    decodedDiv.textContent = "";
    generateSendMasteryDisplay();
    updateSendMasteryDisplay();
    updateSendProgress();
    // enable sending loop
    sendingMode = true;
    document.addEventListener("keydown", sendKeydown);
    document.addEventListener("keyup", sendKeyup);
    // override handler
    handleWordComplete = guidedSendHandleWordComplete;
    nextSendQuestion();
    sendLoop();
  }
  // Finish guided send test
  function finishSendTest() {
    guidedSendActive = false;
    sendingMode = false;
    document.removeEventListener("keydown", sendKeydown);
    document.removeEventListener("keyup", sendKeyup);
    handleWordComplete = originalHandleWordComplete;
    sendStatusDiv.textContent = "Complete!";
    sendStatusDiv.classList.add("success");
    // hide send UI elements for summary
    sendCurrentMetaDiv.style.display = "none";
    sendMasteryContainer.style.display = "none";
    sendProgressDiv.style.display = "none";
    sendStatusDiv.style.display = "none";
    sendStartButton.style.display = "none";
    sendingInstructions.style.display = "none";
    // hide send speed controls
    const sendSpeedLabelEl = document.querySelector('label[for="send-speed-slider"]');
    if (sendSpeedLabelEl) sendSpeedLabelEl.style.display = "none";
    sendSpeedSlider.style.display = "none";
    // hide keyer output and controls
    keyerOutput.style.display = "none";
    decodedDiv.style.display = "none";
    sendClearBtn.style.display = "none";
    // build summary
    const sendEndTime = Date.now();
    const elapsed = (sendEndTime - sendTestStartTime) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const secondsInt = Math.floor(elapsed % 60);
    const pad = (n) => n.toString().padStart(2, "0");
    const displayTime = `${pad(minutes)}:${pad(secondsInt)}`;
    let html = "<p>Lesson Complete!</p>";
    html += `<p>Time: ${displayTime}</p>`;
    const struggles = Object.entries(sendMistakesMap).filter(([, cnt]) => cnt > 0);
    if (struggles.length > 0) {
      html += "<p>Characters you struggled with:</p><ul>";
      struggles.forEach(([c, cnt]) => {
        html += `<li>${c.toUpperCase()}: ${cnt} mistake${cnt > 1 ? "s" : ""}</li>`;
      });
      html += "</ul>";
    }
    sendResultsDiv.innerHTML = html;
    sendResultsDiv.style.display = "block";
    // show summary action hints
    actionHints.style.display = "block";
    actionHints.textContent = "Tab: Repeat Lesson, Enter: Next Lesson";
    document.addEventListener("keydown", handleSummarySendKeydown);
  }
  // Custom handler for guided send completion of each letter
  function guidedSendHandleWordComplete(word) {
    if (!guidedSendActive) {
      return originalHandleWordComplete(word);
    }
    if (!word) return;
    const letter = word[0];
    if (letter === sendCurrentChar) {
      if (sendCurrentMistakes === 0) {
        // first-try success (could track)
      }
      sendCharPoints[sendCurrentChar] = Math.min(
        sendCharPoints[sendCurrentChar] + 1,
        targetPoints,
      );
      updateSendMasteryDisplay();
      updateSendProgress();
      sendStatusDiv.textContent = "✓";
      sendStatusDiv.classList.add("success");
      setTimeout(() => {
        sendStatusDiv.textContent = "";
        sendStatusDiv.classList.remove("success");
        nextSendQuestion();
      }, feedbackDelay);
    } else {
      sendCurrentMistakes++;
      sendStatusDiv.textContent = "✕";
      sendStatusDiv.classList.add("error");
      setTimeout(() => {
        sendStatusDiv.textContent = "";
        sendStatusDiv.classList.remove("error");
      }, feedbackDelay);
    }
  }
  // Summary key handler for send mode: Tab to repeat, Enter to next lesson
  function handleSummarySendKeydown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      document.removeEventListener("keydown", handleSummarySendKeydown);
      // clear summary display
      sendResultsDiv.style.display = "none";
      actionHints.style.display = "none";
      // restore send UI elements
      sendCurrentMetaDiv.style.display = "";
      sendMasteryContainer.style.display = "";
      sendProgressDiv.style.display = "";
      sendStatusDiv.style.display = "";
      sendingInstructions.style.display = "";
      document.querySelector('label[for="send-speed-slider"]').style.display = "";
      sendSpeedSlider.style.display = "";
      keyerOutput.style.display = "";
      decodedDiv.style.display = "";
      sendClearBtn.style.display = "";
      // restart lesson
      startSendTest();
    } else if (e.key === "Enter") {
      e.preventDefault();
      document.removeEventListener("keydown", handleSummarySendKeydown);
      // advance level
      if (window.trainingLevels && Array.isArray(window.trainingLevels)) {
        const idx = window.trainingLevels.findIndex((l) => l.id === selectedId);
        if (idx >= 0 && idx < window.trainingLevels.length - 1) {
          const next = window.trainingLevels[idx + 1];
          selectLevel(next.id);
        }
      }
      // clear summary and start next lesson
      sendResultsDiv.style.display = "none";
      actionHints.style.display = "none";
      startSendTest();
    }
  }
  // Paddle key handlers: handle initial press and queue taps
  function sendKeydown(e) {
    if (!sendingMode) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (!keyState.ArrowLeft) sendQueue.push(".");
      keyState.ArrowLeft = true;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!keyState.ArrowRight) sendQueue.push("-");
      keyState.ArrowRight = true;
    }
  }
  function sendKeyup(e) {
    if (!sendingMode) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      keyState[e.key] = false;
    }
  }
  // Main send loop: handles queued taps, squeeze auto-keying, and decoding at gaps
  async function sendLoop() {
    let lastSymbol = null;
    let lastTime = Date.now();
    while (sendingMode) {
      const now = Date.now();
      const gap = now - lastTime;
      // word gap detection: >=7 units
      if (gap >= sendUnit * 7 && (codeBuffer || wordBuffer)) {
        // decode pending letter
        if (codeBuffer) {
          const letter = invMorseMap[codeBuffer] || "?";
          decodedDiv.textContent += letter;
          wordBuffer += letter;
          codeBuffer = "";
        }
        // word complete: evaluate and clear displays
        if (typeof handleWordComplete === "function") {
          handleWordComplete(wordBuffer);
        }
        keyerOutput.textContent = "";
        decodedDiv.textContent = "";
        wordBuffer = "";
        lastTime = now;
        await wait(10);
        continue;
      }
      // letter gap detection: >=3 units
      if (gap >= sendUnit * 3 && codeBuffer) {
        const letter = invMorseMap[codeBuffer] || "?";
        decodedDiv.textContent += letter;
        wordBuffer += letter;
        codeBuffer = "";
        lastTime = now;
      }
      // determine next symbol: queued taps first
      let symbol;
      if (sendQueue.length > 0) {
        symbol = sendQueue.shift();
      } else {
        const left = keyState.ArrowLeft;
        const right = keyState.ArrowRight;
        if (!left && !right) {
          await wait(10);
          continue;
        } else if (left && right) {
          symbol = lastSymbol === "." ? "-" : ".";
        } else if (left) {
          symbol = ".";
        } else {
          symbol = "-";
        }
      }
      // play and display symbol
      await playSendSymbol(symbol);
      keyerOutput.textContent += symbol;
      codeBuffer += symbol;
      lastSymbol = symbol;
      // inter-element gap
      await wait(sendUnit);
      lastTime = Date.now();
    }
  }
  function playSendSymbol(symbol) {
    if (!audioContext)
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return new Promise((resolve) => {
      const duration = symbol === "." ? sendUnit : sendUnit * 3;
      const osc = audioContext.createOscillator();
      osc.frequency.value = 600;
      osc.type = "sine";
      osc.connect(audioContext.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        resolve();
      }, duration);
    });
  }

  function startTest() {
    testActive = true;
    // Initialize level and mastery state
    const lvl = (window.trainingLevels || []).find(
      (l) => l.id === selectedId,
    ) || { chars: defaultChars, type: "standard" };
    chars = [...lvl.chars];
    // configure strikes for checkpoint levels
    if (lvl.type === "checkpoint" && typeof lvl.strikeLimit === "number") {
      strikeLimit = lvl.strikeLimit;
    } else {
      strikeLimit = null;
    }
    strikeCount = 0;
    // initialize strike display
    if (strikeLimit !== null) {
      strikesDiv.style.display = "flex";
      strikesDiv.innerHTML = "";
      for (let i = 1; i <= strikeLimit; i++) {
        const span = document.createElement("span");
        span.className = "strike";
        span.dataset.strike = i;
        span.textContent = "✕";
        strikesDiv.appendChild(span);
      }
    } else {
      strikesDiv.style.display = "none";
    }
    // Reset per-char points
    charPoints = {};
    chars.forEach((c) => {
      charPoints[c] = 0;
    });
    // Reset misc counters
    firstTryCount = 0;
    replayCount = 0;
    startTime = Date.now();
    // reset response times log
    responseTimes = [];
    // Clear mistakes
    for (const k in mistakesMap) delete mistakesMap[k];
    // Render mastery circles
    generateMasteryDisplay();
    // UI setup
    resultsDiv.innerHTML = "";
    statusDiv.style.display = "";
    statusDiv.textContent = "";
    startButton.style.display = "none";
    progressDiv.style.display = "";
    document.getElementById("controls").style.display = "block";
    actionHints.textContent = "Tab: Replay, Esc: End Test";
    document.addEventListener("keydown", handleKeydown);
    // Initialize audio
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    gainNode.gain.value = volume / 100;
    gainNode.connect(audioContext.destination);
    // Show initial progress
    updateProgress();
    // Ask first question
    nextQuestion();
  }

  // pick next char based on mastery weights
  function pickNextChar() {
    const pool = [];
    chars.forEach((c) => {
      const w = charPoints[c] >= targetPoints ? completedWeight : 1;
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
    const mastered = chars.filter((c) => charPoints[c] >= targetPoints).length;
    progressDiv.textContent = `Mastered: ${mastered}/${chars.length}`;
    // If all mastered, finish
    if (mastered === chars.length) {
      finishTest();
    }
  }
  async function nextQuestion() {
    currentChar = pickNextChar();
    currentMistakes = 0;
    statusDiv.textContent = "";
    statusDiv.classList.remove("success", "error");
    hintDiv.textContent = "";
    waitingForInput = false;
    await playMorse(currentChar);
    questionStartTime = Date.now();
    waitingForInput = true;
  }

  function handleKeydown(e) {
    // Tab to replay, Escape to bail out
    if (e.key === "Tab") {
      e.preventDefault();
      replayCurrent();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      finishTest(false);
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
      // log response time for summary
      responseTimes.push({ char: currentChar, time: delta });
      let pts = 0;
      if (delta <= fastThreshold) pts = 1;
      else if (delta < maxThreshold)
        pts = (maxThreshold - delta) / maxThreshold;
      // award and clamp
      charPoints[currentChar] = Math.min(
        targetPoints,
        charPoints[currentChar] + pts,
      );
      updateMasteryDisplay();
      statusDiv.textContent = "Correct!";
      statusDiv.classList.remove("error");
      statusDiv.classList.add("success");
      updateProgress();
      if (testActive) {
        setTimeout(nextQuestion, feedbackDelay);
      }
    } else {
      // incorrect: increment mistakes, replay sound
      currentMistakes++;
      mistakesMap[currentChar] = (mistakesMap[currentChar] || 0) + 1;
      statusDiv.textContent = "Incorrect! Try again.";
      statusDiv.classList.remove("success");
      statusDiv.classList.add("error");
      waitingForInput = false;
      // incorrect: lose one point
      charPoints[currentChar] = Math.max(0, charPoints[currentChar] - 1);
      updateMasteryDisplay();
      // checkpoint strike logic
      if (strikeLimit !== null) {
        strikeCount++;
        // update strike indicators
        const span = strikesDiv.querySelector(
          `.strike[data-strike="${strikeCount}"]`,
        );
        if (span) span.classList.add("used");
        if (strikeCount >= strikeLimit) {
          finishTest(false);
          return;
        }
      }
      // play incorrect feedback sound, delay, then replay character
      playErrorSound()
        .then(() => wait(feedbackDelay))
        .then(() => playMorse(currentChar))
        .then(() => {
          waitingForInput = true;
        });
    }
  }

  // handler for summary action keys: Tab to repeat, Enter to next lesson
  function handleSummaryKeydown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      document.removeEventListener("keydown", handleSummaryKeydown);
      // repeat same level
      startTest();
    } else if (e.key === "Enter") {
      e.preventDefault();
      document.removeEventListener("keydown", handleSummaryKeydown);
      // advance to next level if available
      if (window.trainingLevels && Array.isArray(window.trainingLevels)) {
        const idx = window.trainingLevels.findIndex((l) => l.id === selectedId);
        if (idx >= 0 && idx < window.trainingLevels.length - 1) {
          const next = window.trainingLevels[idx + 1];
          selectLevel(next.id);
          startTest();
        }
      }
    }
  }
  function finishTest(completed = true) {
    testActive = false;
    // hide strike indicators
    strikesDiv.style.display = "none";
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
    const pad = (n) => n.toString().padStart(2, "0");
    const displayTime = `${pad(minutes)}:${pad(secondsInt)}`;
    const tooltipTime = `${totalSec.toFixed(2)}s`;
    let html = "";
    if (completed) {
      html += `<p>Level Complete!</p>`;
    } else {
      html += `<p>Level Incomplete</p>`;
    }
    html += `<p>Time: <span title="${tooltipTime}">${displayTime}</span></p>`;
    html += `<p>Replays: ${replayCount}</p>`;
    if (struggles.length > 0) {
      html += "<p>Characters you struggled with:</p><ul>";
      struggles.forEach(([c, count]) => {
        html += `<li>${c.toUpperCase()}: ${count} mistake${count > 1 ? "s" : ""}</li>`;
      });
      html += "</ul>";
    }
    // hide UI elements
    progressDiv.style.display = "none";
    statusDiv.style.display = "none";
    document.getElementById("controls").style.display = "none";
    hintDiv.textContent = "";
    waitingForInput = false;
    document.removeEventListener("keydown", handleKeydown);
    // mark current level completed locally
    if (completed && !completedLevels.includes(selectedId)) {
      completedLevels.push(selectedId);
      localStorage.setItem("morseCompleted", JSON.stringify(completedLevels));
      const completedEl = document.querySelector(
        `.level-item[data-id="${selectedId}"]`,
      );
      if (completedEl) completedEl.classList.add("completed");
    }
    // compute average response time per character for this test
    const charTimesMap = {};
    responseTimes.forEach((rt) => {
      if (!charTimesMap[rt.char]) charTimesMap[rt.char] = [];
      charTimesMap[rt.char].push(rt.time);
    });
    const avgTimes = {};
    Object.entries(charTimesMap).forEach(([c, timesArr]) => {
      avgTimes[c] = timesArr.reduce((sum, t) => sum + t, 0) / timesArr.length;
    });
    // asynchronously build summary with average times and optional history, then persist results
    (async () => {
      // determine login session
      const {
        data: { session },
      } = await window.supabaseClient.auth.getSession();
      let userHistAvg = null;
      if (session && session.user) {
        // fetch past progress times for this level
        const { data: prev, error: errPrev } = await window.supabaseClient
          .from("progress")
          .select("times")
          .eq("user_id", session.user.id)
          .eq("level_id", selectedId);
        if (prev && !errPrev) {
          const histMap = {};
          prev.forEach((r) => {
            if (r.times) {
              Object.entries(r.times).forEach(([ch, t]) => {
                if (!histMap[ch]) histMap[ch] = [];
                histMap[ch].push(t);
              });
            }
          });
          userHistAvg = {};
          Object.entries(histMap).forEach(([ch, arr]) => {
            userHistAvg[ch] = arr.reduce((s, x) => s + x, 0) / arr.length;
          });
        }
      }
      // build average times table
      html += '<div id="char-times"><h3>Average Response Times</h3>';
      html +=
        '<table class="times-table"><thead><tr><th>Char</th><th>This Test</th>';
      if (userHistAvg) html += "<th>Your Avg</th>";
      html += "</tr></thead><tbody>";
      Object.keys(avgTimes)
        .sort()
        .forEach((ch) => {
          html += "<tr>";
          html += `<td>${ch.toUpperCase()}</td>`;
          html += `<td>${avgTimes[ch].toFixed(2)}s</td>`;
          if (userHistAvg && userHistAvg[ch] != null) {
            html += `<td>${userHistAvg[ch].toFixed(2)}s</td>`;
          }
          html += "</tr>";
        });
      html += "</tbody></table></div>";
      // render summary
      resultsDiv.innerHTML = html;
      // persist test results to Supabase if logged in
      if (session && session.user) {
        try {
          const { error: insertErr } = await window.supabaseClient
            .from("progress")
            .insert([
              {
                user_id: session.user.id,
                level_id: selectedId,
                time_sec: elapsedSec,
                replays: replayCount,
                mistakes: mistakesMap,
                times: avgTimes,
              },
            ]);
          if (insertErr) console.error("Supabase insert error:", insertErr);
        } catch (e) {
          console.error("Error persisting results:", e);
        }
      }
      // show summary action hints
      actionHints.textContent = "Tab: Repeat Lesson, Enter: Next Lesson";
      document.addEventListener("keydown", handleSummaryKeydown);
    })();
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
      const duration = symbol === "." ? unit : unit * 3;
      const osc = audioContext.createOscillator();
      osc.frequency.value = 600;
      osc.type = "sine";
      osc.connect(gainNode); // Connect to gain node instead of destination
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
  // play a gentle tone for incorrect answers
  function playErrorSound() {
    return new Promise((resolve) => {
      if (!audioContext) return resolve();
      const duration = 150; // error beep duration in ms
      const osc = audioContext.createOscillator();
      osc.frequency.value = 300;
      osc.type = "sine";
      osc.connect(gainNode); // Connect to gain node instead of destination
      osc.start();
      setTimeout(() => {
        osc.stop();
        resolve();
      }, duration);
    });
  }
})();
