const express = require('express');
const router = express.Router();
const LctrData = require('../models/LctrData');
const Sorunlu = require('../models/Sorunlu');

// Save cards to sorunlu collection
router.post('/', async (req, res) => {
    try {
        const cardsToSave = req.body;
        
        // Create new sorunlu document
        const sorunluDoc = new Sorunlu({
            data: cardsToSave
        });
        
        await sorunluDoc.save();
        
        res.status(200).json({ message: 'Kartlar başarıyla kaydedildi' });
    } catch (error) {
        console.error('Sorunlu kartları kaydetme hatası:', error);
        res.status(500).json({ message: 'Kartlar kaydedilirken bir hata oluştu' });
    }
});

// Delete selected cards from lctrdata
router.delete('/delete-cards/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { indices } = req.body;

        // Get the current document
        const lctrDoc = await LctrData.findById(id);
        if (!lctrDoc) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Sort indices in descending order to remove from end to start
        const sortedIndices = indices.sort((a, b) => b - a);

        // Remove cards at specified indices
        sortedIndices.forEach(index => {
            if (index >= 0 && index < lctrDoc.data.length) {
                lctrDoc.data.splice(index, 1);
            }
        });

        // Save the updated document
        await lctrDoc.save();

        res.status(200).json({ message: 'Kartlar başarıyla silindi' });
    } catch (error) {
        console.error('Kart silme hatası:', error);
        res.status(500).json({ message: 'Kartlar silinirken bir hata oluştu' });
    }
});

module.exports = router;
