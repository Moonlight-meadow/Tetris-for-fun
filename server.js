// GLOBAL LEADERBOARD - Compatible with both old and new backend
const MAX_LEADERBOARD_ENTRIES = 10;
const API_URL = 'https://tetris-for-fun.onrender.com/api';

let leaderboardData = [];
let daysUntilReset = 7;

// Load leaderboard from server
async function loadLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    if (!leaderboardDiv) {
        return;
    }
    
    try {
        leaderboardDiv.innerHTML = '<div class="leaderboard-item loading">Loading global leaderboard...</div>';
        
        const response = await fetch(`${API_URL}/leaderboard`);
        const data = await response.json();
        
        if (data.success) {
            // Handle both old and new backend formats
            leaderboardData = data.scores || [];
            daysUntilReset = data.daysUntilReset || null;
            
            console.log('✓ Loaded GLOBAL leaderboard:', leaderboardData.length, 'scores');
            if (daysUntilReset) {
                console.log(`📅 Resets in ${daysUntilReset} days`);
            }
            displayLeaderboard(leaderboardData);
        } else {
            throw new Error('Failed to load leaderboard');
        }
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardDiv.innerHTML = `
            <div class="leaderboard-item empty">
                Unable to connect to leaderboard server
            </div>
        `;
    }
}

// Display leaderboard
function displayLeaderboard(leaderboard) {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    if (!leaderboard || leaderboard.length === 0) {
        let resetInfo = '';
        if (daysUntilReset) {
            resetInfo = `<div style="font-size: 11px; margin-top: 5px; opacity: 0.7;">
                Resets in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}
            </div>`;
        }
        
        leaderboardDiv.innerHTML = `
            <div class="leaderboard-item empty">
                No scores yet. Be the first! 🌍
                ${resetInfo}
            </div>
        `;
        return;
    }
    
    let resetHeader = '';
    if (daysUntilReset) {
        resetHeader = `
            <div style="font-size: 11px; margin-bottom: 8px; opacity: 0.7; text-align: center;">
                🔄 Resets in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}
            </div>
        `;
    }
    
    leaderboardDiv.innerHTML = resetHeader + leaderboard.map((entry, index) => {
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
        return;
    }
    
    modal.classList.remove('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
    
    const submitHandler = async () => {
        await submitScore(score);
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

// Submit score to server
async function submitScore(score) {
    const playerNameInput = document.getElementById('playerName');
    const modal = document.getElementById('nameModal');
    const submitBtn = document.getElementById('submitName');
    const name = playerNameInput.value.trim() || 'Anonymous';
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'SAVING...';
    
    try {
        const response = await fetch(`${API_URL}/leaderboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, score })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✓ Score saved to GLOBAL leaderboard! Rank:', data.rank);
            leaderboardData = data.scores || [];
            daysUntilReset = data.daysUntilReset || null;
            
            modal.classList.add('hidden');
            displayLeaderboard(leaderboardData);
            
            // Show success message
            const gameMessage = document.getElementById('gameMessage');
            if (gameMessage) {
                gameMessage.textContent = `🎉 ${name} ranked #${data.rank} with ${score} points!`;
                setTimeout(() => {
                    if (typeof running !== 'undefined' && !running) {
                        gameMessage.textContent = 'Try again to beat your score!';
                    }
                }, 3000);
            }
        } else {
            throw new Error(data.error || 'Failed to save score');
        }
        
    } catch (error) {
        console.error('Error saving score:', error);
        alert('Failed to save score to global leaderboard. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'SUBMIT';
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLeaderboard);
} else {
    loadLeaderboard();
}
