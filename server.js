// server.js - Tetris Leaderboard with PostgreSQL Database
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_ENTRIES = 10;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database table
async function initializeDatabase() {
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
        
        // Create index for faster queries
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC)
        `);
        
        console.log('✅ Database initialized');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// GET /api/leaderboard - Get top scores
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT name, score, timestamp FROM leaderboard ORDER BY score DESC LIMIT $1',
            [MAX_ENTRIES]
        );
        
        res.json({
            success: true,
            scores: result.rows
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
        
        // Insert new score
        const timestamp = Date.now();
        await pool.query(
            'INSERT INTO leaderboard (name, score, timestamp) VALUES ($1, $2, $3)',
            [name.substring(0, 20), score, timestamp]
        );
        
        // Get updated leaderboard
        const result = await pool.query(
            'SELECT name, score, timestamp FROM leaderboard ORDER BY score DESC LIMIT $1',
            [MAX_ENTRIES]
        );
        
        // Find rank
        const rank = result.rows.findIndex(entry => 
            entry.score === score && entry.timestamp === timestamp.toString()
        ) + 1;
        
        // Clean up old entries (keep only top MAX_ENTRIES)
        await pool.query(`
            DELETE FROM leaderboard 
            WHERE id NOT IN (
                SELECT id FROM leaderboard 
                ORDER BY score DESC 
                LIMIT $1
            )
        `, [MAX_ENTRIES]);
        
        res.json({
            success: true,
            rank: rank || result.rows.length + 1,
            scores: result.rows
        });
        
    } catch (error) {
        console.error('Error saving score:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save score'
        });
    }
});

// GET /api/stats - Get leaderboard statistics
app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_scores,
                MAX(score) as highest_score,
                AVG(score)::INTEGER as average_score
            FROM leaderboard
        `);
        
        res.json({
            success: true,
            stats: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get stats'
        });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'ok', 
            timestamp: Date.now(),
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            timestamp: Date.now(),
            database: 'disconnected'
        });
    }
});

// Start server
async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`🎮 Tetris Leaderboard Server running on port ${PORT}`);
        console.log(`📊 Using PostgreSQL database for permanent storage`);
    });
}

startServer();

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await pool.end();
    process.exit(0);
});
