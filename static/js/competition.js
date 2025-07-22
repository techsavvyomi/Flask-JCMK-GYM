// competition.js — Revised for live energy, 2-cycle minimum, single start/stop, timed stop

// DOM Elements
const cyclesContainer = document.getElementById('cyclesContainer');
const registerPopup   = document.getElementById('registerPopup');
const closeBtn        = document.querySelector('.close-btn');
const saveUserBtn     = document.getElementById('saveUser');
const userNameInput   = document.getElementById('userName');
const startBtnBottom  = document.getElementById('startCompetition');
const startBtnTop     = document.getElementById('startRaceTop');
const durationInput   = document.getElementById('raceDuration');
const countdownEl     = document.getElementById('countdown');

// State
let users = [];
let activeCycleSelect;
let raceInProgress = false;
let raceInterval;
let raceTimeout;

// Map cycleId => {selected: bool}
const raceData = new Map();

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  loadUsers();
  createCycleCards();
  setupEventListeners();
  updateStartButtons();
});

// Load and save user list
function loadUsers() {
  const raw = localStorage.getItem('racingUsers');
  users = raw ? JSON.parse(raw) : [];
}
function saveUsers() {
  localStorage.setItem('racingUsers', JSON.stringify(users));
}

// Create cycle cards dynamically
function createCycleCards() {
  cyclesContainer.innerHTML = '';
  for (let i = 1; i <= 8; i++) {
    const card = document.createElement('div');
    card.className = 'cycle-card';
    card.dataset.cycleId = i;
    card.innerHTML = `
      <div class="cycle-avatar">C${i}</div>
      <div class="cycle-name">Cycle ${i}</div>
      <div class="cycle-race-info" style="display:none;">
        <span class="energy-generated">0 Wh</span>
      </div>
      <div class="cycle-controls">
        <select class="cycle-user-select">
          <option value="">Select User</option>
          <option value="register">Register New User</option>
        </select>
      </div>
    `;
    cyclesContainer.appendChild(card);
    raceData.set(String(i), { selected: false });
  }
  updateUserDropdowns();
}

// Populate and refresh user dropdowns
function updateUserDropdowns() {
  document.querySelectorAll('.cycle-user-select').forEach(select => {
    const card = select.closest('.cycle-card');
    const cid = card.dataset.cycleId;
    const prev = select.value;
    // remove old options
    while (select.options.length > 2) select.remove(2);
    // add users
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      // disable if user already selected on another cycle
      const inUse = Array.from(raceData.entries())
        .some(([key, d]) => d.selected && key !== cid && getUserId(key) === u.id);
      if (inUse) { opt.disabled = true; opt.textContent += ' (in use)'; }
      select.appendChild(opt);
    });
    select.value = prev;
    select.onchange = onUserChange;
    updateCardStyle(select);
  });
  updateStartButtons();
}
function getUserId(cycleId) {
  const card = document.querySelector(`.cycle-card[data-cycle-id=\"${cycleId}\"]`);
  return card.querySelector('.cycle-user-select').value;
}

// Handle dropdown change
function onUserChange(e) {
  const select = e.target;
  const card = select.closest('.cycle-card');
  const cid = card.dataset.cycleId;
  if (select.value === 'register') {
    activeCycleSelect = select;
    registerPopup.style.display = 'flex';
    select.value = '';
    return;
  }
  raceData.get(cid).selected = !!select.value;
  updateCardStyle(select);
  updateStartButtons();
}

// Style the card based on selection
function updateCardStyle(select) {
  const card = select.closest('.cycle-card');
  const nameDiv = card.querySelector('.cycle-name');
  if (select.value) {
    const user = users.find(u => u.id === select.value);
    nameDiv.textContent = `${user.name}'s Cycle`;
    card.classList.add('selected');
  } else {
    nameDiv.textContent = `Cycle ${card.dataset.cycleId}`;
    card.classList.remove('selected');
  }
}

// Enable or disable start buttons
function updateStartButtons() {
  const count = Array.from(raceData.values()).filter(d => d.selected).length;
  const canStart = count >= 2 && !raceInProgress;
  startBtnBottom.disabled = !canStart;
  startBtnTop.disabled    = !canStart;
  const status = document.getElementById('raceStatus');
  if (status) {
    status.textContent = count < 2
      ? `Select at least 2 cycles (selected ${count})`
      : raceInProgress
        ? 'Race in progress'
        : `Ready to start with ${count} cycles`;
  }
}

