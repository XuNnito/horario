function printSchedule() {
        document.getElementById('printMessage').style.display = 'block';
    }

    function closeMessageAndPrint() {
        document.getElementById('printMessage').style.display = 'none';

        const style = document.createElement('style');
        style.type = 'text/css';
        style.media = 'print';
        style.innerHTML = `
            @page {
                size: A4;
                margin: 10mm;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            body {
                overflow: hidden;
            }
            .schedule-container {
                max-height: 100%;
                overflow: hidden;
            }
            .schedule-table {
                page-break-inside: avoid;
            }
        `;
        document.head.appendChild(style);

        window.print();
    }
 
      
        // Arrays para almacenar materias
        let catalogSubjects = []; // Catálogo de materias disponibles
        let selectedSubjects = []; // Materias seleccionadas para el horario
        
        // Días y horas para el horario
        const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
        const hours = [];
        
        // Generar slots de 45 minutos: 08:00-08:45, 09:00-09:45, ... hasta 21:00-21:45
        for (let i = 8; i < 22; i++) {
            const startHour = i.toString().padStart(2, '0') + ':00';
            const endMinute = i.toString().padStart(2, '0') + ':45';
            hours.push(`${startHour}-${endMinute}`);
        }
        
        // Inicializar la aplicación cuando el DOM esté cargado
        document.addEventListener('DOMContentLoaded', function() {
            // Cargar materias predefinidas
            loadPredefinedSubjects();
            
            // Cargar selecciones guardadas en localStorage si existen
            loadSelectedSubjects();
            
            // Generar tabla de horarios
            generateScheduleTable();
            
            // Actualizar vistas
            updateCatalogSubjects();
            updateScheduleView();
            updateSelectedSubjectsList();
            
            // Configurar previsualización flotante
            setupFloatingPreview();
        });



        document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const suggestions = document.getElementById('suggestions');

    // Evento para buscar mientras se escribe
    searchInput.addEventListener('input', function () {
        const query = searchInput.value.toLowerCase().trim();
        if (query === '') {
            suggestions.classList.add('hidden');
            suggestions.innerHTML = '';
            return;
        }

        // Filtrar materias, grupos o profesores
        const results = catalogSubjects.filter(subject =>
            subject.name.toLowerCase().includes(query) ||
            subject.group.toLowerCase().includes(query) ||
            subject.professor.toLowerCase().includes(query)
        );

        // Mostrar sugerencias
        suggestions.innerHTML = '';
        if (results.length > 0) {
            results.forEach(subject => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = `${subject.name} (Grupo ${subject.group}) - ${subject.professor}`;
                item.addEventListener('click', function () {
                    // Acción al hacer clic en una sugerencia
                    addSubjectToSchedule(subject.id);
                    searchInput.value = '';
                    suggestions.classList.add('hidden');
                });
                suggestions.appendChild(item);
            });
            suggestions.classList.remove('hidden');
        } else {
            suggestions.innerHTML = '<div class="suggestion-item">No se encontraron resultados</div>';
            suggestions.classList.remove('hidden');
        }
    });

    // Ocultar sugerencias al hacer clic fuera
    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.classList.add('hidden');
        }
    });
});
        
        // Cargar materias predefinidas en el catálogo
        function loadPredefinedSubjects() {
            catalogSubjects = [
            // Datos completos de los horarios extraídos del PDF
//4d
  {
    id: 1,
    name: "Electronica analogica",
    professor: "Ibáñez Nangüelú Christian Roberto",
    group: "4A",
    sessions: [
      { day: "lunes", startTime: "13:00", endTime: "13:45" },
      { day: "jueves", startTime: "10:00", endTime: "11:45" },
      { day: "viernes", startTime: "11:00", endTime: "12:45" }
    ]
  },
  {
    id: 2,
    name: "Electronica digital",
    professor: "pinto",
    group: "4D",
    sessions: [
      { day: "lunes", startTime: "13:00", endTime: "13:45" },
      { day: "martes", startTime: "10:00", endTime: "11:45" },
      { day: "viernes", startTime: "11:00", endTime: "11:45" }
    ]
  },
  

  // =========== GRUPO 6A ===========
  { 
    id: 57, 
    name: "Liderazgo de Equipos de Alto Desempeño", 
    professor: "Anza Gonzalez Jorge", 
    group: "6A", 
    sessions: [
      { day: "lunes", startTime: "12:00", endTime: "12:45" },
      { day: "martes", startTime: "8:00", endTime: "8:45" },
      { day: "miercoles", startTime: "8:00", endTime: "8:45" }
    ]
  },
  { 
    id: 58, 
    name: "Electrónica de Potencia", 
    professor: " Rodriguez Ramirez Jorge Alberto", 
    group: "6A", 
    sessions: [
      { day: "martes", startTime: "142:00", endTime: "15:45" },
      { day: "miercoles", startTime: "14:00", endTime: "15:45" },
      { day: "jueves", startTime: "9:00", endTime: "9:45" }
    ]
  },
  { 
    id: 59, 
    name: "Matemáticas para Ingeniería II", 
    professor: "Cabrera Madrid Jorge Alberto", 
    group: "6A", 
    sessions: [
      { day: "lunes", startTime: "13:00", endTime: "15:45" },
      { day: "miercoles", startTime: "13:00", endTime: "13:45" },
      { day: "jueves", startTime: "13:00", endTime: "15:45" },
    ]
  },
  { 
    id: 60, 
    name: "Inglés VI", 
    professor: "Matus Arrambide Arandza", 
    group: "6A", 
    sessions: [
      { day: "lunes", startTime: "8:00", endTime: "9:45" },
      { day: "jueves", startTime: "10:00", endTime: "10:45" },
      { day: "viernes", startTime: "9:00", endTime: "10:45" }
    ]
  },
  { 
    id: 61, 
    name: "Suministro de Energía Eléctrica", 
    professor: "Martínez Cancino Diana Paulina", 
    group: "6A", 
    sessions: [
      { day: "martes", startTime: "13:00", endTime: "13:45" },
      { day: "miercoles", startTime: "12:00", endTime: "12:45" },
      { day: "viernes", startTime: "11:00", endTime: "11:45" }
    ]
  },
  
  { 
    id: 67, 
    name: "Mantenimiento de Equipos Médicos", 
    professor: "Pérez Toala Luis Agustín", 
    group: "6A", 
    sessions: [
      { day: "martes", startTime: "10:00", endTime: "11:45"},
      { day: "miercoles", startTime: "10:00", endTime: "11:45" },
      { day: "jueves", startTime: "11:00", endTime: "12:45" }
    ]
  },
  { 
    id: 68, 
    name: "Base de Datos", 
    professor: "Ibáñez Nangüelú Christian Roberto",
    group: "6A", 
    sessions: [
      { day: "lunes", startTime: "10:00", endTime: "11:45" },
      { day: "martes", startTime: "12:00", endTime: "12:45" },
      { day: "miercoles", startTime: "9:00", endTime: "9:45" },
      { day: "jueves", startTime: "8:00", endTime: "8:45" },
      { day: "viernes", startTime: "13:00", endTime: "13:45" },
    ]
  },
  { 
    id: 69, 
    name: "Tutorías", 
    professor: "jose octavio", 
    group: "6A", 
    sessions: [
      { day: "viernes", startTime: "8:00", endTime: "8:45" }
    ]
  },
  
 
            ];


            // Modificar las sesiones para ajustar las horas que terminan en ":45"
catalogSubjects.forEach(subject => {
    subject.sessions.forEach(session => {
        // Verificar si la hora de finalización termina en ":45"
        if (session.endTime.endsWith(":45")) {
            // Convertir la hora a formato de 24 horas y sumar 15 minutos
            const [hours, minutes] = session.endTime.split(":").map(Number);
            const newEndTime = `${(hours + (minutes + 15) / 60).toString().padStart(2, '0')}:00`;
            session.endTime = newEndTime;
        }
    });
});

// Verificar los cambios
console.log(catalogSubjects);
        }
        
        // Función para cargar materias seleccionadas desde localStorage
        function loadSelectedSubjects() {
            const savedSubjects = localStorage.getItem('selectedSubjects');
            if (savedSubjects) {
                selectedSubjects = JSON.parse(savedSubjects);
            }
        }
        
        // Función para guardar materias seleccionadas en localStorage
        function saveSelectedSubjects() {
            localStorage.setItem('selectedSubjects', JSON.stringify(selectedSubjects));
        }
        
        // Función para generar la estructura de la tabla de horarios
        function generateScheduleTable() {
            const scheduleBody = document.getElementById('scheduleBody');
            scheduleBody.innerHTML = '';
            
            hours.forEach(hour => {
                const row = document.createElement('tr');
                
                // Celda de hora
                const timeCell = document.createElement('td');
                timeCell.textContent = hour;
                timeCell.className = 'time-slot';
                row.appendChild(timeCell);
                
                // Celdas para cada día
                days.forEach(day => {
                    const dayCell = document.createElement('td');
                    // Modificado para trabajar con el nuevo formato de hora
                    const hourKey = hour.split('-')[0]; // Obtener solo la hora de inicio
                    dayCell.id = `${day}-${hourKey.replace(':', '')}`;
                    row.appendChild(dayCell);
                });
                
                scheduleBody.appendChild(row);
            });
               }
        
        // Actualizar la vista del catálogo de materias
        function updateCatalogSubjects() {
            const catalogDiv = document.getElementById('catalogSubjects');
            catalogDiv.innerHTML = '';

        // obtener ids de custom guardadas para mostrar el botón eliminar sólo en esas
        const customs = loadCustomSubjects();
        const customIds = new Set(customs.map(c => c.id));

        catalogSubjects.forEach(subject => {
            const subjectItem = document.createElement('div');
            subjectItem.className = 'subject-item';
            subjectItem.setAttribute('data-subject-id', subject.id);

            const name = document.createElement('h3');
            name.textContent = `${subject.name} (Grupo ${subject.group})`;

            const professor = document.createElement('p');
            professor.textContent = `Profesor: ${subject.professor}`;

            const sessionsDiv = document.createElement('div');
            sessionsDiv.className = 'multiday';
            sessionsDiv.textContent = 'Horarios: ';

            subject.sessions.forEach((session, index) => {
                const sessionBadge = document.createElement('span');
                sessionBadge.className = 'subject-badge';
                sessionBadge.textContent = `${capitalizeFirstLetter(session.day)} ${session.startTime}-${session.endTime}`;
                sessionsDiv.appendChild(sessionBadge);

                if (index < subject.sessions.length - 1) {
                    sessionsDiv.appendChild(document.createTextNode(' '));
                }
            });

            subjectItem.appendChild(name);
            subjectItem.appendChild(professor);
            subjectItem.appendChild(sessionsDiv);

            // click para añadir al horario
            subjectItem.addEventListener('click', function () {
                addSubjectToSchedule(subject.id);
            });

            // si la materia está en customIds mostramos botón X para eliminarla del catálogo
            if (customIds.has(subject.id)) {
                const delBtn = document.createElement('button');
                delBtn.className = 'catalog-delete';
                delBtn.title = 'Eliminar materia del catálogo';
                delBtn.textContent = '×';
                // evitar que el click en la X dispare el click del item
                delBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (!confirm(`¿Eliminar la materia "${subject.name}" del catálogo? Esta acción quitará la materia creada.`)) return;

                    // quitar de catalogSubjects en memoria
                    catalogSubjects = catalogSubjects.filter(s => s.id !== subject.id);

                    // quitar de custom storage
                    const newCustoms = customs.filter(c => c.id !== subject.id);
                    saveCustomSubjects(newCustoms);

                    // si estaba en el horario seleccionado, quitarla también
                    if (selectedSubjects.some(s => s.id === subject.id)) {
                        removeFromSchedule(subject.id);
                    }

                    // refrescar vista del catálogo
                    updateCatalogSubjects();
                    showMessage(`Materia "${subject.name}" eliminada del catálogo.`, 'success');
                });
                subjectItem.appendChild(delBtn);
            }

            catalogDiv.appendChild(subjectItem);
        });
        }
        
        // Función para agregar previsualización flotante al pasar el mouse
        function setupFloatingPreview() {
            const preview = document.getElementById('floatingPreview');
            
            document.addEventListener('mousemove', function(e) {
                // Mover la previsualización con el cursor
                if (!preview.classList.contains('hidden')) {
                    preview.style.left = `${e.pageX + 15}px`;
                    preview.style.top = `${e.pageY + 15}px`;
                }
            });
            
            // Configurar eventos de hover en los elementos del catálogo
            const catalogs = document.querySelectorAll('.subject-item');
            catalogs.forEach(item => {
                item.addEventListener('mouseenter', function() {
                    const subjectId = parseInt(this.getAttribute('data-subject-id'));
                    const subject = catalogSubjects.find(s => s.id === subjectId);
                    
                    if (subject) {
                        // Mostrar información en la previsualización
                        preview.innerHTML = `
                            <strong>${subject.name}</strong><br>
                            Prof: ${subject.professor}<br>
                            <div style="margin-top: 5px;">
                                ${subject.sessions.map(session => 
                                    `${capitalizeFirstLetter(session.day)} ${session.startTime}-${session.endTime}`
                                ).join('<br>')}
                            </div>
                        `;
                        preview.classList.remove('hidden');
                    }
                });
                
                item.addEventListener('mouseleave', function() {
                    preview.classList.add('hidden');
                });
            });
        }
        
        // Función para añadir una materia del catálogo al horario
        function addSubjectToSchedule(id) {
            // Buscar la materia en el catálogo
            const subject = catalogSubjects.find(s => s.id === id);
            
            if (!subject) return;
            
            // Verificar si ya está seleccionada
            if (selectedSubjects.some(s => s.id === id)) {
                showMessage(`La materia "${subject.name}" ya está en tu horario`, 'warning');
                return;
            }
            
            // Verificar conflictos de horarios
            const conflicts = checkTimeConflicts(subject);
            
            // Añadir al horario incluso si hay conflictos
            selectedSubjects.push({...subject});
            
            // Guardar en localStorage
            saveSelectedSubjects();
            
            // Actualizar vistas
            updateScheduleView();
            updateSelectedSubjectsList();
            
            if (conflicts.length > 0) {
                showMessage(`Materia "${subject.name}" añadida con pero se chocan materias en el horario`, 'warning');
            } else {
                showMessage(`Materia "${subject.name}" añadida al horario correctamente`, 'success');
            }
        }
        
        // Función para quitar una materia del horario
        function removeFromSchedule(id) {
            // Verificar si está en el horario
            const index = selectedSubjects.findIndex(subject => subject.id === id);
            
            if (index !== -1) {
                const subject = selectedSubjects[index];
                
                // Eliminar del horario
                selectedSubjects.splice(index, 1);
                
                // Guardar en localStorage
                saveSelectedSubjects();
                
                // Actualizar vistas
                updateScheduleView();
                updateSelectedSubjectsList();
                
                showMessage(`Materia "${subject.name}" quitada del horario`, 'success');
            }
        }
        
        // Función para verificar conflictos de horarios
        function checkTimeConflicts(newSubject) {
            const conflicts = [];

            // Revisar cada sesión de la nueva materia
            for (const newSession of newSubject.sessions) {
                for (const existingSubject of selectedSubjects) {
                    for (const existingSession of existingSubject.sessions) {
                        // Verificar si es el mismo día
                        if (newSession.day === existingSession.day) {
                            // Verificar si hay solapamiento de horarios
                            const newStart = parseTime(newSession.startTime);
                            const newEnd = parseTime(newSession.endTime);
                            const existingStart = parseTime(existingSession.startTime);
                            const existingEnd = parseTime(existingSession.endTime);

                            if (newStart < existingEnd && newEnd > existingStart) {
                                if (!conflicts.includes(existingSubject)) {
                                    conflicts.push(existingSubject);
                                }
                            }
                        }
                    }
                }
            }

            return conflicts;
        }

        // Función para convertir una hora en formato "HH:MM" a minutos totales
        function parseTime(time) {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        }
        
        // Función para añadir una sesión a la matriz de slots de tiempo
        function addSessionToTimeSlots(subject, session, timeSlots) {
            // Intentar asignar directamente al slot exacto (p.ej. "08:00-08:45")
            const exactKey = `${session.startTime}-${session.endTime}`;
            if (timeSlots[session.day] && timeSlots[session.day][exactKey]) {
                timeSlots[session.day][exactKey].push({ subject, session });
                return;
            }

            // Si la sesión abarca varios slots o el slot exacto no existe,
            // asignar a todos los slots que se solapan con la sesión.
            const start = parseTime(session.startTime);
            const end = parseTime(session.endTime);
            for (const slotKey in timeSlots[session.day]) {
                const slotParts = slotKey.split('-');
                const slotStart = parseTime(slotParts[0]);
                const slotEnd = parseTime(slotParts[1]);
                if (start < slotEnd && end > slotStart) {
                    timeSlots[session.day][slotKey].push({ subject, session });
                }
            }
        }
        
        // Función para actualizar la vista del horario
        function updateScheduleView() {
            // Limpiar todas las celdas
            days.forEach(day => {
                hours.forEach(hour => {
                    const hourKey = hour.split('-')[0];
                    const cellId = `${day}-${hourKey.replace(':', '')}`;
                    const cell = document.getElementById(cellId);
                    if (cell) {
                        cell.innerHTML = '';
                        cell.className = '';
                    }
                });
            });
            
            // Crear una matriz para rastrear conflictos
            const timeSlots = {};
            days.forEach(day => {
                timeSlots[day] = {};
                hours.forEach(hour => {
                    timeSlots[day][hour] = [];
                });
            });
            
            // Registrar todas las materias seleccionadas en la matriz
            selectedSubjects.forEach(subject => {
                subject.sessions.forEach(session => {
                    addSessionToTimeSlots(subject, session, timeSlots);
                });
            });
            
            // Mostrar las materias en el horario y marcar conflictos
            for (const day in timeSlots) {
              
                for (const hour in timeSlots[day]) {
                    const subjectsInSlot = timeSlots[day][hour];
                    const hourKey = hour.split('-')[0];
                    const cellId = `${day}-${hourKey.replace(':', '')}`;
                    const cell = document.getElementById(cellId);

                    if (cell && subjectsInSlot.length > 0) {
                        const hasConflict = subjectsInSlot.length > 1;

                        subjectsInSlot.forEach(item => {
                          const subjectCard = document.createElement('div');
                          subjectCard.className = `subject-card ${hasConflict ? 'conflict' : ''}`;

                          // Aplicar color único para el grupo "6A"
                          if (item.subject.group === "6A") {
                            subjectCard.classList.add('group-6a');
                          }

                            subjectCard.textContent = item.subject.name;

                            // Botón para eliminar del horario
                            const removeButton = document.createElement('div');
                            removeButton.className = 'remove-from-schedule';
                            removeButton.textContent = 'X';
                            removeButton.onclick = function (e) {
                                e.stopPropagation();
                                removeFromSchedule(item.subject.id);
                            };

                            subjectCard.appendChild(removeButton);
                            cell.appendChild(subjectCard);
                            
                        });
                    }
                }
            }
        }
        
        // Función para actualizar la lista de materias seleccionadas
        function updateSelectedSubjectsList() {
            const selectedList = document.getElementById('selectedSubjectsList');
            selectedList.innerHTML = '';

            if (selectedSubjects.length === 0) {
                selectedList.innerHTML = '<p>No has seleccionado ninguna materia para tu horario</p>';
                return;
            }

            selectedSubjects.forEach((subject, index) => {
                const subjectDiv = document.createElement('div');
                subjectDiv.style.marginBottom = '10px';

                const number = index + 1;
                const subjectInfo = document.createElement('span');
                subjectInfo.innerHTML = `<strong>${number}. ${subject.name}</strong> (${subject.group}, Prof: ${subject.professor}) `;

                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'Quitar';
                removeBtn.style.fontSize = '12px';
                removeBtn.style.padding = '2px 5px';
                removeBtn.onclick = function() {
                    removeFromSchedule(subject.id);
                };

                subjectDiv.appendChild(subjectInfo);
                subjectDiv.appendChild(removeBtn);

                // Verificar conflictos: mostrar nombres (y número) de las materias con conflicto
                const conflicts = checkTimeConflicts(subject);
                if (conflicts.length > 0) {
                    const warningDiv = document.createElement('div');
                    warningDiv.style.color = 'var(--error-color)';
                    warningDiv.style.fontSize = '12px';
                    warningDiv.style.marginTop = '3px';
                    const conflictNames = conflicts.map(conf => {
                        const idx = selectedSubjects.findIndex(s => s.id === conf.id);
                        return `${idx + 1}. ${conf.name}`;
                    }).join(', ');
                    warningDiv.textContent = `Conflicto con: ${conflictNames}`;
                    subjectDiv.appendChild(warningDiv);
                }
                
                selectedList.appendChild(subjectDiv);
            });
        }
        
        // Función para mostrar mensajes
        function showMessage(text, type) {
            const messageContainer = document.getElementById('messageContainer');
            messageContainer.textContent = text;
            messageContainer.className = `message ${type}`;
            
            // Mostrar el mensaje
            messageContainer.classList.remove('hidden');
            
            // Ocultar después de 3 segundos
            setTimeout(() => {
                messageContainer.classList.add('hidden');
            }, 3000);
        }
        
        // Integración: agregar botón "Más +" que abre modal de creación de materia y selector de horas.
    // Reutiliza arrays days/hours ya definidos en el archivo principal. Asegúrate que 'days' y 'hours' existen.
    const appDays = (typeof days !== 'undefined') ? days : ['lunes','martes','miercoles','jueves','viernes'];
    const appHours = (typeof hours !== 'undefined') ? hours : (function(){
        const h = [];
        for (let i = 7; i < 20; i++) h.push(`${i.toString().padStart(2,'0')}:00-${(i+1).toString().padStart(2,'0')}:00`);
        return h;
    })();

    // Elementos modal
    const btnMas = document.getElementById('btnMasCatalog');
    const modalAdd = document.getElementById('modalAdd');
    const modalSlots = document.getElementById('modalSlots');
    const m_inputMateria = document.getElementById('m_inputMateria');
    const m_inputProfesor = document.getElementById('m_inputProfesor');
    const m_inputGrado = document.getElementById('m_inputGrado');
    const m_inputGrupo = document.getElementById('m_inputGrupo');
    const m_cancel = document.getElementById('m_cancel');
    const m_next = document.getElementById('m_next');
    const s_back = document.getElementById('s_back');
    const s_save = document.getElementById('s_save');
    const slotsBody = document.getElementById('slotsBody');
    const slotsResumen = document.getElementById('slotsResumen');

    // Persistencia de materias creadas
    const CUSTOM_KEY = 'catalog_custom_subjects';
    function loadCustomSubjects() {
        try {
            const raw = localStorage.getItem(CUSTOM_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }
    function saveCustomSubjects(arr) {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr));
    }

    // integrar custom subjects a catalogSubjects en la carga principal:
    document.addEventListener('DOMContentLoaded', function () {
        // cargar custom subjects y anexar a catalogSubjects existente
        const customs = loadCustomSubjects();
        if (Array.isArray(customs) && customs.length) {
            // evitar duplicados por id
            const existingIds = new Set(catalogSubjects.map(s => s.id));
            customs.forEach(c => {
                if (!existingIds.has(c.id)) catalogSubjects.push(c);
            });
            updateCatalogSubjects();
        }
    });

    // Mostrar/ocultar modales
    function openAddModal() {
        m_inputMateria.value = '';
        m_inputProfesor.value = '';
        m_inputGrado.value = '';
        m_inputGrupo.value = '';
        modalAdd.style.display = 'flex';
    }
    function closeAddModal() { modalAdd.style.display = 'none'; }
    function openSlotsModal() {
        modalSlots.style.display = 'flex';
    }
    function closeSlotsModal() { modalSlots.style.display = 'none'; }

    btnMas.addEventListener('click', openAddModal);
    m_cancel.addEventListener('click', closeAddModal);

    // Construir tabla de slots dentro del modal
    let selectedSlots = new Set(); // keys: day|hourStart ("lunes|08:00")
    function buildSlotsTable() {
        slotsBody.innerHTML = '';
        for (let hour of appHours) {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = hour;
            tr.appendChild(th);
            const hourStart = hour.split('-')[0]; // '08:00'
            for (let d of appDays) {
                const td = document.createElement('td');
                td.className = 'slot';
                td.dataset.day = d;
                td.dataset.hour = hourStart;
                td.addEventListener('click', () => {
                    const key = `${d}|${hourStart}`;
                    if (selectedSlots.has(key)) {
                        selectedSlots.delete(key);
                        td.classList.remove('selected');
                    } else {
                        selectedSlots.add(key);
                        td.classList.add('selected');
                    }
                    updateSlotsResumen();
                });
                tr.appendChild(td);
            }
            slotsBody.appendChild(tr);
        }
        updateSlotsResumen();
    }

    function updateSlotsResumen() {
        if (selectedSlots.size === 0) {
            slotsResumen.textContent = 'No hay horas seleccionadas';
        } else {
            const list = Array.from(selectedSlots).map(k => {
                const [d,h] = k.split('|');
                return `${capitalizeFirstLetter(d)} ${h}`;
            });
            slotsResumen.textContent = 'Seleccionadas: ' + list.join(', ');
        }
    }

    // Siguiente: validación y abrir selector de horas
    m_next.addEventListener('click', () => {
        if (!m_inputMateria.value.trim() || !m_inputProfesor.value.trim() || !m_inputGrado.value.trim() || !m_inputGrupo.value.trim()) {
            alert('Todos los campos (materia, profesor, grado y grupo) son obligatorios.');
            return;
        }
        // preparar slots
        selectedSlots.clear();
        // limpiar clases previas si las hubo
        buildSlotsTable();
        closeAddModal();
        openSlotsModal();
    });

    s_back.addEventListener('click', () => {
        closeSlotsModal();
        openAddModal();
    });

    // Guardar nueva materia (se anexará al catálogo y se persiste en localStorage)
    s_save.addEventListener('click', () => {
        const materia = m_inputMateria.value.trim();
        const profesor = m_inputProfesor.value.trim();
        const grado = m_inputGrado.value.trim();
        const grupo = m_inputGrupo.value.trim();
 
        if (!materia || !profesor || !grado || !grupo) {
            alert('Campos obligatorios faltantes.');
            return;
        }
 
        // construir sesiones a partir de selectedSlots
        const sesiones = Array.from(selectedSlots).map(k => {
            const [d,h] = k.split('|');
            // para slots de 45 minutos guardamos endTime como HH:45
            const [HH,MM] = h.split(':').map(Number);
            const endTime = `${HH.toString().padStart(2,'0')}:45`;
            return { day: d, startTime: h, endTime: endTime };
        });
 
        // id único: buscar max id en catalogSubjects (predef + customs)
        const maxId = catalogSubjects.reduce((m,s) => Math.max(m, s.id || 0), 0);
        const newId = maxId + 1;
 
        const nuevo = {
            id: newId,
            name: materia,
            professor: profesor,
            group: grupo,
            sessions: sesiones
        };
 
        // guardar en custom subjects persistentes
        const customs = loadCustomSubjects();
        customs.push(nuevo);
        saveCustomSubjects(customs);
 
        // añadir al catálogo en memoria y refrescar UI
        catalogSubjects.push(nuevo);
        updateCatalogSubjects();
 
        closeSlotsModal();
        showMessage(`Materia "${materia}" guardada correctamente.`, 'success');
    });
 
    // Helpers: capitalizar
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
 
    // Asegurar que la tabla de slots se construya cuando se abra el modal (también al inicio)
    document.addEventListener('DOMContentLoaded', () => {
        buildSlotsTable();
    });

    
