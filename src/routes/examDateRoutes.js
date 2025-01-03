const express = require('express');
const router = express.Router();
const ExamDate = require('../models/ExamDate');
const LctrData = require('../models/LctrData');
const Sorunlu = require('../models/Sorunlu');
const ActivePeriod = require('../models/activePeriod');

// Sınav tarihlerini kaydetme
router.post('/exam-dates', async (req, res) => {
    try {
        const { dkodu, dadi, dataType, examDate, note } = req.body;

        // Önce mevcut tarihi kontrol et ve güncelle, yoksa yeni kayıt oluştur
        const existingDate = await ExamDate.findOne({ dkodu, dataType });
        
        if (existingDate) {
            existingDate.examDate = examDate;
            await existingDate.save();
            res.json(existingDate);
        } else {
            const newExamDate = new ExamDate({
                dkodu,
                dadi,
                dataType,
                examDate,
                note
            });
            await newExamDate.save();
            res.json(newExamDate);
        }
    } catch (error) {
        console.error('Sınav tarihi kaydedilirken hata:', error);
        res.status(500).json({ error: 'Sınav tarihi kaydedilemedi' });
    }
});

// Belirli bir tipteki sınav tarihlerini getirme (lctrdata veya sorunlu)
router.get('/exam-dates/:dataType', async (req, res) => {
    try {
        // Kullanıcı bilgilerini al
        const Personnel = require('../models/Personnel');
        const personnel = await Personnel.findOne({ email: req.user.email });
        
        if (!personnel) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }

        const { dataType } = req.params;

        // Önce tüm sınav tarihlerini al
        const examDates = await ExamDate.find({ dataType });

        // Admin değilse, kullanıcının bölümüne ait dersleri bul
        if (personnel.role !== 'admin' && personnel.department) {
            const lctrData = await LctrData.findOne().sort({ uploadDate: -1 });
            if (lctrData) {
                // Kullanıcının bölümüne ait ders kodlarını bul
                const departmentDersKodlari = lctrData.data
                    .filter(item => item.program === personnel.department)
                    .map(item => item.dkodu);

                // Sadece bu ders kodlarına ait sınav tarihlerini filtrele
                const filteredExamDates = examDates.filter(date => 
                    departmentDersKodlari.includes(date.dkodu)
                );
                return res.json(filteredExamDates);
            }
        }

        // Admin için veya bölüm bulunamazsa tüm tarihleri gönder
        res.json(examDates);
    } catch (error) {
        console.error('Sınav tarihleri getirilirken hata:', error);
        res.status(500).json({ error: 'Sınav tarihleri getirilemedi' });
    }
});

// Lctrdata listesini getirme
router.get('/lctr/list', async (req, res) => {
    try {
        // Kullanıcı bilgilerini al
        const Personnel = require('../models/Personnel');
        const personnel = await Personnel.findOne({ email: req.user.email });
        
        if (!personnel) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }

        const lctrData = await LctrData.find().sort({ uploadDate: -1 }).limit(1);
        if (!lctrData || lctrData.length === 0) {
            return res.json([]);
        }

        // Her bir dersi dönüştür
        let dersler = lctrData[0].data.map(item => ({
            dkodu: item.dkodu,
            dadi: item.dadi,
            program: item.program,
            ogrenciSayisi: item.ogrenciler ? item.ogrenciler.length : 0
        }));

        // Admin değilse bölüme göre filtrele
        if (personnel.role !== 'admin' && personnel.department) {
            dersler = dersler.filter(ders => ders.program === personnel.department);
        }

        console.log('Lctrdata:', dersler); // Debug için log
        res.json(dersler);
    } catch (error) {
        console.error('Lctrdata getirilirken hata:', error);
        res.status(500).json({ error: 'Lctrdata getirilemedi' });
    }
});

// Sorunlu dersler listesini getirme
router.get('/sorunlu/list', async (req, res) => {
    try {
        const sorunluData = await Sorunlu.find().sort({ uploadDate: -1 }).limit(1);
        if (!sorunluData || sorunluData.length === 0) {
            return res.json([]);
        }

        // Her bir dersi dönüştür
        const dersler = sorunluData[0].data.map(item => ({
            dkodu: item.dkodu,
            dadi: item.dadi
        }));
        console.log('Sorunlu dersler:', dersler); // Debug için log
        res.json(dersler);
    } catch (error) {
        console.error('Sorunlu dersler getirilirken hata:', error);
        res.status(500).json({ error: 'Sorunlu dersler getirilemedi' });
    }
});

// Active period tarihlerini getirme
router.get('/active-period-dates', async (req, res) => {
    try {
        const activePeriod = await ActivePeriod.findOne({ isActive: true });
        if (!activePeriod) {
            return res.json([]);
        }

        const dates = [];
        const currentDate = new Date(activePeriod.startDate);
        const endDate = new Date(activePeriod.endDate);

        while (currentDate <= endDate) {
            // Sadece hafta içi günleri ekle (0 = Pazar, 6 = Cumartesi)
            if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                dates.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Tarihleri formatla
        const formattedDates = dates.map(date => ({
            value: date.toISOString().split('T')[0],
            label: date.toLocaleDateString('tr-TR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })
        }));

        res.json(formattedDates);
    } catch (error) {
        console.error('Active period tarihleri getirilirken hata:', error);
        res.status(500).json({ error: 'Active period tarihleri getirilemedi' });
    }
});

// Ders notu getirme
router.get('/exam-dates/:dkodu/note', async (req, res) => {
    try {
        const { dkodu } = req.params;
        const examDate = await ExamDate.findOne({ dkodu });
        res.json({ note: examDate?.note || '' });
    } catch (error) {
        console.error('Not getirilirken hata:', error);
        res.status(500).json({ error: 'Not getirilemedi' });
    }
});

// Not güncelleme
router.post('/exam-dates/:dkodu/note', async (req, res) => {
    try {
        const { dkodu } = req.params;
        const { note } = req.body;

        let examDate = await ExamDate.findOne({ dkodu });
        if (!examDate) {
            // Ders adını lctrdata'dan al
            const lctrData = await LctrData.findOne().sort({ uploadDate: -1 });
            const ders = lctrData?.data.find(d => d.dkodu === dkodu);
            
            // Eğer kayıt yoksa yeni oluştur
            examDate = new ExamDate({
                dkodu,
                dadi: ders?.dadi || '',
                dataType: 'lctrdata',
                note
            });
        } else {
            // Varolan kaydı güncelle
            examDate.note = note;
        }
        await examDate.save();
        res.json(examDate);
    } catch (error) {
        console.error('Not güncellenirken hata:', error);
        console.error('Hata detayı:', {
            dkodu,
            note,
            errorMessage: error.message,
            errorStack: error.stack
        });
        res.status(500).json({ 
            error: 'Not güncellenemedi',
            details: error.message 
        });
    }
});

module.exports = router;
