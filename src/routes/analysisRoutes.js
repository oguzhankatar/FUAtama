const express = require('express');
const Gozetmen = require('../models/Gozetmen');
const ActivePeriod = require('../models/activePeriod');
const { isAuth } = require('../middleware/auth');

const router = express.Router();

// Gözetmen analiz verilerini getir
router.get('/supervisors', async (req, res) => {
    try {
        const gozetmenler = await Gozetmen.find()
            .populate('assignments')
            .select('blm ad kisa assignments')
            .sort({ ad: 1 });

        const activePeriods = await ActivePeriod.find()
            .sort({ date: 1 });

        res.json({
            gozetmenler,
            activePeriods
        });
    } catch (error) {
        console.error('Analysis data fetch error:', error);
        res.status(500).json({ error: 'Veri getirme hatası' });
    }
});

module.exports = router;
