let timeSlots = ['09:00', '10:30', '12:00', '13:30', '15:30', '17:30'];

// Sorunlu derslerin saatlerini kontrol edip timeSlots'a ekleyen fonksiyon
async function updateTimeSlotsWithProblematicCourses() {
    try {
        const response = await fetch('/api/sorunlu');
        if (!response.ok) {
            throw new Error('Sorunlu ders verisi alınamadı');
        }

        const sorunluResponseData = await response.json();
        let sorunluVeriler = [];
        
        if (Array.isArray(sorunluResponseData.data)) {
            sorunluVeriler = sorunluResponseData.data;
        } else if (Array.isArray(sorunluResponseData)) {
            sorunluVeriler = sorunluResponseData;
        }

        // Mevcut timeSlots'u yedekle
        const oldTimeSlots = [...timeSlots];

        // Sorunlu derslerin saatlerini topla
        const problematicTimes = sorunluVeriler
            .map(course => course.examTime)
            .filter(time => time && !timeSlots.includes(time));

        // Benzersiz saatleri al ve sırala
        const uniqueNewTimes = [...new Set(problematicTimes)].sort();

        // Yeni saatleri timeSlots'a ekle
        if (uniqueNewTimes.length > 0) {
            timeSlots = [...timeSlots, ...uniqueNewTimes].sort();
            console.log('Güncellenmiş saat dilimleri:', timeSlots);
            
            // Eğer timeSlots değiştiyse, takvimi yeniden oluştur
            if (JSON.stringify(oldTimeSlots) !== JSON.stringify(timeSlots)) {
                const calendarContainer = document.querySelector('.calendar-container');
                if (calendarContainer) {
                    const startDateInput = document.getElementById('startDate');
                    const endDateInput = document.getElementById('endDate');
                    if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
                        await fetchAndPopulateCalendar(startDateInput.value, endDateInput.value);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Sorunlu ders saatleri kontrol edilirken hata:', error);
    }
}

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

// 'sorunluData' değişkenini Map olarak tanımla
let sorunluData = new Map();

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

let blockCapacities = {
    'A': 0,
    'B': 0,
    'C': 0,
    'D': 0
};


let sinifData = [];

// Sınıf verilerini sunucudan al ve değişkene ata
async function loadSinifData() {
    try {
        const response = await fetch('/api/sinifs');
        sinifData = await response.json();
        console.log('Sınıf verileri yüklendi:', sinifData);
    } catch (error) {
        console.error('Sınıf verileri yüklenirken hata:', error);
    }
}


// Blok kontenjanlarını hesapla ve göster
async function calculateBlockCapacities() {
    try {
        const response = await fetch('/api/sinifs');
        const siniflar = await response.json();

        // Blok kapasitelerini sıfırla
        blockCapacities = {
            'A': 0,
            'B': 0,
            'C': 0,
            'D': 0
        };

        // Her sınıfı kontrol et
        siniflar.forEach(sinif => {
            const block = sinif.name.charAt(0);
            if (blockCapacities.hasOwnProperty(block)) {
                blockCapacities[block] += sinif.kon;
            }
        });

        // Mevcut yerleşimleri kontrol et ve kapasitelerden düş
        timeSlotPlacements.forEach(placements => {
            placements.forEach(placement => {
                const block = placement.sinif.charAt(0);
                if (blockCapacities.hasOwnProperty(block)) {
                    blockCapacities[block] -= placement.placedCount;
                }
            });
        });

        logBlockCapacities();
    } catch (error) {
        console.error('Blok kapasiteleri hesaplanırken hata:', error);
    }
}

// Blok kapasitelerini loglayan yardımcı fonksiyon
function logBlockCapacities() {
    console.log('=== BLOK KONTENJANLARI ===');
    Object.entries(blockCapacities).forEach(([block, capacity]) => {
        console.log(`${block} Blok: ${capacity} öğrenci`);
    });
    console.log('========================');
}

function generateCalendarHeader(days) {
    const headerRow1 = document.createElement('tr');
    const headerRow2 = document.createElement('tr');
    
    // İlk sütun başlığı
    const sinifHeader = document.createElement('th');
    sinifHeader.rowSpan = 2;
    sinifHeader.className = 'first-col';
    sinifHeader.textContent = 'Sınıf';
    headerRow1.appendChild(sinifHeader);

    // Her gün için başlıkları oluştur
    days.forEach((day, index) => {
        const dayClass = dayClasses[day.getDay()];
        
        // Gün başlığı
        const dayHeader = document.createElement('th');
        dayHeader.colSpan = timeSlots.length; // Dinamik saat dilimi sayısı
        dayHeader.className = `day-header day-${dayClass}`;
        dayHeader.textContent = `${dayNames[day.getDay()]} (${day.toLocaleDateString('tr-TR')})`;
        headerRow1.appendChild(dayHeader);

        // Saat başlıkları
        timeSlots.forEach((time, timeIndex) => {
            const timeHeader = document.createElement('th');
            timeHeader.className = `time-slot day-${dayClass}`;
            timeHeader.textContent = time;
            
            // Son saat diliminde ve son gün değilse ayırıcı ekle
            if (timeIndex === timeSlots.length - 1 && index < days.length - 1) {
                timeHeader.classList.add('day-divider');
            }
            
            headerRow2.appendChild(timeHeader);
        });
    });

    return [headerRow1, headerRow2];
}

// Problem kartını güncelleyen fonksiyon 
function updateProblemCard(uniqueId) {
    const course = coursesData.get(uniqueId);
const isGRP = course && course.program === 'GRP';
let remainingStudents;
if (isGRP) {
    let totalPlacedStudents = 0;
    timeSlotPlacements.forEach(placements => {
        placements.forEach(placement => {
            if (placement.uniqueId === uniqueId) {
                totalPlacedStudents += placement.placedCount;
            }
        });
    });
    remainingStudents = Math.max(0, course.ogrenciler.length - totalPlacedStudents);
} else {
    remainingStudents = courseRemainingStudents.get(uniqueId);
}
    const originalCount = originalStudentCounts.get(uniqueId);
    
    // Yerleşimleri logla ve say
    const placements = [];
    let totalClassrooms = 0;

    // timeSlotPlacements içindeki yerleşimleri ekle
    timeSlotPlacements.forEach((placementsArray, timeSlotKey) => {
        placementsArray.forEach(placement => {
            if (placement.uniqueId === uniqueId) {
                const [dayIndex, slotIndex] = timeSlotKey.split('-').map(Number);
                const dayName = dayNames[dayIndex];
                const timeSlotStr = timeSlots[slotIndex];
                placements.push(`${dayName} ${timeSlotStr}`);
                totalClassrooms++;
            }
        });
    });

    // sorunluData içindeki yerleşimleri ekle
    sorunluData.forEach((placementsArray, timeSlotKey) => {
        placementsArray.forEach(placement => {
            if (placement.uniqueId === uniqueId) {
                const [dayIndex, slotIndex] = timeSlotKey.split('-').map(Number);
                const dayName = dayNames[dayIndex];
                const timeSlotStr = timeSlots[slotIndex];
                placements.push(`${dayName} ${timeSlotStr}`);
                totalClassrooms++;
            }
        });
    });

    const card = document.querySelector(`.problem-card[data-unique-id="${uniqueId}"]`);
    if (card) {
        const studentCountElement = card.querySelector('.student-count');
        if (studentCountElement) {
            studentCountElement.innerHTML = `
                <i class="fas fa-users"></i> 
                ${remainingStudents} / ${originalCount} Öğrenci
                ${remainingStudents > 0 ? '(Yerleştirilmesi gereken)' : '(Tamamlandı)'}
                ${totalClassrooms > 0 ? `<br><i class="fas fa-building"></i> Toplam ${totalClassrooms} sınıf kullanıldı` : ''}
                ${placements.length > 0 ? '<br>Yerleşimler:<br>' + placements.join('<br>') : ''}
            `;
        }
        
        // GRP courses are always draggable
        if (isGRP) {
            card.style.backgroundColor = 'white';
            card.draggable = true;
        } else {
            if (remainingStudents <= 0) {
                card.style.backgroundColor = '#90EE90';
                card.draggable = false;
            } else {
                card.style.backgroundColor = 'white';
                card.draggable = true;
            }
        }
    }
}


async function handleCellDelete(cellDiv, uniqueId, sinif, timeSlotKey) {
    console.log('Deleting:', { uniqueId, sinif: sinif.name, timeSlotKey });
    
    // Get current placements for this time slot
    const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    console.log('Current placements:', currentPlacements);
    
    // Find the specific placement to delete
    const placementToDelete = currentPlacements.find(p => 
        p.uniqueId === uniqueId && p.sinif === sinif.name
    );
    
    if (placementToDelete) {
        console.log('Found placement to delete:', placementToDelete);
        
        // Check if this is a GRP program course
        const course = coursesData.get(uniqueId);
        const isGRP = course && course.program === 'GRP';
        
        // Update remaining students count only for non-GRP courses
        if (!isGRP) {
            const currentRemaining = courseRemainingStudents.get(uniqueId);
            courseRemainingStudents.set(uniqueId, currentRemaining + placementToDelete.placedCount);
        }
        
        // Remove only this specific placement
        const updatedPlacements = currentPlacements.filter(p => 
            !(p.uniqueId === uniqueId && p.sinif === sinif.name)
        );
        
        // If there are no more placements for this time slot, delete the key
        if (updatedPlacements.length === 0) {
            timeSlotPlacements.delete(timeSlotKey);
        } else {
            timeSlotPlacements.set(timeSlotKey, updatedPlacements);
        }
        
        console.log('Updated placements:', timeSlotPlacements.get(timeSlotKey));
        logAllPlacements(); // Silme sonrası log
        
        // Clear cell content but preserve data attributes
        const dayIndex = cellDiv.getAttribute('data-day');
        const slotIndex = cellDiv.getAttribute('data-slot');
        const sinifName = cellDiv.getAttribute('data-sinif');
        
        cellDiv.innerHTML = '';
        cellDiv.className = 'calendar-cell';
        
        // Restore data attributes
        cellDiv.setAttribute('data-day', dayIndex);
        cellDiv.setAttribute('data-slot', slotIndex);
        cellDiv.setAttribute('data-sinif', sinifName);
        
        // Update problem card
        updateProblemCard(uniqueId);
        
        // Dolu hücre sayısını güncelle
        updateFilledCellCount();

        // Otomatik kaydetme - Hemen kaydet ve sonucu bekle
        try {
            await saveCalendarData();
            console.log('Silme sonrası otomatik kaydetme başarılı');
        } catch (error) {
            console.error('Silme sonrası otomatik kaydetme sırasında hata:', error);
            alert('Değişiklikler kaydedilirken bir hata oluştu!');
        }
    } else {
        console.warn('Placement not found for deletion:', { uniqueId, sinif: sinif.name, timeSlotKey });
    }
}

// Öğrencinin bir gündeki sınav sayısını kontrol eden fonksiyon
function getStudentExamCountForDay(studentNo, dayIndex) {
    let examCount = 0;
    timeSlotPlacements.forEach((placements, timeSlotKey) => {
        const [currentDayIndex] = timeSlotKey.split('-').map(Number);
        if (currentDayIndex === dayIndex) {
            placements.forEach(placement => {
                if (placement.ogrenciler.includes(studentNo)) {
                    examCount++;
                }
            });
        }
    });
    return examCount;
}

// Zaman dilimi için uygunluk kontrolü
function isTimeSlotSuitable(course, dayIndex, slotIndex) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    
    // 1. Sorunlu ders kontrolü
    const existingPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    const hasProblematicCourse = existingPlacements.some(p => p.isProblematic);
    if (hasProblematicCourse) {
        console.log(`${timeSlotKey} zaman diliminde sorunlu ders var, yerleştirme yapılamaz`);
        return false;
    }

    // 2. Öğrenci çakışması kontrolü
    const hasConflict = hasStudentConflict(course, timeSlotKey);
    if (hasConflict) {
        console.log(`${course.dkodu} için öğrenci çakışması var`);
        return false;
    }
    
    // 3. Aynı ders kodlu şubelerin kontrolü
    const courseCode = course.dkodu.split('-')[0]; // Örn: "FİZ111"
    const sameCodePlacements = findPlacementsWithSameCode(courseCode, timeSlotPlacements);
    
    // Eğer aynı ders kodlu başka şubeler varsa, onların gün ve saatinde yerleştirmeyi zorla
    if (sameCodePlacements.length > 0) {
        const [otherDayIndex, otherSlotIndex] = sameCodePlacements[0].timeSlotKey.split('-').map(Number);
        if (dayIndex !== otherDayIndex || slotIndex !== otherSlotIndex) {
            console.log(`${course.dkodu} dersi, diğer şubelerle aynı gün ve saatte olmalı`);
            return false;
        }
    }
    
    // 4. Öğrencilerin günlük sınav sayısı kontrolü (uyarı amaçlı)
    let studentsWithManyExams = [];
    for (const studentNo of course.ogrenciler) {
        const examCount = getStudentExamCountForDay(studentNo, dayIndex);
        if (examCount >= 3) {
            studentsWithManyExams.push(studentNo);
        }
    }
    
    if (studentsWithManyExams.length > 0) {
        console.log(`Uyarı: ${studentsWithManyExams.length} öğrenci bu günde 3'ten fazla sınava girecek`);
        console.log('Etkilenen öğrenciler:', studentsWithManyExams);
    }
    
    return true; // Her durumda yerleştirmeye izin ver
}

// Aynı ders koduna sahip yerleşimleri bulan yardımcı fonksiyon
function findPlacementsWithSameCode(courseCode, timeSlotPlacements) {
    const samePlacements = [];
    
    timeSlotPlacements.forEach((placements, timeSlotKey) => {
        placements.forEach(placement => {
            const placementCode = placement.dkodu.split('-')[0];
            if (placementCode === courseCode) {
                samePlacements.push({
                    ...placement,
                    timeSlotKey
                });
            }
        });
    });
    
    return samePlacements;
}

function hasStudentConflict(course, timeSlotKey) {
    const existingPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    
    if (!existingPlacements.length) {
        console.log(`[${course.dkodu}] Zaman diliminde yerleşim yok`);
        return false;
    }

    // Tüm yerleşimleri ve çakışmaları logla
    const conflicts = existingPlacements.filter(placement => {
        if (placement.uniqueId === course.uniqueId) return false;
        
        const commonStudents = course.ogrenciler.filter(student => 
            placement.ogrenciler.includes(student)
        );
        
        if (commonStudents.length > 0) {
            console.log(`[${course.dkodu}] ${placement.dkodu} ile ${commonStudents.length} öğrenci çakışması`);
            return true;
        }
        return false;
    });

    if (conflicts.length > 0) {
        const conflictInfo = conflicts.map(p => `${p.dkodu}-${p.sube}`).join(', ');
        return true;
    }

    return false;
}

function hasSamePrefixInDay(course, dayIndex) {
    const coursePrefix = course.dkodu.split('-')[0]; // YMH gibi ders kodunun prefix'ini al
    let samePrefix = 0;
    
    timeSlotPlacements.forEach((placements, timeSlotKey) => {
        const [currentDayIndex] = timeSlotKey.split('-');
        if (parseInt(currentDayIndex) === dayIndex) {
            placements.forEach(placement => {
                const placementPrefix = placement.dkodu.split('-')[0];
                if (coursePrefix === placementPrefix && course.dkodu !== placement.dkodu) {
                    samePrefix++;
                }
            });
        }
    });
    
    return samePrefix >= 2; // Aynı gün içinde en fazla 2 şube olabilir
}



// Bir dersin yerleştirilmesini yöneten ana fonksiyon
function setupDragAndDrop(cellDiv, sinif, dayIndex, slotIndex) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    
    cellDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        cellDiv.style.backgroundColor = '#e9ecef';
    });

    cellDiv.addEventListener('dragleave', () => {
        cellDiv.style.backgroundColor = '';
    });

    cellDiv.addEventListener('drop', async (e) => {
        e.preventDefault();
        const uniqueId = e.dataTransfer.getData('text/plain');
        const course = coursesData.get(uniqueId);
        
        if (!course) return;

        // Yerleşimleri ve sınıfı detaylı logla
        console.group(`Yerleştirme Detayları - ${course.dkodu}`);
        const existingPlacements = timeSlotPlacements.get(timeSlotKey) || [];
        console.log('Mevcut yerleşimler:', existingPlacements);
        console.log('Hedef sınıf:', sinif.name);
        
        // Sınıfın bu zaman diliminde dolu olup olmadığını kontrol et
        const isRoomOccupied = existingPlacements.some(p => p.sinif === sinif.name);
        console.log('Sınıf dolu mu?', isRoomOccupied);
        
        // GRP programı veya diğer dersler için farklı kontrol
        const isGRP = course.program === 'GRP';
        if (isRoomOccupied && !isGRP) {
            console.groupEnd();
            cellDiv.style.backgroundColor = '';
            return;
        }

        // Öğrenci çakışması kontrolü
        if (hasStudentConflict(course, timeSlotKey)) {
            console.groupEnd();
            alert('Bu zaman diliminde öğrenci çakışması var!');
            cellDiv.style.backgroundColor = '';
            return;
        }

        // GRP programı veya boş sınıf için yerleştirmeye geç
        console.log('Yerleştirme onaylandı');
        console.groupEnd();
        
        // Yerleştirme işlemi
        let remainingStudents;
        if (isGRP) {
            let totalPlacedStudents = 0;
            timeSlotPlacements.forEach(placements => {
                placements.forEach(placement => {
                    if (placement.uniqueId === uniqueId) {
                        totalPlacedStudents += placement.placedCount;
                    }
                });
            });
            remainingStudents = Math.max(0, course.ogrenciler.length - totalPlacedStudents);
        } else {
            remainingStudents = courseRemainingStudents.get(uniqueId);
        }

        if (remainingStudents > 0 || isGRP) {
            // GRP programı için özel hesaplama
            const placedStudents = isGRP ? Math.min(remainingStudents, sinif.kon) : Math.min(remainingStudents, sinif.kon);
            
            // Remaining students'i güncelle (sadece GRP olmayan dersler için)
            if (!isGRP) {
                const currentRemaining = courseRemainingStudents.get(uniqueId);
                courseRemainingStudents.set(uniqueId, Math.max(0, currentRemaining - placedStudents));
            }
            
            // Mevcut yerleşimi güncelle veya yeni yerleşim ekle
            const existingPlacement = existingPlacements.find(p => p.uniqueId === uniqueId && p.sinif === sinif.name);
            if (existingPlacement && isGRP) {
                // GRP programı için mevcut yerleşimi güncelle
                existingPlacement.placedCount = placedStudents;
            } else {
                existingPlacements.push({
                    uniqueId: uniqueId,
                    dkodu: course.dkodu,
                    sube: course.sube,
                    ogrenciler: course.ogrenciler,
                    sinif: sinif.name,
                    placedCount: placedStudents,
                    program: course.program,
                    isProblematic: course.isProblematic || false
                });
            }
            
            timeSlotPlacements.set(timeSlotKey, existingPlacements);
            logAllPlacements();

            // Hücre içeriğini güncelle
            cellDiv.innerHTML = `
                <div class="cell-content">
                    <div class="dkodu">${course.dkodu} - ${course.sube}</div>
                    <div class="placed-count">Kontenjan: ${sinif.kon}</div>
                    ${!course.isProblematic ? `
                        <div class="delete-icon">
                            <i class="fas fa-times"></i>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Ensure data attributes are set
            cellDiv.setAttribute('data-day', dayIndex);
            cellDiv.setAttribute('data-slot', slotIndex);
            cellDiv.setAttribute('data-sinif', sinif.name);
            cellDiv.classList.add(`program-${course.program.toLowerCase()}`);
            
            const deleteIcon = cellDiv.querySelector('.delete-icon');
            if (deleteIcon) {
                // Remove any existing click listeners
                deleteIcon.replaceWith(deleteIcon.cloneNode(true));
                const newDeleteIcon = cellDiv.querySelector('.delete-icon');
                newDeleteIcon.addEventListener('click', () => {
                    handleCellDelete(cellDiv, uniqueId, sinif, timeSlotKey);
                });
            }

            // Blok kapasitesini güncelle
            const block = sinif.name.charAt(0);
            if (blockCapacities.hasOwnProperty(block)) {
                blockCapacities[block] -= placedStudents;
                console.log(`${block} bloğuna ${placedStudents} öğrenci yerleştirildi.`);
                logBlockCapacities();
            }
            
            updateProblemCard(uniqueId);
            
            // Otomatik kaydetme - Hemen kaydet ve sonucu bekle
            try {
                await saveCalendarData();
                console.log('Yerleştirme sonrası otomatik kaydetme başarılı');
            } catch (error) {
                console.error('Yerleştirme sonrası otomatik kaydetme sırasında hata:', error);
                alert('Yerleştirme kaydedilirken bir hata oluştu!');
            }
        }
        
        cellDiv.style.backgroundColor = '';
    });
}

