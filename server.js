// server.js - Tetris Leaderboard with Database + In-Memory Fallback
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_ENTRIES = 10;

// In-memory fallback storage
let memoryLeaderboard = [];
let usingDatabase = false;

// Database connection (only if DATABASE_URL exists)
let pool = null;

if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('📊 Database URL found, attempting connection...');
} else {
    console.log('⚠️  No DATABASE_URL found, using in-memory storage');
}

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database table
async function initializeDatabase() {
    if (!pool) {
        console.log('💾 Using in-memory storage (scores will reset on restart)');
        return;
    }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                id SERIAL PRIMARY KEY,
                name VARCHAR(20) NOT NULL,
                score INTEGER NOT NULL,
                timestamp BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC)
        `);
        
        usingDatabase = true;
        console.log('✅ PostgreSQL database connected and initialized');
    } catch (error) {
        console.error('❌ Database error, falling back to memory:', error.message);
        usingDatabase = false;
        pool = null;
    }
}

// GET /api/leaderboard - Get top scores
app.get('/api/leaderboard', async (req, res) => {
    try {
        let scores = [];

        if (usingDatabase && pool) {
            try {
                const result = await pool.query(
                    'SELECT name, score, timestamp FROM leaderboard ORDER BY score DESC LIMIT $1',
                    [MAX_ENTRIES]
                );
                scores = result.rows.map(row => ({
                    name: row.name,
                    score: row.score,
                    timestamp: parseInt(row.timestamp)
                }));
            } catch (error) {
                console.error('Database read error, using memory:', error.message);
                scores = memoryLeaderboard;
            }
        } else {
            scores = memoryLeaderboard;
        }
        
        res.json({
            success: true,
            scores: scores,
            storage: usingDatabase ? 'database' : 'memory'
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
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
        
        const timestamp = Date.now();
        const newEntry = {
            name: name.substring(0, 20),
            score: score,
            timestamp: timestamp
        };

        let scores = [];
        let rank = 0;

        if (usingDatabase && pool) {
            try {
                // Save to database
                await pool.query(
                    'INSERT INTO leaderboard (name, score, timestamp) VALUES ($1, $2, $3)',
                    [newEntry.name, newEntry.score, newEntry.timestamp]
                );
                
                // Get updated leaderboard
                const result = await pool.query(
                    'SELECT name, score, timestamp FROM leaderboard ORDER BY score DESC LIMIT $1',
                    [MAX_ENTRIES]
                );
                
                scores = result.rows.map(row => ({
                    name: row.name,
                    score: row.score,
                    timestamp: parseInt(row.timestamp)
                }));
                
                // Clean up old entries
                await pool.query(`
                    DELETE FROM leaderboard 
                    WHERE id NOT IN (
                        SELECT id FROM leaderboard 
                        ORDER BY score DESC 
                        LIMIT $1
                    )
                `, [MAX_ENTRIES]);
                
            } catch (error) {
                console.error('Database write error, using memory:', error.message);
                usingDatabase = false;
                // Fall through to memory storage
            }
        }
        
        if (!usingDatabase) {
            // Use memory storage
            memoryLeaderboard.push(newEntry);
            memoryLeaderboard.sort((a, b) => b.score - a.score);
            memoryLeaderboard = memoryLeaderboard.slice(0, MAX_ENTRIES);
            scores = memoryLeaderboard;
        }
        
        // Find rank
        rank = scores.findIndex(entry => 
            entry.score === score && entry.timestamp === timestamp
        ) + 1;
        
        res.json({
            success: true,
            rank: rank || scores.length + 1,
            scores: scores,
            storage: usingDatabase ? 'database' : 'memory'
        });
        
    } catch (error) {
        console.error('Error saving score:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save score'
        });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    let dbStatus = 'not configured';
    
    if (pool) {
        try {
            await pool.query('SELECT 1');
            dbStatus = 'connected';
        } catch (error) {
            dbStatus = 'error: ' + error.message;
        }
    }
    
    res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        database: dbStatus,
        storage: usingDatabase ? 'database' : 'memory'
    });
});

// Start server
async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`🎮 Tetris Leaderboard Server running on port ${PORT}`);
        console.log(`📊 Storage mode: ${usingDatabase ? 'PostgreSQL (permanent)' : 'Memory (temporary)'}`);
    });
}

startServer();

process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    if (pool) await pool.end();
    process.exit(0);
});
