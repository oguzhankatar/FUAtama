const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const LctrData = require('../models/LctrData');
const Progs = require('../models/Progs');
const SilinecekDersler = require('../models/SilinecekDersler');
const TempData = require('../models/TempData');

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload Excel file endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Lütfen bir dosya yükleyin' });
        }

        // Clear all documents from lctrdatas collection
        await LctrData.deleteMany({});

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        const lctrData = new LctrData({
            data: data
        });

        await lctrData.save();

        res.status(200).json({
            message: 'Dosya başarıyla yüklendi ve veritabanına kaydedildi',
            data: lctrData
        });
    } catch (error) {
        res.status(500).json({
            message: 'Dosya yükleme hatası',
            error: error.message
        });
    }
});

// List data endpoint
router.get('/data', async (req, res) => {
    try {
        const data = await LctrData.find().sort({ uploadDate: -1 });
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({
            message: 'Veri getirme hatası',
            error: error.message
        });
    }
});

// Add new card endpoint
router.post('/data/:documentId/card', async (req, res) => {
    try {
        const { documentId } = req.params;
        const newCard = req.body;

        const document = await LctrData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Add the new card to the data array
        document.data.push(newCard);

        // Explicitly mark the data array as modified
        document.markModified('data');

        await document.save();

        res.status(200).json({ 
            message: 'Kart başarıyla eklendi',
            newCard
        });
    } catch (error) {
        res.status(500).json({
            message: 'Kart ekleme hatası',
            error: error.message
        });
    }
});

// Delete student endpoint
router.delete('/data/:documentId/:rowIndex/students/:studentNo', async (req, res) => {
    try {
        const { documentId, rowIndex, studentNo } = req.params;
        
        const document = await LctrData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        const index = parseInt(rowIndex);
        if (index < 0 || index >= document.data.length) {
            return res.status(400).json({ message: 'Geçersiz satır indeksi' });
        }

        // Check if student exists
        if (!document.data[index].ogrenciler || !document.data[index].ogrenciler.includes(studentNo)) {
            return res.status(404).json({ message: 'Öğrenci bulunamadı' });
        }

        // Remove the student
        document.data[index].ogrenciler = document.data[index].ogrenciler.filter(no => no !== studentNo);
        
        // Explicitly mark the data array as modified
        document.markModified('data');
        
        await document.save();

        res.status(200).json({ 
            message: 'Öğrenci başarıyla silindi',
            updatedRow: document.data[index]
        });
    } catch (error) {
        res.status(500).json({
            message: 'Öğrenci silme hatası',
            error: error.message
        });
    }
});

// Add new student endpoint
router.post('/data/:documentId/:rowIndex/students', async (req, res) => {
    try {
        const { documentId, rowIndex } = req.params;
        const { studentNo } = req.body;
        
        const document = await LctrData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        const index = parseInt(rowIndex);
        if (index < 0 || index >= document.data.length) {
            return res.status(400).json({ message: 'Geçersiz satır indeksi' });
        }

        // Initialize ogrenciler array if it doesn't exist
        if (!document.data[index].ogrenciler) {
            document.data[index].ogrenciler = [];
        }

        // Check if student already exists
        if (document.data[index].ogrenciler.includes(studentNo)) {
            return res.status(400).json({ message: 'Bu öğrenci zaten ekli' });
        }

        // Add the new student
        document.data[index].ogrenciler.push(studentNo);
        
        // Explicitly mark the data array as modified
        document.markModified('data');
        
        await document.save();

        res.status(200).json({ 
            message: 'Öğrenci başarıyla eklendi',
            updatedRow: document.data[index]
        });
    } catch (error) {
        res.status(500).json({
            message: 'Öğrenci ekleme hatası',
            error: error.message
        });
    }
});

// Update row kontenjan endpoint
router.put('/data/:documentId/:rowIndex/kontenjan', async (req, res) => {
    try {
        const { documentId, rowIndex } = req.params;
        const { kontenjan } = req.body;
        
        const document = await LctrData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        const index = parseInt(rowIndex);
        if (index < 0 || index >= document.data.length) {
            return res.status(400).json({ message: 'Geçersiz satır indeksi' });
        }

        // Update the kontenjan value
        document.data[index].kon = kontenjan;
        
        // Explicitly mark the data array as modified
        document.markModified('data');
        
        await document.save();

        res.status(200).json({ 
            message: 'Kontenjan başarıyla güncellendi',
            updatedRow: document.data[index]
        });
    } catch (error) {
        res.status(500).json({
            message: 'Kontenjan güncelleme hatası',
            error: error.message
        });
    }
});

