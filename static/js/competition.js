// DOM elements
const cyclesContainer    = document.getElementById('cyclesContainer');
const registerPopup      = document.getElementById('registerPopup');
const closeBtn           = document.querySelector('.close-btn');
const saveUserBtn        = document.getElementById('saveUser');
const userNameInput      = document.getElementById('userName');
const bottomStartBtn     = document.getElementById('startCompetition');
const topStartBtn        = document.getElementById('startRaceTop');

// State
let users                 = [];
let activeCycleSelect     = null;
const raceStates          = new Map();
let globalRaceInProgress  = false;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  createCycleCards();
  setupEventListeners();
  setInterval(pollLiveEnergy, 1000);
});

// --- User storage ---
function loadUsers() {
  const saved = localStorage.getItem('racingUsers');
  users = saved ? JSON.parse(saved) : [
    { id: 'user1', name: 'John Doe' },
    { id: 'user2', name: 'Jane Smith' },
    { id: 'user3', name: 'Mike Johnson' }
  ];
}

function saveUsers() {
  localStorage.setItem('racingUsers', JSON.stringify(users));
}

// --- Card creation ---
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
        <select class="cycle-user-select">
          <option value="">Select User</option>
          <option value="register">Register New User</option>
        </select>
        <button class="stop-btn" style="display:none;">Stop</button>
      </div>
    `;
    const select  = card.querySelector('.cycle-user-select');
    const stopBtn = card.querySelector('.stop-btn');
    select.addEventListener('change', handleUserSelect);
    stopBtn.addEventListener('click', () => stopCycle(card));
    cyclesContainer.appendChild(card);
  }
  updateUserDropdowns();
}

// --- Dropdown population ---
function updateUserDropdowns() {
  document.querySelectorAll('.cycle-user-select').forEach(select => {
    const prev = select.value;
    while (select.options.length > 2) select.remove(2);
    users.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.text  = user.name;
      const inUse = [...raceStates.keys()].some(cId => {
        const card = document.querySelector(`.cycle-card[data-cycle-id="${cId}"]`);
        return card.querySelector('.cycle-user-select').value === user.id;
      });
      if (inUse) {
        opt.disabled = true;
        opt.text += ' (in use)';
      }
      select.add(opt);
    });
    select.value = prev;
    updateCardStyle(select);
  });
}

// --- User selection ---
function handleUserSelect(e) {
  const select = e.target;
  const card   = select.closest('.cycle-card');
 if (select.value === 'register') {
    activeCycleSelect = select;
    registerPopup.style.display = 'flex';
    select.value = '';
    return;
  }
  const duplicate = [...document.querySelectorAll('.cycle-user-select')]
    .filter(s => s !== select)
    .some(s => s.value === select.value);
  if (duplicate) {
    showNotification('User already assigned');
    select.value = '';
  }
  updateCardStyle(select);
}

// --- Global start/stop with countdown ---
function toggleGlobalRace() {
  if (!globalRaceInProgress) {
    // Countdown 3...2...1...GO!
    const countdownEl = document.getElementById('countdown');
    const numEl       = countdownEl.querySelector('.countdown-number');
    const msgEl       = countdownEl.querySelector('.countdown-msg');
    let count = 3;
    numEl.textContent = count;
    msgEl.textContent = 'Get Ready!';
    countdownEl.style.display = 'flex';

    const cdInterval = setInterval(() => {
      count--;
      if (count > 0) {
        numEl.textContent = count;
        numEl.classList.add('animate');
        setTimeout(() => numEl.classList.remove('animate'), 500);
      } else {
        numEl.textContent = 'GO!';
        msgEl.textContent = 'Race Started!';
        countdownEl.classList.add('animate');
      }
      if (count < 0) {
        clearInterval(cdInterval);
        setTimeout(() => {
          countdownEl.style.display = 'none';
          // actually start all cycles
          document.querySelectorAll('.cycle-card').forEach(card => {
            const sel = card.querySelector('.cycle-user-select');
            if (sel.value) startCycle(card);
          });
          globalRaceInProgress = true;
          bottomStartBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Race';
          topStartBtn.innerHTML    = '<i class="fas fa-stop"></i> Stop Race';
        }, 1000);
      }
    }, 1000);
  } else {
    // stop all
    stopAllCycles();
    globalRaceInProgress = false;
    bottomStartBtn.textContent = 'Start Competition';
    topStartBtn.innerHTML     = '<i class="fas fa-flag-checkered"></i> Start Race';
  }
}

function stopAllCycles() {
  Array.from(raceStates.keys()).forEach(cId => {
    const card = document.querySelector(`.cycle-card[data-cycle-id="${cId}"]`);
    stopCycle(card);
  });
}

// --- Start/Stop logic per cycle ---
function startCycle(card) {
  const select = card.querySelector('.cycle-user-select');
  select.disabled = true;
  card.querySelector('.stop-btn').style.display = 'inline-block';
  card.querySelector('.cycle-race-info').style.display = 'flex';
  const state = { startTime: Date.now(), intervalId: null };
  function tick() {
    const s   = Math.floor((Date.now() - state.startTime) / 1000);
    const m   = String(Math.floor(s/60)).padStart(2,'0');
    const ss  = String(s%60).padStart(2,'0');
    card.querySelector('.race-duration').textContent = `${m}:${ss}`;
  }
  tick();
  state.intervalId = setInterval(tick, 1000);
  raceStates.set(card.dataset.cycleId, state);
  showNotification(`Started cycle ${card.dataset.cycleId}`);
  updateUserDropdowns();
}

function stopCycle(card) {
  if (typeof card === 'string') {
    card = document.querySelector(`.cycle-card[data-cycle-id="${card}"]`);
  }

  const id     = card.dataset.cycleId;
  const state  = raceStates.get(id);
  if (!state) return;

  clearInterval(state.intervalId);
  raceStates.delete(id);

  // Get session duration (in seconds)
  const durationSec = Math.floor((Date.now() - state.startTime) / 1000);
  const durationStr = `${String(Math.floor(durationSec / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`;

  // Get user and energy
  const select = card.querySelector('.cycle-user-select');
  const userId = select.value;
  const energyText = card.querySelector('.energy-generated').textContent;
  const energy = parseFloat(energyText.replace('Wh', '').trim()) || 0;

  // Reset UI
  select.disabled = false;
  card.querySelector('.stop-btn').style.display = 'none';
  card.querySelector('.cycle-race-info').style.display = 'none';
  select.value = ''; // Reset to "Select User"
  updateUserDropdowns();
  updateCardStyle(select);

  showNotification(`Stopped cycle ${id}`);

  // Save to CSV if race was running
  if (userId && durationSec > 0 && energy > 0) {
    saveSessionToCSV(id, userId, durationStr, energy);
  }
}

function saveSessionToCSV(cycleId, userId, duration, energy) {
  const user = users.find(u => u.id === userId);
  if (!user) return;

  fetch('/api/save_competition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: user.name,
      user_id: userId,
      duration: duration,
      cycle: cycleId,
      energy: energy,
      timestamp: new Date().toISOString()
    })
  }).then(res => res.json())
    .then(data => console.log('✅ Saved:', data))
    .catch(err => console.error('❌ Save failed:', err));
}

// --- Live energy polling ---
function pollLiveEnergy() {
  fetch('/api/live_energy')
    .then(res => res.json())
    .then(data => {
      Object.entries(data).forEach(([cid, info]) => {
        const card = document.querySelector(`.cycle-card[data-cycle-id="${cid}"]`);
        if (card) {
          card.querySelector('.energy-generated').textContent = `${info.energy.toFixed(1)} Wh`;
        }
      });
    });
}

// --- Register & global button listeners ---
function setupEventListeners() {
  if (closeBtn)      closeBtn.addEventListener('click', () => registerPopup.style.display = 'none');
  if (saveUserBtn)   saveUserBtn.addEventListener('click', saveUser);
  if (userNameInput) userNameInput.addEventListener('keypress', e => { if (e.key==='Enter') saveUser(); });
  if (bottomStartBtn) bottomStartBtn.addEventListener('click', toggleGlobalRace);
  if (topStartBtn)    topStartBtn.addEventListener('click', toggleGlobalRace);
}

// --- User registration ---
function saveUser() {
  const name = userNameInput.value.trim();
  if (!name) return showNotification('Enter a name');

  // Prevent duplicate names
  if (users.some(u => u.name.toLowerCase() === name.toLowerCase()))
    return showNotification('Already exists');

  const user = { id: 'user_' + Date.now(), name };
  users.push(user);
  saveUsers();
  updateUserDropdowns();

  if (activeCycleSelect) {
    activeCycleSelect.value = '';  // Reset dropdown to "Select User"
    const event = new Event('change', { bubbles: true });
    activeCycleSelect.dispatchEvent(event);
    activeCycleSelect = null;
  }

  registerPopup.style.display = 'none';
  userNameInput.value = '';
  showNotification('User added');
}


// --- Card style helper ---
function updateCardStyle(select) {
  const card   = select.closest('.cycle-card');
  const nameEl = card.querySelector('.cycle-name');
  const user   = users.find(u => u.id === select.value);
  if (user) {
    nameEl.textContent = `${user.name}'s Cycle`;
    card.classList.add('selected');
  } else {
    nameEl.textContent = `Cycle ${card.dataset.cycleId}`;
    card.classList.remove('selected');
  }
}

// --- Notifications ---
function showNotification(msg) {
  const n = document.createElement('div');
  n.className = 'notification';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('show'), 10);
  setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
}
