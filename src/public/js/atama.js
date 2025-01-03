// Global variables
let selectedExam = null;
let selectedClassroom = null;
let selectedGozetmen = null;
let assignmentModal;
let supervisorModal;
let analysisModal;
let autoAssignProgressModal;

// Update progress message
function updateProgress(message) {
    const progressDiv = document.getElementById('autoAssignProgress');
    progressDiv.innerHTML = message;
}

// Automatic assignment function
async function autoAssignGozetmenler() {
    if (!confirm('Otomatik atama işlemini başlatmak istiyor musunuz?')) {
        return;
    }

    try {
        // Show progress modal
        autoAssignProgressModal.show();
        updateProgress('Sınavlar ve gözetmenler yükleniyor...');

        // Get all exams and gözetmenler
        const [examsResponse, gozetmenlerResponse] = await Promise.all([
            fetch('/api/atama/exams'),
            fetch('/api/atama/gozetmenler')
        ]);
        
        const exams = await examsResponse.json();
        const gozetmenler = await gozetmenlerResponse.json();

        updateProgress('Sınavlar öğrenci sayısına göre sıralanıyor...');
        // Sort exams by student count (descending)
        exams.sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));

        // Process each exam
        for (const [index, exam] of exams.entries()) {
            updateProgress(`
                <div class="mb-2">
                    <strong>${exam.dkodu}-${exam.sube}</strong> sınavı için atamalar yapılıyor... (${index + 1}/${exams.length})
                </div>
            `);

            // Get available gözetmenler for this exam's time slot
            const availableGozetmenler = gozetmenler.filter(g => 
                !g.assignments?.some(a => 
                    a.examDate === exam.examDate && 
                    a.examTime === exam.examTime
                )
            );
            updateProgress(`
                <div class="mb-2">
                    <strong>${exam.dkodu}-${exam.sube}</strong> sınavı için atamalar yapılıyor... (${index + 1}/${exams.length})
                </div>
                <div class="small text-muted">
                    • Müsait gözetmen sayısı: ${availableGozetmenler.length}
                </div>
            `);

            // Calculate total classrooms and coefficients
            const totalClassrooms = exams.reduce((total, e) => total + e.examSiniflar.length, 0);
            const totalCoefficients = gozetmenler.reduce((total, g) => total + (g.katsayi || 1), 0);

            // Get matching department gözetmenler and filter by assignment limits
            const matchingGozetmenler = availableGozetmenler.filter(g => {
                // Check department match
                if (g.blm !== exam.program) return false;

                // Calculate expected assignments (Y value)
                const expectedAssignments = Math.round((totalClassrooms / totalCoefficients) * (g.katsayi || 1));
                const currentAssignments = g.assignments?.length || 0;

                // Count assignments for this day
                const dailyAssignments = g.assignments?.filter(a => 
                    a.examDate === exam.examDate
                ).length || 0;

                // Check if gözetmen has reached their daily limit
                if (dailyAssignments >= 2) return false;

                // Allow assignment if below Y value or if no other gözetmenler are available
                const assignmentRatio = currentAssignments / expectedAssignments;
                if (assignmentRatio >= 1) {
                    // Only allow if no other gözetmenler are available with lower ratios
                    const otherAvailable = availableGozetmenler.some(other => 
                        other.blm === exam.program &&
                        other._id !== g._id &&
                        !other.assignments?.some(a => a.examDate === exam.examDate && a.examTime === exam.examTime) &&
                        ((other.assignments?.length || 0) / Math.round((totalClassrooms / totalCoefficients) * (other.katsayi || 1))) < 1
                    );
                    if (otherAvailable) return false;
                }

                return true;
            });
            updateProgress(`
                <div class="mb-2">
                    <strong>${exam.dkodu}-${exam.sube}</strong> sınavı için atamalar yapılıyor... (${index + 1}/${exams.length})
                </div>
                <div class="small text-muted">
                    • Müsait gözetmen sayısı: ${availableGozetmenler.length}<br>
                    • ${exam.program} bölümünden müsait gözetmen sayısı: ${matchingGozetmenler.length}
                </div>
            `);

            // Get odd-numbered classrooms (based on last character)
            const oddClassrooms = exam.examSiniflar.filter(sinif => {
                const lastChar = sinif.slice(-1);
                return !isNaN(lastChar) && parseInt(lastChar) % 2 === 1;
            });
            // Calculate stats for progress display
            const totalExpectedAssignments = matchingGozetmenler.map(g => {
                const expectedAssignments = Math.round((totalClassrooms / totalCoefficients) * (g.katsayi || 1));
                const currentAssignments = g.assignments?.length || 0;
                return expectedAssignments - currentAssignments;
            }).reduce((sum, remaining) => sum + remaining, 0);

            updateProgress(`
                <div class="mb-2">
                    <strong>${exam.dkodu}-${exam.sube}</strong> sınavı için atamalar yapılıyor... (${index + 1}/${exams.length})
                </div>
                <div class="small text-muted">
                    • Müsait gözetmen sayısı: ${availableGozetmenler.length}<br>
                    • ${exam.program} bölümünden uygun gözetmen sayısı: ${matchingGozetmenler.length}<br>
                    • Tek numaralı sınıf sayısı: ${oddClassrooms.length}<br>
                    • Atanabilecek toplam görev sayısı: ${totalExpectedAssignments}
                </div>
            `);

            // Sort matching gözetmenler by their assignment completion ratio
            const sortedGozetmenler = [...matchingGozetmenler].sort((a, b) => {
                const aExpected = Math.round((totalClassrooms / totalCoefficients) * (a.katsayi || 1));
                const bExpected = Math.round((totalClassrooms / totalCoefficients) * (b.katsayi || 1));
                const aRatio = (a.assignments?.length || 0) / aExpected;
                const bRatio = (b.assignments?.length || 0) / bExpected;
                return aRatio - bRatio; // Sort by lowest ratio first
            });

            // Assign matching gözetmenler to odd-numbered classrooms
            let assignmentCount = 0;
            for (const sinif of oddClassrooms) {
                // Find an available matching gözetmen with lowest assignment ratio
                const gozetmen = sortedGozetmenler.find(g => 
                    !g.assignments?.some(a => 
                        a.examDate === exam.examDate && 
                        a.examTime === exam.examTime
                    )
                );

                if (gozetmen) {
                    // Calculate expected assignments for this gözetmen
                    const expectedAssignments = Math.round((totalClassrooms / totalCoefficients) * (gozetmen.katsayi || 1));
                    const currentAssignments = gozetmen.assignments?.length || 0;

                    // Check if gözetmen has reached their assignment limit
                    if (currentAssignments >= expectedAssignments) continue;

                    // Count assignments for this day
                    const dailyAssignments = gozetmen.assignments?.filter(a => 
                        a.examDate === exam.examDate
                    ).length || 0;

                    // Check if gözetmen has reached their daily limit
                    if (dailyAssignments >= 2) continue;

                    assignmentCount++;
                    // Make the assignment
                    try {
                        await fetch('/api/atama/assign', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                gozetmenId: gozetmen._id,
                                exam: {
                                    dkodu: exam.dkodu,
                                    sube: exam.sube,
                                    dersadi: exam.dersadi,
                                    examDate: exam.examDate,
                                    examTime: exam.examTime,
                                    sinif: sinif,
                                    studentCount: exam.studentCount
                                }
                            })
                        });

                        // Update gözetmen's assignments locally
                        if (!gozetmen.assignments) gozetmen.assignments = [];
                        gozetmen.assignments.push({
                            dkodu: exam.dkodu,
                            sube: exam.sube,
                            examDate: exam.examDate,
                            examTime: exam.examTime,
                            sinif: sinif
                        });

                        updateProgress(`
                            <div class="mb-2">
                                <strong>${exam.dkodu}-${exam.sube}</strong> sınavı için atamalar yapılıyor... (${index + 1}/${exams.length})
                            </div>
                            <div class="small text-muted">
                                • Müsait gözetmen sayısı: ${availableGozetmenler.length}<br>
                                • ${exam.program} bölümünden müsait gözetmen sayısı: ${matchingGozetmenler.length}<br>
                                • Tek numaralı sınıf sayısı: ${oddClassrooms.length}<br>
                                • Yapılan atama sayısı: ${assignmentCount}/${oddClassrooms.length}
                            </div>
                        `);
                    } catch (error) {
                        console.error('Error assigning gözetmen:', error);
                        updateProgress(`
                            <div class="mb-2">
                                <strong>${exam.dkodu}-${exam.sube}</strong> sınavı için atamalar yapılıyor... (${index + 1}/${exams.length})
                            </div>
                            <div class="small text-muted">
                                • Müsait gözetmen sayısı: ${availableGozetmenler.length}<br>
                                • ${exam.program} bölümünden müsait gözetmen sayısı: ${matchingGozetmenler.length}<br>
                                • Tek numaralı sınıf sayısı: ${oddClassrooms.length}<br>
                                • Yapılan atama sayısı: ${assignmentCount}/${oddClassrooms.length}
                            </div>
                            <div class="text-danger small">
                                • Hata: ${error.message}
                            </div>
                        `);
                    }
                }
            }

            // Show final stats for this exam
            updateProgress(`
                <div class="mb-2">
                    <strong>${exam.dkodu}-${exam.sube}</strong> sınavı tamamlandı (${index + 1}/${exams.length})
                </div>
                <div class="small text-muted">
                    • Müsait gözetmen sayısı: ${availableGozetmenler.length}<br>
                    • ${exam.program} bölümünden müsait gözetmen sayısı: ${matchingGozetmenler.length}<br>
                    • Tek numaralı sınıf sayısı: ${oddClassrooms.length}<br>
                    • Yapılan atama sayısı: ${assignmentCount}/${oddClassrooms.length}
                </div>
            `);
        }

        // Refresh the view
        updateProgress('Görünüm yenileniyor...');
        await loadExams();
        
        // Hide progress modal and show success message
        autoAssignProgressModal.hide();
        alert('Otomatik atama tamamlandı');
    } catch (error) {
        console.error('Auto assignment error:', error);
        autoAssignProgressModal.hide();
        alert('Otomatik atama sırasında bir hata oluştu');
    }
}

