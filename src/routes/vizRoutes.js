const express = require('express');
const router = express.Router();
const TempData = require('../models/TempData');

// Mevcut sütunları getir
router.get('/columns', async (req, res) => {
    try {
        console.log('Sütunlar getiriliyor...');
        
        // En son yüklenen veriyi al
        const lastData = await TempData.findOne().sort({ uploadDate: -1 });
        console.log('Son veri bulundu:', lastData ? 'Evet' : 'Hayır');
        
        if (!lastData) {
            console.log('Veri bulunamadı');
            return res.json([]);
        }

        if (!lastData.data || lastData.data.length === 0) {
            console.log('Veri array\'i boş');
            return res.json([]);
        }

        console.log('İlk kayıt:', lastData.data[0]);
        
        // İlk satırdan sütun isimlerini al
        const columns = Object.keys(lastData.data[0]);
        console.log('Bulunan sütunlar:', columns);
        
        res.json(columns);
    } catch (error) {
        console.error('Sütunları getirirken hata:', error);
        res.status(500).json({ 
            error: 'Sütunlar alınırken bir hata oluştu',
            details: error.message 
        });
    }
});

// Seçilen sütun için analiz yap
router.post('/analyze', async (req, res) => {
    try {
        console.log('Analiz başlatılıyor...');
        const { column } = req.body;
        
        if (!column) {
            console.log('Sütun adı eksik');
            return res.status(400).json({ error: 'Sütun adı gerekli' });
        }

        console.log('Seçilen sütun:', column);

        // En son yüklenen veriyi al
        const lastData = await TempData.findOne().sort({ uploadDate: -1 });
        console.log('Son veri bulundu:', lastData ? 'Evet' : 'Hayır');
        
        if (!lastData || !lastData.data || lastData.data.length === 0) {
            console.log('Veri bulunamadı veya boş');
            return res.json({ uniqueCount: 0, uniqueValues: [] });
        }

        // Seçilen sütundaki unique değerleri ve sayılarını hesapla
        const valueMap = new Map();
        lastData.data.forEach(item => {
            const value = item[column];
            valueMap.set(value, (valueMap.get(value) || 0) + 1);
        });

        // Değerleri ve frekanslarını diziye dönüştür
        const uniqueValues = Array.from(valueMap.entries()).map(([value, count]) => ({
            value: value === null || value === undefined ? 'Boş' : value,
            count,
            percentage: ((count / lastData.data.length) * 100).toFixed(2)
        }));

        // Frekansa göre sırala (çoktan aza)
        uniqueValues.sort((a, b) => b.count - a.count);
        
        console.log(`Toplam ${uniqueValues.length} farklı değer bulundu`);
        
        res.json({
            uniqueCount: valueMap.size,
            totalCount: lastData.data.length,
            uniqueValues
        });
    } catch (error) {
        console.error('Analiz sırasında hata:', error);
        res.status(500).json({ 
            error: 'Analiz sırasında bir hata oluştu',
            details: error.message 
        });
    }
});

module.exports = router;
