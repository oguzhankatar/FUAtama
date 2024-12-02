const express = require('express');
const router = express.Router();
const LctrData = require('../models/LctrData');

router.post('/merge', async (req, res) => {
    try {
        const { cards } = req.body;
        
        // Find all documents that have GRP codes
        const allLctrData = await LctrData.find({
            'data.dkodu': { $regex: '^GRP' }
        });

        // Find the highest GRP number across all documents and all data items
        let nextNumber = 1;
        if (allLctrData.length > 0) {
            let maxNumber = 0;
            allLctrData.forEach(doc => {
                doc.data.forEach(item => {
                    if (item.dkodu && item.dkodu.startsWith('GRP')) {
                        const currentNumber = parseInt(item.dkodu.substring(3));
                        if (currentNumber > maxNumber) {
                            maxNumber = currentNumber;
                        }
                    }
                });
            });
            nextNumber = maxNumber + 1;
        }

        // Format the number with leading zeros
        const dkodu = `GRP${String(nextNumber).padStart(3, '0')}`;

        // Calculate total kontenjan
        const totalKontenjan = cards.reduce((sum, card) => sum + parseInt(card.kon), 0);

        // Combine all students into a single array
        const allOgrenciler = cards.reduce((acc, card) => {
            return acc.concat(card.ogrenciler || []);
        }, []);

        // Create dadi array with student counts
        const dadiWithCounts = cards.map(card => {
            const studentCount = card.ogrenciler ? card.ogrenciler.length : 0;
            return `${card.dadi} (${studentCount})`;
        });

        // Create merged record
        const mergedRecord = {
            dkodu: dkodu,
            sube: 'X',
            dadi: dadiWithCounts,
            program: 'GRP',
            kon: totalKontenjan,
            ogrenciler: allOgrenciler
        };

        // Get the dkodu values of cards to be merged
        const dkoduList = cards.map(card => card.dkodu);

        // Find the latest LctrData
        const latestLctrData = await LctrData.findOne().sort({ uploadDate: -1 });

        if (latestLctrData) {
            // Remove the original records
            latestLctrData.data = latestLctrData.data.filter(item => !dkoduList.includes(item.dkodu));
            
            // Add the merged record
            latestLctrData.data.push(mergedRecord);
            
            // Save the updated document
            await latestLctrData.save();
        }

        res.json({ success: true, mergedRecord });
    } catch (error) {
        console.error('Merge error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
