const express = require('express');
const router = express.Router();
const LctrData = require('../models/LctrData');

// Get data with dkodu and kon columns, sorted by kon in descending order
router.get('/data', async (req, res) => {
    try {
        const lastData = await LctrData.findOne().sort({ uploadDate: -1 });
        
        if (!lastData || !lastData.data || lastData.data.length === 0) {
            return res.json({ data: [] });
        }

        // Extract only dkodu and kon values
        const formattedData = lastData.data.map(item => ({
            dkodu: item.dkodu,
            kon: parseInt(item.kon) || 0 // Convert kon to number, default to 0 if invalid
        }));

        // Sort by kon value in descending order
        formattedData.sort((a, b) => b.kon - a.kon);

        res.json({ data: formattedData });
    } catch (error) {
        console.error('Veri getirme hatası:', error);
        res.status(500).json({ 
            error: 'Veriler alınırken bir hata oluştu',
            details: error.message 
        });
    }
});

module.exports = router;
