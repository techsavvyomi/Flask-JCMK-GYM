// DOM Elements
const cyclesContainer = document.getElementById('cyclesContainer');
const registerPopup = document.getElementById('registerPopup');
const closeBtn = document.querySelector('.close-btn');
const saveUserBtn = document.getElementById('saveUser');
const userNameInput = document.getElementById('userName');
const startCompetitionBtn = document.getElementById('startCompetition');
const countdownElement = document.getElementById('countdown');

// State
let users = [];
let activeCycleSelect = null;
let raceInProgress = false;
let raceInterval = null;
let raceStartTime = null;
const raceData = new Map();

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize stats display
    updateStatsDisplay();
    loadUsers();
    createCycleCards();
    setupEventListeners();
    updateStartButton();
    
    // Connect top start button
    const startRaceTopBtn = document.getElementById('startRaceTop');
    if (startRaceTopBtn) {
        startRaceTopBtn.addEventListener('click', () => {
            const startBtn = document.getElementById('startCompetition');
            if (startBtn && !startBtn.disabled) {
                startCompetition();
            }
        });
    }
});

// Load users from localStorage
function loadUsers() {
    const savedUsers = localStorage.getItem('racingUsers');
    users = savedUsers ? JSON.parse(savedUsers) : [
        { id: 'user1', name: 'John Doe' },
        { id: 'user2', name: 'Jane Smith' },
        { id: 'user3', name: 'Mike Johnson' }
    ];
}

// Create cycle cards
function createCycleCards() {
    if (!cyclesContainer) return;
    
    cyclesContainer.innerHTML = '';
    
    for (let i = 1; i <= 8; i++) {
        const batteryLevel = Math.floor(Math.random() * 30) + 70; // 70-100%
        const isLowBattery = batteryLevel < 80;
        
        const card = document.createElement('div');
        card.className = 'cycle-card';
        card.dataset.cycleId = i;
        
        card.innerHTML = `
            <div class="cycle-avatar">C${i}</div>
            <div class="cycle-name">Cycle ${i}</div>
            <div class="cycle-stats">
                <span class="dot ${isLowBattery ? 'red' : 'green'}"></span>
                <span class="battery-level">${batteryLevel}%</span>
            </div>
            <div class="cycle-race-info" style="display: none;">
                <div class="energy-generated">0 Wh</div>
            </div>
            <div class="cycle-controls">
                <select class="cycle-user-select">
                    <option value="">Select User</option>
                    <option value="register">Register New User</option>
                </select>
            </div>
        `;
        
        const select = card.querySelector('select');
        select.addEventListener('change', handleUserSelect);
        
        // Initialize race data for this cycle
        raceData.set(i.toString(), {
            energy: 0,
            lastUpdate: Date.now(),
            selected: false
        });
        
        cyclesContainer.appendChild(card);
    }
    
    updateUserDropdowns();
}

// Update user dropdowns with current users
function updateUserDropdowns() {
    const selects = document.querySelectorAll('.cycle-user-select');
    
    selects.forEach(select => {
        const currentValue = select.value;
        const isRegisterSelected = currentValue === 'register';
        
        // Keep the first two options (Select User and Register New User)
        while (select.options.length > 2) {
            select.remove(2);
        }
        
        // Add current users
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            select.add(option);
        });
        
        // Restore selection if it still exists
        if (currentValue && (currentValue === 'register' || users.some(u => u.id === currentValue))) {
            select.value = currentValue;
        } else if (isRegisterSelected) {
            select.value = 'register';
        } else {
            select.value = '';
        }
        
        updateCardStyle(select);
    });
    
    updateStartButton();
}

// Handle user selection
function handleUserSelect(e) {
    const select = e.target;
    const card = select.closest('.cycle-card');
    const cycleId = card.dataset.cycleId;
    
    if (users.some(user => user.id === select.value)) {
    // Check if already selected on another bike
    const isAlreadyAssigned = [...document.querySelectorAll('.cycle-user-select')]
        .some(s => s !== select && s.value === select.value);

    if (isAlreadyAssigned) {
        showNotification('This user is already assigned to another cycle.');
        select.value = '';
        raceData.get(cycleId).selected = false;
        updateCardStyle(select);
        updateStartButton();
        return;
    }
}

    
    // Update race data
    raceData.get(cycleId).selected = !!select.value;
    updateCardStyle(select);
    updateStartButton();
}