// Set up button and modal listeners
function setupEventListeners() {
  closeBtn?.addEventListener('click', () => registerPopup.style.display = 'none');
  saveUserBtn?.addEventListener('click', saveUser);
  userNameInput?.addEventListener('keypress', e => { if (e.key === 'Enter') saveUser(); });
  startBtnBottom?.addEventListener('click', toggleRace);
  startBtnTop?.addEventListener('click', toggleRace);
}

// Register a new user
function saveUser() {
  const name = userNameInput.value.trim();
  if (!name) return showNotification('Enter a name');
  if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) return showNotification('Already exists');
  const u = { id: `user_${Date.now()}`, name };
  users.push(u); saveUsers();
  registerPopup.style.display = 'none'; userNameInput.value = '';
  updateUserDropdowns(); showNotification('User added');
  if (activeCycleSelect) { activeCycleSelect.value = u.id; activeCycleSelect = null; updateUserDropdowns(); }
}

// Start or stop the race
function toggleRace() {
  raceInProgress ? stopCompetition() : startCompetition();
}

// Begin countdown then race
function startCompetition() {
  const count = Array.from(raceData.values()).filter(d => d.selected).length;
  if (count < 2) return showNotification('Need at least 2 cycles');
  let mins = parseInt(durationInput.value) || 5;
  mins = Math.max(1, Math.min(60, mins)); durationInput.value = mins;
  runCountdown(3, () => beginRace(mins * 60000));
  raceInProgress = true; updateStartButtons();
}

// Display countdown
function runCountdown(sec, onGo) {
  let c = sec;
  const num = countdownEl.querySelector('.countdown-number');
  const msg = countdownEl.querySelector('.countdown-msg');
  countdownEl.style.display = 'flex'; num.textContent = c; msg.textContent = 'Get Ready!';
  const iv = setInterval(() => {
    c--;
    if (c > 0) num.textContent = c;
    else if (c === 0) { num.textContent = 'GO!'; msg.textContent = 'Race Started!'; }
    else { clearInterval(iv); setTimeout(() => countdownEl.style.display = 'none', 500); onGo(); }
  }, 1000);
}

// Start race interval and auto-stop
function beginRace(durationMs) {
  startBtnBottom.innerHTML = '<i class="fas fa-stop"></i> Stop Race';
  startBtnTop.innerHTML    = '<i class="fas fa-stop"></i> Stop Race';
  raceInterval = setInterval(pollLiveEnergy, 1000);
  raceTimeout  = setTimeout(stopCompetition, durationMs);
}

// Stop the race and reset
function stopCompetition() {
  clearInterval(raceInterval);
  clearTimeout(raceTimeout);
  raceInProgress = false;
  // hide energy and clear selections
  raceData.forEach((d, cid) => {
    if (d.selected) {
      const card = document.querySelector(`.cycle-card[data-cycle-id=\\"${cid}\\"]`);
      card.querySelector('.cycle-race-info').style.display = 'none';
      d.selected = false;
      card.querySelector('.cycle-user-select').value = '';
      updateCardStyle(card.querySelector('.cycle-user-select'));
    }
  });
  startBtnBottom.textContent = 'Start Competition';
  startBtnTop.innerHTML    = '<i class="fas fa-flag-checkered"></i> Start Race';
  updateUserDropdowns(); updateStartButtons();
  showNotification('Race stopped');
}

// Fetch live energy only during race
function pollLiveEnergy() {
  if (!raceInProgress) return;
  fetch('/api/live_energy')
    .then(res => res.json())
    .then(data => {
        console.log('📡 Live Energy Data:', data);
      Object.entries(data).forEach(([cid, info]) => {
        const card = document.querySelector(`.cycle-card[data-cycle-id=\\"${cid}\\"]`);
        const el   = card.querySelector('.energy-generated');
        const val  = typeof info.energy === 'number' ? info.energy : parseFloat(info.energy) || 0;
        card.querySelector('.cycle-race-info').style.display = 'flex';
        el.textContent = `${val.toFixed(3)} Wh`;
      });
    })
    .catch(() => {});
}

// Simple notification
function showNotification(msg) {
  const n = document.createElement('div');
  n.className = 'notification';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('show'), 10);
  setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2500);
}
// Handle clicks outside popup to close
window.addEventListener('click', e => {

    if (e.target === registerPopup) {
        registerPopup.style.display = 'none';
    }
    }
);
