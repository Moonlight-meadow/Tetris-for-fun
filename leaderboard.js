// Global Leaderboard System using Persistent Storage
const MAX_LEADERBOARD_ENTRIES = 10;
const LEADERBOARD_KEY = 'tetris-scores';

// Load global leaderboard
async function loadLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    if (!leaderboardDiv) {
        console.error('Leaderboard div not found');
        return;
    }
    
    try {
        leaderboardDiv.innerHTML = '<div class="leaderboard-item loading">Loading...</div>';
        
        // Check if storage API exists
        if (!window.storage || !window.storage.get) {
            console.error('Storage API not available');
            displayLeaderboard([]);
            return;
        }
        
        const result = await window.storage.get(LEADERBOARD_KEY, true);
        
        let leaderboard = [];
        if (result && result.value) {
            try {
                leaderboard = JSON.parse(result.value);
                console.log('✓ Loaded', leaderboard.length, 'scores');
            } catch (e) {
                console.error('Parse error:', e);
            }
        }
        
        displayLeaderboard(leaderboard);
    } catch (error) {
        console.log('No existing leaderboard:', error.message);
        displayLeaderboard([]);
    }
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
async function checkLeaderboardQualification(score) {
    console.log('=== CHECKING SCORE:', score, '===');
    
    // Check if storage is available
    if (!window.storage || !window.storage.set) {
        console.error('Storage API not available - leaderboard disabled');
        alert('Leaderboard is currently unavailable. Your score: ' + score);
        return;
    }
    
    showNameInputModal(score);
}

// Show name input modal
function showNameInputModal(score) {
    const modal = document.getElementById('nameModal');
    const playerNameInput = document.getElementById('playerName');
    
    if (!modal) {
        console.error('Modal not found!');
        return;
    }
    
    modal.classList.remove('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
    
    // Set up submit handler
    const submitHandler = async () => {
        await submitScore(score);
    };
    
    // Set up skip handler
    const skipHandler = () => {
        modal.classList.add('hidden');
    };
    
    // Remove old listeners and add new ones
    const submitBtn = document.getElementById('submitName');
    const skipBtn = document.getElementById('skipName');
    
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    newSubmitBtn.addEventListener('click', submitHandler);
    
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
    newSkipBtn.addEventListener('click', skipHandler);
    
    // Enter key submits
    const enterHandler = (e) => {
        if (e.key === 'Enter') {
            submitHandler();
        }
    };
    playerNameInput.removeEventListener('keypress', enterHandler);
    playerNameInput.addEventListener('keypress', enterHandler);
}

// Submit score with fallback to individual score storage
async function submitScore(score) {
    console.log('=== SUBMITTING SCORE:', score, '===');
    
    const playerNameInput = document.getElementById('playerName');
    const modal = document.getElementById('nameModal');
    const submitBtn = document.getElementById('submitName');
    
    const name = playerNameInput.value.trim() || 'Anonymous';
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'SAVING...';
    
    try {
        // Try Method 1: Single shared leaderboard (preferred)
        console.log('Trying shared leaderboard method...');
        const success = await saveToSharedLeaderboard(name, score);
        
        if (success) {
            modal.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'SUBMIT';
            
            await loadLeaderboard();
            
            const gameMessage = document.getElementById('gameMessage');
            if (gameMessage) {
                gameMessage.textContent = `🎉 ${name}, you're on the leaderboard!`;
                setTimeout(() => {
                    if (typeof running !== 'undefined' && !running) {
                        gameMessage.textContent = 'Try again to beat your score!';
                    }
                }, 3000);
            }
            return;
        }
        
        // If shared method fails, try Method 2: Individual score entries
        console.log('Shared method failed, trying individual score method...');
        const success2 = await saveIndividualScore(name, score);
        
        if (success2) {
            modal.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'SUBMIT';
            
            await loadLeaderboardFromIndividualScores();
            
            const gameMessage = document.getElementById('gameMessage');
            if (gameMessage) {
                gameMessage.textContent = `🎉 Score saved: ${score}`;
                setTimeout(() => {
                    if (typeof running !== 'undefined' && !running) {
                        gameMessage.textContent = 'Try again to beat your score!';
                    }
                }, 3000);
            }
            return;
        }
        
        throw new Error('All save methods failed');
        
    } catch (error) {
        console.error('=== SAVE FAILED ===');
        console.error(error);
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'SUBMIT';
        
        alert('Unable to save score. The storage system may be temporarily unavailable.\n\nYour score: ' + score + '\nPlayer: ' + name);
    }
}

// Method 1: Save to single shared leaderboard
async function saveToSharedLeaderboard(name, score) {
    try {
        // Load existing
        let leaderboard = [];
        
        try {
            const result = await window.storage.get(LEADERBOARD_KEY, true);
            if (result && result.value) {
                leaderboard = JSON.parse(result.value);
            }
        } catch (e) {
            console.log('No existing leaderboard, starting fresh');
        }
        
        // Add new entry
        leaderboard.push({
            name: name,
            score: score,
            timestamp: Date.now()
        });
        
        // Sort and trim
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
        
        // Save
        const data = JSON.stringify(leaderboard);
        console.log('Saving data length:', data.length);
        
        const result = await window.storage.set(LEADERBOARD_KEY, data, true);
        
        if (result && result.key) {
            console.log('✓ Saved successfully');
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Shared save error:', error);
        return false;
    }
}

// Method 2: Save individual scores (fallback)
async function saveIndividualScore(name, score) {
    try {
        const timestamp = Date.now();
        const scoreKey = `score-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
        
        const scoreData = JSON.stringify({
            name: name,
            score: score,
            timestamp: timestamp
        });
        
        const result = await window.storage.set(scoreKey, scoreData, true);
        
        if (result && result.key) {
            console.log('✓ Individual score saved:', scoreKey);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Individual save error:', error);
        return false;
    }
}

// Load from individual scores (fallback)
async function loadLeaderboardFromIndividualScores() {
    try {
        const result = await window.storage.list('score-', true);
        
        if (!result || !result.keys || result.keys.length === 0) {
            console.log('No individual scores found');
            displayLeaderboard([]);
            return;
        }
        
        console.log('Found', result.keys.length, 'individual scores');
        
        // Load all scores
        const scores = [];
        for (const key of result.keys) {
            try {
                const scoreResult = await window.storage.get(key, true);
                if (scoreResult && scoreResult.value) {
                    const scoreData = JSON.parse(scoreResult.value);
                    scores.push(scoreData);
                }
            } catch (e) {
                console.error('Failed to load score:', key);
            }
        }
        
        // Sort and display
        scores.sort((a, b) => b.score - a.score);
        const topScores = scores.slice(0, MAX_LEADERBOARD_ENTRIES);
        
        displayLeaderboard(topScores);
        
    } catch (error) {
        console.error('Failed to load individual scores:', error);
        displayLeaderboard([]);
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(loadLeaderboard, 500);
    });
} else {
    setTimeout(loadLeaderboard, 500);
}
