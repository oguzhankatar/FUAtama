const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const ExcelData = require('../models/ExcelData');
const mongoose = require('mongoose');

// Multer konfigürasyonu
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Unique ders değerlerini getirme endpoint'i
router.get('/data/:documentId/unique-ders', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await ExcelData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Unique ders değerlerini al
        const uniqueDers = [...new Set(document.data.map(row => row.ders))];
        res.status(200).json({ uniqueDers });
    } catch (error) {
        res.status(500).json({
            message: 'Unique ders değerlerini getirme hatası',
            error: error.message
        });
    }
});

// Unique blm değerlerini getirme endpoint'i
router.get('/data/:documentId/unique-blm', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await ExcelData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Unique blm değerlerini al
        const uniqueBlm = [...new Set(document.data.map(row => row.blm))];
        res.status(200).json({ uniqueBlm });
    } catch (error) {
        res.status(500).json({
            message: 'Unique blm değerlerini getirme hatası',
            error: error.message
        });
    }
});

// Seçilmeyen derslerin satırlarını silme endpoint'i
router.post('/data/:documentId/delete-unchecked-ders', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { uncheckedDers } = req.body;

        const document = await ExcelData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Seçilmeyen derslerin satırlarını filtrele
        document.data = document.data.filter(row => !uncheckedDers.includes(row.ders));

        await document.save();
        res.status(200).json({ 
            message: 'Seçilmeyen dersler başarıyla silindi',
            success: true 
        });
    } catch (error) {
        res.status(500).json({
            message: 'Ders silme hatası',
            error: error.message
        });
    }
});

// Seçilmeyen bölümlerin satırlarını silme endpoint'i
router.post('/data/:documentId/delete-unchecked-blm', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { uncheckedBlm } = req.body;

        const document = await ExcelData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Seçilmeyen bölümlerin satırlarını filtrele
        document.data = document.data.filter(row => !uncheckedBlm.includes(row.blm));

        await document.save();
        res.status(200).json({ 
            message: 'Seçilmeyen bölümler başarıyla silindi',
            success: true 
        });
    } catch (error) {
        res.status(500).json({
            message: 'Bölüm silme hatası',
            error: error.message
        });
    }
});

// Kods collection verilerini getirme endpoint'i
router.get('/kods', async (req, res) => {
    try {
        const kodsCollection = mongoose.connection.collection('kods');
        const kods = await kodsCollection.find({}).toArray();
        console.log('Mevcut kodlar:', kods);
        res.status(200).json(kods);
    } catch (error) {
        res.status(500).json({
            message: 'Kods verilerini getirme hatası',
            error: error.message
        });
    }
});

// Excel dosyası yükleme endpoint'i
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Lütfen bir dosya yükleyin' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        const excelData = new ExcelData({
            data: data,
            fileName: req.file.originalname
        });

        await excelData.save();

        res.status(200).json({
            message: 'Dosya başarıyla yüklendi ve veritabanına kaydedildi',
            data: excelData
        });
    } catch (error) {
        res.status(500).json({
            message: 'Dosya yükleme hatası',
            error: error.message
        });
    }
});

// Verileri listeleme endpoint'i
router.get('/data', async (req, res) => {
    try {
        const data = await ExcelData.find().sort({ uploadDate: -1 });
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({
            message: 'Veri getirme hatası',
            error: error.message
        });
    }
});

// Satır silme endpoint'i
router.delete('/data/:documentId/:rowIndex', async (req, res) => {
    try {
        const { documentId, rowIndex } = req.params;
        const document = await ExcelData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        const index = parseInt(rowIndex);
        if (index < 0 || index >= document.data.length) {
            return res.status(400).json({ message: 'Geçersiz satır indeksi' });
        }

        // Satırı sil
        document.data.splice(index, 1);

        if (document.data.length === 0) {
            await ExcelData.findByIdAndDelete(documentId);
            return res.status(200).json({ message: 'Tüm veriler silindi', redirect: true });
        }

        await document.save();
        res.status(200).json({ message: 'Satır başarıyla silindi' });
    } catch (error) {
        console.error('Silme hatası:', error);
        res.status(500).json({
            message: 'Satır silme hatası',
            error: error.message
        });
    }
});

// Sütun silme endpoint'i
router.delete('/data/:documentId/column/:columnName', async (req, res) => {
    try {
        const { documentId, columnName } = req.params;
        const document = await ExcelData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Sütunu sil
        document.data = document.data.map(row => {
            const newRow = { ...row };
            delete newRow[columnName];
            return newRow;
        });

        await document.save();
        res.status(200).json({ message: 'Sütun başarıyla silindi' });
    } catch (error) {
        console.error('Sütun silme hatası:', error);
        res.status(500).json({
            message: 'Sütun silme hatası',
            error: error.message
        });
    }
});

