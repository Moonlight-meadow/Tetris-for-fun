// server.js - Tetris Global Leaderboard Backend with Weekly Reset
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');
const ARCHIVE_DIR = path.join(__dirname, 'archives');
const MAX_ENTRIES = 10;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Middleware
app.use(cors());
app.use(express.json());

// Initialize leaderboard and archive directory
async function initializeLeaderboard() {
    try {
        // Create archives directory if it doesn't exist
        await fs.mkdir(ARCHIVE_DIR, { recursive: true });
    } catch (error) {
        console.log('Archives directory already exists');
    }
    
    try {
        await fs.access(LEADERBOARD_FILE);
        console.log('Leaderboard file exists');
        
        // Check if we need to reset the leaderboard
        await checkAndResetWeekly();
    } catch {
        // Create new leaderboard with metadata
        const newLeaderboard = {
            weekStartDate: Date.now(),
            scores: []
        };
        await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(newLeaderboard, null, 2));
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
        return { weekStartDate: Date.now(), scores: [] };
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

// Archive old leaderboard
async function archiveLeaderboard(leaderboardData) {
    try {
        const weekStart = new Date(leaderboardData.weekStartDate);
        const archiveFileName = `leaderboard_${weekStart.toISOString().split('T')[0]}.json`;
        const archivePath = path.join(ARCHIVE_DIR, archiveFileName);
        
        await fs.writeFile(archivePath, JSON.stringify(leaderboardData, null, 2));
        console.log(`📦 Archived leaderboard to ${archiveFileName}`);
    } catch (error) {
        console.error('Error archiving leaderboard:', error);
    }
}

// Check if week has passed and reset if needed
async function checkAndResetWeekly() {
    const leaderboard = await readLeaderboard();
    const currentTime = Date.now();
    const weekStart = leaderboard.weekStartDate || currentTime;
    const timeSinceStart = currentTime - weekStart;
    
    if (timeSinceStart >= WEEK_IN_MS) {
        console.log('🔄 Week has passed, resetting leaderboard...');
        
        // Archive the old leaderboard
        if (leaderboard.scores && leaderboard.scores.length > 0) {
            await archiveLeaderboard(leaderboard);
        }
        
        // Create new leaderboard
        const newLeaderboard = {
            weekStartDate: currentTime,
            scores: []
        };
        
        await writeLeaderboard(newLeaderboard);
        console.log('✅ Leaderboard reset for new week!');
    } else {
        const daysLeft = Math.ceil((WEEK_IN_MS - timeSinceStart) / (24 * 60 * 60 * 1000));
        console.log(`📅 ${daysLeft} days left until weekly reset`);
    }
}

// GET /api/leaderboard - Get top scores
app.get('/api/leaderboard', async (req, res) => {
    try {
        // Check if reset is needed before sending data
        await checkAndResetWeekly();
        
        const leaderboard = await readLeaderboard();
        
        res.json({
            success: true,
            scores: leaderboard.scores || [],
            weekStartDate: leaderboard.weekStartDate,
            daysUntilReset: Math.ceil((WEEK_IN_MS - (Date.now() - leaderboard.weekStartDate)) / (24 * 60 * 60 * 1000))
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
        
        // Check if reset is needed
        await checkAndResetWeekly();
        
        // Read current leaderboard
        let leaderboard = await readLeaderboard();
        let scores = leaderboard.scores || [];
        
        // Add new entry
        const newEntry = {
            name: name.substring(0, 20),
            score: score,
            timestamp: Date.now()
        };
        
        scores.push(newEntry);
        
        // Sort by score (highest first)
        scores.sort((a, b) => b.score - a.score);
        
        // Keep only top entries
        scores = scores.slice(0, MAX_ENTRIES);
        
        // Update leaderboard
        leaderboard.scores = scores;
        
        // Save
        await writeLeaderboard(leaderboard);
        
        // Find rank
        const rank = scores.findIndex(entry => 
            entry.score === score && entry.timestamp === newEntry.timestamp
        ) + 1;
        
        res.json({
            success: true,
            rank: rank,
            scores: scores,
            weekStartDate: leaderboard.weekStartDate,
            daysUntilReset: Math.ceil((WEEK_IN_MS - (Date.now() - leaderboard.weekStartDate)) / (24 * 60 * 60 * 1000))
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to save score'
        });
    }
});

// GET /api/archives - Get list of archived leaderboards
app.get('/api/archives', async (req, res) => {
    try {
        const files = await fs.readdir(ARCHIVE_DIR);
        const archives = files
            .filter(file => file.startsWith('leaderboard_') && file.endsWith('.json'))
            .sort()
            .reverse();
        
        res.json({
            success: true,
            archives: archives
        });
    } catch (error) {
        res.json({
            success: true,
            archives: []
        });
    }
});

// GET /api/archives/:filename - Get specific archived leaderboard
app.get('/api/archives/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        
        // Security: prevent directory traversal
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid filename'
            });
        }
        
        const archivePath = path.join(ARCHIVE_DIR, filename);
        const data = await fs.readFile(archivePath, 'utf8');
        const archive = JSON.parse(data);
        
        res.json({
            success: true,
            archive: archive
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            error: 'Archive not found'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        message: 'Weekly leaderboard system active'
    });
});

// Start server
async function startServer() {
    await initializeLeaderboard();
    app.listen(PORT, () => {
        console.log(`🎮 Tetris Weekly Leaderboard Server running on port ${PORT}`);
        console.log(`📊 Leaderboard API: http://localhost:${PORT}/api/leaderboard`);
        console.log(`📦 Archives API: http://localhost:${PORT}/api/archives`);
    });
}

startServer();
