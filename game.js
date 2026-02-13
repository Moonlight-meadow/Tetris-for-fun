// Game Constants
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const TARGET_SCORE = 5000;
const LINES_PER_WAVE = 15;
const INITIAL_DROP_INTERVAL = 1000;
const SPEED_INCREASE_PER_WAVE = 50;
const LOCK_DELAY = 2000; // 2 second lock delay

// Tetromino Colors
const COLORS = [
    null,
    '#FF6B9D', // I
    '#C44569', // J
    '#FFA502', // L
    '#FFD93D', // O
    '#6BCB77', // S
    '#4D96FF', // T
    '#845EC2'  // Z
];

// Tetromino Shapes
const PIECES = [
    [],
    [[1,1,1,1]],           // I
    [[2,0,0],[2,2,2]],     // J
    [[0,0,3],[3,3,3]],     // L
    [[4,4],[4,4]],         // O
    [[0,5,5],[5,5,0]],     // S
    [[0,6,0],[6,6,6]],     // T
    [[7,7,0],[0,7,7]]      // Z
];

// Canvas Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('holdCanvas');
const holdCtx = holdCanvas.getContext('2d');

// Audio Elements
const sounds = {
    menu: document.getElementById('menuMusic'),
    background: document.getElementById('backgroundMusic'),
    hit: document.getElementById('hitSound'),
    rotate: document.getElementById('rotateSound'),
    complete: document.getElementById('completeSound'),
    milestone2k: document.getElementById('milestone2k'),
    milestone1k: document.getElementById('milestone1k'),
    win: document.getElementById('winSound'),
    lose: document.getElementById('loseSound'),
    stored: document.getElementById('storedSound')
};

// Sound settings
let soundSettings = {
    music: true,
    sfx: true
};

// Music milestone tracking
let milestone3kPlayed = false;
let milestone4kPlayed = false;
let milestone5kPlayed = false;

// Game State
let board = [];
let score = 0;
let lines = 0;
let wave = 1;
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let canHold = true;
let running = false;
let dropInterval = INITIAL_DROP_INTERVAL;
let lastTime = 0;
let dropCounter = 0;
let hasReachedTarget = false;
let keysPressed = {};
let moveDelay = 150;
let moveInterval = 50;
let downInterval = 30;
let moveTimers = {};

// Lock delay state
let lockDelayTimer = 0;
let isOnGround = false;
let lockDelayActive = false;
let moveCount = 0;
const MAX_MOVES_BEFORE_LOCK = 15;

// Combo system
let comboCount = 0;
let lastClearTime = 0;
const COMBO_WINDOW = 3000; // 3 seconds to maintain combo // Reset lock after 15 moves to prevent infinite stalling

// UI Elements
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const continueBtn = document.getElementById('continueBtn');
const finishBtn = document.getElementById('finishBtn');
const finalRetryBtn = document.getElementById('finalRetryBtn');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const winOverlay = document.getElementById('winOverlay');
const finalWinOverlay = document.getElementById('finalWinOverlay');
const gameMessage = document.getElementById('gameMessage');

// Initialize
function init() {
    board = createBoard();
    updateUI();
    drawBoard();
    loadLeaderboard();
    updateSoundButtons();
    
    sounds.menu.volume = 0.3;
    playSound(sounds.menu);
}

// Create empty board
function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// Create random piece
function createPiece() {
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = PIECES[type].map(row => [...row]);
    return {
        shape,
        color: type,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0
    };
}

// Reset lock delay
function resetLockDelay() {
    lockDelayTimer = 0;
    lockDelayActive = false;
    moveCount = 0;
}

// Check if piece is on ground
function isPieceOnGround() {
    return collide(0, 1);
}

// Draw grid lines
function drawGrid() {
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.25)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }
    
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
        ctx.stroke();
    }
}