// Update sube endpoint
router.put('/data/:documentId/:rowIndex/sube', async (req, res) => {
    try {
        const { documentId, rowIndex } = req.params;
        
        const document = await LctrData.findById(documentId);
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        const index = parseInt(rowIndex);
        if (index < 0 || index >= document.data.length) {
            return res.status(400).json({ message: 'Geçersiz satır indeksi' });
        }

        // Update the sube value
        const { sube } = req.body;
        document.data[index].sube = sube || 'X';
        
        // Explicitly mark the data array as modified
        document.markModified('data');
        
        await document.save();

        res.status(200).json({ 
            message: 'Şube başarıyla güncellendi',
            updatedRow: document.data[index]
        });
    } catch (error) {
        res.status(500).json({
            message: 'Şube güncelleme hatası',
            error: error.message
        });
    }
});

// Fill students endpoint
router.post('/data/:documentId/fill-students', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);
        
        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Get the latest TempData
        const tempData = await TempData.findOne().sort({ uploadDate: -1 });
        if (!tempData) {
            return res.status(404).json({ message: 'TempData bulunamadı' });
        }

        // Create maps for student numbers
        const studentMap = new Map();
        const dkoduStudentMap = new Map();

        // First pass: Create maps with student numbers
        tempData.data.forEach(item => {
            if (item.dkodu && item.no) {
                // For specific sections with matching hoca
                if (item.sube && item.hoca) {
                    const key = `${item.dkodu}-${item.sube}-${item.hoca}`;
                    if (!studentMap.has(key)) {
                        studentMap.set(key, []);
                    }
                    studentMap.get(key).push(item.no);
                }

                // For dkodu-only cases (sube 'X')
                if (!dkoduStudentMap.has(item.dkodu)) {
                    dkoduStudentMap.set(item.dkodu, []);
                }
                dkoduStudentMap.get(item.dkodu).push(item.no);
            }
        });

        // Update each card with student list
        document.data = document.data.map(card => {
            let students = [];
            if (card.sube === 'X') {
                // For sube 'X', use all students for that dkodu
                students = dkoduStudentMap.get(card.dkodu) || [];
            } else {
                // Try to match with hoca first
                const keyWithHoca = `${card.dkodu}-${card.sube}-${card.hoca}`;
                const keyWithoutHoca = `${card.dkodu}-${card.sube}`;
                
                // If we have students matching both dkodu-sube-hoca, use those
                if (studentMap.has(keyWithHoca)) {
                    students = studentMap.get(keyWithHoca);
                } else {
                    // Otherwise, collect all students for this dkodu-sube combination
                    students = Array.from(studentMap.keys())
                        .filter(key => key.startsWith(`${card.dkodu}-${card.sube}`))
                        .reduce((acc, key) => [...acc, ...studentMap.get(key)], []);
                }
            }
            return {
                ...card,
                ogrenciler: students
            };
        });

        // Explicitly mark the data array as modified
        document.markModified('data');
        
        await document.save();

        res.status(200).json({ 
            message: 'Öğrenci listesi başarıyla eklendi',
            data: document.data
        });
    } catch (error) {
        res.status(500).json({
            message: 'Öğrenci listesi ekleme hatası',
            error: error.message
        });
    }
});

