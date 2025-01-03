document.addEventListener('DOMContentLoaded', function() {
    // Modal ve form elementleri
    const modalElement = document.getElementById('examDateModal');
    const examDateModal = new bootstrap.Modal(modalElement);
    const examDateForm = document.getElementById('examDateForm');
    const saveExamDateBtn = document.getElementById('saveExamDate');

    // Kullanıcı bilgilerini al ve başlığı güncelle
    fetch('/auth/status')
        .then(response => response.json())
        .then(data => {
            if (data.authenticated) {
                const titleElement = document.getElementById('programTitle');
                if (data.user.role === 'admin') {
                    titleElement.textContent = 'Tüm Dersler';
                } else if (data.user.department) {
                    titleElement.textContent = `${data.user.department} Bölümü Dersleri`;
                }
            }
        })
        .catch(error => console.error('Kullanıcı bilgisi alınamadı:', error));

    // Active period ve lctrdata derslerini yükle
    loadActivePeriodDates();
    loadLctrData();

    // Sınav tarihi kaydetme
    saveExamDateBtn.addEventListener('click', saveExamDate);

    // Lctrdata dersleri yükleme fonksiyonu
    async function loadLctrData() {
        try {
            const response = await fetch('/api/lctr/list');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Lctrdata response:', data); // Debug için log
            
            const tableBody = document.querySelector('#lctrdataTable tbody');
            tableBody.innerHTML = '';
            
            if (Array.isArray(data)) {
                data.forEach((ders, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${ders.dkodu || ''}</td>
                        <td>${ders.dadi || ''}</td>
                        <td>${ders.ogrenciSayisi || 0}</td>
                        <td id="date-${ders.dkodu}">-</td>
                        <td id="time-${ders.dkodu}">-</td>
                        <td>
                            <button class="btn btn-primary btn-sm" onclick="openDateModal('${ders.dkodu}', '${ders.dadi}', 'lctrdata')">
                                Tarih Belirle
                            </button>
                        </td>
                        <td>
                            <button class="btn btn-outline-secondary btn-sm" id="note-btn-${ders.dkodu}" onclick="openNoteModal('${ders.dkodu}')">
                                <i class="fas fa-sticky-note note-icon-red" id="note-icon-${ders.dkodu}"></i>
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }

            // Mevcut sınav tarihlerini yükle
            loadExistingDates('lctrdata');
        } catch (error) {
            console.error('Lctrdata yüklenirken hata:', error);
        }
    }

    // Mevcut sınav tarihlerini yükleme fonksiyonu
    async function loadExistingDates(dataType) {
        try {
            const response = await fetch(`/api/exam-dates/${dataType}`);
            const dates = await response.json();
            
            dates.forEach(date => {
                const dateCell = document.getElementById(`date-${date.dkodu}`);
                if (dateCell) {
                    const examDate = new Date(date.examDate);
                    const formattedDate = examDate.toLocaleDateString('tr-TR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric'
                    });
                    const hours = examDate.getHours().toString().padStart(2, '0');
                    const minutes = examDate.getMinutes().toString().padStart(2, '0');
                    dateCell.textContent = formattedDate;
                    const timeCell = document.getElementById(`time-${date.dkodu}`);
                    if (timeCell) {
                        timeCell.textContent = `${hours}:${minutes}`;
                    }
                }

                // Not varsa butonun rengini değiştir
                const noteBtn = document.getElementById(`note-btn-${date.dkodu}`);
                if (noteBtn) {
                    const noteIcon = document.getElementById(`note-icon-${date.dkodu}`);
                    if (noteIcon) {
                        if (date.note && date.note.trim() !== '') {
                            noteIcon.classList.remove('note-icon-red');
                            noteIcon.classList.add('note-icon-green');
                        } else {
                            noteIcon.classList.remove('note-icon-green');
                            noteIcon.classList.add('note-icon-red');
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Sınav tarihleri yüklenirken hata:', error);
        }
    }

    // Active period tarihlerini yükleme
    async function loadActivePeriodDates() {
        try {
            const response = await fetch('/api/active-period-dates');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const dates = await response.json();
            
            const dateSelect = document.getElementById('examDate');
            dateSelect.innerHTML = '<option value="">Tarih Seçin</option>';
            
            dates.forEach(date => {
                const option = document.createElement('option');
                option.value = date.value;
                option.textContent = date.label;
                dateSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Active period tarihleri yüklenirken hata:', error);
        }
    }

    // Sınav tarihi kaydetme fonksiyonu
    async function saveExamDate() {
        const dkodu = document.getElementById('dersKodu').value;
        const dadi = document.getElementById('dersAdi').value;
        const dataType = document.getElementById('dataType').value;
        const selectedDate = document.getElementById('examDate').value;
        const selectedTime = document.getElementById('examTime').value;

        if (!selectedDate || !selectedTime) {
            alert('Lütfen tarih ve saat seçin');
            return;
        }

        // Tarih ve saati birleştir
        const examDate = new Date(`${selectedDate}T${selectedTime}`);

        try {
            const response = await fetch('/api/exam-dates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dkodu,
                    dadi,
                    dataType,
                    examDate
                })
            });

            if (response.ok) {
                examDateModal.hide();
                // Tarihi tabloda güncelle
                const dateCell = document.getElementById(`date-${dkodu}`);
                if (dateCell) {
                    const formattedDate = examDate.toLocaleDateString('tr-TR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric'
                    });
                    const hours = examDate.getHours().toString().padStart(2, '0');
                    const minutes = examDate.getMinutes().toString().padStart(2, '0');
                    dateCell.textContent = formattedDate;
                    const timeCell = document.getElementById(`time-${dkodu}`);
                    if (timeCell) {
                        timeCell.textContent = `${hours}:${minutes}`;
                    }
                }
            } else {
                alert('Sınav tarihi kaydedilirken bir hata oluştu');
            }
        } catch (error) {
            console.error('Sınav tarihi kaydedilirken hata:', error);
            alert('Sınav tarihi kaydedilirken bir hata oluştu');
        }
    }

    // Modal açma fonksiyonu
    window.openDateModal = function(dkodu, dadi, dataType) {
        document.getElementById('dersKodu').value = dkodu;
        document.getElementById('dersAdi').value = dadi;
        document.getElementById('dataType').value = dataType;
        document.getElementById('examDate').value = '';
        document.getElementById('examTime').value = '';
        
        examDateModal.show();
    }

    // Not modalı ve kaydetme butonu
    const noteModal = new bootstrap.Modal(document.getElementById('noteModal'));
    const saveNoteBtn = document.getElementById('saveNote');
    saveNoteBtn.addEventListener('click', saveNote);

    // Not modalını açma fonksiyonu
    window.openNoteModal = async function(dkodu) {
        document.getElementById('noteDersKodu').value = dkodu;
        
        try {
            // Mevcut notu getir
            const response = await fetch(`/api/exam-dates/${dkodu}/note`);
            if (!response.ok) {
                throw new Error('Not getirilemedi');
            }
            const data = await response.json();
            document.getElementById('noteText').value = data.note;
        } catch (error) {
            console.error('Not yüklenirken hata:', error);
            document.getElementById('noteText').value = '';
        }

        noteModal.show();
    }

    // Not kaydetme fonksiyonu
    async function saveNote() {
        const dkodu = document.getElementById('noteDersKodu').value;
        const note = document.getElementById('noteText').value;

        try {
            const response = await fetch(`/api/exam-dates/${dkodu}/note`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ note })
            });

            if (response.ok) {
                noteModal.hide();
                // Notu kaydettikten sonra butonun rengini güncelle
                const noteBtn = document.getElementById(`note-btn-${dkodu}`);
                if (noteBtn) {
                    const noteIcon = document.getElementById(`note-icon-${dkodu}`);
                    if (noteIcon) {
                        if (note && note.trim() !== '') {
                            noteIcon.classList.remove('note-icon-red');
                            noteIcon.classList.add('note-icon-green');
                        } else {
                            noteIcon.classList.remove('note-icon-green');
                            noteIcon.classList.add('note-icon-red');
                        }
                    }
                }
            } else {
                const errorData = await response.json();
                alert(`Not kaydedilirken bir hata oluştu: ${errorData.details || errorData.error}`);
            }
        } catch (error) {
            console.error('Not kaydedilirken hata:', error);
            alert(`Not kaydedilirken bir hata oluştu: ${error.message}`);
        }
    }
});