// Draw functions
function drawBlock(context, x, y, color, blockSize = BLOCK_SIZE) {
    if (!color) return;
    
    context.fillStyle = color;
    context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
    
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fillRect(x * blockSize + 1, y * blockSize + 1, blockSize / 3, blockSize / 3);
    
    context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    context.lineWidth = 1;
    context.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
}

function drawBoard() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) drawBlock(ctx, x, y, COLORS[value]);
        });
    });
}

function drawPiece() {
    if (!currentPiece) return;
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, COLORS[currentPiece.color]);
            }
        });
    });
}

function getGhostY() {
    if (!currentPiece) return 0;
    
    let ghostY = currentPiece.y;
    while (!collide(0, ghostY - currentPiece.y + 1)) {
        ghostY++;
    }
    return ghostY;
}

function drawHighlightBeams() {
    if (!currentPiece) return;
    
    const ghostY = getGhostY();
    if (ghostY <= currentPiece.y) return;
    
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const blockX = currentPiece.x + x;
                const currentBlockY = currentPiece.y + y;
                const ghostBlockY = ghostY + y;
                
                const gradient = ctx.createLinearGradient(
                    blockX * BLOCK_SIZE + BLOCK_SIZE / 2,
                    currentBlockY * BLOCK_SIZE,
                    blockX * BLOCK_SIZE + BLOCK_SIZE / 2,
                    ghostBlockY * BLOCK_SIZE
                );
                
                gradient.addColorStop(0, 'rgba(255, 255, 150, 0.02)');
                gradient.addColorStop(0.5, 'rgba(255, 255, 150, 0.01)');
                gradient.addColorStop(1, 'rgba(255, 255, 150, 0.005)');
                
                ctx.fillStyle = gradient;
                
                const beamHeight = (ghostBlockY - currentBlockY) * BLOCK_SIZE - BLOCK_SIZE;
                if (beamHeight > 0) {
                    ctx.fillRect(
                        blockX * BLOCK_SIZE + 5,
                        currentBlockY * BLOCK_SIZE + BLOCK_SIZE,
                        BLOCK_SIZE - 10,
                        beamHeight
                    );
                    
                    ctx.strokeStyle = 'rgba(255, 255, 200, 0.03)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        blockX * BLOCK_SIZE + 5,
                        currentBlockY * BLOCK_SIZE + BLOCK_SIZE,
                        BLOCK_SIZE - 10,
                        beamHeight
                    );
                }
            }
        });
    });
}

function drawGhostPiece() {
    if (!currentPiece) return;
    
    const ghostY = getGhostY();
    
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const blockX = currentPiece.x + x;
                const blockY = ghostY + y;
                
                ctx.shadowColor = 'rgba(255, 255, 150, 0.4)';
                ctx.shadowBlur = 8;
                
                ctx.fillStyle = 'rgba(255, 255, 150, 0.12)';
                ctx.fillRect(blockX * BLOCK_SIZE, blockY * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                
                ctx.shadowBlur = 0;
                
                ctx.strokeStyle = 'rgba(255, 255, 200, 0.5)';
                ctx.lineWidth = 2;
                ctx.strokeRect(blockX * BLOCK_SIZE + 2, blockY * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
            }
        });
    });
}

function drawNextPiece() {
    nextCtx.fillStyle = '#1a1a1a';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (!nextPiece) return;
    
    const blockSize = 25;
    const offsetX = (nextCanvas.width - nextPiece.shape[0].length * blockSize) / 2 / blockSize;
    const offsetY = (nextCanvas.height - nextPiece.shape.length * blockSize) / 2 / blockSize;
    
    nextPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(nextCtx, offsetX + x, offsetY + y, COLORS[nextPiece.color], blockSize);
            }
        });
    });
}

function drawHoldPiece() {
    holdCtx.fillStyle = '#1a1a1a';
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    
    if (!holdPiece) return;
    
    const blockSize = 25;
    const offsetX = (holdCanvas.width - holdPiece.shape[0].length * blockSize) / 2 / blockSize;
    const offsetY = (holdCanvas.height - holdPiece.shape.length * blockSize) / 2 / blockSize;
    
    holdPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(holdCtx, offsetX + x, offsetY + y, COLORS[holdPiece.color], blockSize);
            }
        });
    });
}

