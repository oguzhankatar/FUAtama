const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const TempData = require('../models/TempData');
const Kods = require('../models/Kods');

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload Excel file endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Lütfen bir dosya yükleyin' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet);

        if (rawData.length === 0) {
            return res.status(400).json({ message: 'Excel dosyası boş' });
        }

        // Get all kods for lookup
        const kods = await Kods.find();
        const kodsMap = new Map(kods.map(k => [k.field, k.value]));

        // Define column mapping
        const columnNames = ['tc', 'no', 'ad', 'soyad', 'programa', 'sube', 'dkodu', 'dadi', 'krd', 'akts', 'kay', 'ona', 'snc', 'hoca', 'program'];

        // Process the data
        const processedData = rawData.map((row, index) => {
            const rowEntries = Object.entries(row);
            if (rowEntries.length < 2) return null;

            // Create new row with renamed columns
            const newRow = {};
            rowEntries.forEach((entry, i) => {
                if (i < columnNames.length) {
                    newRow[columnNames[i]] = entry[1];
                }
            });
            
            // Pad 'no' with zeros if less than 9 characters
            if (newRow.no) {
                let noValue = String(newRow.no);
                if (noValue.length < 9) {
                    noValue = noValue.padStart(9, '0');
                }
                newRow.no = noValue;
                
                // Extract 4th, 5th, and 6th characters for islemKodu
                const extractedValue = noValue.length >= 6 ? 
                    noValue.substring(3, 6) : '';
                
                // Lookup in kods
                const matchedValue = kodsMap.get(extractedValue);
                newRow.islemKodu = matchedValue || 'HRC';
            }

            // Clean dkodu field - remove '[' and everything after it
            if (newRow.dkodu) {
                const bracketIndex = String(newRow.dkodu).indexOf('[');
                if (bracketIndex !== -1) {
                    newRow.dkodu = String(newRow.dkodu).substring(0, bracketIndex);
                }
            }
            
            return newRow;
        }).filter(row => row && row.islemKodu !== 'HRC' && row.kay !== 'Sonuçlandırılmadı'); // Filter out null rows, HRC rows, and rows with 'Sonuçlandırılmadı' in kay

        if (processedData.length === 0) {
            return res.status(400).json({ 
                message: 'İşlenebilir veri bulunamadı veya tüm veriler HRC' 
            });
        }

        const tempData = new TempData({
            data: processedData
        });

        await tempData.save();

        res.status(200).json({
            message: 'Dosya başarıyla işlendi ve veritabanına kaydedildi',
            data: tempData
        });
    } catch (error) {
        console.error('Dosya yükleme hatası:', error);
        res.status(500).json({
            message: 'Dosya yükleme hatası',
            error: error.message
        });
    }
});

// List data endpoint
router.get('/data', async (req, res) => {
    try {
        const data = await TempData.find().sort({ uploadDate: -1 });
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({
            message: 'Veri getirme hatası',
            error: error.message
        });
    }
});

// Delete row endpoint
router.delete('/data/:documentId/:rowIndex', async (req, res) => {
    try {
        const { documentId, rowIndex } = req.params;
        const document = await TempData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        const index = parseInt(rowIndex);
        if (index < 0 || index >= document.data.length) {
            return res.status(400).json({ message: 'Geçersiz satır indeksi' });
        }

        document.data.splice(index, 1);

        if (document.data.length === 0) {
            await TempData.findByIdAndDelete(documentId);
            return res.status(200).json({ message: 'Tüm veriler silindi', redirect: true });
        }

        await document.save();
        res.status(200).json({ message: 'Satır başarıyla silindi' });
    } catch (error) {
        res.status(500).json({
            message: 'Satır silme hatası',
            error: error.message
        });
    }
});

// Delete column endpoint
router.delete('/data/:documentId/column/:columnName', async (req, res) => {
    try {
        const { documentId, columnName } = req.params;
        const document = await TempData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Prevent deletion of islemKodu column
        if (columnName === 'islemKodu') {
            return res.status(400).json({ 
                message: 'İşlem Kodu sütunu silinemez' 
            });
        }

        // Delete column from each row
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

module.exports = router;