// Analysis modal functions
async function openAnalysisModal() {
    try {
        const response = await fetch('/api/atama/gozetmenler');
        const gozetmenler = await response.json();

        const analysisGozetmenlerList = document.getElementById('analysisGozetmenlerList');
        analysisGozetmenlerList.innerHTML = '';

        // Group by department
        const gozetmenlerByDept = gozetmenler.reduce((acc, gozetmen) => {
            if (!acc[gozetmen.blm]) {
                acc[gozetmen.blm] = [];
            }
            acc[gozetmen.blm].push(gozetmen);
            return acc;
        }, {});

        // Calculate total classrooms and coefficients first
        let totalClassrooms = 0;
        let totalCoefficients = 0;
        gozetmenler.forEach(g => {
            totalCoefficients += g.katsayi || 1;
        });

        // Get total classrooms from all exams
        const response2 = await fetch('/api/atama/exams');
        const exams = await response2.json();
        
        // Count total classroom slots needed
        totalClassrooms = exams.reduce((total, exam) => {
            return total + exam.examSiniflar.length;
        }, 0);

        // Calculate total expected assignments
        let totalExpectedAssignments = 0;
        gozetmenler.forEach(gozetmen => {
            const expectedAssignments = Math.round((totalClassrooms / totalCoefficients) * (gozetmen.katsayi || 1));
            totalExpectedAssignments += expectedAssignments;
        });

        // Add total stats at the top
        const statsHeader = document.createElement('div');
        statsHeader.className = 'col-12 mb-3';
        statsHeader.innerHTML = `
            <div class="alert alert-info">
                <strong>Toplam Sınıf Sayısı:</strong> ${totalClassrooms}<br>
                <strong>Toplam Beklenen Atama Sayısı:</strong> ${totalExpectedAssignments}
            </div>
        `;
        analysisGozetmenlerList.appendChild(statsHeader);

        // Sort departments alphabetically
        Object.keys(gozetmenlerByDept).sort().forEach(dept => {
            // Add department header
            const deptHeader = document.createElement('div');
            deptHeader.className = 'col-12 mb-2';
            deptHeader.innerHTML = `<h6 class="border-bottom pb-2">${dept}</h6>`;
            analysisGozetmenlerList.appendChild(deptHeader);

            // Add department's supervisors
            gozetmenlerByDept[dept].forEach(gozetmen => {
                const gozetmenCol = document.createElement('div');
                gozetmenCol.className = 'col-md-3 mb-3';

                let assignmentsHtml = '';
                if (gozetmen.assignments?.length > 0) {
                    assignmentsHtml = gozetmen.assignments.map((a, index) => `
                        <div class="assignment-info mb-1">
                            <div class="d-flex align-items-center gap-2">
                                <div class="flex-shrink-0">
                                    <i class="text-danger bi bi-x-circle-fill" style="cursor: pointer; font-size: 0.875rem;" 
                                       onclick="removeAssignment('${gozetmen._id}', '${a.sinif}', event, {
                                           dkodu: '${a.dkodu}',
                                           sube: '${a.sube}',
                                           examDate: '${a.examDate}',
                                           examTime: '${a.examTime}'
                                       })"></i>
                                </div>
                                <div class="flex-grow-1" style="min-width: 0;">
                                    <small class="d-inline-block text-truncate" style="max-width: 100%">
                                        ${index + 1}. ${a.dkodu}-${a.sube} (<strong>${a.sinif}</strong>) | ${a.examDate} <strong>${a.examTime}</strong>
                                    </small>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }

                // Calculate expected assignments for this gözetmen
                const expectedAssignments = Math.round((totalClassrooms / totalCoefficients) * (gozetmen.katsayi || 1));
                const currentAssignments = gozetmen.assignments?.length || 0;
                const ratio = currentAssignments / expectedAssignments;
                let badgeClass = 'bg-success';
                if (ratio > 1.1) badgeClass = 'bg-danger';
                else if (ratio > 1) badgeClass = 'bg-warning';
                else if (ratio < 0.9) badgeClass = 'bg-warning';

                gozetmenCol.innerHTML = `
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="text-center mb-3">
                                <img src="${gozetmen.photo || '#'}" alt="${gozetmen.ad}" class="profile-image">
                                <h6 class="card-title">${gozetmen.ad}</h6>
                                <small class="text-muted d-block mb-2">${gozetmen.blm}</small>
                                <div class="mb-2">
                                    <span class="badge ${currentAssignments === 0 ? 'bg-secondary' : badgeClass}" 
                                          title="Mevcut atama sayısı / Beklenen atama sayısı (Katsayı: ${gozetmen.katsayi || 1})">
                                        ${currentAssignments}/${expectedAssignments}
                                    </span>
                                </div>
                                <button class="btn btn-danger btn-sm ${!gozetmen.assignments?.length ? 'disabled' : ''}" 
                                        onclick="removeAllAssignments('${gozetmen._id}')"
                                        ${!gozetmen.assignments?.length ? 'disabled' : ''}>
                                    <i class="bi bi-trash"></i> Tüm Atamaları Sil
                                </button>
                            </div>
                            <div class="assignments-container">
                                ${assignmentsHtml || '<small class="text-muted">Atama yok</small>'}
                            </div>
                        </div>
                    </div>
                `;

                analysisGozetmenlerList.appendChild(gozetmenCol);
            });
        });

        // Show the modal
        analysisModal.show();
    } catch (error) {
        console.error('Error loading gözetmen analysis:', error);
        alert('Gözetmen analizi yüklenirken bir hata oluştu');
    }
}

// Remove all assignments for all gözetmenler
async function removeAllAssignmentsForAll() {
    if (!confirm('TÜM GÖZETMENLERİN ATAMALARINI SİLMEK İSTEDİĞİNİZE EMİN MİSİNİZ? Bu işlem geri alınamaz!')) {
        return;
    }

    try {
        const response = await fetch('/api/atama/removeAllAssignments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        // Refresh both the analysis modal and main exam list
        await loadExams();
        await openAnalysisModal();
    } catch (error) {
        console.error('Remove all assignments error:', error);
        alert(error.message || 'Atama silme işlemi sırasında bir hata oluştu');
    }
}

// Remove all assignments for a gözetmen
async function removeAllAssignments(gozetmenId) {
    if (!confirm('Bu gözetmenin TÜM atamalarını silmek istediğinize emin misiniz?')) {
        return;
    }

    try {
        const response = await fetch('/api/atama/removeAll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ gozetmenId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        // Refresh both the analysis modal and main exam list
        await loadExams();
        await openAnalysisModal();
    } catch (error) {
        console.error('Remove all assignments error:', error);
        alert(error.message || 'Atama silme işlemi sırasında bir hata oluştu');
    }
}

// Load and display exams
async function loadExams() {
    try {
        const url = '/api/atama/exams';
        const response = await fetch(url);
        const exams = await response.json();

        const examsList = document.getElementById('examsList');
        const noExamsMessage = document.getElementById('noExamsMessage');
        const assignmentStats = document.getElementById('assignmentStats');
        examsList.innerHTML = '';

        if (exams.length === 0) {
            noExamsMessage.style.display = 'block';
            assignmentStats.textContent = '';
            return;
        }

        noExamsMessage.style.display = 'none';

        // Calculate assigned/total classroom ratio
        let totalClassrooms = 0;
        let assignedClassrooms = 0;

        exams.forEach(exam => {
            const examCol = document.createElement('div');
            examCol.className = 'col';
            const examCard = document.createElement('div');
            examCard.className = 'card h-100 exam-card';
            // Handle click event
            examCard.onclick = (event) => {
                const target = event.target;
                const isRemoveIcon = target.classList.contains('bi-x-circle-fill') || 
                                   target.closest('.bi-x-circle-fill');
                
                if (!isRemoveIcon) {
                    // Update selectedExam and display classrooms
                    selectedExam = exam;
                    
                    // Remove selection from other cards
                    document.querySelectorAll('.exam-card').forEach(c => 
                        c.classList.remove('selected-exam'));
                    
                    // Add selection to clicked card
                    examCard.classList.add('selected-exam');
                    
                    // Display classrooms for this exam
                    displayClassrooms(exam);
                }
            };

            // Handle hover effects
            examCard.onmouseover = () => {
                if (!examCard.classList.contains('selected-exam')) {
                    examCard.classList.add('hover-exam');
                }
            };
            examCard.onmouseout = () => {
                examCard.classList.remove('hover-exam');
            };

            // Group assignments by classroom and count assignments
            const assignmentsByClassroom = {};
            exam.examSiniflar.forEach(sinif => {
                totalClassrooms++;
                const assignedGozetmenler = exam.assignedGozetmenler.filter(g => 
                    g.assignments?.some(a => 
                        a.dkodu === exam.dkodu &&
                        a.sube === exam.sube &&
                        a.examDate === exam.examDate &&
                        a.examTime === exam.examTime &&
                        a.sinif === sinif
                    )
                );
                assignmentsByClassroom[sinif] = assignedGozetmenler;
                if (assignedGozetmenler.length > 0) {
                    assignedClassrooms++;
                }
            });

            // Create classroom assignment info HTML
            const classroomAssignmentsHtml = Object.entries(assignmentsByClassroom)
                .map(([sinif, gozetmenler]) => {
                    const status = gozetmenler.length === 0 ? 'text-danger' : 'text-success';
                    const gozetmenNames = gozetmenler.length > 0 
                        ? gozetmenler.map(g => `
                            <div class="d-flex align-items-center justify-content-between">
                                <span>${g.ad}</span>
                                <button type="button" class="btn btn-link p-0 border-0" 
                                        onclick="event.stopPropagation(); event.preventDefault(); removeAssignment('${g._id}', '${sinif}', event)">
                                    <i class="text-danger bi bi-x-circle-fill"></i>
                                </button>
                            </div>`).join('')
                        : 'Gözetmen atanmamış';
                    return `
                        <div class="assignment-info ${status}">
                            <div>
                                <small>🏛️ ${sinif}</small>
                            </div>
                            <small class="d-block text-truncate">${gozetmenNames}</small>
                        </div>
                    `;
                }).join('');

            // Check if all classrooms have at least one gözetmen
            const allClassroomsAssigned = Object.values(assignmentsByClassroom)
                .every(gozetmenler => gozetmenler.length > 0);

            examCard.innerHTML = `
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <h6 class="card-title mb-0 ${allClassroomsAssigned ? 'text-success' : 'text-danger'}">${exam.dkodu} - ${exam.sube}</h6>
                        <small class="text-muted">👥 ${exam.studentCount}</small>
                    </div>
                    <p class="card-text small mb-1 ${allClassroomsAssigned ? 'text-success' : 'text-danger'}">${exam.program || exam.dersadi}</p>
                    <p class="card-text mb-2">
                        <small class="text-muted">
                            📅 ${exam.examDate} ${exam.examTime}
                        </small>
                    </p>
                    <div class="border-top pt-1">
                        ${classroomAssignmentsHtml}
                    </div>
                </div>
            `;

            examCol.appendChild(examCard);
            examsList.appendChild(examCol);
        });

        // Update assignment stats
        const unassignedClassrooms = totalClassrooms - assignedClassrooms;
        assignmentStats.textContent = unassignedClassrooms > 0 
            ? `(${unassignedClassrooms} sınıf atama bekliyor)` 
            : '(Tüm atamalar tamamlandı)';
    } catch (error) {
        console.error('Error loading exams:', error);
        alert('Sınavlar yüklenirken bir hata oluştu');
    }
}

// Display classrooms for selected exam
function displayClassrooms(exam) {
    const classroomsList = document.getElementById('classroomsList');
    const noClassroomsMessage = document.getElementById('noClassroomsMessage');
    classroomsList.innerHTML = '';

    if (!exam || !exam.examSiniflar || exam.examSiniflar.length === 0) {
        noClassroomsMessage.style.display = 'block';
        return;
    }

    noClassroomsMessage.style.display = 'none';
    exam.examSiniflar.forEach(sinif => {
        const assignedGozetmenler = exam.assignedGozetmenler.filter(g => 
            g.assignments?.some(a => 
                a.dkodu === exam.dkodu &&
                a.sube === exam.sube &&
                a.examDate === exam.examDate &&
                a.examTime === exam.examTime &&
                a.sinif === sinif
            )
        );

        const classroomCol = document.createElement('div');
        classroomCol.className = 'col';
        const classroomCard = document.createElement('div');
        classroomCard.className = 'card h-100 classroom-card';
        classroomCard.onclick = () => {
            // Remove selection from other cards
            document.querySelectorAll('.classroom-card').forEach(c => 
                c.classList.remove('selected-classroom'));
            
            // Add selection to clicked card
            classroomCard.classList.add('selected-classroom');
            selectedClassroom = sinif;

            // Show supervisor selection modal
            showSupervisorModal(sinif, assignedGozetmenler);
        };

        const status = assignedGozetmenler.length === 0 ? 'text-danger' : 'text-success';

        const gozetmenList = assignedGozetmenler.map(g => `
            <div class="d-flex align-items-center justify-content-between mb-1">
                <small class="text-truncate">${g.ad}</small>
                <button type="button" class="btn btn-link p-0 border-0" 
                        onclick="event.stopPropagation(); removeAssignment('${g._id}', '${sinif}', event)">
                    <i class="text-danger bi bi-x-circle-fill"></i>
                </button>
            </div>
        `).join('');

        classroomCard.innerHTML = `
            <div class="card-body p-2">
                <div class="mb-2">
                    <h6 class="card-title mb-0">🏛️ ${sinif}</h6>
                </div>
                <div class="gozetmen-list ${status}">
                    ${gozetmenList || '<small class="text-muted">Gözetmen atanmamış</small>'}
                </div>
            </div>
        `;

        classroomCol.appendChild(classroomCard);
        classroomsList.appendChild(classroomCol);
    });
}

// Load and display gözetmenler
async function loadGozetmenler(searchTerm = '') {
    try {
        const response = await fetch('/api/atama/gozetmenler');
        const gozetmenler = await response.json();

        // Filter and sort by department
        const filteredGozetmenler = searchTerm
            ? gozetmenler.filter(g => 
                g.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                g.blm.toLowerCase().includes(searchTerm.toLowerCase()))
            : gozetmenler;

        // Group by department
        const gozetmenlerByDept = filteredGozetmenler.reduce((acc, gozetmen) => {
            if (!acc[gozetmen.blm]) {
                acc[gozetmen.blm] = [];
            }
            acc[gozetmen.blm].push(gozetmen);
            return acc;
        }, {});

        const gozetmenlerList = document.getElementById('gozetmenlerList');
        gozetmenlerList.innerHTML = '';

        // Sort departments alphabetically
        Object.keys(gozetmenlerByDept).sort().forEach(dept => {
            // Add department header
            const deptHeader = document.createElement('div');
            deptHeader.className = 'col-12 mb-2';
            deptHeader.innerHTML = `<h6 class="border-bottom pb-2">${dept}</h6>`;
            gozetmenlerList.appendChild(deptHeader);

            // Add department's supervisors
            gozetmenlerByDept[dept].forEach(gozetmen => {
                const gozetmenCard = document.createElement('div');
                gozetmenCard.className = 'col-md-3 col-lg-2 mb-3';
                // Check if gözetmen is available at this time
                const isAvailable = !selectedExam || !gozetmen.assignments?.some(a => 
                    a.examDate === selectedExam.examDate && 
                    a.examTime === selectedExam.examTime
                );

                const cardContent = document.createElement('div');
                cardContent.className = `card gozetmen-card h-100 ${!isAvailable ? 'opacity-50' : ''}`;
                
                if (isAvailable) {
                    cardContent.onclick = () => selectGozetmen(gozetmen, cardContent);
                    cardContent.style.cursor = 'pointer';
                } else {
                    cardContent.style.cursor = 'not-allowed';
                }

                // Check if department matches exam program
                const isMatchingDept = selectedExam && gozetmen.blm === selectedExam.program;
                cardContent.className = `card gozetmen-card h-100 ${!isAvailable ? 'opacity-50' : ''} ${isMatchingDept ? 'border-primary' : ''}`;

                // Prepare assignment info
                let assignmentInfo = '';
                if (!isAvailable) {
                    const assignmentAtTime = gozetmen.assignments.find(a => 
                        a.examDate === selectedExam.examDate && 
                        a.examTime === selectedExam.examTime
                    );
                    assignmentInfo = `
                        <div class="assignment-info text-danger">
                            <small>Bu saatte başka sınavda görevli: ${assignmentAtTime.dkodu}-${assignmentAtTime.sube} (<strong>${assignmentAtTime.sinif}</strong>)</small>
                        </div>
                    `;
                } else if (gozetmen.assignments?.length > 0) {
                    assignmentInfo = gozetmen.assignments.map((a, index) => 
                        `<div class="assignment-info mb-1">
                            <small>
                                ${index + 1}. ${a.dkodu}-${a.sube} (<strong>${a.sinif}</strong>) | ${a.examDate} <strong>${a.examTime}</strong>
                            </small>
                        </div>`
                    ).join('');
                }

                cardContent.innerHTML = `
                    <div class="card-body text-center p-2 d-flex flex-column">
                        <img src="${gozetmen.photo || '#'}" alt="${gozetmen.ad}" class="profile-image">
                        <h6 class="card-title mb-1">${gozetmen.ad}</h6>
                        <div class="assignments-container mt-auto">
                            ${assignmentInfo}
                        </div>
                    </div>
                `;
                gozetmenCard.appendChild(cardContent);
                gozetmenlerList.appendChild(gozetmenCard);
            });
        });
    } catch (error) {
        console.error('Error loading gözetmenler:', error);
        alert('Gözetmenler yüklenirken bir hata oluştu');
    }
}

// Select a gözetmen
function selectGozetmen(gozetmen, card) {
    selectedGozetmen = gozetmen;
    supervisorModal.hide();
    showAssignmentModal();
}

// Show assignment confirmation modal
function showAssignmentModal() {
    if (!selectedExam || !selectedClassroom || !selectedGozetmen) return;

    const details = document.getElementById('assignmentDetails');
    details.innerHTML = `
        <div class="mb-3">
            <strong>Sınav:</strong><br>
            ${selectedExam.dkodu}-${selectedExam.sube} ${selectedExam.dersadi}<br>
            <small>
                📅 ${selectedExam.examDate} ${selectedExam.examTime}<br>
                🏛️ ${selectedClassroom}
            </small>
        </div>
        <div class="text-center mb-3">
            <img src="${selectedGozetmen.photo || '#'}" alt="${selectedGozetmen.ad}" class="profile-image">
        </div>
        <div class="text-center">
            <strong>Gözetmen:</strong><br>
            ${selectedGozetmen.ad} (${selectedGozetmen.blm})
        </div>
    `;

    assignmentModal.show();
}

// Show supervisor selection modal
function showSupervisorModal(sinif, assignedGozetmenler) {
    const selectedClassInfo = document.getElementById('selectedClassInfo');
    selectedClassInfo.innerHTML = `
        <strong>Seçilen Sınıf:</strong> ${sinif}<br>
        <strong>Mevcut Gözetmenler:</strong> ${assignedGozetmenler.map(g => g.ad).join(', ') || 'Atanmamış'}<br>
        <strong>Durum:</strong> ${assignedGozetmenler.length > 0 ? 'Gözetmen atanmış' : 'Gözetmen atanmamış'}
    `;

    loadGozetmenler();
    supervisorModal.show();
}

// Assign gözetmen to exam
async function assignGozetmen(event) {
    event.preventDefault();
    if (!selectedExam || !selectedClassroom || !selectedGozetmen) return;

    try {
        // Calculate total classrooms and coefficients
        const examsResponse = await fetch('/api/atama/exams');
        const exams = await examsResponse.json();
        const totalClassrooms = exams.reduce((total, exam) => total + exam.examSiniflar.length, 0);

        const gozetmenlerResponse = await fetch('/api/atama/gozetmenler');
        const gozetmenler = await gozetmenlerResponse.json();
        const totalCoefficients = gozetmenler.reduce((total, g) => total + (g.katsayi || 1), 0);

        // Calculate expected assignments for this gözetmen
        const expectedAssignments = Math.round((totalClassrooms / totalCoefficients) * (selectedGozetmen.katsayi || 1));
        const currentAssignments = selectedGozetmen.assignments?.length || 0;

        // Show warning if gözetmen has reached their total assignment limit
        if (currentAssignments >= expectedAssignments) {
            alert(`Uyarı: Bu gözetmen için maksimum atama sayısına (${expectedAssignments}) ulaşıldı`);
        }

        // Count assignments for this day
        const dailyAssignments = selectedGozetmen.assignments?.filter(a => 
            a.examDate === selectedExam.examDate
        ).length || 0;

        // Check if gözetmen has reached their daily limit
        if (dailyAssignments >= 2) {
            throw new Error('Bir gözetmen bir günde en fazla 2 görev alabilir');
        }

        const response = await fetch('/api/atama/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gozetmenId: selectedGozetmen._id,
                exam: {
                    dkodu: selectedExam.dkodu,
                    sube: selectedExam.sube,
                    dersadi: selectedExam.dersadi,
                    examDate: selectedExam.examDate,
                    examTime: selectedExam.examTime,
                    sinif: selectedClassroom,
                    studentCount: selectedExam.studentCount
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        assignmentModal.hide();
        supervisorModal.hide();
        
        // Store current exam info
        const currentExam = {
            dkodu: selectedExam.dkodu,
            sube: selectedExam.sube,
            examDate: selectedExam.examDate,
            examTime: selectedExam.examTime
        };

        // Refresh the exam list
        await loadExams();
        
        // Find and re-select the exam
        const examCards = document.querySelectorAll('.exam-card');
        const examCard = Array.from(examCards).find(card => {
            const titleText = card.querySelector('.card-title').textContent;
            return titleText.includes(currentExam.dkodu) && 
                   titleText.includes(currentExam.sube) &&
                   card.textContent.includes(currentExam.examDate) &&
                   card.textContent.includes(currentExam.examTime);
        });
        
        if (examCard) {
            examCard.click();
        }
        
        selectedClassroom = null;
        selectedGozetmen = null;
    } catch (error) {
        console.error('Assignment error:', error);
        alert(error.message || 'Atama işlemi sırasında bir hata oluştu');
    }
}

// Remove gözetmen assignment
async function removeAssignment(gozetmenId, sinif, event, examData = null) {
    event.stopPropagation(); // Prevent card click event

    // Use provided exam data or selectedExam
    const exam = examData || selectedExam;
    if (!exam) return;

    try {
        const response = await fetch('/api/atama/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gozetmenId,
                exam: {
                    dkodu: exam.dkodu,
                    sube: exam.sube,
                    examDate: exam.examDate,
                    examTime: exam.examTime,
                    sinif
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        // Refresh both views
        await loadExams();
        if (analysisModal._isShown) {
            await openAnalysisModal();
        } else if (selectedExam) {
            // Find and re-select the exam in main view
            const examCards = document.querySelectorAll('.exam-card');
            const examCard = Array.from(examCards).find(card => {
                const titleText = card.querySelector('.card-title').textContent;
                return titleText.includes(selectedExam.dkodu) && 
                       titleText.includes(selectedExam.sube) &&
                       card.textContent.includes(selectedExam.examDate) &&
                       card.textContent.includes(selectedExam.examTime);
            });
            
            if (examCard) {
                examCard.click();
            }
        }
    } catch (error) {
        console.error('Remove assignment error:', error);
        alert(error.message || 'Gözetmen çıkarma işlemi sırasında bir hata oluştu');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize modals
    assignmentModal = new bootstrap.Modal(document.getElementById('assignmentModal'));
    supervisorModal = new bootstrap.Modal(document.getElementById('supervisorModal'));
    analysisModal = new bootstrap.Modal(document.getElementById('analysisModal'));
    autoAssignProgressModal = new bootstrap.Modal(document.getElementById('autoAssignProgressModal'));
    
    // Initial load
    loadExams();

    // Gözetmen search
    document.getElementById('gozetmenSearch').addEventListener('input', (e) => {
        loadGozetmenler(e.target.value);
    });

    // Analysis gözetmen search
    document.getElementById('analysisGozetmenSearch').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('#analysisGozetmenlerList .card');
        cards.forEach(card => {
            const gozetmenName = card.querySelector('.card-title').textContent.toLowerCase();
            const gozetmenDept = card.querySelector('.text-muted').textContent.toLowerCase();
            if (gozetmenName.includes(searchTerm) || gozetmenDept.includes(searchTerm)) {
                card.closest('.col-md-3').style.display = '';
            } else {
                card.closest('.col-md-3').style.display = 'none';
            }
        });
    });

    // Assignment confirmation
    document.getElementById('confirmAssignment').addEventListener('click', (e) => assignGozetmen(e));

    console.log('ATAMA page initialized');
});
