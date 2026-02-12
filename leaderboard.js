// Leaderboard functionality using localStorage
const LEADERBOARD_KEY = 'tetrisLeaderboard';
const MAX_LEADERBOARD_ENTRIES = 10;

// Load leaderboard from localStorage
function getLeaderboard() {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Error parsing leaderboard:', e);
            return [];
        }
    }
    return [];
}

// Save leaderboard to localStorage
function saveLeaderboard(leaderboard) {
    try {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
    } catch (e) {
        console.error('Error saving leaderboard:', e);
    }
}

// Display leaderboard
function loadLeaderboard() {
    const leaderboard = getLeaderboard();
    const leaderboardEl = document.getElementById('leaderboard');
    
    if (leaderboard.length === 0) {
        leaderboardEl.innerHTML = '<div class="leaderboard-item empty">No scores yet. Be the first!</div>';
        return;
    }
    
    leaderboardEl.innerHTML = '';
    
    leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES).forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = `leaderboard-item rank-${index + 1}`;
        
        item.innerHTML = `
            <div class="player-info">
                <div class="player-rank">#${index + 1}</div>
                <div class="player-name">${escapeHtml(entry.name)}</div>
            </div>
            <div class="player-score">${entry.score}</div>
        `;
        
        leaderboardEl.appendChild(item);
    });
}

// Check if score qualifies for leaderboard
function checkLeaderboardQualification(score) {
    const leaderboard = getLeaderboard();
    
    // Always qualify if less than 10 entries
    if (leaderboard.length < MAX_LEADERBOARD_ENTRIES) {
        showNameModal(score);
        return;
    }
    
    // Check if score is higher than lowest entry
    const lowestScore = leaderboard[leaderboard.length - 1].score;
    if (score > lowestScore) {
        showNameModal(score);
    }
}

// Show name input modal
function showNameModal(score) {
    const modal = document.getElementById('nameModal');
    const nameInput = document.getElementById('playerName');
    const submitBtn = document.getElementById('submitName');
    const skipBtn = document.getElementById('skipName');
    
    modal.classList.remove('hidden');
    nameInput.value = '';
    nameInput.focus();
    
    const submitScore = () => {
        const name = nameInput.value.trim() || 'Anonymous';
        addToLeaderboard(name, score);
        modal.classList.add('hidden');
    };
    
    const skipScore = () => {
        modal.classList.add('hidden');
    };
    
    // Remove old listeners
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
    
    // Add new listeners
    newSubmitBtn.addEventListener('click', submitScore);
    newSkipBtn.addEventListener('click', skipScore);
    
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitScore();
        }
    });
}

// Add score to leaderboard
function addToLeaderboard(name, score) {
    const leaderboard = getLeaderboard();
    
    leaderboard.push({
        name: name,
        score: score,
        date: new Date().toISOString()
    });
    
    // Sort by score descending
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep only top 10
    const trimmed = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
    
    saveLeaderboard(trimmed);
    loadLeaderboard();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize leaderboard on page load
document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard();
});
