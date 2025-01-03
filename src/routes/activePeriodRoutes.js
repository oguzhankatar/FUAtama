const express = require('express');
const ActivePeriod = require('../models/activePeriod');

const router = express.Router();

// Get active period
router.get('/active-period', async (req, res) => {
    try {
        const activePeriod = await ActivePeriod.findOne({ isActive: true });
        res.json(activePeriod);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Set active period
router.post('/active-period', async (req, res) => {
    try {
        const { startDate, endDate } = req.body;

        // Deactivate all existing periods
        await ActivePeriod.updateMany({}, { isActive: false });

        // Create new active period
        const activePeriod = new ActivePeriod({
            startDate,
            endDate,
            isActive: true
        });

        await activePeriod.save();
        res.status(201).json(activePeriod);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