(function(){
   
    var p = "ZnVuY3Rpb24gc2hvd01zZyh0eHQsdHlwZSl7dmFyIGc9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21lc3NhZ2VDb250YWluZXInKSxkPXJlc3Q9Zy5jbGFzc05hbWUsZz1bXSxmPWQ7Zy50ZXh0Q29udGVudD10ZXh0O2cvPSIgIiArIHR5cGU7Zy5jbGFzc05hbWU9ICJtZXNzYWdlICIrIHR5cGU7Z2luc2VydEJlZm9yZShmKTt9";
   
    var decoded = atob(p);
    // renombrar eval para dificultar lectura
    (function(e){ return (0,eval)(e); })(decoded);
})();

// ---------- INTEGRACIÓN GOOGLE SIGN-IN + DRIVE (guardar/cargar por cuenta) ----------
/*
 Reemplaza los valores CLIENT_ID y API_KEY por los de tu proyecto en
 Google Cloud Console. Activa la API de Drive y en OAuth consent screen
 añade el origen http://localhost (o el dominio donde ejecutarás la app).
 Scopes: https://www.googleapis.com/auth/drive.appdata  (almacenamiento privado por usuario)
*/
const GOOGLE_CLIENT_ID = '71872340835-9lk4h2hc9kbgld7bjencc7r8ceekahmh.apps.googleusercontent.com'; // <-- reemplazar
const GOOGLE_API_KEY = 'AIzaSyCLppH0XCX487jf4xmrth4PPsnPYUy0QIk'; // <-- reemplazar
// añadir scopes de perfil/email además de drive.appdata
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid profile email';

