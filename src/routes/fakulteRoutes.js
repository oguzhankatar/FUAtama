const express = require('express');
const router = express.Router();
const LctrData = require('../models/LctrData');
const Sinifs = require('../models/Sinifs');

router.get('/api/fakulte-data', async (req, res) => {
    try {
        // Get date range from query parameters (optional)
        const { startDate, endDate } = req.query;

        const [lctrData, sinifsData] = await Promise.all([
            LctrData.findOne().sort({ createdAt: -1 }),
            Sinifs.find().sort({ name: 1 })
        ]);

        if (!lctrData) {
            return res.status(404).json({ message: 'No lctr data found' });
        }

        // Ensure lctr data is properly structured and validate student counts
        const lctrArray = Array.isArray(lctrData.data) ? lctrData.data.map(course => {
            // Ensure ogrenciler is always an array
            const ogrenciler = Array.isArray(course.ogrenciler) ? course.ogrenciler : [];
            
            return {
                ...course,
                ogrenciler,
                uniqueId: `${course.dkodu}-${course.sube}`, // Add unique identifier
                studentCount: ogrenciler.length // Add explicit student count from ogrenciler array
            };
        }) : [];

        // Send the data along with the date range for future use
        res.json({
            lctrdata: lctrArray,
            sinifs: sinifsData,
            dateRange: {
                startDate: startDate || null,
                endDate: endDate || null
            }
        });
    } catch (error) {
        console.error('Fakulte data error:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/api/save-fakulte-schedule', async (req, res) => {
    try {
        const { examData } = req.body;

        if (!Array.isArray(examData)) {
            return res.status(400).json({ message: 'Invalid exam data format' });
        }

        // Group exams by dkodu and sube combination
        const groupedExams = examData.reduce((acc, exam) => {
            const uniqueId = `${exam.dkodu}-${exam.sube}`; // Use unique identifier
            if (!acc[uniqueId]) {
                acc[uniqueId] = {
                    dkodu: exam.dkodu,
                    sube: exam.sube,
                    date: exam.date,
                    time: exam.time,
                    siniflar: []
                };
            }
            if (!acc[uniqueId].siniflar.includes(exam.sinif)) {
                acc[uniqueId].siniflar.push(exam.sinif);
            }
            return acc;
        }, {});

        // Get the latest LctrData document
        const lctrDoc = await LctrData.findOne().sort({ createdAt: -1 });
        if (!lctrDoc) {
            return res.status(404).json({ message: 'No lctr data found' });
        }

        // Update each course in the data array with exam information
        lctrDoc.data = lctrDoc.data.map(course => {
            const uniqueId = `${course.dkodu}-${course.sube}`;
            const examInfo = groupedExams[uniqueId];
            if (examInfo) {
                return {
                    ...course,
                    examDate: examInfo.date,
                    examTime: examInfo.time,
                    examSiniflar: examInfo.siniflar
                };
            }
            return {
                ...course,
                examDate: null,
                examTime: null,
                examSiniflar: []
            };
        });

        // Save the updated document
        await lctrDoc.save();

        res.json({ message: 'Exam schedules saved successfully' });
    } catch (error) {
        console.error('Save exam schedule error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
