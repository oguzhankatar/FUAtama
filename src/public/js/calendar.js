const defaultTimeSlots = ['09:00', '10:30', '12:00', '13:30', '15:30', '17:30'];
const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const dayClasses = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; // Index matches getDay()

// Store time slots for each day
let dayTimeSlots = new Map(); // key: dayIndex, value: array of time slots

// Store remaining students for each course
let courseRemainingStudents = new Map();

// Store placed courses for each time slot
let timeSlotPlacements = new Map(); // key: "day-slot", value: [{dkodu, ogrenciler}]

// Track total placed students for each course
let coursePlacedStudents = new Map(); // key: "dkodu-sube", value: total placed students

function updateCoursePlacedCount(course, placedStudents, isAdding = true) {
    const uniqueId = `${course.dkodu} - ${course.sube}`;
    const currentPlaced = coursePlacedStudents.get(uniqueId) || [];
    let newPlaced;
    
    if (isAdding) {
        // Add new students to placed list
        newPlaced = [...new Set([...currentPlaced, ...placedStudents])];
    } else {
        // Remove students from placed list
        newPlaced = currentPlaced.filter(student => !placedStudents.includes(student));
    }
    coursePlacedStudents.set(uniqueId, newPlaced);
    
    // Update remaining count based on total placed students
    const totalStudents = course.ogrenciler || [];
    const remainingStudents = totalStudents.filter(student => !newPlaced.includes(student));
    courseRemainingStudents.set(uniqueId, remainingStudents);
    
    console.log(`Updated placement counts for ${uniqueId}:`, {
        action: isAdding ? 'adding' : 'removing',
        currentPlacedCount: currentPlaced.length,
        placedCount: placedStudents.length,
        newPlacedCount: newPlaced.length,
        totalStudents: totalStudents.length,
        remainingCount: remainingStudents.length
    });
}

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

function getCustomTimeSlots(data, dayIndex, currentDate) {
    const customTimes = new Set();
    
    // Add default time slots
    defaultTimeSlots.forEach(time => customTimes.add(time));
    
    // Check each course's exam slots
    if (data && data.sorunlu) {
        data.sorunlu.forEach(course => {
            if (course.examSlots) {
                course.examSlots.forEach(slot => {
                    if (slot.date === currentDate.toISOString().split('T')[0]) {
                        // Add any custom time that's not in defaultTimeSlots
                        if (!defaultTimeSlots.includes(slot.time)) {
                            customTimes.add(slot.time);
                        }
                    }
                });
            }
        });
    }
    
    // Convert to array and sort
    return Array.from(customTimes).sort();
}

function initializeDayTimeSlots(days, data) {
    days.forEach((day, index) => {
        if (!dayTimeSlots.has(index)) {
            const timeSlots = getCustomTimeSlots(data, index, day);
            dayTimeSlots.set(index, timeSlots);
        }
    });
}

function getTimeSlotsForDay(dayIndex) {
    return dayTimeSlots.get(dayIndex) || [...defaultTimeSlots];
}

