document.addEventListener('DOMContentLoaded', function() {
    // Load supervisors when page loads
    loadSupervisors();

    // Add event listeners
    document.getElementById('supervisorSelect').addEventListener('change', handleSupervisorChange);
    document.getElementById('printBtn').addEventListener('click', handlePrint);
});

async function loadSupervisors() {
    try {
        const response = await fetch('/api/report/supervisors');
        if (!response.ok) throw new Error('Gözetmen verileri alınamadı');
        
        const supervisors = await response.json();
        const select = document.getElementById('supervisorSelect');
        
        // Sort supervisors alphabetically
        supervisors.sort((a, b) => a.localeCompare(b));
        
        // Add supervisors to select
        supervisors.forEach(supervisor => {
            const option = document.createElement('option');
            option.value = supervisor;
            option.textContent = supervisor;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error:', error);
        alert('Gözetmenler yüklenirken bir hata oluştu.');
    }
}

async function handleSupervisorChange(event) {
    const supervisor = event.target.value;
    if (!supervisor) {
        document.getElementById('reportContainer').classList.add('d-none');
        return;
    }

    try {
        // Fetch both exam data and active period
        const [examResponse, periodResponse] = await Promise.all([
            fetch(`/api/report/supervisor-exams/${encodeURIComponent(supervisor)}`),
            fetch('/api/report/active-period')
        ]);

        if (!examResponse.ok) throw new Error('Sınav verileri alınamadı');
        if (!periodResponse.ok) throw new Error('Aktif dönem bilgisi alınamadı');
        
        const examData = await examResponse.json();
        const activePeriod = await periodResponse.json();
        
        displayReport(supervisor, examData, activePeriod);
    } catch (error) {
        console.error('Error:', error);
        alert('Veriler yüklenirken bir hata oluştu.');
    }
}

// Define colors for different days
const dayColors = [
    '#FFD8B2', // Light Orange
    '#E0FFE0', // Light Green
    '#E0E0FF', // Light Blue
    '#FFE0FF', // Light Purple
    '#FFFFE0', // Light Yellow
    '#FFE0E6', // Light Pink
    '#E0FFFF'  // Light Cyan
];

function displayReport(supervisor, examData, activePeriod) {
    // Get unique dates to assign consistent colors
    const uniqueDates = [...new Set(examData
        .map(exam => exam.Tarih ? formatDate(exam.Tarih) : '')
        .filter(date => date)
    )].sort();

    // Create a map of date to color
    const dateColorMap = new Map();
    uniqueDates.forEach((date, index) => {
        dateColorMap.set(date, dayColors[index % dayColors.length]);
    });

    // Update supervisor name and date
    document.querySelector('.supervisor-name').textContent = supervisor;
    document.querySelector('.report-date').textContent = 
        `Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;

    // Clear existing table data
    const tableBody = document.getElementById('examTable');
    tableBody.innerHTML = '';

    // Add exam data to table
    examData.forEach((exam, index) => {
        const row = document.createElement('tr');
        const formattedDate = formatDate(exam.Tarih);
        const backgroundColor = dateColorMap.get(formattedDate) || '';
        
        row.style.backgroundColor = backgroundColor;
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${exam.DersKodu || ''}</td>
            <td>${exam.DersAdi || ''}</td>
            <td>${formattedDate || ''}</td>
            <td>${exam.Saat || ''}</td>
            <td>${exam.Sinif || ''}</td>
            <td>${exam.Program || ''}</td>
            <td>${exam.DersHocasi || ''}</td>
        `;
        tableBody.appendChild(row);
    });

    // Create weekly view with active period dates
    createWeeklyView(examData, activePeriod, dateColorMap);

    // Show report container
    document.getElementById('reportContainer').classList.remove('d-none');
}

function createWeeklyView(examData, activePeriod, dateColorMap) {
    const weeklySchedule = document.getElementById('weeklySchedule');
    weeklySchedule.innerHTML = '';

    // Get all dates within active period
    const allDates = new Map(); // Map to store date -> day name
    const examTimes = new Set();
    
    // Convert active period dates to Date objects
    const startDate = new Date(activePeriod.startDate);
    const endDate = new Date(activePeriod.endDate);
    
    // Populate all dates within the period
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateStr = formatDate(date);
        const dayName = getDayName(date.getDay());
        allDates.set(dateStr, dayName);
    }

    // Add exam times
    examData.forEach(exam => {
        if (exam.Tarih && exam.Saat) {
            examTimes.add(exam.Saat.trim());
        }
    });

    // Convert to sorted arrays
    const sortedDates = Array.from(allDates.entries())
        .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));
    
    const sortedTimes = Array.from(examTimes)
        .sort((a, b) => {
            const [aHour] = a.split(':').map(Number);
            const [bHour] = b.split(':').map(Number);
            return aHour - bHour;
        });

    // Update timetable header
    const timetableHeader = document.querySelector('.timetable-header');
    timetableHeader.innerHTML = '<div class="time-column">Saat</div>';
    sortedDates.forEach(([date, dayName]) => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        // Check if there are any exams on this date
        const hasExams = examData.some(exam => formatDate(new Date(exam.Tarih)) === date);
        dayColumn.style.backgroundColor = hasExams ? dateColorMap.get(date) : '#404040';
        dayColumn.style.color = hasExams ? 'black' : 'white';
        dayColumn.innerHTML = `${dayName}<br>${date}`;
        timetableHeader.appendChild(dayColumn);
    });

    // Update grid template columns based on number of days
    const gridColumns = `100px repeat(${sortedDates.length}, 1fr)`;
    timetableHeader.style.gridTemplateColumns = gridColumns;

    // Create time slots
    sortedTimes.forEach(time => {
        const row = document.createElement('div');
        row.className = 'time-slot-row';
        row.style.gridTemplateColumns = gridColumns;
        
        // Add time label
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.textContent = time;
        row.appendChild(timeLabel);

        // Add day slots
        sortedDates.forEach(([date]) => {
            const daySlot = document.createElement('div');
            daySlot.className = 'day-slot';
            // Check if there are any exams on this date
            const hasExams = examData.some(exam => formatDate(new Date(exam.Tarih)) === date);
            daySlot.style.backgroundColor = hasExams ? dateColorMap.get(date) : '#404040';
            
            // Find exams for this time slot and date
            const dayExams = examData.filter(exam => 
                exam.Saat && exam.Saat.trim() === time &&
                formatDate(new Date(exam.Tarih)) === date
            );

            // Add exam items
            dayExams.forEach(exam => {
                const examItem = document.createElement('div');
                examItem.className = 'exam-item';
                examItem.innerHTML = `<div class="exam-code">${exam.DersKodu}</div>`;
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