// Update the stats display (In Use and Available cycles)
function updateStatsDisplay() {
    const totalCycles = raceData.size;
    const inUseCycles = Array.from(raceData.values()).filter(race => {
        const select = document.querySelector(`.cycle-card[data-cycle-id="${race.cycleId}"] .cycle-user-select`);
        return select && select.value && select.value !== 'register';
    }).length;
    const availableCycles = totalCycles - inUseCycles;
    
    // Update the UI
    const totalEl = document.getElementById('totalCycles');
    const availableEl = document.getElementById('availableCycles');
    const inUseEl = document.getElementById('takenCycles');
    
    if (totalEl) totalEl.textContent = totalCycles;
    if (availableEl) availableEl.textContent = availableCycles;
    if (inUseEl) inUseEl.textContent = inUseCycles;
}

// Update card style based on selection
function updateCardStyle(select) {
    const card = select.closest('.cycle-card');
    const cycleId = card.dataset.cycleId;
    const selectedUserId = select.value;
    
    if (selectedUserId && selectedUserId !== 'register') {
        card.classList.add('selected');
        const user = users.find(u => u.id === selectedUserId);
        if (user) {
            card.querySelector('.cycle-name').textContent = `${user.name}'s Cycle`;
        }
    } else {
        card.classList.remove('selected');
        card.querySelector('.cycle-name').textContent = `Cycle ${cycleId}`;
    }
    
    // Update the stats display
    updateStatsDisplay();
}

// Update start button state and status message
function updateStartButton() {
    const startButton = document.getElementById('startCompetition');
    const startRaceTopBtn = document.getElementById('startRaceTop');
    const statusElement = document.getElementById('raceStatus');
    
    const selectedCycles = Array.from(raceData.values()).filter(race => race.selected).length;
    const totalCycles = raceData.size;
    const allCyclesSelected = selectedCycles === totalCycles && totalCycles > 0;
    
    // Update status message
    if (statusElement) {
        if (allCyclesSelected) {
            statusElement.textContent = 'All cycles selected. Ready to start the race!';
            statusElement.className = 'ready';
        } else if (selectedCycles > 0) {
            statusElement.textContent = `Selected ${selectedCycles} of ${totalCycles} cycles. Select all to start.`;
            statusElement.className = 'error';
        } else {
            statusElement.textContent = 'Select all cycles to start the race';
            statusElement.className = '';
        }
    }
    
    // Update buttons
    if (startButton) {
        startButton.disabled = !allCyclesSelected || raceInProgress;
    }
    
    if (startRaceTopBtn) {
        startRaceTopBtn.disabled = !allCyclesSelected || raceInProgress;
    }
}


function startCompetition() {
    if (raceInProgress) return;
    
    // Check if all cycles are selected
    const selectedCycles = Array.from(raceData.values()).filter(race => race.selected).length;
    const totalCycles = raceData.size;
    
    if (selectedCycles !== totalCycles || totalCycles === 0) {
        showNotification('Please select all cycles before starting the race');
        return;
    }
    
    // Get race duration from input (default to 5 minutes if invalid)
    const durationInput = document.getElementById('raceDuration');
    let durationMinutes = parseInt(durationInput.value) || 5;
    
    // Ensure duration is within allowed range (1-60 minutes)
    durationMinutes = Math.max(1, Math.min(60, durationMinutes));
    
    // Update input with validated value
    durationInput.value = durationMinutes;
    
    raceInProgress = true;
    updateStartButton();
    
    // Show countdown
    const countdownElement = document.getElementById('countdown');
    const countdownNumber = countdownElement.querySelector('.countdown-number');
    const countdownMsg = countdownElement.querySelector('.countdown-msg');
    
    let countdown = 3;
    countdownNumber.textContent = countdown;
    countdownMsg.textContent = 'Get Ready!';
    countdownElement.style.display = 'flex';
    
    const countdownInterval = setInterval(() => {
        countdown--;
        
        if (countdown > 0) {
            countdownNumber.textContent = countdown;
            countdownNumber.classList.add('animate');
            setTimeout(() => countdownNumber.classList.remove('animate'), 500);
        } else {
            countdownNumber.textContent = 'GO!';
            countdownMsg.textContent = 'Race Started!';
            countdownElement.classList.add('animate');
        }
        
        if (countdown < 0) {
            clearInterval(countdownInterval);
            setTimeout(() => {
                countdownElement.style.display = 'none';
                startRace(durationMinutes * 60 * 1000); // Convert minutes to milliseconds
            }, 1000);
        }
    }, 1000);
}