function hasSamePrefixInDay(course, dayIndex) {
    const coursePrefix = course.dkodu.match(/^[A-Za-z]+/)[0]; // Dersin prefix'ini al (örn: YMH)
    
    // O gündeki aynı prefix'e sahip ders sayısını hesapla
    let samePrefix = 0;
    
    Array.from(timeSlotPlacements.entries()).forEach(([timeSlotKey, placements]) => {
        // Sadece aynı gündeki yerleşimleri kontrol et
        const [slotDayIndex] = timeSlotKey.split('-').map(Number);
        if (slotDayIndex === dayIndex) {
            placements.forEach(placement => {
                const placementPrefix = placement.dkodu.match(/^[A-Za-z]+/)[0];
                if (coursePrefix === placementPrefix && course.dkodu !== placement.dkodu) {
                    samePrefix++;
                }
            });
        }
    });
    
    // Aynı prefix'ten 2 veya daha fazla ders varsa true döndür
    return samePrefix >= 5;
}

async function autoPlaceCourses() {
    await loadSinifData();
    console.log('Sınıf verileri yüklendi:', sinifData);

    if (sinifData.length === 0) {
        alert('Sınıf verileri yüklenemedi!');
        return;
    }

    if (!confirm('Mevcut yerleşimler silinecek. Devam etmek istiyor musunuz?')) {
        return;
    }

    clearAllPlacements();

    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const days = getDaysBetweenDates(startDate, endDate); // days'i buraya taşıdık

    // Önce sorunlu dersleri yerleştir
    const sorunluResponse = await fetch('/api/sorunlu');
    if (sorunluResponse.ok) {
        const sorunluResponseData = await sorunluResponse.json();
        let sorunluVeriler = [];
        
        if (Array.isArray(sorunluResponseData.data)) {
            sorunluVeriler = sorunluResponseData.data;
        } else if (Array.isArray(sorunluResponseData)) {
            sorunluVeriler = sorunluResponseData;
        }

        // Sorunlu dersleri yerleştir
        sorunluVeriler.forEach(course => {
            const uniqueId = `${course.dkodu}-${course.sube}`;
            course.isProblematic = true;
            coursesData.set(uniqueId, course);
            originalStudentCounts.set(uniqueId, course.ogrenciler.length);
            courseRemainingStudents.set(uniqueId, course.ogrenciler.length);

            const dayIndex = days.findIndex(d => 
                d.toLocaleDateString('tr-TR') === new Date(course.examDate).toLocaleDateString('tr-TR')
            );
            const slotIndex = timeSlots.indexOf(course.examTime);
            const timeSlotKey = `${dayIndex}-${slotIndex}`;
            const placements = timeSlotPlacements.get(timeSlotKey) || [];

            // Her sınıf için ayrı bir yerleşim oluştur
            course.examSiniflar.forEach(sinif => {
                const studentsPerRoom = Math.ceil(course.ogrenciler.length / course.examSiniflar.length);
                placements.push({
                    uniqueId: uniqueId,
                    dkodu: course.dkodu,
                    sube: course.sube,
                    ogrenciler: course.ogrenciler,
                    sinif: sinif,
                    placedCount: studentsPerRoom,
                    program: course.program,
                    isProblematic: true
                });
            });
            
            timeSlotPlacements.set(timeSlotKey, placements);
            // Problem kartını güncelle
            updateProblemCard(uniqueId);
        });
    }

    // Normal yerleştirme işlemlerine devam et
    const preferredSlots = [0, 1, 2, 3, 4, 5]; // 09:00 - 17:30 saatleri

    const availableDays = days.length;
    const totalExams = coursesData.size;
    const targetExamsPerDay = Math.ceil(totalExams / availableDays);
    const maxExamsPerDay = Math.ceil(targetExamsPerDay * 1.1); // %10 tolerans

    console.log(`Toplam sınav: ${totalExams}`);
    console.log(`Gün sayısı: ${availableDays}`);
    console.log(`Gün başına hedef: ${targetExamsPerDay}`);
    console.log(`Gün başına maksimum: ${maxExamsPerDay}`);

    const examCountPerDay = new Array(availableDays).fill(0);

    // Dersleri öğrenci sayısına göre büyükten küçüğe sırala
    let sortedCourses = Array.from(coursesData.entries())
        .sort(([id1, course1], [id2, course2]) => {
            const count1 = originalStudentCounts.get(id1) || 0;
            const count2 = originalStudentCounts.get(id2) || 0;
            return count2 - count1;
        });

    // Sorunlu ve normal dersleri ayır
    const sorunluCourses = sortedCourses.filter(([_, course]) => course.isProblematic);
    const normalCourses = sortedCourses.filter(([_, course]) => !course.isProblematic);

    // Dersleri yerleştiren yardımcı fonksiyon
    async function placeCourses(courses) {
        let unplacedCourses = [];

        for (const [uniqueId, course] of courses) {
            let placed = false;
            let bestSlot = null;
            let minAffectedStudents = Infinity;

            // Günleri sınav sayısına göre azdan çoğa sırala
            const sortedDays = [...Array(availableDays).keys()].sort((a, b) => examCountPerDay[a] - examCountPerDay[b]);

            for (const dayIndex of sortedDays) {
                if (examCountPerDay[dayIndex] >= maxExamsPerDay) continue;

                for (const slotIndex of preferredSlots) {
                    // Öğrenci çakışması kontrolü
                    const timeSlotKey = `${dayIndex}-${slotIndex}`;
                    const existingPlacements = timeSlotPlacements.get(timeSlotKey) || [];
                    
                    // Sorunlu ders veya aynı saatte öğrenci çakışması varsa bu slotu atla
                    if (existingPlacements.some(p => p.isProblematic) || hasStudentConflict(course, timeSlotKey)) {
                        continue;
                    }

                    // Bu zaman diliminde 3'ten fazla sınava girecek öğrenci sayısını hesapla
                    let affectedStudents = 0;
                    for (const studentNo of course.ogrenciler) {
                        const examCount = getStudentExamCountForDay(studentNo, dayIndex);
                        if (examCount >= 3) {
                            affectedStudents++;
                        }
                    }

                    // Eğer hiç öğrenci etkilenmiyorsa hemen yerleştir
                    if (affectedStudents === 0) {
                        const success = await tryPlaceCourse(course, dayIndex, slotIndex);
                        if (success) {
                            examCountPerDay[dayIndex]++;
                            placed = true;
                            break;
                        }
                    }
                    // Değilse en az öğrencinin etkilendiği slotu kaydet
                    else if (affectedStudents < minAffectedStudents) {
                        minAffectedStudents = affectedStudents;
                        bestSlot = { dayIndex, slotIndex };
                    }
                }
                if (placed) break;
            }

            // Eğer optimal yerleştirme yapılamadıysa ve bir best slot bulunduysa oraya yerleştir
            if (!placed && bestSlot) {
                const success = await tryPlaceCourse(course, bestSlot.dayIndex, bestSlot.slotIndex);
                if (success) {
                    examCountPerDay[bestSlot.dayIndex]++;
                    placed = true;
                }
            }

            // Hala yerleştirilemedi ise tekrar denemek üzere kaydet
            if (!placed) {
                console.log(`${course.dkodu} için ilk denemede yer bulunamadı, tekrar denenecek`);
                unplacedCourses.push([uniqueId, course]);
            }
        }

        // Yerleştirilemeyen dersler için tekrar dene (bu sefer daha az kısıtlama ile)
        if (unplacedCourses.length > 0) {
            console.log(`${unplacedCourses.length} ders için tekrar deneme yapılıyor...`);
            for (const [uniqueId, course] of unplacedCourses) {
                let placed = false;
                for (const dayIndex of [...Array(availableDays).keys()]) {
                    for (const slotIndex of preferredSlots) {
                        // Sadece temel çakışma kontrollerini yap
                        const timeSlotKey = `${dayIndex}-${slotIndex}`;
                        const existingPlacements = timeSlotPlacements.get(timeSlotKey) || [];
                        if (!hasStudentConflict(course, timeSlotKey)) {
                            const success = await tryPlaceCourse(course, dayIndex, slotIndex);
                            if (success) {
                                console.log(`${course.dkodu} ikinci denemede yerleştirildi`);
                                placed = true;
                                break;
                            }
                        }
                    }
                    if (placed) break;
                }
                if (!placed) {
                    console.log(`${course.dkodu} için uygun yer bulunamadı!`);
                }
            }
        }
    }

    console.log('Sorunlu dersler yerleştiriliyor...');
    await placeCourses(sorunluCourses);

    console.log('Normal dersler yerleştiriliyor...');
    await placeCourses(normalCourses);

    // Otomatik yerleştirme sonrası kaydet - Hemen kaydet ve sonucu bekle
    try {
        await saveCalendarData();
        console.log('Otomatik yerleştirme sonrası kaydetme başarılı');
    } catch (error) {
        console.error('Otomatik yerleştirme sonrası otomatik kaydetme sırasında hata:', error);
        alert('Değişiklikler kaydedilirken bir hata oluştu!');
    }

}
function calculatePlacementScore(dayIndex, examCountPerDay, targetExamsPerDay) {
    const currentDayCount = examCountPerDay[dayIndex];
    
    // Hedeften sapma cezası
    const deviationPenalty = Math.abs(currentDayCount - targetExamsPerDay) * 2;
    
    // Hafta başı/sonu cezası (Pazartesi ve Cuma için daha düşük ceza)
    const dayPenalty = (dayIndex === 0 || dayIndex === 4) ? 0.5 : 0;
    
    // Gün yoğunluğu cezası
    const densityPenalty = currentDayCount * 0.3;
    
    return deviationPenalty + dayPenalty + densityPenalty;
}

