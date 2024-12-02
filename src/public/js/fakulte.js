const timeSlots = ['09:00', '10:30', '12:00', '13:30', '15:30', '17:30'];
const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const dayClasses = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; // Index matches getDay()

// Store remaining students for each course
let courseRemainingStudents = new Map();
// Store original student counts
let originalStudentCounts = new Map();
// Store all course data for reference
let coursesData = new Map();

// Store placed courses for each time slot
let timeSlotPlacements = new Map(); // key: "day-slot", value: [{uniqueId, dkodu, sube, ogrenciler}]

function getDaysBetweenDates(startDate, endDate) {
    const days = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
}

function generateCalendarHeader(days) {
    const headerRow1 = document.createElement('tr');
    const headerRow2 = document.createElement('tr');
    
    const sinifHeader = document.createElement('th');
    sinifHeader.rowSpan = 2;
    sinifHeader.className = 'first-col';
    sinifHeader.textContent = 'Sınıf';
    headerRow1.appendChild(sinifHeader);

    days.forEach((day, index) => {
        const dayClass = dayClasses[day.getDay()];
        const dayHeader = document.createElement('th');
        dayHeader.colSpan = 6;
        dayHeader.className = `day-header day-${dayClass}`;
        dayHeader.textContent = `${dayNames[day.getDay()]} (${day.toLocaleDateString('tr-TR')})`;
        headerRow1.appendChild(dayHeader);

        timeSlots.forEach((time, timeIndex) => {
            const timeHeader = document.createElement('th');
            timeHeader.className = `time-slot day-${dayClass}`;
            timeHeader.textContent = time;
            if (timeIndex === 5 && index < days.length - 1) {
                timeHeader.classList.add('day-divider');
            }
            headerRow2.appendChild(timeHeader);
        });
    });

    return [headerRow1, headerRow2];
}

function updateProblemCard(uniqueId) {
    const remainingStudents = courseRemainingStudents.get(uniqueId);
    const originalCount = originalStudentCounts.get(uniqueId);
    const course = coursesData.get(uniqueId);
    
    const card = document.querySelector(`.problem-card[data-unique-id="${uniqueId}"]`);
    if (card) {
        const studentCountElement = card.querySelector('.student-count');
        if (studentCountElement) {
            studentCountElement.innerHTML = `
                <i class="fas fa-users"></i> ${remainingStudents} / ${originalCount} Öğrenci
            `;
        }
        
        if (remainingStudents <= 0) {
            card.style.backgroundColor = '#90EE90';
            card.draggable = false;
        } else {
            card.style.backgroundColor = 'white';
            card.draggable = true;
        }
    }
}

function handleCellDelete(cellDiv, uniqueId, sinif, timeSlotKey) {
    // Add remaining students back
    const currentRemaining = courseRemainingStudents.get(uniqueId);
    courseRemainingStudents.set(uniqueId, currentRemaining + sinif.kon);
    
    // Remove course from time slot tracking
    const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    timeSlotPlacements.set(timeSlotKey, currentPlacements.filter(p => p.uniqueId !== uniqueId));
    
    // Clear cell content
    cellDiv.innerHTML = '';
    cellDiv.className = 'calendar-cell';
    
    // Update problem card
    updateProblemCard(uniqueId);
}

function hasStudentConflict(course, timeSlotKey) {
    const existingPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    
    // Check if any existing course in this time slot has common students
    return existingPlacements.some(placement => {
        // Skip conflict check if it's the same course
        if (placement.uniqueId === course.uniqueId) {
            return false;
        }
        
        const commonStudents = course.ogrenciler.filter(student => 
            placement.ogrenciler.includes(student)
        );
        return commonStudents.length > 0;
    });
}