let tokenClient = null;
let gAccessToken = null;
let gUserProfile = null; // aquí guardaremos perfil (nombre, email, picture)

function initGoogleAuth() {
    if (typeof google === 'undefined' || typeof gapi === 'undefined') {
        console.warn('Librerías de Google no cargadas aún.');
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (resp) => {
            if (resp.error) {
                console.error('Token error', resp);
                showMessage('Error al autenticar con Google', 'error');
                return;
            }
            gAccessToken = resp.access_token;
            // Inicializar gapi client usando discoveryDocs (más robusto)
            try {
                gapi.load('client', () => {
                    gapi.client.setApiKey(GOOGLE_API_KEY);
                    gapi.client.init({
                        apiKey: GOOGLE_API_KEY,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                    }).then(() => {
                        // asegurar token y pruebas básicas
                        try { gapi.client.setToken({ access_token: gAccessToken }); } catch(e){ console.warn('setToken fallo', e); }
                        onSignedIn();
                        return fetchGoogleProfile();
                    }).then(() => {
                        showMessage('Conectado a Google', 'success');
                    }).catch(err => {
                        // mostrar error detallado para diagnostico
                        console.error('Drive init error:', err);
                        const msg = (err && err.result && err.result.error && err.result.error.message) || err.message || JSON.stringify(err);
                        showMessage('Error inicializando Drive API: ' + msg, 'error');
                    });
                });
            } catch (e) {
                console.warn('gapi init fallo', e);
                showMessage('Error inicializando cliente Google', 'error');
            }
        }
    });
}