// Dersi yerleştirmeyi deneyen yardımcı fonksiyon
async function tryPlaceCourse(course, dayIndex, slotIndex) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    const courseCode = course.dkodu.split('-')[0];
    const availableRooms = findAvailableClassrooms(timeSlotKey);
    const studentCount = originalStudentCounts.get(course.uniqueId);
    
    // Aynı ders kodlu diğer şubelerin yerleşimlerini kontrol et
    const samePlacements = findPlacementsWithSameCode(courseCode, timeSlotPlacements);
    
    // Eğer aynı ders kodlu başka şubeler varsa ve farklı bir zaman dilimindeyse
    if (samePlacements.length > 0) {
        const [otherDayIndex, otherSlotIndex] = samePlacements[0].timeSlotKey.split('-').map(Number);
        if (dayIndex !== otherDayIndex || slotIndex !== otherSlotIndex) {
            return false; // Farklı zaman dilimlerine yerleştirmeyi zorla
        }
    }
    
    console.log(`${course.dkodu} için yerleştirme deneniyor:`, {
        dayIndex,
        slotIndex,
        availableRooms: availableRooms.length,
        studentCount
    });
    
    const combination = findOptimalClassroomCombination(availableRooms, studentCount);
    
    if (combination) {
        console.log(`${course.dkodu} için uygun sınıf kombinasyonu bulundu`);
        for (const room of combination.classrooms) {
            await placeInRoom(course, room, dayIndex, slotIndex);
        }
        return true;
    }
    
    console.log(`${course.dkodu} için uygun sınıf kombinasyonu bulunamadı`);
    return false;
}

