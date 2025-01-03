document.addEventListener('DOMContentLoaded', function() {
    // Load classes when page loads
    loadClasses();

    // Add event listeners
    document.getElementById('classSelect').addEventListener('change', handleClassChange);
    document.getElementById('printBtn').addEventListener('click', handlePrint);
    document.getElementById('downloadWeeklyBtn').addEventListener('click', handleDownloadWeekly);
    document.getElementById('downloadAllWeeklyBtn').addEventListener('click', handleDownloadAllWeekly);
});

async function handleDownloadAllWeekly() {
    try {
        const downloadBtn = document.getElementById('downloadAllWeeklyBtn');
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İndiriliyor...';
        downloadBtn.disabled = true;

        // Get all classes
        const response = await fetch('/api/report/classes');
        if (!response.ok) throw new Error('Sınıf verileri alınamadı');
        const classes = await response.json();

        // Create a new ZIP file
        const zip = new JSZip();
        const activePeriodResponse = await fetch('/api/report/active-period');
        if (!activePeriodResponse.ok) throw new Error('Aktif dönem bilgisi alınamadı');
        const activePeriod = await activePeriodResponse.json();

        // Process each class
        for (const className of classes) {
            try {
                // Get exam data for this class
                const examResponse = await fetch(`/api/report/class-exam-data/${encodeURIComponent(className)}`);
                if (!examResponse.ok) continue;
                const examData = await examResponse.json();

                // Create temporary container for this class's weekly view
                const tempContainer = document.createElement('div');
                tempContainer.className = 'weekly-view mt-5';
                tempContainer.innerHTML = `
                    <h4 class="text-center mb-4 weekly-title">${className}</h4>
                    <div class="timetable">
                        <div class="timetable-header">
                            <div class="time-column">Saat</div>
                            <div class="day-column">Pazartesi</div>
                            <div class="day-column">Salı</div>
                            <div class="day-column">Çarşamba</div>
                            <div class="day-column">Perşembe</div>
                            <div class="day-column">Cuma</div>
                        </div>
                        <div class="timetable-body" id="weeklySchedule_${className}"></div>
                    </div>
                `;
                document.body.appendChild(tempContainer);

                // Create weekly view in the temporary container
                createWeeklyViewForClass(examData, activePeriod, className);

                // Capture the weekly view as an image
                const canvas = await html2canvas(tempContainer, {
                    scale: 9,
                    backgroundColor: '#ffffff',
                    logging: false
                });

                // Convert to PNG and add to ZIP
                const imageData = canvas.toDataURL('image/png').split(',')[1];
                zip.file(`${className}_haftalik_gorunum.png`, imageData, {base64: true});

                // Remove temporary container
                document.body.removeChild(tempContainer);
            } catch (error) {
                console.error(`Error processing class ${className}:`, error);
            }
        }

        // Generate and download ZIP file
        const content = await zip.generateAsync({type: 'blob'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'tum_siniflar_haftalik_gorunum.zip';
        link.click();

        // Restore button state
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
    } catch (error) {
        console.error('Download error:', error);
        alert('Görüntüler indirilirken bir hata oluştu.');
        document.getElementById('downloadAllWeeklyBtn').innerHTML = 
            '<i class="fas fa-download"></i> Tüm Sınıfların Haftalık Görünümünü İndir';
        document.getElementById('downloadAllWeeklyBtn').disabled = false;
    }
}

function createWeeklyViewForClass(examData, activePeriod, className) {
    const weeklySchedule = document.getElementById(`weeklySchedule_${className}`);
    weeklySchedule.innerHTML = '';

    // Get unique exam dates and times
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

    // Convert to sorted arrays
    const sortedDates = Array.from(examDates.entries())
        .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));
    
    const sortedTimes = Array.from(examTimes)
        .sort((a, b) => {
            const [aHour] = a.split(':').map(Number);
            const [bHour] = b.split(':').map(Number);
            return aHour - bHour;
        });

    // Update timetable header
    const timetableHeader = weeklySchedule.closest('.weekly-view').querySelector('.timetable-header');
    timetableHeader.innerHTML = '<div class="time-column">Saat</div>';
    sortedDates.forEach(([date, dayName]) => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        dayColumn.innerHTML = `${dayName}<br>${date}`;
        timetableHeader.appendChild(dayColumn);
    });

    // Update grid template columns
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
            
            // Find exams for this time slot and date
            const dayExams = examData.filter(exam => 
                exam.Saat && exam.Saat.trim() === time &&
                formatDate(new Date(exam.Tarih)) === date
            );

            // Add exam items
            dayExams.forEach(exam => {
                const examItem = document.createElement('div');
                examItem.className = 'exam-item';
                examItem.innerHTML = `
                    <div class="exam-code">${exam.DersKodu}</div>
                    <div class="exam-supervisor">${exam.Gozetmen}</div>
                `;
                daySlot.appendChild(examItem);
            });

            row.appendChild(daySlot);
        });

        weeklySchedule.appendChild(row);
    });
}

