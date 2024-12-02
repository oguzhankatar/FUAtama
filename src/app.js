const express = require('express');
const path = require('path');
const connectDB = require('./config/db');
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

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Define Routes
app.use('/api/excel', excelRoutes);
app.use('/api/temp', tempRoutes);
app.use('/api/merge', mergeRoutes);
app.use('/api/automerge', autoMergeRoutes);
app.use('/api/sorunlu', sorunluRoutes);
app.use('/api/gozetmen', gozetmenRoutes);
app.use('/api/lctr', lctrRoutes);
app.use('/api/lctrviz', lctrVizRoutes);
app.use('/api/viz', vizRoutes);
app.use('/', calendarRoutes);
app.use('/', fakulteRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

module.exports = app;
