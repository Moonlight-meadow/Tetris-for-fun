// Global Leaderboard System using Persistent Storage
// This allows all players to see and compete on the same leaderboard!

const MAX_LEADERBOARD_ENTRIES = 10;
const LEADERBOARD_KEY = 'tetris-global-leaderboard';

// Load global leaderboard
async function loadLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    try {
        console.log('Loading leaderboard...');
        leaderboardDiv.innerHTML = '<div class="leaderboard-item loading">Loading global leaderboard...</div>';
        
        // Get shared leaderboard data
        const result = await window.storage.get(LEADERBOARD_KEY, true);
        console.log('Leaderboard data loaded:', result);
        
        let leaderboard = [];
        if (result && result.value) {
            leaderboard = JSON.parse(result.value);
        }
        
        displayLeaderboard(leaderboard);
    } catch (error) {
        console.log('Leaderboard does not exist yet, creating new one...', error);
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
    console.log('Checking if score qualifies:', score);
    
    // Always show the modal for any score
    showNameInputModal(score);
}

// Show name input modal
function showNameInputModal(score) {
    console.log('Showing name input modal for score:', score);
    
    const modal = document.getElementById('nameModal');
    const playerNameInput = document.getElementById('playerName');
    const submitBtn = document.getElementById('submitName');
    const skipBtn = document.getElementById('skipName');
    
    if (!modal) {
        console.error('Modal element not found!');
        return;
    }
    
    modal.classList.remove('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
    
    // Remove old event listeners
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);
    
    // Add new event listeners
    newSubmitBtn.addEventListener('click', () => {
        console.log('Submit button clicked');
        submitScore(score);
    });
    
    newSkipBtn.addEventListener('click', () => {
        console.log('Skip button clicked');
        modal.classList.add('hidden');
    });
    
    // Submit on Enter key
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            console.log('Enter key pressed');
            submitScore(score);
        }
    });
}

// Submit score to global leaderboard
async function submitScore(score) {
    console.log('Submitting score:', score);
    
    const playerNameInput = document.getElementById('playerName');
    const modal = document.getElementById('nameModal');
    const name = playerNameInput.value.trim() || 'Anonymous';
    
    console.log('Player name:', name);
    
    try {
        // Get current leaderboard with retry logic
        let leaderboard = [];
        let retries = 3;
        
        while (retries > 0) {
            try {
                const result = await window.storage.get(LEADERBOARD_KEY, true);
                if (result && result.value) {
                    leaderboard = JSON.parse(result.value);
                }
                console.log('Current leaderboard loaded:', leaderboard);
                break;
            } catch (error) {
                retries--;
                if (retries === 0) {
                    console.log('Could not load existing leaderboard, starting fresh');
                } else {
                    console.log('Retry loading leaderboard...', error);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
        
        // Add new entry
        const newEntry = {
            name: name,
            score: score,
            timestamp: Date.now()
        };
        
        console.log('Adding new entry:', newEntry);
        
        leaderboard.push(newEntry);
        
        // Sort by score (highest first)
        leaderboard.sort((a, b) => b.score - a.score);
        
        // Keep only top entries
        leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
        
        console.log('Updated leaderboard:', leaderboard);
        
        // Save to shared storage with retry logic
        let saved = false;
        retries = 5;
        
        while (retries > 0 && !saved) {
            try {
                const saveResult = await window.storage.set(LEADERBOARD_KEY, JSON.stringify(leaderboard), true);
                console.log('Save result:', saveResult);
                
                if (saveResult) {
                    saved = true;
                    break;
                }
            } catch (error) {
                retries--;
                console.error(`Save attempt failed (${retries} retries left):`, error);
                
                if (retries > 0) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        if (!saved) {
            throw new Error('Could not save to leaderboard after multiple attempts');
        }
        
        // Close modal
        modal.classList.add('hidden');
        
        // Reload leaderboard to show updated rankings
        await loadLeaderboard();
        
        // Show success message
        const gameMessage = document.getElementById('gameMessage');
        if (gameMessage) {
            gameMessage.textContent = `🎉 ${name}, you're on the global leaderboard!`;
            setTimeout(() => {
                const runningCheck = typeof running !== 'undefined' ? running : false;
                if (!runningCheck) gameMessage.textContent = 'Try again to beat your score!';
            }, 3000);
        }
        
        console.log('Score submitted successfully!');
        
    } catch (error) {
        console.error('Failed to save score:', error);
        alert('Failed to save score to leaderboard. The server might be busy. Please try again in a moment.');
        
        // Don't close the modal so user can retry
    }
}

// Initialize leaderboard on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing leaderboard...');
    loadLeaderboard();
});