// Delete row endpoint
router.delete('/data/:documentId/:rowIndex', async (req, res) => {
    try {
        const { documentId, rowIndex } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        const index = parseInt(rowIndex);
        if (index < 0 || index >= document.data.length) {
            return res.status(400).json({ message: 'Geçersiz satır indeksi' });
        }

        // Remove the row
        document.data.splice(index, 1);
        
        // Explicitly mark the data array as modified
        document.markModified('data');

        if (document.data.length === 0) {
            await LctrData.findByIdAndDelete(documentId);
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
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Delete column from each row
        document.data = document.data.map(row => {
            const newRow = { ...row };
            delete newRow[columnName];
            return newRow;
        });

        // Explicitly mark the data array as modified
        document.markModified('data');

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

// Rename columns endpoint
router.post('/data/:documentId/rename-columns', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        const newColumnNames = ['sube', 'dkodu', 'dadi', 'kon', 'program', 'hoca'];
        
        // Get current column names
        const currentColumns = Object.keys(document.data[0]);

        // Ensure we have enough columns
        if (currentColumns.length < newColumnNames.length) {
            return res.status(400).json({ 
                message: 'Mevcut sütun sayısı yeni isimler için yetersiz' 
            });
        }

        // Rename columns in each row
        document.data = document.data.map(row => {
            const newRow = {};
            currentColumns.forEach((oldName, index) => {
                // If we have a new name for this column, use it, otherwise keep the old name
                const newName = index < newColumnNames.length ? newColumnNames[index] : oldName;
                newRow[newName] = row[oldName];
            });
            return newRow;
        });

        // Explicitly mark the data array as modified
        document.markModified('data');

        await document.save();
        res.status(200).json({ message: 'Sütunlar başarıyla yeniden adlandırıldı' });
    } catch (error) {
        console.error('Sütun yeniden adlandırma hatası:', error);
        res.status(500).json({
            message: 'Sütun yeniden adlandırma hatası',
            error: error.message
        });
    }
});

// Update kon column endpoint
router.post('/data/:documentId/update-kon', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Update kon column in each row
        document.data = document.data.map(row => {
            const newRow = { ...row };
            if (newRow.kon) {
                // Extract second bracket value using regex
                const matches = newRow.kon.match(/\[([^\]]*)\]/g);
                if (matches && matches.length >= 2) {
                    // Get second bracket value without brackets
                    newRow.kon = matches[1].replace(/[\[\]]/g, '');
                }
            }
            return newRow;
        });

        // Explicitly mark the data array as modified
        document.markModified('data');

        await document.save();
        res.status(200).json({ message: 'Kon sütunu başarıyla güncellendi' });
    } catch (error) {
        console.error('Kon sütunu güncelleme hatası:', error);
        res.status(500).json({
            message: 'Kon sütunu güncelleme hatası',
            error: error.message
        });
    }
});

// Convert kon values to integers endpoint
router.post('/data/:documentId/convert-kon-to-int', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Convert kon values to integers in each row
        document.data = document.data.map(row => {
            const newRow = { ...row };
            if (newRow.kon && typeof newRow.kon === 'string') {
                const konValue = parseInt(newRow.kon);
                newRow.kon = isNaN(konValue) ? 0 : konValue;
            }
            return newRow;
        });

        // Explicitly mark the data array as modified
        document.markModified('data');

        await document.save();
        res.status(200).json({ message: 'Kon değerleri başarıyla tam sayıya dönüştürüldü' });
    } catch (error) {
        console.error('Kon değerleri dönüştürme hatası:', error);
        res.status(500).json({
            message: 'Kon değerleri dönüştürme hatası',
            error: error.message
        });
    }
});

// Update program column endpoint
router.post('/data/:documentId/update-program', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Get all programs from progs collection
        const programs = await Progs.find();

        // Create a map for quick lookup
        const programMap = new Map(programs.map(p => [p.program, p.short]));

        // Update program column in each row
        document.data = document.data.map(row => {
            const newRow = { ...row };
            if (newRow.program && programMap.has(newRow.program)) {
                newRow.program = programMap.get(newRow.program);
            }
            return newRow;
        });

        // Explicitly mark the data array as modified
        document.markModified('data');

        await document.save();
        res.status(200).json({ message: 'Program sütunu başarıyla güncellendi' });
    } catch (error) {
        console.error('Program sütunu güncelleme hatası:', error);
        res.status(500).json({
            message: 'Program sütunu güncelleme hatası',
            error: error.message
        });
    }
});

// Delete HRC rows endpoint
router.post('/data/:documentId/delete-hrc-rows', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Filter out rows where program column contains 'HRC'
        const originalLength = document.data.length;
        document.data = document.data.filter(row => row.program !== 'HRC');

        // Explicitly mark the data array as modified
        document.markModified('data');

        // If all data is deleted, remove the document
        if (document.data.length === 0) {
            await LctrData.findByIdAndDelete(documentId);
            return res.status(200).json({ 
                message: 'Tüm HRC satırları silindi ve belge kaldırıldı',
                redirect: true,
                deletedCount: originalLength
            });
        }

        await document.save();
        const deletedCount = originalLength - document.data.length;
        res.status(200).json({ 
            message: `${deletedCount} HRC satırı başarıyla silindi`,
            deletedCount
        });
    } catch (error) {
        console.error('HRC satırları silme hatası:', error);
        res.status(500).json({
            message: 'HRC satırları silme hatası',
            error: error.message
        });
    }
});

