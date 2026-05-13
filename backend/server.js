const express = require('express');
const mongoose = require('mongoose'); // Re-triggered restart for enum update
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const app = express();

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Server is up and running' });
});

// Load env vars
dotenv.config();

// Connect to database
const startServer = async () => {
    try {
        await connectDB();
        
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Redirecting to frontend at: ${process.env.FRONTEND_URL}`);
            
            // Start simulation engine
            const { startSimulation } = require('./services/simulationEngine');
            startSimulation();
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'],
    credentials: true,
}));

// Initialize Passport
app.use(passport.initialize());
require('./config/passport')(passport);

// Route files
const authRoutes = require('./routes/auth');
const blockRoutes = require('./routes/blocks');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const requestRoutes = require('./routes/requests');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/requests', requestRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: err.message || 'Server Error' 
    });
});

// Start server
startServer();