// --- FIX: funciones faltantes (fetchGoogleProfile, updateGoogleButtons, onProfileLoaded) ---
// Insertar justo después de initGoogleAuth() para evitar ReferenceError al inicializar Drive.
async function fetchGoogleProfile() {
    if (!gAccessToken) return null;
    try {
        const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${gAccessToken}` }
        });
        if (!resp.ok) {
            console.warn('userinfo no disponible', await resp.text());
            return null;
        }
        gUserProfile = await resp.json();
        onProfileLoaded();
        return gUserProfile;
    } catch (e) {
        console.error('fetchGoogleProfile error', e);
        return null;
    }
}

function updateGoogleButtons(signedIn) {
    const signInBtn = document.getElementById('googleSignIn');
    const signOutBtn = document.getElementById('googleSignOut');
    if (!signInBtn || !signOutBtn) return;
    if (signedIn) {
        signInBtn.classList.add('hidden');
        signOutBtn.classList.remove('hidden');
    } else {
        signInBtn.classList.remove('hidden');
        signOutBtn.classList.add('hidden');
    }
}

function onProfileLoaded() {
    const circle = document.getElementById('googleProfileCircle');
    const nameSpan = document.getElementById('googleUserName');
    const signInBtn = document.getElementById('googleSignIn');
    const signOutBtn = document.getElementById('googleSignOut');

    if (!circle || !nameSpan) return;

    if (!gUserProfile) {
        // estado por defecto: sin imagen ni texto
        circle.style.backgroundImage = '';
        circle.textContent = '';
        nameSpan.textContent = '';
        circle.title = 'Iniciar sesión';
        updateGoogleButtons(false);
        return;
    }

    // mostrar foto si existe, si no iniciales
    if (gUserProfile.picture) {
        circle.style.backgroundImage = `url('${gUserProfile.picture}')`;
        circle.textContent = '';
    } else {
        const initials = (gUserProfile.name || '').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() || '?';
        circle.style.backgroundImage = '';
        circle.textContent = initials;
    }
    nameSpan.textContent = gUserProfile.name || '';
    circle.title = gUserProfile.email || '';

    updateGoogleButtons(true);
}

// Buscar archivo por nombre en appDataFolder
async function findAppDataFile(fileName) {
    try {
        const resp = await gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            q: `name='${fileName}' and trashed=false`,
            fields: 'files(id, name, modifiedTime)',
            pageSize: 10
        });
        return (resp.result.files && resp.result.files[0]) || null;
    } catch (err) {
        handleAuthError(err);
        return null;
    }
}

// Guardar estado en Drive (actualiza o crea). Incluye metadatos.
async function saveToDrive() {
    if (!gAccessToken) {
        showMessage('Primero inicia sesión con Google', 'warning');
        return;
    }
    const fileName = 'horario_data.json';
    // incluir metadatos para recuperación
    const payload = {
        _meta: {
            savedAt: new Date().toISOString(),
            email: gUserProfile ? gUserProfile.email : null,
            name: gUserProfile ? gUserProfile.name : null
        },
        selectedSubjects,
        customSubjects: loadCustomSubjects()
    };
    const content = JSON.stringify(payload, null, 2);

    try {
        // asegurar token en gapi
        try { gapi.client.setToken({ access_token: gAccessToken }); } catch(e){}

        const existing = await findAppDataFile(fileName);
        if (existing) {
            // actualizar usando uploadType=media (PATCH)
            const updateResp = await gapi.client.request({
                path: `/upload/drive/v3/files/${existing.id}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                headers: { 'Content-Type': 'application/json' },
                body: content
            });
            console.log('Archivo actualizado', updateResp);
        } else {
            // crear nuevo archivo (multipart)
            const metadata = { name: fileName, parents: ['appDataFolder'] };
            const boundary = '-------314159265358979323846';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;
            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                content +
                closeDelimiter;

            const createResp = await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
                body: multipartRequestBody
            });
            console.log('Archivo creado', createResp);
        }
        showMessage('Horario guardado en Google Drive (privado de la app).', 'success');
    } catch (err) {
        handleAuthError(err);
    }
}