function startRace(durationMs) {
    raceStartTime = Date.now();
    const raceEndTime = raceStartTime + durationMs;

    // Update race data
    raceData.forEach((data, cycleId) => {
        if (data.selected) {
            data.energy = 0;
            data.lastUpdate = raceStartTime;
        }
    });

    const liveTimerEl = document.getElementById('liveTimer');
    const liveCountdownEl = document.getElementById('liveTimerCountdown');
    if (liveTimerEl) liveTimerEl.style.display = 'block';

    // ✅ START of updateLiveTimer function
    function updateLiveTimer() {
        const remaining = Math.max(0, raceEndTime - Date.now());
        const mins = String(Math.floor(remaining / 60000)).padStart(2, '0');
        const secs = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
        if (liveCountdownEl) {
            liveCountdownEl.textContent = `${mins}:${secs}`;
        }
    }  // ✅ <-- MISSING CLOSING BRACE #1
    // ✅ END of updateLiveTimer function

    // START of raceLoop
    function raceLoop() {
        updateLiveTimer();
        const now = Date.now();
        if (now >= raceEndTime) {
            clearInterval(raceInterval);
            raceInProgress = false;
            updateRaceStats();
            showNotification('Race finished!');
            document.querySelectorAll('.cycle-user-select').forEach(select => {
                select.disabled = false;
            });

            const startCompetitionBtn = document.getElementById('startCompetition');
            if (startCompetitionBtn) {
                startCompetitionBtn.textContent = 'Start Competition';
                startCompetitionBtn.onclick = startCompetition;
            }

            const startRaceTopBtn = document.getElementById('startRaceTop');
            if (startRaceTopBtn) {
                startRaceTopBtn.innerHTML = '<i class="fas fa-flag-checkered"></i> Start Race';
                startRaceTopBtn.onclick = () => startCompetition();
            }

            if (liveTimerEl) liveTimerEl.style.display = 'none';
        } else {
            updateRaceStats();
        }
    }  // ✅ <-- MISSING CLOSING BRACE #2
    // END of raceLoop

    if (raceInterval) clearInterval(raceInterval);
    raceInterval = setInterval(raceLoop, 100);

    const startCompetitionBtn = document.getElementById('startCompetition');
    if (startCompetitionBtn) {
        startCompetitionBtn.textContent = 'Stop Race';
        startCompetitionBtn.onclick = stopCompetition;
    }

    const startRaceTopBtn = document.getElementById('startRaceTop');
    if (startRaceTopBtn) {
        startRaceTopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Race';
        startRaceTopBtn.onclick = stopCompetition;
    }

    raceLoop(); // Initial call
}


