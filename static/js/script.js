// script.js (fixed: defined updateRaceStats and verified API route existence)

// DOM Elements
const cyclesContainer = document.getElementById('cyclesContainer');
const registerPopup = document.getElementById('registerPopup');
const closeBtn = document.querySelector('.close-btn');
const saveUserBtn = document.getElementById('saveUser');
const userNameInput = document.getElementById('userName');


let users = [];
let activeCycleSelect = null;

const raceStates = new Map();

window.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    createCycleCards();
    setupEventListeners();
});

function loadUsers() {
    const saved = localStorage.getItem('racingUsers');
    users = saved ? JSON.parse(saved) : [];
}

function saveUsers() {
    localStorage.setItem('racingUsers', JSON.stringify(users));
}

function isUserAlreadyRacing(userId) {
    let alreadyActive = false;
    document.querySelectorAll('.cycle-card').forEach(card => {
        const select = card.querySelector('.cycle-user-select');
        const stopBtn = card.querySelector('.stop-btn');
        if (select.value === userId && stopBtn.style.display === 'block') {
            alreadyActive = true;
        }
    });
    return alreadyActive;
}

function startRace(select) {
    const card = select.closest('.cycle-card');
    const cycleId = card.dataset.cycleId;
    const userId = select.value;
    const user = users.find(u => u.id === userId);
    if (!user) return;

    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.name, cycle: cycleId, mode: 'normal' })
    }).catch(() => {
        console.warn("API endpoint /api/register not found. Make sure Flask route exists.");
    });

    const startBtn = card.querySelector('.start-btn');
    const stopBtn = card.querySelector('.stop-btn');
    const raceInfo = card.querySelector('.cycle-race-info');
    const userSelect = card.querySelector('.cycle-user-select');

    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    raceInfo.style.display = 'block';
    userSelect.disabled = true;

    const startTime = Date.now();
    const raceState = { startTime, energy: 0, lastUpdate: startTime };
    raceState.intervalId = setInterval(() => updateRaceStats(card, raceState), 1000);

    raceStates.set(cycleId, raceState);
    updateRaceStats(card, raceState);
    showNotification(`${user.name}'s cycle is registered`);
}

function handleLogAccess(e) {
    e.preventDefault();
    document.getElementById('passwordModal').style.display = 'flex';
    }

    function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    }

    function verifyPassword() {
    const password = document.getElementById('logPassword').value;
    if (password === '1234') {
        window.location.href = "/normal-log";
    } else {
        showNotification("Incorrect password!");
        document.getElementById('logPassword').value = '';
    }
}
function openCompetitionModal() {
    document.getElementById('competitionModal').style.display = 'flex';
    }

    function closeCompetitionModal() {
    document.getElementById('competitionModal').style.display = 'none';
    }

    function confirmCompetitionMode() {
    // Stop all races first (if needed)
    document.querySelectorAll('.cycle-card .stop-btn').forEach(btn => {
        if (btn.style.display === 'block') {
        btn.click();  // Gracefully triggers stopRace logic
        }
    });

    // Redirect to competition mode
    window.location.href = "/competition";
}

function createCycleCards() {
    cyclesContainer.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const card = document.createElement('div');
        card.className = 'cycle-card';
        card.dataset.cycleId = i;
        card.innerHTML = `
            <div class="cycle-avatar">C${i}</div>
            <div class="cycle-name">Cycle ${i}</div>
            <div class="cycle-race-info" style="display: none;">
                <div class="race-duration">00:00</div>
                <div class="energy-generated">0 Wh</div>
            </div>
            <div class="cycle-controls">
                <select class="cycle-user-select choices-select" data-placeholder="Select User">
                    <option value="">Select User</option>
                    <option value="register">Register New User</option>
                </select>
                <button class="start-btn" style="display: none;">Start</button>
                <button class="stop-btn" style="display: none;">Stop</button>
            </div>
        `;
        const select = card.querySelector('select');
        select.addEventListener('change', handleUserSelect);
        cyclesContainer.appendChild(card);
    }
    updateUserDropdowns();
}

function updateUserDropdowns() {
    document.querySelectorAll('.cycle-user-select').forEach(select => {
        const current = select.value;

        // Destroy existing Choices instance if exists
        if (select.choicesInstance) {
            select.choicesInstance.destroy();
        }

        // Remove all options except first two
        while (select.options.length > 2) {
            select.remove(2);
        }

        // Re-add updated user list
        users.forEach(user => {
            const opt = document.createElement('option');
            opt.value = user.id;
            opt.textContent = user.name;
            select.add(opt);
        });

        // Restore selection
        select.value = current;
        updateCardStyle(select);

        // Logic to toggle Start button visibility
        if (current && current !== 'register' && users.find(u => u.id === current)) {
            const card = select.closest('.cycle-card');
            const startBtn = card.querySelector('.start-btn');

            if (!isUserAlreadyRacing(current)) {
                startBtn.style.display = 'block';
                startBtn.onclick = () => startRace(select);
            } else {
                startBtn.style.display = 'none';
                startBtn.onclick = null;
            }
        }

        // Re-apply Choices.js instance
        const choices = new Choices(select, {
            shouldSort: false,
            searchEnabled: true,
            placeholder: true,
            itemSelectText: '',
        });
        select.choicesInstance = choices;
    });
}



