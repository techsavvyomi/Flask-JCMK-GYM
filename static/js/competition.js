// competition.js

// DOM Elements
const cyclesContainer = document.getElementById('cyclesContainer');
const registerPopup   = document.getElementById('registerPopup');
const closeBtn        = document.querySelector('.close-btn');
const saveUserBtn     = document.getElementById('saveUser');
const userNameInput   = document.getElementById('userName');
const topStartBtn     = document.getElementById('startRaceTop');
const globalTimerEl   = document.getElementById('globalTimer'); // <— NEW

let users             = [];
let activeCycleSelect = null;
const raceStates      = new Map();
let globalCountdownId = null;  // <— NEW
let remainingSec      = 0;     // <— NEW
// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  createCycleCards();
  setupEventListeners();
  setInterval(pollLiveEnergy, 1000);
});
function onRaceBtnClick() {
  const running = startBtn.dataset.running === '1';
  if (!running) {
    toggleGlobalRace();   // starts everything
  } else {
    toggleGlobalRace();   // same fn stops when already running
  }
}

// — User storage
function loadUsers() {
  const saved = localStorage.getItem('racingUsers');
  users = saved ? JSON.parse(saved) : [];
}
function saveUsers() {
  localStorage.setItem('racingUsers', JSON.stringify(users));
}

// — Helpers
function isUserAlreadyRacing(userId) {
  let active = false;
  document.querySelectorAll('.cycle-card').forEach(card => {
    const sel = card.querySelector('.cycle-user-select');
    const btn = card.querySelector('.stop-btn');
    if (sel.value === userId && btn.style.display === 'block') active = true;
  });
  return active;
}
function showNotification(msg) {
  const n = document.createElement('div');
  n.className = 'notification';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('show'), 10);
  setTimeout(() => {
    n.classList.remove('show');
    setTimeout(() => n.remove(), 300);
  }, 3000);
}

// — Race logic
function startRace(select) {
  const card    = select.closest('.cycle-card');
  const cycleId = card.dataset.cycleId;
  const userId  = select.value;
  const user    = users.find(u => u.id === userId);
  if (!user) return;

  // POST to server
  fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: user.name, cycle: cycleId, mode: 'competition' })
  }).catch(() => console.warn('register endpoint missing'));

  // UI changes
  const stopBtn    = card.querySelector('.stop-btn');
  const raceInfo   = card.querySelector('.cycle-race-info');
  const userSelect = card.querySelector('.cycle-user-select');

  stopBtn.style.display    = 'block';
  raceInfo.style.display   = 'block';
  userSelect.disabled      = true;

  const startTime = Date.now();
  const state     = { startTime, energy: 0, lastUpdate: startTime };
  state.intervalId = setInterval(() => updateRaceStats(card, state), 1000);

  raceStates.set(cycleId, state);
  updateRaceStats(card, state);
  showNotification(`${user.name}'s cycle started`);
}

function stopRace(cycleId) {
  const card = document.querySelector(`.cycle-card[data-cycle-id="${cycleId}"]`);
  if (!card) return;
  const state = raceStates.get(cycleId);
  if (state) {
    clearInterval(state.intervalId);
    raceStates.delete(cycleId);
  }

  // gather data
  const user     = card.querySelector('.cycle-name').textContent.split("'s")[0];
  const energy   = parseFloat(card.querySelector('.energy-generated').textContent);
  const duration = card.querySelector('.race-duration').textContent;

  fetch('/api/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: user, cycle: cycleId, energy, duration })
  });

  // reset UI
  const stopBtn    = card.querySelector('.stop-btn');
  const raceInfo   = card.querySelector('.cycle-race-info');
  const userSelect = card.querySelector('.cycle-user-select');

  stopBtn.style.display    = 'none';
  raceInfo.style.display   = 'inline-flex';
  userSelect.disabled      = false;
  userSelect.value         = '';
  card.querySelector('.cycle-name').textContent = `Cycle ${cycleId}`;
  card.classList.remove('selected');

  showNotification('Race stopped');
}

function updateRaceStats(card, state) {
  const now     = Date.now();
  const elapsed = Math.floor((now - state.startTime) / 1000);
  const mins    = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs    = String(elapsed % 60).padStart(2, '0');
  card.querySelector('.race-duration').textContent = `${mins}:${secs}`;
}

// — Live energy polling
function pollLiveEnergy() {
  fetch('/api/live_energy')
    .then(r => r.json())
    .then(data => {
      Object.entries(data).forEach(([cid, info]) => {
        const card = document.querySelector(`.cycle-card[data-cycle-id="${cid}"]`);
        if (!card) return;
        const el = card.querySelector('.energy-generated');
        if (el) el.textContent = `${info.energy.toFixed(3)} Wh`;
      });
    })
    .catch(console.error);
}