function setupDragAndDrop(cellDiv, sinif, dayIndex, slotIndex) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    
    cellDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        cellDiv.style.backgroundColor = '#e9ecef';
    });

    cellDiv.addEventListener('dragleave', () => {
        cellDiv.style.backgroundColor = '';
    });

    cellDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        const uniqueId = e.dataTransfer.getData('text/plain');
        const course = coursesData.get(uniqueId);
        
        if (course) {
            // Check for student conflicts with different courses
            if (hasStudentConflict(course, timeSlotKey)) {
                alert('Bu zaman diliminde çakışan öğrenciler var!');
                cellDiv.style.backgroundColor = '';
                return;
            }
            
            const remainingStudents = courseRemainingStudents.get(uniqueId);
            // Update remaining students
            courseRemainingStudents.set(uniqueId, remainingStudents - sinif.kon);
            
            // Add course to time slot tracking
            const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
            currentPlacements.push({
                uniqueId: course.uniqueId,
                dkodu: course.dkodu,
                sube: course.sube,
                ogrenciler: course.ogrenciler,
                sinif: sinif.name
            });
            timeSlotPlacements.set(timeSlotKey, currentPlacements);
            
            // Update cell content with delete icon
            cellDiv.innerHTML = `
                <div class="cell-content">
                    <div class="dkodu">${course.dkodu} - ${course.sube}</div>
                    <div class="delete-icon">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
            `;
            cellDiv.style.backgroundColor = '';
            cellDiv.classList.add(`program-${course.program.toLowerCase()}`);
            
            // Add delete functionality
            const deleteIcon = cellDiv.querySelector('.delete-icon');
            deleteIcon.addEventListener('click', () => {
                handleCellDelete(cellDiv, uniqueId, sinif, timeSlotKey);
            });
            
            // Update problem card display
            updateProblemCard(uniqueId);
        }
    });
}

function placeSavedExam(cellDiv, course, sinif, dayIndex, slotIndex) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    const uniqueId = `${course.dkodu}-${course.sube}`;
    
    // Update remaining students count
    const currentRemaining = courseRemainingStudents.get(uniqueId);
    courseRemainingStudents.set(uniqueId, currentRemaining - sinif.kon);
    
    // Add course to time slot tracking
    const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    currentPlacements.push({
        uniqueId: uniqueId,
        dkodu: course.dkodu,
        sube: course.sube,
        ogrenciler: course.ogrenciler,
        sinif: sinif.name
    });
    timeSlotPlacements.set(timeSlotKey, currentPlacements);
    
    // Update cell content with delete icon
    cellDiv.innerHTML = `
        <div class="cell-content">
            <div class="dkodu">${course.dkodu} - ${course.sube}</div>
            <div class="delete-icon">
                <i class="fas fa-times"></i>
            </div>
        </div>
    `;
    cellDiv.classList.add(`program-${course.program.toLowerCase()}`);
    
    // Add delete functionality
    const deleteIcon = cellDiv.querySelector('.delete-icon');
    deleteIcon.addEventListener('click', () => {
        handleCellDelete(cellDiv, uniqueId, sinif, timeSlotKey);
    });
    
    // Update problem card display
    updateProblemCard(uniqueId);
}

function createProblemCard(course) {
    const uniqueId = `${course.dkodu}-${course.sube}`;
    const card = document.createElement('div');
    card.className = `problem-card program-${course.program.toLowerCase()}`;
    card.setAttribute('data-unique-id', uniqueId);
    
    const remainingStudents = courseRemainingStudents.get(uniqueId);
    const originalCount = originalStudentCounts.get(uniqueId);
    
    card.innerHTML = `
        <div class="dkodu">${course.dkodu} - ${course.sube}</div>
        <div class="student-count">
            <i class="fas fa-users"></i> ${remainingStudents} / ${originalCount} Öğrenci
        </div>
    `;
    
    if (remainingStudents <= 0) {
        card.style.backgroundColor = '#90EE90';
        card.draggable = false;
    } else {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', uniqueId);
        });
    }
    
    return card;
}

