document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Gözetmen ve aktif period verilerini çek
        const [gozetmenResponse, activePeriodResponse] = await Promise.all([
            fetch('/api/gozetmen'),
            fetch('/api/active-period')
        ]);

        // Gözetmenleri bölüm ve isme göre sırala
        const gozetmenler = (await gozetmenResponse.json()).sort((a, b) => {
            // Önce bölüme göre sırala
            const blmCompare = (a.blm || '').localeCompare(b.blm || '');
            if (blmCompare !== 0) return blmCompare;
            // Bölümler aynıysa isme göre sırala
            return (a.ad || '').localeCompare(b.ad || '');
        });
        const activePeriodData = await activePeriodResponse.json();

        console.log('Gözetmenler:', gozetmenler);
        console.log('Aktif Dönem:', activePeriodData);

        if (!Array.isArray(gozetmenler) || !activePeriodData) {
            throw new Error('Veri formatı geçersiz');
        }

        // Aktif dönem tarih aralığındaki günleri oluştur
        const startDate = new Date(activePeriodData.startDate);
        const endDate = new Date(activePeriodData.endDate);
        const dates = [];
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            dates.push(new Date(date));
        }

        // Sabit saat dilimleri
        const staticTimeSlots = ['09:00', '10:30', '12:00', '13:30', '15:30', '17:30'];
        
        // Her tarih için özel saat dilimlerini topla
        const dateTimeSlots = new Map();
        dates.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            const uniqueTimes = new Set(staticTimeSlots);
            
            // Bu tarihteki görevlerin saatlerini ekle
            gozetmenler.forEach(gozetmen => {
                gozetmen.assignments?.forEach(assignment => {
                    if (assignment.examDate === dateStr && assignment.examTime) {
                        uniqueTimes.add(assignment.examTime);
                    }
                });
            });
            
            // Saat dilimlerini sırala
            dateTimeSlots.set(dateStr, Array.from(uniqueTimes).sort((a, b) => {
                const timeA = new Date(`1970-01-01T${a}`);
                const timeB = new Date(`1970-01-01T${b}`);
                return timeA - timeB;
            }));
        });

        // Toplam sütunu için tüm benzersiz saatleri topla
        const allTimeSlots = new Set(staticTimeSlots);
        gozetmenler.forEach(gozetmen => {
            gozetmen.assignments?.forEach(assignment => {
                if (assignment.examTime) {
                    allTimeSlots.add(assignment.examTime);
                }
            });
        });
        const sortedAllTimeSlots = Array.from(allTimeSlots).sort((a, b) => {
            const timeA = new Date(`1970-01-01T${a}`);
            const timeB = new Date(`1970-01-01T${b}`);
            return timeA - timeB;
        });

        // Renk paletleri
        const departmentColors = {};
        const deptColors = [
            'rgba(67, 97, 238, 0.15)',
            'rgba(114, 9, 183, 0.15)',
            'rgba(247, 37, 133, 0.15)',
            'rgba(76, 201, 240, 0.15)',
            'rgba(46, 196, 182, 0.15)',
            'rgba(255, 159, 28, 0.15)',
            'rgba(45, 106, 79, 0.15)',
            'rgba(230, 57, 70, 0.15)',
            'rgba(42, 157, 143, 0.15)',
            'rgba(233, 196, 106, 0.15)',
            'rgba(244, 162, 97, 0.15)',
            'rgba(38, 70, 83, 0.15)',
            'rgba(2, 48, 71, 0.15)',
            'rgba(128, 128, 128, 0.15)',
            'rgba(169, 169, 169, 0.15)'
        ];

        // Saat dilimleri için renk paleti
        const timeColors = [
            'rgba(230, 240, 255, 0.5)', // Açık mavi
            'rgba(255, 230, 240, 0.5)', // Açık pembe
            'rgba(230, 255, 240, 0.5)', // Açık yeşil
            'rgba(255, 240, 230, 0.5)', // Açık turuncu
            'rgba(240, 230, 255, 0.5)', // Açık mor
            'rgba(240, 255, 230, 0.5)'  // Açık sarı
        ];

        // Benzersiz bölümleri bul ve renk ata
        const departments = [...new Set(gozetmenler.map(g => g.blm))].sort();
        departments.forEach((dept, index) => {
            departmentColors[dept] = deptColors[index % deptColors.length];
        });

        // Başlıkları oluştur
        const thead = document.querySelector('thead');
        
        // İlk satır: Bölüm, Gözetmen, Kısaltma, Tarihler, Toplam, Dağılım
        const headerHtml = `
            <tr>
                <th rowspan="2" style="min-width: 100px">Bölüm</th>
                <th rowspan="2" style="min-width: 150px">Gözetmen</th>
                <th rowspan="2" style="min-width: 80px">Kısaltma</th>
                <th rowspan="2" class="total-column" style="min-width: 80px">Toplam Görev</th>
                <th colspan="${sortedAllTimeSlots.length}" class="date-header">Saat Bazlı Toplam</th>
                ${dates.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const timeSlotsForDate = dateTimeSlots.get(dateStr);
                    return `<th colspan="${timeSlotsForDate.length}" class="date-header date-time-cell">
                        ${date.toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'numeric'
                        })}
                    </th>`;
                }).join('')}
            </tr>
            <tr>
                ${sortedAllTimeSlots.map((time, index) => 
                    `<th class="date-time-cell" style="background-color: ${timeColors[index % timeColors.length]}">${time.substring(0, 5)}</th>`
                ).join('')}
                ${dates.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const timeSlotsForDate = dateTimeSlots.get(dateStr);
                    return timeSlotsForDate.map(time => 
                        `<th class="date-time-cell">${time.substring(0, 5)}</th>`
                    ).join('');
                }).join('')}
            </tr>
        `;
        
        thead.innerHTML = headerHtml;

        // Gözetmen verilerini tabloya ekle
        const tableBody = document.getElementById('analysisTableBody');
        
        gozetmenler.forEach(gozetmen => {
            const row = document.createElement('tr');
            
            // Temel bilgiler ve istatistikler
            const totalAssignments = gozetmen.assignments?.length || 0;
            
            const timeSlotStats = {};
            gozetmen.assignments?.forEach(assignment => {
                if (!timeSlotStats[assignment.examTime]) {
                    timeSlotStats[assignment.examTime] = 0;
                }
                timeSlotStats[assignment.examTime]++;
            });
            
            const timeSlotText = Object.entries(timeSlotStats)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([time, count]) => `${time}: ${count}`)
                .join(', ');

            // Temel bilgiler
            const deptColor = departmentColors[gozetmen.blm] || 'transparent';
            row.innerHTML = `
                <td style="background-color: ${deptColor}">${gozetmen.blm || ''}</td>
                <td style="background-color: ${deptColor}">${gozetmen.ad || ''}</td>
                <td style="background-color: ${deptColor}">${gozetmen.kisa || ''}</td>
                <td class="total-column">${totalAssignments}</td>
            `;

            // Her saat dilimi için toplam görev sayısı
            sortedAllTimeSlots.forEach((time, index) => {
                const totalForTime = gozetmen.assignments?.filter(assignment => 
                    assignment.examTime === time
                ).length || 0;
                
                const cell = document.createElement('td');
                cell.classList.add('date-time-cell');
                cell.style.backgroundColor = timeColors[index % timeColors.length];
                if (totalForTime > 0) {
                    cell.textContent = totalForTime;
                    cell.style.fontWeight = 'bold';
                }
                row.appendChild(cell);
            });

            // Her tarih için görev sayılarını hesapla
            dates.forEach(date => {
                const periodDate = date.toISOString().split('T')[0];
                
                // Bu tarih için tanımlı saat dilimleri
                const timeSlotsForDate = dateTimeSlots.get(periodDate);
                // Her saat dilimi için görev kontrolü
                timeSlotsForDate.forEach(time => {
                    const cell = document.createElement('td');
                    cell.classList.add('date-time-cell');
                    const assignmentsForTimeSlot = gozetmen.assignments?.filter(assignment => {
                        return assignment.examDate === periodDate && assignment.examTime === time;
                    }).length || 0;
                    
                    if (assignmentsForTimeSlot > 0) {
                        cell.textContent = assignmentsForTimeSlot;
                        cell.style.backgroundColor = '#e6ffe6'; // Hafif yeşil arka plan
                    }
                    row.appendChild(cell);
                });
            });

            tableBody.appendChild(row);
        });

        // Tüm saat ve tarih sütunlarının indekslerini hesapla
        const compactColumnIndexes = [];
        let currentIndex = 4;

        // Saat bazlı toplam sütunları
        for (let i = 0; i < sortedAllTimeSlots.length; i++) {
            compactColumnIndexes.push(currentIndex++);
        }

        // Her tarih için saat sütunları
        dates.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            const timeSlotsForDate = dateTimeSlots.get(dateStr);
            timeSlotsForDate.forEach(() => {
                compactColumnIndexes.push(currentIndex++);
            });
        });

        // Tablo hücre tıklama olayını ekle
        const table = document.getElementById('analysisTable');
        
        // Önceki vurgulamaları temizle
        function clearHighlights() {
            table.querySelectorAll('.highlight-row, .highlight-column, .highlight-cell').forEach(el => {
                el.classList.remove('highlight-row', 'highlight-column', 'highlight-cell');
            });
        }

        // Hücre tıklama olayı
        table.addEventListener('click', function(e) {
            const cell = e.target.closest('td');
            if (!cell) {
                clearHighlights();
                return;
            }

            e.stopPropagation(); // Tıklama olayının document'e ulaşmasını engelle
            clearHighlights();

            // Tıklanan hücrenin satırını vurgula
            const row = cell.parentElement;
            Array.from(row.cells).forEach(td => {
                td.classList.add('highlight-row');
            });

            // Tıklanan hücrenin sütununu vurgula
            const cellIndex = cell.cellIndex;
            Array.from(table.rows).forEach(tr => {
                if (tr.cells[cellIndex]) {
                    tr.cells[cellIndex].classList.add('highlight-column');
                }
            });

            // Tıklanan hücreyi daha belirgin yap
            cell.classList.add('highlight-cell');
        });

        // Tablo dışına tıklandığında vurgulamaları kaldır
        document.addEventListener('click', function() {
            clearHighlights();
        });

        // DataTable özelliklerini uygula
        const dataTable = $('#analysisTable').DataTable({
            stripeClasses: [], // Çizgili görünümü kaldır
            scrollX: true,
            pageLength: 50,
            order: [[0, 'asc'], [1, 'asc']], // Bölüm ve isme göre sırala
            language: {
                url: '//cdn.datatables.net/plug-ins/1.10.24/i18n/Turkish.json'
            },
            columnDefs: [
                {
                    targets: compactColumnIndexes,
                    orderable: false, // Sıralama devre dışı
                    className: 'date-time-cell noselect',
                    createdCell: function(td) {
                        $(td).css('font-size', '0.6rem');
                    }
                }
            ]
        });

    } catch (error) {
        console.error('Veri yükleme hatası:', error);
        alert('Veriler yüklenirken bir hata oluştu.');
    }
});
