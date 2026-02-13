// SIMPLIFIED LEADERBOARD - Just displays scores, no saving
const MAX_LEADERBOARD_ENTRIES = 10;

// In-memory leaderboard (resets when page reloads)
let leaderboardData = [];

// Load leaderboard
function loadLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    if (!leaderboardDiv) {
        return;
    }
    
    displayLeaderboard(leaderboardData);
}

// Display leaderboard
function displayLeaderboard(leaderboard) {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    if (!leaderboard || leaderboard.length === 0) {
        leaderboardDiv.innerHTML = `
            <div class="leaderboard-item empty">
                No scores yet. Be the first!
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

// Check if score qualifies
function checkLeaderboardQualification(score) {
    console.log('Score:', score);
    
    if (!score || score === 0) {
        return;
    }
    
    showNameInputModal(score);
}

// Show name input modal
function showNameInputModal(score) {
    const modal = document.getElementById('nameModal');
    const playerNameInput = document.getElementById('playerName');
    
    if (!modal) {
        console.error('Modal not found');
        return;
    }
    
    modal.classList.remove('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
    
    // Set up submit
    const submitHandler = () => {
        submitScore(score);
    };
    
    const skipHandler = () => {
        modal.classList.add('hidden');
    };
    
    const submitBtn = document.getElementById('submitName');
    const skipBtn = document.getElementById('skipName');
    
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    newSubmitBtn.addEventListener('click', submitHandler);
    
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
    newSkipBtn.addEventListener('click', skipHandler);
    
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitHandler();
        }
    });
}

// Submit score
function submitScore(score) {
    const playerNameInput = document.getElementById('playerName');
    const modal = document.getElementById('nameModal');
    const name = playerNameInput.value.trim() || 'Anonymous';
    
    // Add to leaderboard
    leaderboardData.push({
        name: name,
        score: score,
        timestamp: Date.now()
    });
    
    // Sort by score
    leaderboardData.sort((a, b) => b.score - a.score);
    
    // Keep top 10
    leaderboardData = leaderboardData.slice(0, MAX_LEADERBOARD_ENTRIES);
    
    // Close modal
    modal.classList.add('hidden');
    
    // Update display
    displayLeaderboard(leaderboardData);
    
    // Show success message
    const gameMessage = document.getElementById('gameMessage');
    if (gameMessage) {
        gameMessage.textContent = `🎉 ${name} scored ${score} points!`;
        setTimeout(() => {
            if (typeof running !== 'undefined' && !running) {
                gameMessage.textContent = 'Try again to beat your score!';
            }
        }, 3000);
    }
    
    console.log('Score saved!', name, score);
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLeaderboard);
} else {
    loadLeaderboard();
}
