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

        // Ensure lctr data is properly structured and include exam scheduling information
        const lctrArray = Array.isArray(lctrData.data) ? lctrData.data.map(course => {
            // Ensure ogrenciler is always an array
            const ogrenciler = Array.isArray(course.ogrenciler) ? course.ogrenciler : [];
            
            return {
                ...course,
                ogrenciler,
                uniqueId: `${course.dkodu}-${course.sube}`, // Add unique identifier
                studentCount: ogrenciler.length, // Add explicit student count from ogrenciler array
                examDate: course.examDate || null,
                examTime: course.examTime || null,
                examSiniflar: Array.isArray(course.examSiniflar) ? course.examSiniflar : []
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

// Analiz endpoint'i
// Program listesini getiren endpoint
router.get('/api/programs', async (req, res) => {
    try {
        const lctrDoc = await LctrData.findOne().sort({ createdAt: -1 });
        if (!lctrDoc) {
            return res.status(404).json({ message: 'No lctr data found' });
        }

        // Benzersiz program değerlerini topla
        const programs = new Set();
        lctrDoc.data.forEach(course => {
            if (course.program) {
                programs.add(course.program);
            }
        });

        // Set'i diziye çevir ve sırala
        const sortedPrograms = Array.from(programs).sort();
        res.json(sortedPrograms);
    } catch (error) {
        console.error('Get programs error:', error);
        res.status(500).json({ message: error.message });
    }
});

const Sorunlu = require('../models/Sorunlu');

router.get('/api/analyze-exams', async (req, res) => {
    try {
        const [lctrDoc, sorunluDoc] = await Promise.all([
            LctrData.findOne().sort({ createdAt: -1 }),
            Sorunlu.findOne().sort({ createdAt: -1 })
        ]);

        if (!lctrDoc) {
            return res.status(404).json({ message: 'No lctr data found' });
        }

        // Gün bazlı sınav sayılarını hesapla
        const studentExamCounts = new Map(); // öğrenci -> {date -> Set<uniqueId>}
        
        // Sorunlu dersleri hazırla
        const sorunluVeriler = sorunluDoc ? (Array.isArray(sorunluDoc.data) ? sorunluDoc.data : []) : [];

        // Normal dersleri işle
        lctrDoc.data.forEach(course => {
            try {
                if (!course.examDate || !Array.isArray(course.ogrenciler) || 
                    !Array.isArray(course.examSiniflar) || 
                    !course.examSiniflar.length > 0) {
                    return;
                }

                // Tarih formatını kontrol et ve düzelt
                const dateObj = new Date(course.examDate);
                if (isNaN(dateObj.getTime())) {
                    console.error(`Invalid date format for course ${course.dkodu}-${course.sube}: ${course.examDate}`);
                    return;
                }
                const examDate = dateObj.toISOString().split('T')[0];
                const uniqueId = `${course.dkodu}-${course.sube}`;
                
                course.ogrenciler.forEach(student => {
                    try {
                        if (!studentExamCounts.has(student)) {
                            studentExamCounts.set(student, new Map());
                        }
                        const studentDates = studentExamCounts.get(student);
                        if (!studentDates.has(examDate)) {
                            studentDates.set(examDate, new Set());
                        }
                        studentDates.get(examDate).add(uniqueId);
                    } catch (error) {
                        console.error(`Error processing student ${student} for course ${course.dkodu}-${course.sube}:`, error);
                    }
                });
            } catch (error) {
                console.error(`Error processing regular course ${course.dkodu}-${course.sube}:`, error);
            }
        });

        // Sorunlu dersleri işle
        sorunluVeriler.forEach(course => {
            try {
                // TAKVİM sayfasından gelen tarih formatını kontrol et ve dönüştür
                let examDate;
                if (course.examDate) {
                    // Tarih formatını kontrol et ve düzelt
                    const dateObj = new Date(course.examDate);
                    if (isNaN(dateObj.getTime())) {
                        console.error(`Invalid date format for course ${course.dkodu}-${course.sube}: ${course.examDate}`);
                        return; // Bu dersi atla
                    }
                    examDate = dateObj.toISOString().split('T')[0];
                } else {
                    return; // Tarihi olmayan dersi atla
                }

                if (Array.isArray(course.ogrenciler) && Array.isArray(course.examSiniflar)) {
                    const uniqueId = `${course.dkodu}-${course.sube}`;
                    
                    course.ogrenciler.forEach(student => {
                        if (!studentExamCounts.has(student)) {
                            studentExamCounts.set(student, new Map());
                        }
                        const studentDates = studentExamCounts.get(student);
                        if (!studentDates.has(examDate)) {
                            studentDates.set(examDate, new Set());
                        }
                        studentDates.get(examDate).add(uniqueId);
                    });
                }
            } catch (error) {
                console.error(`Error processing problematic course ${course.dkodu}-${course.sube}:`, error);
            }
        });

        // En fazla sınavı olan öğrenciyi bul
        let maxExamStudent = null;
        let maxExamCount = 0;
        let maxExamDate = null;

        try {
            studentExamCounts.forEach((dates, student) => {
                try {
                    dates.forEach((uniqueExams, date) => {
                        try {
                            const count = uniqueExams.size;
                            if (count > maxExamCount) {
                                maxExamCount = count;
                                maxExamStudent = student;
                                maxExamDate = date;
                            }
                        } catch (error) {
                            console.error(`Error processing exams for date ${date} for student ${student}:`, error);
                        }
                    });
                } catch (error) {
                    console.error(`Error processing dates for student ${student}:`, error);
                }
            });
        } catch (error) {
            console.error('Error finding student with max exams:', error);
        }

        // Belirli bir öğrencinin sınav programını getir
        const getStudentSchedule = (studentNo) => {
            const schedule = [];
            
            // Normal dersleri ekle
            lctrDoc.data.forEach(course => {
                try {
                    if (!course.examDate || !Array.isArray(course.ogrenciler) || 
                        !Array.isArray(course.examSiniflar) || 
                        !course.examSiniflar.length > 0 || 
                        !course.ogrenciler.includes(studentNo)) {
                        return;
                    }
                    
                    // Tarih formatını kontrol et ve düzelt
                    const dateObj = new Date(course.examDate);
                    if (isNaN(dateObj.getTime())) {
                        console.error(`Invalid date format for course ${course.dkodu}-${course.sube}: ${course.examDate}`);
                        return;
                    }
                    const examDate = dateObj.toISOString().split('T')[0];
                    
                    schedule.push({
                        date: examDate,
                        time: course.examTime,
                        course: `${course.dkodu}-${course.sube}`,
                        isProblematic: course.isProblematic || false,
                        siniflar: course.examSiniflar
                    });
                } catch (error) {
                    console.error(`Error processing regular course ${course.dkodu}-${course.sube} for student ${studentNo}:`, error);
                }
            });

            // Sorunlu dersleri ekle
            sorunluVeriler.forEach(course => {
                try {
                    if (!course.examDate || !Array.isArray(course.ogrenciler) || 
                        !Array.isArray(course.examSiniflar) || 
                        !course.ogrenciler.includes(studentNo)) {
                        return;
                    }
                    
                    // Tarih formatını kontrol et ve düzelt
                    const dateObj = new Date(course.examDate);
                    if (isNaN(dateObj.getTime())) {
                        console.error(`Invalid date format for course ${course.dkodu}-${course.sube}: ${course.examDate}`);
                        return;
                    }
                    const examDate = dateObj.toISOString().split('T')[0];
                    
                    schedule.push({
                        date: examDate,
                        time: course.examTime,
                        course: `${course.dkodu}-${course.sube}`,
                        isProblematic: true,
                        siniflar: course.examSiniflar
                    });
                } catch (error) {
                    console.error(`Error processing problematic course ${course.dkodu}-${course.sube} for student ${studentNo}:`, error);
                }
            });

            return schedule.sort((a, b) => new Date(a.date) - new Date(b.date));
        };

        // Eğer öğrenci numarası varsa, o öğrencinin programını getir
        const { studentNo } = req.query;
        if (studentNo) {
            const schedule = getStudentSchedule(studentNo);
            res.json({ schedule });
        } else {
            // Öğrenci numarası yoksa, en yoğun sınav bilgisini getir
            res.json({
                maxExams: {
                    student: maxExamStudent,
                    count: maxExamCount,
                    date: maxExamDate
                }
            });
        }
    } catch (error) {
        console.error('Analyze exams error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
