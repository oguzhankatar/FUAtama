// Global state
let showClassrooms = true;
let currentExamData = null;
let currentActivePeriod = null;
let currentDateColorMap = null;

document.addEventListener('DOMContentLoaded', function() {
    loadPrograms();
    document.getElementById('programSelect').addEventListener('change', handleProgramChange);
    document.getElementById('printBtn').addEventListener('click', handlePrint);
    document.getElementById('toggleSupervisors').addEventListener('click', handleToggleClassrooms);
});

async function loadPrograms() {
    try {
        const response = await fetch('/api/report/programs');
        if (!response.ok) throw new Error('Program verileri alınamadı');
        
        const programs = await response.json();
        const select = document.getElementById('programSelect');
        
        programs.sort((a, b) => a.localeCompare(b));
        
        programs.forEach(program => {
            const option = document.createElement('option');
            option.value = program;
            option.textContent = program;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error:', error);
        alert('Programlar yüklenirken bir hata oluştu.');
    }
}

async function handleProgramChange(event) {
    const program = event.target.value;
    if (!program) {
        document.getElementById('reportContainer').classList.add('d-none');
        return;
    }

    try {
        const [examResponse, periodResponse, grpResponse] = await Promise.all([
            fetch(program === 'FAKULTE' ? 
                '/api/report/exam-data-all' : 
                `/api/report/exam-data/${encodeURIComponent(program)}`),
            fetch('/api/report/active-period'),
            fetch('/api/lctr/data')
        ]);

        if (!examResponse.ok) throw new Error('Sınav verileri alınamadı');
        if (!periodResponse.ok) throw new Error('Aktif dönem bilgisi alınamadı');
        if (!grpResponse.ok) throw new Error('GRP verileri alınamadı');
        
        const examData = await examResponse.json();
        const activePeriod = await periodResponse.json();
        const grpData = await grpResponse.json();
        
        // Process exam data with GRP information
        const processedExamData = program === 'FAKULTE' ? 
            examData : 
            processExamDataWithGRP(examData, grpData[0]?.data || [], program);
        
        currentExamData = processedExamData;
        currentActivePeriod = activePeriod;
        
        displayReport(program, processedExamData, activePeriod);
    } catch (error) {
        console.error('Error:', error);
        alert('Veriler yüklenirken bir hata oluştu.');
    }
}

function processExamDataWithGRP(examData, grpData, selectedProgram) {
    let processedData = [...examData];

    // First, find all GRP courses that contain courses from the selected program
    grpData.forEach(grp => {
        if (grp.dkodu?.startsWith('GRP') && grp.originalCards) {
            // Find courses from the selected program in originalCards
            const programCourses = grp.originalCards.filter(card => card.program === selectedProgram);
            
            // Add these courses to processedData with GRP's scheduling info
            programCourses.forEach(course => {
                // Check if the course is already in examData
                const existingCourse = processedData.find(exam => exam.DersKodu === course.dkodu);
                
                if (existingCourse) {
                    // Update existing course with GRP info
                    existingCourse.Tarih = grp.examDate;
                    existingCourse.Saat = grp.examTime;
                    existingCourse.Sinif = grp.examSiniflar?.join(', ');
                    existingCourse.Gozetmen = grp.assignedGozetmenler?.map(g => g.ad).join(', ');
                } else {
                    // Add new course with GRP info
                    processedData.push({
                        DersKodu: course.dkodu,
                        DersAdi: course.dadi,
                        Program: course.program,
                        Sube: course.sube,
                        Tarih: grp.examDate,
                        Saat: grp.examTime,
                        Sinif: grp.examSiniflar?.join(', '),
                        Gozetmen: grp.assignedGozetmenler?.map(g => g.ad).join(', '),
                        DersinHocasi: course.hoca || ''
                    });
                }
            });
        }
    });

    // Sort processed data by DersKodu
    return processedData.sort((a, b) => a.DersKodu.localeCompare(b.DersKodu));
}

const dayColors = [
    '#FFD8B2', '#E0FFE0', '#E0E0FF', '#FFE0FF', '#FFFFE0', '#FFE0E6', '#E0FFFF'
];

function displayReport(program, examData, activePeriod) {
    const uniqueDates = [...new Set(examData
        .map(exam => exam.Tarih ? formatDate(exam.Tarih) : '')
        .filter(date => date)
    )].sort();

    const dateColorMap = new Map();
    uniqueDates.forEach((date, index) => {
        dateColorMap.set(date, dayColors[index % dayColors.length]);
    });

    currentDateColorMap = dateColorMap;

    document.querySelector('.program-name').textContent = program === 'FAKULTE' ? 'TÜM FAKÜLTE PROGRAMLARI' : program;
    document.querySelector('.report-date').textContent = 
        `Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;

    const tableHeader = document.querySelector('thead tr');
    const isSupervised = examData.length > 0 && 'Gozetmen' in examData[0];
    tableHeader.innerHTML = `
        <th>Sıra</th>
        <th>Ders Kodu</th>
        <th>Ders Adı</th>
        ${program === 'FAKULTE' ? '<th>Program</th>' : ''}
        ${program === 'ORT' ? '<th>Şube</th>' : ''}
        <th>Tarih</th>
        <th>Saat</th>
        <th>${isSupervised ? 'Sınıf - Gözetmen' : 'Sınıf'}</th>
        <th>Dersin Hocası</th>
    `;

    const tableBody = document.getElementById('examTable');
    tableBody.innerHTML = '';

    examData.forEach((exam, index) => {
        const row = document.createElement('tr');
        const formattedDate = formatDate(exam.Tarih);
        const backgroundColor = dateColorMap.get(formattedDate) || '';
        const pairs = formatClassAndSupervisor(exam.Sinif || '', exam.Gozetmen || '').pairs;
        
        row.style.backgroundColor = backgroundColor;
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${exam.DersKodu || ''}</td>
            <td>${exam.DersAdi || ''}</td>
            ${program === 'FAKULTE' ? `<td>${exam.Program || ''}</td>` : ''}
            ${program === 'ORT' ? `<td>${exam.Sube || ''}</td>` : ''}
            <td>${formattedDate || ''}</td>
            <td>${exam.Saat || ''}</td>
            <td style="font-size: 0.85em; padding: 4px 8px;"><div style="white-space: nowrap">${pairs.join('</div><div style="white-space: nowrap">')}</div></td>
            <td>${exam.DersinHocasi || ''}</td>
        `;
        tableBody.appendChild(row);
    });

    createWeeklyView(examData, activePeriod, dateColorMap);
    document.getElementById('reportContainer').classList.remove('d-none');
}