function getProgramBlock(program) {
    const programBlockMap = {
        // A Blok
        'TEK-YZL': 'A',
        'TEK-UOLP': 'A',
        
        // B Blok
        'TEK-ABM': 'B',
        'TEK-ELK': 'B',
        'TEK-MAK': 'B',
        'TEK-MKT': 'B',
        
        // C Blok
        'HRC': 'C',
        'ORT': 'C',
        'TEK-MET': 'C',
        
        // D Blok
        'TEK-INS': 'D',
        'TEK-OTO': 'D',
        'TEK-ENJ': 'D'
    };
    return programBlockMap[program] || 'D'; // Eşleşme bulunamazsa varsayılan olarak A blok
}

function findOptimalClassroomCombination(availableClassrooms, neededCapacity) {
    console.log(`Optimizasyon başlıyor - Gereken kapasite: ${neededCapacity}`);
    console.log(`Kullanılabilir sınıflar:`, availableClassrooms);

    let bestCombination = null;
    let minBlocks = Infinity;
    let currentBlock = null;
    let totalAvailableCapacity = availableClassrooms.reduce((sum, c) => sum + c.kon, 0);

    console.log(`Toplam mevcut kapasite: ${totalAvailableCapacity}`);

    if (totalAvailableCapacity < neededCapacity) {
        console.log(`Yetersiz toplam kapasite! Gereken: ${neededCapacity}, Mecut: ${totalAvailableCapacity}`);
        return null;
    }

    // Blok sıralaması
    const blockOrder = ['A', 'B', 'C', 'D'];

    // Her blok için ayrı deneme yap
    for (const block of blockOrder) {
        // Sadece mevcut bloktaki sınıfları filtrele
        const blockClassrooms = availableClassrooms.filter(c => c.name.startsWith(block));
        
        if (blockClassrooms.length === 0) continue;

        // En fazla 4 sınıfla çözüm bul
        for (let i = 1; i <= blockClassrooms.length; i++) {
            console.log(`${block} Blok - ${i} sınıflı kombinasyonlar deneniyor...`);
            
            const combinations = getCombinations(blockClassrooms, i);
            
            for (const combination of combinations) {
                const totalCapacity = combination.reduce((sum, c) => sum + c.kon, 0);
                //console.log(`Kombinasyon: ${combination.map(c => c.name).join(', ')} - Kapasite: ${totalCapacity}`);
                
                if (totalCapacity >= neededCapacity && i < minBlocks) {
                    minBlocks = i;
                    bestCombination = combination;
                    currentBlock = block;
                    console.log(`${block} Blokta yeni en iyi kombinasyon bulundu! Blok sayısı: ${i}`);
                    // En az blok sayısı bulunduğunda döngüden çık
                    if (i === 1) return { classrooms: bestCombination, blocks: minBlocks };
                }
            }
            // Eğer bu blokta uygun kombinasyon bulunduysa, sonraki bloğa geç
            if (bestCombination && currentBlock === block) break;
        }
    }

    return bestCombination ? { classrooms: bestCombination, blocks: minBlocks } : null;
}
// Yardımcı fonksiyonlar
function updateFilledCellCount() {
    const filledCells = document.querySelectorAll('.calendar-cell:not(:empty)').length;
    document.getElementById('filledCellCount').textContent = filledCells;
}

async function clearAllPlacements() {
    timeSlotPlacements.clear();
    courseRemainingStudents = new Map(originalStudentCounts);
    
    // Tüm hücreleri temizle
    document.querySelectorAll('.calendar-cell').forEach(cell => {
        // Store data attributes
        const dayIndex = cell.getAttribute('data-day');
        const slotIndex = cell.getAttribute('data-slot');
        const sinifName = cell.getAttribute('data-sinif');
        
        // Clear content and styles
        cell.innerHTML = '';
        cell.style.backgroundColor = '';
        cell.className = 'calendar-cell';
        
        // Restore data attributes
        cell.setAttribute('data-day', dayIndex);
        cell.setAttribute('data-slot', slotIndex);
        cell.setAttribute('data-sinif', sinifName);
    });

    // LocalStorage'ı temizle
    localStorage.removeItem('calendarState');
    
    // Problem kartlarını güncelle
    updateAllProblemCards();

    // Dolu hücre sayısını güncelle
    updateFilledCellCount();

    // Otomatik kaydetme - Hemen kaydet ve sonucu bekle
    try {
        await saveCalendarData();
        console.log('Tüm yerleşimleri temizleme sonrası otomatik kaydetme başarılı');
    } catch (error) {
        console.error('Tüm yerleşimleri temizleme sonrası otomatik kaydetme sırasında hata:', error);
        alert('Değişiklikler kaydedilirken bir hata oluştu!');
    }
}

function updateAllProblemCards() {
    coursesData.forEach((course, uniqueId) => {
        const card = document.querySelector(`.problem-card[data-unique-id="${uniqueId}"]`);
        if (card) {
            const newCard = createProblemCard(course);
            card.parentNode.replaceChild(newCard, card);
        }
    });
}
// Kombinasyonların önbelleklemesi için global Map
const combinationCache = new Map(); 

// Önbellekli kombinasyon oluşturucu fonksiyon 
function getCombinations(arr, size) {
    // Önbellek anahtarı oluştur
    const cacheKey = `${arr.map(c => c.name).sort().join('_')}_${size}`;
    
    // Önbellekte varsa direkt döndür
    if (combinationCache.has(cacheKey)) {
        return combinationCache.get(cacheKey);
    }

    const result = new Set();
    let combinationCount = 0;
    const processedCombos = new Set();

    function combine(start, combo) {
        if (combo.length === size) {
            const sortedCombo = combo.map(c => c.name).sort().join(',');
            
            if (!processedCombos.has(sortedCombo)) {
                processedCombos.add(sortedCombo);
                combinationCount++;
                
                const actualCombo = sortedCombo.split(',').map(name => 
                    arr.find(c => c.name === name)
                );
                result.add(actualCombo);
            }
            return;
        }
        
        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    }
    
    combine(0, []);
    console.log(`${cacheKey} için ${combinationCount} benzersiz kombinasyon bulundu`);
    
    // Sonucu önbelleğe kaydet
    const finalResult = Array.from(result);
    combinationCache.set(cacheKey, finalResult);
    
    return finalResult;
}
// findAvailableClassrooms fonksiyonunu güncelle
function findAvailableClassrooms(timeSlotKey) {
    console.log(`Sınıf müsaitlik kontrolü - Zaman dilimi: ${timeSlotKey}`);
    const placements = timeSlotPlacements.get(timeSlotKey) || [];
    console.log(`Mevcut yerleşimler:`, placements);
    
    const usedClassrooms = new Set(placements.map(p => p.sinif));
    console.log(`Kullanımda olan sınıflar:`, Array.from(usedClassrooms));
    
    const availableRooms = sinifData.filter(sinif => !usedClassrooms.has(sinif.name));
    console.log(`Müsait sınıflar:`, availableRooms);
    
    return availableRooms;
}


// Uygun sınıfları bulan yardımcı fonksiyon
async function findAvailableRooms(dayIndex, slotIndex, preferredBlock, course, neededCapacity) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    const response = await fetch('/api/sinifs');
    const rooms = await response.json();

    // Sınıfları tercih edilen blok ve kapasiteye göre filtrele
    return rooms
        .filter(room => {
            // Tercih edilen blokta olan sınıfları öncele
            if (preferredBlock && room.name.charAt(0) !== preferredBlock) return false;
            
            // Sınıfın dolu olup olmadığını kontrol et
            const isOccupied = timeSlotPlacements.get(timeSlotKey)?.some(
                placement => placement.sinif === room.name
            );
            
            return !isOccupied && room.kon > 0;
        })
        .sort((a, b) => {
            // Tercih edilen blokta ve kapasiteye en yakın sınıfları önceliklendir
            const aBlock = a.name.charAt(0) === preferredBlock;
            const bBlock = b.name.charAt(0) === preferredBlock;
            
            if (aBlock !== bBlock) return bBlock - aBlock;
            
            // Kapasitesi gereken kapasiteye en yakın olanları seç
            const aDiff = Math.abs(a.kon - neededCapacity);
            const bDiff = Math.abs(b.kon - neededCapacity);
            return aDiff - bDiff;
        });
}

