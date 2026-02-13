// Global Leaderboard System using Persistent Storage
const MAX_LEADERBOARD_ENTRIES = 10;
const LEADERBOARD_KEY = 'tetris-leaderboard-v2';

// Load global leaderboard
async function loadLeaderboard() {
    const leaderboardDiv = document.getElementById('leaderboard');
    
    if (!leaderboardDiv) {
        console.error('Leaderboard div not found');
        return;
    }
    
    try {
        leaderboardDiv.innerHTML = '<div class="leaderboard-item loading">Loading...</div>';
        
        // Small delay to ensure storage is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await window.storage.get(LEADERBOARD_KEY, true);
        
        let leaderboard = [];
        if (result && result.value) {
            try {
                leaderboard = JSON.parse(result.value);
            } catch (e) {
                console.error('Failed to parse leaderboard data:', e);
            }
        }
        
        displayLeaderboard(leaderboard);
    } catch (error) {
        console.log('No leaderboard yet, showing empty state');
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
    console.log('=== LEADERBOARD CHECK ===');
    console.log('Score:', score);
    
    // Always show modal for any score
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

// Submit score
async function submitScore(score) {
    console.log('=== SUBMITTING SCORE ===');
    
    const playerNameInput = document.getElementById('playerName');
    const modal = document.getElementById('nameModal');
    const submitBtn = document.getElementById('submitName');
    
    const name = playerNameInput.value.trim() || 'Anonymous';
    console.log('Name:', name);
    
    // Disable submit button to prevent double-clicks
    submitBtn.disabled = true;
    submitBtn.textContent = 'SAVING...';
    
    try {
        // Step 1: Load existing leaderboard
        let leaderboard = [];
        
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            const result = await window.storage.get(LEADERBOARD_KEY, true);
            
            if (result && result.value) {
                leaderboard = JSON.parse(result.value);
                console.log('Loaded existing leaderboard:', leaderboard.length, 'entries');
            } else {
                console.log('No existing leaderboard found');
            }
        } catch (e) {
            console.log('Starting fresh leaderboard');
        }
        
        // Step 2: Add new entry
        const newEntry = {
            name: name,
            score: score,
            timestamp: Date.now()
        };
        
        leaderboard.push(newEntry);
        console.log('Added new entry');
        
        // Step 3: Sort and trim
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
        console.log('Sorted leaderboard:', leaderboard.length, 'entries');
        
        // Step 4: Save with multiple attempts
        let saveSuccess = false;
        const maxAttempts = 3;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`Save attempt ${attempt}/${maxAttempts}`);
                
                await new Promise(resolve => setTimeout(resolve, 300 * attempt));
                
                const saveResult = await window.storage.set(
                    LEADERBOARD_KEY, 
                    JSON.stringify(leaderboard), 
                    true
                );
                
                console.log('Save result:', saveResult);
                
                if (saveResult && saveResult.key) {
                    saveSuccess = true;
                    console.log('✓ Save successful!');
                    break;
                }
            } catch (saveError) {
                console.error(`Attempt ${attempt} failed:`, saveError);
                
                if (attempt === maxAttempts) {
                    throw new Error('All save attempts failed');
                }
            }
        }
        
        if (!saveSuccess) {
            throw new Error('Could not save to leaderboard');
        }
        
        // Success!
        modal.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'SUBMIT';
        
        // Reload leaderboard
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadLeaderboard();
        
        // Show success message
        const gameMessage = document.getElementById('gameMessage');
        if (gameMessage) {
            gameMessage.textContent = `🎉 ${name}, you're on the global leaderboard!`;
            setTimeout(() => {
                if (typeof running !== 'undefined' && !running) {
                    gameMessage.textContent = 'Try again to beat your score!';
                }
            }, 3000);
        }
        
    } catch (error) {
        console.error('=== SAVE FAILED ===');
        console.error(error);
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'SUBMIT';
        
        alert('Could not save your score. This might be a temporary issue with the storage system. Your score: ' + score);
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