function addTimeSlot(day, dayIndex) {
    const time = prompt('Yeni saat dilimini giriniz (ÖR: 14:00):');
    if (!time) return;

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
        alert('Geçersiz saat formatı! Lütfen HH:MM formatında giriniz (ÖR: 14:00)');
        return;
    }

    // Get current time slots for this day
    const currentTimeSlots = getTimeSlotsForDay(dayIndex);
    
    // Check if time slot already exists
    if (currentTimeSlots.includes(time)) {
        alert('Bu saat dilimi zaten mevcut!');
        return;
    }

    // Add new time slot and sort
    currentTimeSlots.push(time);
    currentTimeSlots.sort();
    dayTimeSlots.set(dayIndex, currentTimeSlots);

    // Refresh calendar with new time slot
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    fetchAndPopulateCalendar(startDate, endDate);
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
        const dayTimeSlots = getTimeSlotsForDay(index);
        const dayHeader = document.createElement('th');
        dayHeader.colSpan = dayTimeSlots.length;
        dayHeader.className = `day-header day-${dayClass}`;
        
        // Create a container for the header content
        const headerContent = document.createElement('div');
        headerContent.style.display = 'flex';
        headerContent.style.justifyContent = 'space-between';
        headerContent.style.alignItems = 'center';
        
        // Add day text
        const dayText = document.createElement('span');
        dayText.textContent = `${dayNames[day.getDay()]} (${day.toLocaleDateString('tr-TR')})`;
        headerContent.appendChild(dayText);
        
        // Add time icon
        const addTimeIcon = document.createElement('i');
        addTimeIcon.className = 'fas fa-plus-circle';
        addTimeIcon.style.cursor = 'pointer';
        addTimeIcon.title = 'Yeni saat ekle';
        addTimeIcon.onclick = () => addTimeSlot(day, index);
        headerContent.appendChild(addTimeIcon);
        
        dayHeader.appendChild(headerContent);
        headerRow1.appendChild(dayHeader);

        dayTimeSlots.forEach((time, timeIndex) => {
            const timeHeader = document.createElement('th');
            timeHeader.className = `time-slot day-${dayClass}`;
            timeHeader.textContent = time;
            if (timeIndex === dayTimeSlots.length - 1 && index < days.length - 1) {
                timeHeader.classList.add('day-divider');
            }
            headerRow2.appendChild(timeHeader);
        });
    });

    return [headerRow1, headerRow2];
}

function updateProblemCard(course) {
    const uniqueId = `${course.dkodu} - ${course.sube}`;
    const remainingStudents = courseRemainingStudents.get(uniqueId) || [];
    const placedStudents = coursePlacedStudents.get(uniqueId) || [];
    const card = document.querySelector(`.problem-card[data-unique-id="${uniqueId}"]`);
    
    if (card) {
        const studentCountElement = card.querySelector('.student-count');
        if (studentCountElement) {
            studentCountElement.innerHTML = `
                <i class="fas fa-users"></i> ${remainingStudents.length} yerleştirilmemiş öğrenci
            `;
        }
        
        const totalStudentsElement = card.querySelector('.total-students');
        if (totalStudentsElement) {
            totalStudentsElement.innerHTML = `
                <i class="fas fa-graduation-cap"></i> ${course.ogrenciler ? course.ogrenciler.length : 0} toplam öğrenci
            `;
        }
        
        if (remainingStudents.length === 0) {
            card.style.backgroundColor = '#90EE90';
            card.draggable = false;
        } else {
            card.style.backgroundColor = 'white';
            card.draggable = true;
        }
    }
}

function handleCellDelete(cellDiv, course, sinif, timeSlotKey) {
    // Get current placements and find the one to delete
    const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    const placement = currentPlacements.find(p => 
        p.dkodu === course.dkodu && 
        p.sube === course.sube && 
        p.sinif === sinif.name
    );
    
    if (placement) {
        // Update placed students count (subtract)
        updateCoursePlacedCount(course, placement.placedStudents || [], false);
        
        // Remove course from time slot tracking
        timeSlotPlacements.set(timeSlotKey, currentPlacements.filter(p => 
            !(p.dkodu === course.dkodu && p.sube === course.sube && p.sinif === sinif.name)
        ));
    }
    
    // Clear cell content
    cellDiv.innerHTML = '';
    cellDiv.className = 'calendar-cell';
    
    // Update problem card
    updateProblemCard(course);
}

function hasStudentConflict(course, timeSlotKey) {
    const existingPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    
    if (!existingPlacements.length) {
        console.log(`[${course.dkodu} - ${course.sube}] Zaman diliminde yerleşim yok, çakışma kontrolü yapılmadı`);
        return { hasConflict: false };
    }
    
    console.log(`[${course.dkodu} - ${course.sube}] Çakışma kontrolü başladı:`, {
        timeSlot: timeSlotKey,
        courseStudents: course.ogrenciler.length,
        existingPlacements: existingPlacements.map(p => ({
            course: `${p.dkodu} - ${p.sube}`,
            studentCount: p.ogrenciler.length
        }))
    });

    for (const placement of existingPlacements) {
        if (placement.dkodu === course.dkodu && placement.sube === course.sube) {
            continue;
        }
        
        const commonStudents = course.ogrenciler.filter(student => 
            placement.ogrenciler.includes(student)
        );
        
        if (commonStudents.length > 0) {
            console.log(`[${course.dkodu} - ${course.sube}] Çakışma tespit edildi:`, {
                conflictingCourse: `${placement.dkodu} - ${placement.sube}`,
                commonStudentCount: commonStudents.length,
                commonStudents: commonStudents,
                timeSlot: timeSlotKey
            });
            return {
                hasConflict: true,
                commonStudents: commonStudents,
                conflictingCourse: `${placement.dkodu} - ${placement.sube}`
            };
        }
    }
    
    console.log(`[${course.dkodu} - ${course.sube}] Çakışma bulunamadı`);
    return { hasConflict: false };
}