// Collision detection
function collide(offsetX = 0, offsetY = 0) {
    for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
            if (currentPiece.shape[y][x]) {
                const newX = currentPiece.x + x + offsetX;
                const newY = currentPiece.y + y + offsetY;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
                if (newY >= 0 && board[newY][newX]) return true;
            }
        }
    }
    return false;
}

// Merge piece to board
function merge() {
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                }
            }
        });
    });
    playSound(sounds.hit);
}

// Rotate piece
function rotate() {
    const rotated = currentPiece.shape[0].map((_, i) =>
        currentPiece.shape.map(row => row[i]).reverse()
    );
    
    const oldShape = currentPiece.shape;
    currentPiece.shape = rotated;
    
    let offset = 0;
    while (collide()) {
        currentPiece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > rotated[0].length) {
            currentPiece.shape = oldShape;
            return;
        }
    }
    
    // Reset lock delay on rotation if on ground
    if (isPieceOnGround() && lockDelayActive) {
        moveCount++;
        if (moveCount < MAX_MOVES_BEFORE_LOCK) {
            lockDelayTimer = 0;
        }
    }
    
    playSound(sounds.rotate);
}

// Hold piece
function holdCurrentPiece() {
    if (!canHold) return;
    
    if (holdPiece === null) {
        holdPiece = {
            shape: PIECES[currentPiece.color].map(row => [...row]),
            color: currentPiece.color
        };
        currentPiece = nextPiece;
        nextPiece = createPiece();
    } else {
        const temp = {
            shape: PIECES[currentPiece.color].map(row => [...row]),
            color: currentPiece.color
        };
        currentPiece = {
            shape: holdPiece.shape.map(row => [...row]),
            color: holdPiece.color,
            x: Math.floor(COLS / 2) - Math.floor(holdPiece.shape[0].length / 2),
            y: 0
        };
        holdPiece = temp;
    }
    
    canHold = false;
    resetLockDelay();
    playSound(sounds.stored);
    drawHoldPiece();
}

// Music milestone management
function checkMusicMilestones() {
    if (score >= 3000 && !milestone3kPlayed) {
        milestone3kPlayed = true;
        stopAllMusic();
        sounds.milestone2k.volume = 0.3;
        sounds.milestone2k.loop = true;
        playSound(sounds.milestone2k);
        gameMessage.textContent = '2000 points to victory!';
        setTimeout(() => {
            if (running) gameMessage.textContent = 'Keep going!';
        }, 2000);
    }
    
    if (score >= 4000 && !milestone4kPlayed) {
        milestone4kPlayed = true;
        stopAllMusic();
        sounds.milestone1k.volume = 0.3;
        sounds.milestone1k.loop = true;
        playSound(sounds.milestone1k);
        gameMessage.textContent = '1000 points to victory!';
        setTimeout(() => {
            if (running) gameMessage.textContent = 'Almost there!';
        }, 2000);
    }
}

// Stop all music
function stopAllMusic() {
    Object.values(sounds).forEach(sound => {
        if (sound.tagName === 'AUDIO') {
            sound.pause();
            sound.currentTime = 0;
        }
    });
}