function handleUserSelect(e) {
    const select = e.target;
    const card = select.closest('.cycle-card');

    if (select.value === 'register') {
        activeCycleSelect = select;
        registerPopup.style.display = 'flex';
        select.value = '';
        return;
    }

    if (isUserAlreadyRacing(select.value)) {
        showNotification("This user is already racing on another bicycle.");
        select.value = '';
        updateCardStyle(select);
        return;
    }

    updateCardStyle(select);
    if (select.value && select.value !== 'register') {
        const startBtn = card.querySelector('.start-btn');
        if (!isUserAlreadyRacing(select.value)) {
            startBtn.style.display = 'block';
            startBtn.onclick = () => startRace(select);
        } else {
            startBtn.style.display = 'none';
            startBtn.onclick = null;
        }
    }
}

function setupEventListeners() {
    if (closeBtn) closeBtn.addEventListener('click', () => registerPopup.style.display = 'none');
    if (saveUserBtn) saveUserBtn.addEventListener('click', saveUser);
    if (userNameInput) userNameInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') saveUser();
    });
    window.addEventListener('click', e => {
        if (e.target === registerPopup) registerPopup.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('stop-btn')) {
            const card = e.target.closest('.cycle-card');
            stopRace(card.dataset.cycleId);
        }
    });
}

function stopRace(cycleId) {
    const card = document.querySelector(`.cycle-card[data-cycle-id="${cycleId}"]`);
    if (!card) return;
    const raceState = raceStates.get(cycleId);
    if (raceState) {
        clearInterval(raceState.intervalId);
        raceStates.delete(cycleId);
    }

    const user = card.querySelector('.cycle-name').textContent.split("'s")[0];
    const energy = parseFloat(card.querySelector('.energy-generated').textContent);
    const duration = card.querySelector('.race-duration').textContent;

    fetch('/api/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user, cycle: cycleId, energy, duration })
    });

    // Reset UI
    card.querySelector('.start-btn').style.display = 'none';
    card.querySelector('.stop-btn').style.display = 'none';
    card.querySelector('.cycle-race-info').style.display = 'none';

    const select = card.querySelector('.cycle-user-select');
    select.disabled = false;

    // Reset dropdown to default and card name
    if (select.choicesInstance) {
        select.choicesInstance.setChoiceByValue('');
    }
    select.value = '';
    card.querySelector('.cycle-name').textContent = `Cycle ${cycleId}`;
    card.classList.remove('selected');

    showNotification(`Race stopped!`);
}

function updateCardStyle(select) {
    const card = select.closest('.cycle-card');
    const userId = select.value;
    const user = users.find(u => u.id === userId);
    if (user) {
        card.classList.add('selected');
        card.querySelector('.cycle-name').textContent = `${user.name}'s Cycle`;
    } else {
        card.classList.remove('selected');
        card.querySelector('.cycle-name').textContent = `Cycle ${card.dataset.cycleId}`;
    }
}

function updateRaceStats(card, raceState) {
    const now = Date.now();
    const elapsed = Math.floor((now - raceState.startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    card.querySelector('.race-duration').textContent = `${mins}:${secs}`;
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

function saveUser() {
    const name = userNameInput.value.trim();
    if (!name) return;

    const duplicate = users.some(user => user.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
        showNotification(`User "${name}" already exists!`);
        return;
    }

    const newUser = { id: 'user_' + Date.now(), name };
    users.push(newUser);
    saveUsers();

    if (activeCycleSelect) {
        const choices = activeCycleSelect.choicesInstance;

        if (choices) {
            choices.setChoices([
                { value: '', label: 'Select User', disabled: true },
                { value: 'register', label: 'Register New User' },
                ...users.map(u => ({ value: u.id, label: u.name }))
            ], 'value', 'label', true);

            choices.setChoiceByValue(newUser.id);
        }

        activeCycleSelect.value = newUser.id;
        const event = new Event('change', { bubbles: true });
        activeCycleSelect.dispatchEvent(event);
        activeCycleSelect = null;
    }

    registerPopup.style.display = 'none';
    userNameInput.value = '';
    showNotification(`User "${name}" registered successfully!`);
}


function pollLiveEnergy() {
    fetch('/api/live_energy')
        .then(res => res.json())
        .then(data => {
            Object.entries(data).forEach(([cycleId, info]) => {
                const card = document.querySelector(`.cycle-card[data-cycle-id="${cycleId}"]`);
                if (card) {
                    const energyEl = card.querySelector('.energy-generated');
                    if (energyEl) {
                        energyEl.textContent = `${info.energy.toFixed(1)} Wh`;
                    }
                }
            });
        });
}
setInterval(pollLiveEnergy, 1000); 