// Reset all placement tracking
function clearTimeSlotPlacements() {
    timeSlotPlacements = new Map();
    coursePlacedStudents = new Map();
}

function setupDragAndDrop(cellDiv, data, sinif, dayIndex, slotIndex) {
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
        const [dkodu, sube] = uniqueId.split(' - ');
        const course = data.sorunlu.find(c => c.dkodu === dkodu && c.sube === sube);
        
        if (course) {
            // Check for student conflicts with different courses
            const conflictResult = hasStudentConflict(course, timeSlotKey);
            if (conflictResult.hasConflict) {
                const conflictMessage = `Bu zaman diliminde çakışan öğrenciler var!\n\nÇakışan Öğrenciler:\n${conflictResult.commonStudents.join('\n')}\n\nÇakışan Ders: ${conflictResult.conflictingCourse}`;
                alert(conflictMessage);
                cellDiv.style.backgroundColor = '';
                return;
            }
            
            // Calculate students to place based on remaining students and classroom capacity
            const uniqueId = `${course.dkodu} - ${course.sube}`;
            const remainingStudents = courseRemainingStudents.get(uniqueId) || [];
            const currentPlaced = coursePlacedStudents.get(uniqueId) || [];
            
            if (remainingStudents.length === 0) {
                alert('Bu dersin tüm öğrencileri yerleştirilmiş!');
                cellDiv.style.backgroundColor = '';
                return;
            }
            
            // Take students up to classroom capacity
            const studentsToPlace = remainingStudents.slice(0, sinif.kon);
            
            // Update placed students (add)
            updateCoursePlacedCount(course, studentsToPlace, true);
            
            // Get current date and time for this cell
            const currentDate = new Date(document.getElementById('startDate').value);
            currentDate.setDate(currentDate.getDate() + dayIndex);
            const date = currentDate.toISOString().split('T')[0];
            const time = getTimeSlotsForDay(dayIndex)[slotIndex];

            // Add course to time slot tracking with placed students
            const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
            currentPlacements.push({
                dkodu: course.dkodu,
                sube: course.sube,
                ogrenciler: studentsToPlace,
                sinif: sinif.name,
                placedStudents: studentsToPlace,
                date: date,
                time: time
            });
            timeSlotPlacements.set(timeSlotKey, currentPlacements);
            
            // Update cell content with delete icon
            cellDiv.innerHTML = `
                <div class="cell-content">
                    <div class="dkodu">${course.dkodu} - ${course.sube}</div>
                    <div class="placed-count">${studentsToPlace.length} öğrenci</div>
                    <div class="delete-icon">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
            `;
            cellDiv.style.backgroundColor = '';
            // Add program color class
            if (course.program) {
                cellDiv.classList.add(`program-${course.program.toLowerCase()}`);
            }
            
            // Add delete functionality
            const deleteIcon = cellDiv.querySelector('.delete-icon');
            deleteIcon.addEventListener('click', () => {
                handleCellDelete(cellDiv, course, sinif, timeSlotKey);
            });
            
            // Update problem card display
            updateProblemCard(course);
        }
    });
}