// Delete cut rows endpoint
router.post('/data/:documentId/delete-cut-rows', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Get all cut codes from silinecekdersler collection
        const silinecekDersler = await SilinecekDersler.find();
        const cutCodes = new Set(silinecekDersler.map(ders => ders.cut));

        // Filter out rows where dkodu exists in cutCodes
        const originalLength = document.data.length;
        document.data = document.data.filter(row => !cutCodes.has(row.dkodu));

        // Explicitly mark the data array as modified
        document.markModified('data');

        // If all data is deleted, remove the document
        if (document.data.length === 0) {
            await LctrData.findByIdAndDelete(documentId);
            return res.status(200).json({ 
                message: 'Tüm kesilecek dersler silindi ve belge kaldırıldı',
                redirect: true,
                deletedCount: originalLength
            });
        }

        await document.save();
        const deletedCount = originalLength - document.data.length;
        res.status(200).json({ 
            message: `${deletedCount} kesilecek ders satırı başarıyla silindi`,
            deletedCount
        });
    } catch (error) {
        console.error('Kesilecek ders satırları silme hatası:', error);
        res.status(500).json({
            message: 'Kesilecek ders satırları silme hatası',
            error: error.message
        });
    }
});

// Combine duplicate dkodu rows endpoint
router.post('/data/:documentId/combine-duplicates', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Separate ORT rows and non-ORT rows
        const ortRows = document.data.filter(row => row.program === 'ORT');
        const nonOrtRows = document.data.filter(row => row.program !== 'ORT' && row.program !== 'PFE');

        // Group non-ORT rows by dkodu
        const groupedData = nonOrtRows.reduce((acc, row) => {
            if (!acc[row.dkodu]) {
                acc[row.dkodu] = [];
            }
            acc[row.dkodu].push(row);
            return acc;
        }, {});

        // Combine duplicate non-ORT rows
        const combinedData = Object.values(groupedData).map(rows => {
            if (rows.length === 1) {
                return rows[0];
            }

            // Sum kon values and set sube to X for duplicates
            const totalKon = rows.reduce((sum, row) => sum + (parseInt(row.kon) || 0), 0);
            const baseRow = { ...rows[0] };
            baseRow.kon = totalKon;
            baseRow.sube = 'X';
            return baseRow;
        });

        // Combine the ORT rows with the processed non-ORT rows
        document.data = [...combinedData, ...ortRows];

        // Explicitly mark the data array as modified
        document.markModified('data');

        await document.save();

        res.status(200).json({ 
            message: 'Tekrarlı dkodu satırları başarıyla birleştirildi'
        });
    } catch (error) {
        console.error('Satır birleştirme hatası:', error);
        res.status(500).json({
            message: 'Satır birleştirme hatası',
            error: error.message
        });
    }
});

// Delete zero kon rows endpoint
router.post('/data/:documentId/delete-zero-kon-rows', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await LctrData.findById(documentId);

        if (!document) {
            return res.status(404).json({ message: 'Belge bulunamadı' });
        }

        // Filter out rows where kon column is 0
        const originalLength = document.data.length;
        document.data = document.data.filter(row => row.kon !== 0);

        // Explicitly mark the data array as modified
        document.markModified('data');

        // If all data is deleted, remove the document
        if (document.data.length === 0) {
            await LctrData.findByIdAndDelete(documentId);
            return res.status(200).json({ 
                message: 'Tüm kon=0 satırları silindi ve belge kaldırıldı',
                redirect: true,
                deletedCount: originalLength
            });
        }

        await document.save();
        const deletedCount = originalLength - document.data.length;
        res.status(200).json({ 
            message: `${deletedCount} kon=0 satırı başarıyla silindi`,
            deletedCount
        });
    } catch (error) {
        console.error('Kon=0 satırları silme hatası:', error);
        res.status(500).json({
            message: 'Kon=0 satırları silme hatası',
            error: error.message
        });
    }
});

module.exports = router;
