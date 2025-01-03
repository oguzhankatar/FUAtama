const express = require('express');
const router = express.Router();
const LctrData = require('../models/LctrData');

// Get final exam data
router.get('/data', async (req, res) => {
    try {
        const data = await LctrData.findOne().sort({ uploadDate: -1 });
        if (!data) {
            return res.status(404).json({ message: 'Veri bulunamadı' });
        }
        res.json(data);
    } catch (error) {
        console.error('Final data fetch error:', error);
        res.status(500).json({ message: 'Veri alınırken bir hata oluştu' });
    }
});

module.exports = router;
