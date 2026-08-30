(function () {
    const plan004 = {
        nanotecnologia: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Introducción a la Nanotecnología', 'Química General', 'Termodinámica', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Física', 'Probabilidad y Estadística', 'Química Orgánica', 'Metodología de la Investigación'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Ciencia de los Materiales', 'Química Analítica', 'Síntesis de Nanomateriales', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Electroquímica', 'Óptica y Fenómenos Cuánticos', 'Incorporación de Materiales', 'Nanobiología'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Ecuaciones Diferenciales', 'Nanomateriales', 'Sistemas de Gestión Integral', 'Caracterización de Materiales I', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Nanotecnología'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Metrología e Instrumentación Virtual', 'Física para Nanotecnología', 'Nanobiotecnología', 'Caracterización de Materiales II', 'Operaciones Unitarias'],
            8: ['Inglés VII', 'Optativa I', 'Calidad Industrial', 'Simulación y Modelado', 'Procesos Unitarios', 'Ingeniería Industrial', 'Dibujo Industrial'],
            9: ['Inglés VIII', 'Optativa II', 'Optativa III', 'Administración de Proyectos', 'Ingeniería Económica', 'Escalamiento de Proceso', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Ingeniería en Nanotecnología']
        },
        ambiental: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Química Inorgánica', 'Metodología de la Investigación', 'Legislación Ambiental', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Física', 'Probabilidad y Estadística', 'Química Orgánica', 'Química Analítica'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Química Ambiental', 'Bioquímica', 'Microbiología Ambiental', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Gestión de Recursos Hídricos', 'Gestión Integral de Residuos', 'Seguridad Laboral y Salud Ocupacional', 'Sistemas de Gestión Ambiental y de Calidad'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Ecuaciones Diferenciales', 'Gestión de la Calidad del Aire', 'Manejo y Conservación de Suelo', 'Evaluación de Impacto Ambiental', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Gestión Ambiental'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Operaciones Unitarias I', 'Termodinámica', 'Sistemas de Información Geográfica y Ordenamiento Territorial', 'Producción Sustentable', 'Gestión y Auditoría Ambiental y Laboral'],
            8: ['Inglés VII', 'Procesos de Adaptación al Cambio Climático', 'Operaciones Unitarias II', 'Mecánica de Fluidos e Hidráulica', 'Estrategias Regionales para la Sustentabilidad I', 'Ingeniería Económica y Evaluación de Proyectos Ambientales', 'Diseño de Experimentos'],
            9: ['Inglés VIII', 'Evaluación de Riesgo', 'Tecnología para el Tratamiento de Agua', 'Bioprocesos Ambientales', 'Estrategias Regionales para la Sustentabilidad II', 'Energías Alternativas', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Ingeniería Ambiental y Sustentabilidad']
        },
        manufactura: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Seguridad, Higiene y Medio Ambiente', 'Química Básica', 'Metrología', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Física', 'Estudio del Trabajo', 'Costo de Producción', 'Probabilidad y Estadística'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Dibujo Industrial', 'Procesos de Fabricación I', 'Control de Calidad', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Dibujo para Ingeniería', 'Procesos de Fabricación II', 'Mantenimiento Industrial', 'Fundamentos de Mecánica'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Ecuaciones Diferenciales', 'Manufactura Asistida por Computadora', 'Dimensiones y Tolerancias Geométricas', 'Electricidad y Electrónica Industrial', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Procesos de Fabricación'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Sistemas de Producción', 'Mecánica de Materiales', 'Sistemas Neumáticos e Hidráulicos', 'Lógica Digital para la Manufactura', 'Ingeniería de Plásticos'],
            8: ['Inglés VII', 'Sistemas Avanzados de la Calidad', 'Administración Financiera', 'Diseño del Producto', 'Manufactura Aditiva', 'PLC y Redes Industriales', 'Investigación de Operaciones'],
            9: ['Inglés VIII', 'Simulación de Procesos de Manufactura', 'Lean Six Sigma', 'Ingeniería Asistida por Computadora', 'Sistemas de Manufactura Flexible', 'Innovaciones de Manufactura', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Ingeniería en Manufactura Avanzada']
        },
        energia: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Física', 'Energía y Desarrollo Sostenible', 'Dibujo Asistido por Computadora', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Probabilidad y Estadística', 'Seguridad y Medio Ambiente', 'Circuitos Eléctricos', 'Diagnósticos Energéticos'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Temas Selectos de Química', 'Instalaciones Eléctricas Industriales', 'Electrónica Industrial', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Temas Selectos de Termodinámica y Transferencia de Energía', 'Metrología', 'Análisis de Recurso Energético', 'Gestión del Mantenimiento'],
            5: ['Inglés V', 'Liderazgo de Equipo de Alto Desempeño', 'Ecuaciones Diferenciales', 'Energía Solar', 'Máquinas Eléctricas', 'Sistemas Electromecánicos', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Energía Turbo Solar'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Sistemas de Adquisición de Datos', 'Temas Selectos de Física', 'Introducción a las Redes Eléctricas Inteligentes', 'Optativa I', 'Electroquímica'],
            8: ['Inglés VII', 'Ingeniería de Biomasa', 'Optativa II', 'Optativa III', 'Normatividad y Sustentabilidad Energética', 'Almacenamiento de Energía', 'Hidrógeno y Celdas de Combustibles'],
            9: ['Inglés VIII', 'Diseño de Proyectos Eólicos', 'Optativa IV', 'Eficiencia Energética', 'Diseño de Proyectos Fotovoltaicos', 'Ingeniería Económica', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Ingeniería en Energía y Desarrollo Sostenible']
        },
        alimentos: {
            1: ['Inglés I', 'Desarrollo Humano', 'Fundamentos Matemáticos', 'Biología', 'Química General', 'Metodología de la Investigación', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Física', 'Probabilidad y Estadística', 'Química Analítica', 'Microbiología'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Tecnología de Alimentos I', 'Química de Alimentos', 'Tecnologías de Conservación de Alimentos', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Análisis de Alimentos', 'Sistemas de Gestión', 'Aprovechamiento de Residuos Agroindustriales', 'Tecnología de Alimentos II'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Ecuaciones Diferenciales', 'Administración de la Producción', 'Producción Intensiva Agroindustrial', 'Tecnología de Alimentos III', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Agroindustria'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Bioquímica', 'Termodinámica', 'Balance de Materia y Energía', 'Operaciones Unitarias I', 'Diseño de Experimentos'],
            8: ['Inglés VII', 'Gestión de la Producción', 'Emprendimiento e Innovación', 'Formulación y Evaluación de Proyectos', 'Estandarización de Procesos Alimentarios', 'Operaciones Unitarias II', 'Industrias Alimentarias Sostenibles'],
            9: ['Inglés VIII', 'Diseño de Plantas', 'Diseño de Procesos', 'Consultoría y Capacitación a Empresas', 'Bioingeniería', 'Operaciones Unitarias III', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Ingeniería en Alimentos']
        },
        petrolera: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Química Básica', 'Geología de Exploración', 'Introducción a la Ingeniería Petrolera', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Física', 'Probabilidad y Estadística', 'Geología de Explotación', 'Seguridad Industrial y Medio Ambiente'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Termodinámica', 'Mecánica de Fluidos', 'Registros Geofísicos', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Principios de Yacimientos y Producción', 'Ingeniería de Perforación de Pozos', 'Fluidos de Perforación', 'Propiedades de los Fluidos Petroleros'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Ecuaciones Diferenciales', 'Caracterización Estática de Yacimientos', 'Terminación, Reparación y Estimulación de Pozos', 'Control de Pozos', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Perforación y Servicios a Pozos'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Ingeniería de Producción', 'Caracterización Dinámica de Yacimientos', 'Geomecánica', 'Sistemas de Bombeo y Compresión', 'Yacimientos de Gas y Condensado'],
            8: ['Inglés VII', 'Normatividad de la Industria Petrolera', 'Transporte y Manejo de la Producción', 'Recuperación Secundaria y Mejorada', 'Software de Ingeniería Petrolera', 'Sistemas Artificiales de Producción', 'Automatización y Control'],
            9: ['Inglés VIII', 'Economía Energética', 'Arquitectura Submarina en Aguas Profundas', 'Administración Integral de un Yacimiento', 'Perforación y Terminación en Aguas Profundas', 'Simulación Numérica de Yacimientos', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Ingeniería Petrolera']
        },
        software: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Fundamentos de Redes', 'Física', 'Fundamentos de Programación', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Conmutación y Enrutamiento de Redes', 'Probabilidad y Estadística', 'Programación Estructurada', 'Sistemas Operativos'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Tópicos de Calidad para el Diseño de Software', 'Bases de Datos', 'Programación Orientada a Objetos', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Aplicaciones Web', 'Estructura de Datos', 'Desarrollo de Aplicaciones Móviles', 'Análisis y Diseño de Software'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Ecuaciones Diferenciales', 'Aplicaciones Web Orientadas a Servicios', 'Bases de Datos Avanzadas', 'Estándares y Métricas para el Desarrollo de Software', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Desarrollo de Software Multiplataforma'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Formulación de Proyectos de Tecnología', 'Fundamentos de Inteligencia Artificial', 'Ética y Legislación en Tecnologías de la Información', 'Optativa I', 'Seguridad Informática'],
            8: ['Inglés VII', 'Electrónica Digital', 'Gestión de Proyectos de Tecnología', 'Programación para Inteligencia Artificial', 'Administración de Servidores', 'Optativa II', 'Informática Forense'],
            9: ['Inglés VIII', 'Internet de las Cosas', 'Evaluación de Proyectos de Tecnología', 'Ciencia de Datos', 'Tecnologías Disruptivas', 'Optativa III', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Ingeniería en Tecnologías de la Información e Innovación Digital']
        },
        mecatronica: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Procesos Industriales', 'Metodología de la Programación', 'Metrología', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Física', 'Probabilidad y Estadística', 'Circuitos Eléctricos', 'Dibujo para Ingeniería'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Elementos Mecánicos', 'Electrónica Digital', 'Electrónica Analógica y de Potencia', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Estructura y Propiedades de los Materiales', 'Control de Motores Eléctricos', 'Sistemas Neumáticos e Hidráulicos', 'Instrumentación Industrial'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Ecuaciones Diferenciales', 'Controladores Lógicos Programables', 'Procesos de Manufactura', 'Implementación de Sistemas Automáticos', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Automatización'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Modelado y Simulación de Sistemas', 'Cinemática y Dinámica de Robots', 'Análisis de Mecanismos', 'Instrumentación Virtual', 'Sistemas Embebidos'],
            8: ['Inglés VII', 'Diseño Asistido por Computadora', 'Ingeniería de Control', 'Programación de Robots Industriales', 'Diseño Mecánico', 'Sistemas CAM CNC', 'Diseño de Sistemas Mecatrónicos'],
            9: ['Inglés VIII', 'Sistemas Eléctricos Industriales', 'Control Avanzado', 'Administración de Mantenimiento', 'Ingeniería Asistida por Computadora', 'Sistemas de Manufactura Flexible', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Ingeniería Mecatrónica']
        },
        biomedica: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Física', 'Introducción a la Ingeniería Biomédica', 'Química Aplicada a la Ingeniería', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Cálculo Diferencial', 'Fundamentos de Electrónica', 'Tecnología Hospitalaria', 'Bioquímica', 'Probabilidad y Estadística'],
            3: ['Inglés III', 'Pensamiento y Toma de Decisiones', 'Cálculo Integral', 'Electrónica para Ingeniería', 'Fundamentos de Ingeniería Clínica', 'Fundamentos Anatomía y Fisiología', 'Administración de Recursos Hospitalarios'],
            4: ['Inglés IV', 'Ética Profesional', 'Cálculo de Varias Variables', 'Electrónica Analógica', 'Ingeniería Clínica', 'Anatomía y Fisiología para Ingeniería', 'Electrónica Digital'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Ecuaciones Diferenciales', 'Programación Estructurada', 'Escenarios Clínicos', 'Prácticas Clínicas', 'Proyecto Integrador I'],
            6: ['Inglés VI', 'Habilidades Gerenciales', 'Series y Transformadas', 'Electrónica de Potencia', 'Metrología', 'Programación Orientada a Objetos', 'Base de Datos'],
            7: ['Inglés VII', 'Regulación Sanitaria', 'Sensores y Actuadores', 'Sistemas de Control', 'Mantenimiento de Equipo Médico', 'Análisis de Datos'],
            8: ['Inglés VIII', 'Escenarios de Mantenimiento', 'Prácticas de Mantenimiento', 'Instalaciones Eléctricas en Salud', 'Procesamiento de Señales Biomédicas', 'Sistemas Embebidos', 'Proyecto Integrador II'],
            9: ['Inglés Técnico', 'Innovación Tecnológica en Salud', 'Investigación Biomédica', 'Protocolos e Interfaces de Comunicación', 'Fundamentos de Bioinstrumentación', 'Manufactura Asistida por Computadora', 'Procesamiento de Imágenes Médicas'],
            10: ['Emprendimiento y Desarrollo de Negocios', 'Física Médica', 'Desarrollo de Sistemas Biomédicos', 'Telesalud', 'Bioinstrumentación', 'Biomecánica', 'Biomateriales'],
            11: ['Escenario de Prácticas', 'Mercadotecnia en Salud', 'Ingeniería de Rehabilitación', 'Proyecto Integrador III'],
            12: ['Estadía', 'Licenciatura en Ingeniería Biomédica']
        },
        gestionempresarial: {
            1: ['Inglés I', 'Desarrollo Humano y Valores', 'Fundamentos Matemáticos', 'Contabilidad I', 'Fundamentos de Administración', 'Marco Legal de las Organizaciones', 'Comunicación y Habilidades Digitales'],
            2: ['Inglés II', 'Habilidades Socioemocionales y Manejo de Conflictos', 'Probabilidad y Estadística', 'Contabilidad II', 'Planeación Estratégica', 'Microeconomía', 'Derecho Corporativo'],
            3: ['Inglés III', 'Desarrollo del Pensamiento y Toma de Decisiones', 'Fundamentos de Mercadotecnia', 'Análisis Financiero', 'Fundamentos de Calidad', 'Macroeconomía', 'Proyecto Integrador I'],
            4: ['Inglés IV', 'Ética Profesional', 'Innovación y Emprendimiento', 'Estudio de Mercado', 'Administración de Proyectos I', 'Fundamentos de Sistemas de Producción', 'Estudio Técnico y Organizacional'],
            5: ['Inglés V', 'Liderazgo de Equipos de Alto Desempeño', 'Diagnóstico Local y Regional', 'Estudio Financiero', 'Administración de Proyectos II', 'Evaluación Financiera de Proyectos', 'Proyecto Integrador II'],
            6: ['Estadía TSU en Emprendimiento, Formulación y Evaluación de Proyectos'],
            7: ['Inglés VI', 'Habilidades Gerenciales', 'Mercadotecnia Estratégica', 'Tecnologías Aplicadas a los Negocios', 'Proyectos de Innovación Sostenibles', 'Gestión del Talento Humano', 'Administración de la Producción'],
            8: ['Inglés VII', 'Dirección Estratégica', 'Investigación de Operaciones', 'Sistemas de la Información Aplicados en la Organización', 'Modelos de Negocios', 'Evaluación en el Desempeño del Capital Humano', 'Administración y Gestión de la Calidad'],
            9: ['Inglés VIII', 'Comercio y Logística Internacional', 'Consultoría Empresarial', 'Gestión de la Propiedad Intelectual', 'Desarrollo en Proyectos de Emprendimiento Social', 'Finanzas Corporativas', 'Proyecto Integrador III'],
            10: ['Estadía Licenciatura en Administración']
        }
    };

    window.UPCHIAPAS_CURRICULA = plan004;
    window.UPCHIAPAS_CURRICULA_PLANS = {
        '003': {
            biomedica: {
                9: [
                    'Aplicaciones de Procesamiento de Señales Biomédicas',
                    'Expresión Oral y Escrita II',
                    'Ingeniería Económica',
                    'Inglés IX',
                    'Integración de Sistemas Biomédicos',
                    'Metrología',
                    'Procesamiento de Imágenes'
                ],
                10: ['Estadía']
            }
        },
        '004': plan004
    };
})();