// Sınıfa yerleştirme yapan yardımcı fonksiyon
// Sınıfa yerleştirme yapan yardımcı fonksiyon
async function placeInRoom(course, room, dayIndex, slotIndex) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    const uniqueId = `${course.dkodu}-${course.sube}`;
    const isGRP = course.program === 'GRP';
    const remainingStudents = courseRemainingStudents.get(uniqueId);

    // Sınıfın müsaitliği ve çakışma kontrolü
    const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    const isRoomOccupied = currentPlacements.some(p => p.sinif === room.name);
    const hasSameCourse = currentPlacements.some(p => p.uniqueId === uniqueId && p.sinif === room.name);
    
    // GRP programı veya boş sınıf kontrolü
    if ((isRoomOccupied && !isGRP) || hasSameCourse) {
        return false;
    }

    // Çakışma kontrolü
    if (hasStudentConflict(course, timeSlotKey)) {
        return false;
    }

    // Yerleştirilecek öğrenci sayısını hesapla
    let placedStudents;
    if (isGRP) {
        let totalPlacedStudents = 0;
        timeSlotPlacements.forEach(placements => {
            placements.forEach(placement => {
                if (placement.uniqueId === uniqueId) {
                    totalPlacedStudents += placement.placedCount;
                }
            });
        });
        const remainingGRPStudents = Math.max(0, course.ogrenciler.length - totalPlacedStudents);
        placedStudents = Math.min(remainingGRPStudents, room.kon);
    } else {
        placedStudents = Math.min(remainingStudents, room.kon);
    }
    
    // Update remaining students count only for non-GRP courses
    if (!isGRP) {
        courseRemainingStudents.set(uniqueId, Math.max(0, remainingStudents - placedStudents));
    }
    
    // TimeSlotPlacements'a ekle
    currentPlacements.push({
        uniqueId: uniqueId,
        dkodu: course.dkodu,
        sube: course.sube,
        ogrenciler: course.ogrenciler,
        sinif: room.name,
        placedCount: placedStudents
    });
    timeSlotPlacements.set(timeSlotKey, currentPlacements);

        // Blok kapasitesini güncelle ve logla
    const block = room.name.charAt(0);
    if (blockCapacities.hasOwnProperty(block)) {
        blockCapacities[block] -= placedStudents;
        console.log(`${block} bloğuna ${placedStudents} öğrenci yerleştirildi.`);
        logBlockCapacities();
    }
    
    // Hücreyi güncelle
    const cellDiv = document.querySelector(`.calendar-cell[data-day="${dayIndex}"][data-slot="${slotIndex}"][data-sinif="${room.name}"]`);
    if (cellDiv) {
        // Set data attributes
        cellDiv.setAttribute('data-day', dayIndex);
        cellDiv.setAttribute('data-slot', slotIndex);
        cellDiv.setAttribute('data-sinif', room.name);
            cellDiv.innerHTML = `
                <div class="cell-content">
                    <div class="dkodu">${course.dkodu} - ${course.sube}</div>
                    <div class="placed-count">Kontenjan: ${room.kon}</div>
                    ${!course.isProblematic ? `
                        <div class="delete-icon">
                            <i class="fas fa-times"></i>
                        </div>
                    ` : ''}
                </div>
            `;
        cellDiv.classList.add(`program-${course.program.toLowerCase()}`);
        
        // Add delete functionality
        const deleteIcon = cellDiv.querySelector('.delete-icon');
        if (deleteIcon) {
            // Remove any existing click listeners
            deleteIcon.replaceWith(deleteIcon.cloneNode(true));
            const newDeleteIcon = cellDiv.querySelector('.delete-icon');
            newDeleteIcon.addEventListener('click', () => {
                handleCellDelete(cellDiv, uniqueId, room, timeSlotKey);
            });
        }
        
        // Update problem card display
        updateProblemCard(uniqueId);
        
        // Dolu hücre sayısını güncelle
        updateFilledCellCount();
        
        // Otomatik kaydetme - Hemen kaydet ve sonucu bekle
        try {
            await saveCalendarData();
            console.log('Yerleştirme sonrası otomatik kaydetme başarılı');
        } catch (error) {
            console.error('Yerleştirme sonrası otomatik kaydetme sırasında hata:', error);
            alert('Değişiklikler kaydedilirken bir hata oluştu!');
        }
    }
    
    return true;
}


async function placeSavedExam(cellDiv, course, sinif, dayIndex, slotIndex) {
    const timeSlotKey = `${dayIndex}-${slotIndex}`;
    const uniqueId = `${course.dkodu}-${course.sube}`;
    
    // Set data attributes
    cellDiv.setAttribute('data-day', dayIndex);
    cellDiv.setAttribute('data-slot', slotIndex);
    cellDiv.setAttribute('data-sinif', sinif.name);
    
    // Check if course is GRP program
    const isGRP = course.program === 'GRP';
    
    // Calculate placed students based on remaining students and classroom capacity
    let placedStudents;
    if (isGRP) {
        let totalPlacedStudents = 0;
        timeSlotPlacements.forEach(placements => {
            placements.forEach(placement => {
                if (placement.uniqueId === uniqueId) {
                    totalPlacedStudents += placement.placedCount;
                }
            });
        });
        const remainingGRPStudents = Math.max(0, course.ogrenciler.length - totalPlacedStudents);
        placedStudents = Math.min(remainingGRPStudents, sinif.kon);
    } else {
        const totalStudents = course.ogrenciler.length;
        placedStudents = Math.min(totalStudents, sinif.kon);
    }
    
    // Update remaining students count only for non-GRP courses
    if (!isGRP) {
        const currentRemaining = courseRemainingStudents.get(uniqueId);
        if (typeof currentRemaining === 'number') {
            courseRemainingStudents.set(uniqueId, currentRemaining - placedStudents);
        }
    }
    
    // Add course to time slot tracking if not already exists
    const currentPlacements = timeSlotPlacements.get(timeSlotKey) || [];
    if (!currentPlacements.some(p => p.uniqueId === uniqueId && p.sinif === sinif.name)) {
        currentPlacements.push({
            uniqueId: uniqueId,
            dkodu: course.dkodu,
            sube: course.sube,
            ogrenciler: course.ogrenciler,
            sinif: sinif.name,
            placedCount: placedStudents,
            program: course.program,
            isProblematic: course.isProblematic || false
        });
        timeSlotPlacements.set(timeSlotKey, currentPlacements);
    }
    
    // Update cell content with delete icon
    cellDiv.innerHTML = `
        <div class="cell-content">
            <div class="dkodu">${course.dkodu} - ${course.sube}</div>
            <div class="placed-count">Kontenjan: ${sinif.kon}</div>
            ${!course.isProblematic ? `
                <div class="delete-icon">
                    <i class="fas fa-times"></i>
                </div>
            ` : ''}
        </div>
    `;
    cellDiv.classList.add(`program-${course.program.toLowerCase()}`);
    
    // Add delete functionality
    const deleteIcon = cellDiv.querySelector('.delete-icon');
    if (deleteIcon) {
        // Remove any existing click listeners
        deleteIcon.replaceWith(deleteIcon.cloneNode(true));
        const newDeleteIcon = cellDiv.querySelector('.delete-icon');
        newDeleteIcon.addEventListener('click', () => {
            handleCellDelete(cellDiv, uniqueId, sinif, timeSlotKey);
        });
    }
    
    // Update problem card display
    updateProblemCard(uniqueId);
    
    // Otomatik kaydetme - Hemen kaydet ve sonucu bekle
    try {
        await saveCalendarData();
        console.log('Kayıtlı sınav yerleştirme sonrası otomatik kaydetme başarılı');
    } catch (error) {
        console.error('Kayıtlı sınav yerleştirme sonrası otomatik kaydetme sırasında hata:', error);
        alert('Değişiklikler kaydedilirken bir hata oluştu!');
    }
}

function createProblemCard(course) {
    const uniqueId = `${course.dkodu}-${course.sube}`;
    const card = document.createElement('div');
    card.className = `problem-card program-${course.program.toLowerCase()}`;
    card.setAttribute('data-unique-id', uniqueId);
    
const isGRP = course.program === 'GRP';
let remainingStudents;
if (isGRP) {
    let totalPlacedStudents = 0;
    timeSlotPlacements.forEach(placements => {
        placements.forEach(placement => {
            if (placement.uniqueId === uniqueId) {
                totalPlacedStudents += placement.placedCount;
            }
        });
    });
    remainingStudents = Math.max(0, course.ogrenciler.length - totalPlacedStudents);
} else {
    remainingStudents = courseRemainingStudents.get(uniqueId);
}
    const originalCount = originalStudentCounts.get(uniqueId);
    
    // Dersin kullandığı sınıfları ve yerleşim bilgilerini bul
    const usedClassrooms = new Map(); // key: timeSlotKey, value: [{sinif, count}]
    let totalClassroomsUsed = 0;

    timeSlotPlacements.forEach((placements, timeSlotKey) => {
        const coursePlacements = placements.filter(p => p.uniqueId === uniqueId);
        if (coursePlacements.length > 0) {
            totalClassroomsUsed += coursePlacements.length;
            usedClassrooms.set(timeSlotKey, coursePlacements.map(p => ({
                sinif: p.sinif,
                count: p.placedCount || 0
            })));
        }
    });

    const placementInfo = Array.from(usedClassrooms.entries()).map(([timeSlot, rooms]) => {
        const [dayIndex, slotIndex] = timeSlot.split('-').map(Number);
        const timeSlotStr = timeSlots[slotIndex];
        // Takvim sisteminde 0=Pazar olduğu için +1 ekleyerek günleri düzeltiyoruz
        const actualDayIndex = dayIndex + 1;
        return `${dayNames[actualDayIndex]} ${timeSlotStr}: ${rooms.map(r => 
            r.count > 0 ? `${r.sinif}(${r.count})` : r.sinif
        ).join(', ')}`;
    }).join('<br>');

    card.innerHTML = `
        <div class="dkodu">${course.dkodu} - ${course.sube}</div>
        <div class="program-info" style="font-size: 0.8em; color: #666; margin: 4px 0;">
            <i class="fas fa-graduation-cap"></i> ${course.program || 'Program belirtilmemiş'}
        </div>
        <div class="student-count">
            <i class="fas fa-users"></i> 
            ${remainingStudents} / ${originalCount} Öğrenci
            ${remainingStudents > 0 ? '(Yerleştirilmesi gereken)' : '(Tamamlandı)'}
            ${totalClassroomsUsed > 0 ? 
                `<br><i class="fas fa-building"></i> Toplam ${totalClassroomsUsed} sınıf kullanıldı` : 
                ''}
            ${usedClassrooms.size > 0 ? 
                `<br><div class="placement-info">
                    <i class="fas fa-info-circle"></i> Yerleşimler:<br>
                    ${placementInfo}
                </div>` : 
                ''
            }
        </div>
    `;
    
    // GRP courses are always draggable
    if (isGRP) {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', uniqueId);
        });
    } else {
        if (remainingStudents <= 0) {
            card.style.backgroundColor = '#90EE90';
            card.draggable = false;
        } else {
            card.draggable = true;
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', uniqueId);
            });
        }
    }
    
    if (course.isProblematic) {
        card.classList.add('sorunlu-lesson');
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
    } catch (error) {
        console.error('Error saving calendar data:', error);
    }
}

