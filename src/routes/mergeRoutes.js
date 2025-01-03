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

        // Get the dkodu values and full card data of cards to be merged
        const dkoduList = cards.map(card => card.dkodu);
        const originalCards = cards.map(card => ({
            dkodu: card.dkodu,
            sube: card.sube,
            dadi: card.dadi,
            program: card.program,
            kon: card.kon,
            ogrenciler: card.ogrenciler || []
        }));

        // Get instructor information from original cards
        const instructorInfo = cards.map(card => ({
            dkodu: card.dkodu,
            hoca: card.hoca || '',  // Store instructor info for each course
            sube: card.sube
        }));

        // Create merged record with original card data and instructor info
        const mergedRecord = {
            dkodu: dkodu,
            sube: 'X',
            dadi: dadiWithCounts,
            program: 'GRP',
            kon: totalKontenjan,
            ogrenciler: allOgrenciler,
            originalCards: originalCards,  // Store complete original card data
            instructors: instructorInfo    // Store instructor information
        };

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

// New route to ungroup courses
router.post('/ungroup', async (req, res) => {
    try {
        const { groupDkodu } = req.body;

        // Find the latest LctrData
        const latestLctrData = await LctrData.findOne().sort({ uploadDate: -1 });

        if (!latestLctrData) {
            throw new Error('No data found');
        }

        // Find the grouped record
        const groupedRecord = latestLctrData.data.find(item => item.dkodu === groupDkodu);

        if (!groupedRecord) {
            throw new Error('Grouped record not found');
        }

        if (!groupedRecord.originalCards) {
            throw new Error('Original course data not found');
        }

        // Remove the grouped record
        latestLctrData.data = latestLctrData.data.filter(item => item.dkodu !== groupDkodu);

        // Restore original records with instructor information
        const originalRecordsWithInstructors = groupedRecord.originalCards.map(card => {
            const instructorInfo = groupedRecord.instructors.find(i => i.dkodu === card.dkodu);
            return {
                ...card,
                hoca: instructorInfo ? instructorInfo.hoca : ''
            };
        });

        // Add back the original records with instructor information
        latestLctrData.data.push(...originalRecordsWithInstructors);

        // Save the updated document
        await latestLctrData.save();

        res.json({ success: true, originalCards: groupedRecord.originalCards });
    } catch (error) {
        console.error('Ungroup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
