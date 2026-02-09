(function () {
    const profileCircle = document.getElementById('googleProfileCircle');
    const modal = document.getElementById('profileModal');
    const pmClose = document.getElementById('pmClose');
    const pmAvatar = document.getElementById('pmAvatar');
    const pmName = document.getElementById('pmName');
    const pmCareer = document.getElementById('pmCareer');
    const pmCareerIcon = document.getElementById('pmCareerIcon');
    const pmCareerSelect = document.getElementById('pmCareerSelect');
    const pmDate = document.getElementById('pmDate');
    const pmEmail = document.getElementById('pmEmail');
    const pmSignOut = document.getElementById('pmSignOut');
    const pmDeleteAccount = document.getElementById('pmDeleteAccount');

    const googleSignOutBtn = document.getElementById('googleSignOut');
    const googleUserName = document.getElementById('googleUserName');

    function formatDate(d) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = d.getFullYear();
        return dd + '/' + mm + '/' + yy;
    }

    function openProfileModal() {
        // set avatar from top circle background if present
        const bg = window.getComputedStyle(profileCircle).backgroundImage;
        if (bg && bg !== 'none') {
            pmAvatar.style.backgroundImage = bg;
            profileCircle.style.backgroundSize && (pmAvatar.style.backgroundSize = window.getComputedStyle(profileCircle).backgroundSize);
        }
        // fill name/career/date (career can be populated elsewhere in your app)
        pmName.textContent = googleUserName.textContent.trim() || 'Sin sesión';
        // try to get career from data attribute (optional)
        const selectedCareer = (typeof window.getSelectedCareerOption === 'function') ? window.getSelectedCareerOption() : null;
        const careerName = selectedCareer ? selectedCareer.name : (profileCircle.dataset.career || 'No especificada');
        pmCareer.textContent = careerName;
        if (pmCareerIcon) {
            if (selectedCareer && typeof resolveCareerIcon === 'function' && typeof setImageSource === 'function') {
                setImageSource(pmCareerIcon, resolveCareerIcon(selectedCareer), selectedCareer.fallbackIcon);
            } else if (!selectedCareer) {
                setImageSource(pmCareerIcon, DEFAULT_CAREER_ICON_SRC, DEFAULT_CAREER_ICON_SRC);
            }
        }
        // correo del usuario (si existe)
        if (pmEmail) {
            let email = '';
            try {
                if (typeof getCurrentUserEmail === 'function') {
                    email = getCurrentUserEmail();
                }
            } catch (e) { /* silencioso */ }
            pmEmail.textContent = email || 'Sin correo';
        }
        pmDate.textContent = formatDate(new Date());
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        // focus for keyboard users
        pmClose.focus();
    }
    function closeProfileModal() {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        profileCircle.focus();
    }

    profileCircle.addEventListener('click', openProfileModal);
    profileCircle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfileModal(); } });

    if (pmCareerSelect) {
        pmCareerSelect.addEventListener('click', () => {
            if (typeof openCareerModal === 'function') {
                openCareerModal();
            }
        });
    }

    pmClose.addEventListener('click', closeProfileModal);
    modal.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.close === 'true') closeProfileModal();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeProfileModal(); });


    // Expose a helper to update modal content from other scripts (e.g., after Google sign-in)
    window.profileModalUpdate = function (opts) {
        // opts: { name, avatarUrl, career, careerId }
        if (opts) {
            if (Array.isArray(opts.customCareers)) {
                customCareerOptions = saveCustomCareers(opts.customCareers);
                syncCareerOptions(true);
            }
            if (opts.name) { googleUserName.textContent = opts.name; pmName.textContent = opts.name; }
            if (opts.avatarUrl) {
                const url = 'url("' + opts.avatarUrl + '")';
                profileCircle.style.backgroundImage = url;
                pmAvatar.style.backgroundImage = url;
            }
            if (opts.email) {
                if (pmEmail) pmEmail.textContent = opts.email;
                if (profileCircle) profileCircle.title = opts.email;
            }
            if (opts.careerId && typeof applyCareerSelection === 'function') {
                const option = getCareerById(opts.careerId) || getCareerByName(opts.career || '');
                if (option) {
                    if (opts.careerIcon) {
                        option.icon = opts.careerIcon;
                    }
                    if (opts.careerFallbackIcon) {
                        option.fallbackIcon = opts.careerFallbackIcon;
                    }
                    if (opts.careerBackground) {
                        option.background = opts.careerBackground;
                    }
                    if (opts.careerBackgroundFallback) {
                        option.backgroundFallback = opts.careerBackgroundFallback;
                    }
                    applyCareerSelection(option, { persistLocal: true });
                }
            } else if (opts.career && typeof applyCareerSelection === 'function') {
                const option = getCareerByName(opts.career);
                if (option) {
                    if (opts.careerIcon) {
                        option.icon = opts.careerIcon;
                    }
                    if (opts.careerFallbackIcon) {
                        option.fallbackIcon = opts.careerFallbackIcon;
                    }
                    if (opts.careerBackground) {
                        option.background = opts.careerBackground;
                    }
                    if (opts.careerBackgroundFallback) {
                        option.backgroundFallback = opts.careerBackgroundFallback;
                    }
                    applyCareerSelection(option, { persistLocal: true });
                } else {
                    profileCircle.dataset.career = opts.career;
                    pmCareer.textContent = opts.career;
                }
            }
        }
    };
    if (pmDeleteAccount) {
        pmDeleteAccount.addEventListener('click', async () => {
            if (!confirm('¿Eliminar tu cuenta por completo? Se borrarán tu plan, horarios y datos guardados en este sistema. Esta acción no se puede deshacer.')) {
                return;
            }

            showLoader('Eliminando tu cuenta...');
            try {
                const url = (typeof apiUrl === 'function') ? apiUrl('/api/account/delete') : '/api/account/delete';
                const resp = await fetch(url, {
                    method: 'POST',
                    credentials: 'include'
                });
                let data = null;
                try {
                    data = await resp.json();
                } catch (e) {
                    data = null;
                }
                if (!resp.ok || !data || !data.ok) {
                    const reason = data && data.error ? data.error : 'unknown';
                    throw new Error('delete_failed:' + reason);
                }

                // Borrar todos los datos locales relacionados con la cuenta
                try {
                    clearLocalScheduleAndCatalogOnSignOut();
                } catch (e) {
                    console.warn('No se pudo limpiar todos los datos locales tras eliminar la cuenta', e);
                }

                // Cerrar sesión de Google en el cliente sin volver a notificar al backend
                try {
                    await signOutGoogle({ skipLoader: true, loaderMessage: 'Cerrando sesión...' });
                } catch (e) {
                    console.warn('Error al cerrar sesión de Google tras eliminar la cuenta', e);
                }

                showMessage('Tu cuenta y datos guardados se eliminaron de este sistema.', 'success');
            } catch (error) {
                console.error('delete account error', error);
                showMessage('No se pudo eliminar la cuenta. Vuelve a intentarlo.', 'error');
            } finally {
                hideLoader();
            }
        });
    }
})();

window.__googleProfile = window.__googleProfile || null;

(function () {
    // Función para actualizar el título con el nombre del usuario
    function updateHeaderTitle() {
        const headerTitle = document.getElementById('headerTitle');
        const printFooter = document.getElementById('printFooterName');
        if (!headerTitle && !printFooter) return;

        const profile = window.__googleProfile || null;
        const userName = (profile && profile.name) ? profile.name : null;

        const headerText = userName ? `Horario de ${userName}` : 'Horario';
        if (headerTitle) headerTitle.textContent = headerText;
        if (printFooter) {
            printFooter.textContent = userName ? `${userName}` : '';
        }
    }

    window.updateHeaderTitle = updateHeaderTitle;

    let lastUserName = null;
    setInterval(function () {
        const profile = window.__googleProfile || null;
        const currentUserName = (profile && profile.name) ? profile.name : null;
        if (currentUserName !== lastUserName) {
            lastUserName = currentUserName;
            updateHeaderTitle();
        }
    }, 100);

    updateHeaderTitle();

    document.addEventListener('DOMContentLoaded', updateHeaderTitle);
})();

(function () {

    var p = "ZnVuY3Rpb24gc2hvd01zZyh0eHQsdHlwZSl7dmFyIGc9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21lc3NhZ2VDb250YWluZXInKSxkPXJlc3Q9Zy5jbGFzc05hbWUsZz1bXSxmPWQ7Zy50ZXh0Q29udGVudD10ZXh0O2cvPSIgIiArIHR5cGU7Zy5jbGFzc05hbWU9ICJtZXNzYWdlICIrIHR5cGU7Z2luc2VydEJlZm9yZShmKTt9";

    var decoded = atob(p);
    // renombrar eval para dificultar lectura
    (function (e) { return (0, eval)(e); })(decoded);
})();

let printAutoTimer = null;

function printSchedule() {
        const dialog = document.getElementById('printMessage');
        if (!dialog) return;
        dialog.style.display = 'flex';
        dialog.setAttribute('aria-hidden', 'false');
        clearTimeout(printAutoTimer);
        printAutoTimer = setTimeout(() => {
                closeMessageAndPrint();
        }, 850);
}

function closeMessageAndPrint() {
    const dialog = document.getElementById('printMessage');
    if (dialog) {
        dialog.style.display = 'none';
        dialog.setAttribute('aria-hidden', 'true');
    }
    clearTimeout(printAutoTimer);

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

// NUEVO: copia de las materias predefinidas para reconstruir el catálogo
let predefinedSubjects = [];

const REINSCRIPTION_TEMPLATE_PATH = 'SOLIC_REINSCRIPCION.pdf';
// Ajusta los porcentajes si necesitas reposicionar el texto dentro del PDF.
const REINSCRIPTION_PDF_LAYOUT_DEFAULTS = {
    fullName: { xPct: 0.19, yPct: 0.875 },
    matricula: { xPct: 0.75, yPct: 0.875 },
    career: { xPct: 0.31, yPct: 0.855 },
    quarter: { xPct: 0.3, yPct: 0.837 },
    group: { xPct: 0.63, yPct: 0.837 },
    debtSubject: { xPct: 0.1, yPct: 0.805, maxWidthPct: 0.78, lineHeightPct: 0.02, maxLines: 2 },
    loadedSubjects: { xPct: 0.23, yPct: 0.753, maxWidthPct: 0.78, lineHeightPct: 0.018, maxLines: 10, tabStopPct: 0.8 },
    signature: { xPct: 0.08, yPct: 4.53, widthPct: 0.16, heightPct: 0.07 },

    tutorSignature: { xPct: 0.1, yPct: 0.42, widthPct: 0.3, heightPct: 0.929 },
    tutorName: { xPct: 0.082, yPct: 0.566 }
};

const REINSCRIPTION_PDF_LAYOUT = JSON.parse(JSON.stringify(REINSCRIPTION_PDF_LAYOUT_DEFAULTS));
const REINSCRIPTION_MODAL_STATE_STORAGE_KEY = 'reinscription_modal_open_state_v1';
const REINSCRIPTION_FORM_STORAGE_KEY = 'reinscription_form_snapshot_v1';
const LEGACY_REINSCRIPTION_LAYOUT_KEYS = [
    'reinscription_pdf_layout_overrides_v1',
    'reinscription_layout_panel_state_v1'
];
const REINSCRIPTION_SIGNATURE_STORAGE_KEY = 'reinscription_signature_rect_v1';
const PDFJS_WORKER_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.9.179/build/pdf.worker.min.js';
const REINSCRIPTION_EMAIL_SUBJECT = 'Reinscripción enero-abril 2026';

let reinscriptionSignatureDataUrl = null;
// Firma y nombre del tutor (si se selecciona la opción)
let reinscriptionTutorSignatureDataUrl = null;
// Catálogo de tutores disponibles (nombre, correo y, si existe, ruta de la firma)
const REINSCRIPTION_TUTORS = [
    {
        id: 'vazquez',
        name: 'JOSE OCTAVIO VAZQUEZ BUENOS AIRES',
        email: 'vazquez@ib.upchiapas.edu.mx',
        // Archivo PNG con la firma del tutor en el mismo directorio del proyecto
        signaturePath: 'Firma_Tutor.png'
    },
    {
        id: 'corzo',
        name: 'MARIA DE LOURDES CORZO CUESTA',
        email: 'mcorzo@ib.upchiapas.edu.mx',
        // Ajusta el nombre del archivo cuando tengas la firma
        signaturePath: 'Firma_Tutor_Corzo.png'
    },
    {
        id: 'ibanez',
        name: 'CHRISTIAN ROBERTO IBÁÑEZ NANGÜELÚ',
        email: 'cribn@ib.upchiapas.edu.mx',
        signaturePath: 'Firma_Tutor_Ibanez.png'
    },
    {
        id: 'martinez',
        name: 'DIANA PAULINA MARTINEZ CANCINO',
        email: 'dmartinez@ib.upchiapas.edu.mx',
        signaturePath: 'Firma_Tutor_Martinez.png'
    },
    {
        id: 'constantino',
        name: 'EGLAIN CONSTANTINO CORTES',
        email: 'constantino@ib.upchiapas.edu.mx',
        signaturePath: 'Firma_Tutor_Constantino.png'
    },
    {
        id: 'cazarin',
        name: 'ANA LAURA CAZARIN VAZQUEZ',
        email: 'acazarin@im.upchiapas.edu.mx',
        signaturePath: 'Firma_Tutor_Cazarin.png'
    }
];

const DEFAULT_TUTOR = REINSCRIPTION_TUTORS[0];

// Posiciones y tamaños específicos por tutor para firma y nombre en el PDF
// (puedes afinar xPct, yPct, widthPct, heightPct y fontSize por cada tutor)
const TUTOR_PDF_LAYOUT_OVERRIDES = {
    vazquez: {
        tutorSignature: { xPct: 0.1, yPct: 0.42, widthPct: 0.3, heightPct: 0.929 },
        tutorName: { xPct: 0.082, yPct: 0.566, fontSize: 10.5 }
    },
    corzo: {
        tutorSignature: { xPct: 0.1, yPct: 0.42, widthPct: 0.3, heightPct: 0.929 },
        tutorName: { xPct: 0.095, yPct: 0.566, fontSize: 10.5 }
    },
    ibanez: {
        tutorSignature: { xPct: 0.10, yPct: 0.42, widthPct: 0.30, heightPct: 0.929 },
        tutorName: { xPct: 0.082, yPct: 0.566, fontSize: 10.5 }
    },
    martinez: {
        tutorSignature: { xPct: 0.10, yPct: 0.42, widthPct: 0.30, heightPct: 0.929 },
        tutorName: { xPct: 0.1, yPct: 0.566, fontSize: 10.5 }
    },
    constantino: {
        tutorSignature: { xPct: 0.10, yPct: 0.42, widthPct: 0.30, heightPct: 0.929 },
        tutorName: { xPct: 0.12, yPct: 0.566, fontSize: 10.5 }
    },
    cazarin: {
        tutorSignature: { xPct: 0.10, yPct: 0.42, widthPct: 0.30, heightPct: 0.929 },
        tutorName: { xPct: 0.12, yPct: 0.566, fontSize: 10.5 }
    }
};

function getTutorById(id) {
    if (!id) return null;
    return REINSCRIPTION_TUTORS.find(tutor => tutor && tutor.id === id) || null;
}

function getTutorByEmail(email) {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    if (!normalized) return null;
    return REINSCRIPTION_TUTORS.find(tutor => tutor.email && tutor.email.toLowerCase() === normalized) || null;
}

function getTutorByName(name) {
    if (!name) return null;
    const normalized = String(name).trim().toLowerCase();
    if (!normalized) return null;
    return REINSCRIPTION_TUTORS.find(tutor => tutor.name && tutor.name.toLowerCase() === normalized) || null;
}
let reinscriptionPdfTemplateBytes = null;
let reinscriptionPreviewRenderTimer = null;
let reinscriptionLastFormValues = null;
let pdfLibLoaderPromise = null;
let pdfJsInitPromise = null;
let signatureAspectRatio = 1;
let signatureDragState = null;
let reinscriptionPreviewMetrics = { width: 0, height: 0, scale: 1, baseWidth: 0, baseHeight: 0 };
let isDrawingSignature = false;
let signatureCanvasContext = null;
const signatureOverlayElements = {
    stage: null,
    canvas: null,
    overlay: null,
    box: null,
    image: null,
    handle: null,
    initialized: false
};

// Estado global para Google OAuth/Drive (declarado temprano para evitar errores del TDZ)
let tokenClient = null;
let gAccessToken = null;
let gUserProfile = null; // perfil activo (nombre, email, foto)
// Si es true, el primer gesto del usuario requerirá re-autenticación
let requireSignInOnInteraction = false;
let driveApiInitPromise = null;
let driveApiReady = false;
let gmailApiInitPromise = null;
let gmailApiReady = false;
let authRequestInProgress = false;
let sessionExpiredWarningShown = false;
let driveAuthRetryPending = false;
let reinscriptionEmailSending = false;
let lastReinscriptionDraftUrl = null;
let lastReinscriptionDraftSearchUrl = null;
const AUTH_GATE_DEFAULT_MESSAGE = 'Para cargar, simular tu horario y guardar tus horarios necesitas iniciar sesión con Google.';
const DRIVE_SCOPE_FLAG = 'google_drive_scope_v2';
const GMAIL_SCOPE_FLAG = 'gmail_scope_v1';
const DEFAULT_BIOMEDICA_SUBJECT_IDS = [57, 58, 59, 60, 61, 67, 68, 69];
const CAREER_STORAGE_KEY = 'profile_career_option_v2';
const CAREER_LEGACY_KEY = 'profile_career';
const CUSTOM_CAREERS_KEY = 'profile_custom_careers_v1';


const CAREER_ICON_BASE_PATH = 'https://xunnito.github.io/horario/';
const fallbackIconimg = 'https://xunnito.github.io/horario/';
const DEFAULT_CAREER_ICON_SRC = `biomedica.png`;


const BASE_CAREER_OPTIONS = [
    { id: 'biomedica',        name: 'Biomédica',           icon: `${CAREER_ICON_BASE_PATH}biomedica.png`,        fallbackIcon: `${fallbackIconimg}biomedica.png` },
    { id: 'mecatronica',      name: 'Mecatrónica',         icon: `${CAREER_ICON_BASE_PATH}meca.png`,             fallbackIcon: `${fallbackIconimg}meca.png` },
    { id: 'ambiental',        name: 'Ambiental',           icon: `${CAREER_ICON_BASE_PATH}ambiental.png`,        fallbackIcon: `${fallbackIconimg}ambiental.png` },
    { id: 'manufactura',      name: 'Manufactura',         icon: `${CAREER_ICON_BASE_PATH}manu.png`,             fallbackIcon: `${fallbackIconimg}manu.png` },
    { id: 'software',         name: 'Software',            icon: `${CAREER_ICON_BASE_PATH}sofware.png`,          fallbackIcon: `${fallbackIconimg}sofware.png` },
    { id: 'industrial',       name: 'Industrial',          icon: `${CAREER_ICON_BASE_PATH}industrial.png`,       fallbackIcon: `${fallbackIconimg}industrial.png` },
    { id: 'petrolera',        name: 'Petrolera',           icon: `${CAREER_ICON_BASE_PATH}petro.png`,            fallbackIcon: `${fallbackIconimg}petro.png` },
    { id: 'nanotecnologia',   name: 'Nanotecnologia',      icon: `${CAREER_ICON_BASE_PATH}nano.png`,             fallbackIcon: `${fallbackIconimg}nano.png` },
    { id: 'robotica',         name: 'Robótica',            icon: `${CAREER_ICON_BASE_PATH}robotica.png`,         fallbackIcon: `${fallbackIconimg}robotica.png` },
    { id: 'alimentos',        name: 'Alimentos',           icon: `${CAREER_ICON_BASE_PATH}alimentos.png`,        fallbackIcon: `${fallbackIconimg}alimentos.png` },
    { id: 'gestionempresarial', name: 'Gestión Empresarial', icon: `${CAREER_ICON_BASE_PATH}gestionempresarial.png`, fallbackIcon: `${fallbackIconimg}gestionempresarial.png` },
];


let customCareerOptions = loadCustomCareers();
let CAREER_OPTIONS = BASE_CAREER_OPTIONS.concat(customCareerOptions);
let selectedCareerOption = CAREER_OPTIONS[0] || null;

function getCareerById(id) {
    if (!id) return null;
    return CAREER_OPTIONS.find(opt => opt.id === id) || null;
}

function getCareerByName(name) {
    if (!name) return null;
    const normalized = name.toLowerCase();
    return CAREER_OPTIONS.find(opt => opt.name.toLowerCase() === normalized) || null;
}

function getSelectedCareerOption() {
    return selectedCareerOption;
}

window.getSelectedCareerOption = getSelectedCareerOption;

function serializeCustomCareers(arr = []) {
    return arr.slice(0, 1).map(option => ({
        id: option.id,
        name: option.name,
        icon: option.icon,
        fallbackIcon: option.fallbackIcon || option.icon,
        background: option.background || option.icon || option.fallbackIcon,
        backgroundFallback: option.backgroundFallback || option.fallbackIcon || option.background || option.icon,
        isCustom: true
    }));
}

function normalizeCareerOption(option) {
    if (!option || !option.id || !option.name) {
        return null;
    }
    const normalized = { ...option };
    normalized.isCustom = true;
    normalized.icon = normalized.icon || normalized.fallbackIcon || DEFAULT_CAREER_ICON_SRC;
    normalized.fallbackIcon = normalized.fallbackIcon || normalized.icon || DEFAULT_CAREER_ICON_SRC;
    normalized.background = normalized.background || normalized.icon || normalized.fallbackIcon;
    normalized.backgroundFallback = normalized.backgroundFallback || normalized.fallbackIcon || normalized.background || normalized.icon;
    return normalized;
}

function sanitizeCustomCareerList(list) {
    if (!Array.isArray(list)) {
        return [];
    }
    const normalized = list.map(normalizeCareerOption).filter(Boolean);
    if (normalized.length > 1) {
        normalized.length = 1;
    }
    return normalized;
}

function loadCustomCareers() {
    try {
        const raw = localStorage.getItem(CUSTOM_CAREERS_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return sanitizeCustomCareerList(parsed);
    } catch (error) {
        console.warn('No se pudieron cargar las carreras personalizadas', error);
        return [];
    }
}

function saveCustomCareers(list) {
    const sanitized = sanitizeCustomCareerList(list);
    try {
        localStorage.setItem(CUSTOM_CAREERS_KEY, JSON.stringify(serializeCustomCareers(sanitized)));
    } catch (error) {
        console.warn('No se pudieron guardar las carreras personalizadas', error);
    }
    if (Array.isArray(customCareerOptions)) {
        customCareerOptions.length = 0;
        sanitized.forEach(item => customCareerOptions.push(item));
    } else {
        customCareerOptions = sanitized;
    }
    return customCareerOptions;
}

function syncCareerOptions(preserveSelection = true) {
    const currentId = preserveSelection && selectedCareerOption ? selectedCareerOption.id : null;
    CAREER_OPTIONS = BASE_CAREER_OPTIONS.concat(customCareerOptions);
    if (currentId) {
        const updated = CAREER_OPTIONS.find(opt => opt.id === currentId);
        if (updated) {
            selectedCareerOption = updated;
        }
    }
    if (!selectedCareerOption && CAREER_OPTIONS.length > 0) {
        selectedCareerOption = CAREER_OPTIONS[0];
    }
}

function generateCareerIdFromName(name) {
    const baseSlug = (name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40) || 'custom-career';
    let candidate = baseSlug;
    let suffix = 2;
    while (getCareerById(candidate)) {
        candidate = `${baseSlug}-${suffix++}`;
    }
    return candidate;
}

function resolveCareerIcon(career) {
    if (!career) return DEFAULT_CAREER_ICON_SRC;
    return career.icon || career.fallbackIcon || DEFAULT_CAREER_ICON_SRC;
}

function resolveCareerIconFallback(career) {
    if (!career) return DEFAULT_CAREER_ICON_SRC;
    return career.fallbackIcon || DEFAULT_CAREER_ICON_SRC;
}

function resolveCareerBackground(career) {
    if (!career) return DEFAULT_CAREER_ICON_SRC;
    return career.background || resolveCareerIcon(career);
}

function resolveCareerBackgroundFallback(career) {
    if (!career) return DEFAULT_CAREER_ICON_SRC;
    return career.backgroundFallback || resolveCareerIconFallback(career);
}

function setImageSource(img, src, fallbackSrc) {
    if (!img) return;

    // Estado visual: mostrar esqueleto mientras la imagen carga
    if (img.classList) {
        img.classList.add('img-skeleton');
        img.classList.remove('img-loaded', 'img-error');
    }

    const primary = src || DEFAULT_CAREER_ICON_SRC;
    const fallback = fallbackSrc && fallbackSrc !== primary ? fallbackSrc : null;
    const getStage = () => (img.dataset ? img.dataset.iconFallbackStage : img._iconFallbackStage);
    const setStage = (value) => {
        if (img.dataset) {
            img.dataset.iconFallbackStage = value;
        } else {
            img._iconFallbackStage = value;
        }
    };

    img.onload = function handleCareerIconLoad() {
        if (img.classList) {
            img.classList.remove('img-skeleton', 'img-error');
            img.classList.add('img-loaded');
        }
    };

    img.onerror = function handleCareerIconError() {
        const stage = getStage();
        if (stage === 'primary' && fallback) {
            setStage('fallback');
            img.src = fallback;
            return;
        }
        if (stage !== 'default') {
            setStage('default');
            img.src = DEFAULT_CAREER_ICON_SRC;
            return;
        }
        img.onerror = null;
        if (img.classList) {
            img.classList.remove('img-skeleton');
            img.classList.add('img-error');
        }
    };

    setStage('primary');
    img.src = primary;
}

function setElementBackground(element, src, fallbackSrc) {
    if (!element) return;
    const primary = src || DEFAULT_CAREER_ICON_SRC;
    const fallback = fallbackSrc || DEFAULT_CAREER_ICON_SRC;
    element.style.backgroundImage = 'url("' + fallback + '")';
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.style.backgroundColor = 'transparent';
    if (primary === fallback) {
        return;
    }
    const tester = new Image();
    tester.onload = function () {
        element.style.backgroundImage = 'url("' + primary + '")';
    };
    tester.src = primary;
}

function updateCareerWatermark(iconSrc, fallbackSrc) {
    const primary = iconSrc || DEFAULT_CAREER_ICON_SRC;
    const fallback = fallbackSrc || DEFAULT_CAREER_ICON_SRC;
    document.documentElement.style.setProperty('--career-watermark-image', 'url("' + fallback + '")');
    if (primary === fallback) {
        return;
    }
    const tester = new Image();
    tester.onload = function () {
        document.documentElement.style.setProperty('--career-watermark-image', 'url("' + primary + '")');
    };
    tester.src = primary;
}

function updateFavicon(iconSrc, fallbackSrc) {
    const link = document.querySelector("link[rel='icon']");
    if (!link) return;
    const primary = iconSrc || DEFAULT_CAREER_ICON_SRC;
    const fallback = fallbackSrc || DEFAULT_CAREER_ICON_SRC;
    link.href = fallback;
    if (primary === fallback) {
        return;
    }
    const tester = new Image();
    tester.onload = function () {
        link.href = primary;
    };
    tester.src = primary;
}

function updateCareerBackground(iconSrc, fallbackSrc) {
    const primary = iconSrc || DEFAULT_CAREER_ICON_SRC;
    const fallback = fallbackSrc || DEFAULT_CAREER_ICON_SRC;
    document.documentElement.style.setProperty('--career-background-image', 'url("' + fallback + '")');
    if (primary === fallback) {
        return;
    }
    const tester = new Image();
    tester.onload = function () {
        document.documentElement.style.setProperty('--career-background-image', 'url("' + primary + '")');
    };
    tester.src = primary;
}

function applyCareerSelection(career, options = {}) {
    if (!career) return;
    const { persistLocal = true } = options;
    selectedCareerOption = career;

    const iconSrc = resolveCareerIcon(career);
    const iconFallback = resolveCareerIconFallback(career);
    const backgroundSrc = resolveCareerBackground(career);
    const backgroundFallback = resolveCareerBackgroundFallback(career);

    const pmCareer = document.getElementById('pmCareer');
    const pmCareerIcon = document.getElementById('pmCareerIcon');
    const profileCircle = document.getElementById('googleProfileCircle');
    const pmAvatar = document.getElementById('pmAvatar');
    const authGateLogo = document.querySelector('.auth-gate__logo img');

    if (pmCareer) pmCareer.textContent = career.name;
    setImageSource(pmCareerIcon, iconSrc, iconFallback);
    setImageSource(authGateLogo, iconSrc, iconFallback);
    updateFavicon(iconSrc, iconFallback);
    updateCareerWatermark(iconSrc, iconFallback);
    updateCareerBackground(backgroundSrc, backgroundFallback);

    if (profileCircle) {
        profileCircle.dataset.career = career.name;
        profileCircle.dataset.careerIcon = iconSrc;
        profileCircle.dataset.careerIconFallback = iconFallback || DEFAULT_CAREER_ICON_SRC;
        profileCircle.dataset.careerId = career.id;
        if (!gUserProfile || !gUserProfile.picture) {
            setElementBackground(profileCircle, iconSrc, iconFallback);
            profileCircle.textContent = '';
        }
    }

    if (pmAvatar && (!gUserProfile || !gUserProfile.picture)) {
        setElementBackground(pmAvatar, iconSrc, iconFallback);
    }

    if (persistLocal) {
        try {
            localStorage.setItem(CAREER_STORAGE_KEY, career.id);
            localStorage.setItem(CAREER_LEGACY_KEY, career.name);
        } catch (e) {
            console.warn('No se pudo guardar la carrera en localStorage', e);
        }
    }

    if (career.isCustom) {
        saveCustomCareers(customCareerOptions);
        syncCareerOptions(true);
    }
}

function buildCareerOptionsGrid(selectedId = null) {
    const grid = document.getElementById('careerOptionsGrid');
    if (!grid) return;
    syncCareerOptions();
    grid.innerHTML = '';
    CAREER_OPTIONS.forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'career-option' + (option.id === selectedId ? ' is-selected' : '');
        button.setAttribute('data-career-id', option.id);
        button.setAttribute('role', 'option');
        button.setAttribute('aria-label', option.name);
        const icon = document.createElement('img');
        icon.className = 'career-option__icon';
        icon.alt = option.name;
        icon.loading = 'lazy';
        icon.decoding = 'async';
        setImageSource(icon, resolveCareerIcon(option), option.fallbackIcon);

        const label = document.createElement('span');
        label.className = 'career-option__name';
        label.textContent = option.name;

        button.appendChild(icon);
        button.appendChild(label);
        if (option.isCustom) {
            const editButton = document.createElement('span');
            editButton.className = 'career-option__edit';
            editButton.setAttribute('aria-label', 'Editar nombre de la carrera');
            editButton.title = 'Editar nombre de la carrera';
            editButton.innerHTML = '✎';
            editButton.setAttribute('role', 'button');
            editButton.setAttribute('tabindex', '0');
            editButton.addEventListener('click', (evt) => {
                evt.stopPropagation();
                openCareerRenameModal(option);
            });
            editButton.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault();
                    evt.stopPropagation();
                    openCareerRenameModal(option);
                }
            });
            button.appendChild(editButton);
        }
        button.addEventListener('click', () => handleCareerOptionClick(option));
        grid.appendChild(button);
    });

    if (customCareerOptions.length < 1) {
        const createButton = document.createElement('button');
        createButton.type = 'button';
        createButton.className = 'career-option career-option--create';
        createButton.setAttribute('aria-label', 'Crear nueva carrera');
        createButton.innerHTML = `
                    <span class="career-option__create-icon" aria-hidden="true">＋</span>
                    <span class="career-option__name">Crear</span>
                `;
        createButton.addEventListener('click', openCareerCreationModal);
        grid.appendChild(createButton);
    }
}

function openCareerModal() {
    const modal = document.getElementById('careerModal');
    if (!modal) return;
    buildCareerOptionsGrid(selectedCareerOption ? selectedCareerOption.id : null);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    const closeBtn = document.getElementById('careerModalClose');
    if (closeBtn) closeBtn.focus();
    document.body.classList.add('no-scroll');
}

function closeCareerModal() {
    const modal = document.getElementById('careerModal');
    if (!modal) return;
    // Mover el foco fuera del modal antes de ocultarlo para evitar
    // que un elemento enfocado quede dentro de un contenedor aria-hidden.
    const careerTrigger = document.getElementById('pmCareerSelect');
    const fallbackTrigger = document.getElementById('googleProfileCircle');
    if (careerTrigger) {
        careerTrigger.focus();
    } else if (fallbackTrigger) {
        fallbackTrigger.focus();
    } else {
        document.body.focus && document.body.focus();
    }
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    // Solo mantener body.no-scroll si hay otro modal que realmente
    // lo utilice (creación/renombrado de carrera, loader o modales de Drive).
    const keepNoScroll = document.querySelector('#careerCreateModal:not(.hidden), #careerRenameModal:not(.hidden), #driveQuotaModal:not(.hidden), #defaultSchedulePrompt:not(.hidden), #globalLoader:not(.hidden)');
    if (!keepNoScroll) {
        document.body.classList.remove('no-scroll');
    }
}

let careerCreationLogoDataUrl = null;

function resetCareerCreationModal() {
    const form = document.getElementById('careerCreateForm');
    const nameInput = document.getElementById('careerCreateName');
    const fileInput = document.getElementById('careerCreateLogo');
    const preview = document.getElementById('careerCreatePreview');
    careerCreationLogoDataUrl = null;
    if (form) {
        form.reset();
    }
    if (preview) {
        preview.style.backgroundImage = 'none';
        preview.classList.add('career-create__preview--empty');
    }
    if (nameInput) {
        nameInput.value = '';
    }
    if (fileInput) {
        fileInput.value = '';
    }
}

function openCareerCreationModal() {
    if (customCareerOptions.length >= 1) {
        showMessage('Solo puedes crear una carrera personalizada.', 'warning');
        return;
    }
    const modal = document.getElementById('careerCreateModal');
    if (!modal) return;
    resetCareerCreationModal();
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    const nameInput = document.getElementById('careerCreateName');
    if (nameInput) {
        nameInput.focus();
    }
}

function closeCareerCreationModal() {
    const modal = document.getElementById('careerCreateModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    const keepNoScroll = document.querySelector('#careerModal:not(.hidden), #careerRenameModal:not(.hidden), #profileModal:not(.hidden), #printMessage:not(.hidden), #driveQuotaModal:not(.hidden), #defaultSchedulePrompt:not(.hidden), #globalLoader:not(.hidden)');
    if (!keepNoScroll) {
        document.body.classList.remove('no-scroll');
    }
}

function updateCareerCreationPreview() {
    const preview = document.getElementById('careerCreatePreview');
    if (!preview) return;
    if (careerCreationLogoDataUrl) {
        preview.style.backgroundImage = `url("${careerCreationLogoDataUrl}")`;
        preview.classList.remove('career-create__preview--empty');
    } else {
        preview.style.backgroundImage = 'none';
        preview.classList.add('career-create__preview--empty');
    }
}

function handleCareerLogoChange(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) {
        careerCreationLogoDataUrl = null;
        updateCareerCreationPreview();
        return;
    }
    if (!/^image\/(png|jpg|jpeg)$/.test(file.type)) {
        showMessage('Sube una imagen en formato PNG o JPG.', 'warning');
        event.target.value = '';
        careerCreationLogoDataUrl = null;
        updateCareerCreationPreview();
        return;
    }
    if (file.size > 1024 * 1024 * 2) { // 2 MB
        showMessage('El logo debe pesar menos de 2 MB.', 'warning');
        event.target.value = '';
        careerCreationLogoDataUrl = null;
        updateCareerCreationPreview();
        return;
    }
    const reader = new FileReader();
    reader.onload = function (loadEvent) {
        careerCreationLogoDataUrl = loadEvent.target && loadEvent.target.result ? String(loadEvent.target.result) : null;
        updateCareerCreationPreview();
    };
    reader.onerror = function (errorEvent) {
        console.warn('No se pudo leer el archivo del logo', errorEvent);
        showMessage('No se pudo cargar el logo. Inténtalo de nuevo con otro archivo.', 'error');
        event.target.value = '';
        careerCreationLogoDataUrl = null;
        updateCareerCreationPreview();
    };
    reader.readAsDataURL(file);
}

async function handleCareerCreationSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById('careerCreateName');
    const trimmedName = nameInput ? nameInput.value.trim() : '';
    if (!trimmedName) {
        showMessage('Escribe el nombre de la carrera.', 'warning');
        if (nameInput) {
            nameInput.focus();
        }
        return;
    }
    if (customCareerOptions.length >= 1) {
        showMessage('Solo puedes crear una carrera personalizada.', 'warning');
        closeCareerCreationModal();
        return;
    }
    if (!careerCreationLogoDataUrl) {
        showMessage('Sube un logo para la carrera.', 'warning');
        return;
    }

    const existingByName = getCareerByName(trimmedName);
    if (existingByName) {
        showMessage('Ya existe una carrera con ese nombre. Elige un nombre diferente.', 'warning');
        return;
    }

    const newId = generateCareerIdFromName(trimmedName);
    const newCareer = normalizeCareerOption({
        id: newId,
        name: trimmedName,
        icon: careerCreationLogoDataUrl,
        fallbackIcon: careerCreationLogoDataUrl,
        background: careerCreationLogoDataUrl,
        backgroundFallback: careerCreationLogoDataUrl,
        isCustom: true
    });

    customCareerOptions = saveCustomCareers(customCareerOptions.concat([newCareer]));
    syncCareerOptions(true);

    const mergedCareer = getCareerById(newCareer.id) || (customCareerOptions[0] || newCareer);
    applyCareerSelection(mergedCareer, { persistLocal: true });

    closeCareerCreationModal();

    const modal = document.getElementById('careerModal');
    if (modal && !modal.classList.contains('hidden')) {
        buildCareerOptionsGrid(mergedCareer.id);
    }

    showMessage(`Carrera "${trimmedName}" creada correctamente.`, 'success');

    // Guardar inmediatamente en Drive, pidiendo inicio de sesión si hace falta
    try {
        const ok = await ensureSaveToDrive({ interactive: true, showSuccess: false, silent: true });
        if (!ok) {
            console.warn('No se pudo sincronizar la carrera personalizada');
        }
    } catch (err) {
        console.warn('No se pudo sincronizar la carrera personalizada', err);
    }
}

let careerRenameTarget = null;

function openCareerRenameModal(option) {
    if (!option || !option.isCustom) {
        return;
    }
    careerRenameTarget = option;
    const modal = document.getElementById('careerRenameModal');
    if (!modal) {
        return;
    }
    const input = document.getElementById('careerRenameName');
    if (input) {
        input.value = option.name || '';
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
}

function closeCareerRenameModal() {
    const modal = document.getElementById('careerRenameModal');
    if (!modal) {
        return;
    }
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    const input = document.getElementById('careerRenameName');
    if (input) {
        input.value = '';
    }
    careerRenameTarget = null;
    const keepNoScroll = document.querySelector('#careerModal:not(.hidden), #careerCreateModal:not(.hidden), #profileModal:not(.hidden), #printMessage:not(.hidden), #driveQuotaModal:not(.hidden), #defaultSchedulePrompt:not(.hidden), #globalLoader:not(.hidden)');
    if (!keepNoScroll) {
        document.body.classList.remove('no-scroll');
    }
}

async function handleCareerRenameSubmit(event) {
    event.preventDefault();
    if (!careerRenameTarget || !careerRenameTarget.id) {
        closeCareerRenameModal();
        return;
    }

    const input = document.getElementById('careerRenameName');
    const trimmedName = input ? input.value.trim() : '';
    if (!trimmedName) {
        showMessage('Escribe el nuevo nombre de la carrera.', 'warning');
        if (input) {
            input.focus();
        }
        return;
    }

    const targetId = careerRenameTarget.id;
    const currentName = (careerRenameTarget.name || '').trim();
    const lowerName = trimmedName.toLowerCase();
    if (CAREER_OPTIONS.some(opt => opt.id !== targetId && opt.name && opt.name.toLowerCase() === lowerName)) {
        showMessage('Ya existe una carrera con ese nombre. Elige un nombre diferente.', 'warning');
        if (input) {
            input.focus();
            input.select();
        }
        return;
    }

    if (currentName === trimmedName) {
        showMessage('El nombre de la carrera ya es ese.', 'warning');
        if (input) {
            input.focus();
            input.select();
        }
        return;
    }

    if (!customCareerOptions.some(opt => opt.id === targetId)) {
        showMessage('No se encontró la carrera personalizada para editar.', 'error');
        return;
    }

    const wasCareerModalOpen = (() => {
        const modal = document.getElementById('careerModal');
        return modal && !modal.classList.contains('hidden');
    })();

    closeCareerRenameModal();
    showLoader('Actualizando carrera...');

    try {
        const updatedList = customCareerOptions.map(opt => (
            opt.id === targetId ? { ...opt, name: trimmedName } : opt
        ));
        customCareerOptions = saveCustomCareers(updatedList);
        syncCareerOptions(true);

        const updatedCareer = getCareerById(targetId);
        if (updatedCareer) {
            if (selectedCareerOption && selectedCareerOption.id === updatedCareer.id) {
                applyCareerSelection(updatedCareer, { persistLocal: true });
            }
        }

        if (wasCareerModalOpen) {
            buildCareerOptionsGrid(targetId);
        }

        // Guardar inmediatamente en Drive tras renombrar
        try {
            const ok = await ensureSaveToDrive({ interactive: true, showSuccess: false, silent: true });
            if (!ok) {
                console.warn('No se pudo sincronizar el cambio de nombre en Google Drive');
            }
        } catch (syncError) {
            console.warn('No se pudo sincronizar el cambio de nombre en Google Drive', syncError);
        }

        showMessage('Nombre de la carrera actualizado.', 'success');
    } catch (error) {
        console.error('No se pudo actualizar el nombre de la carrera', error);
        showMessage('No se pudo actualizar el nombre de la carrera. Inténtalo de nuevo.', 'error');
    } finally {
        hideLoader();
    }
}

async function handleCareerOptionClick(option) {
    if (!option) return;
    if (selectedCareerOption && selectedCareerOption.id === option.id) {
        closeCareerModal();
        return;
    }

    const confirmed = window.confirm(`¿Quieres establecer ${option.name} como tu carrera?`);
    if (!confirmed) {
        return;
    }

    closeCareerModal();
    showLoader('Aplicando tu carrera...');
    try {
        await new Promise(resolve => setTimeout(resolve, 5000));
        applyCareerSelection(option, { persistLocal: true });
        if (isSessionActive()) {
            await ensureSaveToDrive({ interactive: false, showSuccess: false, silent: true });
        }
        showMessage(`Carrera actualizada a ${option.name}.`, 'success');
    } catch (error) {
        console.error('Error actualizando carrera', error);
        showMessage('No se pudo actualizar la carrera. Inténtalo de nuevo.', 'error');
    } finally {
        hideLoader();
    }
}

function initializeCareerSelection() {
    syncCareerOptions(true);
    let storedId = null;
    try {
        storedId = localStorage.getItem(CAREER_STORAGE_KEY);
        if (!storedId) {
            const legacy = localStorage.getItem(CAREER_LEGACY_KEY);
            if (legacy) {
                const legacyCareer = getCareerByName(legacy);
                if (legacyCareer) storedId = legacyCareer.id;
            }
        }
    } catch (e) {
        console.warn('No se pudo leer la carrera almacenada', e);
    }

    const career = getCareerById(storedId) || CAREER_OPTIONS[0];
    applyCareerSelection(career, { persistLocal: false });
}

function setupCareerModalListeners() {
    const closeBtn = document.getElementById('careerModalClose');
    const overlay = document.getElementById('careerModalOverlay');
    const modal = document.getElementById('careerModal');
    const createModal = document.getElementById('careerCreateModal');
    const createClose = document.getElementById('careerCreateClose');
    const createCancel = document.getElementById('careerCreateCancel');
    const createForm = document.getElementById('careerCreateForm');
    const createLogoInput = document.getElementById('careerCreateLogo');
    const renameModal = document.getElementById('careerRenameModal');
    const renameClose = document.getElementById('careerRenameClose');
    const renameCancel = document.getElementById('careerRenameCancel');
    const renameForm = document.getElementById('careerRenameForm');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeCareerModal);
    }
    if (overlay) {
        overlay.addEventListener('click', closeCareerModal);
    }
    if (createClose) {
        createClose.addEventListener('click', closeCareerCreationModal);
    }
    if (createCancel) {
        createCancel.addEventListener('click', closeCareerCreationModal);
    }
    if (createForm) {
        createForm.addEventListener('submit', handleCareerCreationSubmit);
    }
    if (createLogoInput) {
        createLogoInput.addEventListener('change', handleCareerLogoChange);
    }
    if (createModal) {
        createModal.addEventListener('click', (event) => {
            if (event.target === createModal) {
                closeCareerCreationModal();
            }
        });
    }
    if (renameClose) {
        renameClose.addEventListener('click', closeCareerRenameModal);
    }
    if (renameCancel) {
        renameCancel.addEventListener('click', closeCareerRenameModal);
    }
    if (renameForm) {
        renameForm.addEventListener('submit', handleCareerRenameSubmit);
    }
    if (renameModal) {
        renameModal.addEventListener('click', (event) => {
            if (event.target === renameModal) {
                closeCareerRenameModal();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (renameModal && !renameModal.classList.contains('hidden')) {
            closeCareerRenameModal();
            return;
        }
        if (createModal && !createModal.classList.contains('hidden')) {
            closeCareerCreationModal();
            return;
        }
        if (modal && !modal.classList.contains('hidden')) {
            closeCareerModal();
        }
    });
}

let defaultSchedulePromptShown = false;
let defaultSchedulePromptDismissed = false;

// Días y horas para el horario
const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const hours = [];

// Generar slots de 45 minutos: 08:00-08:45, 09:00-09:45, ... hasta 21:00-21:45
for (let i = 8; i < 22; i++) {
    const startHour = i.toString().padStart(2, '0') + ':00';
    const endMinute = i.toString().padStart(2, '0') + ':45';
    hours.push(`${startHour}-${endMinute}`);
}

function showLoader(message = 'Cargando...') {
    const overlay = document.getElementById('globalLoader');
    const text = document.getElementById('globalLoaderText');
    if (!overlay) return;
    if (text) text.textContent = message;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
}

function hideLoader() {
    const overlay = document.getElementById('globalLoader');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
    const quotaModal = document.getElementById('driveQuotaModal');
    const quotaVisible = quotaModal && !quotaModal.classList.contains('hidden');
    if (!quotaVisible) {
        document.body.classList.remove('no-scroll');
    }
}

function showDriveQuotaModal(context = 'save') {
    const modal = document.getElementById('driveQuotaModal');
    if (!modal) return;
    const description = document.getElementById('driveQuotaDescription');
    if (description) {
        description.textContent = context === 'load'
            ? 'Tu almacenamiento de Google Drive está lleno. Libera espacio para cargar tus horarios o usa otra cuenta.'
            : 'Tu almacenamiento de Google Drive está lleno. Libera espacio e inténtalo nuevamente o usa otra cuenta.';
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    const focusTarget = document.getElementById('driveQuotaOpenDrive') || document.getElementById('driveQuotaClose');
    if (focusTarget) {
        focusTarget.focus();
    }
}

function hideDriveQuotaModal() {
    const modal = document.getElementById('driveQuotaModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    const loader = document.getElementById('globalLoader');
    const loaderVisible = loader && !loader.classList.contains('hidden');
    if (!loaderVisible) {
        document.body.classList.remove('no-scroll');
    }
}

function showDefaultSchedulePrompt() {
    if (defaultSchedulePromptShown) return;
    if (defaultSchedulePromptDismissed) return;
    if (!isSessionActive()) return;
    const modal = document.getElementById('defaultSchedulePrompt');
    if (!modal) return;
    defaultSchedulePromptShown = true;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    const acceptBtn = document.getElementById('defaultScheduleAccept');
    if (acceptBtn) {
        acceptBtn.focus();
    }
}

function closeDefaultSchedulePrompt() {
    const modal = document.getElementById('defaultSchedulePrompt');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    const loader = document.getElementById('globalLoader');
    const quotaModal = document.getElementById('driveQuotaModal');
    const shouldKeepNoScroll = (loader && !loader.classList.contains('hidden')) ||
        (quotaModal && !quotaModal.classList.contains('hidden'));
    if (!shouldKeepNoScroll) {
        document.body.classList.remove('no-scroll');
    }
    defaultSchedulePromptShown = false;
}

function maybePromptDefaultSchedule() {
    // Desactivado: ya no se muestra automáticamente el modal de horario por defecto.
    return;
}

async function loadDefaultBiomedicaSchedule(options = {}) {
    const { silent = false } = options;
    const addedIds = [];
    const missingIds = [];

    DEFAULT_BIOMEDICA_SUBJECT_IDS.forEach((subjectId) => {
        const alreadySelected = selectedSubjects.some(s => s.id === subjectId);
        if (alreadySelected) {
            return;
        }
        const catalogSubject = catalogSubjects.find(s => s.id === subjectId);
        if (!catalogSubject) {
            missingIds.push(subjectId);
            return;
        }
        const clone = JSON.parse(JSON.stringify(catalogSubject));
        selectedSubjects.push(clone);
        addedIds.push(subjectId);
    });

    if (addedIds.length === 0) {
        if (missingIds.length > 0) {
            console.warn('Materias de Biomédica faltantes en el catálogo:', missingIds);
        }
        if (!silent) {
            showMessage('El horario ordinario de Biomédica ya estaba cargado.', 'warning');
        }
        return false;
    }

    saveSelectedSubjects();
    updateScheduleView();
    updateSelectedSubjectsList();
    defaultSchedulePromptDismissed = false;
    refreshReinscriptionDefaultsAfterScheduleChange();

    if (missingIds.length > 0) {
        console.warn('No se encontraron algunas materias al cargar el horario:', missingIds);
    }

    try {
        const currentCareer = typeof getSelectedCareerOption === 'function' ? getSelectedCareerOption() : null;
        const careerSuccess = currentCareer ? `Horario de ${currentCareer.name} guardado en Google Drive` : 'Horario guardado en Google Drive';
        await ensureSaveToDrive({ interactive: false, showSuccess: true, successMessage: careerSuccess });
    } catch (err) {
        console.warn('No se pudo sincronizar el horario de Biomédica con Drive', err);
        if (!silent) {
            showMessage('Horario cargado, pero no se pudo guardar en Drive. Intenta nuevamente.', 'warning');
        }
        return true;
    }
    return true;
}

let authGateDismissed = false;

function lockInterface(customMessage) {
    authGateDismissed = false;
    authRequestInProgress = false;
    driveAuthRetryPending = false;
    const gate = document.getElementById('authGate');
    const msg = document.getElementById('authGateMessage');
    if (!gate) return;
    if (msg) msg.textContent = customMessage || AUTH_GATE_DEFAULT_MESSAGE;
    gate.classList.remove('hidden');
    gate.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-gate-open');
}

function unlockInterface() {
    const gate = document.getElementById('authGate');
    if (!gate) return;
    gate.classList.add('hidden');
    gate.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-gate-open');
}

function dismissAuthGateTemporarily() {
    authGateDismissed = true;
    authRequestInProgress = false;
    driveAuthRetryPending = false;
    unlockInterface();
}

function isSessionActive() {
    return !!gUserProfile || localStorage.getItem('google_signed_in') === '1';
}

function updateAuthGateState() {
    if (isSessionActive()) {
        unlockInterface();
        return;
    }
    lockInterface();
}

function initAuthGate() {
    const signInBtn = document.getElementById('authGateSignIn');
    const cancelBtn = document.getElementById('authGateCancel');
    if (signInBtn) {
        signInBtn.addEventListener('click', () => {
            authGateDismissed = false;
            try {
                // Usar flujo seguro del backend (/auth/google)
                const url = apiUrl('/auth/google');
                window.location.href = url || '/auth/google';
            } catch (e) {
                console.error('No se pudo iniciar flujo de backend /auth/google', e);
                try { requestGoogleSignIn(); } catch (ex) { console.warn('Fallback requestGoogleSignIn fallo desde authGate:', ex); }
            }
        });
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            dismissAuthGateTemporarily();
            showMessage('Sin sesión no puedes acceder a las materias ni guardar horarios.', 'warning');
        });
    }
    updateAuthGateState();

    document.body.addEventListener('click', function (event) {
        const isSignInTrigger = event.target.closest('#googleSignIn') || event.target.closest('#authGateSignIn');
        if (isSignInTrigger) {
            authGateDismissed = false;
            return;
        }
        if (!isSessionActive() && authGateDismissed && !event.target.closest('#authGate')) {
            lockInterface('Sin sesión no puedes acceder a las materias ni guardar horarios.');
        }
    });
}

// Añade un guard que fuerza iniciar sesión en el primer gesto del usuario
function addInteractionSignInGuard() {
    if (window._forceSignInHandler) return; // ya activo
    const handler = function (e) {
        if (!requireSignInOnInteraction) return;
        if (isSessionActive()) return;
        try {
            if (e.target && e.target.closest && (e.target.closest('#authGate') || e.target.closest('#googleSignIn') || e.target.closest('#authGateSignIn'))) return;
        } catch (ex) { }
        // Evitar que la interacción realice acciones no autorizadas
        try { e.preventDefault(); e.stopPropagation(); } catch (ex) { }
        authGateDismissed = false;
        // Mostrar solo el modal de login; no abrir Google automáticamente
        lockInterface('Debes iniciar sesión para interactuar.');
    };
    window._forceSignInHandler = handler;
    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, true);
    document.addEventListener('keydown', handler, true);
}

function removeInteractionSignInGuard() {
    const h = window._forceSignInHandler;
    if (!h) return;
    try { document.removeEventListener('click', h, true); document.removeEventListener('touchstart', h, true); document.removeEventListener('keydown', h, true); } catch (e) { }
    window._forceSignInHandler = null;
    requireSignInOnInteraction = false;
}

async function hasValidAccessToken() {
    if (gAccessToken) return true;
    try {
        const res = await restoreTokenFromStorage();
        return !!res;
    } catch (e) {
        console.warn('hasValidAccessToken error', e);
        return false;
    }
}

async function ensureDriveReady(options = {}) {
    const { interactive = true, forceGmailScope = false } = options;

    let tokenAvailable = !!gAccessToken;
    if (!tokenAvailable) {
        try {
            tokenAvailable = await restoreTokenFromStorage();
        } catch (e) {
            console.warn('restoreTokenFromStorage fallo al preparar Drive', e);
            tokenAvailable = false;
        }
    }

    const gmailScopeGranted = localStorage.getItem(GMAIL_SCOPE_FLAG) === '1';
    if (forceGmailScope && tokenAvailable && !gmailScopeGranted) {
        console.log('Gmail scope no fue otorgado; pidiendo reconsentimiento...');
        tokenAvailable = false;
    }

    if (!tokenAvailable) {
        if (!interactive) {
            throw new Error('Sin token de acceso válido');
        }
        if (typeof requestGoogleSignIn === 'function' && !authRequestInProgress) {
            try {
                requestGoogleSignIn(false, { forceGmailScope });
                showMessage('Se abrió una ventana de Google. Por favor, inicia sesión y autoriza los permisos solicitados.', 'info');
            } catch (err) {
                console.warn('requestGoogleSignIn fallo al preparar Drive', err);
            }
        }

        tokenAvailable = await hasValidAccessToken();
        if (!tokenAvailable) {
            throw new Error('Por favor, autoriza el acceso a Google y vuelve a intentar.');
        }
    }

    await ensureDriveApiInitialized();
    if (typeof gapi !== 'undefined' && gapi.client && gAccessToken) {
        try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { /* silencioso */ }
        try { console.log('gapi.client.setToken llamado desde ensureDriveReady. token length:', gAccessToken ? gAccessToken.length : 0); } catch (e) { }
    }
}


// Inicializar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function () {
    // Cargar materias predefinidas
    loadPredefinedSubjects();

    // Cargar selecciones guardadas en localStorage si existen
    loadSelectedSubjects();
    initializeCareerSelection();

    // Generar tabla de horarios
    generateScheduleTable();

    // Actualizar vistas
    updateCatalogSubjects();
    updateScheduleView();
    updateSelectedSubjectsList();

    // Configurar previsualización flotante
    setupFloatingPreview();

    initAuthGate();
    setupCareerModalListeners();
    setupReinscriptionModal();
    setupDrawSignatureModal();
    updateReinscriptionLoadedSubjectsList();

    // Inicializar tema (claro/oscuro) con confirmación
    try {
        const root = document.documentElement;
        const savedTheme = localStorage.getItem('hb_theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        if (initialTheme === 'dark') {
            document.body.classList.add('theme-dark');
        }
        const toggleBtn = document.getElementById('themeToggle');
        const toggleIcon = document.getElementById('themeToggleIcon');
        const themeModal = document.getElementById('themeConfirmModal');
        const themeModalMessage = document.getElementById('themeConfirmMessage');
        const themeModalAccept = document.getElementById('themeConfirmAccept');
        const themeModalCancel = document.getElementById('themeConfirmCancel');
        const themeModalClose = document.getElementById('themeConfirmClose');
        const applyIcon = () => {
            if (!toggleIcon) return;
        };
        const closeThemeModal = () => {
            if (!themeModal) return;
            themeModal.classList.add('hidden');
            themeModal.setAttribute('aria-hidden', 'true');
        };
        const applyThemeToggle = () => {
            document.body.classList.toggle('theme-dark');
            const isDark = document.body.classList.contains('theme-dark');
            localStorage.setItem('hb_theme', isDark ? 'dark' : 'light');
            applyIcon();
        };
        const showThemeLoader = () => {
            const loader = document.getElementById('globalLoader');
            const textEl = document.getElementById('globalLoaderText');
            if (!loader || !textEl) return () => { };
            const previousText = textEl.textContent;
            textEl.textContent = 'Cambiando tema, espera...';
            loader.classList.remove('hidden');
            loader.setAttribute('aria-hidden', 'false');
            return () => {
                loader.classList.add('hidden');
                loader.setAttribute('aria-hidden', 'true');
                textEl.textContent = previousText;
            };
        };
        const openThemeModal = () => {
            if (!themeModal) {
                applyThemeToggle();
                return;
            }
            const isDark = document.body.classList.contains('theme-dark');
            if (themeModalMessage) {
                themeModalMessage.textContent = isDark ? '¿Quieres volver al modo claro?' : '¿Quieres activar el modo oscuro?';
            }
            themeModal.classList.remove('hidden');
            themeModal.setAttribute('aria-hidden', 'false');
        };
        applyIcon();
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openThemeModal();
            });
        }
        if (themeModalAccept) {
            themeModalAccept.addEventListener('click', () => {
                closeThemeModal();
                const hideLoader = showThemeLoader();
                document.body.classList.add('theme-transitioning');
                setTimeout(() => {
                    applyThemeToggle();
                    setTimeout(() => {
                        document.body.classList.remove('theme-transitioning');
                        hideLoader();
                    }, 450);
                }, 150);
            });
        }
        if (themeModalCancel) {
            themeModalCancel.addEventListener('click', () => {
                closeThemeModal();
            });
        }
        if (themeModalClose) {
            themeModalClose.addEventListener('click', () => {
                closeThemeModal();
            });
        }
        if (themeModal) {
            themeModal.addEventListener('click', (e) => {
                if (e.target === themeModal) {
                    closeThemeModal();
                }
            });
        }
    } catch (e) {
        console.error('Error inicializando tema', e);
    }
});



document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const suggestions = document.getElementById('suggestions');
    const btnLoad7A = document.getElementById('btnLoad7A');
    const btnLoad8B = document.getElementById('btnLoad8B');
    const btnLoad8C = document.getElementById('btnLoad8C');
    const btnLoad9A = document.getElementById('btnLoad9A');

    const groupNotAvailableModal = document.getElementById('groupNotAvailableModal');
    const groupNotAvailableMessage = document.getElementById('groupNotAvailableMessage');
    const groupNotAvailableClose = document.getElementById('groupNotAvailableClose');

    function openGroupNotAvailableModal(groupName) {
        if (groupNotAvailableMessage) {
            groupNotAvailableMessage.textContent = `Por el momento el grupo ${groupName} no está disponible para cargar en tu horario.`;
        }
        if (groupNotAvailableModal) {
            groupNotAvailableModal.style.display = 'block';
            groupNotAvailableModal.classList.remove('hidden');
            groupNotAvailableModal.setAttribute('aria-hidden', 'false');
        }
    }

    function closeGroupNotAvailableModal() {
        if (groupNotAvailableModal) {
            groupNotAvailableModal.style.display = 'none';
            groupNotAvailableModal.classList.add('hidden');
            groupNotAvailableModal.setAttribute('aria-hidden', 'true');
        }
    }

    if (groupNotAvailableClose) {
        groupNotAvailableClose.addEventListener('click', closeGroupNotAvailableModal);
    }

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

    // Botón para cargar horario del grupo 7A de Biomédica
    if (btnLoad7A) {
        btnLoad7A.addEventListener('click', function () {
            if (!isSessionActive()) {
                showMessage('Primero inicia sesión con Google para cargar el horario.', 'warning');
                return;
            }
            // Permitir que el modal se muestre aunque antes se haya cancelado
            defaultSchedulePromptDismissed = false;
            showDefaultSchedulePrompt();
        });
    }

    // Botones para grupos aún no disponibles (8B, 8C, 9A)
    if (btnLoad8B) {
        btnLoad8B.addEventListener('click', function () {
            openGroupNotAvailableModal('8B');
        });
    }

    if (btnLoad8C) {
        btnLoad8C.addEventListener('click', function () {
            openGroupNotAvailableModal('8C');
        });
    }

    if (btnLoad9A) {
        btnLoad9A.addEventListener('click', function () {
            openGroupNotAvailableModal('9A');
        });
    }
});

// Cargar materias predefinidas en el catálogo
function loadPredefinedSubjects() {
    catalogSubjects = [
        // Datos completos de los horarios extraídos del PDF

        // =========== GRUPO 7A ===========
        {
            id: 57,
            name: "Microcontroladores",
            professor: "G Rosario",
            group: "7A",
            aula: "A210",
            sessions: [
                { day: "lunes", startTime: "9:00", endTime: "10:45" },
                { day: "martes", startTime: "11:00", endTime: "12:45" },
                { day: "miercoles", startTime: "12:00", endTime: "13:45" }
            ]
        },
        {
            id: 58,
            name: "Gestion de Proyectos",
            professor: "Urbina Brito Norberto",
            group: "7A",
            aula: "A210",
            sessions: [
                { day: "lunes", startTime: "11:00", endTime: "12:45" },
                { day: "miercoles", startTime: "14:00", endTime: "15:45" },
            ]
        },
        {
            id: 59,
            name: "Biomecanica",
            professor: "Velazquez Hernández Gerardo",
            group: "7A",
            aula: "A210",
            sessions: [
                { day: "lunes", startTime: "13:00", endTime: "15:45" },
                { day: "viernes", startTime: "11:00", endTime: "12:45" },
            ]
        },
        {
            id: 60,
            name: "Bioinstrumentacion",
            professor: "Martínez Cancino Diana Paulina",
            group: "7A",
            aula: "A210",
            sessions: [
                { day: "martes", startTime: "9:00", endTime: "10:45" },
                { day: "jueves", startTime: "8:00", endTime: "10:45" },
            ]
        },
        {
            id: 61,
            name: "Inglés VII",
            professor: "Santiago Eduardo",
            group: "7A",
            aula: "A210",
            sessions: [
                { day: "martes", startTime: "13:00", endTime: "14:45" },
                { day: "viernes", startTime: "8:00", endTime: "10:45" }
            ]
        },

        {
            id: 67,
            name: "Estancia II",
            professor: "Martínez Cancino Diana Paulina",
            group: "7A",
            aula: "A210",
            sessions: [
                { day: "miercoles", startTime: "8:00", endTime: "10:45" },
            ]
        },
        {
            id: 68,
            name: "Fisica Medica",
            professor: "Constantino Cortés Eglain",
            group: "7A",
            aula: "A210",
            sessions: [
                { day: "jueves", startTime: "12:00", endTime: "14:45" },
                { day: "viernes", startTime: "13:00", endTime: "14:45" },
            ]
        },
        {
            id: 69,
            name: "Tutorías",
            professor: "Vázquez Buenos Aires José Octavio",
            group: "7A",
            aula: "A210",
            sessions: [
                { day: "lunes", startTime: "8:00", endTime: "8:45" }
            ]
        },


    ];

    // Modificar las sesiones para ajustar las horas que terminan en ":45"
    catalogSubjects.forEach(subject => {
        subject.sessions.forEach(session => {
            // Verificar si la hora de finalización termina en ":45"
            if (typeof session.endTime === 'string' && session.endTime.endsWith(':45')) {
                // Convertir correctamente sumando 15 minutos
                const [hh, mm] = session.endTime.split(':').map(Number);
                let hour = hh;
                let minute = mm + 15;
                if (minute >= 60) {
                    hour += 1;
                    minute -= 60;
                }
                session.endTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            }
        });
    });

    // Guardar una copia inmutable de las materias predefinidas para poder reconstruir el catálogo
    predefinedSubjects = JSON.parse(JSON.stringify(catalogSubjects));

    // Verificar los cambios
    console.log(catalogSubjects);
}

// Función para cargar materias seleccionadas desde localStorage
function loadSelectedSubjects() {
    // Si no hay sesión activa, no se debe restaurar el horario local
    if (!isSessionActive()) {
        selectedSubjects = [];
        return;
    }
    try {
        const savedSubjects = localStorage.getItem('selectedSubjects');
        if (savedSubjects) {
            selectedSubjects = JSON.parse(savedSubjects);
        }
    } catch (err) {
        console.warn('loadSelectedSubjects error', err);
        showMessage('No se pudieron cargar los horarios guardados en este dispositivo.', 'warning');
    }
}

// Función para guardar materias seleccionadas en localStorage
function saveSelectedSubjects() {
    try {
        localStorage.setItem('selectedSubjects', JSON.stringify(selectedSubjects));
    } catch (err) {
        console.warn('saveSelectedSubjects error', err);
        showMessage('Tu navegador no permitió guardar el horario localmente.', 'warning');
    }
}

function persistReinscriptionModalOpenState(isOpen) {
    try {
        localStorage.setItem(REINSCRIPTION_MODAL_STATE_STORAGE_KEY, isOpen ? 'open' : 'closed');
    } catch (error) {
        console.warn('No se pudo guardar el estado del modal de reinscripción', error);
    }
}
function loadReinscriptionFormSnapshot() {
    try {
        const stored = localStorage.getItem(REINSCRIPTION_FORM_STORAGE_KEY);
        if (!stored) {
            return null;
        }
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return {
            fullName: parsed.fullName || '',
            matricula: parsed.matricula || '',
            career: parsed.career || '',
            quarter: parsed.quarter || '',
            group: parsed.group || '',
            // NOTE: intentional: do NOT load or persist user-entered debtSubject
            // to avoid storing potentially sensitive or dynamic auto-filled values.
            autoDebtSubject: parsed.autoDebtSubject || '',
            tutorEmail: parsed.tutorEmail || '',
            tutorMessage: parsed.tutorMessage || '',
            tutorName: parsed.tutorName || '',
            tutorSignatureDataUrl: parsed.tutorSignatureDataUrl || null,
            tutorIsDefault: !!parsed.tutorIsDefault
        };
    } catch (error) {
        console.warn('No se pudo cargar el formulario de reinscripción guardado', error);
        return null;
    }
}

function saveReinscriptionFormSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return;
    }
    const toPersist = {
        fullName: snapshot.fullName || '',
        matricula: snapshot.matricula || '',
        career: snapshot.career || '',
        quarter: snapshot.quarter || '',
        group: snapshot.group || '',
        // Do NOT persist debtSubject: it should be computed and not stored locally
        autoDebtSubject: snapshot.autoDebtSubject || '',
        tutorEmail: snapshot.tutorEmail || '',
        tutorMessage: snapshot.tutorMessage || '',
        tutorName: snapshot.tutorName || '',
        tutorSignatureDataUrl: snapshot.tutorSignatureDataUrl || null,
        tutorIsDefault: !!snapshot.tutorIsDefault
    };
    try {
        localStorage.setItem(REINSCRIPTION_FORM_STORAGE_KEY, JSON.stringify(toPersist));
    } catch (error) {
        console.warn('No se pudo guardar el formulario de reinscripción', error);
    }
}

function loadSignaturePlacement() {
    try {
        const stored = localStorage.getItem(REINSCRIPTION_SIGNATURE_STORAGE_KEY);
        if (!stored) {
            return null;
        }
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        const normalized = {};
        let hasData = false;
        ['xPct', 'yPct', 'widthPct', 'heightPct'].forEach(key => {
            const value = Number(parsed[key]);
            if (Number.isFinite(value)) {
                normalized[key] = Math.max(0, Math.min(1, value));
                hasData = true;
            }
        });
        ['xAbs', 'yAbs', 'widthAbs', 'heightAbs'].forEach(key => {
            const value = Number(parsed[key]);
            if (Number.isFinite(value) && value >= 0) {
                normalized[key] = value;
                hasData = true;
            }
        });
        return hasData ? normalized : null;
    } catch (error) {
        console.warn('No se pudo cargar la posición guardada de la firma', error);
        return null;
    }
}

function saveSignaturePlacement(layout) {
    if (!layout || typeof layout !== 'object') {
        return;
    }
    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    const payload = {};
    ['xPct', 'yPct', 'widthPct', 'heightPct'].forEach(key => {
        const value = Number(layout[key]);
        if (Number.isFinite(value)) {
            payload[key] = clamp01(value);
        }
    });
    ['xAbs', 'yAbs', 'widthAbs', 'heightAbs'].forEach(key => {
        const value = Number(layout[key]);
        if (Number.isFinite(value) && value >= 0) {
            payload[key] = Number(value.toFixed(4));
        }
    });
    try {
        localStorage.setItem(REINSCRIPTION_SIGNATURE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('No se pudo guardar la posición de la firma', error);
    }
}

LEGACY_REINSCRIPTION_LAYOUT_KEYS.forEach((legacyKey) => {
    try {
        if (localStorage.getItem(legacyKey) !== null) {
            localStorage.removeItem(legacyKey);
        }
    } catch (error) {
        console.warn('No se pudo limpiar un ajuste antiguo de posiciones del PDF', error);
    }
});

const storedSignaturePlacement = loadSignaturePlacement();
if (storedSignaturePlacement) {
    Object.assign(REINSCRIPTION_PDF_LAYOUT.signature, storedSignaturePlacement);
}

const preloadedReinscriptionFormSnapshot = loadReinscriptionFormSnapshot();
if (preloadedReinscriptionFormSnapshot) {
    const hasPersistedContent = Object.values(preloadedReinscriptionFormSnapshot).some(value => {
        if (typeof value === 'string') {
            return value.trim().length > 0;
        }
        return !!value;
    });
    if (hasPersistedContent) {
        reinscriptionLastFormValues = { ...preloadedReinscriptionFormSnapshot };
    }
}

function ensurePdfLib() {
    if (window.PDFLib) {
        return Promise.resolve(window.PDFLib);
    }
    if (!pdfLibLoaderPromise) {
        pdfLibLoaderPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
            script.async = true;
            script.onload = () => {
                if (window.PDFLib) {
                    resolve(window.PDFLib);
                } else {
                    reject(new Error('PDFLib no disponible tras la carga'));
                }
            };
            script.onerror = () => reject(new Error('No se pudo cargar la librería PDFLib'));
            document.head.appendChild(script);
        });
    }
    return pdfLibLoaderPromise;
}

async function ensureReinscriptionTemplate() {
    if (reinscriptionPdfTemplateBytes) {
        return reinscriptionPdfTemplateBytes;
    }
    const response = await fetch(REINSCRIPTION_TEMPLATE_PATH);
    if (!response.ok) {
        throw new Error('No se pudo cargar el formato de solicitud de reinscripción');
    }
    const buffer = await response.arrayBuffer();
    reinscriptionPdfTemplateBytes = new Uint8Array(buffer);
    return reinscriptionPdfTemplateBytes;
}

function ensurePdfJs() {
    if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
        try {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        } catch (error) {
            console.warn('No se pudo configurar el worker de PDF.js', error);
        }
        return Promise.resolve(window.pdfjsLib);
    }
    if (!pdfJsInitPromise) {
        pdfJsInitPromise = new Promise((resolve, reject) => {
            let attempts = 0;
            const attemptLoad = () => {
                attempts += 1;
                if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
                    try {
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
                    } catch (error) {
                        console.warn('No se pudo configurar el worker de PDF.js', error);
                    }
                    resolve(window.pdfjsLib);
                    return;
                }
                if (attempts >= 50) {
                    reject(new Error('PDF.js no está disponible'));
                    return;
                }
                setTimeout(attemptLoad, 60);
            };
            attemptLoad();
        });
    }
    return pdfJsInitPromise;
}

function clearReinscriptionPreviewCanvas() {
    const { canvas, overlay } = signatureOverlayElements;
    const canvasMobile = document.getElementById('reinscriptionPreviewCanvasMobile');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.classList.remove('is-visible');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.width = '';
        canvas.style.height = '';
    }
    if (canvasMobile) {
        const ctxMobile = canvasMobile.getContext('2d');
        if (ctxMobile) {
            ctxMobile.clearRect(0, 0, canvasMobile.width, canvasMobile.height);
        }
        canvasMobile.classList.remove('is-visible');
        canvasMobile.setAttribute('aria-hidden', 'true');
        canvasMobile.style.width = '';
        canvasMobile.style.height = '';
    }
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('is-active');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.width = '';
        overlay.style.height = '';
    }
    reinscriptionPreviewMetrics = { width: 0, height: 0, scale: 1, baseWidth: 0, baseHeight: 0 };
}

function updateSignatureOverlayPosition() {
    setupReinscriptionSignatureOverlay();
    const { overlay, box } = signatureOverlayElements;
    if (!overlay || !box) {
        return;
    }
    if (!reinscriptionSignatureDataUrl) {
        overlay.classList.add('hidden');
        overlay.classList.remove('is-active');
        overlay.setAttribute('aria-hidden', 'true');
        return;
    }
    const layout = REINSCRIPTION_PDF_LAYOUT.signature || {};
    const overlayRect = overlay.getBoundingClientRect();
    let overlayWidth = overlayRect.width;
    let overlayHeight = overlayRect.height;
    if (!overlayWidth || !overlayHeight) {
        overlayWidth = reinscriptionPreviewMetrics.width;
        overlayHeight = reinscriptionPreviewMetrics.height;
    }
    if (!overlayWidth || !overlayHeight) {
        setTimeout(updateSignatureOverlayPosition, 80);
        return;
    }
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const clamp01 = (value) => clamp(value, 0, 1);
    // Preferir métricas móviles si coinciden con el tamaño del overlay proporcionado
    let scale = 1;
    if (reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.mobile && (overlayWidth === reinscriptionPreviewMetrics.mobile.width || overlayHeight === reinscriptionPreviewMetrics.mobile.height)) {
        scale = reinscriptionPreviewMetrics.mobile.scale || 1;
    } else if (reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.scale) {
        scale = reinscriptionPreviewMetrics.scale;
    } else if (overlayWidth && reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.baseWidth) {
        scale = overlayWidth / reinscriptionPreviewMetrics.baseWidth;
    } else {
        scale = 1;
    }
    const baseWidth = reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.baseWidth ? reinscriptionPreviewMetrics.baseWidth : (scale ? overlayWidth / scale : overlayWidth);
    const baseHeight = reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.baseHeight ? reinscriptionPreviewMetrics.baseHeight : (scale ? overlayHeight / scale : overlayHeight);
    const defaultSignatureLayout = REINSCRIPTION_PDF_LAYOUT_DEFAULTS && REINSCRIPTION_PDF_LAYOUT_DEFAULTS.signature ? REINSCRIPTION_PDF_LAYOUT_DEFAULTS.signature : {};
    const toPxFromAbs = (absValue) => {
        if (!Number.isFinite(absValue)) return null;
        return absValue * scale;
    };
    const resolvePct = (value, fallback) => {
        if (Number.isFinite(value)) return clamp01(value);
        if (Number.isFinite(fallback)) return clamp01(fallback);
        return null;
    };
    const clampAbs = (value, max) => Math.max(0, Math.min(max, value));
    const minWidth = Math.max(20, overlayWidth * 0.04);
    const minHeight = Math.max(20, overlayHeight * 0.04);
    const aspect = Number.isFinite(signatureAspectRatio) && signatureAspectRatio > 0 ? signatureAspectRatio : null;

    let widthPx = toPxFromAbs(layout.widthAbs);
    let heightPx = toPxFromAbs(layout.heightAbs);
    const widthPctFallback = resolvePct(layout.widthPct, defaultSignatureLayout.widthPct || 0.28);
    const heightPctFallback = resolvePct(layout.heightPct, defaultSignatureLayout.heightPct || 0.12);

    if (!Number.isFinite(widthPx) || widthPx <= 0) {
        if (Number.isFinite(widthPctFallback)) {
            widthPx = overlayWidth * widthPctFallback;
        }
    }
    if (!Number.isFinite(heightPx) || heightPx <= 0) {
        if (Number.isFinite(heightPctFallback)) {
            heightPx = overlayHeight * heightPctFallback;
        }
    }
    if ((!Number.isFinite(heightPx) || heightPx <= 0) && Number.isFinite(widthPx) && widthPx > 0 && aspect) {
        heightPx = widthPx / aspect;
    }
    if ((!Number.isFinite(widthPx) || widthPx <= 0) && Number.isFinite(heightPx) && heightPx > 0 && aspect) {
        widthPx = heightPx * aspect;
    }
    if (!Number.isFinite(widthPx) || widthPx <= 0) {
        widthPx = overlayWidth * clamp01(defaultSignatureLayout.widthPct || 0.25);
    }
    if (!Number.isFinite(heightPx) || heightPx <= 0) {
        heightPx = overlayHeight * clamp01(defaultSignatureLayout.heightPct || 0.1);
    }
    widthPx = clamp(widthPx, minWidth, overlayWidth);
    heightPx = clamp(heightPx, minHeight, overlayHeight);
    if (aspect) {
        const expectedHeight = widthPx / aspect;
        if (Math.abs(expectedHeight - heightPx) > 0.6) {
            heightPx = clamp(expectedHeight, minHeight, overlayHeight);
        }
    }

    let leftPx = toPxFromAbs(layout.xAbs);
    if (!Number.isFinite(leftPx)) {
        const xPct = resolvePct(layout.xPct, defaultSignatureLayout.xPct || 0);
        leftPx = Number.isFinite(xPct) ? overlayWidth * xPct : 0;
    }
    leftPx = clamp(leftPx, 0, Math.max(0, overlayWidth - widthPx));

    let bottomPx = toPxFromAbs(layout.yAbs);
    if (!Number.isFinite(bottomPx)) {
        const yPct = resolvePct(layout.yPct, defaultSignatureLayout.yPct || 0);
        bottomPx = Number.isFinite(yPct) ? overlayHeight * yPct : 0;
    }
    const maxBottom = Math.max(0, overlayHeight - heightPx);
    bottomPx = clamp(bottomPx, 0, maxBottom);
    let topPx = overlayHeight - bottomPx - heightPx;
    if (!Number.isFinite(topPx)) {
        topPx = overlayHeight - heightPx;
    }
    topPx = clamp(topPx, 0, overlayHeight - heightPx);

    box.style.width = `${widthPx}px`;
    box.style.height = `${heightPx}px`;
    box.style.left = `${leftPx}px`;
    box.style.top = `${topPx}px`;
    box.classList.remove('dragging');
    overlay.classList.remove('hidden');
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden', 'false');

    // También actualizar overlay móvil si existe
    try {
        const overlayMobile = document.getElementById('reinscriptionSignatureOverlayMobile');
        const boxMobile = document.getElementById('reinscriptionSignatureBoxMobile');
        if (overlayMobile && boxMobile && reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.mobile) {
            const mobileMetrics = reinscriptionPreviewMetrics.mobile;
            const mobileScale = mobileMetrics.scale || scale;
            const mobileOverlayWidth = mobileMetrics.width || overlayWidth;
            const mobileOverlayHeight = mobileMetrics.height || overlayHeight;

            const minWidthM = Math.max(20, mobileOverlayWidth * 0.04);
            const minHeightM = Math.max(20, mobileOverlayHeight * 0.04);

            let widthPxM = mobileMetrics.baseWidth ? (layout.widthAbs ? layout.widthAbs * mobileScale : mobileOverlayWidth * (layout.widthPct || 0.28)) : widthPx;
            let heightPxM = mobileMetrics.baseHeight ? (layout.heightAbs ? layout.heightAbs * mobileScale : mobileOverlayHeight * (layout.heightPct || 0.12)) : heightPx;

            if (!Number.isFinite(widthPxM) || widthPxM <= 0) widthPxM = mobileOverlayWidth * (defaultSignatureLayout.widthPct || 0.25);
            if (!Number.isFinite(heightPxM) || heightPxM <= 0) heightPxM = mobileOverlayHeight * (defaultSignatureLayout.heightPct || 0.1);
            widthPxM = clamp(widthPxM, minWidthM, mobileOverlayWidth);
            heightPxM = clamp(heightPxM, minHeightM, mobileOverlayHeight);

            let leftPxM = Number.isFinite(layout.xPct) ? mobileOverlayWidth * layout.xPct : (Number.isFinite(layout.xAbs) ? layout.xAbs * mobileScale : 0);
            leftPxM = clamp(leftPxM, 0, Math.max(0, mobileOverlayWidth - widthPxM));

            let bottomPxM = Number.isFinite(layout.yPct) ? mobileOverlayHeight * layout.yPct : (Number.isFinite(layout.yAbs) ? layout.yAbs * mobileScale : 0);
            bottomPxM = clamp(bottomPxM, 0, Math.max(0, mobileOverlayHeight - heightPxM));
            let topPxM = mobileOverlayHeight - bottomPxM - heightPxM;
            topPxM = clamp(topPxM, 0, mobileOverlayHeight - heightPxM);

            boxMobile.style.width = `${Math.round(widthPxM)}px`;
            boxMobile.style.height = `${Math.round(heightPxM)}px`;
            boxMobile.style.left = `${Math.round(leftPxM)}px`;
            boxMobile.style.top = `${Math.round(topPxM)}px`;
            boxMobile.classList.remove('dragging');
            overlayMobile.classList.remove('hidden');
            overlayMobile.classList.add('is-active');
            overlayMobile.setAttribute('aria-hidden', 'false');
        }
    } catch (e) { /* ignore mobile overlay errors */ }

    const tolerance = 0.01;
    let shouldPersist = false;
    const derivedWidthAbs = widthPx / scale;
    const derivedHeightAbs = heightPx / scale;
    const derivedLeftAbs = leftPx / scale;
    const derivedBottomAbs = bottomPx / scale;

    if (!Number.isFinite(layout.widthAbs) || Math.abs(layout.widthAbs - derivedWidthAbs) > tolerance) {
        layout.widthAbs = clampAbs(derivedWidthAbs, baseWidth);
        shouldPersist = true;
    }
    if (!Number.isFinite(layout.heightAbs) || Math.abs(layout.heightAbs - derivedHeightAbs) > tolerance) {
        layout.heightAbs = clampAbs(derivedHeightAbs, baseHeight);
        shouldPersist = true;
    }
    if (!Number.isFinite(layout.xAbs) || Math.abs(layout.xAbs - derivedLeftAbs) > tolerance) {
        layout.xAbs = clampAbs(derivedLeftAbs, Math.max(0, baseWidth - (layout.widthAbs || 0)));
        shouldPersist = true;
    }
    if (!Number.isFinite(layout.yAbs) || Math.abs(layout.yAbs - derivedBottomAbs) > tolerance) {
        layout.yAbs = clampAbs(derivedBottomAbs, Math.max(0, baseHeight - (layout.heightAbs || 0)));
        shouldPersist = true;
    }
    if (shouldPersist) {
        saveSignaturePlacement(layout);
    }
}

function updateSignatureLayoutFromOverlay(rect, overlayWidth, overlayHeight, isMobile) {
    if (!rect || !overlayWidth || !overlayHeight) {
        return;
    }
    const layout = REINSCRIPTION_PDF_LAYOUT.signature || {};
    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    const clampNonNegative = (value, max) => Math.max(0, Math.min(max, value));
    const bottomPx = overlayHeight - (rect.top + rect.height);
    layout.xPct = clamp01(rect.left / overlayWidth);
    layout.yPct = clamp01(bottomPx / overlayHeight);
    layout.widthPct = clamp01(rect.width / overlayWidth);
    layout.heightPct = clamp01(rect.height / overlayHeight);

    let scale;
    let baseWidth;
    let baseHeight;

    if (isMobile && reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.mobile) {
        const mobileMetrics = reinscriptionPreviewMetrics.mobile;
        scale = mobileMetrics.scale || (overlayWidth && mobileMetrics.baseWidth ? overlayWidth / mobileMetrics.baseWidth : 1) || 1;
        baseWidth = mobileMetrics.baseWidth || (scale ? overlayWidth / scale : overlayWidth);
        baseHeight = mobileMetrics.baseHeight || (scale ? overlayHeight / scale : overlayHeight);
    } else {
        scale = reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.scale
            ? reinscriptionPreviewMetrics.scale
            : (overlayWidth && reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.baseWidth
                ? overlayWidth / reinscriptionPreviewMetrics.baseWidth
                : 1) || 1;
        baseWidth = reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.baseWidth
            ? reinscriptionPreviewMetrics.baseWidth
            : (scale ? overlayWidth / scale : overlayWidth);
        baseHeight = reinscriptionPreviewMetrics && reinscriptionPreviewMetrics.baseHeight
            ? reinscriptionPreviewMetrics.baseHeight
            : (scale ? overlayHeight / scale : overlayHeight);
    }

    const widthAbs = rect.width / scale;
    const heightAbs = rect.height / scale;
    const leftAbs = rect.left / scale;
    const bottomAbs = bottomPx / scale;

    layout.widthAbs = clampNonNegative(widthAbs, baseWidth);
    layout.heightAbs = clampNonNegative(heightAbs, baseHeight);
    layout.xAbs = clampNonNegative(leftAbs, Math.max(0, baseWidth - layout.widthAbs));
    layout.yAbs = clampNonNegative(bottomAbs, Math.max(0, baseHeight - layout.heightAbs));
    saveSignaturePlacement(layout);
    if (rect.width > 0 && rect.height > 0) {
        signatureAspectRatio = rect.width / rect.height;
    }
    scheduleReinscriptionPreviewRender();
}

async function renderReinscriptionPreviewCanvas(pdfBytes) {
    const pdfjsLib = await ensurePdfJs();
    setupReinscriptionSignatureOverlay();
    const { stage, canvas, overlay } = signatureOverlayElements;
    const canvasMobile = document.getElementById('reinscriptionPreviewCanvasMobile');
    if (!stage || !canvas || !pdfjsLib) {
        return;
    }

    // Cargar PDF y página
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const stageWidth = stage.clientWidth || stage.offsetWidth || baseViewport.width;
    const scale = stageWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const outputWidth = Math.max(1, Math.round(viewport.width));
    const outputHeight = Math.max(1, Math.round(viewport.height));
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Renderizar en offscreen canvas primero para evitar parpadeos
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.floor(outputWidth * devicePixelRatio);
    offscreen.height = Math.floor(outputHeight * devicePixelRatio);
    offscreen.style.width = `${outputWidth}px`;
    offscreen.style.height = `${outputHeight}px`;
    const offCtx = offscreen.getContext('2d', { alpha: false });
    offCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    // Usar render a offscreen
    await page.render({ canvasContext: offCtx, viewport }).promise;

    // Copiar desde offscreen al canvas visible sin limpiar/ocultar antes
    try {
        const visibleCtx = canvas.getContext('2d', { alpha: false });
        // Ajustar tamaño del canvas visible en píxeles (esto limpia, pero la copia es inmediata)
        canvas.width = offscreen.width;
        canvas.height = offscreen.height;
        canvas.style.width = `${outputWidth}px`;
        canvas.style.height = `${outputHeight}px`;
        // Dibujar la imagen renderizada
        visibleCtx.setTransform(1, 0, 0, 1, 0, 0);
        visibleCtx.clearRect(0, 0, canvas.width, canvas.height);
        visibleCtx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
        canvas.classList.add('is-visible');
        canvas.setAttribute('aria-hidden', 'false');
    } catch (err) {
        // En caso de error, intentar renderizar directamente (caída segura)
        console.warn('Error copiando preview al canvas visible, intentando render directo', err);
        const ctx = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.floor(outputWidth * devicePixelRatio);
        canvas.height = Math.floor(outputHeight * devicePixelRatio);
        canvas.style.width = `${outputWidth}px`;
        canvas.style.height = `${outputHeight}px`;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        await page.render({ canvasContext: ctx, viewport }).promise;
        canvas.classList.add('is-visible');
        canvas.setAttribute('aria-hidden', 'false');
    }

    const mobileStage = document.getElementById('reinscriptionPreviewStageMobile');
    let mobileMetrics = null;
    // Render móvil (si existe) calculando escala específica para que quepa en pantalla
    if (canvasMobile && mobileStage) {
        const mobileStageWidth = mobileStage.clientWidth || Math.min(stageWidth, Math.round(window.innerWidth * 0.95));
        const mobileScale = mobileStageWidth / baseViewport.width;
        const viewportMobile = page.getViewport({ scale: mobileScale });
        const mobileOutputWidth = Math.max(1, Math.round(viewportMobile.width));
        const mobileOutputHeight = Math.max(1, Math.round(viewportMobile.height));

        const offscreenMobile = document.createElement('canvas');
        offscreenMobile.width = Math.floor(mobileOutputWidth * devicePixelRatio);
        offscreenMobile.height = Math.floor(mobileOutputHeight * devicePixelRatio);
        offscreenMobile.style.width = `${mobileOutputWidth}px`;
        offscreenMobile.style.height = `${mobileOutputHeight}px`;
        const offCtxMobile = offscreenMobile.getContext('2d', { alpha: false });
        offCtxMobile.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        await page.render({ canvasContext: offCtxMobile, viewport: viewportMobile }).promise;
        try {
            const ctxMobile = canvasMobile.getContext('2d', { alpha: false });
            canvasMobile.width = offscreenMobile.width;
            canvasMobile.height = offscreenMobile.height;
            canvasMobile.style.width = `${mobileOutputWidth}px`;
            canvasMobile.style.height = `${mobileOutputHeight}px`;
            ctxMobile.setTransform(1, 0, 0, 1, 0, 0);
            ctxMobile.clearRect(0, 0, canvasMobile.width, canvasMobile.height);
            ctxMobile.drawImage(offscreenMobile, 0, 0, canvasMobile.width, canvasMobile.height);
            canvasMobile.classList.add('is-visible');
            canvasMobile.setAttribute('aria-hidden', 'false');
        } catch (err) {
            console.warn('Error copiando preview móvil, intentando render directo', err);
        }

        // Guardar métricas móviles para posicionamiento de la firma en móvil
        mobileMetrics = {
            width: mobileOutputWidth,
            height: mobileOutputHeight,
            scale: mobileScale,
            baseWidth: baseViewport ? baseViewport.width : mobileOutputWidth,
            baseHeight: baseViewport ? baseViewport.height : mobileOutputHeight
        };
        // Actualizar tamaño del overlay móvil si existe
        const overlayMobile = document.getElementById('reinscriptionSignatureOverlayMobile');
        if (overlayMobile) {
            overlayMobile.style.width = `${mobileOutputWidth}px`;
            overlayMobile.style.height = `${mobileOutputHeight}px`;
        }
    }

    reinscriptionPreviewMetrics = {
        width: outputWidth,
        height: outputHeight,
        scale,
        baseWidth: baseViewport ? baseViewport.width : outputWidth,
        baseHeight: baseViewport ? baseViewport.height : outputHeight
    };
    if (mobileMetrics) {
        reinscriptionPreviewMetrics.mobile = mobileMetrics;
    }
    if (overlay) {
        overlay.style.width = `${outputWidth}px`;
        overlay.style.height = `${outputHeight}px`;
    }
    updateSignatureOverlayPosition();
}

function setupReinscriptionSignatureOverlay() {
    if (signatureOverlayElements.initialized) {
        return;
    }
    signatureOverlayElements.stage = document.getElementById('reinscriptionPreviewStage');
    signatureOverlayElements.canvas = document.getElementById('reinscriptionPreviewCanvas');
    signatureOverlayElements.overlay = document.getElementById('reinscriptionSignatureOverlay');
    signatureOverlayElements.box = document.getElementById('reinscriptionSignatureBox');
    signatureOverlayElements.image = document.getElementById('reinscriptionSignatureOverlayImage');
    signatureOverlayElements.handle = document.getElementById('reinscriptionSignatureResize');
    const { overlay, box, image } = signatureOverlayElements;
    if (!overlay || !box) {
        return;
    }
    // Registramos los handlers directamente en la caja de la firma
    // para evitar que el overlay (que ocupa todo el preview) bloquee
    // toques y gestos en otras áreas (p. ej. botones móviles o pinch-zoom).
    box.addEventListener('pointerdown', handleSignaturePointerDown);
    box.addEventListener('pointermove', handleSignaturePointerMove);
    box.addEventListener('pointerup', handleSignaturePointerUp);
    box.addEventListener('pointercancel', handleSignaturePointerUp);
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    if (image) {
        image.draggable = false;
        image.addEventListener('load', () => {
            if (image.naturalWidth && image.naturalHeight) {
                signatureAspectRatio = image.naturalWidth / image.naturalHeight;
                updateSignatureOverlayPosition();
            }
        });
    }

    // Configurar overlay móvil
    const overlayMobile = document.getElementById('reinscriptionSignatureOverlayMobile');
    const boxMobile = document.getElementById('reinscriptionSignatureBoxMobile');
    const imageMobile = document.getElementById('reinscriptionSignatureOverlayImageMobile');

    if (overlayMobile && boxMobile) {
        // Igual que en escritorio: atachar los eventos sobre la caja móvil
        boxMobile.addEventListener('pointerdown', handleSignaturePointerDownMobile);
        boxMobile.addEventListener('pointermove', handleSignaturePointerMoveMobile);
        boxMobile.addEventListener('pointerup', handleSignaturePointerUpMobile);
        boxMobile.addEventListener('pointercancel', handleSignaturePointerUpMobile);
        // Además atachar al overlay para que, si el dedo sale de la caja, sigamos recibiendo movimientos
        overlayMobile.addEventListener('pointermove', handleSignaturePointerMoveMobile);
        overlayMobile.addEventListener('pointerup', handleSignaturePointerUpMobile);
        overlayMobile.addEventListener('pointercancel', handleSignaturePointerUpMobile);
        overlayMobile.addEventListener('pointerdown', (e) => {
            // Si el usuario inicia el touch en el overlay pero dentro de la caja, redirigir al handler
            if (boxMobile.contains(e.target) || e.target === boxMobile) return;
            // Emular un pointerdown en la caja si el touch cae sobre la imagen
            const rect = boxMobile.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                handleSignaturePointerDownMobile(e);
            }
        });
        overlayMobile.classList.add('hidden');
        overlayMobile.setAttribute('aria-hidden', 'true');
        if (imageMobile) {
            imageMobile.draggable = false;
            imageMobile.addEventListener('load', () => {
                if (imageMobile.naturalWidth && imageMobile.naturalHeight) {
                    signatureAspectRatio = imageMobile.naturalWidth / imageMobile.naturalHeight;
                    updateSignatureOverlayPosition();
                }
            });
        }
    }

    // Inicializar mapa de punteros si no existe (se usa para gestos multi-táctiles)
    if (!window._sigPointerMap) window._sigPointerMap = new Map();
    signatureOverlayElements.initialized = true;
}

function handleSignaturePointerDown(event) {
    if (!reinscriptionSignatureDataUrl) {
        return;
    }
    // No procesar si se hace click en el botón X
    if (event.target && event.target.classList && event.target.classList.contains('reinscription-signature-remove')) {
        return;
    }
    const { overlay, box, handle } = signatureOverlayElements;
    if (!overlay || !box) {
        return;
    }
    if (!box.contains(event.target)) {
        return;
    }
    // Track active pointers. Initialize set lazily to avoid changing top-level declarations.
    if (!window._sigActivePointers) window._sigActivePointers = new Set();
    window._sigActivePointers.add(event.pointerId);

    // Si hay múltiples punteros táctiles, permitimos que el navegador maneje el pinch-zoom
    // evitando preventDefault() y setPointerCapture().
    const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
    if (isTouch && window._sigActivePointers.size > 1) {
        // No iniciar arrastre; dejar que el navegador gestione el gesto (pinch)
        return;
    }

    event.preventDefault();
    const overlayRect = overlay.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const overlayWidth = overlayRect.width || reinscriptionPreviewMetrics.width;
    const overlayHeight = overlayRect.height || reinscriptionPreviewMetrics.height;
    if (!overlayWidth || !overlayHeight) {
        return;
    }
    const isResize = handle ? handle.contains(event.target) : false;
    signatureDragState = {
        mode: isResize ? 'resize' : 'move',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: boxRect.left - overlayRect.left,
        startTop: boxRect.top - overlayRect.top,
        startWidth: boxRect.width,
        startHeight: boxRect.height,
        overlayWidth,
        overlayHeight,
        minWidth: Math.max(30, overlayWidth * 0.05),
        minHeight: Math.max(20, overlayHeight * 0.04),
        aspectRatio: signatureAspectRatio || (boxRect.width / boxRect.height) || 1,
        lastRect: {
            left: boxRect.left - overlayRect.left,
            top: boxRect.top - overlayRect.top,
            width: boxRect.width,
            height: boxRect.height
        }
    };
    // Capturar el puntero en la caja para que solo la caja maneje el drag
    try {
        box.setPointerCapture(event.pointerId);
    } catch (err) {
        try { overlay.setPointerCapture && overlay.setPointerCapture(event.pointerId); } catch (e) { /* no-op */ }
    }
    box.classList.add('dragging');
}

function handleSignaturePointerMove(event) {
    // Solo procesar movimiento si estamos en un drag iniciado y sólo hay un puntero activo
    if (!signatureDragState || event.pointerId !== signatureDragState.pointerId) {
        return;
    }
    if (window._sigActivePointers && window._sigActivePointers.size > 1) {
        // Hay más de un puntero: no interferir con el gesto de pinch del navegador
        return;
    }
    const { box } = signatureOverlayElements;
    if (!box) {
        return;
    }
    event.preventDefault();
    const state = signatureDragState;
    const overlayWidth = state.overlayWidth || reinscriptionPreviewMetrics.width;
    const overlayHeight = state.overlayHeight || reinscriptionPreviewMetrics.height;
    if (!overlayWidth || !overlayHeight) {
        return;
    }
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    let left = state.startLeft;
    let top = state.startTop;
    let width = state.startWidth;
    let height = state.startHeight;
    if (state.mode === 'move') {
        left = Math.max(0, Math.min(overlayWidth - width, state.startLeft + deltaX));
        top = Math.max(0, Math.min(overlayHeight - height, state.startTop + deltaY));
    } else {
        const ratio = state.aspectRatio || 1;
        width = Math.max(state.minWidth, state.startWidth + deltaX);
        height = width / ratio;
        if (state.startTop + height > overlayHeight) {
            height = overlayHeight - state.startTop;
            width = height * ratio;
        }
        if (state.startLeft + width > overlayWidth) {
            width = overlayWidth - state.startLeft;
            height = width / ratio;
        }
        width = Math.max(state.minWidth, Math.min(width, overlayWidth - state.startLeft));
        height = Math.max(state.minHeight, Math.min(height, overlayHeight - state.startTop));
    }
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    signatureDragState.lastRect = { left, top, width, height };
}

function handleSignaturePointerUp(event) {
    // Siempre remover el puntero del conjunto activo
    try { if (window._sigActivePointers) window._sigActivePointers.delete(event.pointerId); } catch (e) { }
    if (!signatureDragState || event.pointerId !== signatureDragState.pointerId) {
        return;
    }
    event.preventDefault();
    const { overlay, box } = signatureOverlayElements;
    const state = signatureDragState;
    if (box) {
        try {
            box.releasePointerCapture(event.pointerId);
        } catch (error) {
            try { overlay && overlay.releasePointerCapture && overlay.releasePointerCapture(event.pointerId); } catch (e) { /* sin acción */ }
        }
    }
    if (box) {
        box.classList.remove('dragging');
    }
    const finalRect = state.lastRect || {
        left: state.startLeft,
        top: state.startTop,
        width: state.startWidth,
        height: state.startHeight
    };
    const overlayWidth = state.overlayWidth || reinscriptionPreviewMetrics.width;
    const overlayHeight = state.overlayHeight || reinscriptionPreviewMetrics.height;
    signatureDragState = null;
    if (!overlayWidth || !overlayHeight) {
        return;
    }
    updateSignatureLayoutFromOverlay(finalRect, overlayWidth, overlayHeight, false);
}

function handleSignaturePointerDownMobile(event) {
    if (!reinscriptionSignatureDataUrl) {
        return;
    }
    // No procesar si se hace click en el botón X
    if (event.target && event.target.classList && event.target.classList.contains('reinscription-signature-remove')) {
        return;
    }
    const overlayMobile = document.getElementById('reinscriptionSignatureOverlayMobile');
    const boxMobile = document.getElementById('reinscriptionSignatureBoxMobile');
    const handleMobile = document.getElementById('reinscriptionSignatureResizeMobile');

    if (!overlayMobile || !boxMobile) {
        return;
    }
    if (!boxMobile.contains(event.target)) {
        return;
    }
    if (!window._sigActivePointers) window._sigActivePointers = new Set();
    if (!window._sigPointerMap) window._sigPointerMap = new Map();
    window._sigActivePointers.add(event.pointerId);
    // Registrar la posición inicial del puntero en el mapa
    window._sigPointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
    // Si hay más de un puntero táctil, inicializar un gesto pinch manejado por la app
    if (isTouch && window._sigActivePointers.size > 1) {
        const overlayRect = overlayMobile.getBoundingClientRect();
        const boxRect = boxMobile.getBoundingClientRect();
        const pointersArr = Array.from(window._sigPointerMap.values());
        if (pointersArr.length >= 2) {
            const p0 = pointersArr[0];
            const p1 = pointersArr[1];
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const midX = (p0.x + p1.x) / 2;
            const midY = (p0.y + p1.y) / 2;
            const overlayW = overlayRect.width || reinscriptionPreviewMetrics.width;
            const overlayH = overlayRect.height || reinscriptionPreviewMetrics.height;
            signatureDragState = {
                mode: 'pinch',
                pointerId: null,
                startPinchDistance: dist,
                startMid: { x: midX, y: midY },
                startLeft: boxRect.left - overlayRect.left,
                startTop: boxRect.top - overlayRect.top,
                startWidth: boxRect.width,
                startHeight: boxRect.height,
                overlayWidth: overlayW,
                overlayHeight: overlayH,
                minWidth: Math.max(30, overlayW * 0.05),
                minHeight: Math.max(20, overlayH * 0.04),
                aspectRatio: signatureAspectRatio || (boxRect.width / boxRect.height) || 1,
                lastRect: {
                    left: boxRect.left - overlayRect.left,
                    top: boxRect.top - overlayRect.top,
                    width: boxRect.width,
                    height: boxRect.height
                },
                isMobile: true,
                startPointers: Array.from(window._sigPointerMap.entries()).slice(0, 2).map(([id, p]) => ({ id, x: p.x, y: p.y }))
            };
            try {
                boxMobile.setPointerCapture(event.pointerId);
            } catch (err) {
                try { overlayMobile.setPointerCapture && overlayMobile.setPointerCapture(event.pointerId); } catch (e) { /* no-op */ }
            }
            boxMobile.classList.add('dragging');
            return; // importante: no sobreescribir el estado de pinch
        }
    }
    event.preventDefault();
    const overlayRect = overlayMobile.getBoundingClientRect();
    const boxRect = boxMobile.getBoundingClientRect();
    const overlayWidth = overlayRect.width || reinscriptionPreviewMetrics.width;
    const overlayHeight = overlayRect.height || reinscriptionPreviewMetrics.height;
    if (!overlayWidth || !overlayHeight) {
        return;
    }
    const isResize = handleMobile ? handleMobile.contains(event.target) : false;
    signatureDragState = {
        mode: isResize ? 'resize' : 'move',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: boxRect.left - overlayRect.left,
        startTop: boxRect.top - overlayRect.top,
        startWidth: boxRect.width,
        startHeight: boxRect.height,
        overlayWidth,
        overlayHeight,
        minWidth: Math.max(30, overlayWidth * 0.05),
        minHeight: Math.max(20, overlayHeight * 0.04),
        aspectRatio: signatureAspectRatio || (boxRect.width / boxRect.height) || 1,
        lastRect: {
            left: boxRect.left - overlayRect.left,
            top: boxRect.top - overlayRect.top,
            width: boxRect.width,
            height: boxRect.height
        },
        isMobile: true
    };
    try {
        boxMobile.setPointerCapture(event.pointerId);
    } catch (err) {
        try { overlayMobile.setPointerCapture && overlayMobile.setPointerCapture(event.pointerId); } catch (e) { /* no-op */ }
    }
    boxMobile.classList.add('dragging');
}

function handleSignaturePointerMoveMobile(event) {
    // Actualizar posición del puntero en el mapa
    try {
        if (window._sigPointerMap) window._sigPointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
    } catch (e) { /* ignore */ }
    // Si estamos en gesto pinch personalizado, manejarlo aquí
    if (signatureDragState && signatureDragState.mode === 'pinch') {
        // Necesitamos al menos dos punteros registrados
        const ptrs = window._sigPointerMap ? Array.from(window._sigPointerMap.values()) : [];
        if (ptrs.length < 2) return;
        const entries = window._sigPointerMap ? Array.from(window._sigPointerMap.entries()).slice(0, 2) : [];
        if (entries.length < 2) return;
        const [e0, e1] = entries;
        const p0 = { id: e0[0], x: e0[1].x, y: e0[1].y };
        const p1 = { id: e1[0], x: e1[1].x, y: e1[1].y };
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // Escala basada en cambio de distancia: separación -> zoom in, acercamiento -> zoom out
        const startDist = signatureDragState.startPinchDistance || dist;
        let scale = dist / startDist;
        // Sensibilidad / límites
        const MIN_SCALE = 0.35;
        const MAX_SCALE = 3.0;
        // Ligeramente suavizar cambios pequeñas
        if (Math.abs(scale - 1) < 0.005) scale = 1;
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        const newWidth = Math.max(signatureDragState.minWidth, Math.min(signatureDragState.overlayWidth, Math.round(signatureDragState.startWidth * scale)));
        const newHeight = Math.max(signatureDragState.minHeight, Math.min(signatureDragState.overlayHeight, Math.round(newWidth / signatureDragState.aspectRatio)));
        // Centro actual del pinch
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        // Ajustar left/top para mantener el centro relativo
        const overlayRect = document.getElementById('reinscriptionSignatureOverlayMobile').getBoundingClientRect();
        const relMidX = midX - overlayRect.left;
        const relMidY = midY - overlayRect.top;
        const startCenterX = signatureDragState.startLeft + signatureDragState.startWidth / 2;
        const startCenterY = signatureDragState.startTop + signatureDragState.startHeight / 2;
        const dxCenter = relMidX - startCenterX;
        const dyCenter = relMidY - startCenterY;
        // El nuevo centro será startCenter + dxCenter * (scale)
        const newCenterX = startCenterX + dxCenter * scale;
        const newCenterY = startCenterY + dyCenter * scale;
        let left = Math.round(newCenterX - newWidth / 2);
        let top = Math.round(newCenterY - newHeight / 2);
        left = Math.max(0, Math.min(signatureDragState.overlayWidth - newWidth, left));
        top = Math.max(0, Math.min(signatureDragState.overlayHeight - newHeight, top));
        const boxMobile = document.getElementById('reinscriptionSignatureBoxMobile');
        if (boxMobile) {
            boxMobile.style.left = `${left}px`;
            boxMobile.style.top = `${top}px`;
            boxMobile.style.width = `${newWidth}px`;
            boxMobile.style.height = `${newHeight}px`;
        }
        signatureDragState.lastRect = { left, top, width: newWidth, height: newHeight };
        return;
    }

    // Si no hay estado de drag o el evento no pertenece al puntero activo, ignorar
    if (!signatureDragState || (signatureDragState.pointerId && event.pointerId !== signatureDragState.pointerId)) {
        return;
    }
    const boxMobile = document.getElementById('reinscriptionSignatureBoxMobile');
    if (!boxMobile) {
        return;
    }
    const state = signatureDragState;
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    let left = state.startLeft + deltaX;
    let top = state.startTop + deltaY;
    let width = state.startWidth;
    let height = state.startHeight;
    const { overlayWidth, overlayHeight } = state;
    if (state.mode === 'move') {
        left = Math.max(0, Math.min(left, overlayWidth - width));
        top = Math.max(0, Math.min(top, overlayHeight - height));
    } else if (state.mode === 'resize') {
        const ratio = state.aspectRatio || 1;
        width = Math.max(state.minWidth, state.startWidth + deltaX);
        height = width / ratio;
        if (state.startTop + height > overlayHeight) {
            height = overlayHeight - state.startTop;
            width = height * ratio;
        }
        if (state.startLeft + width > overlayWidth) {
            width = overlayWidth - state.startLeft;
            height = width / ratio;
        }
        width = Math.max(state.minWidth, Math.min(width, overlayWidth - state.startLeft));
        height = Math.max(state.minHeight, Math.min(height, overlayHeight - state.startTop));
    }
    boxMobile.style.left = `${left}px`;
    boxMobile.style.top = `${top}px`;
    boxMobile.style.width = `${width}px`;
    boxMobile.style.height = `${height}px`;
    signatureDragState.lastRect = { left, top, width, height };
}

function handleSignaturePointerUpMobile(event) {
    try { if (window._sigActivePointers) window._sigActivePointers.delete(event.pointerId); } catch (e) { }
    try { if (window._sigPointerMap) window._sigPointerMap.delete(event.pointerId); } catch (e) { }
    // Si estábamos en pinch y otro puntero sigue activo, solo quitar este puntero
    if (signatureDragState && signatureDragState.mode === 'pinch') {
        const remaining = window._sigPointerMap ? window._sigPointerMap.size : 0;
        if (remaining >= 1) {
            // Si aún quedan dos punteros, no finalizar
            if (remaining >= 2) {
                return;
            }
            // Si quedó 1 puntero, convertimos a estado de 'move' con el puntero restante
            const remainingEntry = window._sigPointerMap && Array.from(window._sigPointerMap.keys())[0];
            signatureDragState = null; // forzar recalculo en next down if needed
            return;
        }
        // Si no quedan punteros, continuar para finalizar y guardar
    }
    if (!signatureDragState || (signatureDragState.pointerId && event.pointerId !== signatureDragState.pointerId)) {
        return;
    }
    event.preventDefault();
    const overlayMobile = document.getElementById('reinscriptionSignatureOverlayMobile');
    const boxMobile = document.getElementById('reinscriptionSignatureBoxMobile');
    const state = signatureDragState;
    if (boxMobile) {
        try {
            boxMobile.releasePointerCapture(event.pointerId);
        } catch (error) {
            try { overlayMobile && overlayMobile.releasePointerCapture && overlayMobile.releasePointerCapture(event.pointerId); } catch (e) { /* sin acción */ }
        }
    }
    if (boxMobile) {
        boxMobile.classList.remove('dragging');
    }
    const finalRect = state.lastRect || {
        left: state.startLeft,
        top: state.startTop,
        width: state.startWidth,
        height: state.startHeight
    };
    const overlayWidth = state.overlayWidth || reinscriptionPreviewMetrics.width;
    const overlayHeight = state.overlayHeight || reinscriptionPreviewMetrics.height;
    signatureDragState = null;
    if (!overlayWidth || !overlayHeight) {
        return;
    }
    updateSignatureLayoutFromOverlay(finalRect, overlayWidth, overlayHeight, true);
}

function getCurrentUserFullName() {
    if (window.__googleProfile && window.__googleProfile.name) {
        return window.__googleProfile.name;
    }
    const nameEl = document.getElementById('googleUserName');
    if (nameEl && nameEl.textContent) {
        const text = nameEl.textContent.trim();
        if (text) return text;
    }
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle && headerTitle.textContent) {
        const text = headerTitle.textContent.trim();
        if (text.startsWith('Horario de')) {
            return text.replace('Horario de', '').trim();
        }
    }
    return '';
}

function getCurrentUserEmail() {
    if (window.__googleProfile && window.__googleProfile.email) return window.__googleProfile.email;
    const circle = document.getElementById('googleProfileCircle');
    if (circle && circle.title) {
        const t = String(circle.title).trim();
        if (t && t.indexOf('@') > -1) return t;
    }
    return '';
}

function parseMatriculaFromEmail(email) {
    if (!email || typeof email !== 'string') return '';
    email = email.trim().toLowerCase();
    // Aceptar dominios institucionales de UP Chiapas (ej: @ib.upchiapas.edu.mx, @upchiapas.edu.mx)
    const institutionalDomainRegex = /@(?:[a-z0-9.-]*\.)?upchiapas\.edu\.mx$/i;
    if (!institutionalDomainRegex.test(email)) return '';
    const local = email.split('@')[0] || '';
    // Solo aceptar si la parte local es completamente numérica (matrícula)
    if (/^\d+$/.test(local)) return local;
    return '';
}

function autoFillReinscriptionMatriculaInput() {
    const input = document.getElementById('reinscriptionMatricula');
    if (!input) return;
    const current = (input.value || '').trim();
    if (current) return; // no sobreescribir valor ya ingresado
    const email = getCurrentUserEmail();
    const m = parseMatriculaFromEmail(email);
    if (m) {
        input.value = m;
    }
}

// Materias que no deben contarse como "cargadas" ni "adeudadas" (por ejemplo, Tutorías,
// grupos de convalidación o grupos especiales)
function isNonAcademicSubject(subject) {
    if (!subject) return false;
    const sid = (typeof subject.id !== 'undefined' && subject.id !== null) ? String(subject.id) : '';
    // Actualmente: Tutorías (id 69)
    if (sid === '69') return true;
    // Además, excluir materias cuyo grupo sea de convalidación o especial para la solicitud
    const groupRaw = subject.group != null ? String(subject.group).toLowerCase() : '';
    if (!groupRaw) return false;
    if (groupRaw.includes('convalid')) return true;
    if (groupRaw.includes('especial')) return true;
    return false;
}

function guessGroupFromSelectedSubjects() {
    if (!Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
        return '';
    }
    const counts = {};
    selectedSubjects.forEach(subject => {
        if (!subject || !subject.group) return;
        if (isNonAcademicSubject(subject)) return; // no usar Tutorías para inferir grupo
        const key = String(subject.group).trim();
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
    });
    let topGroup = '';
    let topCount = 0;
    Object.keys(counts).forEach(groupKey => {
        if (counts[groupKey] > topCount) {
            topGroup = groupKey;
            topCount = counts[groupKey];
        }
    });
    return topGroup;
}

function guessQuarterFromGroup(groupValue) {
    if (!groupValue) return '';
    const match = String(groupValue).match(/\d+/);
    if (!match || !match[0]) return '';
    return `${match[0]}°`;
}

function findMissingScheduledSubjectNames() {
    const referenceSubjects = Array.isArray(predefinedSubjects) && predefinedSubjects.length
        ? predefinedSubjects
        : Array.isArray(catalogSubjects) ? catalogSubjects : [];
    if (!referenceSubjects.length) {
        return '';
    }
    const selectedIds = new Set();
    selectedSubjects.forEach(subject => {
        if (!subject) return;
        if (isNonAcademicSubject(subject)) return; // no considerar Tutorías como materia normal
        if (typeof subject.id === 'undefined' || subject.id === null) return;
        selectedIds.add(String(subject.id));
    });

    const missingNames = [];
    const seen = {};
    referenceSubjects.forEach(subject => {
        if (!subject) return;
        if (isNonAcademicSubject(subject)) return; // no marcar Tutorías como "adeudada"
        const subjectId = typeof subject.id !== 'undefined' && subject.id !== null ? String(subject.id) : null;
        if (subjectId && selectedIds.has(subjectId)) {
            return;
        }
        const nameCandidate = subject.name ? String(subject.name).trim() : '';
        if (!nameCandidate) {
            return;
        }
        const key = nameCandidate.toLowerCase();
        if (!seen[key]) {
            missingNames.push(nameCandidate);
            seen[key] = true;
        }
    });
    return missingNames.length > 0 ? missingNames.join(', ') : '';
}

// Calcula la materia adeudada priorizando la lista por defecto `DEFAULT_BIOMEDICA_SUBJECT_IDS`.
// Devuelve un string con los nombres faltantes (separados por ', ') o cadena vacía.
function computeAutoDebtSubject() {
    try {
        if (!Array.isArray(DEFAULT_BIOMEDICA_SUBJECT_IDS) || DEFAULT_BIOMEDICA_SUBJECT_IDS.length === 0) return '';
        // Construir set de ids seleccionados (como strings) para comparaciones
        const selectedIds = new Set((Array.isArray(selectedSubjects) ? selectedSubjects : []).map(s => {
            if (!s || isNonAcademicSubject(s)) return null;
            return (typeof s.id !== 'undefined' && s.id !== null) ? String(s.id) : null;
        }));
        const names = [];
        DEFAULT_BIOMEDICA_SUBJECT_IDS.forEach(defId => {
            try {
                const sid = defId == null ? null : String(defId);
                if (!sid) return;
                if (selectedIds.has(sid)) return; // ya está en horario
                // Buscar en predefinedSubjects primero, luego en catalogSubjects
                let subj = null;
                if (Array.isArray(predefinedSubjects) && predefinedSubjects.length) {
                    subj = predefinedSubjects.find(x => String(x.id) === sid) || null;
                }
                if (!subj && Array.isArray(catalogSubjects) && catalogSubjects.length) {
                    subj = catalogSubjects.find(x => String(x.id) === sid) || null;
                }
                if (subj && !isNonAcademicSubject(subj) && subj.name) { // no incluir Tutorías como adeudada
                    const name = String(subj.name).trim();
                    if (name) names.push(name);
                }
            } catch (e) { /* ignore per-item errors */ }
        });
        return names.length > 0 ? names.join(', ') : '';
    } catch (e) {
        console.warn('computeAutoDebtSubject error', e);
        return '';
    }
}

function buildLoadedSubjectsSummary() {
    if (!Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
        return '';
    }
    const lines = ['\t '];
    selectedSubjects.forEach(subject => {
        if (!subject) return;
        if (isNonAcademicSubject(subject)) return; // no listar Tutorías como materia cargada
        const name = subject.name ? String(subject.name).trim() : '';
        const group = subject.group != null ? String(subject.group).trim() : '';
        if (!name) {
            return;
        }
        lines.push(`${name}\t${group || '-'}`);
    });
    if (lines.length <= 1) {
        return '';
    }
    return lines.join('\n');
}

function buildReinscriptionDefaults() {
    const currentCareer = typeof getSelectedCareerOption === 'function' ? getSelectedCareerOption() : null;
    const group = guessGroupFromSelectedSubjects();
    const quarter = guessQuarterFromGroup(group);
    // Priorizar cálculo basado en DEFAULT_BIOMEDICA_SUBJECT_IDS para mayor consistencia
    const debtSubject = (typeof computeAutoDebtSubject === 'function' ? computeAutoDebtSubject() : '') || findMissingScheduledSubjectNames();
    // intentar detectar matrícula desde el correo institucional
    const detectedEmail = getCurrentUserEmail();
    const detectedMatricula = parseMatriculaFromEmail(detectedEmail) || '';
    return {
        fullName: getCurrentUserFullName() || '',
        matricula: detectedMatricula,
        career: currentCareer && currentCareer.name ? currentCareer.name : 'Biomédica',
        quarter: quarter || '',
        group: group || '',
        debtSubject: debtSubject || '',
        autoDebtSubject: debtSubject || '',
        signatureDataUrl: reinscriptionSignatureDataUrl || null,
        tutorEmail: reinscriptionLastFormValues && reinscriptionLastFormValues.tutorEmail ? reinscriptionLastFormValues.tutorEmail : '',
        tutorMessage: reinscriptionLastFormValues && reinscriptionLastFormValues.tutorMessage ? reinscriptionLastFormValues.tutorMessage : ''
    };
}

function updateReinscriptionLoadedSubjectsList() {
    const container = document.getElementById('reinscriptionLoadedSubjectsList');
    if (!container) {
        return;
    }
    const subjects = (Array.isArray(selectedSubjects) ? selectedSubjects : []).filter(s => !isNonAcademicSubject(s));
    if (!subjects.length) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    container.innerHTML = '';
    container.setAttribute('aria-label', 'Materias cargadas en el horario');

    const title = document.createElement('div');
    title.className = 'reinscription-loaded-subjects__title';
    title.textContent = `Materias cargadas (${subjects.length})`;
    container.appendChild(title);

    const header = document.createElement('div');
    header.className = 'reinscription-loaded-subjects__header';
    header.innerHTML = '<span>Materia</span><span>Grupo</span>';
    container.appendChild(header);

    subjects.forEach(subject => {
        if (!subject) {
            return;
        }
        const name = subject.name ? String(subject.name).trim() : '';
        const group = subject.group != null ? String(subject.group).trim() : '';
        if (!name) {
            return;
        }
        const row = document.createElement('div');
        row.className = 'reinscription-loaded-subjects__row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'reinscription-loaded-subjects__name';
        nameSpan.textContent = name;

        const groupSpan = document.createElement('span');
        groupSpan.className = 'reinscription-loaded-subjects__group';
        groupSpan.textContent = group || '-';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'reinscription-loaded-subjects__remove';
        removeBtn.textContent = 'Quitar';
        removeBtn.setAttribute('aria-label', `Quitar ${name} del horario`);
        removeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            removeFromSchedule(subject.id);
        });

        row.appendChild(nameSpan);
        row.appendChild(groupSpan);
        row.appendChild(removeBtn);
        container.appendChild(row);
    });
}

// Función para generar la estructura de la tabla de horarios
function generateScheduleTable() {
    const scheduleTable = document.querySelector('.schedule-table');
    const scheduleBody = document.getElementById('scheduleBody');
    if (!scheduleTable || !scheduleBody) return;

    // Ajustar cabecera según si el horario incluye sábado o no
    const thead = scheduleTable.tHead;
    if (thead && thead.rows.length > 0) {
        const headerRow = thead.rows[0];
        const existingSaturdayTh = headerRow.querySelector('th[data-day="sabado"]');
        if (scheduleHasSaturday) {
            if (!existingSaturdayTh) {
                const thSat = document.createElement('th');
                thSat.textContent = 'Sábado';
                thSat.dataset.day = 'sabado';
                headerRow.appendChild(thSat);
            }
        } else if (existingSaturdayTh) {
            headerRow.removeChild(existingSaturdayTh);
        }
    }

    scheduleBody.innerHTML = '';

    hours.forEach(hour => {
        const row = document.createElement('tr');

        // Celda de hora
        const timeCell = document.createElement('td');
        timeCell.textContent = hour;
        timeCell.className = 'time-slot';
        row.appendChild(timeCell);

        // Celdas para cada día (Lunes-Viernes por defecto)
        days.forEach(day => {
            const dayCell = document.createElement('td');
            // Modificado para trabajar con el nuevo formato de hora
            const hourKey = hour.split('-')[0]; // Obtener solo la hora de inicio
            dayCell.id = `${day}-${hourKey.replace(':', '')}`;
            row.appendChild(dayCell);
        });

        // Si el horario semanal incluye sábado, añadimos también su celda en la tabla principal
        if (scheduleHasSaturday) {
            const hourKey = hour.split('-')[0];
            const saturdayCell = document.createElement('td');
            saturdayCell.id = `sabado-${hourKey.replace(':', '')}`;
            row.appendChild(saturdayCell);
        }

        scheduleBody.appendChild(row);
    });

    // Vincular tooltips a las celdas (se puede llamar varias veces sin duplicar handlers)
    setupScheduleCellTooltips();
}

// Actualizar la vista del catálogo de materias
function updateCatalogSubjects() {
    const catalogDiv = document.getElementById('catalogSubjects');
    if (!catalogDiv) return;
    catalogDiv.innerHTML = '';

    // obtener ids de custom guardadas para mostrar el botón eliminar sólo en esas
    const customs = loadCustomSubjects();
    const customIds = new Set(customs.map(c => c.id));

    // NUEVO: ocultar del catálogo las materias que ya están cargadas en el horario
    const selectedIds = new Set(selectedSubjects.map(s => s.id));

    catalogSubjects.forEach(subject => {
        // Si la materia ya está en el horario, no la mostramos en el catálogo
        if (selectedIds.has(subject.id)) {
            return;
        }

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

        // Manejar click/drag personalizado desde el catálogo
        subjectItem.addEventListener('mousedown', function (event) {
            handleCatalogSubjectMouseDown(event, subject, subjectItem);
        });

        // si la materia está en customIds mostramos botón X para eliminarla del catálogo
        if (customIds.has(subject.id)) {
            // BOTÓN EDITAR
            const editBtn = document.createElement('button');
            editBtn.className = 'catalog-edit';
            editBtn.type = 'button'; // evitar submit por accidente
            editBtn.setAttribute('aria-label', 'Editar materia');
            editBtn.title = 'Editar materia';
            editBtn.textContent = '✎';
            editBtn.addEventListener('click', function (e) {
                e.stopPropagation();

                // Recuperar el ID de la materia seleccionada
                const subjectId = subject.id;

                // Buscar la materia en el catálogo
                const selectedSubject = catalogSubjects.find(s => s.id === subjectId);

                if (selectedSubject) {
                    // Preparar el modal con los datos de la materia seleccionada
                    editingSubjectId = subjectId;
                    openAddModal();

                    // Rellenar los campos del modal con los datos de la materia
                    m_inputMateria.value = selectedSubject.name || '';
                    m_inputProfesor.value = selectedSubject.professor || '';

                    try { m_inputGrupo.value = selectedSubject.group || ''; } catch (e) { }
                    try { if (typeof m_inputAula !== 'undefined') m_inputAula.value = selectedSubject.aula || ''; } catch (e) { }

                    // Preparar los horarios seleccionados para mostrarlos en el modal
                    selectedSlots = new Set();
                    (selectedSubject.sessions || []).forEach(session => {
                        if (session && session.day && session.startTime) {
                            selectedSlots.add(`${session.day}|${session.startTime}`);
                        }
                    });

                    // Actualizar el resumen de horarios en el modal
                    updateSlotsResumen();
                } else {
                    showMessage('No se pudo encontrar la materia seleccionada.', 'error');
                }
            });
            subjectItem.appendChild(editBtn);

            const delBtn = document.createElement('button');
            delBtn.className = 'catalog-delete';
            delBtn.title = 'Eliminar materia del catálogo';
            delBtn.textContent = '×';
            // evitar que el click en la X dispare el click del item
            delBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!confirm(`¿Eliminar la materia "${subject.name}" del catálogo? Esta acción quitará la materia creada.`)) return;

                // quitar de custom storage
                const newCustoms = customs.filter(c => c.id !== subject.id);
                saveCustomSubjects(newCustoms);

                // Reconstruir catálogo (predefinidos + customs actualizados)
                rebuildCatalogFromPredefinedAndCustoms();

                // si estaba en el horario seleccionado, quitarla también
                if (selectedSubjects.some(s => s.id === subject.id)) {
                    removeFromSchedule(subject.id);
                }

                // Guardar inmediatamente en Drive el cambio en el catálogo
                ensureSaveToDrive({ interactive: true, successMessage: 'Cambio correctamente' })
                    .then(ok => {
                        if (!ok) {
                            console.warn('No se pudo eliminar en Drive');
                        }
                    });

                // refrescar vista del catálogo
                updateCatalogSubjects();
                showMessage(`Materia "${subject.name}" eliminada del catálogo.`, 'success');
            });
            subjectItem.appendChild(delBtn);
        }

        catalogDiv.appendChild(subjectItem);
    });

    // Asegurar que los handlers de hover/click se (re)asignen a los items recién renderizados
    // de esta forma las materias creadas se pueden ver, añadir y eliminar inmediatamente.
    setupFloatingPreview();
}

// Función para agregar previsualización flotante al pasar el mouse
function setupFloatingPreview() {
    const preview = document.getElementById('floatingPreview');

    document.addEventListener('mousemove', function (e) {
        // Mover la previsualización con el cursor
        if (!preview.classList.contains('hidden')) {
            preview.style.left = `${e.pageX + 15}px`;
            preview.style.top = `${e.pageY + 15}px`;
        }
    });

    // Configurar eventos de hover en los elementos del catálogo
    const catalogs = document.querySelectorAll('.subject-item');
    catalogs.forEach(item => {
        item.addEventListener('mouseenter', function () {
            const subjectId = parseInt(this.getAttribute('data-subject-id'));
            const subject = catalogSubjects.find(s => s.id === subjectId);

            if (subject) {
                // Mostrar información en la previsualización (AHORA INCLUYE AULA por sesión)
                preview.innerHTML = `
                            <strong>${subject.name}</strong><br>
                            Prof: ${subject.professor}<br>
                            <div style="margin-top: 5px;">
                                ${subject.sessions.map(session =>
                    `${capitalizeFirstLetter(session.day)} ${session.startTime}-${session.endTime} — Aula: ${subject.aula || '-'}`
                ).join('<br>')}
                            </div>
                        `;
                preview.classList.remove('hidden');
                // Mostrar también la barra de ayuda básica al hacer hover
                if (typeof showDragHintBar === 'function') {
                    showDragHintBar('drag');
                }
            }
        });

        item.addEventListener('mouseleave', function () {
            preview.classList.add('hidden');
            // Si no hay un arrastre activo, ocultar la barra al salir del hover
            if (!catalogDragState || !catalogDragState.isActive) {
                if (typeof hideDragHintBar === 'function') {
                    hideDragHintBar();
                }
            }
        });
    });
}

// ================== DRAG & DROP PERSONALIZADO DESDE EL CATÁLOGO AL HORARIO ==================

const CATALOG_DRAG_THRESHOLD_PX = 1;
const catalogDragState = {
    isActive: false,
    subject: null,
    sourceEl: null,
    ghostEl: null,
    startX: 0,
    startY: 0,
    overSchedule: false,
    hasMoved: false
};

function handleCatalogSubjectMouseDown(event, subject, sourceEl) {
    // Solo botón izquierdo y evitar que los clics en botones internos inicien drag
    if (event.button !== 0) return;
    if (event.target.closest('.catalog-edit') || event.target.closest('.catalog-delete')) return;

    event.preventDefault();

    catalogDragState.isActive = true;
    catalogDragState.subject = subject;
    catalogDragState.sourceEl = sourceEl;
    catalogDragState.startX = event.clientX;
    catalogDragState.startY = event.clientY;
    catalogDragState.ghostEl = null;
    catalogDragState.overSchedule = false;
    catalogDragState.hasMoved = false;

    // Bajar un poco la opacidad del original para indicar que se está "levantando"
    if (catalogDragState.sourceEl) {
        catalogDragState.sourceEl.style.opacity = '0.70';
    }

    // Mostrar mensaje inicial mientras se empieza a arrastrar la materia
    showDragHintBar('drag');

    document.addEventListener('mousemove', handleCatalogSubjectMouseMove);
    document.addEventListener('mouseup', handleCatalogSubjectMouseUp);
}

function createCatalogDragGhost(event) {
    if (!catalogDragState.sourceEl || catalogDragState.ghostEl) return;
    const ghost = catalogDragState.sourceEl.cloneNode(true);
    ghost.classList.add('subject-drag-ghost');
    // Usar posición fija para que siga claramente al cursor en la ventana
    ghost.style.position = 'fixed';
    ghost.style.left = (event.clientX + 10) + 'px';
    ghost.style.top = (event.clientY + 10) + 'px';
    document.body.appendChild(ghost);
    catalogDragState.ghostEl = ghost;
}

function updateCatalogDragGhostPosition(event) {
    if (!catalogDragState.ghostEl) return;
    // Seguir el cursor con un pequeño offset
    catalogDragState.ghostEl.style.left = (event.clientX + 10) + 'px';
    catalogDragState.ghostEl.style.top = (event.clientY + 10) + 'px';
}

function handleCatalogSubjectMouseMove(event) {
    if (!catalogDragState.isActive || !catalogDragState.subject) return;

    const dx = event.clientX - catalogDragState.startX;
    const dy = event.clientY - catalogDragState.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!catalogDragState.ghostEl && distance >= CATALOG_DRAG_THRESHOLD_PX) {
        createCatalogDragGhost(event);
        const preview = document.getElementById('floatingPreview');
        if (preview) preview.classList.add('hidden');
    }

    if (distance >= CATALOG_DRAG_THRESHOLD_PX) {
        catalogDragState.hasMoved = true;
    }

    if (catalogDragState.ghostEl) {
        updateCatalogDragGhostPosition(event);
    }

    // Auto-scroll vertical mientras se arrastra, según la posición del mouse
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const edgeThreshold = 60; // zona sensible cerca de los bordes
    const scrollAmount = 14; // píxeles por movimiento
    const y = event.clientY;

    if (y < edgeThreshold) {
        window.scrollBy(0, -scrollAmount);
    } else if (y > viewportHeight - edgeThreshold) {
        window.scrollBy(0, scrollAmount);
    }

    // Detectar si el puntero está sobre el contenedor del horario
    const scheduleContainer = document.getElementById('scheduleContainer');
    if (scheduleContainer) {
        const rect = scheduleContainer.getBoundingClientRect();
        const overScheduleNow = event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom;

        if (overScheduleNow && !catalogDragState.overSchedule) {
            catalogDragState.overSchedule = true;
            showScheduleDropPreviewForSubject(catalogDragState.subject);
            // Mensaje cuando ya llegó al horario
            showDragHintBar('drop');
        } else if (!overScheduleNow && catalogDragState.overSchedule) {
            catalogDragState.overSchedule = false;
            clearScheduleDropPreview();
            // Volver al mensaje de arrastre mientras aún no está sobre el horario
            showDragHintBar('drag');
        }
    }
}

function handleCatalogSubjectMouseUp(event) {
    if (!catalogDragState.isActive) return;

    document.removeEventListener('mousemove', handleCatalogSubjectMouseMove);
    document.removeEventListener('mouseup', handleCatalogSubjectMouseUp);

    const subject = catalogDragState.subject;
    const ghostEl = catalogDragState.ghostEl;

    const scheduleContainer = document.getElementById('scheduleContainer');
    let droppedOnSchedule = false;
    if (scheduleContainer) {
        const rect = scheduleContainer.getBoundingClientRect();
        droppedOnSchedule = event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    if (ghostEl && subject && droppedOnSchedule) {
        // Drop válido dentro del horario
        addSubjectToSchedule(subject.id);
    } else if (subject && !droppedOnSchedule && !catalogDragState.hasMoved) {
        // No hubo arrastre real: tratar como click rápido en el catálogo
        addSubjectToSchedule(subject.id);
    }

    if (ghostEl && ghostEl.parentNode) {
        ghostEl.parentNode.removeChild(ghostEl);
    }
    clearScheduleDropPreview();
    hideDragHintBar();

    catalogDragState.isActive = false;
    catalogDragState.subject = null;
    if (catalogDragState.sourceEl) {
        catalogDragState.sourceEl.style.opacity = '';
    }
    catalogDragState.sourceEl = null;
    catalogDragState.ghostEl = null;
    catalogDragState.overSchedule = false;
    catalogDragState.hasMoved = false;
}

function showScheduleDropPreviewForSubject(subject) {
    clearScheduleDropPreview();
    if (!subject || !Array.isArray(subject.sessions)) return;

    subject.sessions.forEach(session => {
        if (!session || !session.day || !session.startTime || !session.endTime) return;

        const start = parseTime(session.startTime);
        const end = parseTime(session.endTime);

        hours.forEach(hour => {
            const parts = hour.split('-');
            if (parts.length !== 2) return;
            const slotStart = parseTime(parts[0]);
            const slotEnd = parseTime(parts[1]);

            if (start < slotEnd && end > slotStart) {
                const hourKey = parts[0];
                const cellId = `${session.day}-${hourKey.replace(':', '')}`;
                const cell = document.getElementById(cellId);
                if (cell) {
                    cell.classList.add('schedule-drop-preview');

                    // Añadir una tarjeta de vista previa con el nombre y color del grupo,
                    // similar a como se verá al cargarse, pero con menos intensidad.
                    let previewCard = cell.querySelector('.subject-card-drop-preview');
                    if (!previewCard) {
                        previewCard = document.createElement('div');
                        previewCard.className = 'subject-card subject-card-drop-preview';

                        const rawGroupLabel = subject.group ? String(subject.group) : '';
                        const groupLabel = rawGroupLabel.trim().toLowerCase();

                        if (groupLabel === '7a') {
                            previewCard.classList.add('group-7A');
                        } else if (groupLabel.includes('convalid')) {
                            previewCard.classList.add('group-convalidacion');
                        } else if (groupLabel.includes('especial')) {
                            previewCard.classList.add('group-especial');
                        }

                        previewCard.textContent = subject.name;
                        cell.appendChild(previewCard);
                    }
                }
            }
        });
    });
}

function clearScheduleDropPreview() {
    const highlighted = document.querySelectorAll('.schedule-drop-preview');
    highlighted.forEach(cell => cell.classList.remove('schedule-drop-preview'));

    const previewCards = document.querySelectorAll('.subject-card-drop-preview');
    previewCards.forEach(card => {
        if (card.parentNode) {
            card.parentNode.removeChild(card);
        }
    });
}

function showDragHintBar(mode) {
    const bar = document.getElementById('dragHintBar');
    if (!bar) return;
    if (mode === 'drop') {
        bar.textContent = 'Suéltala sobre el horario para agregarla.';
    } else {
        bar.textContent = 'Arrastra la materia hasta el horario y suéltala para agregarla o simplemente haga click.';
    }
    bar.classList.remove('hidden');
}

function hideDragHintBar() {
    const bar = document.getElementById('dragHintBar');
    if (!bar) return;
    bar.classList.add('hidden');
}

function applyReinscriptionValuesToForm(values) {
    if (!values) return;
    const assign = (id, value) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.value = value || '';
        if (id === 'reinscriptionDebtSubject') {
            const autoValue = values.autoDebtSubject || '';
            if (autoValue) {
                input.dataset.autoValue = autoValue;
            } else {
                delete input.dataset.autoValue;
            }
            if (!values.debtSubject) {
                input.dataset.userEdited = 'false';
            } else if (autoValue && values.debtSubject === autoValue) {
                input.dataset.userEdited = 'false';
            } else {
                input.dataset.userEdited = 'true';
            }
        }
    };
    assign('reinscriptionFullName', values.fullName);
    assign('reinscriptionMatricula', values.matricula);
    assign('reinscriptionCareer', values.career);
    assign('reinscriptionQuarter', values.quarter);
    assign('reinscriptionGroup', values.group);
    // For the debt input prefer the auto-computed value; do not treat stored
    // user-entered debt as authoritative because we no longer persist it.
    const preferredDebt = (values.debtSubject && values.debtSubject.trim()) ? values.debtSubject : (values.autoDebtSubject || '');
    assign('reinscriptionDebtSubject', preferredDebt);
    assign('reinscriptionTutorEmail', values.tutorEmail);
    assign('reinscriptionTutorMessage', values.tutorMessage);
    // Tutor name hidden field and checkbox
    const tutorNameInput = document.getElementById('reinscriptionTutorName');
    const tutorDefaultCheckbox = document.getElementById('reinscriptionTutorDefault');
    if (tutorNameInput) tutorNameInput.value = values.tutorName || '';
    if (tutorDefaultCheckbox) tutorDefaultCheckbox.checked = !!values.tutorIsDefault;
    reinscriptionSignatureDataUrl = values.signatureDataUrl || null;
    // Si el snapshot trae firma del tutor, conservarla
    reinscriptionTutorSignatureDataUrl = values.tutorSignatureDataUrl || reinscriptionTutorSignatureDataUrl || null;
    updateReinscriptionSignaturePreview();
}

function collectReinscriptionFormData() {
    const nameInput = document.getElementById('reinscriptionFullName');
    if (!nameInput) return null;
    const matriculaInput = document.getElementById('reinscriptionMatricula');
    const careerInput = document.getElementById('reinscriptionCareer');
    const quarterInput = document.getElementById('reinscriptionQuarter');
    const groupInput = document.getElementById('reinscriptionGroup');
    const debtInput = document.getElementById('reinscriptionDebtSubject');
    const tutorEmailInput = document.getElementById('reinscriptionTutorEmail');
    const tutorMessageInput = document.getElementById('reinscriptionTutorMessage');
    const tutorSelect = document.getElementById('reinscriptionTutorSelect');
    const data = {
        fullName: nameInput.value.trim(),
        matricula: matriculaInput ? matriculaInput.value.trim() : '',
        career: careerInput ? careerInput.value.trim() : '',
        quarter: quarterInput ? quarterInput.value.trim() : '',
        group: groupInput ? groupInput.value.trim() : '',
        debtSubject: debtInput ? debtInput.value.trim() : '',
        signatureDataUrl: reinscriptionSignatureDataUrl || null,
        loadedSubjectsSummary: buildLoadedSubjectsSummary(),
        autoDebtSubject: '',
        tutorEmail: tutorEmailInput ? tutorEmailInput.value.trim() : '',
        tutorMessage: tutorMessageInput ? tutorMessageInput.value.trim() : '',
        tutorName: (document.getElementById('reinscriptionTutorName') || {}).value || '',
        tutorSignatureDataUrl: reinscriptionTutorSignatureDataUrl || null,
        tutorIsDefault: !!(document.getElementById('reinscriptionTutorDefault') || {}).checked,
        tutorId: tutorSelect ? (tutorSelect.value || '') : ''
    };

    // Asegurar que la carrera siempre coincida con la carrera seleccionada actualmente
    if (!data.career) {
        try {
            const currentCareer = typeof getSelectedCareerOption === 'function' ? getSelectedCareerOption() : null;
            if (currentCareer && currentCareer.name) {
                data.career = currentCareer.name;
                if (careerInput) {
                    careerInput.value = currentCareer.name;
                }
            }
        } catch (e) { /* silencioso */ }
    }
    if (debtInput && debtInput.dataset && debtInput.dataset.autoValue) {
        data.autoDebtSubject = debtInput.dataset.autoValue;
    } else if (reinscriptionLastFormValues && reinscriptionLastFormValues.autoDebtSubject) {
        data.autoDebtSubject = reinscriptionLastFormValues.autoDebtSubject;
    }
    reinscriptionLastFormValues = { ...data };
    saveReinscriptionFormSnapshot(reinscriptionLastFormValues);
    return data;
}

// Cargar una imagen desde una ruta relativa y devolver un dataURL (o null si falla).
// Primero intenta cargarla como <img> (funciona con archivos locales y servidores),
// y en caso de error intenta usar fetch como fallback.
async function loadImageDataUrlFromPath(path) {
    if (!path) return null;
    return await new Promise((resolve) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            let settled = false;
            img.onload = function () {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width || 1;
                    canvas.height = img.naturalHeight || img.height || 1;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    settled = true;
                    resolve(dataUrl);
                } catch (e) {
                    settled = true;
                    resolve(null);
                }
            };
            img.onerror = async function () {
                if (settled) return;
                // Fallback: intentar fetch -> blob -> dataURL
                try {
                    const res = await fetch(path);
                    if (!res.ok) {
                        settled = true;
                        resolve(null);
                        return;
                    }
                    const blob = await res.blob();
                    const reader = new FileReader();
                    reader.onload = () => { settled = true; resolve(reader.result); };
                    reader.onerror = () => { settled = true; resolve(null); };
                    reader.readAsDataURL(blob);
                } catch (err) {
                    settled = true;
                    resolve(null);
                }
            };
            // Asignar la fuente al final para iniciar la carga
            img.src = path;
            // Si la imagen ya está en caché y completa, el evento onload puede no dispararse en algunos navegadores,
            // por lo que comprobamos si está completa inmediatamente.
            if (img.complete && img.naturalWidth) {
                img.onload();
            }
        } catch (err) {
            resolve(null);
        }
    });
}

// Activa o desactiva la opción de tutor predeterminado (José)
async function setDefaultTutor(enabled) {
    const tutorEmailInput = document.getElementById('reinscriptionTutorEmail');
    const tutorNameInput = document.getElementById('reinscriptionTutorName');
    const tutorSelect = document.getElementById('reinscriptionTutorSelect');
    if (!tutorEmailInput || !tutorNameInput) return;

    if (enabled) {
        // Forzar selección de José en el selector si existe
        if (tutorSelect) {
            tutorSelect.value = 'vazquez';
        }
        tutorEmailInput.value = DEFAULT_TUTOR.email;
        tutorNameInput.value = DEFAULT_TUTOR.name;
        // Intentar cargar la firma desde la ruta indicada
        const dataUrl = await loadImageDataUrlFromPath(DEFAULT_TUTOR.signaturePath);
        if (dataUrl) {
            reinscriptionTutorSignatureDataUrl = dataUrl;
        } else {
            reinscriptionTutorSignatureDataUrl = reinscriptionTutorSignatureDataUrl || null;
        }
    } else {
        // Si desmarcó, limpiar los campos relacionados al tutor (no borrar mensaje)
        if (tutorSelect && tutorSelect.value === 'vazquez') {
            tutorSelect.value = '';
        }
        tutorEmailInput.value = '';
        tutorNameInput.value = '';
        reinscriptionTutorSignatureDataUrl = null;
    }

    // Actualizar datos en memoria y vista previa
    collectReinscriptionFormData();
    scheduleReinscriptionPreviewRender();
    const baseSnapshot = reinscriptionLastFormValues || {};
    saveReinscriptionFormSnapshot({
        ...baseSnapshot,
        tutorIsDefault: !!enabled,
        tutorSignatureDataUrl: reinscriptionTutorSignatureDataUrl
    });
}

// Al cambiar el tutor en el selector, actualizar correo, nombre y firma rápidamente
async function handleTutorSelectionChange() {
    const tutorSelect = document.getElementById('reinscriptionTutorSelect');
    const tutorEmailInput = document.getElementById('reinscriptionTutorEmail');
    const tutorNameInput = document.getElementById('reinscriptionTutorName');
    const tutorDefaultCheckbox = document.getElementById('reinscriptionTutorDefault');
    if (!tutorSelect || !tutorEmailInput || !tutorNameInput) return;

    const value = tutorSelect.value;
    let selectedTutor = getTutorById(value);

    // Si selecciona un tutor distinto de José, desmarcar el checkbox de predeterminado
    if (tutorDefaultCheckbox && selectedTutor && selectedTutor.id !== 'vazquez') {
        tutorDefaultCheckbox.checked = false;
    }

    if (!selectedTutor) {
        // Sin selección: limpiar solo nombre/firma (el correo puede quedarse si el usuario lo escribió)
        tutorNameInput.value = '';
        reinscriptionTutorSignatureDataUrl = null;
    } else {
        tutorEmailInput.value = selectedTutor.email || '';
        tutorNameInput.value = selectedTutor.name || '';
        reinscriptionTutorSignatureDataUrl = null;
        if (selectedTutor.signaturePath) {
            const dataUrl = await loadImageDataUrlFromPath(selectedTutor.signaturePath);
            reinscriptionTutorSignatureDataUrl = dataUrl || null;
        }
    }

    // Guardar datos y refrescar vista previa / PDF
    collectReinscriptionFormData();
    scheduleReinscriptionPreviewRender();
}

function updateReinscriptionSignaturePreview() {
    const wrapper = document.getElementById('reinscriptionSignaturePreviewWrapper');
    const img = document.getElementById('reinscriptionSignaturePreview');
    if (!wrapper || !img) return;
    setupReinscriptionSignatureOverlay();
    const overlayImage = signatureOverlayElements.image;
    const overlay = signatureOverlayElements.overlay;

    // Elementos móviles
    const overlayImageMobile = document.getElementById('reinscriptionSignatureOverlayImageMobile');
    const overlayMobile = document.getElementById('reinscriptionSignatureOverlayMobile');
    // No mostrar vista previa de la firma del tutor aquí

    if (reinscriptionSignatureDataUrl) {
        img.src = reinscriptionSignatureDataUrl;
        wrapper.classList.remove('hidden');
        if (overlayImage && overlayImage.src !== reinscriptionSignatureDataUrl) {
            overlayImage.src = reinscriptionSignatureDataUrl;
        }
        if (overlayImageMobile && overlayImageMobile.src !== reinscriptionSignatureDataUrl) {
            overlayImageMobile.src = reinscriptionSignatureDataUrl;
        }
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.setAttribute('aria-hidden', 'false');
        }
        if (overlayMobile) {
            overlayMobile.classList.remove('hidden');
            overlayMobile.setAttribute('aria-hidden', 'false');
        }
        updateSignatureOverlayPosition();
    } else {
        img.removeAttribute('src');
        wrapper.classList.add('hidden');
        if (overlayImage) {
            overlayImage.removeAttribute('src');
        }
        if (overlayImageMobile) {
            overlayImageMobile.removeAttribute('src');
        }
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('is-active');
            overlay.setAttribute('aria-hidden', 'true');
        }
        if (overlayMobile) {
            overlayMobile.classList.add('hidden');
            overlayMobile.classList.remove('is-active');
            overlayMobile.setAttribute('aria-hidden', 'true');
        }
        signatureAspectRatio = 1;
    }
}

function handleReinscriptionSignatureChange(event) {
    const file = event.target && event.target.files ? event.target.files[0] : null;
    if (!file) {
        reinscriptionSignatureDataUrl = null;
        if (reinscriptionLastFormValues) {
            reinscriptionLastFormValues.signatureDataUrl = null;
        }
        updateReinscriptionSignaturePreview();
        scheduleReinscriptionPreviewRender();
        return;
    }
    if (file.type !== 'image/png') {
        showMessage('La firma debe estar en formato PNG sin fondo.', 'warning');
        event.target.value = '';
        return;
    }
    if (file.size && file.size > 2 * 1024 * 1024) {
        showMessage('La firma es demasiado pesada. Utiliza un PNG menor a 2 MB.', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        reinscriptionSignatureDataUrl = loadEvent && loadEvent.target ? loadEvent.target.result : null;
        if (!reinscriptionLastFormValues) {
            reinscriptionLastFormValues = buildReinscriptionDefaults();
        }
        reinscriptionLastFormValues.signatureDataUrl = reinscriptionSignatureDataUrl;
        updateReinscriptionSignaturePreview();
        saveReinscriptionFormSnapshot(reinscriptionLastFormValues);
        scheduleReinscriptionPreviewRender();
    };
    reader.onerror = () => {
        showMessage('No se pudo leer el archivo de firma seleccionado.', 'error');
    };
    reader.readAsDataURL(file);
}

function clearReinscriptionSignature() {
    const input = document.getElementById('reinscriptionSignature');
    if (input) {
        input.value = '';
    }
    reinscriptionSignatureDataUrl = null;
    if (reinscriptionLastFormValues) {
        reinscriptionLastFormValues.signatureDataUrl = null;
        saveReinscriptionFormSnapshot(reinscriptionLastFormValues);
    }
    updateReinscriptionSignaturePreview();
    scheduleReinscriptionPreviewRender();
}

function adjustSignatureSize(factor) {
    if (!reinscriptionSignatureDataUrl) {
        return;
    }
    const layout = REINSCRIPTION_PDF_LAYOUT.signature || {};

    // Ajustar tamaño en porcentaje
    if (Number.isFinite(layout.widthPct)) {
        layout.widthPct = Math.max(0.05, Math.min(0.6, layout.widthPct * factor));
    }
    if (Number.isFinite(layout.heightPct)) {
        layout.heightPct = Math.max(0.03, Math.min(0.3, layout.heightPct * factor));
    }

    // Ajustar tamaño absoluto si existe
    if (Number.isFinite(layout.widthAbs)) {
        layout.widthAbs = Math.max(20, layout.widthAbs * factor);
    }
    if (Number.isFinite(layout.heightAbs)) {
        layout.heightAbs = Math.max(15, layout.heightAbs * factor);
    }

    saveSignaturePlacement(layout);
    updateSignatureOverlayPosition();
}

function scheduleReinscriptionPreviewRender() {
    if (reinscriptionPreviewRenderTimer) {
        clearTimeout(reinscriptionPreviewRenderTimer);
    }
    reinscriptionPreviewRenderTimer = setTimeout(() => {
        updateReinscriptionPreview().catch(err => {
            console.warn('No se pudo actualizar la vista previa de la solicitud', err);
        });
        reinscriptionPreviewRenderTimer = null;
    }, 220);
}

async function updateReinscriptionPreview() {
    const modal = document.getElementById('reinscriptionModal');
    if (!modal || modal.classList.contains('hidden')) {
        return;
    }
    const fallback = document.getElementById('reinscriptionPreviewFallback');
    if (!fallback) {
        return;
    }
    const data = collectReinscriptionFormData();
    if (!data || !data.fullName || !data.matricula || !data.career) {
        fallback.classList.remove('hidden');
        clearReinscriptionPreviewCanvas();
        return;
    }
    try {
        const pdfBytes = await generateReinscriptionPdf(data, { includeSignature: false });
        await renderReinscriptionPreviewCanvas(pdfBytes);
        fallback.classList.add('hidden');
    } catch (error) {
        console.error('No se pudo generar la vista previa de la solicitud', error);
        fallback.classList.remove('hidden');
        clearReinscriptionPreviewCanvas();
        showMessage('No se pudo generar la vista previa del formato. Revisa los datos e inténtalo de nuevo.', 'error');
    }
}

async function generateReinscriptionPdf(data, options = {}) {
    if (!data || !data.fullName) {
        throw new Error('Faltan datos obligatorios para el PDF');
    }
    const PDFLib = await ensurePdfLib();
    const templateBytes = await ensureReinscriptionTemplate();
    const pdfDoc = await PDFLib.PDFDocument.load(templateBytes.slice(0));
    const { StandardFonts, rgb } = PDFLib;
    const page = pdfDoc.getPages()[0];
    if (!page) {
        throw new Error('El formato de solicitud no tiene páginas.');
    }
    const width = page.getWidth();
    const height = page.getHeight();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    // Resolver, si es posible, qué tutor se está usando para aplicar overrides
    let resolvedTutorId = data.tutorId || '';
    if (!resolvedTutorId && data.tutorEmail) {
        const byEmail = getTutorByEmail(data.tutorEmail);
        if (byEmail) resolvedTutorId = byEmail.id;
    }
    if (!resolvedTutorId && data.tutorName) {
        const byName = getTutorByName(data.tutorName);
        if (byName) resolvedTutorId = byName.id;
    }
    const tutorLayoutOverride = resolvedTutorId && TUTOR_PDF_LAYOUT_OVERRIDES[resolvedTutorId]
        ? TUTOR_PDF_LAYOUT_OVERRIDES[resolvedTutorId]
        : null;
    const drawText = (text, layout, options = {}) => {
        if (text == null || text === '') return;
        const rawValue = typeof text === 'string' ? text : String(text);
        const font = options.font || regularFont;
        const fontSize = options.size || 12;
        const color = options.color || rgb(0, 0, 1);
        const baseX = layout.xPct != null ? width * layout.xPct : (layout.x != null ? layout.x : 40);
        const baseY = layout.yPct != null ? height * layout.yPct : (layout.y != null ? layout.y : height - 80);
        const maxWidth = layout.maxWidthPct ? width * layout.maxWidthPct : (layout.maxWidth || options.maxWidth || null);
        const lineHeight = layout.lineHeightPct ? height * layout.lineHeightPct : (options.lineHeight || fontSize * 1.25);
        const maxLinesSetting = layout.maxLines != null ? layout.maxLines : options.maxLines;
        const maxLines = Number.isFinite(maxLinesSetting) && maxLinesSetting > 0 ? maxLinesSetting : Infinity;
        const allowWrapping = !!maxWidth && maxWidth > 0;

        const measureText = (valueToMeasure) => {
            const sanitized = valueToMeasure.replace(/\t/g, '    ');
            return font.widthOfTextAtSize(sanitized, fontSize);
        };

        const lines = [];
        let truncated = false;

        const appendLine = (line) => {
            if (lines.length < maxLines) {
                lines.push(line);
            } else if (lines.length > 0) {
                const lastIndex = lines.length - 1;
                lines[lastIndex] = `${lines[lastIndex]} ${line}`.trim();
                truncated = true;
            }
        };

        const wrapSegment = (segment) => {
            if (!allowWrapping || segment.includes('\t')) {
                appendLine(segment);
                return;
            }
            const words = segment.split(/\s+/).filter(Boolean);
            if (!words.length) {
                appendLine('');
                return;
            }
            let currentLine = '';
            words.forEach(word => {
                if (lines.length >= maxLines && truncated) {
                    return;
                }
                const candidate = currentLine ? `${currentLine} ${word}` : word;
                if (measureText(candidate) <= maxWidth || !currentLine) {
                    currentLine = candidate;
                } else {
                    appendLine(currentLine);
                    currentLine = word;
                }
            });
            if (currentLine) {
                appendLine(currentLine);
            }
        };

        const segments = rawValue.split(/\r?\n/);
        segments.forEach(segment => {
            if (lines.length >= maxLines && truncated) {
                return;
            }
            if (allowWrapping) {
                wrapSegment(segment);
            } else {
                appendLine(segment);
            }
        });

        if (!lines.length) {
            lines.push(rawValue);
        }

        if (truncated && lines.length) {
            const lastIndex = lines.length - 1;
            if (!lines[lastIndex].endsWith('...')) {
                lines[lastIndex] = `${lines[lastIndex]}...`;
            }
        }

        const tabStopsPct = Array.isArray(layout.tabStopsPct) ? layout.tabStopsPct : null;
        const singleTabStopPct = !tabStopsPct && layout.tabStopPct != null ? [layout.tabStopPct] : null;
        const tabOffsetPct = layout.tabOffsetPct != null ? layout.tabOffsetPct : null;
        const tabOffsetAbs = layout.tabOffset != null ? layout.tabOffset : null;

        const computeTabX = (tabIndex) => {
            if (tabStopsPct && tabStopsPct.length) {
                const index = Math.min(tabIndex, tabStopsPct.length - 1);
                return width * tabStopsPct[index];
            }
            if (singleTabStopPct && singleTabStopPct.length) {
                return width * singleTabStopPct[0];
            }
            if (tabOffsetPct != null) {
                return baseX + (width * tabOffsetPct);
            }
            if (tabOffsetAbs != null) {
                return baseX + tabOffsetAbs;
            }
            if (maxWidth) {
                return baseX + Math.max(80, maxWidth * 0.6);
            }
            return baseX + 220;
        };

        lines.forEach((line, index) => {
            const rawLine = typeof line === 'string' ? line : String(line);
            const trimmedLine = rawLine.trim();
            if (!trimmedLine && index > 0) {
                return;
            }
            const yPosition = baseY - (index * lineHeight);
            if (rawLine.includes('\t')) {
                const columns = rawLine.split('\t');
                columns.forEach((columnText, columnIndex) => {
                    const textToDraw = columnText.trim();
                    if (!textToDraw) {
                        return;
                    }
                    const xPosition = columnIndex === 0 ? baseX : computeTabX(columnIndex - 1);
                    page.drawText(textToDraw, {
                        x: xPosition,
                        y: yPosition,
                        size: fontSize,
                        font,
                        color
                    });
                });
            } else {
                page.drawText(trimmedLine, {
                    x: baseX,
                    y: yPosition,
                    size: fontSize,
                    font,
                    color
                });
            }
        });
    };

    drawText(data.fullName, REINSCRIPTION_PDF_LAYOUT.fullName);
    drawText(data.matricula, REINSCRIPTION_PDF_LAYOUT.matricula);
    drawText(data.career, REINSCRIPTION_PDF_LAYOUT.career);
    drawText(data.quarter, REINSCRIPTION_PDF_LAYOUT.quarter);
    drawText(data.group, REINSCRIPTION_PDF_LAYOUT.group);
    drawText(data.debtSubject, REINSCRIPTION_PDF_LAYOUT.debtSubject);
    drawText(data.loadedSubjectsSummary, REINSCRIPTION_PDF_LAYOUT.loadedSubjects, { size: 11 });

    const includeSignature = options.includeSignature !== false;
    if (includeSignature && data.signatureDataUrl) {
        try {
            const response = await fetch(data.signatureDataUrl);
            const signatureBuffer = await response.arrayBuffer();
            const signatureImage = await pdfDoc.embedPng(signatureBuffer);
            const layout = REINSCRIPTION_PDF_LAYOUT.signature || {};
            const defaultSignatureLayout = REINSCRIPTION_PDF_LAYOUT_DEFAULTS.signature || {};
            const imageRatio = signatureImage.width && signatureImage.height ? signatureImage.width / signatureImage.height : null;
            const hasAbsoluteSize = Number.isFinite(layout.widthAbs) && layout.widthAbs > 0 && Number.isFinite(layout.heightAbs) && layout.heightAbs > 0;
            let targetWidth;
            let targetHeight;

            if (hasAbsoluteSize) {
                targetWidth = layout.widthAbs;
                targetHeight = layout.heightAbs;
            } else {
                const fallbackWidthPct = Number.isFinite(layout.widthPct) ? layout.widthPct : (Number.isFinite(defaultSignatureLayout.widthPct) ? defaultSignatureLayout.widthPct : 0.25);
                const fallbackHeightPct = Number.isFinite(layout.heightPct) ? layout.heightPct : (Number.isFinite(defaultSignatureLayout.heightPct) ? defaultSignatureLayout.heightPct : null);
                targetWidth = fallbackWidthPct ? width * fallbackWidthPct : signatureImage.width;
                if (fallbackHeightPct) {
                    const candidateHeight = height * fallbackHeightPct;
                    if (imageRatio) {
                        const heightFromWidth = targetWidth / imageRatio;
                        if (heightFromWidth > candidateHeight + 0.5) {
                            targetHeight = candidateHeight;
                            targetWidth = candidateHeight * imageRatio;
                        } else {
                            targetHeight = heightFromWidth;
                        }
                    } else {
                        targetHeight = candidateHeight;
                    }
                } else if (imageRatio) {
                    targetHeight = targetWidth / imageRatio;
                } else {
                    targetHeight = signatureImage.height;
                }
            }

            if (!Number.isFinite(targetWidth) || targetWidth <= 0 || !Number.isFinite(targetHeight) || targetHeight <= 0) {
                console.warn('El tamaño calculado para la firma en el PDF no es válido. Se omite.');
            } else {
                targetWidth = Math.min(targetWidth, width);
                targetHeight = Math.min(targetHeight, height);
                const maxX = Math.max(0, width - targetWidth);
                const maxY = Math.max(0, height - targetHeight);

                let x = Number.isFinite(layout.xAbs) ? layout.xAbs : (Number.isFinite(layout.xPct) ? width * layout.xPct : Number(defaultSignatureLayout.xPct || 0) * width);
                let y = Number.isFinite(layout.yAbs) ? layout.yAbs : (Number.isFinite(layout.yPct) ? height * layout.yPct : Number(defaultSignatureLayout.yPct || 0) * height);

                if (!Number.isFinite(x)) {
                    x = width * 0.55;
                }
                if (!Number.isFinite(y)) {
                    y = height * 0.25;
                }

                x = Math.max(0, Math.min(maxX, x));
                y = Math.max(0, Math.min(maxY, y));

                page.drawImage(signatureImage, {
                    x,
                    y,
                    width: targetWidth,
                    height: targetHeight
                });
            }
        } catch (signatureError) {
            console.warn('No se pudo incrustar la firma en el PDF', signatureError);
        }
    }

    // Incrustar firma y nombre del tutor si existe
    if (data && data.tutorSignatureDataUrl) {
        try {
            const responseT = await fetch(data.tutorSignatureDataUrl);
            const signatureBufferT = await responseT.arrayBuffer();
            const signatureImageT = await pdfDoc.embedPng(signatureBufferT);
            let layoutT = REINSCRIPTION_PDF_LAYOUT.tutorSignature || {};
            const defaultT = REINSCRIPTION_PDF_LAYOUT_DEFAULTS.tutorSignature || {};
            if (tutorLayoutOverride && tutorLayoutOverride.tutorSignature) {
                layoutT = { ...layoutT, ...tutorLayoutOverride.tutorSignature };
            }
            const imageRatioT = signatureImageT.width && signatureImageT.height ? signatureImageT.width / signatureImageT.height : null;
            let tWidth;
            let tHeight;
            const hasAbsT = Number.isFinite(layoutT.widthAbs) && layoutT.widthAbs > 0 && Number.isFinite(layoutT.heightAbs) && layoutT.heightAbs > 0;
            if (hasAbsT) {
                tWidth = layoutT.widthAbs;
                tHeight = layoutT.heightAbs;
            } else {
                const wPct = Number.isFinite(layoutT.widthPct) ? layoutT.widthPct : (Number.isFinite(defaultT.widthPct) ? defaultT.widthPct : 0.16);
                const hPct = Number.isFinite(layoutT.heightPct) ? layoutT.heightPct : (Number.isFinite(defaultT.heightPct) ? defaultT.heightPct : null);
                tWidth = wPct ? width * wPct : signatureImageT.width;
                if (hPct) {
                    const candidateH = height * hPct;
                    if (imageRatioT) {
                        const hFromW = tWidth / imageRatioT;
                        if (hFromW > candidateH + 0.5) {
                            tHeight = candidateH;
                            tWidth = candidateH * imageRatioT;
                        } else {
                            tHeight = hFromW;
                        }
                    } else {
                        tHeight = candidateH;
                    }
                } else if (imageRatioT) {
                    tHeight = tWidth / imageRatioT;
                } else {
                    tHeight = signatureImageT.height;
                }
            }
            if (Number.isFinite(tWidth) && tWidth > 0 && Number.isFinite(tHeight) && tHeight > 0) {
                tWidth = Math.min(tWidth, width);
                tHeight = Math.min(tHeight, height);
                let tx = Number.isFinite(layoutT.xAbs) ? layoutT.xAbs : (Number.isFinite(layoutT.xPct) ? width * layoutT.xPct : Number(defaultT.xPct || 0) * width);
                let ty = Number.isFinite(layoutT.yAbs) ? layoutT.yAbs : (Number.isFinite(layoutT.yPct) ? height * layoutT.yPct : Number(defaultT.yPct || 0) * height);
                if (!Number.isFinite(tx)) tx = width * 0.1;
                if (!Number.isFinite(ty)) ty = height * 0.25;
                tx = Math.max(0, Math.min(Math.max(0, width - tWidth), tx));
                ty = Math.max(0, Math.min(Math.max(0, height - tHeight), ty));
                page.drawImage(signatureImageT, { x: tx, y: ty, width: tWidth, height: tHeight });
            }
        } catch (errT) {
            console.warn('No se pudo incrustar la firma del tutor en el PDF', errT);
        }
    }

    // Dibujar nombre del tutor si se proporcionó
    if (data && data.tutorName) {
        try {
            let layoutN = REINSCRIPTION_PDF_LAYOUT.tutorName || {};
            let fontSize = 10.5;
            if (tutorLayoutOverride && tutorLayoutOverride.tutorName) {
                layoutN = { ...layoutN, ...tutorLayoutOverride.tutorName };
                if (Number.isFinite(tutorLayoutOverride.tutorName.fontSize)) {
                    fontSize = tutorLayoutOverride.tutorName.fontSize;
                }
            }
            // Usar color azul puro: rgb(0,0,1)
            drawText(data.tutorName, layoutN, { size: fontSize, color: rgb(0, 0, 1) });
        } catch (errName) {
            console.warn('No se pudo dibujar el nombre del tutor en el PDF', errName);
        }
    }

    return pdfDoc.save();
}

async function ensureGmailApiInitialized() {
    if (gmailApiReady) {
        return;
    }
    if (gmailApiInitPromise) {
        return gmailApiInitPromise;
    }
    gmailApiInitPromise = (async () => {
        await ensureDriveApiInitialized();
        if (typeof gapi === 'undefined' || !gapi.client) {
            throw new Error('Cliente de Google no disponible para Gmail.');
        }
        if (!gapi.client.gmail) {
            try {
                await gapi.client.load('gmail', 'v1');
            } catch (loadErr) {
                await gapi.client.load('https://gmail.googleapis.com/$discovery/rest?version=v1');
            }
        }
        if (!gapi.client.gmail) {
            throw new Error('No se pudo inicializar la API de Gmail.');
        }

        gmailApiReady = true;
    })().catch(error => {
        gmailApiInitPromise = null;
        throw error;
    });
    return gmailApiInitPromise;
}

function isValidEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function uint8ArrayToBase64(bytes) {
    if (!(bytes instanceof Uint8Array)) {
        bytes = new Uint8Array(bytes || 0);
    }
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}

function chunkString(str, size) {
    if (!str) {
        return '';
    }
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size));
    }
    return chunks.join('\r\n');
}

function toBase64Url(base64) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeStringToBase64(str) {
    if (typeof TextEncoder !== 'undefined') {
        const encoder = new TextEncoder();
        return uint8ArrayToBase64(encoder.encode(str));
    }
    return btoa(unescape(encodeURIComponent(str)));
}

function encodeSubject(subject) {
    const raw = subject && subject.trim() ? subject.trim() : 'Solicitud de reinscripción';
    return `=?utf-8?B?${encodeStringToBase64(raw)}?=`;
}

function buildReinscriptionEmailBody(data) {
    const lines = ['', '', 'Adjunto la solicitud de reinscripción en formato PDF.'];
    if (data && typeof data === 'object') {
        if (data.fullName) {
            lines.push(`Nombre: ${data.fullName}`);
        }
        if (data.matricula) {
            lines.push(`Matrícula: ${data.matricula}`);
        }
        if (data.career) {
            lines.push(`Carrera: ${data.career}`);
        }
        const extra = [data.quarter, data.group].filter(Boolean).join('  ');
        if (extra) {
            lines.push(`Cuatrimestre y grupo: ${extra}`);
        }
        if (data.tutorMessage) {
            lines.push('', data.tutorMessage);
        }
    }
    lines.push('', '', '', '');
    return lines.join('\r\n');
}

async function createReinscriptionEmailDraft({ pdfBytes, tutorEmail, data }) {
    if (!tutorEmail || !isValidEmail(tutorEmail)) {
        throw new Error('Correo de tutor no válido. Por favor proporciona un correo válido.');
    }
    const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
    if (!bytes || !bytes.length) {
        throw new Error('El archivo PDF no se pudo generar.');
    }

    await ensureDriveReady({ interactive: false });
    await ensureGmailApiInitialized();
    try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { /* silencioso */ }

    const pdfBase64 = uint8ArrayToBase64(bytes);
    const pdfBase64Chunked = chunkString(pdfBase64, 76);
    const boundary = 'reinscription_' + Date.now().toString(16);
    const subjectText = REINSCRIPTION_EMAIL_SUBJECT;
    const subject = encodeSubject(subjectText);
    const body = buildReinscriptionEmailBody(data);

    const rawMessageParts = [
        `To: ${tutorEmail}`,
        `Subject: ${subject}`,
        'Content-Type: multipart/mixed; boundary="' + boundary + '"',
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        body,
        '',
        `--${boundary}`,
        'Content-Type: application/pdf',
        'Content-Transfer-Encoding: base64',
        'Content-Disposition: attachment; filename="Solicitud_reinscripcion.pdf"',
        '',
        pdfBase64Chunked,
        '',
        `--${boundary}--`,
        ''
    ];

    const rawMessage = rawMessageParts.join('\r\n');
    const rawBase64Url = toBase64Url(encodeStringToBase64(rawMessage));

    const draftResponse = await gapi.client.gmail.users.drafts.create({
        userId: 'me',
        resource: { message: { raw: rawBase64Url } }
    });
    const draftId = draftResponse && draftResponse.result && draftResponse.result.id;
    if (!draftId) {
        throw new Error('No se pudo crear el borrador en Gmail.');
    }
    const messageId = draftResponse && draftResponse.result && draftResponse.result.message && draftResponse.result.message.id;
    try { localStorage.setItem(GMAIL_SCOPE_FLAG, '1'); } catch (e) { /* ignore quota */ }
    return { draftId, messageId, subject: subjectText };
}

function openReinscriptionModal() {
    const modal = document.getElementById('reinscriptionModal');
    if (!modal) return;
    const defaults = buildReinscriptionDefaults();
    const values = reinscriptionLastFormValues ? { ...defaults, ...reinscriptionLastFormValues } : defaults;
    // Forzar que la carrera venga siempre de la selección actual, no de valores viejos
    if (defaults && defaults.career) {
        values.career = defaults.career;
    }
    if (!values.debtSubject && defaults.debtSubject) {
        values.debtSubject = defaults.debtSubject;
    }
    if (typeof values.autoDebtSubject === 'undefined') {
        values.autoDebtSubject = values.debtSubject || '';
    }
    applyReinscriptionValuesToForm(values);
    const preservedSignature = reinscriptionLastFormValues && reinscriptionLastFormValues.signatureDataUrl ? reinscriptionLastFormValues.signatureDataUrl : null;
    reinscriptionLastFormValues = { ...values, signatureDataUrl: preservedSignature };
    saveReinscriptionFormSnapshot(reinscriptionLastFormValues);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    // Agregar clase para móviles
    if (isMobileDevice()) {
        modal.classList.add('is-mobile');
    } else {
        modal.classList.remove('is-mobile');
    }
    document.body.classList.add('reinscription-modal-active');
    persistReinscriptionModalOpenState(true);
    const nameInput = document.getElementById('reinscriptionFullName');
    if (nameInput) {
        nameInput.focus();
        nameInput.select();
    }
    updateReinscriptionLoadedSubjectsList();
    // Asegurarse de cargar la firma del tutor si la casilla estaba marcada
    const tutorDefaultCheckbox = document.getElementById('reinscriptionTutorDefault');
    if (tutorDefaultCheckbox && tutorDefaultCheckbox.checked) {
        setDefaultTutor(true).catch(() => { });
    }
    scheduleReinscriptionPreviewRender();
}

function closeReinscriptionModal() {
    const modal = document.getElementById('reinscriptionModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('reinscription-modal-active');
    if (reinscriptionPreviewRenderTimer) {
        clearTimeout(reinscriptionPreviewRenderTimer);
        reinscriptionPreviewRenderTimer = null;
    }
    clearReinscriptionPreviewCanvas();
    persistReinscriptionModalOpenState(false);
    const openDraftBtn = document.getElementById('reinscriptionOpenDraft');
    if (openDraftBtn) {
        openDraftBtn.classList.add('hidden');
    }
    lastReinscriptionDraftUrl = null;
    lastReinscriptionDraftSearchUrl = null;
}

function setupReinscriptionModal() {
    const modal = document.getElementById('reinscriptionModal');
    const openBtn = document.getElementById('openReinscriptionModal');
    if (!modal || !openBtn) return;
    const closeBtn = document.getElementById('reinscriptionClose');
    const form = document.getElementById('reinscriptionForm');
    const debtInput = document.getElementById('reinscriptionDebtSubject');
    setupReinscriptionSignatureOverlay();
    openBtn.addEventListener('click', () => {
        try {
            openReinscriptionModal();
        } catch (error) {
            console.error('No se pudo abrir el modal de reinscripción', error);
            showMessage('No se pudo preparar la solicitud de reinscripción. Intenta nuevamente.', 'error');
        }
    });
    if (closeBtn) {
        closeBtn.addEventListener('click', closeReinscriptionModal);
    }
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeReinscriptionModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeReinscriptionModal();
        }
    });
    if (form) {
        form.addEventListener('input', (event) => {
            if (event && event.target && event.target.id === 'reinscriptionDebtSubject') {
                event.target.dataset.userEdited = 'true';
            }
            collectReinscriptionFormData();
            scheduleReinscriptionPreviewRender();
        });
    }
    if (debtInput) {
        debtInput.addEventListener('focus', () => {
            debtInput.dataset.userEdited = 'true';
        });
    }
    const signatureInput = document.getElementById('reinscriptionSignature');
    if (signatureInput) {
        signatureInput.addEventListener('change', handleReinscriptionSignatureChange);
    }
    const tutorSelect = document.getElementById('reinscriptionTutorSelect');
    if (tutorSelect) {
        tutorSelect.addEventListener('change', () => {
            handleTutorSelectionChange().catch(() => { });
        });
    }
    const tutorDefaultCheckbox = document.getElementById('reinscriptionTutorDefault');
    if (tutorDefaultCheckbox) {
        tutorDefaultCheckbox.addEventListener('change', (e) => {
            setDefaultTutor(!!e.target.checked).catch(() => { });
        });
    }
    const clearSignatureBtn = document.getElementById('reinscriptionSignatureClear');
    if (clearSignatureBtn) {
        clearSignatureBtn.addEventListener('click', (event) => {
            event.preventDefault();
            clearReinscriptionSignature();
        });
    }
    // Botón X para quitar firma en la vista previa
    const removeSignatureBtn = document.getElementById('removeSignatureButton');
    if (removeSignatureBtn) {
        removeSignatureBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            clearReinscriptionSignature();
        });
    }
    // Botón X para quitar firma en móvil
    const removeSignatureBtnMobile = document.getElementById('removeSignatureButtonMobile');
    if (removeSignatureBtnMobile) {
        removeSignatureBtnMobile.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            clearReinscriptionSignature();
        });
    }

    // Botones de zoom para firma (escritorio)
    const zoomOutBtn = document.getElementById('reinscriptionSignatureZoomOut');
    const zoomInBtn = document.getElementById('reinscriptionSignatureZoomIn');

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            adjustSignatureSize(0.9);
        });
    }
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            adjustSignatureSize(1.1);
        });
    }

    // Botones de zoom para firma (móvil)
    const zoomOutBtnMobile = document.getElementById('reinscriptionSignatureZoomOutMobile');
    const zoomInBtnMobile = document.getElementById('reinscriptionSignatureZoomInMobile');

    if (zoomOutBtnMobile) {
        zoomOutBtnMobile.addEventListener('click', () => {
            adjustSignatureSize(0.9);
        });
        // Soporte táctil inmediato (evitar delay en algunos navegadores)
        zoomOutBtnMobile.addEventListener('pointerdown', (e) => { e.preventDefault(); adjustSignatureSize(0.9); });
        zoomOutBtnMobile.addEventListener('touchstart', (e) => { e.preventDefault(); adjustSignatureSize(0.9); });
    }
    if (zoomInBtnMobile) {
        zoomInBtnMobile.addEventListener('click', () => {
            adjustSignatureSize(1.1);
        });
        zoomInBtnMobile.addEventListener('pointerdown', (e) => { e.preventDefault(); adjustSignatureSize(1.1); });
        zoomInBtnMobile.addEventListener('touchstart', (e) => { e.preventDefault(); adjustSignatureSize(1.1); });
    }

    // Helper: mostrar aviso de adjuntar PDF en Gmail
    const attachWarningEl = document.getElementById('reinscriptionAttachWarning');
    function showAttachWarning() {
        if (attachWarningEl) {
            attachWarningEl.classList.remove('hidden');
            try { attachWarningEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
        }
    }

    const openDraftBtn = document.getElementById('reinscriptionOpenDraft');
    if (openDraftBtn) {
        openDraftBtn.addEventListener('click', () => {
            if (!lastReinscriptionDraftUrl) {
                showMessage('No hay un borrador reciente. Usa “Enviar al tutor” para generar uno nuevo.', 'warning');
                return;
            }
            const opened = window.open(lastReinscriptionDraftUrl, '_blank', 'noopener');
            if (opened) {
                showAttachWarning();
            } else {
                showMessage(`No se pudo abrir Gmail automáticamente. Copia y pega esta dirección en tu navegador: ${lastReinscriptionDraftUrl}`, 'warning');
            }
        });
    }
    const sendEmailBtn = document.getElementById('reinscriptionSendEmail');
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener('click', async () => {
            if (reinscriptionEmailSending) return;
            const data = collectReinscriptionFormData();
            if (!data || !data.fullName || !data.matricula || !data.career) {
                showMessage('Completa nombre, matrícula y carrera.', 'warning');
                return;
            }
            if (!data.signatureDataUrl) {
                showMessage('La firma es obligatoria para enviar la solicitud al tutor.', 'warning');
                const signatureWarning = document.querySelector('.signature-required-warning');
                if (signatureWarning) {
                    signatureWarning.style.display = 'block';
                    signatureWarning.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            const tutorEmailInput = document.getElementById('reinscriptionTutorEmail');
            const tutorEmail = tutorEmailInput ? tutorEmailInput.value.trim() : '';
            // El email del tutor es opcional, pero si se proporciona debe ser válido
            if (tutorEmail && !isValidEmail(tutorEmail)) {
                showMessage('Ingresa un email de tutor válido.', 'warning');
                if (tutorEmailInput) tutorEmailInput.focus();
                return;
            }
            const originalText = sendEmailBtn.textContent;
            reinscriptionEmailSending = true;
            if (openDraftBtn) openDraftBtn.classList.add('hidden');
            sendEmailBtn.disabled = true;
            sendEmailBtn.textContent = 'Generando...';
            showLoader('Abriendo Gmail...');
            try {
                const pdfBytes = await generateReinscriptionPdf(data, { includeSignature: true });
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'Solicitud_reinscripcion.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 4000);

                // Mostrar modal de confirmación
                hideLoader();
                const confirmModal = document.createElement('div');
                confirmModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;';
                confirmModal.innerHTML = `
                            <div style="background:white;border-radius:12px;padding:28px;max-width:420px;width:90%;box-shadow:0 8px 24px rgba(0,0,0,0.3);text-align:center;">
                                <h3 style="margin:0 0 12px;color:#1b1f2e;font-size:1.2rem;">Confirmar envío</h3>
                                <p style="margin:0 0 20px;color:#54617d;line-height:1.5;font-size:0.95rem;">
                                    El PDF se descargó correctamente.<br><br>
                                    <strong style="color:#d32f2f;">Debes adjuntar el PDF descargado</strong> al correo en Gmail para poder enviarlo.
                                </p>
                                <div style="display:flex;gap:12px;justify-content:center;">
                                    <button onclick="this.parentElement.parentElement.parentElement.remove();" style="flex:1;padding:10px 16px;background:#e0e0e0;border:none;border-radius:6px;cursor:pointer;font-size:0.95rem;color:#1b1f2e;">
                                        Cancelar
                                    </button>
                                    <button id="confirmOpenGmail" style="flex:1;padding:10px 16px;background:#1a73e8;border:none;border-radius:6px;cursor:pointer;font-size:0.95rem;color:white;font-weight:600;">
                                        Abrir Gmail
                                    </button>
                                </div>
                            </div>
                        `;
                document.body.appendChild(confirmModal);

                document.getElementById('confirmOpenGmail').addEventListener('click', () => {
                    confirmModal.remove();
                    const subject = encodeURIComponent(REINSCRIPTION_EMAIL_SUBJECT);
                    const body = buildReinscriptionEmailBody(data);
                    const bodyEncoded = encodeURIComponent(body);

                    // En dispositivos móviles: intentar abrir la app de Gmail, si falla usar mailto, y al final usar Gmail web
                    if (isMobileDevice()) {
                        const gmailAppUrl = `googlegmail://co?to=${encodeURIComponent(tutorEmail)}&su=${subject}&body=${bodyEncoded}`;
                        const mailtoUrl = `mailto:${encodeURIComponent(tutorEmail)}?subject=${subject}&body=${bodyEncoded}`;
                        // Intentar abrir la app de Gmail mediante scheme. Si el navegador no la abre, haremos fallback.
                        try {
                            // Esto normalmente lanzará el selector de apps en Android / iOS si la app está instalada
                            window.location.href = gmailAppUrl;
                        } catch (e) {
                            // Si falla al asignar, seguiremos con el fallback
                        }

                        // Fallback programado: si la app no se abrió (o el navegador no la soporta), abrir mailto
                        setTimeout(() => {
                            const openedMailto = (() => {
                                try {
                                    return !!window.open(mailtoUrl, '_blank');
                                } catch (e) {
                                    return false;
                                }
                            })();
                            if (!openedMailto) {
                                // Último recurso: abrir Gmail web
                                const webGmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(tutorEmail)}&su=${subject}&body=${bodyEncoded}`;
                                const openedWeb = (() => {
                                    try {
                                        return !!window.open(webGmail, '_blank');
                                    } catch (e) {
                                        return false;
                                    }
                                })();
                                if (!openedWeb) {
                                    showMessage('Gmail no se pudo abrir. Abrelo manualmente e ingresa el email del tutor.', 'warning');
                                } else {
                                    try { showAttachWarning(); } catch (e) { /* ignore */ }
                                    showMessage('✓ Gmail abierto. Adjunta el PDF descargado y envía el correo.', 'success');
                                }
                            } else {
                                try { showAttachWarning(); } catch (e) { /* ignore */ }
                                showMessage('✓ Cliente de correo abierto. Adjunta el PDF descargado y envía el correo.', 'success');
                            }
                        }, 700);
                    } else {
                        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(tutorEmail)}&su=${subject}&body=${bodyEncoded}`;
                        const opened = window.open(gmailUrl, '_blank');
                        if (!opened) {
                            showMessage('Gmail no se pudo abrir. Abrelo manualmente e ingresa el email del tutor.', 'warning');
                        } else {
                            try { showAttachWarning(); } catch (e) { /* ignore if helper not present */ }
                            showMessage('✓ Gmail abierto. Adjunta el PDF descargado y envía el correo.', 'success');
                        }
                    }
                });
                reinscriptionEmailSending = false;
                sendEmailBtn.disabled = false;
                sendEmailBtn.textContent = originalText;
            } catch (error) {
                console.error('Error:', error);
                showMessage('Error generando PDF.', 'error');
            } finally {
                hideLoader();
                reinscriptionEmailSending = false;
                sendEmailBtn.disabled = false;
                sendEmailBtn.textContent = originalText;
            }
        });
    }

    const downloadBtn = document.getElementById('reinscriptionDownload');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            const data = collectReinscriptionFormData();
            if (!data || !data.fullName || !data.matricula || !data.career) {
                showMessage('Completa al menos el nombre completo, la matrícula y la carrera.', 'warning');
                return;
            }
            showLoader('Generando formato de reinscripción...');
            try {
                const pdfBytes = await generateReinscriptionPdf(data, { includeSignature: true });
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'Solicitud_reinscripcion.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 4000);
            } catch (error) {
                console.error('Error al generar el PDF de reinscripción', error);
                showMessage('No se pudo generar el formato de reinscripción. Intenta nuevamente.', 'error');
            } finally {
                hideLoader();
            }
        });
    }

    let shouldReopen = false;
    try {
        shouldReopen = localStorage.getItem(REINSCRIPTION_MODAL_STATE_STORAGE_KEY) === 'open';
    } catch (error) {
        console.warn('No se pudo leer el estado persistido del modal de reinscripción', error);
    }
    if (shouldReopen && modal.classList.contains('hidden')) {
        setTimeout(() => {
            if (modal.classList.contains('hidden')) {
                try {
                    openReinscriptionModal();
                } catch (error) {
                    console.warn('No se pudo reabrir automáticamente el modal de reinscripción', error);
                }
            }
        }, 0);
    }
}

// Funciones para dibujar firma
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

function openDrawSignatureModal() {
    const modal = document.getElementById('drawSignatureModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    const isMobile = isMobileDevice();
    if (isMobile) {
        modal.classList.add('is-mobile');
    } else {
        modal.classList.remove('is-mobile');
    }
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) {
        // Ajustar el tamaño del canvas según dispositivo
        const wrapper = modal.querySelector('.draw-signature-modal__body');
        if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            if (isMobile) {
                // En móviles: usar todo el ancho disponible
                canvas.width = Math.floor(rect.width);
                canvas.height = Math.floor(rect.height * 0.6);
            } else {
                // En desktop: mantener proporción 8:3
                canvas.width = Math.min(800, Math.floor(rect.width - 40));
                canvas.height = Math.floor(canvas.width * (300 / 800));
            }
        }
    }
    setTimeout(() => {
        const canvas = document.getElementById('signatureCanvas');
        if (canvas) canvas.focus();
    }, 100);
}

function closeDrawSignatureModal() {
    const modal = document.getElementById('drawSignatureModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    clearSignatureCanvas();
}

function clearSignatureCanvas() {
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    isDrawingSignature = false;
}

function setupDrawSignatureModal() {
    const openBtn = document.getElementById('openDrawSignatureModal');
    const closeBtn = document.getElementById('closeDrawSignatureModal');
    const cancelBtn = document.getElementById('cancelDrawSignature');
    const resetBtn = document.getElementById('resetSignatureCanvas');
    const saveBtn = document.getElementById('saveDrawnSignature');
    const canvas = document.getElementById('signatureCanvas');
    const modal = document.getElementById('drawSignatureModal');

    if (!modal || !canvas) return;

    // Abrir modal
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            openDrawSignatureModal();
        });
    }

    // Cerrar modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeDrawSignatureModal();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeDrawSignatureModal();
        });
    }

    // Cerrar al hacer clic en el overlay
    const overlay = modal.querySelector('.draw-signature-modal__overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeDrawSignatureModal();
        });
    }

    // Resetear canvas
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearSignatureCanvas();
        });
    }

    // Guardar firma
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveDrawnSignature();
        });
    }

    // Eventos de dibujo en el canvas
    setupCanvasDrawing(canvas);
}

function setupCanvasDrawing(canvas) {
    if (!canvas) return;

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let lastWidth = 3;
    let velocityX = 0;
    let velocityY = 0;

    const getCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const getVelocity = (dx, dy) => {
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getLineWidth = (velocity) => {
        // Simular presión: velocidad lenta = trazo más grueso, velocidad rápida = trazo más delgado
        const minWidth = 2;
        const maxWidth = 8;
        // Invertir: velocidad baja = línea gruesa, velocidad alta = línea delgada
        const width = maxWidth - (velocity * 1);
        return Math.max(minWidth, Math.min(maxWidth, width));
    };

    const drawLineWithPressure = (fromX, fromY, toX, toY, startWidth, endWidth) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#0066cc'; // Azul
        ctx.strokeStyle = '#0066cc';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Calcular la distancia y número de puntos
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(distance);

        // Dibujar múltiples círculos pequeños para simular presión variable
        for (let i = 0; i <= steps; i++) {
            const t = steps > 0 ? i / steps : 0;
            const x = fromX + dx * t;
            const y = fromY + dy * t;
            const width = startWidth + (endWidth - startWidth) * t;

            ctx.beginPath();
            ctx.arc(x, y, width / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Suavizar conectando con una línea
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.lineWidth = (startWidth + endWidth) / 2;
        ctx.stroke();
    };

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const coords = getCoordinates(e);
        lastX = coords.x;
        lastY = coords.y;
        velocityX = 0;
        velocityY = 0;
        lastWidth = 5;
        canvas.style.cursor = 'none';

        // Dibujar punto inicial
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#0066cc';
            ctx.beginPath();
            ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const coords = getCoordinates(e);
        const dx = coords.x - lastX;
        const dy = coords.y - lastY;

        if (dx === 0 && dy === 0) return;

        const velocity = getVelocity(dx, dy);
        const newWidth = getLineWidth(velocity);

        drawLineWithPressure(lastX, lastY, coords.x, coords.y, lastWidth, newWidth);

        lastX = coords.x;
        lastY = coords.y;
        lastWidth = newWidth;
        velocityX = dx;
        velocityY = dy;
    });

    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
        canvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
        canvas.style.cursor = 'crosshair';
    });

    // Prevenir scroll en móvil
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDrawing = true;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        lastX = (touch.clientX - rect.left) * scaleX;
        lastY = (touch.clientY - rect.top) * scaleY;
        velocityX = 0;
        velocityY = 0;
        lastWidth = 5;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#0066cc';
            ctx.beginPath();
            ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        const dx = x - lastX;
        const dy = y - lastY;

        if (dx === 0 && dy === 0) return;

        const velocity = getVelocity(dx, dy);
        const newWidth = getLineWidth(velocity);

        drawLineWithPressure(lastX, lastY, x, y, lastWidth, newWidth);

        lastX = x;
        lastY = y;
        lastWidth = newWidth;
        velocityX = dx;
        velocityY = dy;
    });

    canvas.addEventListener('touchend', () => {
        isDrawing = false;
    });
}

function saveDrawnSignature() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    const imageData = canvas.toDataURL('image/png');
    reinscriptionSignatureDataUrl = imageData;

    if (!reinscriptionLastFormValues) {
        reinscriptionLastFormValues = buildReinscriptionDefaults();
    }
    reinscriptionLastFormValues.signatureDataUrl = imageData;
    saveReinscriptionFormSnapshot(reinscriptionLastFormValues);

    updateReinscriptionSignaturePreview();
    scheduleReinscriptionPreviewRender();
    closeDrawSignatureModal();

    showMessage('Firma dibujada correctamente.', 'success');
}

function refreshReinscriptionDefaultsAfterScheduleChange() {
    if (!Array.isArray(DEFAULT_BIOMEDICA_SUBJECT_IDS)) return;
    const modal = document.getElementById('reinscriptionModal');
    const isOpen = modal && !modal.classList.contains('hidden');
    // Preferir cálculo por IDs predefinidos para consistencia
    const newDebtSubject = (typeof computeAutoDebtSubject === 'function' ? computeAutoDebtSubject() : '') || findMissingScheduledSubjectNames() || '';
    if (reinscriptionLastFormValues) {
        const previousAuto = reinscriptionLastFormValues.autoDebtSubject || '';
        if (!reinscriptionLastFormValues.debtSubject || reinscriptionLastFormValues.debtSubject === previousAuto) {
            reinscriptionLastFormValues.debtSubject = newDebtSubject;
            reinscriptionLastFormValues.autoDebtSubject = newDebtSubject;
            saveReinscriptionFormSnapshot(reinscriptionLastFormValues);
        }
    }
    if (!isOpen) {
        return;
    }
    const debtInput = document.getElementById('reinscriptionDebtSubject');
    if (!debtInput) return;
    const userEdited = debtInput.dataset && debtInput.dataset.userEdited === 'true';
    if (userEdited && debtInput.value && debtInput.value !== (debtInput.dataset ? debtInput.dataset.autoValue : '')) {
        return;
    }
    debtInput.value = newDebtSubject;
    if (newDebtSubject) {
        debtInput.dataset.autoValue = newDebtSubject;
    } else if (debtInput.dataset) {
        delete debtInput.dataset.autoValue;
    }
    debtInput.dataset.userEdited = 'false';
    updateReinscriptionLoadedSubjectsList();
    scheduleReinscriptionPreviewRender();
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
    selectedSubjects.push({ ...subject });
    defaultSchedulePromptDismissed = false;

    // Guardar en localStorage
    saveSelectedSubjects();

    // Intentar sincronizar en Drive y, si hace falta, pedir inicio de sesión
    // para que el horario quede realmente guardado en la nube.
    (async () => {
        const ok = await ensureSaveToDrive({
            interactive: true,
            showSuccess: false,
            successMessage: 'Horario guardado',
            silent: true
        });
        if (!ok) {
            console.warn('Error tras añadir materia (no se pudo sincronizar con Drive)');
        }
    })();

    // Actualizar vistas
    updateScheduleView();
    updateSelectedSubjectsList();
    updateCatalogSubjects();

    if (conflicts.length > 0) {
        showMessage(`Materia "${subject.name}" añadida con pero se chocan materias en el horario`, 'warning');
    } else {
        showMessage(`Materia "${subject.name}" añadida al horario correctamente`, 'success');
    }
    refreshReinscriptionDefaultsAfterScheduleChange();
    updateReinscriptionLoadedSubjectsList();
    // Asegurar que el valor auto calculado se actualice en memoria y en el input si procede
    try {
        const newDebt = (typeof computeAutoDebtSubject === 'function' ? computeAutoDebtSubject() : '') || '';
        if (!reinscriptionLastFormValues) reinscriptionLastFormValues = buildReinscriptionDefaults();
        reinscriptionLastFormValues.autoDebtSubject = newDebt;
        // Guardar snapshot (no persistirá debtSubject por diseño)
        saveReinscriptionFormSnapshot(reinscriptionLastFormValues);
        const modal = document.getElementById('reinscriptionModal');
        const debtInput = document.getElementById('reinscriptionDebtSubject');
        const isOpen = modal && !modal.classList.contains('hidden');
        if (isOpen && debtInput) {
            const userEdited = debtInput.dataset && debtInput.dataset.userEdited === 'true';
            if (!userEdited) {
                debtInput.value = newDebt;
                if (newDebt) debtInput.dataset.autoValue = newDebt; else if (debtInput.dataset) delete debtInput.dataset.autoValue;
                debtInput.dataset.userEdited = 'false';
                scheduleReinscriptionPreviewRender();
            }
        }
    } catch (e) { console.warn('No se pudo actualizar deuda tras añadir materia', e); }
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

        // Intentar sincronizar en Drive y, si hace falta, pedir inicio de sesión
        // para que el cambio quede guardado en la nube.
        (async () => {
            const ok = await ensureSaveToDrive({
            interactive: true,
                showSuccess: false,
                successMessage: 'Cambio guardado en Google Drive',
                silent: true
            });
            if (!ok) {
                console.warn('Error sincronizando tras quitar materia (no se pudo guardar en Drive)');
            }
        })();

        // Actualizar vistas
        updateScheduleView();
        updateSelectedSubjectsList();
        updateCatalogSubjects();

        showMessage(`Materia "${subject.name}" quitada del horario`, 'success');
        refreshReinscriptionDefaultsAfterScheduleChange();
        updateReinscriptionLoadedSubjectsList();
        // Actualizar en memoria y en el input si está abierto y no fue editado por el usuario
        try {
            const newDebt = (typeof computeAutoDebtSubject === 'function' ? computeAutoDebtSubject() : '') || '';
            if (!reinscriptionLastFormValues) reinscriptionLastFormValues = buildReinscriptionDefaults();
            reinscriptionLastFormValues.autoDebtSubject = newDebt;
            saveReinscriptionFormSnapshot(reinscriptionLastFormValues);
            const modal = document.getElementById('reinscriptionModal');
            const debtInput = document.getElementById('reinscriptionDebtSubject');
            const isOpen = modal && !modal.classList.contains('hidden');
            if (isOpen && debtInput) {
                const userEdited = debtInput.dataset && debtInput.dataset.userEdited === 'true';
                if (!userEdited) {
                    debtInput.value = newDebt;
                    if (newDebt) debtInput.dataset.autoValue = newDebt; else if (debtInput.dataset) delete debtInput.dataset.autoValue;
                    debtInput.dataset.userEdited = 'false';
                    scheduleReinscriptionPreviewRender();
                }
            }
        } catch (e) { console.warn('No se pudo actualizar deuda tras quitar materia', e); }

        if (selectedSubjects.length === 0) {
            defaultSchedulePromptDismissed = false;
            maybePromptDefaultSchedule();
        }
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
    // Detectar si hay materias con horario en sábado
    const hasSaturdaySessions = selectedSubjects.some(subject =>
        Array.isArray(subject.sessions) && subject.sessions.some(session => session.day === 'sabado')
    );

    // Si aparecen materias con sábado por primera vez, mostrar loader 2s, activar columna y reconstruir luego
    if (hasSaturdaySessions && !scheduleHasSaturday) {
        scheduleHasSaturday = true;
        saturdayColumnAdded = true;
        const loader = document.getElementById('scheduleSaturdayLoader');
        if (loader) loader.classList.remove('hidden');
        setTimeout(() => {
            if (loader) loader.classList.add('hidden');
            // Regenerar la tabla con la columna de sábado y luego actualizar normalmente
            generateScheduleTable();
            updateScheduleView();
        }, 2000);
        return;
    }

    // Si ya no hay materias con sábado pero la columna sigue activa, quitar sábado del horario
    if (!hasSaturdaySessions && scheduleHasSaturday) {
        scheduleHasSaturday = false;
        const loader = document.getElementById('scheduleSaturdayLoader');
        if (loader) loader.classList.add('hidden');
        // Regenerar la tabla sin la columna de sábado; después se limpiarán y rellenarán las celdas normalmente
        generateScheduleTable();
    }

    // Quitar resaltados activos antes de reconstruir el horario
    const scheduleRows = document.querySelectorAll('.schedule-table tr');
    scheduleRows.forEach(row => {
        row.classList.remove('highlight-row');
        row.querySelectorAll('td').forEach(td => {
            td.style.backgroundColor = '';
            if (td.dataset && ('_prevBg' in td.dataset)) {
                delete td.dataset._prevBg;
            }
        });
    });

    // Limpiar todas las celdas (Lunes-Viernes) y, si existe, sábado
    const allDays = scheduleHasSaturday ? [...days, 'sabado'] : days;
    allDays.forEach(day => {
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
    allDays.forEach(day => {
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
                    const rawGroupLabel = (item.subject && item.subject.group) ? String(item.subject.group) : '';
                    const groupLabel = rawGroupLabel.trim().toLowerCase();

                    subjectCard.className = `subject-card ${hasConflict ? 'conflict' : ''}`;

                    // Aplicar colores según tipo de grupo
                    if (groupLabel === '7a') {
                        subjectCard.classList.add('group-7A');
                    } else if (groupLabel.includes('convalid')) {
                        subjectCard.classList.add('group-convalidacion');
                    } else if (groupLabel.includes('especial')) {
                        subjectCard.classList.add('group-especial');
                    }

                    // Mostrar nombre en la tarjeta
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

                   // --- NUEVO: titulo y tooltip dentro de la tarjeta mostrando hora y aula ---
                    // obtener aula preferida en el sujeto, si no existe buscar en catalogSubjects
                    const aulaCard = item.subject.aula ?? (catalogSubjects.find(cs => cs.id === item.subject.id) || {}).aula ?? '-';
                    const horarioLabel = `${item.session.startTime}-${item.session.endTime}`;
                    const aulaLabel = aulaCard && aulaCard !== '-' ? `Aula: ${aulaCard}` : '';
                    const profesorLabel = item.subject.professor ? `Prof: ${item.subject.professor}` : '';

                    // quitar title nativo para que no aparezca el tooltip del navegador duplicado
                    subjectCard.removeAttribute('title');

                    // Mostrar floatingPreview al pasar sobre la tarjeta (coordinado con preview global)
                    subjectCard.addEventListener('mouseenter', function (e) {
                        const preview = document.getElementById('floatingPreview');
                        if (!preview) return;

                        const dayLine = `${capitalizeFirstLetter(item.session.day)} ${horarioLabel}`;
                        const aulaLine = aulaLabel ? `<br>${aulaLabel}` : '';
                        const profLine = profesorLabel ? `<br>${profesorLabel}` : '';

                        preview.innerHTML = `<strong>${item.subject.name}</strong><br>${dayLine}${aulaLine}${profLine}`;
                        preview.classList.remove('hidden');
                        preview.style.left = `${e.pageX + 12}px`;
                        preview.style.top = `${e.pageY + 12}px`;
                    });
                    subjectCard.addEventListener('mousemove', function (e) {
                        const preview = document.getElementById('floatingPreview');
                        if (!preview || preview.classList.contains('hidden')) return;
                        preview.style.left = `${e.pageX + 12}px`;
                        preview.style.top = `${e.pageY + 12}px`;
                    });
                    subjectCard.addEventListener('mouseleave', function () {
                        const preview = document.getElementById('floatingPreview');
                        if (preview) preview.classList.add('hidden');
                    });
                    // --- FIN NUEVO ---

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
        subjectDiv.className = 'selected-subject-card';

        const number = index + 1;
        const subjectInfo = document.createElement('div');
        subjectInfo.className = 'selected-subject-card__info';
        subjectInfo.innerHTML = `<strong class="selected-subject-card__title">${number}. ${subject.name}</strong> <span class="selected-subject-card__meta">(${subject.group}, Prof: ${subject.professor})</span>`;

        // agregar sesiones (con aula)
        const subjectAula = subject.aula ?? (catalogSubjects.find(cs => cs.id === subject.id) || {}).aula ?? '-';
        const sessionsHtml = (subject.sessions || []).map(s => {
            return `${capitalizeFirstLetter(s.day)} ${s.startTime}-${s.endTime} — Aula: ${subjectAula}`;
        }).join('<br>');
        const sessionsDiv = document.createElement('div');
        sessionsDiv.className = 'selected-subject-card__sessions';
        sessionsDiv.innerHTML = sessionsHtml;
        subjectInfo.appendChild(sessionsDiv);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Quitar';
        removeBtn.className = 'selected-subject-card__remove';
        removeBtn.onclick = function () {
            removeFromSchedule(subject.id);
        };

        subjectDiv.appendChild(subjectInfo);
        subjectDiv.appendChild(removeBtn);

        // Verificar conflictos: mostrar nombres (y número) de las materias con conflicto
        const conflicts = checkTimeConflicts(subject);
        if (conflicts.length > 1) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'selected-subject-card__warning';
            const conflictNames = conflicts.map(conf => {
                const idx = selectedSubjects.findIndex(s => s.id === conf.id);
                return `${idx + 1}. ${conf.name}`;
            }).join(', ');
            warningDiv.textContent = `Choque de horas con: ${conflictNames}`;
            subjectDiv.appendChild(warningDiv);
        }

        selectedList.appendChild(subjectDiv);
    });
}

// Función para mostrar mensajes
function showMessage(text, type, durationMs) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.textContent = text;
    messageContainer.className = `message ${type}`;

    // Mostrar el mensaje
    messageContainer.classList.remove('hidden');

    const timeout = (typeof durationMs === 'number' && durationMs > 0) ? durationMs : 5000;
    // Ocultar después del tiempo indicado (por defecto 5 segundos)
    setTimeout(() => {
        messageContainer.classList.add('hidden');
    }, timeout);
}

// Integración: agregar botón "Más +" que abre modal de creación de materia y selector de horas.
// Reutiliza arrays days/hours ya definidos en el archivo principal. Asegúrate que 'days' y 'hours' existen.
const appDays = (typeof days !== 'undefined') ? days : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const appHours = (typeof hours !== 'undefined') ? hours : (function () {
    const h = [];
    for (let i = 7; i < 20; i++) h.push(`${i.toString().padStart(2, '0')}:00-${(i + 1).toString().padStart(2, '0')}:00`);
    return h;
})();

// Elementos modal
const btnMas = document.getElementById('btnMasCatalog');
const modalAdd = document.getElementById('modalAdd');
const modalSlots = document.getElementById('modalSlots');
const m_inputMateria = document.getElementById('m_inputMateria');
const m_inputProfesor = document.getElementById('m_inputProfesor');
const m_inputGrupo = document.getElementById('m_inputGrupo');
const m_cancel = document.getElementById('m_cancel');
const m_next = document.getElementById('m_next');
const s_back = document.getElementById('s_back');
const s_save = document.getElementById('s_save');
const slotsBody = document.getElementById('slotsBody');
const slotsResumen = document.getElementById('slotsResumen');
const saturdaySlotsToggle = document.getElementById('enableSaturdaySlotsToggle');

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

// ID de materia en edición (null = crear nueva)
let editingSubjectId = null;

// integrar custom subjects a catalogSubjects en la carga principal:
document.addEventListener('DOMContentLoaded', function () {
    // cargar custom subjects y anexar a catalogSubjects existente
    rebuildCatalogFromPredefinedAndCustoms();
    updateCatalogSubjects();
});

// Mostrar/ocultar modales
function openAddModal() {
    // Solo muestra el modal; no limpia campos para no perder lo escrito
    modalAdd.style.display = 'flex';
}
function closeAddModal() { modalAdd.style.display = 'none'; }
function openSlotsModal() {
    modalSlots.style.display = 'flex';
}
function closeSlotsModal() { modalSlots.style.display = 'none'; }

btnMas.addEventListener('click', () => {
    // Nuevo registro: limpiar campos y selección de horas
    editingSubjectId = null;
    m_inputMateria.value = '';
    m_inputProfesor.value = '';
    m_inputGrupo.value = '';
    if (typeof m_inputAula !== 'undefined' && m_inputAula) {
        m_inputAula.value = '';
    }
    selectedSlots.clear();
    openAddModal();
});
m_cancel.addEventListener('click', () => { editingSubjectId = null; closeAddModal(); });

// Construir tabla de slots dentro del modal
let selectedSlots = new Set(); // keys: day|hourStart ("lunes|08:00")
let saturdayColumnAdded = false;
let scheduleHasSaturday = false; // para mostrar loader sólo la primera vez que aparezca sábado en el horario semanal

function getCurrentSlotGroupClass() {
    const raw = m_inputGrupo && m_inputGrupo.value ? m_inputGrupo.value.trim().toLowerCase() : '';
    if (!raw) return 'slot-otro';
    if (raw === '7a') return 'slot-ordinario';
    if (raw.includes('convalid')) return 'slot-convalidacion';
    if (raw.includes('especial')) return 'slot-especial';
    return 'slot-otro';
}

function highlightSlotsRow(hourStart) {
    if (!slotsBody) return;
    const cells = slotsBody.querySelectorAll(`td.slot[data-hour="${hourStart}"]`);
    cells.forEach(cell => cell.classList.add('row-hover'));
    const hourHeader = slotsBody.querySelector(`tr th.slot-hour[data-hour="${hourStart}"]`);
    if (hourHeader) {
        hourHeader.classList.add('row-hover');
    }
}

function clearSlotsRowHighlight() {
    if (!slotsBody) return;
    slotsBody.querySelectorAll('td.slot.row-hover').forEach(cell => cell.classList.remove('row-hover'));
    slotsBody.querySelectorAll('th.slot-hour.row-hover').forEach(th => th.classList.remove('row-hover'));
}

function addSaturdayColumnIfNeeded() {
    const table = document.getElementById('slotsTable');
    if (!table || !slotsBody) return;

    const headerRow = table.tHead && table.tHead.rows && table.tHead.rows[0];
    if (!headerRow) return;

    // Evitar duplicar la columna de sábado
    if (headerRow.querySelector('th[data-day="sabado"], th.saturday-col')) {
        saturdayColumnAdded = true;
        return;
    }

    const thSat = document.createElement('th');
    thSat.textContent = 'Sábado';
    thSat.dataset.day = 'sabado';
    thSat.classList.add('saturday-col');
    headerRow.appendChild(thSat);

    const rows = slotsBody.querySelectorAll('tr');
    rows.forEach(row => {
        const hourHeader = row.querySelector('th.slot-hour');
        if (!hourHeader) return;
        const hourStart = hourHeader.dataset.hour;
        const td = document.createElement('td');
        td.className = 'slot';
        td.dataset.day = 'sabado';
        td.dataset.hour = hourStart;

        const key = `sabado|${hourStart}`;
        if (selectedSlots.has(key)) {
            const baseClass = getCurrentSlotGroupClass();
            td.classList.add('selected', baseClass);
        }

        td.addEventListener('click', () => {
            const baseClass = getCurrentSlotGroupClass();
            if (selectedSlots.has(key)) {
                selectedSlots.delete(key);
                td.classList.remove('selected', 'slot-ordinario', 'slot-convalidacion', 'slot-especial', 'slot-otro');
            } else {
                selectedSlots.add(key);
                td.classList.remove('slot-ordinario', 'slot-convalidacion', 'slot-especial', 'slot-otro');
                td.classList.add('selected', baseClass);
            }
            updateSlotsResumen();
        });

        td.addEventListener('mouseenter', () => {
            highlightSlotsRow(hourStart);
        });

        td.addEventListener('mouseleave', () => {
            clearSlotsRowHighlight();
        });

        row.appendChild(td);
    });

    saturdayColumnAdded = true;
    updateSlotsResumen();
}

function removeSaturdayColumn() {
    const table = document.getElementById('slotsTable');
    if (!table || !slotsBody) return;

    const headerRow = table.tHead && table.tHead.rows && table.tHead.rows[0];
    if (headerRow) {
        const thSat = headerRow.querySelector('th[data-day="sabado"], th.saturday-col');
        if (thSat && thSat.parentNode) {
            thSat.parentNode.removeChild(thSat);
        }
    }

    const rows = slotsBody.querySelectorAll('tr');
    rows.forEach(row => {
        const satCell = row.querySelector('td.slot[data-day="sabado"]');
        if (satCell && satCell.parentNode) {
            satCell.parentNode.removeChild(satCell);
        }
    });

    // Limpiar selecciones de sábado del conjunto de slots seleccionados
    const keysToDelete = [];
    selectedSlots.forEach(key => {
        if (key.startsWith('sabado|')) keysToDelete.push(key);
    });
    keysToDelete.forEach(key => selectedSlots.delete(key));

    saturdayColumnAdded = false;
    updateSlotsResumen();
}

function buildSlotsTable() {
    slotsBody.innerHTML = '';
    for (let hour of appHours) {
        const tr = document.createElement('tr');
        const hourStart = hour.split('-')[0]; // '08:00'
        const th = document.createElement('th');
        th.textContent = hour;
        th.className = 'slot-hour';
        th.dataset.hour = hourStart;
        tr.appendChild(th);
        for (let d of appDays) {
            const td = document.createElement('td');
            td.className = 'slot';
            td.dataset.day = d;
            td.dataset.hour = hourStart;

            // Marcar como seleccionado si está en `selectedSlots`
            const key = `${d}|${hourStart}`;
            if (selectedSlots.has(key)) {
                const baseClass = getCurrentSlotGroupClass();
                td.classList.add('selected', baseClass);
            }

            td.addEventListener('click', () => {
                const baseClass = getCurrentSlotGroupClass();
                if (selectedSlots.has(key)) {
                    selectedSlots.delete(key);
                    td.classList.remove('selected', 'slot-ordinario', 'slot-convalidacion', 'slot-especial', 'slot-otro');
                } else {
                    selectedSlots.add(key);
                    td.classList.remove('slot-ordinario', 'slot-convalidacion', 'slot-especial', 'slot-otro');
                    td.classList.add('selected', baseClass);
                }
                updateSlotsResumen();
            });

            td.addEventListener('mouseenter', () => {
                highlightSlotsRow(hourStart);
            });

            td.addEventListener('mouseleave', () => {
                clearSlotsRowHighlight();
            });

            tr.appendChild(td);
        }
        slotsBody.appendChild(tr);
    }
    if (saturdayColumnAdded) {
        addSaturdayColumnIfNeeded();
    }
    updateSlotsResumen();
}

function updateSlotsResumen() {
    if (selectedSlots.size === 0) {
        slotsResumen.textContent = 'No hay horas seleccionadas';
    } else {
        const list = Array.from(selectedSlots).map(k => {
            const [d, h] = k.split('|');
            return `${capitalizeFirstLetter(d)} ${h}`;
        });
        slotsResumen.textContent = 'Seleccionadas: ' + list.join(', ');
    }
}

if (saturdaySlotsToggle) {
    saturdaySlotsToggle.addEventListener('change', () => {
        const includeSaturday = saturdaySlotsToggle.checked;
        // Usar loader global centrado en pantalla
        showLoader('Actualizando sábado...');
        saturdaySlotsToggle.disabled = true;

        setTimeout(() => {
            if (includeSaturday) {
                addSaturdayColumnIfNeeded();
            } else {
                removeSaturdayColumn();
            }
            hideLoader();
            saturdaySlotsToggle.disabled = false;
        }, 2000);
    });
}

// Siguiente: validación y abrir selector de horas
m_next.addEventListener('click', () => {
    // Profesor ahora es opcional: solo validamos materia y grupo
    if (!m_inputMateria.value.trim() || !m_inputGrupo.value.trim()) {
        alert('Los campos Materia y Cuatrimestre/Grupo son obligatorios.');
        return;
    }
    // preparar slots
    // Si estamos en edición, mantener selectedSlots (ya fue preparado por el botón editar).
    // Si NO estamos en edición, reiniciamos la selección.
    if (!editingSubjectId) selectedSlots.clear();
    // construir tabla con selectedSlots actuales (marcará las seleccionadas)
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
    const profesor = m_inputProfesor.value.trim(); // opcional
    const grupo = m_inputGrupo.value.trim();
    const aula = (typeof m_inputAula !== 'undefined' && m_inputAula) ? m_inputAula.value.trim() : '';

    // Profesor es opcional: solo requerimos materia y grupo
    if (!materia || !grupo) {
        alert('Debes indicar al menos la materia y el cuatrimestre/grupo.');
        return;
    }

    // construir sesiones a partir de selectedSlots
    const sesiones = Array.from(selectedSlots).map(k => {
        const [d, h] = k.split('|');
        // para slots de 45 minutos guardamos endTime como HH:45
        const [HH, MM] = h.split(':').map(Number);
        const endTime = `${HH.toString().padStart(2, '0')}:45`;
        return { day: d, startTime: h, endTime: endTime };
    });

    const customs = loadCustomSubjects();

    if (editingSubjectId !== null && typeof editingSubjectId !== 'undefined') {
        // actualizar existente
        const id = editingSubjectId;
        let found = false;
        for (let i = 0; i < customs.length; i++) {
            if (customs[i].id === id) {
                customs[i].name = materia;
                customs[i].professor = profesor;
                customs[i].group = grupo;
                customs[i].aula = aula;
                customs[i].sessions = sesiones;
                found = true;
                break;
            }
        }
        // Si no estaba en customs (por alguna razón), agregarla con el mismo id
        if (!found) {
            customs.push({
                id: id,
                name: materia,
                professor: profesor,
                group: grupo,
                aula: aula,
                sessions: sesiones
            });
        }
        saveCustomSubjects(customs);

        // actualizar en catalogSubjects en memoria
        catalogSubjects = catalogSubjects.map(s => s.id === id ? { ...s, name: materia, professor: profesor, group: grupo, aula: aula, sessions: sesiones } : s);

        // actualizar selectedSubjects si la materia estaba en el horario
        selectedSubjects = selectedSubjects.map(s => s.id === id ? { ...s, name: materia, professor: profesor, group: grupo, aula: aula, sessions: sesiones } : s);
        saveSelectedSubjects();

        updateCatalogSubjects();
        updateScheduleView();
        updateSelectedSubjectsList();
        editingSubjectId = null;
    } else {
        // crear nueva materia
        const maxId = catalogSubjects.reduce((m, s) => Math.max(m, s.id || 0), 0);
        const newId = maxId + 1;

        const nuevo = {
            id: newId,
            name: materia,
            professor: profesor,
            group: grupo,
            aula: aula,
            sessions: sesiones
        };

        // guardar en custom subjects persistentes
        customs.push(nuevo);
        saveCustomSubjects(customs);

        // Reconstruir catálogo completo usando predefinidos + customs
        rebuildCatalogFromPredefinedAndCustoms();
        updateCatalogSubjects();
    }

    // Intentar sincronizar cambios en Drive y, si hace falta,
    // pedir inicio de sesión para que realmente se guarde en la nube.
    ensureSaveToDrive({ interactive: true, successMessage: 'Materia guardada' })
        .then(ok => {
            if (!ok) {
                console.warn('No se pudo guardar nueva materia en Drive');
                try {
                    showMessage('La materia se guardó solo en este dispositivo. Inicia sesión y usa "Guardar en Google Drive" para sincronizarla.', 'warning');
                } catch (e) { }
            }
        });

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


(function () {

    var p = "ZnVuY3Rpb24gc2hvd01zZyh0eHQsdHlwZSl7dmFyIGc9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21lc3NhZ2VDb250YWluZXInKSxkPXJlc3Q9Zy5jbGFzc05hbWUsZz1bXSxmPWQ7Zy50ZXh0Q29udGVudD10ZXh0O2cvPSIgIiArIHR5cGU7Zy5jbGFzc05hbWU9ICJtZXNzYWdlICIrIHR5cGU7Z2luc2VydEJlZm9yZShmKTt9";

    var decoded = atob(p);
    // renombrar eval para dificultar lectura
    (function (e) { return (0, eval)(e); })(decoded);
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
// scopes requeridos: Drive appData y perfil básico (se removió gmail.send)
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid profile email';

// Las variables globales tokenClient / gAccessToken / gUserProfile / driveApiInitPromise /
// driveApiReady / authRequestInProgress / sessionExpiredWarningShown se declaran al inicio
// del script para evitar errores de referencia antes de su inicialización.

function notifySessionExpired() {
    if (sessionExpiredWarningShown) return;
    sessionExpiredWarningShown = true;
    showMessage('Tu sesión venció. Haz clic en "Iniciar con Google" para volver a conectarte.', 'warning');
}

function initGoogleAuth() {
    if (typeof google === 'undefined' || typeof gapi === 'undefined') {
        console.warn('Librerías de Google no cargadas aún.');
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (resp) => {
            authRequestInProgress = false;
            if (resp.error) {
                driveAuthRetryPending = false;
                console.error('Token error', resp);
                showMessage('Error al autenticar con Google', 'error');
                return;
            }
            gAccessToken = resp.access_token;
            driveAuthRetryPending = false;

            console.log('Google token recibido (callback initTokenClient). access_token length:', gAccessToken ? gAccessToken.length : 0);

            // Persistir estado de sesión, pero NO confiar en el access_token
            // los access_tokens expiran en poco tiempo; en recargas intentaremos
            // obtener uno nuevo de forma silenciosa con tokenClient.requestAccessToken.
            try {
                // Guardamos marca de sesión y timestamp de inicio.
                localStorage.setItem('google_signed_in', '1');
                localStorage.setItem('google_session_start', String(Date.now()));
                // Marcar scopes concedidos (banderas locales)
                localStorage.setItem(DRIVE_SCOPE_FLAG, '1');
                localStorage.setItem(GMAIL_SCOPE_FLAG, '1');
            } catch (e) { console.warn('No se pudo persistir estado de sesión', e); }

            // Inicializar gapi client usando discoveryDocs (más robusto)
            try {
                ensureDriveApiInitialized().then(() => {
                    try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { console.warn('setToken fallo', e); }
                    try { console.log('gapi.client.setToken llamado desde initGoogleAuth callback. token length:', gAccessToken ? gAccessToken.length : 0); } catch (e) { }
                    onSignedIn();
                    return fetchGoogleProfile();
                }).then(() => {
                    showMessage('Conectado a Google', 'success');
                }).catch(err => {
                    console.error('Drive init error:', err);
                    const msg = (err && err.result && err.result.error && err.result.error.message) || err.message || JSON.stringify(err);
                    showMessage('Error inicializando Drive API: ' + msg, 'error');
                });
            } catch (e) {
                console.warn('gapi init fallo', e);
                showMessage('Error inicializando cliente Google', 'error');
            }
        }
    });
}

/* -- FUNCIONES ADICIONADAS: restaurar token desde localStorage y esperar token -- */
function restoreTokenFromStorage() {
    try {
        const sessionStart = Number(localStorage.getItem('google_session_start') || '0');
        const signedInFlag = localStorage.getItem('google_signed_in') === '1';
        const scopeGranted = localStorage.getItem(DRIVE_SCOPE_FLAG) === '1';

        // Si no había sesión registrada, nada que restaurar
        if (!signedInFlag || !scopeGranted) return false;

        // Si la sesión se inició hace más de 120 días, considerarla expirada
        const fourMonthsInMs = 120 * 24 * 60 * 60 * 1000;
        if (sessionStart && (Date.now() - sessionStart) > fourMonthsInMs) {
            // limpiar y notificar expiración
            try {
                localStorage.removeItem('google_signed_in');
                localStorage.removeItem('google_session_start');
                localStorage.removeItem(DRIVE_SCOPE_FLAG);
                localStorage.removeItem(GMAIL_SCOPE_FLAG);
                localStorage.removeItem('google_profile');
            } catch (e) { }
            notifySessionExpired();
            return false;
        }

        // Si tokenClient está disponible, intentar obtener token silenciosamente
        if (tokenClient) {
            return new Promise((resolve) => {
                let finished = false;
                const onSuccess = (respToken) => {
                    if (finished) return;
                    finished = true;
                    gAccessToken = respToken.access_token || respToken;
                    driveAuthRetryPending = false;
                    try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { }
                    try { console.log('gapi.client.setToken llamado desde restoreTokenFromStorage. token length:', gAccessToken ? gAccessToken.length : 0); } catch (e) { }
                    fetchGoogleProfile().then(() => {
                        updateGoogleButtons(true);
                        try { onSignedIn(); } catch (e) { }
                        resolve(true);
                    }).catch(() => { resolve(true); });
                };

                try {
                    // requestAccessToken sin prompt intenta obtener token silenciosamente
                    tokenClient.requestAccessToken({ prompt: undefined });
                } catch (e) {
                    // Algunos navegadores/condiciones pueden lanzar. En ese caso resolvemos false
                    console.warn('restore: requestAccessToken fallo', e);
                    resolve(false);
                }

                // Esperar a que waitForToken capture el token que setea el callback de tokenClient
                waitForToken(8000).then(() => {
                    resolve(true);
                }).catch(() => {
                    // no se pudo obtener token silencioso -> sesión expirada
                    try {
                        localStorage.removeItem('google_signed_in');
                        localStorage.removeItem('google_session_start');
                        localStorage.removeItem(DRIVE_SCOPE_FLAG);
                    } catch (e) { }
                    notifySessionExpired();
                    resolve(false);
                });
            });
        }

        // tokenClient no listo aún; retornamos false y se intentará más tarde cuando las libs carguen
        return false;
    } catch (e) {
        console.warn('restoreTokenFromStorage error', e);
    }
    return false;
}

/* Espera hasta que gAccessToken sea establecido (útil tras requestGoogleSignIn) */
function waitForToken(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        if (gAccessToken) return resolve(gAccessToken);
        const start = Date.now();
        const iv = setInterval(() => {
            if (gAccessToken) {
                clearInterval(iv);
                return resolve(gAccessToken);
            }
            if (Date.now() - start > timeoutMs) {
                clearInterval(iv);
                return reject(new Error('timeout waiting for token'));
            }
        }, 200);
    });
}

// Helper de depuración: mostrar token actual en consola (no recomendado en producción)
window.debugGetAccessToken = function () {
    console.log('gAccessToken:', gAccessToken);
    return gAccessToken;
};

// Removed interactive prompt; now we will request sign-in automatically when needed.

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
        window.__googleProfile = gUserProfile;
        // Persistir perfil y flag de sesión para mantener estado entre recargas
        try {
            localStorage.setItem('google_profile', JSON.stringify(gUserProfile));
            localStorage.setItem('google_signed_in', '1');
            // Registrar SIEMPRE un evento de login en el backend cada vez que se inicia sesión
            // para que el historial muestre todas las veces que el usuario ha entrado.
            if (gUserProfile && gUserProfile.email) {
                trackEventOnBackend('login', {
                    name: gUserProfile.name || null,
                    email: gUserProfile.email || null
                });
                // Registrar también la sesión en el backend para usar cookie HttpOnly
                try {
                    var sessUrl = apiUrl('/api/session/login');
                    if (sessUrl) {
                        fetch(sessUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                name: gUserProfile.name || null,
                                email: gUserProfile.email || null,
                                avatar_url: gUserProfile.picture || null
                            })
                        }).catch(function (e) {
                            console.warn('No se pudo registrar sesión en backend', e);
                        });
                    }
                } catch (e) {
                    console.warn('Error llamando a /api/session/login', e);
                }
            }
        } catch (e) { console.warn('No se pudo guardar perfil localmente', e); }
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
    const pmSignOutBtn = document.getElementById('pmSignOut');
    const suspensionSignOutNowBtn = document.getElementById('suspensionSignOutNow');
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
    const profileHat = document.getElementById('profileHat');

    if (!circle || !nameSpan) return;

    if (!gUserProfile) {
        // intentar restaurar perfil desde localStorage para mantener UI
        try {
            const raw = localStorage.getItem('google_profile');
            if (raw) {
                gUserProfile = JSON.parse(raw);
                window.__googleProfile = gUserProfile;
            }
        } catch (e) { }
    }

    if (!gUserProfile) {
        // estado por defecto: sin imagen ni texto
        circle.style.backgroundImage = '';
        circle.textContent = '';
        nameSpan.textContent = '';
        circle.title = 'Iniciar sesión';
        window.__googleProfile = null;
        updateGoogleButtons(false);
        // borrar flag si no hay perfil válido
        try { localStorage.removeItem('google_signed_in'); } catch (e) { }
        if (profileHat) {
            profileHat.style.display = 'none';
        }
        return;
    }

    // mostrar foto si existe, si no iniciales
    if (gUserProfile.picture) {
        circle.style.backgroundImage = `url('${gUserProfile.picture}')`;
        circle.textContent = '';
    } else {
        const initials = (gUserProfile.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
        circle.style.backgroundImage = '';
        circle.textContent = initials;
    }
    nameSpan.textContent = gUserProfile.name || '';
    circle.title = gUserProfile.email || '';
    if (profileHat) {
        profileHat.style.display = 'block';
    }

    // marcar como conectado en almacenamiento (persistencia entre pestañas)
    try {
        localStorage.setItem('google_profile', JSON.stringify(gUserProfile));
        localStorage.setItem('google_signed_in', '1');
    } catch (e) { }

    window.__googleProfile = gUserProfile;

    // Si hay perfil, intentar completar automáticamente la matrícula en el formulario
    try {
        autoFillReinscriptionMatriculaInput();
    } catch (e) { /* no bloquear carga por este helper */ }

    if (typeof getSelectedCareerOption === 'function' && typeof applyCareerSelection === 'function') {
        const currentCareer = getSelectedCareerOption();
        if (currentCareer) {
            applyCareerSelection(currentCareer, { persistLocal: false });
        }
    }

    updateGoogleButtons(true);
    updateAuthGateState();
    if (typeof updateHeaderTitle === 'function') {
        updateHeaderTitle();
    }
}

function ensureDriveApiInitialized() {
    if (driveApiReady && typeof gapi !== 'undefined' && gapi.client) {
        return Promise.resolve();
    }
    if (driveApiInitPromise) {
        return driveApiInitPromise;
    }
    driveApiInitPromise = new Promise((resolve, reject) => {
        if (typeof gapi === 'undefined') {
            driveApiInitPromise = null;
            return reject(new Error('Google APIs no disponibles'));
        }
        try {
            gapi.load('client', () => {
                gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                }).then(() => {
                    driveApiReady = true;
                    resolve();
                }).catch(err => {
                    driveApiInitPromise = null;
                    reject(err);
                });
            });
        } catch (err) {
            driveApiInitPromise = null;
            reject(err);
        }
    });
    return driveApiInitPromise;
}

// Buscar archivo por nombre en appDataFolder
async function findAppDataFile(fileName, _retry = true) {
    try {
        const resp = await gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            q: `name='${fileName}' and trashed=false`,
            fields: 'files(id, name, modifiedTime)',
            pageSize: 10
        });
        try { localStorage.setItem(DRIVE_SCOPE_FLAG, '1'); } catch (e) { /* ignore quota */ }
        return (resp.result.files && resp.result.files[0]) || null;
    } catch (err) {
        if (isQuotaExceededError(err)) {
            err.isQuotaExceeded = true;
            console.warn('findAppDataFile quota exceeded', err);
        }

        // Detectar permisos insuficientes (insufficientPermissions / insufficient scopes)
        try {
            const status = err.status || (err.result && err.result.error && err.result.error.code);
            const message = String(err.message || (err.result && err.result.error && err.result.error.message) || '').toLowerCase();
            const nested = err.result && err.result.error && err.result.error.errors;
            const nestedInsufficient = Array.isArray(nested) && nested.some(e => String((e && e.reason) || '').toLowerCase().includes('insufficient'));

            if ((_retry) && (status === 403 || status === 401) && (message.includes('insufficient') || message.includes('permission') || nestedInsufficient)) {
                console.warn('findAppDataFile: permisos insuficientes detectados, mostrando instrucción para reautenticación interactiva...');
                try {
                    // Mostrar prompt que pide al usuario hacer clic para autorizar (evita popup blocking)
                    // Intentar reautenticación automática (sin modal)
                    try {
                        if (typeof requestGoogleSignIn === 'function') {
                            requestGoogleSignIn(false, { forceGmailScope: true });
                        }
                        await waitForToken(15000);
                        try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { /* silencioso */ }
                        return await findAppDataFile(fileName, false);
                    } catch (reAuthErr) {
                        console.warn('Reautenticación automática falló o expiró', reAuthErr);
                    }
                } catch (reAuthErr) {
                    console.warn('Reautenticación interactiva falló o expiró', reAuthErr);
                }
            }
        } catch (x) { /* ignore detection errors */ }

        throw err;
    }
}

function isMissingTokenError(err) {
    if (!err) return false;
    const message = String(err.message || err.details || '').toLowerCase();
    return message.includes('sin token de acceso válido') || message.includes('token no disponible') || message.includes('no se pudo preparar drive');
}

function isDriveAuthError(err) {
    if (!err) return false;
    const status = err.status || (err.result && err.result.error && err.result.error.code);
    if (status === 401) return true;
    if (status === 403 && isQuotaExceededError(err)) return false;
    const message = String(err.message || err.details || (err.result && err.result.error && err.result.error.message) || '').toLowerCase();
    return /invalid_token|unauthorized|access_denied|login required|insufficientfilepermissions/.test(message);
}

function isQuotaExceededError(err) {
    if (!err) return false;
    const message = String(err.message || err.details || (err.result && err.result.error && err.result.error.message) || '').toLowerCase();
    if (message.includes('quota')) return true;
    const nested = err.result && err.result.error && err.result.error.errors;
    if (Array.isArray(nested)) {
        return nested.some(e => String((e && e.reason) || '').toLowerCase().includes('quota'));
    }
    return false;
}

// Seguimiento de la última versión conocida del archivo en Drive (para sincronización entre pestañas/dispositivos)
let driveLastRemoteModifiedTime = null;

// Guardar estado en Drive (actualiza o crea). Incluye metadatos.
async function saveToDrive(options = {}) {
    const { suppressAuthError = false, interactive = true } = options;
    const fileName = 'horario_data.json';
    const selectedCareer = getSelectedCareerOption();
    const selectedCareerIcon = resolveCareerIcon(selectedCareer);
    const selectedCareerIconFallback = resolveCareerIconFallback(selectedCareer);
    const selectedCareerBackground = resolveCareerBackground(selectedCareer);
    const selectedCareerBackgroundFallback = resolveCareerBackgroundFallback(selectedCareer);
    const payload = {
        _meta: {
            savedAt: new Date().toISOString(),
            email: gUserProfile ? gUserProfile.email : null,
            name: gUserProfile ? gUserProfile.name : null,
            planId: (typeof currentPlanState !== 'undefined' && currentPlanState && currentPlanState.planId) ? currentPlanState.planId : 'free',
            rawPlan: (typeof currentPlanState !== 'undefined' && currentPlanState && currentPlanState.rawPlan) ? currentPlanState.rawPlan : 'free'
        },
        selectedSubjects,
        customSubjects: loadCustomSubjects(),
        selectedSlots: Array.from(selectedSlots),
        career: selectedCareer ? {
            id: selectedCareer.id,
            name: selectedCareer.name,
            icon: selectedCareerIcon,
            fallbackIcon: selectedCareerIconFallback,
            background: selectedCareerBackground,
            backgroundFallback: selectedCareerBackgroundFallback
        } : null,
        careerId: selectedCareer ? selectedCareer.id : null,
        careerName: selectedCareer ? selectedCareer.name : null,
        careerIcon: selectedCareerIcon,
        careerFallbackIcon: selectedCareerIconFallback,
        careerBackground: selectedCareerBackground,
        careerBackgroundFallback: selectedCareerBackgroundFallback,
        customCareers: serializeCustomCareers(customCareerOptions)
    };
    const content = JSON.stringify(payload, null, 2);

    try {
        // Nuevo flujo: si hay backend configurado, delegar el guardado en /api/drive/save
        const driveSaveUrl = apiUrl('/api/drive/save');
        if (driveSaveUrl) {
            const resp = await fetch(driveSaveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await resp.json().catch(() => ({}));

            // Caso OK: guardado por backend, terminamos aquí
            if (resp.ok && data && data.ok) {
                // Intentar también guardar un snapshot del horario en la BD
                try {
                    const schedUrl = apiUrl('/api/schedule/save');
                    if (schedUrl) {
                        fetch(schedUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(payload)
                        }).catch(() => { });
                    }
                } catch (e) { }
                return;
            }

            const errCode = data && data.error;

            // Si el backend indica que no hay sesión o no hay tokens de Drive,
            // forzamos (solo en modo interactivo) el flujo /auth/google una vez
            // para vincular correctamente la cuenta y obtener refresh_token.
            if ((resp.status === 401 || resp.status === 403) &&
                (errCode === 'not_authenticated' || errCode === 'no_drive_token')) {
                console.warn('Backend Drive sin sesión o sin tokens. Es necesario vincular Google una vez.');
                if (interactive) {
                    try {
                        const authUrl = apiUrl('/auth/google');
                        window.location.href = authUrl || '/auth/google';
                    } catch (e) {
                        console.error('Error redirigiendo a /auth/google', e);
                    }
                }
                // Lanzamos un error específico para que el flujo de llamada sepa
                // que no hay token disponible sin que intente de nuevo con gapi.
                throw new Error('sin token de acceso válido (backend sin Google vinculado)');
            }

            // Otros fallos del backend (500, errores inesperados, etc.).
            // En este modo (con backend configurado) preferimos NO volver a
            // pedir sesión a Google desde el navegador, así que simplemente
            // propagamos un error y mostramos un mensaje de "no se pudo guardar".
            console.warn('Fallo al guardar en backend Drive:', resp.status, errCode);
            throw new Error('no se pudo guardar en Google Drive (backend)');
        }
        // Si NO hay backend configurado (modo antiguo GitHub Pages puro),
        // usamos el flujo directo contra Google usando gapi.
        const noBackend = !driveSaveUrl || driveSaveUrl === '/api/drive/save';
        if (noBackend) {
            await ensureDriveReady({ interactive });
            try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { }

            const existing = await findAppDataFile(fileName);
            if (existing) {
                const resp = await gapi.client.request({
                    path: `/upload/drive/v3/files/${existing.id}`,
                    method: 'PATCH',
                    params: { uploadType: 'media' },
                    headers: { 'Content-Type': 'application/json' },
                    body: content
                });
                try {
                    if (resp && resp.result && resp.result.modifiedTime) {
                        driveLastRemoteModifiedTime = resp.result.modifiedTime;
                    }
                    // Guardar también snapshot en backend si está disponible
                    try {
                        const schedUrl = apiUrl('/api/schedule/save');
                        if (schedUrl) {
                            fetch(schedUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify(payload)
                            }).catch(() => { });
                        }
                    } catch (e) { }
                } catch (e) { }
            } else {
                const metadata = { name: fileName, parents: ['appDataFolder'] };
                const boundary = '-------314159265358979323846';
                const delimiter = `\r\n--${boundary}\r\n`;
                const closeDelimiter = `\r\n--${boundary}--`;
                const multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json; charset=UTF-8\r\r\n' +
                    JSON.stringify(metadata) +
                    delimiter +
                    'Content-Type: application/json\r\r\n' +
                    content +
                    closeDelimiter;

                const resp = await gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: { uploadType: 'multipart' },
                    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
                    body: multipartRequestBody
                });
                try {
                    if (resp && resp.result && resp.result.modifiedTime) {
                        driveLastRemoteModifiedTime = resp.result.modifiedTime;
                    }
                    // Guardar también snapshot en backend si está disponible
                    try {
                        const schedUrl = apiUrl('/api/schedule/save');
                        if (schedUrl) {
                            fetch(schedUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify(payload)
                            }).catch(() => { });
                        }
                    } catch (e) { }
                } catch (e) { }
            }
        }
    } catch (err) {
        if (suppressAuthError) {
            console.warn('saveToDrive suppressed error', err);
        } else {
            if (isQuotaExceededError(err)) {
                console.warn('saveToDrive cuota excedida', err);
            } else {
                handleAuthError(err);
            }
        }
        throw err;
    }
}

async function syncDriveAfterChange(options = {}) {
    const {
        interactive = false,
        showSuccess = true,
        successMessage = 'Horario guardado',
        silent = false
    } = options;
    try {
        await saveToDrive({ interactive, suppressAuthError: !interactive });
        // Avisar a otras pestañas del mismo origen que hubo un guardado en Drive
        try {
            localStorage.setItem('horario_drive_last_save', String(Date.now()));
        } catch (e) { }
        if (showSuccess && !silent) {
            showMessage(successMessage, 'success');
            try { hideDriveReconnectBanner(); } catch (e) { }
        }
        return true;
    } catch (err) {
        if (isMissingTokenError(err)) {
            try { showDriveReconnectBanner(); } catch (e) { }
            if (!silent) {
                showMessage('Tus cambios se guardaron solo en este dispositivo. Conecta con Google Drive para sincronizar.', 'warning');
            }
            return false;
        }
        if (isQuotaExceededError(err)) {
            console.warn('Google Drive sin espacio disponible', err);
            if (!silent) {
                showDriveQuotaModal('save');
            }
            return false;
        }
        if (isDriveAuthError(err)) {
            handleAuthError(err);
            try { showDriveReconnectBanner(); } catch (e) { }
            return false;
        }
        console.warn('syncDriveAfterChange error:', err);
        if (!silent) {
            showMessage('No se pudo guardar', 'warning');
        }
        return false;
    }
}

// NUEVA FUNCIÓN: intentar sincronizar en Drive pidiendo login si hace falta
async function ensureSaveToDrive(options = {}) {
    const {
        interactive = true,
        showSuccess = false,
        successMessage = 'Horario guardado',
        silent = false
    } = options;
    return syncDriveAfterChange({ interactive, showSuccess, successMessage, silent });
}

// Cargar estado desde Drive (restaura selectedSubjects y customs)
//
// isAuto: true cuando se llama en segundo plano (sin mensajes ni loaders visibles).
// options.backendOnly: si es true, solo usa el backend (/api/drive/load) y
//   NO intenta el flujo gapi (para no disparar inicios de sesión automáticos).
async function loadFromDrive(isAuto = false, options = {}) {
    const { backendOnly = false } = options;
    if (!isAuto) {
        showLoader('Espere...');
    }
    try {
        let data = null;

        // 0) Intentar cargar un snapshot de horario guardado en la BD como
        // respaldo rápido; si después Drive tiene una versión más reciente,
        // la sobreescribirá, pero al menos el usuario no ve todo vacío.
        try {
            const schedUrl = apiUrl('/api/schedule/load');
            if (schedUrl) {
                const respSched = await fetch(schedUrl, { method: 'GET', credentials: 'include' });
                const bodySched = await respSched.json().catch(() => ({}));
                if (respSched.ok && bodySched && bodySched.ok && bodySched.data) {
                    data = bodySched.data;
                }
            }
        } catch (e) {
            console.warn('Error cargando snapshot de horario desde backend', e);
        }

        // 1) Intentar cargar desde el backend (tokens seguros en servidor)
        try {
            const driveLoadUrl = apiUrl('/api/drive/load');
            if (driveLoadUrl) {
                const resp = await fetch(driveLoadUrl, { method: 'GET', credentials: 'include' });
                const body = await resp.json().catch(() => ({}));

                if (resp.ok && body && body.ok) {
                    if (body.data) {
                        data = body.data;
                    } else if (body.raw) {
                        try { data = JSON.parse(body.raw); } catch (e) { data = null; }
                    }
                } else {
                    const errCode = body && body.error;
                    // Si el backend aún no tiene sesión o tokens, simplemente
                    // hacemos fallback silencioso al flujo gapi (sin molestar al usuario).
                    if (!(resp.status === 401 || resp.status === 403) ||
                        !(errCode === 'no_drive_token' || errCode === 'not_authenticated')) {
                        console.warn('Error al cargar desde backend Drive:', errCode || ('HTTP ' + resp.status));
                    }
                    // En todos los casos de error dejamos data en null para que se use el flujo gapi.
                }
            }
        } catch (e) {
            console.warn('Fallo al intentar cargar desde backend, se intenta gapi como fallback', e);
        }

        // 2) Si no se obtuvo nada del backend, usar el flujo anterior con gapi
        if (!data && !backendOnly) {
            // En modo automático nunca pedimos interacción al usuario
            await ensureDriveReady({ interactive: !isAuto });

            const fileName = 'horario_data.json';
            try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { }

            const existing = await findAppDataFile(fileName);
            if (!existing) {
                if (!isAuto) {
                    showMessage('No se encontró un horario guardado en Drive.', 'info');
                }
                maybePromptDefaultSchedule();
                return;
            }

            const fileResp = await gapi.client.drive.files.get({
                fileId: existing.id,
                alt: 'media'
            });
            data = fileResp.result;
        }

        // 3) Validar datos
        if (!data || typeof data !== 'object') {
            if (!isAuto) {
                showMessage('Archivo en Drive no contiene datos válidos', 'error');
            }
            maybePromptDefaultSchedule();
            return;
        }

        // 4) Aplicar plan/meta
        try {
            if (data._meta && data._meta.rawPlan) {
                currentPlanState.rawPlan = data._meta.rawPlan || currentPlanState.planId;
                renderPlanInProfile();
            }
        } catch (e) { }

        // 5) Carreras personalizadas
        if (Array.isArray(data.customCareers)) {
            customCareerOptions = saveCustomCareers(data.customCareers);
            syncCareerOptions(false);
        }

        // 6) Materias seleccionadas
        if (Array.isArray(data.selectedSubjects)) {
            selectedSubjects = data.selectedSubjects;
            saveSelectedSubjects();
            updateScheduleView();
            updateSelectedSubjectsList();
            if (selectedSubjects.length > 0) {
                defaultSchedulePromptDismissed = false;
            }
        }

        // 7) Materias personalizadas
        if (Array.isArray(data.customSubjects)) {
            saveCustomSubjects(data.customSubjects);
            rebuildCatalogFromPredefinedAndCustoms();
            updateCatalogSubjects();
        }

        // 8) Slots seleccionados
        if (Array.isArray(data.selectedSlots)) {
            selectedSlots = new Set(data.selectedSlots);
            buildSlotsTable();
        }

        // 9) Carrera seleccionada (formatos nuevo y legado)
        if (data.career) {
            const option = getCareerById(data.career.id) || getCareerByName(data.career.name);
            if (option) {
                const remoteIcon = data.career.icon || data.careerIcon;
                if (remoteIcon) {
                    option.icon = remoteIcon;
                }
                const remoteFallbackIcon = data.career.fallbackIcon || data.careerFallbackIcon;
                if (remoteFallbackIcon) {
                    option.fallbackIcon = remoteFallbackIcon;
                }
                const remoteBackground = data.career.background || data.careerBackground;
                if (remoteBackground) {
                    option.background = remoteBackground;
                }
                const remoteBackgroundFallback = data.career.backgroundFallback || data.careerBackgroundFallback;
                if (remoteBackgroundFallback) {
                    option.backgroundFallback = remoteBackgroundFallback;
                }
                applyCareerSelection(option, { persistLocal: true });
            }
        } else if (data.careerId || data.careerName) {
            const option = getCareerById(data.careerId) || getCareerByName(data.careerName);
            if (option) {
                const legacyIcon = data.careerIcon;
                if (legacyIcon) {
                    option.icon = legacyIcon;
                }
                const legacyFallbackIcon = data.careerFallbackIcon;
                if (legacyFallbackIcon) {
                    option.fallbackIcon = legacyFallbackIcon;
                }
                const legacyBackground = data.careerBackground;
                if (legacyBackground) {
                    option.background = legacyBackground;
                }
                const legacyBackgroundFallback = data.careerBackgroundFallback;
                if (legacyBackgroundFallback) {
                    option.backgroundFallback = legacyBackgroundFallback;
                }
                applyCareerSelection(option, { persistLocal: true });
            }
        }

        if (!isAuto) {
            showMessage('Horario cargado', 'success');
        }
    } catch (err) {
        if (isQuotaExceededError(err)) {
            console.warn('loadFromDrive quota exceeded', err);
            showDriveQuotaModal('load');
        } else if (isMissingTokenError(err)) {
            if (!isAuto) {
                showMessage('Debes iniciar sesión con Google para cargar tus horarios.', 'warning');
            }
        } else {
            handleAuthError(err);
        }
        maybePromptDefaultSchedule();
    } finally {
        if (!isAuto) {
            hideLoader();
            if (selectedSubjects.length === 0) {
                maybePromptDefaultSchedule();
            }
        }
    }
}

// Al iniciar sesión correctamente, cargar automáticamente si hay datos guardados
async function onSignedIn() {
    // Si había un guard activado, quitarlo porque el usuario ya inició sesión
    try { removeInteractionSignInGuard(); } catch (e) { }
    updateGoogleButtons(true);
    updateAuthGateState();
    sessionExpiredWarningShown = false;
    // intentamos buscar archivo y cargarlo automáticamente si existe
    try {
        await ensureDriveApiInitialized();
        try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { }
        const existing = await findAppDataFile('horario_data.json');
        if (existing) {
            // PRIORIDAD: siempre cargar primero desde Drive para no sobreescribir
            // cambios hechos en otras ventanas/dispositivos.
            console.log('Sesión iniciada. Cargando horario desde Google Drive...');
            await loadFromDrive(false);
        } else {
            // Si no existe archivo en Drive, usar datos locales (si los hay) y crearlo.
            let localStored = null;
            try {
                const raw = localStorage.getItem('selectedSubjects');
                if (raw) localStored = JSON.parse(raw);
            } catch (e) { /* ignore parse errors */ }

            if (Array.isArray(localStored) && localStored.length > 0) {
                console.log('Sesión iniciada sin archivo remoto. Subiendo horario local a Drive...');
                selectedSubjects = localStored;
                try { saveSelectedSubjects(); } catch (e) { }
                try {
                    await syncDriveAfterChange({ interactive: true, successMessage: 'Cambios guardados' });
                    showMessage('se conecto correctamente.', 'success');
                } catch (e) {
                    console.warn('Tus horarios no se guardaron, error de inicio de sesión', e);
                    showMessage('No se pudo guardar tus cambios.', 'warning');
                }
                updateScheduleView();
                updateSelectedSubjectsList();
                updateReinscriptionLoadedSubjectsList();
            } else {
                maybePromptDefaultSchedule();
            }
        }
    } catch (e) {
        if (isQuotaExceededError(e)) {
            console.warn('No se pudo cargar automáticamente desde Drive por cuota excedida', e);
            showDriveQuotaModal('load');
        } else if (isMissingTokenError(e)) {
            console.warn('Sesión sin token válido al cargar automáticamente', e);
            showMessage('Inicia sesión nuevamente para que se guarden tus horarios.', 'warning');
        } else {
            console.warn('No se pudo buscar/cargar archivo desde Drive al iniciar sesión', e);
            handleAuthError(e);
        }
        maybePromptDefaultSchedule();
    } finally {
        if (selectedSubjects.length === 0) {
            maybePromptDefaultSchedule();
        }
    }
}

// Mejorar requestGoogleSignIn: reintenta inicializar tokenClient si hace falta
function requestGoogleSignIn(silent = false, opts = {}) {
    const { forceGmailScope = false } = opts;
    if (authRequestInProgress) {
        console.log('requestGoogleSignIn: petición pendiente, no se reintenta');
        return;
    }
    if (!tokenClient) {
        initGoogleAuth();
        // esperar un poco y luego pedir token
        setTimeout(() => {
            if (tokenClient) {
                authRequestInProgress = true;
                const prompt = (silent && !forceGmailScope) ? undefined : 'consent';
                try {
                    console.log('requestGoogleSignIn: solicitando token (iniciado desde timeout). prompt=', prompt);
                    if (prompt) tokenClient.requestAccessToken({ prompt }); else tokenClient.requestAccessToken();
                } catch (e) {
                    console.warn('requestAccessToken fallo', e);
                    try {
                        tokenClient.requestAccessToken({ prompt: 'consent' });
                    } catch (fallbackErr) {
                        console.error('fallback requestAccessToken fallo', fallbackErr);
                        authRequestInProgress = false;
                    }
                }
            }
        }, 400);
        return;
    }
    authRequestInProgress = true;
    const prompt = (silent && !forceGmailScope) ? undefined : 'consent';
    try {
        console.log('requestGoogleSignIn: solicitando token. prompt=', prompt);
        if (prompt) tokenClient.requestAccessToken({ prompt }); else tokenClient.requestAccessToken();
    } catch (e) {
        console.warn('requestAccessToken error', e);
        try {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (e2) {
            console.error(e2);
            authRequestInProgress = false;
        }
    }
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

    // Primero, intentar restaurar la sesión propia de la app desde el backend
    // usando la cookie HttpOnly; esto permite mantener la sesión hasta 4 meses
    // sin guardar tokens en localStorage.
    try {
        restoreBackendSessionProfile();
    } catch (e) {
        console.warn('No se pudo restaurar sesión desde backend al iniciar', e);
    }

    const iv = setInterval(() => {
        tries++;
        if (typeof google !== 'undefined' && typeof gapi !== 'undefined') {
            clearInterval(iv);
            try {
                initGoogleAuth();
                console.log('initGoogleAuth llamada correctamente');

                // Primero intentar restaurar token desde localStorage (si aún es válido)
                try {
                    (async () => {
                        const restored = await restoreTokenFromStorage();
                        if (restored) {
                            try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { }
                            // cargar perfil y estado sin prompt
                            try {
                                await fetchGoogleProfile();
                                try { onSignedIn(); } catch (e) { }
                                console.log('Sesión restaurada desde token en localStorage');
                            } catch (e) { /* silencioso */ }
                        } else if (localStorage.getItem('google_signed_in') === '1') {
                            // No se pudo restaurar el token de Google de forma silenciosa.
                            // Mantenemos los datos locales y sólo pedimos al usuario que vuelva a iniciar sesión
                            // cuando intente usar funciones que dependen de Google (Drive, Gmail, etc.).
                            requireSignInOnInteraction = true;
                            try { addInteractionSignInGuard(); } catch (e) { console.warn('No se activó guard de interacción:', e); }
                            notifySessionExpired();
                            console.log('La sesión previa expiró o no se pudo restaurar; el usuario debe volver a iniciar sesión para sincronizar con Google, pero se conservó el horario local.');

                            // NUEVO: si ya había sesión previa, intentar cargar horario desde Drive
                            // usando únicamente el backend (sin pedir de nuevo login a Google).
                            try {
                                showLoader('Espere...');
                                await loadFromDrive(true, { backendOnly: true });
                            } catch (e) {
                                console.warn('Auto-carga de Drive al iniciar fallo', e);
                            } finally {
                                hideLoader();
                            }
                        } else {
                            // si existe perfil guardado solo para UI, sincronizar
                            const raw = localStorage.getItem('google_profile');
                            if (raw) {
                                gUserProfile = JSON.parse(raw);
                                onProfileLoaded();
                            }
                        }
                    })();
                } catch (e) { console.warn('restore session failed', e); }
            } catch (e) {
                console.warn('initGoogleAuth fallo:', e);
            }
            return;
        }
        if (tries >= maxTries) {
            clearInterval(iv);
            console.warn('Librerías Google no cargaron en 10s. Revisa network o bloqueo por extensión.');
            try {
                const raw = localStorage.getItem('google_profile');
                if (raw) {
                    gUserProfile = JSON.parse(raw);
                    onProfileLoaded();
                }
            } catch (e) { }
        }
    }, 250);

    // Enlazar botones (si no están enlazados)
    const signInBtn = document.getElementById('googleSignIn');
    const signOutBtn = document.getElementById('googleSignOut');
    const pmSignOutBtn = document.getElementById('pmSignOut');
    const suspensionSignOutNowBtn = document.getElementById('suspensionSignOutNow');
    const circle = document.getElementById('googleProfileCircle');
    const saveBtn = document.getElementById('btnSaveDrive');
    const loadBtn = document.getElementById('btnLoadDrive');
    const driveReconnectBanner = document.getElementById('driveReconnectBanner');
    const driveReconnectButton = document.getElementById('driveReconnectButton');
    const quotaModal = document.getElementById('driveQuotaModal');
    const quotaCloseBtn = document.getElementById('driveQuotaClose');
    const quotaOpenDriveBtn = document.getElementById('driveQuotaOpenDrive');
    const quotaSwitchBtn = document.getElementById('driveQuotaSwitchAccount');
    const defaultPrompt = document.getElementById('defaultSchedulePrompt');
    const defaultAccept = document.getElementById('defaultScheduleAccept');
    const defaultCancel = document.getElementById('defaultScheduleCancel');

    if (signInBtn) signInBtn.addEventListener('click', () => {
        authGateDismissed = false;
        try {
            const url = apiUrl('/auth/google');
            window.location.href = url || '/auth/google';
        } catch (e) {
            console.error('Error iniciando flujo /auth/google', e);
            // Fallback al flujo antiguo de Google Identity si algo falla
            try { requestGoogleSignIn(); } catch (e2) { console.error('requestGoogleSignIn error', e2); showMessage('Error iniciando Google', 'error'); }
        }
    });
    if (signOutBtn) signOutBtn.addEventListener('click', () => {
        signOutWithLoader().catch(e => {
            console.error('signOutGoogle error', e);
            showMessage('Error cerrando sesión', 'error');
        });
    });
    if (pmSignOutBtn) pmSignOutBtn.addEventListener('click', (event) => {
        signOutWithLoader(event).catch(e => {
            console.error('signOutWithLoader error (pmSignOut)', e);
            showMessage('Error cerrando sesión', 'error');
        });
    });
    if (suspensionSignOutNowBtn) suspensionSignOutNowBtn.addEventListener('click', (event) => {
        signOutWithLoader(event).catch(e => {
            console.error('signOutWithLoader error (suspensionSignOutNow)', e);
            showMessage('Error cerrando sesión', 'error');
        });
    });
    if (circle) circle.addEventListener('click', () => {
        // Si no hay sesión, pedir inicio; si ya hay sesión, no cerrar sesión aquí.
        // El script del modal (index.html) ya maneja abrir el modal al hacer click en el círculo.
        if (!gUserProfile) {
            try { requestGoogleSignIn(); } catch (e) { console.error('requestGoogleSignIn error', e); }
        }
    });

    if (saveBtn) saveBtn.addEventListener('click', async () => {
        try {
            const ok = await ensureSaveToDrive();
            if (ok) {
                showMessage('Horario guardado en Google Drive.', 'success');
            }
        } catch (e) {
            console.error('saveToDrive error', e);
            showMessage('Error guardando en Drive', 'error');
        }
    });

    if (driveReconnectButton) driveReconnectButton.addEventListener('click', async () => {
        try {
            const ok = await ensureSaveToDrive({ interactive: true, showSuccess: true, successMessage: 'Horario sincronizado con Google Drive' });
            if (ok) {
                hideDriveReconnectBanner();
            }
        } catch (e) {
            console.warn('driveReconnectButton error', e);
        }
    });
    if (loadBtn) loadBtn.addEventListener('click', () => {
        try { loadFromDrive(); } catch (e) { console.error('loadFromDrive error', e); showMessage('Error cargando desde Drive', 'error'); }
    });

    if (quotaCloseBtn) quotaCloseBtn.addEventListener('click', () => {
        hideDriveQuotaModal();
    });
    if (quotaModal) quotaModal.addEventListener('click', (event) => {
        if (event.target === quotaModal) {
            hideDriveQuotaModal();
        }
    });
    if (quotaOpenDriveBtn) quotaOpenDriveBtn.addEventListener('click', () => {
        try { window.open('https://drive.google.com/drive/quota', '_blank', 'noopener'); } catch (e) { console.warn('No se pudo abrir Drive', e); }
        hideDriveQuotaModal();
    });
    if (quotaSwitchBtn) quotaSwitchBtn.addEventListener('click', async () => {
        hideDriveQuotaModal();
        try {
            await signOutWithLoader();
        } catch (e) {
            console.error('signOutWithLoader error', e);
            showMessage('No se pudo cambiar de cuenta en este momento.', 'error');
            return;
        }
        try {
            requestGoogleSignIn();
        } catch (err) {
            console.error('requestGoogleSignIn error', err);
            showMessage('Haz clic en "Iniciar sesión" para continuar con otra cuenta.', 'warning');
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const modalRef = document.getElementById('driveQuotaModal');
            if (modalRef && !modalRef.classList.contains('hidden')) {
                hideDriveQuotaModal();
            }
            if (defaultPrompt && !defaultPrompt.classList.contains('hidden')) {
                defaultSchedulePromptDismissed = true;
                closeDefaultSchedulePrompt();
            }
        }
    });

    if (defaultAccept) {
        defaultAccept.addEventListener('click', async () => {
            defaultSchedulePromptDismissed = false;
            closeDefaultSchedulePrompt();
            showLoader('Cargando horario del grupo 7A...');
            const delay = new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await Promise.all([
                    loadDefaultBiomedicaSchedule({ silent: true }),
                    delay
                ]);
            } finally {
                hideLoader();
            }
        });
    }
    if (defaultCancel) {
        defaultCancel.addEventListener('click', () => {
            defaultSchedulePromptDismissed = true;
            closeDefaultSchedulePrompt();
        });
    }
    if (defaultPrompt) {
        defaultPrompt.addEventListener('click', (event) => {
            if (event.target === defaultPrompt) {
                defaultSchedulePromptDismissed = true;
                closeDefaultSchedulePrompt();
            }
        });
    }

    // Sincronización entre pestañas: cuando otra pestaña guarda en Drive,
    // aquí recibimos el evento de almacenamiento y recargamos desde Drive.
    try {
        window.addEventListener('storage', (ev) => {
            if (ev.key === 'horario_drive_last_save' && ev.newValue && ev.newValue !== ev.oldValue) {
                // Cargar cambios remotos en segundo plano (sin loader)
                loadFromDrive(true).catch(() => { });
            }
        });
    } catch (e) { }

    // Sincronización periódica (entre dispositivos): cada cierto tiempo
    // revisamos si el archivo en Drive fue modificado por otra sesión.
    try {
        if (!window.__driveAutoSyncIntervalId) {
            window.__driveAutoSyncIntervalId = setInterval(async () => {
                if (!gAccessToken || typeof gapi === 'undefined' || !gapi.client) return;
                try {
                    const existing = await findAppDataFile('horario_data.json', false);
                    if (!existing || !existing.modifiedTime) return;

                    // Primera vez que vemos el archivo en esta sesión: cargarlo para
                    // asegurarnos de que este dispositivo tome como fuente la versión de Drive.
                    if (!driveLastRemoteModifiedTime) {
                        await loadFromDrive(true);
                        driveLastRemoteModifiedTime = existing.modifiedTime;
                        return;
                    }

                    if (existing.modifiedTime > driveLastRemoteModifiedTime) {
                        // Hay una versión más reciente en Drive: cargarla en segundo plano
                        await loadFromDrive(true);
                        driveLastRemoteModifiedTime = existing.modifiedTime;
                    }
                } catch (e) {
                    // Silencioso: si hay error de red o auth, se maneja cuando el usuario interactúe.
                }
            }, 20000); // 20 segundos
        }
    } catch (e) { }
});

// Helper de diagnóstico: prueba la API Drive y muestra respuesta/errores
function testDriveAPI() {
    if (typeof gapi === 'undefined' || !gapi.client) {
        console.error('gapi no está cargado o gapi.client no existe');
        return;
    }
    try { gapi.client.setToken({ access_token: gAccessToken }); } catch (e) { }
    gapi.client.request({ path: '/drive/v3/about', params: { fields: 'user' }, method: 'GET' })
        .then(resp => console.log('Drive API OK:', resp.result))
        .catch(err => {
            console.error('Drive API ERROR:', err);
            // mostrar mensaje breve en UI también
            showMessage('Error al iniciar Drive API: mira la consola para detalles', 'error');
        });
}
window.testDriveAPI = testDriveAPI;

async function signOutGoogle(options = {}) {
    const { skipLoader = false, loaderMessage = 'Cerrando sesión...' } = options;
    unlockInterface();
    driveAuthRetryPending = false;
    gmailApiReady = false;
    gmailApiInitPromise = null;
    localStorage.removeItem(DRIVE_SCOPE_FLAG);
    localStorage.removeItem(GMAIL_SCOPE_FLAG);
    if (!skipLoader) {
        showLoader(loaderMessage);
    }
    try {
        await persistScheduleBeforeSignOut();
        clearLocalScheduleAndCatalogOnSignOut();

        try {
            localStorage.removeItem('google_signed_in');
            localStorage.removeItem('google_profile');
            localStorage.removeItem('google_token');
            localStorage.removeItem('google_token_expiry');
            localStorage.removeItem(DRIVE_SCOPE_FLAG);
            localStorage.removeItem(GMAIL_SCOPE_FLAG);
        } catch (e) {
            console.warn('No se pudo limpiar persistencia local completa', e);
        }

        if (!gAccessToken) {
            gAccessToken = null;
            gUserProfile = null;
            window.__googleProfile = null;
            try { if (window.gapi && gapi.client) gapi.client.setToken(null); } catch (e) { }
            onProfileLoaded();
            try {
                const profileModal = document.getElementById('profileModal');
                if (profileModal) {
                    profileModal.classList.add('hidden');
                    profileModal.setAttribute('aria-hidden', 'true');
                }
                const profileCircle = document.getElementById('googleProfileCircle');
                if (profileCircle) profileCircle.focus();
            } catch (e) { }
            lockInterface('Para volver a usar la aplicación debes iniciar sesión con Google.');
            showMessage('Sesión cerrada', 'success');
            return;
        }

        try {
            const resp = await fetch(`https://oauth2.googleapis.com/revoke?token=${gAccessToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            if (!resp.ok) console.warn('Revoca token responded:', resp.status);
        } catch (err) {
            console.error('Error revocando token:', err);
        } finally {
            gAccessToken = null;
            gUserProfile = null;
            window.__googleProfile = null;
            try { if (window.gapi && gapi.client) gapi.client.setToken(null); } catch (e) { }
            onProfileLoaded();
            try {
                const profileModal = document.getElementById('profileModal');
                if (profileModal) {
                    profileModal.classList.add('hidden');
                    profileModal.setAttribute('aria-hidden', 'true');
                }
                const profileCircle = document.getElementById('googleProfileCircle');
                if (profileCircle) profileCircle.focus();
            } catch (e) { }
            lockInterface('Para volver a usar la aplicación debes iniciar sesión con Google.');
            showMessage('Sesión cerrada', 'success');
        }
    } finally {
        if (!skipLoader) {
            hideLoader();
        }
    }
}

let signOutInProgress = false;
async function signOutWithLoader(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    if (signOutInProgress) return;
    signOutInProgress = true;
    const MIN_SIGNOUT_LOADER_MS = 1500;
    const signOutLoaderStart = Date.now();
    try {
        console.log('signOutWithLoader: iniciando cierre de sesión');
    } catch (e) { }
    showLoader('Cerrando sesión...');
    try {
        // Avisar al backend para que cierre la sesión de la app (cookie HttpOnly)
        try {
            var logoutUrl = apiUrl('/api/session/logout');
            if (logoutUrl) {
                fetch(logoutUrl, {
                    method: 'POST',
                    credentials: 'include'
                }).catch(function (e) {
                    console.warn('No se pudo cerrar sesión en backend', e);
                });
            }
        } catch (e) {
            console.warn('Error llamando a /api/session/logout', e);
        }
        // Registrar un evento de cierre de sesión en el backend, si conocemos el correo actual
        try {
            var email = null;
            var name = null;
            if (window.__googleProfile && typeof window.__googleProfile === 'object') {
                email = window.__googleProfile.email || null;
                name = window.__googleProfile.name || null;
            }
            if (!email && typeof getCurrentUserEmail === 'function') {
                try { email = getCurrentUserEmail() || null; } catch (e) { email = null; }
            }
            if (email) {
                trackEventOnBackend('logout', { name: name, email: email });
            }
        } catch (e) {
            console.warn('No se pudo registrar evento de logout', e);
        }
        await signOutGoogle({ skipLoader: true, loaderMessage: 'Cerrando sesión...' });
    } finally {
        try {
            const elapsed = Date.now() - signOutLoaderStart;
            if (elapsed < MIN_SIGNOUT_LOADER_MS) {
                await new Promise((resolve) => setTimeout(resolve, MIN_SIGNOUT_LOADER_MS - elapsed));
            }
        } catch (e) { }
        hideLoader();
        signOutInProgress = false;
    }
}

// Función para mostrar información de la sesión actual
function getSessionInfo() {
    try {
        const sessionStart = Number(localStorage.getItem('google_session_start') || '0');
        // Calculamos expiración a partir del timestamp de inicio + 120 días
        if (sessionStart) {
            const startDate = new Date(sessionStart);
            const fourMonthsInMs = 120 * 24 * 60 * 60 * 1000;
            const expiryTs = sessionStart + fourMonthsInMs;
            const expiryDate = new Date(expiryTs);
            const daysLeft = Math.ceil((expiryTs - Date.now()) / (24 * 60 * 60 * 1000));

            console.log(`Sesión iniciada: ${startDate.toLocaleString()}`);
            console.log(`Expira: ${expiryDate.toLocaleString()}`);
            console.log(`Días restantes: ${daysLeft}`);

            return { sessionStart: startDate, expiry: expiryDate, daysLeft };
        }
    } catch (e) {
        console.warn('Error obteniendo info de sesión', e);
    }
    return null;
}

// Exponer función para debug/información
window.getSessionInfo = getSessionInfo;

// Flag global para evitar lanzar varias veces la carga automática desde backend
if (typeof window !== 'undefined' && typeof window.__scheduleRestoredFromBackend === 'undefined') {
    window.__scheduleRestoredFromBackend = false;
}

// Intenta restaurar la sesión de la app desde el backend usando cookie HttpOnly
async function restoreBackendSessionProfile() {
    try {
        var url = apiUrl('/api/session/me');
        if (!url) return null;
        var resp = await fetch(url, { method: 'GET', credentials: 'include' });
        if (!resp.ok) return null;
        var data = await resp.json();
        if (!data || !data.ok || !data.authenticated || !data.email) return null;

        // Si el email de la sesión del backend es distinto al que teníamos
        // guardado en localStorage, asumimos que el usuario cambió de cuenta
        // (o inicia sesión en este navegador por primera vez). En ese caso,
        // limpiamos el horario y la configuración local asociados a la cuenta
        // anterior para evitar mezclar datos entre cuentas.
        try {
            const rawPrev = localStorage.getItem('google_profile');
            if (rawPrev) {
                try {
                    const prevProfile = JSON.parse(rawPrev);
                    const prevEmail = prevProfile && prevProfile.email;
                    if (prevEmail && prevEmail !== data.email) {
                        clearLocalScheduleAndCatalogOnSignOut();
                    }
                } catch (e) {
                    // si el JSON está corrupto, lo ignoramos y seguimos
                }
            }
        } catch (e) {
            console.warn('No se pudo comparar email previo al restaurar sesión', e);
        }

        // Construir/actualizar un perfil mínimo con nombre, correo y avatar
        var profile = window.__googleProfile && typeof window.__googleProfile === 'object'
            ? Object.assign({}, window.__googleProfile)
            : {};
        profile.email = data.email;
        if (data.name) profile.name = data.name;
        if (data.avatar_url) profile.picture = data.avatar_url;

        gUserProfile = profile;
        window.__googleProfile = profile;

        try {
            localStorage.setItem('google_profile', JSON.stringify(profile));
            localStorage.setItem('google_signed_in', '1');
            if (!localStorage.getItem('google_session_start')) {
                localStorage.setItem('google_session_start', String(Date.now()));
            }
        } catch (e) {
            console.warn('No se pudo persistir sesión restaurada desde backend', e);
        }

        try { onProfileLoaded(); } catch (e) { }

        // Después de restaurar la sesión de la app, intentar cargar automáticamente
        // el último horario conocido usando solo el backend (DB + Drive).
        // Aquí mostramos un loader global mientras se reconstruye el horario,
        // pero mantenemos `isAuto = true` para que loadFromDrive no saque
        // mensajes extra ni prompts interactivos.
        try {
            if (typeof loadFromDrive === 'function' && !window.__scheduleRestoredFromBackend) {
                window.__scheduleRestoredFromBackend = true;
                try { showLoader('Cargando tu horario...'); } catch (e) { }
                try {
                    await loadFromDrive(true, { backendOnly: true });
                } finally {
                    try { hideLoader(); } catch (e) { }
                }
            }
        } catch (e) {
            console.warn('Auto-carga de horario desde backend fallo en restoreBackendSessionProfile', e);
        }
        return profile;
    } catch (e) {
        console.warn('restoreBackendSessionProfile fallo', e);
        return null;
    }
}

// Banner discreto para reconectar Drive sin molestar constantemente
function showDriveReconnectBanner() {
    try {
        const banner = document.getElementById('driveReconnectBanner');
        if (!banner) return;
        banner.classList.remove('hidden');
        banner.style.display = 'flex';
    } catch (e) { }
}

function hideDriveReconnectBanner() {
    try {
        const banner = document.getElementById('driveReconnectBanner');
        if (!banner) return;
        banner.classList.add('hidden');
        banner.style.display = 'none';
    } catch (e) { }
}

// Función para configurar tooltips en las celdas del horario
function setupScheduleCellTooltips() {
    const preview = document.getElementById('floatingPreview');
    if (!preview) return;

    function formatMinutes(total) {
        const hh = Math.floor(total / 60) % 24;
        const mm = total % 60;
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }

    // Ocultar preview al entrar en la tabla (salvo si el target es una tarjeta .subject-card)
    const scheduleTable = document.querySelector('.schedule-table');
    if (scheduleTable) {
        // cuando el mouse entra en la tabla y no está sobre una tarjeta, ocultar preview
        scheduleTable.addEventListener('mouseenter', (ev) => {
            if (!ev.target.closest || !ev.target.closest('.subject-card')) {
                preview.classList.add('hidden');
            }
        });
        // opcional: ocultar también al mover dentro de la tabla fuera de tarjetas
        scheduleTable.addEventListener('mousemove', (ev) => {
            if (!ev.target.closest('.subject-card')) preview.classList.add('hidden');
        });
    }

    // attach to every schedule cell except the time column
    const cells = document.querySelectorAll('.schedule-table td:not(.time-slot)');
    cells.forEach(td => {
        // avoid adding multiple listeners
        if (td._tooltipBound) return;
        td._tooltipBound = true;

        td.addEventListener('mouseenter', function (e) {
            // Resaltar toda la fila (todos los td del tr)
            const tr = this.closest('tr');
            if (tr) {
                // aplicar color directo para asegurar que se vea aunque no haya CSS
                Array.from(tr.querySelectorAll('td')).forEach(tdCell => {
                    tdCell.dataset._prevBg = tdCell.style.backgroundColor || '';
                    tdCell.style.backgroundColor = 'rgba(37, 152, 228, 0.41)'; // color ligero
                });
                tr.classList.add('highlight-row');
            }

            const id = this.id || '';
            if (!id.includes('-')) return;
            const [day, timeKey] = id.split('-');
            if (!timeKey) return;
            const hourStart = timeKey.length === 4 ? `${timeKey.slice(0, 2)}:${timeKey.slice(2)}` : timeKey.replace(/^(\d{2})(\d{2})$/, '$1:$2');
            const slotStartMin = parseTime(hourStart);
            const slotEndMin = slotStartMin + 45;

            // buscar sesiones que se solapan con este slot
            const overlapping = [];
            selectedSubjects.forEach(sub => {
                (sub.sessions || []).forEach(sess => {
                    if (sess.day !== day) return;
                    const s = parseTime(sess.startTime);
                    const t = parseTime(sess.endTime);
                    if (s < slotEndMin && t > slotStartMin) {
                        // obtener aula: preferir la del objeto, si no existe buscar en catalogSubjects por id
                        const aula = sub.aula ?? (catalogSubjects.find(cs => cs.id === sub.id) || {}).aula ?? '-';
                        overlapping.push({
                            text: `${sub.name} — ${sess.startTime}-${sess.endTime} — Aula: ${aula}`,
                            subject: sub
                        });
                    }
                });
            });

            if (overlapping.length === 0) {
                preview.innerHTML = `<strong>${capitalizeFirstLetter(day)} ${hourStart}-${formatMinutes(slotEndMin)}</strong><br>Libre`;
            } else {
                const lines = overlapping.map(o => o.text).join('<br>');
                preview.innerHTML = `<strong>${capitalizeFirstLetter(day)} ${hourStart}-${formatMinutes(slotEndMin)}</strong><br>${lines}`;
            }

            preview.classList.remove('hidden');
        });

        td.addEventListener('mouseleave', function () {
            // quitar resaltado de la fila
            const tr = this.closest('tr');
            if (tr) {
                Array.from(tr.querySelectorAll('td')).forEach(tdCell => {
                    tdCell.style.backgroundColor = tdCell.dataset._prevBg || '';
                    delete tdCell.dataset._prevBg;
                });
                tr.classList.remove('highlight-row');
            }
            preview.classList.add('hidden');
        });
    });
}

/**
 * Maneja errores de autorización/Drive.
 * - Limpia token expirado en localStorage.
 * - Actualiza UI y solicita re-login interactivo.
 * No lanza error para que los catch previos sigan su flujo.
 */
function handleAuthError(err) {
    console.warn('handleAuthError (Drive):', err);

    // Determinar código de estado si está disponible
    const status = err && (err.status || (err.result && err.result.error && err.result.error.code));

    // Si parece un problema de autorización/expirado => limpiar y solicitar login
    const unauthorizedMsg = err && /invalid_token|unauthorized|access_denied/i.test(String(err));
    if ((status === 401) || (status === 403 && !isQuotaExceededError(err)) || unauthorizedMsg) {
        const willAutoRetry = !driveAuthRetryPending;
        try {
            localStorage.removeItem('google_token');
            localStorage.removeItem('google_token_expiry');
            // marcar como no conectado
            localStorage.removeItem('google_signed_in');
            localStorage.removeItem(DRIVE_SCOPE_FLAG);
            localStorage.removeItem(GMAIL_SCOPE_FLAG);
        } catch (e) { /* ignore */ }

        gAccessToken = null;
        gUserProfile = null;
        window.__googleProfile = null;
        try { if (window.gapi && gapi.client) gapi.client.setToken(null); } catch (e) { }

        // No derribar la sesión visual de la app; solo marcar problema con Drive
        try { showDriveReconnectBanner(); } catch (e) { }

        // Mostrar mensaje que se requiere re-autenticación y solicitar login interactivo
        try {
            if (!driveAuthRetryPending) {
                const msgText = willAutoRetry
                    ? 'Para guardar en Google Drive, primero autoriza el acceso en la ventana de Google.'
                    : 'Para seguir guardando en Google Drive, haz clic en "Iniciar sesión" y acepta los permisos.';
                showMessage(msgText, 'info');
            }
        } catch (e) { }

        authRequestInProgress = false;
        if (willAutoRetry) {
            driveAuthRetryPending = true;
            // Ya no forzamos automáticamente la ventana de Google; dejamos que
            // el usuario haga clic en "Conectar Google Drive" cuando lo desee.
        } else {
            console.log('handleAuthError: reautenticación ya solicitada anteriormente.');
        }
    } else {
        // Mensaje genérico para otros errores
        try { showMessage('Error al guardar tu horario iniciar sesión.', 'error'); } catch (e) { }
    }
}

// Helper: reconstruir catalogSubjects usando predefined + custom (evita duplicados y permite borrar)
function rebuildCatalogFromPredefinedAndCustoms() {
    try {
        const customs = loadCustomSubjects() || [];
        // evitar mutar predefinedSubjects por accidente
        catalogSubjects = JSON.parse(JSON.stringify(predefinedSubjects));
        // añadir customs (si hay ids duplicados, los customs sobrescriben)
        const existing = new Map(catalogSubjects.map(s => [s.id, s]));
        customs.forEach(c => existing.set(c.id, c));
        catalogSubjects = Array.from(existing.values());
    } catch (e) {
        console.warn('rebuildCatalogFromPredefinedAndCustoms error', e);
    }
}

async function persistScheduleBeforeSignOut() {
    if (!gAccessToken || typeof gapi === 'undefined' || !gapi.client) {
        return;
    }
    try {
        await saveToDrive({ suppressAuthError: true, interactive: false });
    } catch (err) {
        console.warn('No se pudo guardar el horario antes de cerrar sesión', err);
    }
}

function clearLocalScheduleAndCatalogOnSignOut() {
    selectedSubjects = [];
    try {
        // Eliminar la copia local del horario en vez de guardar un arreglo vacío.
        localStorage.removeItem('selectedSubjects');
    } catch (e) { console.warn('No se pudo eliminar selectedSubjects del localStorage', e); }

    try {
        localStorage.removeItem(CUSTOM_KEY);
        localStorage.removeItem(CAREER_STORAGE_KEY);
        localStorage.removeItem(CAREER_LEGACY_KEY);
        localStorage.removeItem(CUSTOM_CAREERS_KEY);
        // También eliminar snapshot de reinscripción para no persistir datos del formulario
        try { localStorage.removeItem(REINSCRIPTION_FORM_STORAGE_KEY); } catch (e) { }
    } catch (e) {
        console.warn('No se pudo limpiar materias personalizadas', e);
    }

    customCareerOptions = [];
    syncCareerOptions(false);

    selectedSlots = new Set();
    rebuildCatalogFromPredefinedAndCustoms();
    updateCatalogSubjects();
    buildSlotsTable();
    updateScheduleView();
    updateSelectedSubjectsList();
    defaultSchedulePromptShown = false;
    defaultSchedulePromptDismissed = false;
    closeDefaultSchedulePrompt();

    const fallbackCareer = getCareerById('biomedica') || CAREER_OPTIONS[0];
    if (fallbackCareer) {
        applyCareerSelection(fallbackCareer, { persistLocal: false });
    }
}

// Crear modal de confirmación personalizado

// Control del banner de mantenimiento: si el usuario está logueado, mostrar 60s/ocultar 30s en ciclo.
(function () {
    const KEY = 'google_signed_in';
    let banner = null; // se asignará en DOMContentLoaded o al mostrar/ocultar

    let showTimer = null;
    let hideTimer = null;
    let running = false;

    function clearTimers() {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    }

    function isSignedIn() {
        try {
            if (window.__googleProfile) return true;
            if (typeof gAccessToken !== 'undefined' && gAccessToken) return true;
            return localStorage.getItem(KEY) === '1';
        } catch (e) { return false; }
    }

    function showBanner(duration = 60000) {
        if (!banner) banner = document.getElementById('maintenanceBanner');
        if (!banner) return;
        banner.classList.remove('hidden');
        banner.style.display = '';
        clearTimers();
        showTimer = setTimeout(() => {
            hideBanner();
        }, duration);
    }

    function hideBanner(duration = 30000) {
        if (!banner) banner = document.getElementById('maintenanceBanner');
        if (!banner) return;
        banner.classList.add('hidden');
        banner.style.display = 'none';
        clearTimers();
        hideTimer = setTimeout(() => {
            // solo continuar el ciclo si el usuario sigue logueado
            if (isSignedIn()) {
                showBanner();
            } else {
                // si ya no está logueado, dejar banner visible permanentemente
                if (!banner) banner = document.getElementById('maintenanceBanner');
                if (banner) { banner.classList.remove('hidden'); banner.style.display = ''; }
            }
        }, duration);
    }

    function startCycle() {
        if (running) return;
        running = true;
        // comenzar mostrando 1 minuto
        showBanner(60000);
    }

    function stopCycle() {
        running = false;
        clearTimers();
        // dejar visible el banner si no está logueado
        if (!banner) banner = document.getElementById('maintenanceBanner');
        if (banner) { banner.classList.remove('hidden'); banner.style.display = ''; }
    }

    // Inicialización
    document.addEventListener('DOMContentLoaded', () => {
        // Enlazar el botón de cerrar (si existe)
        const closeBtn = document.getElementById('maintenanceCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                // ocultar ahora y programar re-aparición en 30s
                clearTimers();
                banner.classList.add('hidden');
                banner.style.display = 'none';
                showTimer = setTimeout(() => { showBanner(); }, 30000);
            });
        }

        if (isSignedIn()) {
            startCycle();
        } else {
            // usuario no logueado: dejar banner siempre visible
            stopCycle();
        }
    });

    // Escuchar cambios en localStorage (login/logout) desde otras pestañas
    window.addEventListener('storage', (ev) => {
        if (ev.key !== KEY) return;
        if (ev.newValue === '1') {
            startCycle();
        } else {
            stopCycle();
        }
    });

    // Si la app actualiza la variable global __googleProfile, algunos flujos ya llaman a onProfileLoaded().
    // Escuchar un evento personalizado por si otros puntos del app lo disparan.
    window.addEventListener('profile:loaded', () => {
        if (isSignedIn()) startCycle();
    });
})();



// Animación del gorro: secuencia de imágenes/GIFs, 5s cada una, en bucle
window.addEventListener('DOMContentLoaded', function () {
    var topHat = document.getElementById('profileHat');
    var modalHat = document.querySelector('.profile-modal-hat');

    if (!topHat && !modalHat) return;

    // Lista de imágenes/gifs del gorro.
    // Para agregar más, solo añade nuevas rutas al arreglo.
    var hatImages = [
        'gorrito-navidad.png',
        '2026.gif',
        '2026amarillo.gif',
        'santa-claus.gif',
        'artificial1.gif',
        'year.gif',
        'artificial2.gif',
        // 'otra-imagen.png',
        // 'otro-gif.gif'
    ];

    if (!hatImages.length) return;

    var currentIndex = 0;
    var displayTime = 5000; // 5 segundos por imagen/gif

    function applyImage() {
        var src = hatImages[currentIndex];
        if (topHat) topHat.src = src;
        if (modalHat) modalHat.src = src;
    }

    function nextImage() {
        currentIndex = (currentIndex + 1) % hatImages.length;
        applyImage();
    }

    // Mostrar la primera imagen al cargar
    applyImage();

    // Cambiar de imagen cada 5 segundos
    setInterval(nextImage, displayTime);
});

// --- Código de invitación en el modal de perfil ---
document.addEventListener('DOMContentLoaded', function () {
    var toggleBtn = document.getElementById('pmInviteCodeToggle');
    var input = document.getElementById('pmInviteCodeInput');
    var submitBtn = document.getElementById('pmInviteCodeSubmit');
    var message = document.getElementById('pmInviteCodeMessage');

    // Modal centrado para el código y el modal de perfil
    var inviteModal = document.getElementById('inviteCodeModal');
    var inviteModalClose = document.getElementById('inviteCodeModalClose');
    var profileModal = document.getElementById('profileModal');

    if (!toggleBtn || !input || !submitBtn || !message || !inviteModal) {
        return;
    }

    // Al tocar "Código de invitación" se cierra el perfil y se abre el modal centrado
    toggleBtn.addEventListener('click', function () {
        if (profileModal) {
            profileModal.classList.add('hidden');
            profileModal.setAttribute('aria-hidden', 'true');
        }

        inviteModal.classList.remove('hidden');
        inviteModal.setAttribute('aria-hidden', 'false');
        message.classList.remove('error', 'success');
        message.textContent = '';
        if (input) {
            input.focus();
        }
    });

    // Cerrar el modal de código
    function closeInviteModal() {
        inviteModal.classList.add('hidden');
        inviteModal.setAttribute('aria-hidden', 'true');
    }

    if (inviteModalClose) {
        inviteModalClose.addEventListener('click', closeInviteModal);
    }

    inviteModal.addEventListener('click', function (e) {
        if (e.target === inviteModal) {
            closeInviteModal();
        }
    });

    // Mostrar mensaje dentro del propio modal
    function showInviteMessage(text, isError) {
        message.textContent = text;
        message.classList.remove('hidden');
        message.classList.toggle('error', !!isError);
        message.classList.toggle('success', !isError);
    }

    function handleInviteCode() {
        var code = (input.value || '').trim();
        if (!code) {
            showInviteMessage('Ingresa un código de invitación.', true);
            return;
        }

        
        if (code.toLowerCase() === 'xunito') {
            showInviteMessage('Código válido, espere un momento...', false);
            setTimeout(function () {
                window.location.href = 'https://horarioxunu-d8a240277988.herokuapp.com/xunito/index.html';
            }, 900);
        } else {
            showInviteMessage('Código no válido. Verifica tu invitación.', true);
        }
    }

    submitBtn.addEventListener('click', handleInviteCode);

    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleInviteCode();
        }
    });
});

       (function () {
            var link = document.getElementById('whatsappSupportLink');
            if (!link) return;
            var base = 'https://wa.me/5219601151824?text=';
            
            var msg = window.location.href + '\nHola, tengo un problema con mi horario en la página Horarios Bio';
            link.href = base + encodeURIComponent(msg);
        })();
document.addEventListener('DOMContentLoaded', function () {
    var shareBtn = document.getElementById('shareScheduleBtn');
    if (!shareBtn) return;

    var shareUrl = 'https://xunnito.github.io/horario/';
    var shareText = 'Te invito a usar Horarios Bio para crear y organizar tu horario académico.';
    var shareTitle = 'Horarios Bio';

    shareBtn.addEventListener('click', function () {
        // 1) Intentar Web Share API (muestra menú nativo: WhatsApp, Telegram, correo, etc.)
        // Enviamos TODO en "text" para controlar el orden: primero URL, luego mensaje en otra línea
        if (navigator.share) {
            navigator.share({
                title: shareTitle,
                text: shareUrl + '\n' + shareText
            }).catch(function () {
                // Si el usuario cancela, no hacemos nada
            });
            return;
        }

    // 2) Respaldo: intentar abrir WhatsApp con el mensaje
    // Primero el enlace y luego en otra línea el mensaje
    var waMessage = encodeURIComponent(shareUrl + '\n' + shareText);
        var waUrl = 'https://wa.me/?text=' + waMessage;

        // Intentar abrir en nueva pestaña
        var win = window.open(waUrl, '_blank');
        if (win && typeof win.focus === 'function') {
            win.focus();
            return;
        }

        // 3) Último respaldo: copiar enlace al portapapeles
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl)
                .then(function () {
                    alert('Enlace copiado. Pégalo en cualquier chat para compartir.');
                })
                .catch(function () {
                    alert('Comparte esta liga con tus amigos: ' + shareUrl);
                });
        } else {
            alert('Comparte esta liga con tus amigos: ' + shareUrl);
        }
    });
});



document.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('shareBanner');
    var shareBtn = document.getElementById('shareScheduleBtn');
    if (!banner) return;
    function positionShareBanner() {
        if (!banner || !shareBtn) return;
        var center = shareBtn.offsetLeft + (shareBtn.offsetWidth / 2);
        var estimatedHalfWidth = 80;
        var left = center - estimatedHalfWidth;
        if (left < 0) left = 0;
        banner.style.left = left + 'px';
    }

    positionShareBanner();
    banner.classList.remove('hidden');

    var hideTimeout = setTimeout(function () {
        banner.classList.add('hidden');
    }, 5000);

    if (shareBtn) {
        shareBtn.addEventListener('mouseenter', function () {
            positionShareBanner();
            banner.classList.remove('hidden');
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        });

        shareBtn.addEventListener('mouseleave', function () {
            banner.classList.add('hidden');
        });

        shareBtn.addEventListener('focus', function () {
            positionShareBanner();
            banner.classList.remove('hidden');
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        });

        shareBtn.addEventListener('blur', function () {
            banner.classList.add('hidden');
        });
    }
});

// Registrar una vista de página genérica al cargar (solo para métricas del panel)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
        try {
            trackEventOnBackend('page_view', {});
        } catch (e) {
            console.warn('No se pudo registrar page_view inicial', e);
        }
    });
}

// ================== INTEGRACIÓN PLANES (GRATIS / 49 MXN) ==================

// URL base del backend. Si el frontend está en otro dominio, define
// window.BACKEND_BASE_URL en index.html (por ejemplo, "https://tu-backend.com").

var BACKEND_BASE_URL = (typeof window !== 'undefined' && window.BACKEND_BASE_URL)
    ? String(window.BACKEND_BASE_URL).replace(/\/$/, '')
    : '';

function apiUrl(path) {
    if (!path) return '';
    if (BACKEND_BASE_URL) {
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        return BACKEND_BASE_URL + (path.startsWith('/') ? path : '/' + path);
    }
    return path;
}

// Enviar eventos de tracking al backend (/track) para historial y login_resumen
function trackEventOnBackend(eventType, payload) {
    try {
        var body = {
            event_type: eventType || 'page_view',
            name: payload && payload.name ? payload.name : null,
            email: payload && payload.email ? payload.email : null,
            path: (payload && payload.path) || (typeof window !== 'undefined' ? window.location.pathname : null)
        };
        var url = apiUrl('/track');
        if (!url) return;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        }).catch(function (e) {
            console.warn('No se pudo enviar evento de tracking', e);
        });
    } catch (e) {
        console.warn('Error interno en trackEventOnBackend', e);
    }
}

var currentPlanState = {
    planId: 'free',
    rawPlan: 'free',
    expiresAtTs: null,
    nowTs: null
};

var currentUsageState = {
    catalog: { used: 0, limit: null, remaining: null },
    print: { used: 0, limit: null, remaining: null },
    download: { used: 0, limit: null, remaining: null }
};

function describePlan(planId) {
    if (!planId || planId === 'free') return 'Gratis';
    // "Plan_xunu" es nuestro plan de 49 MXN basado en usos
    return 'Plan 49 MXN';
}

function renderPlanInProfile() {
    var pmPlan = document.getElementById('pmPlan');
    if (!pmPlan) return;
    var label = describePlan(currentPlanState.planId);
    // El plan de 49 MXN ya no expira por días, solo por límites de uso.
    pmPlan.textContent = label;
}

function updateUsageState(kind, payload) {
    if (!payload) return;
    var map = currentUsageState[kind];
    if (!map) return;
    var used = payload.current_value != null ? Number(payload.current_value) : (payload.current != null ? Number(payload.current) : 0);
    var limit = payload.active_limit != null ? Number(payload.active_limit) : null;
    var remaining = null;

    // Si el backend ya envía "remaining", úsalo directamente para evitar
    // desajustes entre servidor y cliente. Si no viene, lo calculamos.
    if (payload.remaining != null && !isNaN(Number(payload.remaining))) {
        remaining = Number(payload.remaining);
    } else if (limit !== null) {
        remaining = Math.max(limit - used, 0);
    }
    map.used = used;
    map.limit = limit;
    map.remaining = remaining;
}

function renderUsageInPlanModal() {
    var catalogUsedEl = document.getElementById('planUsageCatalogUsed');
    var catalogRemEl = document.getElementById('planUsageCatalogRemaining');
    var printUsedEl = document.getElementById('planUsagePrintUsed');
    var printRemEl = document.getElementById('planUsagePrintRemaining');
    var downloadUsedEl = document.getElementById('planUsageDownloadUsed');
    var downloadRemEl = document.getElementById('planUsageDownloadRemaining');
    var planLabelEl = document.getElementById('planUsageTitleLabel');
    var upgradeBtn = document.getElementById('upgradePlanButton');
    if (planLabelEl) {
        planLabelEl.textContent = describePlan(currentPlanState.planId);
    }
    function fill(kind, usedEl, remEl) {
        var u = currentUsageState[kind];
        if (!usedEl || !remEl) return;
        if (!u) {
            usedEl.textContent = '-';
            remEl.textContent = '-';
            return;
        }
        if (u.limit === null) {
            // No tenemos límite cargado desde el backend. Usamos valores
            // por defecto según el plan y el tipo de uso para que
            // "Restantes" empiece en el paquete completo y vaya bajando.
            usedEl.textContent = u.used != null ? String(u.used) : '0';

            var fallbackLimit = null;
            var isPaidPlan = currentPlanState.planId && currentPlanState.planId !== 'free';

            if (isPaidPlan) {
                // Plan de pago actual (Plan_xunu): 10 usos por tipo.
                fallbackLimit = 10;
            } else {
                // Plan gratis: mismos límites que el backend.
                if (kind === 'catalog') fallbackLimit = 2;
                else if (kind === 'print' || kind === 'download') fallbackLimit = 1;
            }

            if (fallbackLimit != null) {
                var usedVal = u.used != null ? Number(u.used) : 0;
                var remainingFallback = Math.max(fallbackLimit - usedVal, 0);
                remEl.textContent = String(remainingFallback);
            } else {
                remEl.textContent = '-';
            }
            return;
        }
        usedEl.textContent = String(u.used != null ? u.used : 0);
        remEl.textContent = String(u.remaining != null ? u.remaining : Math.max((u.limit || 0) - (u.used || 0), 0));
    }
    fill('catalog', catalogUsedEl, catalogRemEl);
    fill('print', printUsedEl, printRemEl);
    fill('download', downloadUsedEl, downloadRemEl);

    var hasPaid = currentPlanState.planId && currentPlanState.planId !== 'free';
    var anyExhausted = false;
    ['catalog', 'print', 'download'].forEach(function (k) {
        var u = currentUsageState[k];
        if (u && u.limit !== null && u.remaining === 0) {
            anyExhausted = true;
        }
    });
    if (upgradeBtn) {
        if (hasPaid && anyExhausted) upgradeBtn.classList.remove('hidden'); else upgradeBtn.classList.add('hidden');
    }
}

function updatePlanButtonsUI() {
    var plansBtn = document.getElementById('pmOpenPlans');
    var planStatusBtn = document.getElementById('planStatusButton');
    var hasPaid = currentPlanState.planId && currentPlanState.planId !== 'free';
    var allLimitsKnown = hasPaid && currentUsageState.catalog.limit !== null && currentUsageState.print.limit !== null && currentUsageState.download.limit !== null;
    var allExhausted = allLimitsKnown && currentUsageState.catalog.remaining === 0 && currentUsageState.print.remaining === 0 && currentUsageState.download.remaining === 0;

    if (hasPaid && !allExhausted) {
        if (plansBtn) plansBtn.classList.add('hidden');
        if (planStatusBtn) planStatusBtn.classList.remove('hidden');
    } else {
        if (plansBtn) plansBtn.classList.remove('hidden');
        if (planStatusBtn) planStatusBtn.classList.add('hidden');
    }
}

async function fetchPlanStatusFromBackend() {
    try {
        var email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : '';
        if (!email) {
            currentPlanState = { planId: 'free', rawPlan: 'free', expiresAtTs: null, nowTs: null };
            renderPlanInProfile();
            return currentPlanState;
        }
        var url = apiUrl('/api/plan/status?email=' + encodeURIComponent(email));
        var res = await fetch(url, { method: 'GET', credentials: 'include' }).catch(function () { return null; });
        if (!res || !res.ok) {
            console.warn('No se pudo obtener el estado del plan', res && res.status);
            return currentPlanState;
        }
        var data = await res.json();
        currentPlanState = {
            planId: data.plan_id || 'free',
            rawPlan: data.raw_plan || 'free',
            expiresAtTs: data.expires_at_ts != null ? Number(data.expires_at_ts) : null,
            nowTs: data.now_ts != null ? Number(data.now_ts) : null
        };
        renderPlanInProfile();
        updatePlanButtonsUI();
        return currentPlanState;
    } catch (e) {
        console.warn('Error consultando el plan actual', e);
        return currentPlanState;
    }
}

async function ensureFeatureAllowed(kind) {
    // kind: 'catalog', 'print', 'download'
    var email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : '';
    if (!email) {
        if (typeof showMessage === 'function') {
            showMessage('Debes iniciar sesión con Google para usar esta función.', 'warning');
        }
        throw new Error('missing_email');
    }

    var endpoint;
    if (kind === 'catalog') endpoint = '/api/usage/catalog-create';
    else if (kind === 'print') endpoint = '/api/usage/print';
    else if (kind === 'download') endpoint = '/api/usage/download';
    else throw new Error('usage_kind_not_supported');

    var url = apiUrl(endpoint);
    var res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: email })
        });
    } catch (e) {
        console.error('Error conectando con el backend de planes', e);
        if (typeof showMessage === 'function') {
            showMessage('No se pudo verificar tu plan. Intenta nuevamente en unos segundos.', 'error');
        }
        throw e;
    }

    var data = await res.json().catch(function () { return {}; });
    var allowed = !!data.allowed;
    var reason = data.reason || (allowed ? 'ok' : 'blocked');
    var planId = data.plan_id || 'free';

    currentPlanState.planId = planId;
    currentPlanState.rawPlan = data.raw_plan || planId;
    currentPlanState.expiresAtTs = data.expires_at_ts != null ? Number(data.expires_at_ts) : currentPlanState.expiresAtTs;
    currentPlanState.nowTs = data.now_ts != null ? Number(data.now_ts) : currentPlanState.nowTs;
    if (kind === 'catalog' || kind === 'print' || kind === 'download') {
        updateUsageState(kind, data);
        renderUsageInPlanModal();
        updatePlanButtonsUI();
    }
    renderPlanInProfile();

    if (!allowed) {
        openPlansModal(kind, reason);
        throw new Error('feature_not_allowed_' + kind);
    }

    return data;
}

async function fetchUsageStatusFromBackend() {
    try {
        var email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : '';
        if (!email) return currentUsageState;
        var url = apiUrl('/api/usage/status?email=' + encodeURIComponent(email));
        var res = await fetch(url, { method: 'GET', credentials: 'include' }).catch(function () { return null; });
        if (!res || !res.ok) {
            console.warn('No se pudo obtener el estado de usos', res && res.status);
            return currentUsageState;
        }
        var data = await res.json();
        if (data.plan_id) {
            currentPlanState.planId = data.plan_id || 'free';
            currentPlanState.rawPlan = data.raw_plan || currentPlanState.planId;
            currentPlanState.expiresAtTs = data.expires_at_ts != null ? Number(data.expires_at_ts) : currentPlanState.expiresAtTs;
            currentPlanState.nowTs = data.now_ts != null ? Number(data.now_ts) : currentPlanState.nowTs;
        }
        if (data.usage) {
            if (data.usage.catalog) updateUsageState('catalog', data.usage.catalog);
            if (data.usage.print) updateUsageState('print', data.usage.print);
            if (data.usage.download) updateUsageState('download', data.usage.download);
        }
        renderPlanInProfile();
        renderUsageInPlanModal();
        updatePlanButtonsUI();
        return currentUsageState;
    } catch (e) {
        console.warn('Error consultando el uso actual', e);
        return currentUsageState;
    }
}

function openPlansModal(kind, reason) {
    var modal = document.getElementById('plansModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function closePlansModal() {
    var modal = document.getElementById('plansModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

// --- Integración Stripe Elements: pago embebido en modal ---
var __stripeInstance = null;
var __stripeElements = null;
var __stripePaymentElement = null;
var __stripeClientSecret = null;
var __paymentModalInitialized = false;
var __paymentModalEl = null;
var __paymentErrorEl = null;
var __paymentConfirmBtn = null;
var __payerModalEl = null;
var __payerNameInput = null;
var __payerEmailInput = null;
var __payerErrorEl = null;
var __payerContinueBtn = null;
var __payerModalInitialized = false;

function openPayerInfoModal() {
    if (!__payerModalInitialized) {
        __payerModalEl = document.getElementById('payerInfoModal');
        __payerNameInput = document.getElementById('payerNameInput');
        __payerEmailInput = document.getElementById('payerEmailInput');
        __payerErrorEl = document.getElementById('payerInfoError');
        __payerContinueBtn = document.getElementById('payerInfoContinue');
        var closePayerBtn = document.getElementById('payerInfoClose');
        if (closePayerBtn && __payerModalEl) {
            closePayerBtn.addEventListener('click', function () { closePayerInfoModal(); });
        }
        if (__payerModalEl) {
            __payerModalEl.addEventListener('click', function (e) { if (e.target === __payerModalEl) closePayerInfoModal(); });
        }
        if (__payerContinueBtn) {
            __payerContinueBtn.addEventListener('click', async function () {
                if (!__payerContinueBtn || __payerContinueBtn.disabled) return;
                var name = __payerNameInput && __payerNameInput.value ? __payerNameInput.value.trim() : '';
                var email = __payerEmailInput && __payerEmailInput.value ? __payerEmailInput.value.trim() : '';
                if (!email) {
                    if (__payerErrorEl) __payerErrorEl.textContent = 'Escribe el correo de la persona que realizará el pago.';
                    return;
                }
                if (__payerErrorEl) __payerErrorEl.textContent = '';
                var originalText = __payerContinueBtn.textContent;
                __payerContinueBtn.disabled = true;
                __payerContinueBtn.textContent = 'Cargando...';
                try {
                    await startPlanCheckout('Plan_xunu', email, name);
                    closePayerInfoModal();
                } finally {
                    __payerContinueBtn.disabled = false;
                    __payerContinueBtn.textContent = originalText;
                }
            });
        }
        __payerModalInitialized = true;
    }
    if (!__payerModalEl) return;
    if (__payerErrorEl) __payerErrorEl.textContent = '';
    if (__payerNameInput && typeof getCurrentUserFullName === 'function') {
        var n = getCurrentUserFullName();
        if (n && !__payerNameInput.value) __payerNameInput.value = n;
    }
    if (__payerEmailInput && typeof getCurrentUserEmail === 'function') {
        var e = getCurrentUserEmail();
        if (e && !__payerEmailInput.value) __payerEmailInput.value = e;
    }
    __payerModalEl.classList.remove('hidden');
    __payerModalEl.setAttribute('aria-hidden', 'false');
}

function closePayerInfoModal() {
    if (!__payerModalEl) return;
    __payerModalEl.classList.add('hidden');
    __payerModalEl.setAttribute('aria-hidden', 'true');
}

function openPaymentModal() {
    if (!__paymentModalInitialized) {
        __paymentModalEl = document.getElementById('paymentModal');
        __paymentErrorEl = document.getElementById('paymentError');
        __paymentConfirmBtn = document.getElementById('paymentConfirmButton');
        var closeBtn = document.getElementById('paymentModalClose');
        if (closeBtn && __paymentModalEl) {
            closeBtn.addEventListener('click', function () { closePaymentModal(); });
        }
        if (__paymentModalEl) {
            __paymentModalEl.addEventListener('click', function (e) { if (e.target === __paymentModalEl) closePaymentModal(); });
        }
        if (__paymentConfirmBtn) {
            __paymentConfirmBtn.addEventListener('click', handleConfirmPaymentClick);
        }
        __paymentModalInitialized = true;
    }
    if (!__paymentModalEl) return;
    __paymentModalEl.classList.remove('hidden');
    __paymentModalEl.setAttribute('aria-hidden', 'false');
}

function closePaymentModal() {
    if (!__paymentModalEl) return;
    __paymentModalEl.classList.add('hidden');
    __paymentModalEl.setAttribute('aria-hidden', 'true');
}

async function setupStripeElements(clientSecret, publishableKey) {
    if (typeof Stripe === 'undefined') {
        if (typeof showMessage === 'function') {
            showMessage('Stripe no está disponible en esta página.', 'error');
        }
        return false;
    }
    if (!__stripeInstance || !__stripeInstance.__pk || __stripeInstance.__pk !== publishableKey) {
        __stripeInstance = Stripe(publishableKey);
        __stripeInstance.__pk = publishableKey;
    }
    var container = document.getElementById('payment-element');
    if (!container) return false;
    container.innerHTML = '';
    __stripeClientSecret = clientSecret;
    __stripeElements = __stripeInstance.elements({ clientSecret: clientSecret, appearance: { theme: 'stripe' } });
    // Usar Payment Element en modo "tabs" para una experiencia más clara,
    // donde Stripe mostrará primero tarjetas guardadas (si existen) y debajo
    // la opción de agregar una nueva forma de pago.
    __stripePaymentElement = __stripeElements.create('payment', { layout: 'tabs' });
    __stripePaymentElement.mount(container);
    if (__paymentErrorEl) __paymentErrorEl.textContent = '';
    return true;
}

async function handleConfirmPaymentClick() {
    if (!__stripeInstance || !__stripeElements) return;
    if (!__paymentConfirmBtn) return;
    if (__paymentConfirmBtn.disabled) return;
    var originalText = __paymentConfirmBtn.textContent;
    __paymentConfirmBtn.disabled = true;
    __paymentConfirmBtn.textContent = 'Procesando...';
    if (__paymentErrorEl) __paymentErrorEl.textContent = '';
    var result;
    try {
        result = await __stripeInstance.confirmPayment({
            elements: __stripeElements,
            confirmParams: { return_url: window.location.href },
            redirect: 'if_required'
        });
    } catch (e) {
        console.error('Error al confirmar el pago', e);
        if (typeof showMessage === 'function') {
            showMessage('No se pudo procesar el pago.', 'error');
        }
        __paymentConfirmBtn.disabled = false;
        __paymentConfirmBtn.textContent = originalText;
        return;
    }
    __paymentConfirmBtn.disabled = false;
    __paymentConfirmBtn.textContent = originalText;
    if (result && result.error) {
        console.warn('Error de Stripe al pagar', result.error);
        if (__paymentErrorEl) {
            __paymentErrorEl.textContent = result.error.message || 'No se pudo completar el pago.';
        }
        return;
    }
    if (result && result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        if (typeof showMessage === 'function') {
            showMessage('Pago realizado correctamente. Activando tu plan...', 'success', 6000);
        }
        try {
            // Sabemos que este flujo solo vende el plan de 49 MXN (Plan_xunu)
            if (typeof currentPlanState !== 'undefined' && currentPlanState) {
                currentPlanState.planId = 'Plan_xunu';
                currentPlanState.rawPlan = 'Plan_xunu';
                if (typeof renderPlanInProfile === 'function') {
                    renderPlanInProfile();
                }
            }
            // Notificar al backend para activar el plan también en la base de datos
            try {
                var sessionEmail = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : '';
                var sessionName = (typeof getCurrentUserFullName === 'function') ? getCurrentUserFullName() : '';
                if (sessionEmail) {
                    var activateUrl = apiUrl('/api/plan/activate-client');
                    await fetch(activateUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ email: sessionEmail, name: sessionName, plan_id: 'Plan_xunu' })
                    }).catch(function (e) { console.warn('No se pudo activar el plan en backend', e); });
                }
            } catch (e) {
                console.warn('Error activando plan en backend tras pago', e);
            }
            // Intentar guardar el nuevo estado también en Drive, sin molestar al usuario si falla
            if (typeof ensureSaveToDrive === 'function') {
                ensureSaveToDrive({ interactive: false, showSuccess: false, silent: true });
            }
        } catch (e) { }
        closePaymentModal();
        if (typeof fetchPlanStatusFromBackend === 'function') {
            setTimeout(function () { fetchPlanStatusFromBackend(); }, 2500);
        }
        if (typeof fetchUsageStatusFromBackend === 'function') {
            setTimeout(function () { fetchUsageStatusFromBackend(); }, 3000);
        }
    }
}

async function startPlanCheckout(planId, emailOverride, nameOverride) {
    var sessionEmail = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : '';
    if (!sessionEmail) {
        if (typeof showMessage === 'function') {
            showMessage('Debes iniciar sesión con Google antes de comprar un plan.', 'warning');
        }
        try {
            if (typeof requestGoogleSignIn === 'function') {
                requestGoogleSignIn();
            }
        } catch (e) { }
        return;
    }
    var email = emailOverride || sessionEmail;
    var name = nameOverride || ((typeof getCurrentUserFullName === 'function') ? getCurrentUserFullName() : '');

    var url = apiUrl('/api/payment/create-intent');
    var res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ plan_id: planId, email: email, name: name })
        });
    } catch (e) {
        console.error('Error al crear sesión de pago', e);
        if (typeof showMessage === 'function') {
            showMessage('No se pudo iniciar el pago. Revisa tu conexión.', 'error');
        }
        return;
    }

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.clientSecret || !data.publishableKey) {
        var msg = data.error || 'No se pudo iniciar el pago. Inténtalo más tarde.';
        if (typeof showMessage === 'function') {
            showMessage(msg, 'error');
        }
        return;
    }

    var ok = await setupStripeElements(data.clientSecret, data.publishableKey);
    if (!ok) return;
    openPaymentModal();
}

// Sobrescribir printSchedule para aplicar límite de impresión
if (typeof printSchedule === 'function') {
    var __originalPrintSchedule = printSchedule;
    printSchedule = async function () {
        try {
            await ensureFeatureAllowed('print');
        } catch (e) {
            return;
        }
        __originalPrintSchedule();
    };
}

// Envolver onProfileLoaded para refrescar plan al iniciar sesión
if (typeof onProfileLoaded === 'function') {
    var __originalOnProfileLoaded = onProfileLoaded;
    onProfileLoaded = function () {
        try {
            __originalOnProfileLoaded.apply(this, arguments);
        } catch (e) { }
        try {
            fetchPlanStatusFromBackend();
        } catch (e) { }
        try {
            fetchUsageStatusFromBackend();
        } catch (e) { }
    };
}

// Interceptar clicks en descarga, impresión y creación de materias
document.addEventListener('DOMContentLoaded', function () {
        var plansModal = document.getElementById('plansModal');
        var plansClose = document.getElementById('plansModalClose');
        var pmOpenPlans = document.getElementById('pmOpenPlans');
        var pmPlanPill = document.querySelector('.pm-plan-row');
        var planProCheckoutBtn = document.getElementById('planProCheckout');
        var planStatusButton = document.getElementById('planStatusButton');
        var planStatusModal = document.getElementById('planStatusModal');
        var planStatusClose = document.getElementById('planStatusClose');

        if (pmOpenPlans) {
            pmOpenPlans.addEventListener('click', function () {
                var email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : '';
                if (!email) {
                    if (typeof showMessage === 'function') {
                        showMessage('Debes iniciar sesión con Google para ver los planes.', 'warning');
                    }
                    // Mostrar el modal de login (authGate) en lugar del flujo antiguo
                    try {
                        lockInterface('Debes iniciar sesión para ver los planes.');
                    } catch (e) {
                        console.warn('No se pudo mostrar el modal de login desde pmOpenPlans', e);
                    }
                    return;
                }
                openPlansModal();
            });
        }
        if (pmPlanPill) {
            pmPlanPill.addEventListener('click', function () {
                // Cerrar el modal de perfil si está abierto
                var profileModal = document.getElementById('profileModal');
                if (profileModal && !profileModal.classList.contains('hidden')) {
                    profileModal.classList.add('hidden');
                    profileModal.setAttribute('aria-hidden', 'true');
                }
                var email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : '';
                if (!email) {
                    if (typeof showMessage === 'function') {
                        showMessage('Debes iniciar sesión con Google para ver los planes.', 'warning');
                    }
                    // Mostrar el modal de login (authGate) en lugar del flujo antiguo
                    try {
                        lockInterface('Debes iniciar sesión para ver los planes.');
                    } catch (e) {
                        console.warn('No se pudo mostrar el modal de login desde pmPlanPill', e);
                    }
                    return;
                }
                if (currentPlanState && currentPlanState.planId && currentPlanState.planId !== 'free') {
                    renderUsageInPlanModal();
                    if (planStatusModal) {
                        planStatusModal.classList.remove('hidden');
                        planStatusModal.setAttribute('aria-hidden', 'false');
                    }
                } else {
                    openPlansModal();
                }
            });
        }
    if (plansClose && plansModal) {
        plansClose.addEventListener('click', function () { closePlansModal(); });
        plansModal.addEventListener('click', function (e) { if (e.target === plansModal) closePlansModal(); });
    }
    if (planStatusButton && planStatusModal) {
        planStatusButton.addEventListener('click', function () {
            var email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : '';
            if (!email) {
                if (typeof showMessage === 'function') {
                    showMessage('Debes iniciar sesión con Google para ver tu plan.', 'warning');
                }
                // Mostrar el modal de login (authGate) en lugar del flujo antiguo
                try {
                    lockInterface('Debes iniciar sesión para ver tu plan.');
                } catch (e) {
                    console.warn('No se pudo mostrar el modal de login desde planStatusButton', e);
                }
                return;
            }

            renderUsageInPlanModal();
            planStatusModal.classList.remove('hidden');
            planStatusModal.setAttribute('aria-hidden', 'false');
        });
    }
    if (planStatusClose && planStatusModal) {
        planStatusClose.addEventListener('click', function () {
            planStatusModal.classList.add('hidden');
            planStatusModal.setAttribute('aria-hidden', 'true');
        });
        planStatusModal.addEventListener('click', function (e) { if (e.target === planStatusModal) { planStatusModal.classList.add('hidden'); planStatusModal.setAttribute('aria-hidden', 'true'); } });
    }
    if (planProCheckoutBtn) {
        planProCheckoutBtn.addEventListener('click', function () {
            openPayerInfoModal();
        });
    }

    // Reinscription download (botón "Descargar formato")
    var downloadBtn = document.getElementById('reinscriptionDownload');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async function (ev) {
            ev = ev || window.event;
            try {
                await ensureFeatureAllowed('download');
            } catch (e) {
                if (ev.preventDefault) ev.preventDefault();
                if (ev.stopPropagation) ev.stopPropagation();
                return false;
            }
            return true;
        });
    }

    // Botón de enviar al tutor (también descarga un PDF)
    var sendBtn = document.getElementById('reinscriptionSendEmail');
    if (sendBtn) {
        sendBtn.addEventListener('click', async function (ev) {
            ev = ev || window.event;
            try {
                await ensureFeatureAllowed('download');
            } catch (e) {
                if (ev.preventDefault) ev.preventDefault();
                if (ev.stopPropagation) ev.stopPropagation();
                return false;
            }
            return true;
        });
    }

    // Interceptar creación de materias de catálogo (solo nuevas)
    var saveBtn = document.getElementById('s_save');
    if (saveBtn) {
        saveBtn.addEventListener('click', async function (ev) {
            try {
                if (typeof editingSubjectId === 'undefined' || editingSubjectId === null) {
                    await ensureFeatureAllowed('catalog');
                }
            } catch (e) {
                if (ev && ev.preventDefault) ev.preventDefault();
                if (ev && ev.stopPropagation) ev.stopPropagation();
                return false;
            }
            return true;
        });
    }
});

// ================== MODO GRATUITO: desactivar planes y pagos ==================
// Este bloque sobrescribe las funciones relacionadas con planes/Stripe para que
// todo funcione como versión gratuita sin límites ni pagos.

(function setupFreeMode() {
    try {
        if (typeof currentPlanState === 'undefined' || !currentPlanState) {
            window.currentPlanState = {
                planId: 'free',
                rawPlan: 'free',
                expiresAtTs: null,
                nowTs: null
            };
        } else {
            currentPlanState.planId = 'free';
            currentPlanState.rawPlan = 'free';
            currentPlanState.expiresAtTs = null;
            currentPlanState.nowTs = null;
        }
    } catch (e) { }
})();

function describePlan(planId) {
    return 'Gratis';
}

function renderPlanInProfile() {
    var pmPlan = document.getElementById('pmPlan');
    if (!pmPlan) return;
    pmPlan.textContent = 'Gratis';
}

async function ensureFeatureAllowed(kind) {
    // Antes se consultaba al backend para validar límites.
    // Ahora siempre se permite la acción sin hacer peticiones.
    return { allowed: true, plan_id: 'free' };
}

async function fetchPlanStatusFromBackend() {
    try {
        if (typeof currentPlanState !== 'undefined' && currentPlanState) {
            currentPlanState.planId = 'free';
            currentPlanState.rawPlan = 'free';
        }
        renderPlanInProfile();
    } catch (e) { }
    return (typeof currentPlanState !== 'undefined')
        ? currentPlanState
        : { planId: 'free', rawPlan: 'free' };
}

async function fetchUsageStatusFromBackend() {
    // Sin límites ni métricas de uso en modo gratuito.
    return {};
}

function updatePlanButtonsUI() {
    var plansBtn = document.getElementById('pmOpenPlans');
    var planStatusBtn = document.getElementById('planStatusButton');
    if (plansBtn) plansBtn.classList.add('hidden');
    if (planStatusBtn) planStatusBtn.classList.add('hidden');
}

function renderUsageInPlanModal() {
    var catalogUsedEl = document.getElementById('planUsageCatalogUsed');
    var catalogRemEl = document.getElementById('planUsageCatalogRemaining');
    var printUsedEl = document.getElementById('planUsagePrintUsed');
    var printRemEl = document.getElementById('planUsagePrintRemaining');
    var downloadUsedEl = document.getElementById('planUsageDownloadUsed');
    var downloadRemEl = document.getElementById('planUsageDownloadRemaining');
    var planLabelEl = document.getElementById('planUsageTitleLabel');

    if (planLabelEl) planLabelEl.textContent = 'Plan: Gratis';

    [catalogUsedEl, printUsedEl, downloadUsedEl].forEach(function (el) {
        if (el) el.textContent = '0';
    });
    [catalogRemEl, printRemEl, downloadRemEl].forEach(function (el) {
        if (el) el.textContent = '∞';
    });
}

function openPlansModal() {
    if (typeof showMessage === 'function') {
        showMessage('Esta versión es completamente gratis; no necesitas ningún plan.', 'info', 6000);
    }
    var modal = document.getElementById('plansModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function closePlansModal() {
    var modal = document.getElementById('plansModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

function openPaymentModal() {
    if (typeof showMessage === 'function') {
        showMessage('Los pagos están desactivados: todo es gratis.', 'info', 6000);
    }
}

function closePaymentModal() {
    var modal = document.getElementById('paymentModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

async function setupStripeElements() {
    // Stripe ya no se usa en modo gratuito.
    return false;
}

async function handleConfirmPaymentClick() {
    if (typeof showMessage === 'function') {
        showMessage('Los pagos están desactivados: no es necesario pagar.', 'info', 6000);
    }
}

function openPayerInfoModal() {
    if (typeof showMessage === 'function') {
        showMessage('La app funciona en modo gratis; no se solicitará pago.', 'info', 6000);
    }
    var modal = document.getElementById('payerInfoModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function closePayerInfoModal() {
    var modal = document.getElementById('payerInfoModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

async function startPlanCheckout(planId, emailOverride, nameOverride) {
    if (typeof showMessage === 'function') {
        showMessage('No se requiere pago: tu plan es gratis.', 'info', 6000);
    }
}


(function () {
  const estiloTitulo = "color:red;font-size:40px;font-weight:bold;";
  const estiloTexto = "font-size:16px;color:black;";

  console.log("%c¡Detente!", estiloTitulo);
  console.log(
    "Si alguien te dijo que pegaras algo aquí para hackear o robar cualquier información,\n" +
    "es un fraude. Si lo haces, XuNnito podrá robar tu información.\n" +
    "Mampo,\n",
    estiloTexto
  );
})();