// timeSlotPlacements map'ini temizleme fonksiyonu
function clearTimeSlotPlacements() {
    console.log('Mevcut yerleşimler temizleniyor...');
    console.log('Temizlik öncesi:', Array.from(timeSlotPlacements.entries()));
    timeSlotPlacements.clear();
    console.log('Temizlik sonrası:', Array.from(timeSlotPlacements.entries()));
}

// Calendar yüklenirken ve yeni tarih seçildiğinde timeSlotPlacements'ı temizle
async function fetchAndPopulateCalendar(startDate, endDate) {
    // Önce sorunlu ders saatlerini kontrol et ve timeSlots'u güncelle
    await updateTimeSlotsWithProblematicCourses();
    try {
        // 'days' değişkenini burada tanımlıyoruz
        const days = getDaysBetweenDates(startDate, endDate);

        clearTimeSlotPlacements();
        
        // Fakülte ve sorunlu verilerini paralel olarak çek
        const [fakulteResponse, sorunluResponse] = await Promise.all([
            fetch('/api/fakulte-data'),
            fetch('/api/sorunlu')
        ]);

        if (!fakulteResponse.ok || !sorunluResponse.ok) {
            throw new Error('Veri çekme hatası');
        }

        const data = await fakulteResponse.json();
        const sorunluResponseData = await sorunluResponse.json();

        // 'sorunluResponseData' içinde 'data' alanı varsa onu kullan
        let sorunluVeriler = [];
        if (Array.isArray(sorunluResponseData.data)) {
            sorunluVeriler = sorunluResponseData.data;
        } else if (Array.isArray(sorunluResponseData)) {
            sorunluVeriler = sorunluResponseData;
        } else {
            console.log('sorunluData beklenen formatta değil');
        }

        // 'sorunluData' Map'ini doldur
        sorunluVeriler.forEach(item => {
            const uniqueId = `${item.dkodu}-${item.sube}`;

            // 'gun' ve 'saat' alanlarından dayIndex ve slotIndex hesapla
            const dayIndex = dayNames.indexOf(item.gun);
            const slotIndex = timeSlots.indexOf(item.saat);
            const timeSlotKey = `${dayIndex}-${slotIndex}`;

            if (!sorunluData.has(timeSlotKey)) {
                sorunluData.set(timeSlotKey, []);
            }
            sorunluData.get(timeSlotKey).push({
                uniqueId: uniqueId,
                dkodu: item.dkodu,
                sube: item.sube,
                ogrenciler: item.ogrenciler || [],
                sinif: item.sinif
            });
        });

        // Clear existing data
        timeSlotPlacements.clear();
        courseRemainingStudents.clear();
        originalStudentCounts.clear();
        coursesData.clear();
        
        // First, initialize course data and original student counts
        data.lctrdata.forEach(course => {
            const uniqueId = `${course.dkodu}-${course.sube}`;
            const studentCount = Array.isArray(course.ogrenciler) ? course.ogrenciler.length : 0;
            
            coursesData.set(uniqueId, course);
            originalStudentCounts.set(uniqueId, studentCount);
            courseRemainingStudents.set(uniqueId, studentCount);
        });

        // Then, add saved exam placements
        data.lctrdata.forEach(course => {
            if (course.examDate && course.examTime && Array.isArray(course.examSiniflar)) {
                const uniqueId = `${course.dkodu}-${course.sube}`;
                const dayIndex = days.findIndex(d => 
                    d.toLocaleDateString('tr-TR') === new Date(course.examDate).toLocaleDateString('tr-TR')
                );
                const slotIndex = timeSlots.indexOf(course.examTime);
                const timeSlotKey = `${dayIndex}-${slotIndex}`;
                const placements = timeSlotPlacements.get(timeSlotKey) || [];

                course.examSiniflar.forEach(sinifName => {
                    const sinif = data.sinifs.find(s => s.name === sinifName);
                    if (sinif) {
                        // Calculate placed students based on remaining students and classroom capacity
                        let placedStudents;
                        if (course.program === 'GRP') {
                            // For GRP programs, calculate total placed students across all time slots
                            let totalPlacedStudents = 0;
                            // First, count existing placements
                            timeSlotPlacements.forEach((existingPlacements, existingTimeSlotKey) => {
                                existingPlacements.forEach(placement => {
                                    if (placement.uniqueId === uniqueId) {
                                        totalPlacedStudents += placement.placedCount;
                                    }
                                });
                            });
                            // Then, count placements that are about to be added in the current time slot
                            placements.forEach(placement => {
                                if (placement.uniqueId === uniqueId) {
                                    totalPlacedStudents += placement.placedCount;
                                }
                            });
                            // Finally, calculate remaining students and limit by classroom capacity
                            const remainingGRPStudents = Math.max(0, course.ogrenciler.length - totalPlacedStudents);
                            placedStudents = Math.min(remainingGRPStudents, sinif.kon);
                            console.log(`GRP Program ${course.dkodu}-${course.sube}:`, {
                                totalPlacedStudents,
                                totalStudents: course.ogrenciler.length,
                                remainingGRPStudents,
                                classroomCapacity: sinif.kon,
                                finalPlacedCount: placedStudents
                            });
                        } else {
                            // For non-GRP programs, just use the classroom capacity
                            const studentCount = originalStudentCounts.get(uniqueId);
                            placedStudents = Math.min(sinif.kon, studentCount);
                        }

                        placements.push({
                            uniqueId,
                            dkodu: course.dkodu,
                            sube: course.sube,
                            ogrenciler: course.ogrenciler,
                            sinif: sinifName,
                            placedCount: placedStudents,
                            program: course.program,
                            isProblematic: course.isProblematic || false
                        });
                    }
                });

                if (placements.length > 0) {
                    timeSlotPlacements.set(timeSlotKey, placements);
                }
            }
        });

        // Update remaining students count for all courses
        coursesData.forEach((course, uniqueId) => {
            let totalPlacedStudents = 0;
            timeSlotPlacements.forEach(placements => {
                placements.forEach(placement => {
                    if (placement.uniqueId === uniqueId) {
                        totalPlacedStudents += placement.placedCount;
                    }
                });
            });
            const originalCount = originalStudentCounts.get(uniqueId);
            courseRemainingStudents.set(uniqueId, Math.max(0, originalCount - totalPlacedStudents));
        });

        // Add sorunlu courses to coursesData and related maps
        sorunluVeriler.forEach(course => {
            const uniqueId = `${course.dkodu}-${course.sube}`;
            course.isProblematic = true;
            coursesData.set(uniqueId, course);
            originalStudentCounts.set(uniqueId, course.ogrenciler.length);
            courseRemainingStudents.set(uniqueId, course.ogrenciler.length);

            // Add to timeSlotPlacements
            const dayIndex = days.findIndex(d => 
                d.toLocaleDateString('tr-TR') === new Date(course.examDate).toLocaleDateString('tr-TR')
            );
            const slotIndex = timeSlots.indexOf(course.examTime);
            const timeSlotKey = `${dayIndex}-${slotIndex}`;
            const placements = timeSlotPlacements.get(timeSlotKey) || [];

            // Create placement for each classroom
            course.examSiniflar.forEach(sinif => {
                const studentsPerRoom = Math.ceil(course.ogrenciler.length / course.examSiniflar.length);
                placements.push({
                    uniqueId: uniqueId,
                    dkodu: course.dkodu,
                    sube: course.sube,
                    ogrenciler: course.ogrenciler,
                    sinif: sinif,
                    placedCount: studentsPerRoom,
                    program: course.program,
                    isProblematic: true
                });
            });
            
            timeSlotPlacements.set(timeSlotKey, placements);
        });

        // Update remaining students count for sorunlu courses
        sorunluVeriler.forEach(course => {
            const uniqueId = `${course.dkodu}-${course.sube}`;
            let totalPlacedStudents = 0;
            timeSlotPlacements.forEach(placements => {
                placements.forEach(placement => {
                    if (placement.uniqueId === uniqueId) {
                        totalPlacedStudents += placement.placedCount;
                    }
                });
            });
            const originalCount = originalStudentCounts.get(uniqueId);
            courseRemainingStudents.set(uniqueId, Math.max(0, originalCount - totalPlacedStudents));
            updateProblemCard(uniqueId);
        });

        // Sorunlu derslerin yerleşim logları
        console.group('=== SORUNLU DERSLER YERLEŞİMLERİ ===');
        if (sorunluData && sorunluData.size > 0) {
            // sorunluData Map'ini işleyin
            sorunluData.forEach((placementsArray, timeSlotKey) => {
                console.log(`Zaman Dilimi: ${timeSlotKey}`);
                placementsArray.forEach(placement => {
                    console.log(`Ders: ${placement.dkodu}, Şube: ${placement.sube}, Sınıf: ${placement.sinif}`);
                });
            });
        } else {
            console.log('Sorunlu ders verisi bulunamadı');
        }
        console.groupEnd();


        
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
        
        calculateBlockCapacities();
        logAllPlacements(); // Takvim yüklendikten sonra log
        
        // Dolu hücre sayısını güncelle
        updateFilledCellCount();

    } catch (error) {
        console.error('Error fetching calendar data:', error);
    }
}