function placeSavedExam(cellDiv, course, sinif, dayIndex, slotIndex, data) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    const currentDate = new Date(document.getElementById('startDate').value);
    currentDate.setDate(currentDate.getDate() + dayIndex);
    const date = currentDate.toISOString().split('T')[0];
    const time = getTimeSlotsForDay(dayIndex)[slotIndex];
    
    // Find the specific exam slot for this cell
    const examSlot = course.examSlots.find(slot => 
        slot.date === date && 
        slot.time === time && 
        slot.sinif === sinif.name
    );
    
    if (!examSlot) {
        console.log(`No matching exam slot found for ${course.dkodu} - ${course.sube} at ${date} ${time}`);
        return;
    }

    // Calculate students to place based on remaining students and classroom capacity
    const uniqueId = `${course.dkodu} - ${course.sube}`;
    const remainingStudents = courseRemainingStudents.get(uniqueId) || [];
    
    if (remainingStudents.length === 0) {
        console.log(`Cannot place saved exam ${uniqueId}: no remaining students`);
        return;
    }
    
    // Take students up to classroom capacity
    const studentsToPlace = remainingStudents.slice(0, sinif.kon);
    
    // Update placed students (add)
    updateCoursePlacedCount(course, studentsToPlace, true);
    
    // Add course to time slot tracking with placed count
    const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    currentPlacements.push({
        dkodu: course.dkodu,
        sube: course.sube,
        ogrenciler: course.ogrenciler,
        sinif: sinif.name,
        placedStudents: studentsToPlace,
        date: date,
        time: time
    });
    timeSlotPlacements.set(timeSlotKey, currentPlacements);
    
    // Update cell content with delete icon
    cellDiv.innerHTML = `
        <div class="cell-content">
            <div class="dkodu">${course.dkodu} - ${course.sube}</div>
            <div class="placed-count">${studentsToPlace.length} öğrenci</div>
            <div class="delete-icon">
                <i class="fas fa-times"></i>
            </div>
        </div>
    `;
    // Add program color class
    if (course.program) {
        cellDiv.classList.add(`program-${course.program.toLowerCase()}`);
    }
    
    // Add delete functionality
    const deleteIcon = cellDiv.querySelector('.delete-icon');
    deleteIcon.addEventListener('click', () => {
        handleCellDelete(cellDiv, course, sinif, timeSlotKey);
    });
    
    // Update problem card display
    updateProblemCard(course);
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
        const dayTimeSlots = getTimeSlotsForDay(dayIndex);
        
        dayTimeSlots.forEach((time, slot) => {
            const timeCell = document.createElement('td');
            timeCell.className = `day-${dayClass}`;
            const cellDiv = document.createElement('div');
            cellDiv.className = 'calendar-cell';
            
            if (slot === dayTimeSlots.length - 1 && dayIndex < days.length - 1) {
                timeCell.classList.add('day-divider');
            }
            
            // Check if there's a saved exam for this cell
            const currentDate = day.toISOString().split('T')[0];
            const currentTime = time;
            
            console.log(`Checking cell for saved exam:`, {
                date: currentDate,
                time: currentTime,
                sinif: sinif.name,
                courses: data.sorunlu.map(c => ({
                    dkodu: c.dkodu,
                    sube: c.sube,
                    examSlots: c.examSlots
                }))
            });
            
            // Check if there's a saved exam for this cell
            const savedExam = data.sorunlu.find(course => {
                if (!course.examSlots) {
                    console.log(`No examSlots for course ${course.dkodu}-${course.sube}`);
                    return false;
                }
                const hasSlot = course.examSlots.some(slot => 
                    slot.date === currentDate && 
                    slot.time === currentTime && 
                    slot.sinif === sinif.name
                );
                console.log(`Course ${course.dkodu}-${course.sube} hasSlot:`, hasSlot);
                return hasSlot;
            });
            
            if (savedExam) {
                console.log(`Found saved exam for cell:`, {
                    course: `${savedExam.dkodu}-${savedExam.sube}`,
                    date: currentDate,
                    time: currentTime,
                    sinif: sinif.name,
                    examSlots: savedExam.examSlots
                });
                
                const examSlot = savedExam.examSlots.find(slot => 
                    slot.date === currentDate && 
                    slot.time === currentTime && 
                    slot.sinif === sinif.name
                );
                if (examSlot) {
                    placeSavedExam(cellDiv, savedExam, sinif, dayIndex, slot, data);
                }
            }
            
            setupDragAndDrop(cellDiv, data, sinif, dayIndex, slot);
            timeCell.appendChild(cellDiv);
            row.appendChild(timeCell);
        });
    });
    
    return row;
}

