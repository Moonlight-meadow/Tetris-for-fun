// Global Leaderboard System using Persistent Storage
// This allows all players to see and compete on the same leaderboard!

const MAX_LEADERBOARD_ENTRIES = 10;
const LEADERBOARD_KEY = 'tetris-global-leaderboard';

// Load global leaderboard
async function loadLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    try {
        leaderboardDiv.innerHTML = '<div class="leaderboard-item loading">Loading global leaderboard...</div>';
        
        // Get shared leaderboard data
        const result = await window.storage.get(LEADERBOARD_KEY, true);
        
        let leaderboard = [];
        if (result && result.value) {
            leaderboard = JSON.parse(result.value);
        }
        
        displayLeaderboard(leaderboard);
    } catch (error) {
        console.log('Loading leaderboard...', error);
        // If key doesn't exist yet, show empty leaderboard
        displayLeaderboard([]);
    }
}

// Display leaderboard
function displayLeaderboard(leaderboard) {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    if (!leaderboard || leaderboard.length === 0) {
        leaderboardDiv.innerHTML = `
            <div class="leaderboard-item empty">
                No scores yet. Be the first to make the leaderboard!
            </div>
        `;
        return;
    }
    
    leaderboardDiv.innerHTML = leaderboard.map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const date = new Date(entry.timestamp).toLocaleDateString();
        
        return `
            <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}">
                <span class="rank">${medal}</span>
                <span class="player-name">${entry.name}</span>
                <span class="player-score">${entry.score}</span>
                <span class="player-date">${date}</span>
            </div>
        `;
    }).join('');
}

// Check if score qualifies for leaderboard
async function checkLeaderboardQualification(score) {
    try {
        const result = await window.storage.get(LEADERBOARD_KEY, true);
        let leaderboard = [];
        
        if (result && result.value) {
            leaderboard = JSON.parse(result.value);
        }
        
        // Check if score qualifies
        const qualifies = leaderboard.length < MAX_LEADERBOARD_ENTRIES || 
                         score > leaderboard[leaderboard.length - 1]?.score || 0;
        
        if (qualifies) {
            showNameInputModal(score);
        }
    } catch (error) {
        console.log('Checking qualification...', error);
        // If no leaderboard exists yet, any score qualifies
        showNameInputModal(score);
    }
}

// Show name input modal
function showNameInputModal(score) {
    const modal = document.getElementById('nameModal');
    const playerNameInput = document.getElementById('playerName');
    const submitBtn = document.getElementById('submitName');
    const skipBtn = document.getElementById('skipName');
    
    modal.classList.remove('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
    
    // Remove old event listeners
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
    
    // Add new event listeners
    newSubmitBtn.addEventListener('click', () => submitScore(score));
    newSkipBtn.addEventListener('click', () => modal.classList.add('hidden'));
    
    // Submit on Enter key
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitScore(score);
        }
    });
}

// Submit score to global leaderboard
async function submitScore(score) {
    const playerNameInput = document.getElementById('playerName');
    const modal = document.getElementById('nameModal');
    const name = playerNameInput.value.trim() || 'Anonymous';
    
    try {
        // Get current leaderboard
        let leaderboard = [];
        try {
            const result = await window.storage.get(LEADERBOARD_KEY, true);
            if (result && result.value) {
                leaderboard = JSON.parse(result.value);
            }
        } catch (error) {
            console.log('Creating new leaderboard...', error);
        }
        
        // Add new entry
        const newEntry = {
            name: name,
            score: score,
            timestamp: Date.now()
        };
        
        leaderboard.push(newEntry);
        
        // Sort by score (highest first)
        leaderboard.sort((a, b) => b.score - a.score);
        
        // Keep only top entries
        leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
        
        // Save to shared storage
        await window.storage.set(LEADERBOARD_KEY, JSON.stringify(leaderboard), true);
        
        // Close modal and refresh display
        modal.classList.add('hidden');
        displayLeaderboard(leaderboard);
        
        // Show success message
        gameMessage.textContent = `🎉 ${name}, you're on the global leaderboard!`;
        setTimeout(() => {
            if (!running) gameMessage.textContent = 'Try again to beat your score!';
        }, 3000);
        
    } catch (error) {
        console.error('Failed to save score:', error);
        alert('Failed to save score to leaderboard. Please try again.');
    }
}

// Initialize leaderboard on page load
document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard();
});