function saveCalendarState() {
    const calendarState = {
        timeSlotPlacements: Array.from(timeSlotPlacements.entries()),
        courseRemainingStudents: Array.from(courseRemainingStudents.entries()),
        originalStudentCounts: Array.from(originalStudentCounts.entries()),
        coursesData: Array.from(coursesData.entries()),
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value
    };
    localStorage.setItem('calendarState', JSON.stringify(calendarState));
}

// Takvim verilerini yükleme fonksiyonu
function loadCalendarState() {
    const savedState = localStorage.getItem('calendarState');
    if (savedState) {
        const state = JSON.parse(savedState);
        
        // Maps'leri geri yükle
        timeSlotPlacements = new Map(state.timeSlotPlacements);
        courseRemainingStudents = new Map(state.courseRemainingStudents);
        originalStudentCounts = new Map(state.originalStudentCounts);
        coursesData = new Map(state.coursesData);

        // Tarihleri geri yükle
        document.getElementById('startDate').value = state.startDate;
        document.getElementById('endDate').value = state.endDate;

        // Takvimi yeniden oluştur
        const days = getDaysBetweenDates(state.startDate, state.endDate);
        renderCalendar(days);
        
        // Problem kartlarını güncelle
        coursesData.forEach((course, uniqueId) => {
            updateProblemCard(uniqueId);
        });

        return true;
    }
    return false;
}

// Her değişiklikte state'i kaydet
function handleCalendarChange() {
    saveCalendarState();
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
        timeSlots.forEach((time, slot) => {
            const timeCell = document.createElement('td');
            timeCell.className = `day-${dayClass}`;
            const cellDiv = document.createElement('div');
            cellDiv.className = 'calendar-cell';
            cellDiv.setAttribute('data-day', dayIndex);
            cellDiv.setAttribute('data-slot', slot);
            cellDiv.setAttribute('data-sinif', sinif.name);
            
            // Son saat diliminde ve son gün değilse ayırıcı ekle
            if (slot === timeSlots.length - 1 && dayIndex < days.length - 1) {
                timeCell.classList.add('day-divider');
            }
            
            // Check if there's a saved exam for this cell
            const currentDate = day.toISOString().split('T')[0];
            const currentTime = time;
            
            const savedExam = data.lctrdata.find(course => 
                course.examDate === currentDate && 
                course.examTime === currentTime && 
                Array.isArray(course.examSiniflar) && 
                course.examSiniflar.includes(sinif.name)
            );
            
            if (savedExam) {
                const uniqueId = `${savedExam.dkodu}-${savedExam.sube}`;
                const timeSlotKey = `${dayIndex}-${slot}`;
                const placements = timeSlotPlacements.get(timeSlotKey) || [];
                
                // Only add if not already placed
                if (!placements.some(p => p.uniqueId === uniqueId && p.sinif === sinif.name)) {
                    // Calculate placed students based on remaining students and classroom capacity
                    let placedStudents;
                    if (savedExam.program === 'GRP') {
                        // For GRP programs, calculate total placed students across all time slots
                        let totalPlacedStudents = 0;
                        
                        // First, count existing placements in all time slots
                        timeSlotPlacements.forEach((existingPlacements, existingTimeSlotKey) => {
                            existingPlacements.forEach(placement => {
                                if (placement.uniqueId === uniqueId) {
                                    totalPlacedStudents += placement.placedCount;
                                }
                            });
                        });
                        
                        // Calculate remaining students and limit by classroom capacity
                        const remainingGRPStudents = Math.max(0, savedExam.ogrenciler.length - totalPlacedStudents);
                        
                        // For GRP programs, evenly distribute remaining students across available classrooms
                        const availableClassrooms = savedExam.examSiniflar.length;
                        const studentsPerRoom = Math.ceil(remainingGRPStudents / availableClassrooms);
                        placedStudents = Math.min(studentsPerRoom, sinif.kon);
                        
                        // Log detailed GRP placement information
                        console.group(`GRP Program Placement: ${savedExam.dkodu}-${savedExam.sube}`);
                        console.log('Total students:', savedExam.ogrenciler.length);
                        console.log('Already placed students:', totalPlacedStudents);
                        console.log('Remaining students:', remainingGRPStudents);
                        console.log('Available classrooms:', availableClassrooms);
                        console.log('Students per room:', studentsPerRoom);
                        console.log('Classroom capacity:', sinif.kon);
                        console.log('Final placed count:', placedStudents);
                        console.log('Current time slot:', timeSlotKey);
                        console.log('Current placements:', placements);
                        console.log('All time slot placements:', Array.from(timeSlotPlacements.entries()));
                        console.groupEnd();
                    } else {
                        // For non-GRP programs, just use the classroom capacity
                        placedStudents = Math.min(sinif.kon, savedExam.ogrenciler.length);
                    }
                    
                    // Add to placements
                    placements.push({
                        uniqueId: uniqueId,
                        dkodu: savedExam.dkodu,
                        sube: savedExam.sube,
                        ogrenciler: savedExam.ogrenciler,
                        sinif: sinif.name,
                        placedCount: placedStudents,
                        program: savedExam.program,
                        isProblematic: savedExam.isProblematic || false
                    });
                    timeSlotPlacements.set(timeSlotKey, placements);
                }
            }
            
            // Update cell content based on placements
            const timeSlotKey = `${dayIndex}-${slot}`;
            const placement = (timeSlotPlacements.get(timeSlotKey) || [])
                .find(p => p.sinif === sinif.name);
            
            if (placement) {
                cellDiv.innerHTML = `
                    <div class="cell-content">
                        <div class="dkodu">${placement.dkodu} - ${placement.sube}</div>
                        <div class="placed-count">Kontenjan: ${sinif.kon}</div>
                        ${!placement.isProblematic ? `
                            <div class="delete-icon">
                                <i class="fas fa-times"></i>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                // Add appropriate classes
                if (placement.isProblematic) {
                    cellDiv.classList.add('sorunlu-lesson');
                } else if (placement.program) {
                    cellDiv.classList.add(`program-${placement.program.toLowerCase()}`);
                }
                
                // Add delete functionality
                const deleteIcon = cellDiv.querySelector('.delete-icon');
                if (deleteIcon) {
                    // Remove any existing click listeners
                    deleteIcon.replaceWith(deleteIcon.cloneNode(true));
                    const newDeleteIcon = cellDiv.querySelector('.delete-icon');
                    newDeleteIcon.addEventListener('click', () => {
                        handleCellDelete(cellDiv, placement.uniqueId, sinif, timeSlotKey);
                    });
                }
                
                // Update problem card
                updateProblemCard(placement.uniqueId);
            }

            setupDragAndDrop(cellDiv, sinif, dayIndex, slot);
            timeCell.appendChild(cellDiv);
            row.appendChild(timeCell);
        });
    });
    
    return row;
}

// Program filtresi için yardımcı fonksiyonlar
async function updateProgramFilter() {
    try {
        const response = await fetch('/api/programs');
        const programs = await response.json();

        const programFilter = document.getElementById('programFilter');
        programFilter.innerHTML = ''; // Clear existing content
        
        programs.sort().forEach(program => {
            const label = document.createElement('label');
            label.className = 'program-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = program;
            checkbox.checked = true; // Default to checked
            
            checkbox.addEventListener('change', (e) => {
                e.target.parentElement.classList.toggle('active', e.target.checked);
                filterProblemCards();
            });
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(program));
            label.classList.add('active'); // Initially active
            
            programFilter.appendChild(label);
        });
    } catch (error) {
        console.error('Program listesi alınırken hata:', error);
    }
}

