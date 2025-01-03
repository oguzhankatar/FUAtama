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

        // Ensure sorunlu data is properly structured and convert to plain objects
        const sorunluArray = Array.isArray(sorunluData.data) ? 
            sorunluData.data.map(course => {
                const plainCourse = course.toObject();
                // Ensure examSlots exists
                if (!plainCourse.examSlots) {
                    plainCourse.examSlots = [];
                }
                return plainCourse;
            }) : [];

        console.log('Sending calendar data:', {
            coursesCount: sorunluArray.length,
            sinifsCount: sinifsData.length,
            sampleCourse: sorunluArray[0] ? {
                dkodu: sorunluArray[0].dkodu,
                sube: sorunluArray[0].sube,
                examSlots: sorunluArray[0].examSlots
            } : null
        });

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

        // Ensure examData is an array, even if empty
        const examArray = Array.isArray(examData) ? examData : [];

        // Get the latest Sorunlu document
        const sorunluDoc = await Sorunlu.findOne().sort({ createdAt: -1 });
        if (!sorunluDoc) {
            return res.status(404).json({ message: 'No sorunlu data found' });
        }

        // Create a map to store exam slots for each course
        const courseExams = new Map();
        
        // Group exam slots by course
        examArray.forEach(exam => {
            const key = `${exam.dkodu}-${exam.sube}`;
            if (!courseExams.has(key)) {
                courseExams.set(key, []);
            }
            courseExams.get(key).push({
                date: exam.date,
                time: exam.time,
                sinif: exam.sinif
            });
        });

        console.log('Grouped course exams:', Object.fromEntries(courseExams));

        // Update all courses with exam information
        sorunluDoc.data = sorunluDoc.data.map(course => {
            const key = `${course.dkodu}-${course.sube}`;
            const examSlots = courseExams.get(key) || [];
            
            console.log(`Processing course ${key}:`, {
                examSlots: examSlots,
                hasExamSlots: examSlots.length > 0
            });

            // Create a new course object with updated exam information
            const updatedCourse = {
                ...course.toObject(),  // Convert to plain object to avoid Mongoose issues
                examSlots: examSlots,
                // Keep these for backward compatibility
                examDate: examSlots.length > 0 ? examSlots[0].date : null,
                examTime: examSlots.length > 0 ? examSlots[0].time : null,
                examSiniflar: examSlots.length > 0 ? examSlots.map(slot => slot.sinif) : []
            };

            console.log(`Updated course data:`, updatedCourse);
            return updatedCourse;
        });

        console.log('Final sorunluDoc data:', sorunluDoc.data);

        // Save the updated document
        await sorunluDoc.save();

        res.json({ message: 'Exam schedules saved successfully' });
    } catch (error) {
        console.error('Save exam schedule error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