async function handleDownloadWeekly() {
    try {
        const weeklyView = document.querySelector('.weekly-view');
        if (!weeklyView) {
            alert('Haftalık görünüm bulunamadı.');
            return;
        }

        // Get selected class name for the file name
        const className = document.getElementById('classSelect').value;
        if (!className) return;

        // Show loading state
        const downloadBtn = document.getElementById('downloadWeeklyBtn');
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İndiriliyor...';
        downloadBtn.disabled = true;

        // Capture the weekly view as an image
        const canvas = await html2canvas(weeklyView, {
            scale: 9, // 900 DPI
            backgroundColor: '#ffffff',
            logging: false
        });

        // Convert to PNG and download
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${className}_haftalik_gorunum.png`;
        link.href = image;
        link.click();

        // Restore button state
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
    } catch (error) {
        console.error('Download error:', error);
        alert('Görüntü indirilirken bir hata oluştu.');
        document.getElementById('downloadWeeklyBtn').innerHTML = '<i class="fas fa-download"></i> Haftalık Görünümü İndir';
        document.getElementById('downloadWeeklyBtn').disabled = false;
    }
}

async function loadClasses() {
    try {
        const response = await fetch('/api/report/classes');
        if (!response.ok) throw new Error('Sınıf verileri alınamadı');
        
        const classes = await response.json();
        const select = document.getElementById('classSelect');
        
        // Sort classes alphabetically
        classes.sort((a, b) => a.localeCompare(b));
        
        // Add classes to select
        classes.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error:', error);
        alert('Sınıflar yüklenirken bir hata oluştu.');
    }
}

async function handleClassChange(event) {
    const className = event.target.value;
    const downloadAllBtn = document.getElementById('downloadAllWeeklyBtn');
    
    if (!className) {
        document.getElementById('reportContainer').classList.add('d-none');
        downloadAllBtn.disabled = false;
        return;
    }
    
    // Disable download all button when a class is selected
    downloadAllBtn.disabled = true;

    try {
        // Fetch both exam data and active period
        const [examResponse, periodResponse] = await Promise.all([
            fetch(`/api/report/class-exam-data/${encodeURIComponent(className)}`),
            fetch('/api/report/active-period')
        ]);

        if (!examResponse.ok) throw new Error('Sınav verileri alınamadı');
        if (!periodResponse.ok) throw new Error('Aktif dönem bilgisi alınamadı');
        
        const examData = await examResponse.json();
        const activePeriod = await periodResponse.json();
        
        displayReport(className, examData, activePeriod);
    } catch (error) {
        console.error('Error:', error);
        alert('Veriler yüklenirken bir hata oluştu.');
    }
}

function displayReport(className, examData, activePeriod) {
    // Update class name, date and weekly title
    document.querySelector('.class-name').textContent = `Sınıf: ${className}`;
    document.querySelector('.report-date').textContent = 
        `Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;
    document.querySelector('.weekly-title').textContent = className;

    // Clear existing table data
    const tableBody = document.getElementById('examTable');
    tableBody.innerHTML = '';

    // Add exam data to table
    examData.forEach((exam, index) => {
        const row = document.createElement('tr');
        const formattedDate = formatDate(exam.Tarih);
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${exam.DersKodu || ''}</td>
            <td>${exam.DersAdi || ''}</td>
            <td>${exam.Program || ''}</td>
            <td>${formattedDate || ''}</td>
            <td>${exam.Saat || ''}</td>
            <td>${exam.DersinHocasi || ''}</td>
            <td>${exam.Gozetmen || ''}</td>
        `;
        tableBody.appendChild(row);
    });

    // Create weekly view with active period dates
    createWeeklyView(examData, activePeriod);

    // Show report container
    document.getElementById('reportContainer').classList.remove('d-none');
}

function createWeeklyView(examData, activePeriod) {
    const weeklySchedule = document.getElementById('weeklySchedule');
    weeklySchedule.innerHTML = '';

    // Get unique exam dates and times
    const examDates = new Map(); // Map to store date -> day name
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

    // Convert to sorted arrays
    const sortedDates = Array.from(examDates.entries())
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
            
            // Find exams for this time slot and date
            const dayExams = examData.filter(exam => 
                exam.Saat && exam.Saat.trim() === time &&
                formatDate(new Date(exam.Tarih)) === date
            );

            // Add exam items
            dayExams.forEach(exam => {
                const examItem = document.createElement('div');
                examItem.className = 'exam-item';
                examItem.innerHTML = `
                    <div class="exam-code">${exam.DersKodu}</div>
                    <div class="exam-supervisor">${exam.Gozetmen || ''}</div>
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
