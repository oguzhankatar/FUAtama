const express = require('express');
const router = express.Router();
const LctrData = require('../models/LctrData');
const Gozetmen = require('../models/Gozetmen');
const Sorunlu = require('../models/Sorunlu');

// Get all exams with their assignments
router.get('/exams', async (req, res) => {
    console.log('GET /api/atama/exams endpoint hit');
    try {
        const { date } = req.query;
        console.log('Date filter:', date);
        // Get both LCTR and Sorunlu data
        const [lctrData, sorunluData] = await Promise.all([
            LctrData.findOne().sort({ createdAt: -1 }),
            Sorunlu.findOne().sort({ createdAt: -1 })
        ]);
        
        if (!lctrData && !sorunluData) {
            return res.status(404).json({ message: 'No exam data found' });
        }

        // Combine and format exam data
        let allExams = [];
        
        // Add LCTR data if exists
        if (lctrData) {
            allExams = [...lctrData.data];
        }

        // Add Sorunlu data if exists
        if (sorunluData) {
            allExams = [...allExams, ...sorunluData.data];
        }

        // Filter exams by date if provided
        let exams = allExams.filter(exam => {
            console.log('Exam:', exam.dkodu, 'Date:', exam.examDate, 'Time:', exam.examTime);
            return exam.examDate && exam.examTime;
        });
        console.log('Exams with date and time:', exams.length);
        
        if (date) {
            exams = exams.filter(exam => exam.examDate === date);
            console.log('Exams after date filter:', exams.length);
        }

        // Get all gözetmenler to include assignment info
        const gozetmenler = await Gozetmen.find({});
        const gozetmenMap = new Map(gozetmenler.map(g => [g._id.toString(), g]));

        // Format exam data with assignment information
        const formattedExams = exams.map(exam => {
            // Get classroom-specific assignments
            // Get all assigned gözetmenler for this exam
            const assignedGozetmenler = gozetmenler.filter(g => 
                g.assignments?.some(a => 
                    a.dkodu === exam.dkodu && 
                    a.sube === exam.sube &&
                    a.examDate === exam.examDate &&
                    a.examTime === exam.examTime
                )
            ).map(g => ({
                _id: g._id,
                ad: g.ad,
                blm: g.blm,
                kisa: g.kisa,
                assignments: g.assignments.filter(a =>
                    a.dkodu === exam.dkodu &&
                    a.sube === exam.sube &&
                    a.examDate === exam.examDate &&
                    a.examTime === exam.examTime
                )
            }));

            return {
                dkodu: exam.dkodu,
                sube: exam.sube,
                dersadi: exam.dersadi || exam.dadi,
                program: exam.program,
                examDate: exam.examDate,
                examTime: exam.examTime,
                examSiniflar: exam.examSiniflar || [],
                studentCount: exam.ogrenciler?.length || 0,
                assignedGozetmenler: assignedGozetmenler.map(g => ({
                    _id: g._id,
                    ad: g.ad,
                    blm: g.blm,
                    kisa: g.kisa,
                    assignments: g.assignments.filter(a => 
                        a.dkodu === exam.dkodu &&
                        a.sube === exam.sube &&
                        a.examDate === exam.examDate &&
                        a.examTime === exam.examTime
                    )
                }))
            };
        });

        console.log('Formatted exams count:', formattedExams.length);
        res.json(formattedExams);
    } catch (error) {
        console.error('Get exams error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get all gözetmenler with their assignments
router.get('/gozetmenler', async (req, res) => {
    console.log('GET /api/atama/gozetmenler endpoint hit');
    try {
        const gozetmenler = await Gozetmen.find({});
        console.log('Found gözetmenler count:', gozetmenler.length);
        res.json(gozetmenler);
    } catch (error) {
        console.error('Get gözetmenler error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Assign gözetmen to exam
// Remove gözetmen from exam
router.post('/remove', async (req, res) => {
    try {
        const { gozetmenId, exam } = req.body;

        const gozetmen = await Gozetmen.findById(gozetmenId);
        if (!gozetmen) {
            return res.status(404).json({ message: 'Gözetmen bulunamadı' });
        }

        // Remove the assignment
        gozetmen.assignments = gozetmen.assignments.filter(a => 
            !(a.dkodu === exam.dkodu &&
              a.sube === exam.sube &&
              a.examDate === exam.examDate &&
              a.examTime === exam.examTime &&
              a.sinif === exam.sinif)
        );

        await gozetmen.save();
        res.json({ message: 'Gözetmen sınavdan çıkarıldı' });
    } catch (error) {
        console.error('Error removing assignment:', error);
        res.status(500).json({ message: 'Gözetmen çıkarma işlemi sırasında bir hata oluştu' });
    }
});

router.post('/assign', async (req, res) => {
    console.log('POST /api/atama/assign endpoint hit', req.body);
    try {
        const { gozetmenId, exam } = req.body;

        if (!gozetmenId || !exam) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const gozetmen = await Gozetmen.findById(gozetmenId);
        if (!gozetmen) {
            return res.status(404).json({ message: 'Gözetmen not found' });
        }

        // Check if gözetmen is already assigned to this classroom
        const existingAssignment = gozetmen.assignments?.find(a => 
            a.dkodu === exam.dkodu &&
            a.sube === exam.sube &&
            a.examDate === exam.examDate &&
            a.examTime === exam.examTime &&
            a.sinif === exam.sinif
        );

        if (existingAssignment) {
            return res.status(400).json({ message: 'Gözetmen bu sınıfa zaten atanmış' });
        }

        // Check if classroom already has enough supervisors
        const classroomAssignments = await Gozetmen.find({
            'assignments': {
                $elemMatch: {
                    dkodu: exam.dkodu,
                    sube: exam.sube,
                    examDate: exam.examDate,
                    examTime: exam.examTime,
                    sinif: exam.sinif
                }
            }
        });

        if (classroomAssignments.length >= 2) {
            return res.status(400).json({ message: 'Bu sınıfa maksimum gözetmen sayısına ulaşıldı' });
        }

        // Check if gözetmen has another exam at the same time
        const conflictingAssignment = gozetmen.assignments?.find(a => 
            a.examDate === exam.examDate &&
            a.examTime === exam.examTime
        );

        if (conflictingAssignment) {
            return res.status(400).json({ message: 'Gözetmenin bu saatte başka bir sınavı var' });
        }

        // Add new assignment
        if (!gozetmen.assignments) {
            gozetmen.assignments = [];
        }

        gozetmen.assignments.push({
            dkodu: exam.dkodu,
            sube: exam.sube,
            examDate: exam.examDate,
            examTime: exam.examTime,
            sinif: exam.sinif
        });

        await gozetmen.save();
        res.json({ message: 'Assignment successful' });
    } catch (error) {
        console.error('Assignment error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Remove gözetmen assignment
// Remove all assignments from all gözetmenler
router.post('/removeAllAssignments', async (req, res) => {
    try {
        await Gozetmen.updateMany({}, { $set: { assignments: [] } });
        res.json({ message: 'Tüm atamalar silindi' });
    } catch (error) {
        console.error('Error removing all assignments:', error);
        res.status(500).json({ message: 'Atama silme işlemi sırasında bir hata oluştu' });
    }
});

// Remove all assignments for a gözetmen
router.post('/removeAll', async (req, res) => {
    try {
        const { gozetmenId } = req.body;

        const gozetmen = await Gozetmen.findById(gozetmenId);
        if (!gozetmen) {
            return res.status(404).json({ message: 'Gözetmen bulunamadı' });
        }

        // Remove all assignments
        gozetmen.assignments = [];
        await gozetmen.save();
        
        res.json({ message: 'Tüm atamalar silindi' });
    } catch (error) {
        console.error('Error removing all assignments:', error);
        res.status(500).json({ message: 'Atama silme işlemi sırasında bir hata oluştu' });
    }
});

router.delete('/unassign', async (req, res) => {
    console.log('DELETE /api/atama/unassign endpoint hit', req.body);
    try {
        const { gozetmenId, exam } = req.body;

        if (!gozetmenId || !exam) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const gozetmen = await Gozetmen.findById(gozetmenId);
        if (!gozetmen) {
            return res.status(404).json({ message: 'Gözetmen not found' });
        }

        // Remove the assignment
        if (gozetmen.assignments) {
            gozetmen.assignments = gozetmen.assignments.filter(a => 
                !(a.dkodu === exam.dkodu &&
                  a.sube === exam.sube &&
                  a.examDate === exam.examDate &&
                  a.examTime === exam.examTime)
            );
        }

        await gozetmen.save();
        res.json({ message: 'Assignment removed successfully' });
    } catch (error) {
        console.error('Unassignment error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
