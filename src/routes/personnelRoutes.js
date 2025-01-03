const express = require('express');
const router = express.Router();
const Personnel = require('../models/Personnel');
const { isAdmin } = require('../middleware/roleAuth');

// Tüm personeli listele (sadece admin)
router.get('/', isAdmin, async (req, res) => {
    try {
        const personnel = await Personnel.find().select('-__v').sort('name');
        res.json(personnel);
    } catch (error) {
        console.error('Personel listesi alınamadı:', error);
        res.status(500).json({ error: 'Personel listesi alınamadı' });
    }
});

// Mevcut kullanıcının rol bilgisini getir
router.get('/me', async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
        }

        const personnel = await Personnel.findOne({ email: req.user.email })
            .select('email name role department pagePermissions');

        if (!personnel) {
            return res.status(404).json({ error: 'Personel kaydı bulunamadı' });
        }

        res.json(personnel);
    } catch (error) {
        console.error('Personel bilgisi alınamadı:', error);
        res.status(500).json({ error: 'Personel bilgisi alınırken bir hata oluştu' });
    }
});

// Tek bir personel bilgisini getir
router.get('/:id', isAdmin, async (req, res) => {
    try {
        console.log('Getting personnel with ID:', req.params.id);
        const personnel = await Personnel.findById(req.params.id);
        if (!personnel) {
            console.log('Personnel not found with ID:', req.params.id);
            return res.status(404).json({ error: 'Personel bulunamadı' });
        }
        console.log('Found personnel:', personnel);
        res.json(personnel);
    } catch (error) {
        console.error('Personel bilgisi alınamadı:', error);
        res.status(500).json({ error: 'Personel bilgisi alınırken bir hata oluştu' });
    }
});

// Yeni personel ekle (sadece admin)
router.post('/', isAdmin, async (req, res) => {
    try {
        console.log('Received personnel creation request:', req.body);
        const { email, name, role, department, pagePermissions } = req.body;

        // E-posta kontrolü
        if (!email.endsWith('@firat.edu.tr')) {
            return res.status(400).json({ error: 'Sadece @firat.edu.tr uzantılı e-posta adresleri kabul edilir' });
        }

        // Var olan personel kontrolü
        const existingPersonnel = await Personnel.findOne({ email });
        if (existingPersonnel) {
            return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı' });
        }

        const personnel = new Personnel({
            email,
            name,
            role,
            department,
            pagePermissions: Array.isArray(pagePermissions) ? pagePermissions : []
        });

        console.log('Attempting to save personnel:', personnel);
        const savedPersonnel = await personnel.save();
        console.log('Personnel saved successfully:', savedPersonnel);
        res.status(201).json(savedPersonnel);
    } catch (error) {
        console.error('Personel eklenemedi:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        if (error.name === 'ValidationError') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Personel eklenirken bir hata oluştu: ' + error.message });
        }
    }
});

// Personel güncelle (sadece admin)
router.put('/:id', isAdmin, async (req, res) => {
    try {
        console.log('Updating personnel with ID:', req.params.id);
        console.log('Update data:', req.body);
        
        const { email, name, role, department, active, pagePermissions } = req.body;
        
        // E-posta değiştiriliyorsa kontrol et
        if (email && !email.endsWith('@firat.edu.tr')) {
            return res.status(400).json({ error: 'Sadece @firat.edu.tr uzantılı e-posta adresleri kabul edilir' });
        }

        const personnel = await Personnel.findById(req.params.id);
        if (!personnel) {
            console.log('Personnel not found for update with ID:', req.params.id);
            return res.status(404).json({ error: 'Personel bulunamadı' });
        }

        // Güncelleme
        if (email) personnel.email = email;
        if (name) personnel.name = name;
        if (role) personnel.role = role;
        if (department) personnel.department = department;
        if (typeof active === 'boolean') personnel.active = active;
        if (Array.isArray(pagePermissions)) personnel.pagePermissions = pagePermissions;

        console.log('Saving updated personnel:', personnel);
        const updatedPersonnel = await personnel.save();
        console.log('Personnel updated successfully:', updatedPersonnel);
        res.json(updatedPersonnel);
    } catch (error) {
        console.error('Personel güncellenemedi:', error);
        if (error.name === 'ValidationError') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Personel güncellenirken bir hata oluştu' });
        }
    }
});

// Personel sil (sadece admin)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const personnel = await Personnel.findById(req.params.id);
        if (!personnel) {
            return res.status(404).json({ error: 'Personel bulunamadı' });
        }

        await Personnel.findByIdAndDelete(req.params.id);
        res.json({ message: 'Personel başarıyla silindi' });
    } catch (error) {
        console.error('Personel silinemedi:', error);
        res.status(500).json({ error: 'Personel silinirken bir hata oluştu' });
    }
});

module.exports = router;