function createProblemCard(course) {
    const uniqueId = `${course.dkodu} - ${course.sube}`;
    const card = document.createElement('div');
    card.className = 'problem-card';
    // Add program color class
    if (course.program) {
        card.classList.add(`program-${course.program.toLowerCase()}`);
    }
    card.setAttribute('data-unique-id', uniqueId);
    
    const remainingStudents = courseRemainingStudents.get(uniqueId) || [];
    const placedStudents = coursePlacedStudents.get(uniqueId) || [];
    
    card.innerHTML = `
        <div class="dkodu">${course.dkodu} - ${course.sube}</div>
        <div class="student-count">
            <i class="fas fa-users"></i> ${remainingStudents.length} yerleştirilmemiş öğrenci
        </div>
        <div class="total-students">
            <i class="fas fa-graduation-cap"></i> ${course.ogrenciler.length} toplam öğrenci
        </div>
    `;
    
    if (remainingStudents.length === 0) {
        card.style.backgroundColor = '#90EE90';
        card.draggable = false;
    } else {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', `${course.dkodu} - ${course.sube}`);
        });
    }
    
    return card;
}

async function saveCalendarData() {
    try {
        const startDate = document.getElementById('startDate').value;
        const days = getDaysBetweenDates(startDate, document.getElementById('endDate').value);
        
        const examData = [];
        console.log('Current timeSlotPlacements:', timeSlotPlacements);
        
        // Iterate through all placements
        timeSlotPlacements.forEach((placements, key) => {
            const [dayIndex, slotIndex] = key.split('-').map(Number);
            const date = days[dayIndex];
            const time = getTimeSlotsForDay(dayIndex)[slotIndex];
            
            placements.forEach(placement => {
                // Check if placement has all required data
                if (placement.dkodu && placement.sube && placement.sinif) {
                    examData.push({
                        dkodu: placement.dkodu,
                        sube: placement.sube,
                        date: date.toISOString().split('T')[0],
                        time: time,
                        sinif: placement.sinif
                    });
                }
            });
        });

        const response = await fetch('/api/save-exam-schedule', {
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
        // Önce mevcut yerleşimleri temizle
        clearTimeSlotPlacements();
        
        // Fetch calendar data once
        const response = await fetch('/api/calendar-data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        const days = getDaysBetweenDates(startDate, endDate);
        initializeDayTimeSlots(days, data);
        
        // Clear existing placements and reset tracking
        timeSlotPlacements.clear();
        coursePlacedStudents.clear();
        courseRemainingStudents.clear();
        
        // Initialize student tracking for each course
        data.sorunlu.forEach(course => {
            const uniqueId = `${course.dkodu} - ${course.sube}`;
            coursePlacedStudents.set(uniqueId, []);
            courseRemainingStudents.set(uniqueId, [...(course.ogrenciler || [])]);
            console.log(`Initializing ${uniqueId}:`, {
                totalStudents: course.ogrenciler ? course.ogrenciler.length : 0,
                section: course.sube,
                placedStudents: 0,
                remainingStudents: course.ogrenciler ? course.ogrenciler.length : 0
            });
        });
        
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
        
        if (Array.isArray(data.sorunlu)) {
            data.sorunlu.forEach(course => {
                const card = createProblemCard(course);
                cardsContainer.appendChild(card);
            });
        }
        
    } catch (error) {
        console.error('Error fetching calendar data:', error);
    }
}

// Initialize calendar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load active period dates
        const response = await fetch('/api/active-period');
        const activePeriod = await response.json();
        
        if (activePeriod) {
            const startDate = new Date(activePeriod.startDate).toISOString().split('T')[0];
            const endDate = new Date(activePeriod.endDate).toISOString().split('T')[0];
            
            document.getElementById('startDate').value = startDate;
            document.getElementById('endDate').value = endDate;
            
            // Load calendar with active period dates
            await fetchAndPopulateCalendar(startDate, endDate);
        } else {
            window.location.href = '/activePeriod.html';
        }
    } catch (error) {
        console.error('Error loading active period:', error);
        window.location.href = '/activePeriod.html';
    }
    
    // Setup save button
    document.getElementById('saveButton').addEventListener('click', saveCalendarData);
});
