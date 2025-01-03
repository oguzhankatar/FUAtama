const express = require('express');
const router = express.Router();
const Sinifs = require('../models/Sinifs');

// GET /api/sinifs - Tüm sınıfları getir
router.get('/', async (req, res) => {
    try {
        const siniflar = await Sinifs.find().sort({ name: 1 });
        res.json(siniflar);
    } catch (error) {
        console.error('Sınıf getirme hatası:', error);
        res.status(500).json({ 
            message: 'Sınıflar getirilirken hata oluştu',
            error: error.message 
        });
    }
});

module.exports = router;