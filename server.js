// server.js - Tetris Global Leaderboard Backend
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');
const MAX_ENTRIES = 10;

// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies

// Initialize leaderboard file if it doesn't exist
async function initializeLeaderboard() {
    try {
        await fs.access(LEADERBOARD_FILE);
    } catch {
        await fs.writeFile(LEADERBOARD_FILE, JSON.stringify([]));
        console.log('Created new leaderboard file');
    }
}

// Read leaderboard
async function readLeaderboard() {
    try {
        const data = await fs.readFile(LEADERBOARD_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading leaderboard:', error);
        return [];
    }
}

// Write leaderboard
async function writeLeaderboard(data) {
    try {
        await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing leaderboard:', error);
        throw error;
    }
}

// GET /api/leaderboard - Get top scores
app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await readLeaderboard();
        res.json({
            success: true,
            scores: leaderboard
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load leaderboard'
        });
    }
});

// POST /api/leaderboard - Submit new score
app.post('/api/leaderboard', async (req, res) => {
    try {
        const { name, score } = req.body;
        
        // Validate input
        if (!name || typeof score !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'Invalid name or score'
            });
        }
        
        if (score <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Score must be positive'
            });
        }
        
        // Read current leaderboard
        let leaderboard = await readLeaderboard();
        
        // Add new entry
        const newEntry = {
            name: name.substring(0, 20), // Limit name length
            score: score,
            timestamp: Date.now()
        };
        
        leaderboard.push(newEntry);
        
        // Sort by score (highest first)
        leaderboard.sort((a, b) => b.score - a.score);
        
        // Keep only top entries
        leaderboard = leaderboard.slice(0, MAX_ENTRIES);
        
        // Save
        await writeLeaderboard(leaderboard);
        
        // Find rank
        const rank = leaderboard.findIndex(entry => 
            entry.score === score && entry.timestamp === newEntry.timestamp
        ) + 1;
        
        res.json({
            success: true,
            rank: rank,
            scores: leaderboard
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to save score'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
async function startServer() {
    await initializeLeaderboard();
    app.listen(PORT, () => {
        console.log(`🎮 Tetris Leaderboard Server running on port ${PORT}`);
        console.log(`📊 Leaderboard API: http://localhost:${PORT}/api/leaderboard`);
    });
}

startServer();
