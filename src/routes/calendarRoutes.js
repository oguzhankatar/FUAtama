const express = require('express');
const router = express.Router();
const Sorunlu = require('../models/Sorunlu');
const Sinifs = require('../models/Sinifs');

router.get('/api/calendar-data', async (req, res) => {
    try {
        // Get date range from query parameters (optional)
        const { startDate, endDate } = req.query;

        const [sorunluData, sinifsData] = await Promise.all([
            Sorunlu.findOne().sort({ createdAt: -1 }),
            Sinifs.find().sort({ name: 1 })
        ]);

        if (!sorunluData) {
            return res.status(404).json({ message: 'No sorunlu data found' });
        }

        // Ensure sorunlu data is properly structured
        const sorunluArray = Array.isArray(sorunluData.data) ? sorunluData.data : [];

        // Send the data along with the date range for future use
        res.json({
            sorunlu: sorunluArray,
            sinifs: sinifsData,
            dateRange: {
                startDate: startDate || null,
                endDate: endDate || null
            }
        });
    } catch (error) {
        console.error('Calendar data error:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/api/save-exam-schedule', async (req, res) => {
    try {
        const { examData } = req.body;

        if (!Array.isArray(examData)) {
            return res.status(400).json({ message: 'Invalid exam data format' });
        }

        // Group exams by dkodu
        const groupedExams = examData.reduce((acc, exam) => {
            if (!acc[exam.dkodu]) {
                acc[exam.dkodu] = {
                    date: exam.date,
                    time: exam.time,
                    siniflar: []
                };
            }
            if (!acc[exam.dkodu].siniflar.includes(exam.sinif)) {
                acc[exam.dkodu].siniflar.push(exam.sinif);
            }
            return acc;
        }, {});

        // Get the latest Sorunlu document
        const sorunluDoc = await Sorunlu.findOne().sort({ createdAt: -1 });
        if (!sorunluDoc) {
            return res.status(404).json({ message: 'No sorunlu data found' });
        }

        // Update each course in the data array with exam information
        sorunluDoc.data = sorunluDoc.data.map(course => {
            const examInfo = groupedExams[course.dkodu];
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
        await sorunluDoc.save();

        res.json({ message: 'Exam schedules saved successfully' });
    } catch (error) {
        console.error('Save exam schedule error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