// Create score particle effect
function createScoreParticle(points) {
    const particle = document.createElement('div');
    particle.className = 'score-particle';
    particle.textContent = `+${points}`;
    
    // Start from game canvas area
    const canvas = document.getElementById('gameCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    const scoreElement = document.getElementById('score');
    const scoreRect = scoreElement.getBoundingClientRect();
    
    // Position at center of canvas
    particle.style.left = canvasRect.left + canvasRect.width / 2 + 'px';
    particle.style.top = canvasRect.top + canvasRect.height / 2 + 'px';
    
    document.body.appendChild(particle);
    
    // Animate to score display
    setTimeout(() => {
        particle.style.left = scoreRect.left + scoreRect.width / 2 + 'px';
        particle.style.top = scoreRect.top + scoreRect.height / 2 + 'px';
        particle.style.opacity = '0';
        particle.style.transform = 'scale(0.5)';
    }, 50);
    
    // Flash the score display
    setTimeout(() => {
        scoreElement.classList.add('score-flash');
        setTimeout(() => {
            scoreElement.classList.remove('score-flash');
        }, 300);
    }, 600);
    
    // Remove particle
    setTimeout(() => {
        particle.remove();
    }, 800);
}

// Clear completed lines with combo system
function clearLines() {
    let cleared = 0;
    
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            cleared++;
            y++;
        }
    }
    
    if (cleared > 0) {
        lines += cleared;
        
        // Calculate score with combo system
        let points = 0;
        const currentTime = Date.now();
        
        // Check if this is part of a combo (within 3 seconds of last clear)
        if (currentTime - lastClearTime < COMBO_WINDOW && comboCount > 0) {
            comboCount++;
        } else {
            comboCount = 1;
        }
        lastClearTime = currentTime;
        
        // Base points
        if (cleared === 1) {
            points = 5;
        } else if (cleared === 2) {
            points = 15; // Bonus for double
        } else if (cleared === 3) {
            points = 30; // Big bonus for triple
        } else if (cleared === 4) {
            points = 50; // Massive bonus for Tetris!
        }
        
        // Combo bonus (add 50 points per combo after first clear)
        if (comboCount > 1) {
            points += 50;
        }
        
        score += points;
        
        // Show score particle
        createScoreParticle(points);
        
        // Check music milestones
        checkMusicMilestones();
        
        // Wave progression every 15 lines
        const newWave = Math.floor(lines / LINES_PER_WAVE) + 1;
        if (newWave > wave) {
            wave = newWave;
            dropInterval = Math.max(100, INITIAL_DROP_INTERVAL - (wave - 1) * SPEED_INCREASE_PER_WAVE);
            if (score < 3000) {
                gameMessage.textContent = `WAVE ${wave}! Speed increased!`;
                setTimeout(() => {
                    if (running && score < 3000) gameMessage.textContent = 'Keep going!';
                }, 2000);
            }
        }
        
        playSound(sounds.complete);
        updateUI();
        
        if (score >= TARGET_SCORE && !hasReachedTarget) {
            hasReachedTarget = true;
            milestone5kPlayed = true;
            winGame();
        }
    } else {
        // Reset combo if no lines cleared
        if (Date.now() - lastClearTime > COMBO_WINDOW) {
            comboCount = 0;
        }
    }
}

// Spawn new piece
function spawnNewPiece() {
    currentPiece = nextPiece;
    nextPiece = createPiece();
    canHold = true;
    resetLockDelay();
    
    drawNextPiece();
    
    if (collide()) {
        gameOver();
    }
}

// Drop piece
function drop() {
    currentPiece.y++;
    
    if (collide()) {
        currentPiece.y--;
        
        // Don't merge immediately - start lock delay
        if (!lockDelayActive) {
            lockDelayActive = true;
            lockDelayTimer = 0;
        }
    } else {
        // Piece moved down successfully, reset lock delay
        if (lockDelayActive) {
            resetLockDelay();
        }
    }
}

// Hard drop
function hardDrop() {
    while (!collide(0, 1)) {
        currentPiece.y++;
    }
    
    // Hard drop bypasses lock delay
    merge();
    clearLines();
    spawnNewPiece();
}

// Move piece
function move(dir) {
    currentPiece.x += dir;
    if (collide()) {
        currentPiece.x -= dir;
    } else {
        // Reset lock delay on successful horizontal move if on ground
        if (isPieceOnGround() && lockDelayActive) {
            moveCount++;
            if (moveCount < MAX_MOVES_BEFORE_LOCK) {
                lockDelayTimer = 0;
            }
        }
    }
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lines').textContent = lines;
    document.getElementById('wave').textContent = wave;
}