// Stop the competition
function stopCompetition() {
    document.getElementById('liveTimer').style.display = 'none';

    // Clear the race interval
    if (raceInterval) {
        clearInterval(raceInterval);
        raceInterval = null;
    }
    
    // Update race state
    raceInProgress = false;
    raceStartTime = null;
    
    // Reset buttons
    const startCompetitionBtn = document.getElementById('startCompetition');
    if (startCompetitionBtn) {
        startCompetitionBtn.textContent = 'Start Competition';
        startCompetitionBtn.disabled = false;
        startCompetitionBtn.onclick = startCompetition;
    }
    
    // Update top race button
    const startRaceTopBtn = document.getElementById('startRaceTop');
    if (startRaceTopBtn) {
        startRaceTopBtn.innerHTML = '<i class="fas fa-flag-checkered"></i> Start Race';
        startRaceTopBtn.onclick = () => startCompetition();
    }
    
    // Re-enable user selects
    document.querySelectorAll('.cycle-user-select').forEach(select => {
        if (!select.value) {  // Only re-enable if no user is selected
            select.disabled = false;
        }
    });
    
    // Reset race data for selected cycles
    raceData.forEach((data, cycleId) => {
    data.selected = false;
    data.energy = 0;
    data.lastUpdate = null;

    const card = document.querySelector(`.cycle-card[data-cycle-id="${cycleId}"]`);
    if (card) {
        card.classList.remove('selected');
        const energyEl = card.querySelector('.energy-generated');
        const nameEl = card.querySelector('.cycle-name');
        const select = card.querySelector('.cycle-user-select');

        if (energyEl) energyEl.textContent = '0 Wh';
        if (nameEl) nameEl.textContent = `Cycle ${cycleId}`;
        if (select) {
            select.value = '';
            select.disabled = false;
        }
    }
    });
    updateUserDropdowns();

    // Reset    
    // Update UI
    updateStartButton();
    showNotification('Race stopped by user');
}

// Update race statistics (energy)
function updateRaceStats() {
    const now = Date.now();
    
    document.querySelectorAll('.cycle-card').forEach(card => {
        const cycleId = card.dataset.cycleId;
        const raceInfo = raceData.get(cycleId);
        
        if (raceInfo.selected) {
            // Update energy (simulated based on time)
            const timeDiff = (now - raceInfo.lastUpdate) / 1000; // in seconds
            fetch('/api/live_energy')
            .then(res => res.json())
            .then(data => {
                Object.entries(data).forEach(([cycleId, info]) => {
                    const card = document.querySelector(`.cycle-card[data-cycle-id="${cycleId}"]`);
                    if (card && raceData.get(cycleId).selected) {
                        raceData.get(cycleId).energy = info.energy;
                        const energyEl = card.querySelector('.energy-generated');
                        if (energyEl) {
                            energyEl.textContent = `${info.energy.toFixed(1)} Wh`;
                        }
                    }
                });
            });
            setInterval(() => {
            if (raceInProgress) updateRaceStats(); // include fetch logic
        }, 1000);

            raceInfo.lastUpdate = now;
            
            // Update UI
            const energyEl = card.querySelector('.energy-generated');
            if (energyEl) {
                energyEl.textContent = `${raceInfo.energy.toFixed(1)} Wh`;
            }
        }
    });
}

function setupEventListeners() {
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            registerPopup.style.display = 'none';
        });
    }
    
    if (registerPopup) {
        registerPopup.addEventListener('click', (e) => {
            if (e.target === registerPopup) {
                registerPopup.style.display = 'none';
            }
        });
    }
    
    if (saveUserBtn) {
        saveUserBtn.addEventListener('click', saveUser);
    }
    
    if (userNameInput) {
        userNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveUser();
            }
        });
    }
    

    if (startCompetitionBtn) {
        startCompetitionBtn.addEventListener('click', startCompetition);
    }
}

// Save new user
function saveUser() {
    const name = userNameInput.value.trim();
    
    if (!name) {
        showNotification('Please enter a name');
        return;
    }
    
    const newUser = {
        id: 'user' + Date.now(),
        name: name
    };
    
    users.push(newUser);
    saveUsers();
    
    // Update dropdowns
    updateUserDropdowns();
    
    // Select the new user if we were registering
    if (activeCycleSelect) {
        activeCycleSelect.value = newUser.id;
        updateCardStyle(activeCycleSelect);
        raceData.get(activeCycleSelect.closest('.cycle-card').dataset.cycleId).selected = true;
        activeCycleSelect = null;
    }
    
    // Close popup and reset
    registerPopup.style.display = 'none';
    userNameInput.value = '';
    
    showNotification('User registered successfully!');
    updateStartButton();
}

// Save users to localStorage
function saveUsers() {
    localStorage.setItem('racingUsers', JSON.stringify(users));
}

// Show notification
function showNotification(message) {
    // You can implement a proper notification system here
    console.log('Notification:', message);
    alert(message);
}