async function saveCalendarData() {
    try {
        const startDate = document.getElementById('startDate').value;
        const days = getDaysBetweenDates(startDate, document.getElementById('endDate').value);
        
        const examData = [];
        
        // Iterate through all placements
        for (const [key, placements] of timeSlotPlacements.entries()) {
            const [dayIndex, slotIndex] = key.split('-').map(Number);
            const date = days[dayIndex];
            const time = timeSlots[slotIndex];
            
            placements.forEach(placement => {
                examData.push({
                    dkodu: placement.dkodu,
                    sube: placement.sube,
                    date: date.toISOString().split('T')[0],
                    time: time,
                    sinif: placement.sinif
                });
            });
        }
        
        const response = await fetch('/api/save-fakulte-schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ examData })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        alert('Sınav programı başarıyla kaydedildi!');
    } catch (error) {
        console.error('Error saving calendar data:', error);
        alert('Sınav programı kaydedilirken bir hata oluştu!');
    }
}

async function fetchAndPopulateCalendar(startDate, endDate) {
    try {
        const response = await fetch('/api/fakulte-data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Clear existing data
        timeSlotPlacements.clear();
        courseRemainingStudents.clear();
        originalStudentCounts.clear();
        coursesData.clear();
        
        // Initialize course data and student counts
        data.lctrdata.forEach(course => {
            const uniqueId = `${course.dkodu}-${course.sube}`;
            const studentCount = Array.isArray(course.ogrenciler) ? course.ogrenciler.length : 0;
            
            courseRemainingStudents.set(uniqueId, studentCount);
            originalStudentCounts.set(uniqueId, studentCount);
            coursesData.set(uniqueId, course);
        });
        
        const days = getDaysBetweenDates(startDate, endDate);
        
        // Generate header
        const calendarHeader = document.getElementById('calendarHeader');
        calendarHeader.innerHTML = '';
        const [headerRow1, headerRow2] = generateCalendarHeader(days);
        calendarHeader.appendChild(headerRow1);
        calendarHeader.appendChild(headerRow2);
        
        // Generate body
        const calendarBody = document.getElementById('calendarBody');
        calendarBody.innerHTML = '';
        
        // Create calendar rows
        if (Array.isArray(data.sinifs)) {
            data.sinifs.forEach(sinif => {
                const row = generateCalendarRow(sinif, days, data);
                calendarBody.appendChild(row);
            });
        }
        
        // Populate problem cards
        const cardsContainer = document.getElementById('problemCards');
        cardsContainer.innerHTML = '';
        
        if (Array.isArray(data.lctrdata)) {
            data.lctrdata.forEach(course => {
                const card = createProblemCard(course);
                cardsContainer.appendChild(card);
            });
        }
        
    } catch (error) {
        console.error('Error fetching calendar data:', error);
    }
}

function generateCalendarRow(sinif, days, data) {
    const row = document.createElement('tr');
    
    const sinifCell = document.createElement('td');
    sinifCell.className = 'first-col';
    sinifCell.innerHTML = `
        <div class="sinif-name">${sinif.name}</div>
        <div class="sinif-kon">
            <i class="fas fa-info-circle"></i> Kon: ${sinif.kon || 0}
        </div>
    `;
    row.appendChild(sinifCell);
    
    days.forEach((day, dayIndex) => {
        const dayClass = dayClasses[day.getDay()];
        for (let slot = 0; slot < timeSlots.length; slot++) {
            const timeCell = document.createElement('td');
            timeCell.className = `day-${dayClass}`;
            const cellDiv = document.createElement('div');
            cellDiv.className = 'calendar-cell';
            
            if (slot === 5 && dayIndex < days.length - 1) {
                timeCell.classList.add('day-divider');
            }
            
            // Check if there's a saved exam for this cell
            const currentDate = day.toISOString().split('T')[0];
            const currentTime = timeSlots[slot];
            
            const savedExam = data.lctrdata.find(course => 
                course.examDate === currentDate && 
                course.examTime === currentTime && 
                course.examSiniflar && 
                course.examSiniflar.includes(sinif.name)
            );
            
            if (savedExam) {
                placeSavedExam(cellDiv, savedExam, sinif, dayIndex, slot);
            }
            
            setupDragAndDrop(cellDiv, sinif, dayIndex, slot);
            timeCell.appendChild(cellDiv);
            row.appendChild(timeCell);
        }
    });
    
    return row;
}

// Initialize calendar
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    document.getElementById('startDate').value = monday.toISOString().split('T')[0];
    document.getElementById('endDate').value = sunday.toISOString().split('T')[0];
    
    // Setup form submission
    document.getElementById('dateForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        await fetchAndPopulateCalendar(startDate, endDate);
    });
    
    // Setup save button
    document.getElementById('saveButton').addEventListener('click', saveCalendarData);
    
    // Trigger initial calendar generation
    document.getElementById('dateForm').dispatchEvent(new Event('submit'));
});
