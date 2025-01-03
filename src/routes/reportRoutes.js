const express = require('express');
const router = express.Router();
const LctrData = require('../models/LctrData');
const Sorunlu = require('../models/Sorunlu');
const ActivePeriod = require('../models/activePeriod');
const Gozetmen = require('../models/Gozetmen');

// Get unique classes from lctrdatas
router.get('/classes', async (req, res) => {
    try {
        // Get the most recent lctrData document
        const lctrData = await LctrData.findOne().sort({ uploadDate: -1 });
        
        const allClasses = new Set();

        // Add classes from lctrData
        if (lctrData && lctrData.data && Array.isArray(lctrData.data)) {
            lctrData.data
                .filter(item => item && item.examSiniflar && Array.isArray(item.examSiniflar))
                .forEach(item => {
                    item.examSiniflar.forEach(sinif => {
                        if (sinif && sinif.trim()) {
                            allClasses.add(sinif.trim());
                        }
                    });
                });
        }

        // Convert to array, filter empty strings, and sort
        const classes = [...allClasses]
            .filter(className => className !== '')
            .sort((a, b) => a.localeCompare(b, 'tr'));

        console.log('Found classes:', classes); // Debug log
        res.json(classes);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get exam data for a specific class
router.get('/class-exam-data/:className', async (req, res) => {
    try {
        const { className } = req.params;
        
        // Get the most recent documents from all collections
        const [lctrData, sorunluData, gozetmenData] = await Promise.all([
            LctrData.findOne().sort({ uploadDate: -1 }),
            Sorunlu.findOne().sort({ uploadDate: -1 }),
            Gozetmen.find({})
        ]);

        // Create a map of exam details to supervisor
        const supervisorMap = new Map();
        gozetmenData.forEach(gozetmen => {
            if (gozetmen.assignments) {
                gozetmen.assignments.forEach(assignment => {
                    const key = `${assignment.dkodu}-${assignment.examDate}-${assignment.examTime}-${assignment.sinif}`;
                    supervisorMap.set(key, gozetmen.ad);
                });
            }
        });

        let allExams = [];

        // Process lctrData
        if (lctrData && lctrData.data && Array.isArray(lctrData.data)) {
            const lctrExams = lctrData.data
                .filter(item => 
                    item && 
                    item.examSiniflar && 
                    Array.isArray(item.examSiniflar) &&
                    item.examSiniflar.some(sinif => sinif && sinif.trim() === className.trim())
                )
                .map(item => ({
                    DersKodu: item.dkodu || '',
                    DersAdi: item.dadi || '',
                    Program: item.program || '',
                    Tarih: item.examDate || '',
                    Saat: item.examTime || '',
                    DersinHocasi: item.hoca || '',
                    Gozetmen: (() => {
                        const currentClassKey = `${item.dkodu}-${item.examDate}-${item.examTime}-${className}`;
                        return supervisorMap.get(currentClassKey) || '';
                    })() || '',
                    source: 'lctrdata'
                }));
            allExams = allExams.concat(lctrExams);
        }

        // Process sorunluData
        if (sorunluData && sorunluData.data && Array.isArray(sorunluData.data)) {
            const sorunluExams = sorunluData.data
                .filter(item => 
                    item && 
                    item.examSiniflar && 
                    Array.isArray(item.examSiniflar) &&
                    item.examSiniflar.some(sinif => sinif && sinif.trim() === className.trim())
                )
                .map(item => ({
                    DersKodu: item.dkodu || '',
                    DersAdi: item.dadi || '',
                    Program: item.program || '',
                    Tarih: item.examDate || '',
                    Saat: item.examTime || '',
                    DersinHocasi: item.hoca || '',
                    Gozetmen: (() => {
                        const currentClassKey = `${item.dkodu}-${item.examDate}-${item.examTime}-${className}`;
                        return supervisorMap.get(currentClassKey) || '';
                    })() || '',
                    source: 'sorunlu'
                }));
            allExams = allExams.concat(sorunluExams);
        }

        // Remove source field from all exams
        const classData = allExams.map(({ source, ...item }) => item);
        
        // Sort by date and time
        classData.sort((a, b) => {
            const dateA = a.Tarih ? new Date(a.Tarih) : new Date(0);
            const dateB = b.Tarih ? new Date(b.Tarih) : new Date(0);
            
            if (dateA.getTime() === dateB.getTime()) {
                return (a.Saat || '').localeCompare(b.Saat || '');
            }
            return dateA - dateB;
        });

        console.log(`Found ${classData.length} exams for class: ${className}`); // Debug log
        res.json(classData);
    } catch (error) {
        console.error('Error fetching class exam data:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get unique programs from both lctrdatas and sorunlus
router.get('/programs', async (req, res) => {
    try {
        // Get the most recent documents from both collections
        const [lctrData, sorunluData] = await Promise.all([
            LctrData.findOne().sort({ uploadDate: -1 }),
            Sorunlu.findOne().sort({ uploadDate: -1 })
        ]);
        
        const allPrograms = new Set();

        // Add programs from lctrData
        if (lctrData && lctrData.data && Array.isArray(lctrData.data)) {
            lctrData.data
                .filter(item => item && item.program)
                .forEach(item => allPrograms.add(item.program.trim()));
        }

        // Add programs from sorunluData
        if (sorunluData && sorunluData.data && Array.isArray(sorunluData.data)) {
            sorunluData.data
                .filter(item => item && item.program)
                .forEach(item => allPrograms.add(item.program.trim()));
        }

        // Convert to array, filter empty strings, and sort
        const programs = [...allPrograms]
            .filter(program => program !== '')
            .sort((a, b) => a.localeCompare(b, 'tr'));

        console.log('Found programs:', programs); // Debug log
        res.json(programs);
    } catch (error) {
        console.error('Error fetching programs:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get active period
router.get('/active-period', async (req, res) => {
    try {
        const activePeriod = await ActivePeriod.findOne().sort({ _id: -1 });
        if (!activePeriod) {
            return res.status(404).json({ message: 'No active period found' });
        }
        res.json(activePeriod);
    } catch (error) {
        console.error('Error fetching active period:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get exam data for a specific program
router.get('/exam-data/:program', async (req, res) => {
    try {
        const { program } = req.params;
        
        // Get the most recent documents from all collections
        const [lctrData, sorunluData, gozetmenData] = await Promise.all([
            LctrData.findOne().sort({ uploadDate: -1 }),
            Sorunlu.findOne().sort({ uploadDate: -1 }),
            Gozetmen.find({})
        ]);

        // Create a map of exam details to supervisor
        const supervisorMap = new Map();
        gozetmenData.forEach(gozetmen => {
            if (gozetmen.assignments) {
                gozetmen.assignments.forEach(assignment => {
                    const key = `${assignment.dkodu}-${assignment.examDate}-${assignment.examTime}-${assignment.sinif}`;
                    supervisorMap.set(key, gozetmen.ad);
                });
            }
        });

        let allExams = [];

        // Process lctrData
        if (lctrData && lctrData.data && Array.isArray(lctrData.data)) {
            const lctrExams = lctrData.data
                .filter(item => 
                    item && 
                    item.program && 
                    item.program.trim() === program.trim()
                )
                .map(item => ({
                    DersKodu: item.dkodu || '',
                    DersAdi: item.dadi || '',
                    Tarih: item.examDate || '',
                    Saat: item.examTime || '',
                    Sinif: Array.isArray(item.examSiniflar) ? item.examSiniflar.join(', ') : '',
                    Sube: item.program === 'ORT' ? (item.sube || '') : '',
                    DersinHocasi: item.hoca || '',
                    Gozetmen: item.examSiniflar && Array.isArray(item.examSiniflar) ? 
                        item.examSiniflar.map(sinif => {
                            const key = `${item.dkodu}-${item.examDate}-${item.examTime}-${sinif}`;
                            return supervisorMap.get(key) || '';
                        }).filter(g => g).join(', ') || '' : '',
                    source: 'lctrdata'
                }));
            allExams = allExams.concat(lctrExams);
        }

        // Process sorunluData
        if (sorunluData && sorunluData.data && Array.isArray(sorunluData.data)) {
            const sorunluExams = sorunluData.data
                .filter(item => 
                    item && 
                    item.program && 
                    item.program.trim() === program.trim()
                )
                .map(item => ({
                    DersKodu: item.dkodu || '',
                    DersAdi: item.dadi || '',
                    Tarih: item.examDate || '',
                    Saat: item.examTime || '',
                    Sinif: Array.isArray(item.examSiniflar) ? item.examSiniflar.join(', ') : '',
                    Sube: item.program === 'ORT' ? (item.sube || '') : '',
                    DersinHocasi: item.hoca || '',
                    Gozetmen: item.examSiniflar && Array.isArray(item.examSiniflar) ? 
                        item.examSiniflar.map(sinif => {
                            const key = `${item.dkodu}-${item.examDate}-${item.examTime}-${sinif}`;
                            return supervisorMap.get(key) || '';
                        }).filter(g => g).join(', ') || '' : '',
                    source: 'sorunlu'
                }));
            allExams = allExams.concat(sorunluExams);
        }

        // Remove source field from all exams
        const programData = allExams.map(({ source, ...item }) => item);
        
        // Sort by date and time
        programData.sort((a, b) => {
            const dateA = a.Tarih ? new Date(a.Tarih) : new Date(0);
            const dateB = b.Tarih ? new Date(b.Tarih) : new Date(0);
            
            if (dateA.getTime() === dateB.getTime()) {
                return (a.Saat || '').localeCompare(b.Saat || '');
            }
            return dateA - dateB;
        });

        console.log(`Found ${programData.length} exams for program: ${program}`); // Debug log
        res.json(programData);
    } catch (error) {
        console.error('Error fetching exam data:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get unique supervisor names from gozetmens
router.get('/supervisors', async (req, res) => {
    try {
        const supervisors = await Gozetmen.find({}, 'ad').sort({ ad: 1 });
        const supervisorList = supervisors
            .map(s => s.ad)
            .filter(ad => ad && ad.trim() !== '')
            .sort((a, b) => a.localeCompare(b, 'tr'));

        res.json(supervisorList);
    } catch (error) {
        console.error('Error fetching supervisors:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get exam data for all programs
router.get('/exam-data-all', async (req, res) => {
    try {
        // Get the most recent documents from all collections
        const [lctrData, sorunluData, gozetmenData] = await Promise.all([
            LctrData.findOne().sort({ uploadDate: -1 }),
            Sorunlu.findOne().sort({ uploadDate: -1 }),
            Gozetmen.find({})
        ]);

        // Create a map of exam details to supervisor
        const supervisorMap = new Map();
        gozetmenData.forEach(gozetmen => {
            if (gozetmen.assignments) {
                gozetmen.assignments.forEach(assignment => {
                    const key = `${assignment.dkodu}-${assignment.examDate}-${assignment.examTime}-${assignment.sinif}`;
                    supervisorMap.set(key, gozetmen.ad);
                });
            }
        });

        let allExams = [];

        // Process lctrData
        if (lctrData && lctrData.data && Array.isArray(lctrData.data)) {
            const lctrExams = lctrData.data
                .map(item => ({
                    DersKodu: item.dkodu || '',
                    DersAdi: item.dadi || '',
                    Program: item.program || '',
                    Tarih: item.examDate || '',
                    Saat: item.examTime || '',
                    Sinif: Array.isArray(item.examSiniflar) ? item.examSiniflar.join(', ') : '',
                    DersinHocasi: item.hoca || '',
                    Gozetmen: item.examSiniflar && Array.isArray(item.examSiniflar) ? 
                        item.examSiniflar.map(sinif => {
                            const key = `${item.dkodu}-${item.examDate}-${item.examTime}-${sinif}`;
                            return supervisorMap.get(key) || '';
                        }).filter(g => g).join(', ') || '' : '',
                    source: 'lctrdata'
                }));
            allExams = allExams.concat(lctrExams);
        }

        // Process sorunluData
        if (sorunluData && sorunluData.data && Array.isArray(sorunluData.data)) {
            const sorunluExams = sorunluData.data
                .map(item => ({
                    DersKodu: item.dkodu || '',
                    DersAdi: item.dadi || '',
                    Program: item.program || '',
                    Tarih: item.examDate || '',
                    Saat: item.examTime || '',
                    Sinif: Array.isArray(item.examSiniflar) ? item.examSiniflar.join(', ') : '',
                    DersinHocasi: item.hoca || '',
                    Gozetmen: item.examSiniflar && Array.isArray(item.examSiniflar) ? 
                        item.examSiniflar.map(sinif => {
                            const key = `${item.dkodu}-${item.examDate}-${item.examTime}-${sinif}`;
                            return supervisorMap.get(key) || '';
                        }).filter(g => g).join(', ') || '' : '',
                    source: 'sorunlu'
                }));
            allExams = allExams.concat(sorunluExams);
        }

        // Remove source field from all exams
        const facultyData = allExams.map(({ source, ...item }) => item);
        
        // Sort by date and time
        facultyData.sort((a, b) => {
            const dateA = a.Tarih ? new Date(a.Tarih) : new Date(0);
            const dateB = b.Tarih ? new Date(b.Tarih) : new Date(0);
            
            if (dateA.getTime() === dateB.getTime()) {
                return (a.Saat || '').localeCompare(b.Saat || '');
            }
            return dateA - dateB;
        });

        console.log(`Found ${facultyData.length} exams for all programs`); // Debug log
        res.json(facultyData);
    } catch (error) {
        console.error('Error fetching faculty exam data:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get exam data for a specific supervisor
router.get('/supervisor-exams/:supervisor', async (req, res) => {
    try {
        const { supervisor } = req.params;
        
        // Get the supervisor's assignments and the most recent data from all collections
        const [gozetmen, lctrData, sorunluData] = await Promise.all([
            Gozetmen.findOne({ ad: supervisor.trim() }),
            LctrData.findOne().sort({ uploadDate: -1 }),
            Sorunlu.findOne().sort({ uploadDate: -1 })
        ]);
        
        if (!gozetmen || !gozetmen.assignments) {
            return res.json([]);
        }

        // Create maps for course information from both lctrData and sorunluData
        const courseInfoMap = new Map();
        
        // Add course info from lctrData
        if (lctrData && lctrData.data) {
            lctrData.data.forEach(item => {
                if (item.dkodu) {
                    courseInfoMap.set(item.dkodu, {
                        program: item.program || '',
                        dersadi: item.dadi || '',
                        hoca: item.hoca || ''
                    });
                }
            });
        }

        // Add course info from sorunluData
        if (sorunluData && sorunluData.data) {
            sorunluData.data.forEach(item => {
                if (item.dkodu) {
                    courseInfoMap.set(item.dkodu, {
                        program: item.program || '',
                        dersadi: item.dadi || '',
                        hoca: item.hoca || ''
                    });
                }
            });
        }

        // Map assignments to the required format
        const supervisorData = gozetmen.assignments.map(assignment => {
            const courseInfo = courseInfoMap.get(assignment.dkodu) || {};
            return {
                DersKodu: assignment.dkodu || '',
                DersAdi: courseInfo.dersadi || assignment.dersadi || '',
                Program: courseInfo.program || '',
                Tarih: assignment.examDate || '',
                Saat: assignment.examTime || '',
                Sinif: assignment.sinif || '',
                DersHocasi: courseInfo.hoca || ''
            };
        });

        // Sort by date and time
        supervisorData.sort((a, b) => {
            const dateA = a.Tarih ? new Date(a.Tarih) : new Date(0);
            const dateB = b.Tarih ? new Date(b.Tarih) : new Date(0);
            
            if (dateA.getTime() === dateB.getTime()) {
                return (a.Saat || '').localeCompare(b.Saat || '');
            }
            return dateA - dateB;
        });

        res.json(supervisorData);
    } catch (error) {
        console.error('Error fetching supervisor exam data:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
