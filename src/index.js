const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/lctr', require('./routes/lctrRoutes'));
app.use('/api/merge', require('./routes/mergeRoutes'));
app.use('/api/final', require('./routes/finalRoutes'));
app.use('/api/atama', require('./routes/atamaRoutes'));
app.use('/api/gozetmen', require('./routes/gozetmenRoutes'));
app.use('/api/fakulte', require('./routes/fakulteRoutes'));
app.use('/api/report', require('./routes/reportRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/personnel', require('./routes/personnelRoutes'));
app.use('/api/sorunlu', require('./routes/sorunluRoutes'));
app.use('/api/activePeriod', require('./routes/activePeriodRoutes'));

// Serve static files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
