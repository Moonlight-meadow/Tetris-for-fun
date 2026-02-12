// Game Constants
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const TARGET_SCORE = 5000;
const LINES_PER_WAVE = 15;
const INITIAL_DROP_INTERVAL = 1000;
const SPEED_INCREASE_PER_WAVE = 50;

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
    lose: document.getElementById('loseSound')
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
    
    // Start menu music
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

// Draw grid lines
function drawGrid() {
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.25)'; // More visible grid
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }
    
    // Draw horizontal lines
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
    
    // Highlight
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fillRect(x * blockSize + 1, y * blockSize + 1, blockSize / 3, blockSize / 3);
    
    // Border
    context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    context.lineWidth = 1;
    context.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
}

function drawBoard() {
    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // ALWAYS draw grid (visible from start)
    drawGrid();
    
    // Draw placed blocks
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

// Get ghost piece Y position
function getGhostY() {
    if (!currentPiece) return 0;
    
    let ghostY = currentPiece.y;
    while (!collide(0, ghostY - currentPiece.y + 1)) {
        ghostY++;
    }
    return ghostY;
}

// Draw highlight beams from current piece to ghost
function drawHighlightBeams() {
    if (!currentPiece) return;
    
    const ghostY = getGhostY();
    
    // Only draw beams if there's a drop distance
    if (ghostY <= currentPiece.y) return;
    
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const blockX = currentPiece.x + x;
                const currentBlockY = currentPiece.y + y;
                const ghostBlockY = ghostY + y;
                
                // Create vertical gradient beam - BRIGHTER colors
                const gradient = ctx.createLinearGradient(
                    blockX * BLOCK_SIZE + BLOCK_SIZE / 2,
                    currentBlockY * BLOCK_SIZE,
                    blockX * BLOCK_SIZE + BLOCK_SIZE / 2,
                    ghostBlockY * BLOCK_SIZE
                );
                
                // Much brighter gradient
                gradient.addColorStop(0, 'rgba(255, 255, 100, 0.5)');
                gradient.addColorStop(0.3, 'rgba(255, 255, 100, 0.3)');
                gradient.addColorStop(0.7, 'rgba(255, 255, 100, 0.2)');
                gradient.addColorStop(1, 'rgba(255, 255, 100, 0.1)');
                
                ctx.fillStyle = gradient;
                
                // Draw beam from bottom of current piece to top of ghost
                const beamHeight = (ghostBlockY - currentBlockY) * BLOCK_SIZE - BLOCK_SIZE;
                if (beamHeight > 0) {
                    ctx.fillRect(
                        blockX * BLOCK_SIZE + 4,
                        currentBlockY * BLOCK_SIZE + BLOCK_SIZE,
                        BLOCK_SIZE - 8,
                        beamHeight
                    );
                    
                    // Add bright glowing edges
                    ctx.strokeStyle = 'rgba(255, 255, 150, 0.6)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(
                        blockX * BLOCK_SIZE + 4,
                        currentBlockY * BLOCK_SIZE + BLOCK_SIZE,
                        BLOCK_SIZE - 8,
                        beamHeight
                    );
                    
                    // Add center highlight line for more visibility
                    ctx.strokeStyle = 'rgba(255, 255, 200, 0.8)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(blockX * BLOCK_SIZE + BLOCK_SIZE / 2, currentBlockY * BLOCK_SIZE + BLOCK_SIZE);
                    ctx.lineTo(blockX * BLOCK_SIZE + BLOCK_SIZE / 2, ghostBlockY * BLOCK_SIZE);
                    ctx.stroke();
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
                
                // Draw outer glow
                ctx.shadowColor = 'rgba(255, 255, 100, 0.8)';
                ctx.shadowBlur = 15;
                
                // Draw ghost block with more visible fill
                ctx.fillStyle = 'rgba(255, 255, 150, 0.15)';
                ctx.fillRect(blockX * BLOCK_SIZE, blockY * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                
                // Reset shadow for border
                ctx.shadowBlur = 0;
                
                // Draw bright border
                ctx.strokeStyle = 'rgba(255, 255, 200, 0.7)';
                ctx.lineWidth = 3;
                ctx.strokeRect(blockX * BLOCK_SIZE + 2, blockY * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
                
                // Add inner border for more definition
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.strokeRect(blockX * BLOCK_SIZE + 5, blockY * BLOCK_SIZE + 5, BLOCK_SIZE - 10, BLOCK_SIZE - 10);
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
    drawHoldPiece();
}

// Music milestone management
function checkMusicMilestones() {
    // At 3000 points - play 2kremaining.mp3
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
    
    // At 4000 points - play 1kremaining.mp3
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
        if (sound.tagName === 'AUDIO' && (sound.id.includes('Music') || sound.id.includes('milestone'))) {
            sound.pause();
            sound.currentTime = 0;
        }
    });
}

// Clear completed lines
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
        score += cleared * 10;
        
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
    }
}