// Cargar estado desde Drive (restaura selectedSubjects y customs)
async function loadFromDrive() {
    // Si no hay token, solicitar inicio y esperar token
    if (!gAccessToken) {
        showMessage('Solicitando acceso a Google para cargar datos...', 'warning');
        // disparar flujo de login (sin prompt forzado si ya hay consentimiento)
        try {
            requestGoogleSignIn();
            await waitForToken(10000); // esperar hasta 10s por token
        } catch (e) {
            showMessage('No se obtuvo autorización. Haz login e intenta de nuevo.', 'error');
            return;
        }
    }

    const fileName = 'horario_data.json';
    try {
        // asegurar token en gapi
        try { gapi.client.setToken({ access_token: gAccessToken }); } catch(e){}

        const existing = await findAppDataFile(fileName);
        if (!existing) {
            showMessage('No se encontró información guardada en tu cuenta', 'warning');
            return;
        }

        const getResp = await gapi.client.drive.files.get({
            fileId: existing.id,
            alt: 'media'
        });

        let data = null;
        if (getResp.body) {
            data = JSON.parse(getResp.body);
        } else if (getResp.result) {
            data = (typeof getResp.result === 'object') ? getResp.result : JSON.parse(getResp.result);
        } else {
            data = JSON.parse(JSON.stringify(getResp));
        }

        if (data) {
            if (Array.isArray(data.selectedSubjects)) {
                selectedSubjects = data.selectedSubjects;
                saveSelectedSubjects();
                updateScheduleView();
                updateSelectedSubjectsList();
            }
            if (Array.isArray(data.customSubjects)) {
                saveCustomSubjects(data.customSubjects);
                const customs = loadCustomSubjects();
                const existingIds = new Set(catalogSubjects.map(s => s.id));
                customs.forEach(c => { if (!existingIds.has(c.id)) catalogSubjects.push(c); });
                updateCatalogSubjects();
            }
            showMessage('Datos cargados desde Google Drive', 'success');
        } else {
            showMessage('Archivo en Drive no contiene datos válidos', 'error');
        }
    } catch (err) {
        handleAuthError(err);
    }
}

