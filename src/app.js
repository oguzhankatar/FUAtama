const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('./config/passport');
const { ensureAuth } = require('./middleware/auth');
const { hasPagePermission } = require('./middleware/pageAuth');
const connectDB = require('./config/db');
const authConfig = require('./config/auth');
const excelRoutes = require('./routes/excelRoutes');
const tempRoutes = require('./routes/tempRoutes');
const mergeRoutes = require('./routes/mergeRoutes');
const autoMergeRoutes = require('./routes/autoMergeRoutes');
const sorunluRoutes = require('./routes/sorunluRoutes');
const gozetmenRoutes = require('./routes/gozetmenRoutes');
const lctrRoutes = require('./routes/lctrRoutes');
const lctrVizRoutes = require('./routes/lctrVizRoutes');
const vizRoutes = require('./routes/vizRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const fakulteRoutes = require('./routes/fakulteRoutes');
const sinifRoutes = require('./routes/sinifRoutes');
const activePeriodRoutes = require('./routes/activePeriodRoutes');
const atamaRoutes = require('./routes/atamaRoutes');
const reportRoutes = require('./routes/reportRoutes');
const analysisRoutes = require('./routes/analysisRoutes.js');
const examDateRoutes = require('./routes/examDateRoutes');

const app = express();

// Connect Database
connectDB();

// Basic middleware
app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: true }));

// Session and authentication middleware
app.use(session(authConfig.session));
app.use(passport.initialize());
app.use(passport.session());

// Serve public assets without authentication
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// Auth ve Personnel routes
const authRoutes = require('./routes/authRoutes');
const personnelRoutes = require('./routes/personnelRoutes');

app.use('/', authRoutes);
app.use('/api/personnel', personnelRoutes);

// Serve personnel.html for admin users
app.get('/personnel.html', ensureAuth, hasPagePermission('/personnel'), async (req, res, next) => {
    try {
        const Personnel = require('./models/Personnel');
        const personnel = await Personnel.findOne({ email: req.user.email });
        
        if (!personnel || personnel.role !== 'admin') {
            return res.redirect('/dashboard');
        }
        
        res.sendFile(path.join(__dirname, 'public', 'personnel.html'));
    } catch (error) {
        next(error);
    }
});

// Auth status endpoint'ini güncelle
app.get('/auth/status', async (req, res) => {
    try {
        // Clear response caching
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        
        if (!req.isAuthenticated()) {
            console.log('User not authenticated');
            return res.json({ authenticated: false, user: null });
        }

        console.log('Session user:', JSON.stringify(req.user, null, 2));
        console.log('Session ID:', req.sessionID);

        // Get fresh user data from database
        const Personnel = require('./models/Personnel');
        const personnel = await Personnel.findOne({ email: req.user.email });

        if (!personnel) {
            console.log('Personnel not found for email:', req.user.email);
            return res.json({ authenticated: false, user: null });
        }

        // Force role to be a string
        const role = String(personnel.role).toLowerCase();
        const isAdmin = role === 'admin';

        console.log('Auth status check for:', {
            email: personnel.email,
            role: role,
            isAdmin: isAdmin,
            active: personnel.active,
            name: personnel.name,
            _id: personnel._id
        });

        const userData = {
            authenticated: true,
            user: {
                displayName: personnel.name,
                email: personnel.email,
                image: req.user.image,
                role: role,
                isAdmin: isAdmin,
                pagePermissions: personnel.pagePermissions || []
            }
        };

        console.log('Sending auth status response:', JSON.stringify(userData, null, 2));
        res.json(userData);
    } catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Root route - serve login page or redirect to dashboard
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Dashboard routes
app.get('/dashboard', ensureAuth, hasPagePermission('/dashboard'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard.html', ensureAuth, hasPagePermission('/dashboard'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Protected page routes with permission checks
app.get('/data.html', ensureAuth, hasPagePermission('/data'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'data.html'));
});

app.get('/gozetmen.html', ensureAuth, hasPagePermission('/gozetmen'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'gozetmen.html'));
});

app.get('/atama.html', ensureAuth, hasPagePermission('/atama'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'atama.html'));
});

app.get('/calendar.html', ensureAuth, hasPagePermission('/calendar'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'calendar.html'));
});

app.get('/report.html', ensureAuth, hasPagePermission('/report'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

app.get('/fakulte.html', ensureAuth, hasPagePermission('/fakulte'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'fakulte.html'));
});

app.get('/viz.html', ensureAuth, hasPagePermission('/viz'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'viz.html'));
});

app.get('/lctr.html', ensureAuth, hasPagePermission('/lctr'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lctr.html'));
});

app.get('/temp.html', ensureAuth, hasPagePermission('/temp'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'temp.html'));
});

app.get('/gruplandir.html', ensureAuth, hasPagePermission('/gruplandir'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'gruplandir.html'));
});

app.get('/otogruplandir.html', ensureAuth, hasPagePermission('/otogruplandir'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'otogruplandir.html'));
});

app.get('/sorunlular.html', ensureAuth, hasPagePermission('/sorunlular'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sorunlular.html'));
});

app.get('/classReport.html', ensureAuth, hasPagePermission('/classReport'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'classReport.html'));
});

app.get('/supervisorReport.html', ensureAuth, hasPagePermission('/supervisorReport'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'supervisorReport.html'));
});

app.get('/activePeriod.html', ensureAuth, hasPagePermission('/activePeriod'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'activePeriod.html'));
});

app.get('/analiz.html', ensureAuth, hasPagePermission('/analiz'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'analiz.html'));
});

app.get('/exam-dates.html', ensureAuth, hasPagePermission('/exam-dates'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'exam-dates.html'));
});

// All other static files require authentication
app.use('/', ensureAuth, express.static(path.join(__dirname, 'public'), {
    index: false // Disable automatic serving of index.html
}));

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
});

// Protected API Routes
app.use('/api/excel', ensureAuth, excelRoutes);
app.use('/api/temp', ensureAuth, tempRoutes);
app.use('/api/merge', ensureAuth, mergeRoutes);
app.use('/api/automerge', ensureAuth, autoMergeRoutes);
app.use('/api/sorunlu', ensureAuth, sorunluRoutes);
app.use('/api/gozetmen', ensureAuth, gozetmenRoutes);
app.use('/api/lctr', ensureAuth, lctrRoutes);
app.use('/api/lctrviz', ensureAuth, lctrVizRoutes);
app.use('/api/viz', ensureAuth, vizRoutes);
app.use('/api/sinifs', ensureAuth, sinifRoutes);
app.use('/', ensureAuth, calendarRoutes);
app.use('/', ensureAuth, fakulteRoutes);
app.use('/api', ensureAuth, activePeriodRoutes);
app.use('/api/atama', ensureAuth, atamaRoutes);
app.use('/api/report', ensureAuth, reportRoutes);
app.use('/api/analysis', ensureAuth, analysisRoutes);
app.use('/api', ensureAuth, examDateRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

module.exports = app;