function filterProblemCards() {
    const checkboxes = document.querySelectorAll('#programFilter input[type="checkbox"]');
    const selectedPrograms = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    const cards = document.querySelectorAll('.problem-card');
    cards.forEach(card => {
        const uniqueId = card.getAttribute('data-unique-id');
        const course = coursesData.get(uniqueId);
        
        if (selectedPrograms.length === 0 || selectedPrograms.includes(course?.program)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function toggleAllPrograms(checked) {
    const checkboxes = document.querySelectorAll('#programFilter input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = checked;
        checkbox.parentElement.classList.toggle('active', checked);
    });
    filterProblemCards();
}

// Initialize calendar
// Analiz fonksiyonları
function showAnalysisModal() {
    document.getElementById('analysisModal').style.display = 'block';
    fetchAnalysisData();
}

function closeAnalysisModal() {
    document.getElementById('analysisModal').style.display = 'none';
}

async function fetchAnalysisData() {
    const maxExamsInfo = document.getElementById('maxExamsInfo');
    try {
        // Önce mevcut yerleşimleri kaydet
        await saveCalendarData();
        
        // Analiz verilerini al
        const response = await fetch('/api/analyze-exams');
        if (!response.ok) {
            throw new Error('Analiz verisi alınamadı');
        }
        
        const data = await response.json();
        const { maxExams } = data;

        if (!maxExams || !maxExams.student) {
            maxExamsInfo.innerHTML = `
                <div class="alert alert-info">
                    <h5 class="alert-heading mb-3">
                        <i class="fas fa-info-circle"></i> 
                        Bilgi
                    </h5>
                    <p>Henüz hiçbir öğrenciye sınav atanmamış.</p>
                </div>
            `;
            return;
        }

        // Sonuçları göster
        maxExamsInfo.innerHTML = `
            <div class="alert ${maxExams.count >= 3 ? 'alert-danger' : 'alert-warning'}">
                <h5 class="alert-heading mb-3">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Dikkat: Aynı Gün En Çok Sınavı Olan Öğrenci
                </h5>
                <div class="d-flex flex-column gap-2">
                    <div>
                        <i class="fas fa-user"></i> 
                        <strong>Öğrenci No:</strong> 
                        <span class="badge bg-primary">${maxExams.student}</span>
                    </div>
                    <div>
                        <i class="fas fa-calendar"></i> 
                        <strong>Tarih:</strong> 
                        <span class="badge bg-info">${maxExams.date ? new Date(maxExams.date).toLocaleDateString('tr-TR') : 'Bulunamadı'}</span>
                    </div>
                    <div>
                        <i class="fas fa-clipboard-list"></i> 
                        <strong>Sınav Sayısı:</strong> 
                        <span class="badge ${maxExams.count >= 3 ? 'bg-danger' : 'bg-primary'}">${maxExams.count}</span>
                        ${maxExams.count >= 3 ? `
                            <div class="mt-2 text-danger">
                                <i class="fas fa-exclamation-circle"></i>
                                <strong>Uyarı:</strong> Bu öğrenci aynı gün içinde ${maxExams.count} sınava girecek!
                            </div>
                        ` : ''}
                    </div>
                </div>
                <hr>
                <div class="mt-3">
                    <p class="mb-2">
                        <i class="fas fa-info-circle"></i>
                        Bu öğrencinin programını görmek için yukarıdaki arama kutusuna öğrenci numarasını yazıp aratabilirsiniz.
                    </p>
                    <small class="text-muted">
                        <i class="fas fa-exclamation-circle"></i>
                        Not: Analiz sonuçları hem normal hem de sorunlu dersleri içermektedir.
                    </small>
                </div>
            </div>
        `;

        // Öğrenci numarası otomatik olarak arama kutusuna yerleştir ve programını göster
        document.getElementById('studentNoInput').value = maxExams.student;
        await searchStudent();
    } catch (error) {
        console.error('Analiz verisi alınamadı:', error);
        alert('Analiz verisi alınırken bir hata oluştu!');
    }
}

async function searchStudent() {
    const studentNo = document.getElementById('studentNoInput').value.trim();
    if (!studentNo) {
        alert('Lütfen öğrenci numarası giriniz!');
        return;
    }

    try {
        // Önce mevcut yerleşimleri kaydet
        await saveCalendarData();
        
        // Öğrencinin sınav programını al
        const response = await fetch(`/api/analyze-exams?studentNo=${studentNo}`);
        if (!response.ok) {
            throw new Error('Öğrenci sınav programı alınamadı');
        }
        
        const data = await response.json();
        const { schedule } = data;

        // Sınav programını göster
        const scheduleDiv = document.getElementById('studentSchedule');
        if (schedule.length > 0) {
            // Tarihe göre sırala
            schedule.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Gün bazlı grupla
            const groupedByDate = schedule.reduce((acc, exam) => {
                const date = exam.date;
                if (!acc[date]) {
                    acc[date] = [];
                }
                acc[date].push(exam);
                return acc;
            }, {});

            // Günlük sınav sayılarını hesapla
            const examCountsByDate = {};
            Object.entries(groupedByDate).forEach(([date, exams]) => {
                examCountsByDate[date] = exams.length;
            });

            let html = '<div class="mt-3">';
            for (const [date, exams] of Object.entries(groupedByDate)) {
                const examCount = examCountsByDate[date];
                const isHighLoad = examCount >= 3;
                
                html += `
                    <div class="card mb-3 shadow-sm">
                        <div class="card-header ${isHighLoad ? 'bg-warning' : 'bg-light'}">
                            <div class="d-flex justify-content-between align-items-center">
                                <strong>
                                    <i class="fas fa-calendar-day"></i> 
                                    ${new Date(date).toLocaleDateString('tr-TR')}
                                </strong>
                                <span class="badge ${isHighLoad ? 'bg-danger' : 'bg-primary'}">
                                    ${examCount} sınav
                                    ${isHighLoad ? ' (Yoğun gün!)' : ''}
                                </span>
                            </div>
                        </div>
                        <div class="card-body">
                            <ul class="list-unstyled mb-0">
                                ${exams.map(exam => `
                                    <li class="mb-3 border-bottom pb-2">
                                        <div class="d-flex flex-column">
                                            <div class="d-flex align-items-center mb-1">
                                                <span class="me-3">
                                                    <i class="fas fa-clock text-secondary"></i> 
                                                    ${exam.time}
                                                </span>
                                                <span>
                                                    <i class="fas fa-book ${exam.isProblematic ? 'text-danger' : 'text-primary'}"></i>
                                                    <strong>${exam.course}</strong>
                                                </span>
                                                ${exam.isProblematic ? 
                                                    `<span class="badge bg-danger ms-2">
                                                        <i class="fas fa-exclamation-triangle"></i> 
                                                        Sorunlu Ders
                                                    </span>` : 
                                                    ''
                                                }
                                            </div>
                                            ${exam.siniflar ? `
                                                <div class="ms-4 small text-muted">
                                                    <i class="fas fa-building"></i> 
                                                    Sınıflar: ${exam.siniflar.join(', ')}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        ${isHighLoad ? `
                            <div class="card-footer bg-warning-subtle">
                                <small class="text-warning-emphasis">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    Bu tarihte ${examCount} sınav bulunuyor!
                                </small>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            html += '</div>';
            scheduleDiv.innerHTML = html;
        } else {
            scheduleDiv.innerHTML = `
                <div class="alert alert-info d-flex align-items-center">
                    <i class="fas fa-info-circle me-2"></i>
                    <div>Bu öğrenci için sınav bulunamadı.</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Öğrenci sınav programı alınamadı:', error);
        scheduleDiv.innerHTML = `
            <div class="alert alert-danger d-flex align-items-center">
                <i class="fas fa-exclamation-circle me-2"></i>
                <div>Öğrenci sınav programı alınırken bir hata oluştu!</div>
            </div>
        `;
    }
}

// Zoom functionality
let currentZoom = 1;
const zoomStep = 0.1;
const minZoom = 0.5;
const maxZoom = 2.0;

function handleZoom(delta) {
    const table = document.querySelector('.table');
    if (!table) return;

    // Update zoom level
    if (delta > 0) {
        currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
    } else {
        currentZoom = Math.max(currentZoom - zoomStep, minZoom);
    }

    // Apply transform to table
    table.style.transform = `scale(${currentZoom})`;
}

// Keyboard shortcuts for zoom
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            handleZoom(1);
        } else if (e.key === '-') {
            e.preventDefault();
            handleZoom(-1);
        }
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => handleZoom(1));
    document.getElementById('zoomOut').addEventListener('click', () => handleZoom(-1));

    // Mouse wheel zoom
    document.querySelector('.calendar-container').addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -Math.sign(e.deltaY);
            handleZoom(delta);
        }
    }, { passive: false });

    // Filter toggle functionality
    document.getElementById('filterToggle').addEventListener('click', () => {
        const filterSection = document.getElementById('filterSection');
        filterSection.classList.toggle('show');
    });

    // Program filter event listeners
    document.getElementById('selectAll').addEventListener('click', () => toggleAllPrograms(true));
    document.getElementById('clearFilter').addEventListener('click', () => toggleAllPrograms(false));

    // Analiz butonu event listener'ı
    document.getElementById('analyzeButton').addEventListener('click', async () => {
        // Önce mevcut yerleşimleri kaydet
        await saveCalendarData();
        showAnalysisModal();
    });
    
    // Analiz modal kapatma butonu event listener'ı
    document.querySelector('#analysisModal .btn-close').addEventListener('click', closeAnalysisModal);
    
    // Öğrenci arama form event listener'ı
    const searchForm = document.querySelector('.student-search .input-group');
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
    });
    
    // Öğrenci arama butonu event listener'ı
    document.getElementById('searchStudentBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Önce mevcut yerleşimleri kaydet
        await saveCalendarData();
        searchStudent();
    });
    
    // Enter tuşu ile arama yapabilme
    document.getElementById('studentNoInput').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Önce mevcut yerleşimleri kaydet
            await saveCalendarData();
            searchStudent();
        }
    });

    // Initialize modal functionality
    function initializeModal() {
        const analysisModal = document.getElementById('analysisModal');
        const modalDialog = analysisModal.querySelector('.modal-dialog');
        const modalContent = analysisModal.querySelector('.modal-content');
        const studentSearch = analysisModal.querySelector('.student-search');
        const inputGroup = analysisModal.querySelector('.input-group');
        const studentInput = analysisModal.querySelector('#studentNoInput');
        const searchButton = analysisModal.querySelector('#searchStudentBtn');
        const closeButton = analysisModal.querySelector('.btn-close');
        const modalBody = analysisModal.querySelector('.modal-body');
        const modalHeader = analysisModal.querySelector('.modal-header');

        // Prevent event bubbling for all interactive elements
        const interactiveElements = [
            modalDialog,
            modalContent,
            studentSearch,
            inputGroup,
            studentInput,
            searchButton,
            closeButton,
            modalBody,
            modalHeader,
            ...analysisModal.querySelectorAll('button, input, .student-search *, #maxExamsInfo, #studentSchedule')
        ];

        // Add event listeners with proper event handling
        interactiveElements.forEach(element => {
            if (element) {
                const stopEvent = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                };

                element.addEventListener('click', stopEvent);
                element.addEventListener('mousedown', stopEvent);
                element.addEventListener('mouseup', stopEvent);
                element.addEventListener('touchstart', stopEvent, { passive: false });
                element.addEventListener('touchend', stopEvent, { passive: false });
            }
        });

        // Handle modal background click
        analysisModal.addEventListener('click', (e) => {
            if (e.target === analysisModal) {
                e.preventDefault();
                closeAnalysisModal();
            }
        });

        // Handle form submission
        if (studentSearch) {
            studentSearch.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }

        // Handle Enter key in search input
        if (studentInput) {
            studentInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    await saveCalendarData();
                    searchStudent();
                }
            });

            // Prevent modal close when typing
            studentInput.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                studentInput.focus();
            });
        }

        // Handle search button click
        if (searchButton) {
            searchButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await saveCalendarData();
                searchStudent();
            });
        }

        // Handle close button
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeAnalysisModal();
            });
        }
    }

    // Initialize modal
    initializeModal();

    // Load active period dates
    try {
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
    
    // İlk program filtresini oluştur
    await updateProgramFilter();
});

function logAllPlacements() {
    console.group('=== TÜM DERS YERLEŞİMLERİ ===');
    console.log('Toplam zaman dilimi:', timeSlotPlacements.size);
    
    timeSlotPlacements.forEach((placements, timeSlotKey) => {
        const [dayIndex, slotIndex] = timeSlotKey.split('-').map(Number);
        console.group(`Zaman Dilimi: Gün ${dayIndex + 1}, Saat ${timeSlots[slotIndex]}`);
        
        placements.forEach(placement => {
            console.log({
                ders: placement.dkodu,
                sube: placement.sube,
                sinif: placement.sinif,
                ogrenciSayisi: placement.placedCount,
                toplamOgrenci: placement.ogrenciler.length
            });
        });
        
        console.groupEnd();
    });
    
    console.groupEnd();
}