// Drop piece
function drop() {
    currentPiece.y++;
    
    if (collide()) {
        currentPiece.y--;
        merge();
        clearLines();
        
        currentPiece = nextPiece;
        nextPiece = createPiece();
        canHold = true;
        
        drawNextPiece();
        
        if (collide()) {
            gameOver();
        }
    }
}

// Hard drop
function hardDrop() {
    while (!collide(0, 1)) {
        currentPiece.y++;
    }
    
    merge();
    clearLines();
    
    currentPiece = nextPiece;
    nextPiece = createPiece();
    canHold = true;
    
    drawNextPiece();
    
    if (collide()) {
        gameOver();
    }
}

// Move piece
function move(dir) {
    currentPiece.x += dir;
    if (collide()) {
        currentPiece.x -= dir;
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
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Audio play failed:', e));
}

// Game loop
function gameLoop(time = 0) {
    if (!running) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    
    if (dropCounter > dropInterval) {
        drop();
        dropCounter = 0;
    }
    
    drawBoard();
    drawHighlightBeams();  // Draw beams before ghost and current piece
    drawGhostPiece();
    drawPiece();
    
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
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
    
    // Stop ALL music including menu music explicitly
    sounds.menu.pause();
    sounds.menu.currentTime = 0;
    sounds.background.pause();
    sounds.background.currentTime = 0;
    sounds.milestone2k.pause();
    sounds.milestone2k.currentTime = 0;
    sounds.milestone1k.pause();
    sounds.milestone1k.currentTime = 0;
    sounds.win.pause();
    sounds.win.currentTime = 0;
    
    // Start game music
    sounds.background.volume = 0.3;
    sounds.background.loop = true;
    playSound(sounds.background);
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Game over
function gameOver() {
    running = false;
    stopAllMusic();
    
    // If player reached 5000 points but then lost, play win music
    if (hasReachedTarget) {
        playSound(sounds.win);
    } else {
        playSound(sounds.lose);
    }
    
    document.getElementById('finalScore').textContent = `Score: ${score}`;
    gameOverOverlay.classList.remove('hidden');
    gameMessage.textContent = 'Game Over! Try again?';
    
    // Check if score qualifies for leaderboard
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
            gameMessage.textContent = 'Keep going for a higher score!';
            
            // Continue with win music
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
    
    if (!keysPressed[e.key]) {
        keysPressed[e.key] = true;
        
        switch(e.key) {
            case 'ArrowLeft':
                move(-1);
                break;
            case 'ArrowRight':
                move(1);
                break;
            case 'ArrowDown':
                drop();
                dropCounter = 0;
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
    }
});

document.addEventListener('keyup', e => {
    keysPressed[e.key] = false;
});

// Event listeners
startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);
continueBtn.addEventListener('click', continueGame);
finishBtn.addEventListener('click', finishGame);
finalRetryBtn.addEventListener('click', startGame);

// Initialize game
init();