// Sütun adlarını güncelleme endpoint'i
router.post('/data/:documentId/rename-columns', async (req, res) => {
    try {
        console.log('Gelen istek:', req.params, req.body);
        const { documentId } = req.params;
        const { columnMappings } = req.body;

        if (!columnMappings || Object.keys(columnMappings).length === 0) {
            return res.status(400).json({ message: 'Sütun eşleştirmeleri gerekli' });
        }

        const document = await ExcelData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Sütun adlarını güncelle
        document.data = document.data.map(row => {
            const newRow = {};
            // Önce yeni sütun adlarını ekle
            Object.entries(columnMappings).forEach(([oldName, newName]) => {
                if (oldName in row) {
                    newRow[newName] = row[oldName];
                }
            });
            // Değiştirilmeyen sütunları koru
            Object.entries(row).forEach(([key, value]) => {
                if (!columnMappings[key]) {
                    newRow[key] = value;
                }
            });
            return newRow;
        });

        await document.save();
        res.status(200).json({ 
            message: 'Sütun adları başarıyla güncellendi',
            success: true 
        });
    } catch (error) {
        console.error('Sütun güncelleme hatası:', error);
        res.status(500).json({
            message: 'Sütun güncelleme hatası',
            error: error.message,
            success: false
        });
    }
});

// Yeni sütun ekleme endpoint'i
router.post('/data/:documentId/add-column', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { columnName, columnData } = req.body;

        if (!columnName || !columnData || !Array.isArray(columnData)) {
            return res.status(400).json({ message: 'Geçersiz sütun verisi' });
        }

        const document = await ExcelData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        if (columnData.length !== document.data.length) {
            return res.status(400).json({ message: 'Sütun verisi satır sayısı ile eşleşmiyor' });
        }

        // Yeni sütunu ikinci sütunun soluna ekle
        document.data = document.data.map((row, index) => {
            const entries = Object.entries(row);
            const newRow = {};
            
            // İlk sütunu ekle
            if (entries.length > 0) {
                newRow[entries[0][0]] = entries[0][1];
            }
            
            // Yeni sütunu ekle
            newRow[columnName] = columnData[index];
            
            // Kalan sütunları ekle
            for (let i = 1; i < entries.length; i++) {
                newRow[entries[i][0]] = entries[i][1];
            }
            
            return newRow;
        });

        await document.save();
        res.status(200).json({ 
            message: 'Yeni sütun başarıyla eklendi',
            success: true 
        });
    } catch (error) {
        console.error('Sütun ekleme hatası:', error);
        res.status(500).json({
            message: 'Sütun ekleme hatası',
            error: error.message,
            success: false
        });
    }
});

// Bölüm kodlarını güncelleme endpoint'i
router.post('/data/:documentId/update-department-codes', async (req, res) => {
    try {
        const { documentId } = req.params;
        
        const document = await ExcelData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // kods collection'ından verileri al
        const kodsCollection = mongoose.connection.collection('kods');
        const kodsMappings = await kodsCollection.find({}).toArray();
        
        console.log('Tüm kod eşleştirmeleri:', JSON.stringify(kodsMappings, null, 2));

        // Her satır için extracted_no değerini kontrol et ve eşleştir
        document.data = document.data.map((row, index) => {
            const extractedNo = row.extracted_no;
            console.log(`Satır ${index + 1} - Aranan extracted_no değeri:`, extractedNo);
            
            // Eşleştirme yaparken string tipine çevir ve trim uygula
            const matchingKod = kodsMappings.find(k => 
                k.field.toString().trim() === extractedNo.toString().trim()
            );
            
            console.log(`Satır ${index + 1} - Eşleşen kod:`, matchingKod ? JSON.stringify(matchingKod) : 'Eşleşme bulunamadı');
            
            // Yeni sütunu en başa ekle
            const newRow = {
                blm: matchingKod ? matchingKod.value : 'HRC',
                ...row
            };
            
            // extracted_no sütununu sil
            delete newRow.extracted_no;
            
            return newRow;
        });

        await document.save();
        
        res.status(200).json({
            message: 'Bölüm kodları başarıyla güncellendi',
            success: true
        });
    } catch (error) {
        console.error('Bölüm kodu güncelleme hatası:', error);
        res.status(500).json({
            message: 'Bölüm kodu güncelleme hatası',
            error: error.message,
            success: false
        });
    }
});

module.exports = router;