function confirmCompetitionMode() {
  // stop any running races first
  document.querySelectorAll('.cycle-card .stop-btn').forEach(btn => {
    if (btn.style.display === 'block') btn.click();
  });

  // start each selected user
  document.querySelectorAll('.cycle-card').forEach(card => {
    const sel = card.querySelector('.cycle-user-select');
    if (sel.value && sel.value !== 'register' && !isUserAlreadyRacing(sel.value)) {
      startRace(sel);
    }
  });

  // >>> START GLOBAL TIMER <<<
  const mins = parseInt(document.getElementById('raceDuration').value || '5', 10);
  startGlobalTimer(mins * 60);
}


// — UI setup
function createCycleCards() {
  cyclesContainer.innerHTML = '';
  for (let i = 1; i <= 8; i++) {
    const card = document.createElement('div');
    card.className       = 'cycle-card';
    card.dataset.cycleId = i;
    card.innerHTML = `
      <div class="cycle-avatar">C${i}</div>
      <div class="cycle-name">Cycle ${i}</div>
<div class="cycle-race-info" style="display:none;">
  <span class="race-duration">00:00</span>
  <span class="energy-generated">0 Wh</span>
</div>

      <div class="cycle-controls">
        <select class="cycle-user-select choices-select" data-placeholder="Select User">
          <option value="">Select User</option>
          <option value="register">Register New User</option>
        </select>
        <button class="stop-btn" style="display: none;">Stop</button>
      </div>
    `;
    card.querySelector('.cycle-user-select')
        .addEventListener('change', handleUserSelect);
    cyclesContainer.appendChild(card);
  }
  updateUserDropdowns();
}

function updateUserDropdowns() {
  document.querySelectorAll('.cycle-user-select').forEach(select => {
    const cur = select.value;
    if (select.choicesInstance) select.choicesInstance.destroy();

    // remove old opts
    while (select.options.length > 2) select.remove(2);

    // add users
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value   = u.id;
      opt.textContent = u.name;
      select.add(opt);
    });

    select.value = cur;
    updateCardStyle(select);

    // re-init Choices.js
    const chr = new Choices(select, {
      shouldSort: false,
      searchEnabled: true,
      placeholder: true,
      itemSelectText: '',
    });
    select.choicesInstance = chr;
  });
}

function handleUserSelect(e) {
  const select = e.target;
  if (select.value === 'register') {
    activeCycleSelect = select;
    registerPopup.style.display = 'flex';
    select.value = '';
    return;
  }
  if (isUserAlreadyRacing(select.value)) {
    showNotification('User already racing');
    select.value = '';
  }
  updateCardStyle(select);
}

function updateCardStyle(select) {
  const card = select.closest('.cycle-card');
  const u    = users.find(x => x.id === select.value);
  if (u) {
    card.classList.add('selected');
    card.querySelector('.cycle-name').textContent = `${u.name}'s Cycle`;
  } else {
    card.classList.remove('selected');
    card.querySelector('.cycle-name').textContent = `Cycle ${card.dataset.cycleId}`;
  }
}

// — Registration popup
function saveUser() {
  const name = userNameInput.value.trim();
  if (!name) return;
  if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
    return showNotification(`"${name}" exists`);
  }
  const newUser = { id: 'user_' + Date.now(), name };
  users.push(newUser);
  saveUsers();
  updateUserDropdowns();

  if (activeCycleSelect) {
    activeCycleSelect.choicesInstance.setChoiceByValue(newUser.id);
    activeCycleSelect.value = newUser.id;
    activeCycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    activeCycleSelect = null;
  }

  registerPopup.style.display = 'none';
  userNameInput.value = '';
  showNotification(`User "${name}" registered`);
}

// — Event binding
function setupEventListeners() {
  if (topStartBtn)   topStartBtn.addEventListener('click', confirmCompetitionMode);
  if (closeBtn)      closeBtn.addEventListener('click', () => registerPopup.style.display = 'none');
  if (saveUserBtn)   saveUserBtn.addEventListener('click', saveUser);
  if (userNameInput) userNameInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') saveUser();
  });

  document.addEventListener('click', e => {
    if (e.target.classList.contains('stop-btn')) {
      const c = e.target.closest('.cycle-card');
      stopRace(c.dataset.cycleId);
    }
  });
}


function startGlobalTimer(totalSec) {
  remainingSec = totalSec;
  renderGlobalTimer();
  globalTimerEl.style.display = 'inline';

  if (globalCountdownId) clearInterval(globalCountdownId);
  globalCountdownId = setInterval(() => {
    remainingSec--;
    renderGlobalTimer();
    if (remainingSec <= 0) {
      clearInterval(globalCountdownId);
      globalCountdownId = null;
      autoStopRace();
    }
  }, 1000);
}

function renderGlobalTimer() {
  const m = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const s = String(remainingSec % 60).padStart(2, '0');
  globalTimerEl.textContent = `${m}:${s}`;
}

function clearGlobalTimer() {
  if (globalCountdownId) clearInterval(globalCountdownId);
  globalCountdownId = null;
  globalTimerEl.style.display = 'none';
  globalTimerEl.textContent = '00:00';
}

function autoStopRace() {
  const ids = Array.from(raceStates.keys());
  ids.forEach(cid => stopRace(cid));
  clearGlobalTimer();
  showNotification('Race time over!');
}
