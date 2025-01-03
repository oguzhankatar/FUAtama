const express = require('express');
const router = express.Router();
const Gozetmen = require('../models/Gozetmen');
const LctrData = require('../models/LctrData');
const Sorunlu = require('../models/Sorunlu');

// Upload photo endpoint
router.post('/:id/photo', async (req, res) => {
    try {
        const { id } = req.params;
        const { photo } = req.body;

        if (!photo) {
            return res.status(400).json({ message: 'Fotoğraf verisi gerekli' });
        }

        const gozetmen = await Gozetmen.findById(id);
        if (!gozetmen) {
            return res.status(404).json({ message: 'Gözetmen bulunamadı' });
        }

        gozetmen.photo = photo;
        await gozetmen.save();

        res.json({ message: 'Fotoğraf başarıyla yüklendi' });
    } catch (error) {
        console.error('Fotoğraf yükleme hatası:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get all gozetmen data with department colors
router.get('/', async (req, res) => {
    try {
        // First get unique departments and assign colors
        const departments = await Gozetmen.distinct('blm');
        const colors = [
            '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0',
            '#2ec4b6', '#ff9f1c', '#2d6a4f', '#006d77', '#e63946',
            '#2a9d8f', '#e9c46a', '#f4a261', '#264653', '#023047'
        ];
        
        // Create department color mapping
        const departmentColors = {};
        departments.forEach((dept, index) => {
            departmentColors[dept] = colors[index % colors.length];
        });

        // Get all gozetmen data with assignments
        const gozetmenler = await Gozetmen.find({})
            .populate('assignments')
            .sort({ ad: 1 });
        
        // Add department color to each gozetmen
        const gozetmenlerWithColors = gozetmenler.map(g => {
            const doc = g.toObject();
            doc.departmentColor = departmentColors[g.blm];
            return doc;
        });

        res.json(gozetmenlerWithColors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get exam distribution analysis
router.get('/analysis', async (req, res) => {
    try {
        // Get all gözetmenler
        const gozetmenler = await Gozetmen.find({});
        
        // Get total exams from LctrData
        const lctrData = await LctrData.findOne().sort({ uploadDate: -1 });
        let lctrExams = 0;
        if (lctrData && lctrData.data) {
            lctrExams = lctrData.data.length;
        }

        // Get total exams from Sorunlu
        const sorunluData = await Sorunlu.find({});
        let sorunluExams = sorunluData ? sorunluData.length : 0;

        const totalExams = lctrExams + sorunluExams;

        // Calculate distribution
        const distribution = calculateDistribution(gozetmenler, totalExams);
        
        res.json({
            distribution,
            totalExams,
            examBreakdown: {
                lctrExams,
                sorunluExams
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

function calculateDistribution(gozetmenler, totalExams) {
    // Group gözetmenler by katsayi
    const katsayiGroups = {};
    gozetmenler.forEach(g => {
        const key = g.katsayi.toFixed(2);
        if (!katsayiGroups[key]) {
            katsayiGroups[key] = [];
        }
        katsayiGroups[key].push(g);
    });

    // Calculate total weighted katsayi
    const totalWeightedKatsayi = gozetmenler.reduce((sum, g) => sum + g.katsayi, 0);
    
    // Initial distribution based on katsayi
    let distribution = gozetmenler.map(gozetmen => {
        // Calculate base exam count proportional to katsayi
        const baseExams = Math.round((gozetmen.katsayi / totalWeightedKatsayi) * totalExams);
        
        return {
            _id: gozetmen._id,
            ad: gozetmen.ad,
            blm: gozetmen.blm,
            kisa: gozetmen.kisa,
            katsayi: gozetmen.katsayi,
            alacak: gozetmen.alacak || 0,
            verecek: gozetmen.verecek || 0,
            examCount: baseExams
        };
    });

    // Adjust for alacak values
    distribution = distribution.map(item => {
        // Find others with same katsayi
        const sameKatsayi = distribution.filter(d => 
            d.katsayi.toFixed(2) === item.katsayi.toFixed(2) && 
            d._id.toString() !== item._id.toString()
        );

        let adjustment = 0;
        if (item.alacak > 0) {
            // Calculate average exam count for same katsayi group
            const avgExams = sameKatsayi.reduce((sum, d) => sum + d.examCount, 0) / 
                           (sameKatsayi.length || 1);
            
            // Reduce exams based on alacak, but don't go below avgExams - alacak
            adjustment = Math.min(item.alacak, 
                                Math.max(0, item.examCount - (avgExams - item.alacak)));
        }

        return {
            ...item,
            examCount: Math.max(0, item.examCount - adjustment)
        };
    });

    // Sort by katsayi (descending) and then by alacak (ascending)
    distribution.sort((a, b) => {
        if (b.katsayi === a.katsayi) {
            return (a.alacak || 0) - (b.alacak || 0);
        }
        return b.katsayi - a.katsayi;
    });

    // Ensure total matches
    let currentTotal = distribution.reduce((sum, d) => sum + d.examCount, 0);
    const diff = totalExams - currentTotal;
    
    if (diff !== 0) {
        // Distribute remaining or excess exams
        const step = diff > 0 ? 1 : -1;
        let remaining = Math.abs(diff);
        let index = 0;
        
        while (remaining > 0) {
            if (distribution[index].examCount + step >= 0) {
                distribution[index].examCount += step;
                remaining--;
            }
            index = (index + 1) % distribution.length;
        }
    }

    return distribution;
}

module.exports = router;