// Play sound
function playSound(audio) {
    // Check if it's music or sound effect
    const isMusicTrack = audio.id.includes('Music') || audio.id.includes('milestone') || audio.id === 'winSound';
    
    if (isMusicTrack && !soundSettings.music) {
        return; // Don't play music if muted
    }
    
    if (!isMusicTrack && !soundSettings.sfx) {
        return; // Don't play sound effects if muted
    }
    
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Audio play failed:', e));
}

// Toggle sound settings
function toggleMusic() {
    soundSettings.music = !soundSettings.music;
    updateSoundButtons();
    
    if (!soundSettings.music) {
        // Mute all music
        sounds.menu.pause();
        sounds.background.pause();
        sounds.milestone2k.pause();
        sounds.milestone1k.pause();
        sounds.win.pause();
    } else {
        // Resume appropriate music based on game state
        if (!running) {
            playSound(sounds.menu);
        } else if (running && !hasReachedTarget) {
            if (score >= 4000) {
                playSound(sounds.milestone1k);
            } else if (score >= 3000) {
                playSound(sounds.milestone2k);
            } else {
                playSound(sounds.background);
            }
        }
    }
}

function toggleSFX() {
    soundSettings.sfx = !soundSettings.sfx;
    updateSoundButtons();
}

function updateSoundButtons() {
    const musicBtn = document.getElementById('musicToggle');
    const sfxBtn = document.getElementById('sfxToggle');
    
    if (musicBtn) {
        musicBtn.textContent = soundSettings.music ? '🎵 Music: ON' : '🎵 Music: OFF';
        musicBtn.style.opacity = soundSettings.music ? '1' : '0.5';
    }
    
    if (sfxBtn) {
        sfxBtn.textContent = soundSettings.sfx ? '🔊 SFX: ON' : '🔊 SFX: OFF';
        sfxBtn.style.opacity = soundSettings.sfx ? '1' : '0.5';
    }
}