// Rest of the functions remain the same...
function createWeeklyView(examData, activePeriod, dateColorMap) {
    const weeklySchedule = document.getElementById('weeklySchedule');
    weeklySchedule.innerHTML = '';

    const examDates = new Map();
    const examTimes = new Set();

    examData.forEach(exam => {
        if (exam.Tarih && exam.Saat) {
            const date = new Date(exam.Tarih);
            const dateStr = formatDate(date);
            const dayName = getDayName(date.getDay());
            examDates.set(dateStr, dayName);
            examTimes.add(exam.Saat.trim());
        }
    });

    const sortedDates = Array.from(examDates.entries())
        .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));
    
    const sortedTimes = Array.from(examTimes)
        .sort((a, b) => {
            const [aHour] = a.split(':').map(Number);
            const [bHour] = b.split(':').map(Number);
            return aHour - bHour;
        });

    const timetableHeader = document.querySelector('.timetable-header');
    timetableHeader.innerHTML = '<div class="time-column">Saat</div>';
    sortedDates.forEach(([date, dayName]) => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        dayColumn.style.backgroundColor = dateColorMap.get(date) || '';
        dayColumn.innerHTML = `${dayName}<br>${date}`;
        timetableHeader.appendChild(dayColumn);
    });

    const gridColumns = `100px repeat(${sortedDates.length}, 1fr)`;
    timetableHeader.style.gridTemplateColumns = gridColumns;

    sortedTimes.forEach(time => {
        const row = document.createElement('div');
        row.className = 'time-slot-row';
        row.style.gridTemplateColumns = gridColumns;
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.textContent = time;
        row.appendChild(timeLabel);

        sortedDates.forEach(([date]) => {
            const daySlot = document.createElement('div');
            daySlot.className = 'day-slot';
            daySlot.style.backgroundColor = dateColorMap.get(date) || '';
            
            const dayExams = examData.filter(exam => 
                exam.Saat && exam.Saat.trim() === time &&
                formatDate(new Date(exam.Tarih)) === date
            );

            dayExams.forEach(exam => {
                const examItem = document.createElement('div');
                examItem.className = 'exam-item';
                const classes = exam.Sinif ? exam.Sinif.split(',').map(c => c.trim()).filter(c => c) : [];
                
                examItem.innerHTML = `
                    <div class="exam-code">${exam.DersKodu}</div>
                    ${showClassrooms ? `
                        <div class="exam-classes" style="font-size: 0.85em;">
                            ${classes.map(c => `<div style="white-space: nowrap">${c}</div>`).join('')}
                        </div>
                    ` : ''}
                `;
                daySlot.appendChild(examItem);
            });

            row.appendChild(daySlot);
        });

        weeklySchedule.appendChild(row);
    });
}

function getDayName(dayIndex) {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return days[dayIndex];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR');
}

function handlePrint() {
    window.print();
}

function handleToggleClassrooms() {
    showClassrooms = !showClassrooms;
    const button = document.getElementById('toggleSupervisors');
    const icon = button.querySelector('i');
    
    if (showClassrooms) {
        icon.className = 'fas fa-eye';
        button.title = 'Sınıfları Gizle';
    } else {
        icon.className = 'fas fa-eye-slash';
        button.title = 'Sınıfları Göster';
    }

    if (currentExamData && currentActivePeriod && currentDateColorMap) {
        createWeeklyView(currentExamData, currentActivePeriod, currentDateColorMap);
    }
}

function formatClassAndSupervisor(classStr, supervisorStr) {
    if (!classStr && !supervisorStr) return { pairs: [''] };
    
    const classes = classStr.split(',').map(item => item.trim());
    const supervisors = supervisorStr.split(',').map(item => item.trim());
    
    const maxLength = Math.max(classes.length, supervisors.length);
    while (classes.length < maxLength) classes.push('');
    while (supervisors.length < maxLength) supervisors.push('');
    
    const pairs = classes.map((classItem, index) => {
        const supervisor = supervisors[index];
        if (!classItem && !supervisor) return '';
        if (!classItem) return `BOŞ - ${supervisor}`;
        if (!supervisor) return `${classItem} - BOŞ`;
        return `${classItem} - ${supervisor}`;
    }).filter(item => item);
    
    const formattedPairs = pairs.map(pair => pair.replace(' - ', ' -\u00A0'));
    
    return {
        pairs: formattedPairs.length ? formattedPairs : [''],
        combined: formattedPairs.length ? formattedPairs.join(' | ') : ''
    };
}
