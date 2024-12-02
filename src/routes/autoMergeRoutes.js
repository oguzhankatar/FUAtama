const express = require('express');
const router = express.Router();
const LctrData = require('../models/LctrData');

// Helper function to check if two cards have common students
function hasCommonStudents(card1, card2) {
    if (!card1.ogrenciler || !card2.ogrenciler) return false;
    return card1.ogrenciler.some(student => card2.ogrenciler.includes(student));
}

// Helper function to calculate total students in a group
function getTotalStudents(cards) {
    return cards.reduce((sum, card) => sum + (card.ogrenciler ? card.ogrenciler.length : 0), 0);
}

// Helper function to find compatible groups
function findCompatibleGroups(cards, maxStudents = 40) {
    const groups = [];
    const used = new Set();

    // Sort cards by student count in descending order for better grouping
    const sortedCards = [...cards].sort((a, b) => {
        const aCount = a.ogrenciler ? a.ogrenciler.length : 0;
        const bCount = b.ogrenciler ? b.ogrenciler.length : 0;
        return bCount - aCount;
    });

    for (let i = 0; i < sortedCards.length; i++) {
        if (used.has(sortedCards[i].dkodu)) continue;

        const currentGroup = [sortedCards[i]];
        used.add(sortedCards[i].dkodu);

        for (let j = i + 1; j < sortedCards.length; j++) {
            const card = sortedCards[j];
            if (used.has(card.dkodu)) continue;

            // Check if card can be added to current group
            const canAdd = currentGroup.every(groupCard => !hasCommonStudents(groupCard, card));
            const totalStudentsAfterAdd = getTotalStudents(currentGroup) + (card.ogrenciler ? card.ogrenciler.length : 0);

            if (canAdd && totalStudentsAfterAdd <= maxStudents) {
                currentGroup.push(card);
                used.add(card.dkodu);
            }
        }

        if (currentGroup.length > 1) {
            groups.push(currentGroup);
        }
    }

    return groups;
}

router.get('/preview', async (req, res) => {
    try {
        // Get the latest data
        const latestData = await LctrData.findOne().sort({ uploadDate: -1 });
        if (!latestData) {
            return res.status(404).json({ success: false, message: 'No data found' });
        }

        // Filter cards with less than 40 students
        const eligibleCards = latestData.data.filter(card => {
            const studentCount = card.ogrenciler ? card.ogrenciler.length : 0;
            return studentCount < 40;
        });

        // Find optimal groups
        const suggestedGroups = findCompatibleGroups(eligibleCards);

        res.json({ 
            success: true, 
            groups: suggestedGroups,
            originalCards: eligibleCards
        });
    } catch (error) {
        console.error('Auto-merge preview error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/apply', async (req, res) => {
    try {
        const { groups } = req.body;
        const latestData = await LctrData.findOne().sort({ uploadDate: -1 });
        
        if (!latestData) {
            return res.status(404).json({ success: false, message: 'No data found' });
        }

        // Find all documents that have GRP codes to get next number
        const allLctrData = await LctrData.find({
            'data.dkodu': { $regex: '^GRP' }
        });

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

        // Process each group
        for (const group of groups) {
            const dkodu = `GRP${String(nextNumber++).padStart(3, '0')}`;
            const totalKontenjan = group.reduce((sum, card) => sum + parseInt(card.kon), 0);
            const allOgrenciler = group.reduce((acc, card) => {
                return acc.concat(card.ogrenciler || []);
            }, []);
            const dadiWithCounts = group.map(card => {
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
            const dkoduList = group.map(card => card.dkodu);

            // Remove the original records
            latestData.data = latestData.data.filter(item => !dkoduList.includes(item.dkodu));
            
            // Add the merged record
            latestData.data.push(mergedRecord);
        }

        // Save the updated document
        await latestData.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Auto-merge apply error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