// Game loop
function gameLoop(time = 0) {
    if (!running) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    
    // Handle lock delay
    if (lockDelayActive) {
        lockDelayTimer += deltaTime;
        
        // Check if lock delay expired or max moves reached
        if (lockDelayTimer >= LOCK_DELAY || moveCount >= MAX_MOVES_BEFORE_LOCK) {
            merge();
            clearLines();
            spawnNewPiece();
        }
    } else {
        // Normal drop
        if (dropCounter > dropInterval) {
            drop();
            dropCounter = 0;
        }
    }
    
    drawBoard();
    drawHighlightBeams();
    drawGhostPiece();
    drawPiece();
    
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    // FIRST: Stop ALL audio completely
    stopAllMusic();
    
    board = createBoard();
    score = 0;
    lines = 0;
    wave = 1;
    dropInterval = INITIAL_DROP_INTERVAL;
    dropCounter = 0;
    hasReachedTarget = false;
    milestone3kPlayed = false;
    milestone4kPlayed = false;
    milestone5kPlayed = false;
    resetLockDelay();
    comboCount = 0;
    lastClearTime = 0;
    
    currentPiece = createPiece();
    nextPiece = createPiece();
    holdPiece = null;
    canHold = true;
    running = true;
    
    updateUI();
    drawNextPiece();
    drawHoldPiece();
    
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    winOverlay.classList.add('hidden');
    finalWinOverlay.classList.add('hidden');
    
    gameMessage.textContent = 'Good luck!';
    
    // Small delay before starting music to ensure everything is stopped
    setTimeout(() => {
        if (soundSettings.music) {
            sounds.background.volume = 0.3;
            sounds.background.loop = true;
            playSound(sounds.background);
        }
    }, 100);
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Game over
function gameOver() {
    running = false;
    stopAllMusic();
    
    if (hasReachedTarget) {
        playSound(sounds.win);
    } else {
        playSound(sounds.lose);
    }
    
    document.getElementById('finalScore').textContent = `Score: ${score}`;
    gameOverOverlay.classList.remove('hidden');
    gameMessage.textContent = 'Game Over! Try again?';
    
    checkLeaderboardQualification(score);
}

// Win game (reached 5000)
function winGame() {
    running = false;
    stopAllMusic();
    sounds.win.volume = 0.3;
    sounds.win.loop = true;
    playSound(sounds.win);
    
    document.getElementById('winScore').textContent = `Score: ${score}`;
    winOverlay.classList.remove('hidden');
    gameMessage.textContent = 'You won!';
}

// Continue after winning
function continueGame() {
    document.getElementById('countdown').classList.remove('hidden');
    continueBtn.disabled = true;
    finishBtn.disabled = true;
    
    let count = 5;
    document.getElementById('countdownNum').textContent = count;
    
    const countdown = setInterval(() => {
        count--;
        if (count > 0) {
            document.getElementById('countdownNum').textContent = count;
        } else {
            clearInterval(countdown);
            winOverlay.classList.add('hidden');
            document.getElementById('countdown').classList.add('hidden');
            continueBtn.disabled = false;
            finishBtn.disabled = false;
            
            running = true;
            resetLockDelay();
            gameMessage.textContent = 'Keep going for a higher score!';
            
            sounds.win.currentTime = 0;
            playSound(sounds.win);
            
            lastTime = performance.now();
            requestAnimationFrame(gameLoop);
        }
    }, 1000);
}

// Finish with 5000 score
function finishGame() {
    winOverlay.classList.add('hidden');
    document.getElementById('legendScore').textContent = `Score: ${score}`;
    finalWinOverlay.classList.remove('hidden');
    gameMessage.textContent = 'Congratulations, legend!';
    
    checkLeaderboardQualification(score);
}

// Keyboard controls
document.addEventListener('keydown', e => {
    if (!running) return;
    
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Shift'].includes(e.key)) {
        e.preventDefault();
    }
    
    if (keysPressed[e.key]) return;
    
    keysPressed[e.key] = true;
    
    switch(e.key) {
        case 'ArrowLeft':
            move(-1);
            moveTimers[e.key] = setTimeout(() => {
                moveTimers[e.key] = setInterval(() => {
                    if (running && keysPressed['ArrowLeft']) move(-1);
                }, moveInterval);
            }, moveDelay);
            break;
        case 'ArrowRight':
            move(1);
            moveTimers[e.key] = setTimeout(() => {
                moveTimers[e.key] = setInterval(() => {
                    if (running && keysPressed['ArrowRight']) move(1);
                }, moveInterval);
            }, moveDelay);
            break;
        case 'ArrowDown':
            drop();
            dropCounter = 0;
            moveTimers[e.key] = setTimeout(() => {
                moveTimers[e.key] = setInterval(() => {
                    if (running && keysPressed['ArrowDown']) {
                        drop();
                        dropCounter = 0;
                    }
                }, downInterval);
            }, 50);
            break;
        case 'ArrowUp':
            rotate();
            break;
        case 'Shift':
            holdCurrentPiece();
            break;
        case ' ':
            hardDrop();
            dropCounter = 0;
            break;
    }
});

document.addEventListener('keyup', e => {
    keysPressed[e.key] = false;
    
    if (moveTimers[e.key]) {
        clearTimeout(moveTimers[e.key]);
        clearInterval(moveTimers[e.key]);
        delete moveTimers[e.key];
    }
});

// Event listeners
startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);
continueBtn.addEventListener('click', continueGame);
finishBtn.addEventListener('click', finishGame);
finalRetryBtn.addEventListener('click', startGame);

// Sound toggle buttons - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    const musicBtn = document.getElementById('musicToggle');
    const sfxBtn = document.getElementById('sfxToggle');
    
    if (musicBtn) {
        musicBtn.addEventListener('click', toggleMusic);
    }
    
    if (sfxBtn) {
        sfxBtn.addEventListener('click', toggleSFX);
    }
});

// Initialize game
init();