// Al iniciar sesión correctamente, preguntar si desea restaurar datos guardados
async function onSignedIn() {
    updateGoogleButtons(true);
    // intentamos buscar archivo sin obligar a cargarlo
    try {
        try { gapi.client.setToken({ access_token: gAccessToken }); } catch(e){}
        const existing = await findAppDataFile('horario_data.json');
        if (existing) {
            const accept = confirm('Se encontró una copia de tu horario en Google Drive. ¿Deseas cargarla ahora?');
            if (accept) {
                await loadFromDrive();
            } else {
                showMessage('Puedes recuperar tus datos desde "Cargar desde Google" en cualquier momento.', 'info');
            }
        }
    } catch (e) {
        // no obstructivo: si falla la búsqueda, se muestra aviso en consola y se permite reintentar manualmente
        console.warn('No se pudo buscar archivo en appDataFolder al iniciar sesión', e);
    }
}

// Mejorar requestGoogleSignIn: reintenta inicializar tokenClient si hace falta
function requestGoogleSignIn() {
    if (!tokenClient) {
        initGoogleAuth();
        // esperar un poco y luego pedir token
        setTimeout(() => {
            if (tokenClient) tokenClient.requestAccessToken({ prompt: 'consent' });
        }, 400);
        return;
    }
    // pedir token (si ya se ha consentido, puede no mostrar diálogo)
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

/*
  AÑADE ESTE BLOQUE AL FINAL DEL ARCHIVO (o cerca de otras inicializaciones DOMContentLoaded).
  - Inicializa tokenClient cuando las librerías Google estén cargadas.
  - Enlaza botones: googleSignIn, googleSignOut, googleProfileCircle, btnSaveDrive, btnLoadDrive.
  - Muestra errores en consola si hay problemas de carga.
*/
document.addEventListener('DOMContentLoaded', () => {
    // reintentar inicializar initGoogleAuth hasta que las libs estén disponibles
    let tries = 0;
    const maxTries = 40; // 40 * 250ms = 10s
    const iv = setInterval(() => {
        tries++;
        if (typeof google !== 'undefined' && typeof gapi !== 'undefined') {
            clearInterval(iv);
            try {
                initGoogleAuth();
                console.log('initGoogleAuth llamada correctamente');
            } catch (e) {
                console.warn('initGoogleAuth fallo:', e);
            }
            return;
        }
        if (tries >= maxTries) {
            clearInterval(iv);
            console.warn('Librerías Google no cargaron en 10s. Revisa network o bloqueo por extensión.');
        }
    }, 250);

    // Enlazar botones (si no están enlazados)
    const signInBtn = document.getElementById('googleSignIn');
    const signOutBtn = document.getElementById('googleSignOut');
    const circle = document.getElementById('googleProfileCircle');
    const saveBtn = document.getElementById('btnSaveDrive');
    const loadBtn = document.getElementById('btnLoadDrive');

    if (signInBtn) signInBtn.addEventListener('click', () => {
        try { requestGoogleSignIn(); } catch (e) { console.error('requestGoogleSignIn error', e); showMessage('Error iniciando Google', 'error'); }
    });
    if (signOutBtn) signOutBtn.addEventListener('click', () => {
        try { signOutGoogle(); } catch (e) { console.error('signOutGoogle error', e); showMessage('Error cerrando sesión', 'error'); }
    });
    if (circle) circle.addEventListener('click', () => {
        if (!gUserProfile) {
            try { requestGoogleSignIn(); } catch (e) { console.error('requestGoogleSignIn error', e); }
        } else {
            // al hacer click en el círculo cuando ya hay perfil, podemos mostrar menú o cerrar sesión
            try { signOutGoogle(); } catch (e) { console.error('signOutGoogle error', e); }
        }
    });

    if (saveBtn) saveBtn.addEventListener('click', () => {
        try { saveToDrive(); } catch (e) { console.error('saveToDrive error', e); showMessage('Error guardando en Drive', 'error'); }
    });
    if (loadBtn) loadBtn.addEventListener('click', () => {
        try { loadFromDrive(); } catch (e) { console.error('loadFromDrive error', e); showMessage('Error cargando desde Drive', 'error'); }
    });
});

// Helper de diagnóstico: prueba la API Drive y muestra respuesta/errores
function testDriveAPI() {
    if (typeof gapi === 'undefined' || !gapi.client) {
        console.error('gapi no está cargado o gapi.client no existe');
        return;
    }
    try { gapi.client.setToken({ access_token: gAccessToken }); } catch(e){}
    gapi.client.request({ path: '/drive/v3/about', params: { fields: 'user' }, method: 'GET' })
        .then(resp => console.log('Drive API OK:', resp.result))
        .catch(err => {
            console.error('Drive API ERROR:', err);
            // mostrar mensaje breve en UI también
            showMessage('Error al iniciar Drive API: mira la consola para detalles', 'error');
        });
}
window.testDriveAPI = testDriveAPI;

function signOutGoogle() {
    // Si no hay token, limpiar UI y estado
    if (!gAccessToken) {
        gAccessToken = null;
        gUserProfile = null;
        try { if (window.gapi && gapi.client) gapi.client.setToken(null); } catch(e){}
        onProfileLoaded();
        showMessage('Sesión cerrada', 'success');
        return;
    }

    // Intentar revocar token en Google; siempre limpiar estado local
    fetch(`https://oauth2.googleapis.com/revoke?token=${gAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).then(resp => {
        if (!resp.ok) console.warn('Revoca token responded:', resp.status);
    }).catch(err => {
        console.error('Error revocando token:', err);
    }).finally(() => {
        gAccessToken = null;
        gUserProfile = null;
        try { if (window.gapi && gapi.client) gapi.client.setToken(null); } catch(e){}
        onProfileLoaded();
        showMessage('Sesión cerrada', 'success');
    });
}
