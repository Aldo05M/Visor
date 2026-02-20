// Visor de Usuario - Panorámicas ORB
// Variables globales del visor 3D
let renderer, scene, camera, controls, sphereMesh, textureLoader;
let autoRotateEnabled = false;
let currentBrightness = 1.0;
let vrMode = false;
let leftCamera, rightCamera; // Cámaras para modo VR

// Sistema de navegación de lugares y escenarios
// Estructura: { "ALAMEDA": { '': [...], 'Dept': [...] }, "TEC": {...} }
let lugares = {};
let lugaresOrden = [];
let lugarActual = '';
let currentLocationIndex = 0;
let escenarioActual = 0;
let escenariosDelLugar = [];
let autoTourEnabled = false;
let autoTourTimer = null;
let autoTourInterval = 5000; // ms por escena en tour automático

// Elementos DOM
const statusEl = document.getElementById('status');
const coordinates = document.getElementById('coordinates');
const sceneTitle = document.getElementById('sceneTitle');
const sceneCounter = document.getElementById('sceneCounter');
const lugarSelect = document.getElementById('lugarSelect');
const departamentoSelect = document.getElementById('departamentoSelect');
const escenarioSelect = document.getElementById('escenarioSelect');
const imageResolution = document.getElementById('imageResolution');
const imageDate = document.getElementById('imageDate');

// Controles
const btnPrevScene = document.getElementById('btnPrevScene');
const btnNextScene = document.getElementById('btnNextScene');
const btnAutoRotate = document.getElementById('btnAutoRotate');
const btnVRMode = document.getElementById('btnVRMode');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnReset = document.getElementById('btnReset');
const btnPrevLocation = document.getElementById('btnPrevLocation');
const btnNextLocation = document.getElementById('btnNextLocation');
const brightness = document.getElementById('brightness');
const brightnessValue = document.getElementById('brightnessValue');

function updateStatus(msg) {
    console.log('🌐', msg);
    if (statusEl) statusEl.textContent = msg;
}

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando Visor de Usuario ORB...');
    
    // Inicializar visor 3D
    initViewer();
    
    // Cargar estructura de lugares
    loadLugares();
    
    // Configurar eventos
    setupEventListeners();
    
    updateStatus('✅ Visor listo - Selecciona un lugar');
});

function setupEventListeners() {
    // Selector de lugares
    if (lugarSelect) {
        lugarSelect.addEventListener('change', onLugarChange);
    }
    // Selector de departamentos
    if (departamentoSelect) {
        departamentoSelect.addEventListener('change', onDepartamentoChange);
    }
    
    // Selector de escenarios
    if (escenarioSelect) {
        escenarioSelect.addEventListener('change', onEscenarioChange);
    }
    
    // Navegación
    if (btnPrevScene) btnPrevScene.addEventListener('click', prevEscenario);
    if (btnNextScene) btnNextScene.addEventListener('click', nextEscenario);
    // Navegación entre ubicaciones
    if (btnPrevLocation) btnPrevLocation.addEventListener('click', prevLocation);
    if (btnNextLocation) btnNextLocation.addEventListener('click', nextLocation);
    
    // Controles del visor
    if (btnAutoRotate) btnAutoRotate.addEventListener('click', toggleAutoRotate);
    if (btnVRMode) btnVRMode.addEventListener('click', toggleVRMode);
    if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);
    if (btnReset) btnReset.addEventListener('click', resetView);
    
    // Control de brillo
    if (brightness) {
        brightness.addEventListener('input', function() {
            currentBrightness = this.value / 100;
            if (brightnessValue) brightnessValue.textContent = this.value + '%';
            updateBrightness();
        });
    }
    
    // Teclado
    document.addEventListener('keydown', handleKeyboard);
    
    // Redimensionamiento
    window.addEventListener('resize', onWindowResize);
}

// ========== CARGA DE LUGARES Y ESCENARIOS ==========

async function loadLugares() {
    console.log('📂 Escaneando lugares disponibles...');
    updateStatus('📂 Cargando lugares...');
    // Intentar cargar un índice estático si está disponible (más fiable en hosts)
    try {
        const indexed = await loadIndexJson();
        if (indexed) {
            populateLugarSelect();
            updateStatus(`✅ ${Object.keys(lugares).length} lugares cargados (desde index.json)`);
            return;
        }
    } catch (err) {
        console.warn('⚠️ No se pudo cargar index.json:', err);
    }
    // Configurable: define aquí los lugares y sus departamentos (vacío = solo raíz)
    // Ejemplo: { 'TEC': ['DeptA','DeptB'], 'ALAMEDA': [] }
    const lugaresConfiguracion = {
        'ALAMEDA': [],
        'TEC': []
    };

    for (const lugar of Object.keys(lugaresConfiguracion)) {
        lugares[lugar] = {};
        const departamentos = lugaresConfiguracion[lugar];

        // Siempre escanear la carpeta raíz del lugar (departamento vacío)
        try {
            const raiz = await scanEscenariosInPath(lugar, '');
            if (raiz.length > 0) lugares[lugar][''] = raiz;
        } catch (err) { console.warn(err); }

        // Escanear carpetas de departamentos configuradas
        for (const dept of departamentos) {
            try {
                const list = await scanEscenariosInPath(lugar, dept);
                if (list.length > 0) lugares[lugar][dept] = list;
            } catch (err) { console.warn(err); }
        }

        // Si no se encontraron imágenes ni en raíz ni en departamentos, eliminar el lugar
        const hasAny = Object.keys(lugares[lugar]).length > 0;
        if (!hasAny) delete lugares[lugar];
        else console.log(`✅ ${lugar}: ${Object.keys(lugares[lugar]).reduce((sum,k)=>sum+lugares[lugar][k].length,0)} escenarios en ${Object.keys(lugares[lugar]).length} departamentos`);
    }
    
    populateLugarSelect();
    
    if (Object.keys(lugares).length === 0) {
        updateStatus('⚠️ No se encontraron lugares con escenarios');
    } else {
        updateStatus(`✅ ${Object.keys(lugares).length} lugares cargados`);
    }
}

// Escanea una ruta específica: '' = carpeta raiz de lugar, o nombre de subcarpeta (departamento)
async function scanEscenariosInPath(lugar, departamento) {
    const basePath = departamento ? `img/${lugar}/${departamento}` : `img/${lugar}`;
    const escenarios = [];
    const encontrados = new Set();

    const MAX_ESCENARIOS = 8; // Limitar búsquedas para mejorar rendimiento en despliegues
    const extensions = ['jpg', 'jpeg', 'png', 'webp'];
    const suffixes = ['', ' - copia', ' copia', ' (1)', '_copy', '-copy'];

    for (let i = 1; i <= MAX_ESCENARIOS; i++) {
        for (const suf of suffixes) {
            for (const ext of extensions) {
                const filename = `escenario${i}${suf}.${ext}`;
                const path = `${basePath}/${filename}`;
                // Resolver URL relativa respecto a la ubicación actual del HTML
                const pathUrl = new URL(path, window.location.href).href;
                try {
                    console.debug(`🔎 Probando: ${pathUrl}`);
                    const exists = await checkImageExists(pathUrl);
                    if (exists) {
                        const key = departamento ? `${departamento}/${filename}` : filename;
                        if (!encontrados.has(key)) {
                            encontrados.add(key);
                            escenarios.push(key);
                            console.debug(`✅ Encontrado: ${key}`);
                        }
                    } else {
                        console.debug(`⛔ No carga: ${pathUrl}`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Error probando ${path}:`, err);
                }
            }
        }
    }

    return escenarios;
}

// Intentar cargar un índice JSON pre-generado: img/index.json
// Formato esperado: { "LUGAR": { "": ["escenario1.jpg","escenario2.jpg"], "Departamento": [ ... ] }, ... }
async function loadIndexJson() {
    const url = new URL('img/index.json', window.location.href).href;
    try {
        const resp = await fetch(url, { cache: 'no-cache' });
        if (!resp.ok) {
            console.debug('index.json no encontrado en', url);
            return false;
        }
        const data = await resp.json();
        // Validar estructura mínima
        if (typeof data !== 'object' || Array.isArray(data)) return false;
        lugares = data;
        console.log('✅ index.json cargado, lugares:', Object.keys(lugares));
        return true;
    } catch (err) {
        console.warn('⚠️ Error cargando index.json:', err);
        return false;
    }
}

// Convenience wrapper kept for backward compatibility (scanea raiz)
async function scanEscenarios(lugar) {
    return scanEscenariosInPath(lugar, '');
}

function checkImageExists(url) {
    // Mejorada: crossOrigin, timeout ajustable y limpieza de handlers para menos falsos negativos
    return new Promise((resolve) => {
        const img = new Image();
        // No forzar crossOrigin para evitar fallos en hosts sin CORS configurado

        let finished = false;
        const timeoutMs = 2000; // tiempo de espera reducido para evitar cargas largas

        const cleanup = (result) => {
            if (finished) return;
            finished = true;
            try {
                img.onload = null;
                img.onerror = null;
            } catch (e) {}
            resolve(result);
        };

        const timer = setTimeout(() => cleanup(false), timeoutMs);

        img.onload = () => {
            clearTimeout(timer);
            cleanup(true);
        };

        img.onerror = () => {
            clearTimeout(timer);
            cleanup(false);
        };

        // Iniciar carga
        try {
            img.src = url;
        } catch (e) {
            clearTimeout(timer);
            cleanup(false);
        }
    });
}

/**
 * Comprueba si una imagen es (aproximadamente) una panorámica equirectangular 360°
 * Heurística: la razón ancho/alto suele ser ~2:1. Se usa una tolerancia configurable.
 * Devuelve true si la imagen existe y su relación de aspecto está cerca de 2.
 */
function isPanorama360(url, tolerance = 0.2) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            if (!img.width || !img.height) return resolve(false);
            const ratio = img.width / img.height;
            const min = 2 - tolerance;
            const max = 2 + tolerance;
            resolve(ratio >= min && ratio <= max);
        };
        img.onerror = () => resolve(false);
        img.src = url;

        // Timeout defensivo más relajado (cargas lentas)
        const timeoutId = setTimeout(() => {
            resolve(false);
        }, 4000);
        // Si carga correctamente, limpiar timeout
        img.onload = () => {
            clearTimeout(timeoutId);
            if (!img.width || !img.height) return resolve(false);
            const ratio = img.width / img.height;
            const min = 2 - tolerance;
            const max = 2 + tolerance;
            resolve(ratio >= min && ratio <= max);
        };
    });
}

function populateLugarSelect() {
    if (!lugarSelect) return;
    
    lugarSelect.innerHTML = '<option value="">-- Seleccionar lugar --</option>';
    // Mantener orden y lista para navegación entre ubicaciones
    lugaresOrden = Object.keys(lugares);
    lugaresOrden.forEach(lugar => {
        const total = Object.keys(lugares[lugar]).reduce((sum, d) => sum + (lugares[lugar][d] ? lugares[lugar][d].length : 0), 0);
        const option = document.createElement('option');
        option.value = lugar;
        option.textContent = `📍 ${lugar} (${total} escenarios)`;
        lugarSelect.appendChild(option);
    });

    // Activar/desactivar botones de navegación de ubicaciones
    if (btnPrevLocation && btnNextLocation) {
        const enable = lugaresOrden.length > 1;
        btnPrevLocation.disabled = !enable;
        btnNextLocation.disabled = !enable;
    }
}

function onLugarChange() {
    const lugarSeleccionado = lugarSelect.value;
    
    if (!lugarSeleccionado) {
        escenarioSelect.disabled = true;
        escenarioSelect.innerHTML = '<option value="">-- Seleccionar lugar primero --</option>';
        btnPrevScene.disabled = true;
        btnNextScene.disabled = true;
        updateSceneInfo('Selecciona un lugar', '0 de 0');
        return;
    }
    
    lugarActual = lugarSeleccionado;
    // Inicializar departamento al valor vacío (raíz) si existe, sino al primero disponible
    escenarioActual = 0;
    populateDepartamentoSelect(lugarActual);
    console.log(`📍 Lugar seleccionado: ${lugarActual} (${escenariosDelLugar.length} escenarios)`);
    // Actualizar índice de ubicación
    currentLocationIndex = lugaresOrden.indexOf(lugarActual);
}

function populateDepartamentoSelect(lugar) {
    if (!departamentoSelect) return;
    departamentoSelect.innerHTML = '';
    departamentoSelect.disabled = false;

    // Opción para ver la raíz (carpeta principal)
    const rootOption = document.createElement('option');
    rootOption.value = '';
    rootOption.textContent = '📁 Raíz';
    departamentoSelect.appendChild(rootOption);

    const departamentos = Object.keys(lugares[lugar] || {}).filter(d => d !== '');
    departamentos.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = `🏷️ ${d}`;
        departamentoSelect.appendChild(option);
    });

    // Seleccionar raíz por defecto si tiene imágenes, si no seleccionar primer departamento
    if (lugares[lugar][''] && lugares[lugar][''].length > 0) {
        departamentoSelect.value = '';
        onDepartamentoChange();
    } else if (departamentos.length > 0) {
        departamentoSelect.value = departamentos[0];
        onDepartamentoChange();
    } else {
        // No hay imágenes -- deshabilitar
        departamentoSelect.disabled = true;
        escenarioSelect.disabled = true;
        btnPrevScene.disabled = true;
        btnNextScene.disabled = true;
        updateSceneInfo('No hay escenarios', '0 de 0');
    }
}

function onDepartamentoChange() {
    const dept = departamentoSelect.value;
    if (!lugarActual) return;
    escenariosDelLugar = lugares[lugarActual][dept] || [];
    escenarioActual = 0;
    populateEscenarioSelect();

    if (escenariosDelLugar.length > 0) {
        loadEscenario(0);
        btnPrevScene.disabled = false;
        btnNextScene.disabled = false;
    } else {
        btnPrevScene.disabled = true;
        btnNextScene.disabled = true;
        updateSceneInfo('Sin escenarios en este departamento', '0 de 0');
    }
}

// Navegación entre ubicaciones
function loadLocationByIndex(index) {
    if (index < 0 || index >= lugaresOrden.length) return;
    const lugar = lugaresOrden[index];
    if (!lugar) return;
    // seleccionar en el select para disparar la lógica existente
    lugarSelect.value = lugar;
    onLugarChange();
}

function prevLocation() {
    if (lugaresOrden.length === 0) return;
    currentLocationIndex = (currentLocationIndex - 1 + lugaresOrden.length) % lugaresOrden.length;
    loadLocationByIndex(currentLocationIndex);
}

function nextLocation() {
    if (lugaresOrden.length === 0) return;
    currentLocationIndex = (currentLocationIndex + 1) % lugaresOrden.length;
    loadLocationByIndex(currentLocationIndex);
}

// Tour automático que recorre todas las ubicaciones y sus imágenes en secuencia
function toggleAutoTour() {
    autoTourEnabled = !autoTourEnabled;
    if (btnPlayTour) btnPlayTour.textContent = autoTourEnabled ? '⏸️ Pausar tour' : '▶️ Iniciar tour';
    if (autoTourEnabled) startAutoTour(); else stopAutoTour();
}

function startAutoTour() {
    if (autoTourTimer) clearInterval(autoTourTimer);
    autoTourTimer = setInterval(nextAutoStep, autoTourInterval);
    console.log('🎛️ Tour automático iniciado');
}

function stopAutoTour() {
    if (autoTourTimer) clearInterval(autoTourTimer);
    autoTourTimer = null;
    console.log('⏹️ Tour automático detenido');
}

function nextAutoStep() {
    // avanzar al siguiente escenario en la ubicación actual, o cambiar de ubicación si es necesario
    if (!lugaresOrden || lugaresOrden.length === 0) return;
    // asegúrate de tener un lugar seleccionado
    if (!lugarActual) {
        currentLocationIndex = 0;
        loadLocationByIndex(currentLocationIndex);
        return;
    }

    // Si no hay escenarios en la ubicación actual, saltar a la siguiente ubicación
    if (!escenariosDelLugar || escenariosDelLugar.length === 0) {
        currentLocationIndex = (currentLocationIndex + 1) % lugaresOrden.length;
        loadLocationByIndex(currentLocationIndex);
        return;
    }

    // Avanzar dentro de la ubicación
    const nextIndex = (escenarioActual + 1) % escenariosDelLugar.length;
    // Si hemos vuelto al inicio de esta ubicación, pasar a la siguiente ubicación
    if (nextIndex === 0) {
        currentLocationIndex = (currentLocationIndex + 1) % lugaresOrden.length;
        loadLocationByIndex(currentLocationIndex);
    }
    loadEscenario(nextIndex);
}

// Crear botones flotantes sobre la vista 3D para avanzar/retroceder escenario
function createViewerOverlayControls(viewerEl) {
    try {
        const overlay = document.getElementById('viewerOverlay') || document.createElement('div');
        overlay.id = 'viewerOverlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '20';

        // botón siguiente (derecha)
        const btnNext = document.createElement('button');
        btnNext.textContent = '›';
        btnNext.title = 'Siguiente escenario';
        Object.assign(btnNext.style, {
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            borderRadius: '24px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '28px',
            cursor: 'pointer',
            pointerEvents: 'auto'
        });
        btnNext.addEventListener('click', (e) => { e.stopPropagation(); nextEscenario(); });

        // botón anterior (izquierda)
        const btnPrev = document.createElement('button');
        btnPrev.textContent = '‹';
        btnPrev.title = 'Escenario anterior';
        Object.assign(btnPrev.style, {
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            borderRadius: '24px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '28px',
            cursor: 'pointer',
            pointerEvents: 'auto'
        });
        btnPrev.addEventListener('click', (e) => { e.stopPropagation(); prevEscenario(); });

        // añadir botones al overlay
        overlay.appendChild(btnPrev);
        overlay.appendChild(btnNext);

        // insertar overlay dentro del contenedor viewer (si no está ya en DOM)
        if (!document.getElementById('viewerOverlay')) {
            viewerEl.style.position = 'relative';
            viewerEl.appendChild(overlay);
        }
    } catch (err) {
        console.warn('⚠️ No se pudieron crear controles overlay:', err);
    }
}

function populateEscenarioSelect() {
    if (!escenarioSelect) return;
    
    escenarioSelect.innerHTML = '';
    escenarioSelect.disabled = false;
    
    escenariosDelLugar.forEach((escenario, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `🎬 ${escenario}`;
        escenarioSelect.appendChild(option);
    });
    
    escenarioSelect.value = escenarioActual;
}

function onEscenarioChange() {
    const index = parseInt(escenarioSelect.value);
    if (!isNaN(index)) {
        loadEscenario(index);
    }
}

// ========== NAVEGACIÓN DE ESCENARIOS ==========

function loadEscenario(index) {
    if (index < 0 || index >= escenariosDelLugar.length) return;
    
    escenarioActual = index;
    const nombreEscenario = escenariosDelLugar[index];
    const rutaCompleta = `img/${lugarActual}/${nombreEscenario}`;
    
    console.log(`🎬 Cargando: ${rutaCompleta}`);
    updateStatus(`🔄 Cargando ${nombreEscenario}...`);
    
    loadPanoramaInViewer(rutaCompleta);
    updateSceneInfo(nombreEscenario, `${index + 1} de ${escenariosDelLugar.length}`);
    
    if (escenarioSelect) escenarioSelect.value = index;
}

function prevEscenario() {
    if (escenariosDelLugar.length === 0) return;
    
    const newIndex = (escenarioActual - 1 + escenariosDelLugar.length) % escenariosDelLugar.length;
    loadEscenario(newIndex);
}

function nextEscenario() {
    if (escenariosDelLugar.length === 0) return;
    
    const newIndex = (escenarioActual + 1) % escenariosDelLugar.length;
    loadEscenario(newIndex);
}

function updateSceneInfo(titulo, contador) {
    if (sceneTitle) sceneTitle.textContent = titulo;
    if (sceneCounter) sceneCounter.textContent = contador;
}

// ========== MANEJO DE TECLADO ==========

function handleKeyboard(event) {
    switch(event.key) {
        case 'ArrowLeft':
            prevEscenario();
            break;
        case 'ArrowRight':
            nextEscenario();
            break;
        case 'f':
        case 'F':
            toggleFullscreen();
            break;
        case 'r':
        case 'R':
            resetView();
            break;
        case ' ':
            event.preventDefault();
            toggleAutoRotate();
            break;
    }
}

// ========== VISOR 3D ==========

function initViewer() {
    console.log('🚀 Inicializando visor 3D...');
    const viewer = document.getElementById('viewer');
    
    if (typeof THREE === 'undefined') {
        console.error('❌ Three.js no está disponible');
        updateStatus('❌ Error: Three.js no cargado');
        return;
    }
    
    try {
        // Crear escena
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        
        // Crear cámara (FOV reducido para "acercar" la vista y evitar ver los polos estirados)
        const DEFAULT_FOV = 50; // más cercano, simula zoom
        camera = new THREE.PerspectiveCamera(
            DEFAULT_FOV,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.updateProjectionMatrix();
        camera.position.set(0, 0, 0.1);
        
        // Cámaras para VR (usar mismo FOV que la cámara principal)
        leftCamera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / 2 / window.innerHeight, 0.1, 1000);
        rightCamera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / 2 / window.innerHeight, 0.1, 1000);
        
        // Crear renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        viewer.appendChild(renderer.domElement);
        // Crear controles overlay en el visor (botones flotantes)
        createViewerOverlayControls(viewer);
        
        // Crear esfera para la panorámica
        // Aumentar segmentos para suavizar la proyección y evitar artefactos en polos
        const geometry = new THREE.SphereGeometry(500, 80, 60);
        geometry.scale(-1, 1, 1); // Invertir para ver desde dentro
        
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        
        sphereMesh = new THREE.Mesh(geometry, material);
        scene.add(sphereMesh);
        
        // Controles de órbita
        if (THREE.OrbitControls) {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.rotateSpeed = -0.3;
            controls.enableZoom = true;
            controls.enablePan = false;
            controls.minDistance = 1;
            controls.maxDistance = 100;
            controls.autoRotate = false;
            controls.autoRotateSpeed = 0.5;
            // Permitir mirar casi hasta los polos pero evitar singularidades exactas
            controls.minPolarAngle = 0.01;
            controls.maxPolarAngle = Math.PI - 0.01;
        }
        
        // Texture loader
        textureLoader = new THREE.TextureLoader();
        
        // Iniciar animación
        animate();
        
        console.log('✅ Visor 3D inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar visor:', error);
        updateStatus('❌ Error al inicializar visor 3D');
    }
}

function loadPanoramaInViewer(imageUrl) {
    console.log('🌐 Cargando panorámica:', imageUrl);
    
    if (!textureLoader || !sphereMesh) {
        console.error('❌ Visor no inicializado');
        return;
    }
    
    textureLoader.load(
        imageUrl,
        // onLoad
        function(texture) {
            console.log('✅ Textura cargada correctamente');
            
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.format = THREE.RGBFormat;
            
            sphereMesh.material.map = texture;
            sphereMesh.material.needsUpdate = true;
            
            // Actualizar información
            updateStatus(`✅ ${lugarActual} - Escenario ${escenarioActual + 1}`);
            
            if (imageResolution) {
                imageResolution.textContent = `🖼️ ${texture.image.width} x ${texture.image.height}px`;
            }
            
            if (imageDate) {
                imageDate.textContent = `📍 ${lugarActual}`;
            }
            
            updateBrightness();
        },
        // onProgress
        function(progress) {
            if (progress.lengthComputable) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                updateStatus(`🔄 Cargando... ${percent}%`);
            }
        },
        // onError
        function(error) {
            console.error('❌ Error al cargar textura:', error);
            updateStatus('❌ Error al cargar panorámica');
        }
    );
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) {
        if (autoRotateEnabled) {
            controls.autoRotate = true;
        } else {
            controls.autoRotate = false;
        }
        controls.update();
    }
    
    updateCoordinates();
    
    if (vrMode) {
        renderStereo();
    } else {
        renderer.render(scene, camera);
    }
}

function renderStereo() {
    // Modo VR estereoscópico
    leftCamera.position.copy(camera.position);
    rightCamera.position.copy(camera.position);
    leftCamera.rotation.copy(camera.rotation);
    rightCamera.rotation.copy(camera.rotation);
    
    const eyeSeparation = 0.064; // 64mm
    leftCamera.translateX(-eyeSeparation / 2);
    rightCamera.translateX(eyeSeparation / 2);
    
    renderer.clear();
    
    // Ojo izquierdo
    renderer.setViewport(0, 0, window.innerWidth / 2, window.innerHeight);
    renderer.render(scene, leftCamera);
    
    // Ojo derecho
    renderer.setViewport(window.innerWidth / 2, 0, window.innerWidth / 2, window.innerHeight);
    renderer.render(scene, rightCamera);
    
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
}

function updateCoordinates() {
    if (!camera || !coordinates) return;
    
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yaw = Math.round(THREE.MathUtils.radToDeg(euler.y));
    const pitch = Math.round(THREE.MathUtils.radToDeg(euler.x));
    coordinates.textContent = `Yaw: ${yaw}° Pitch: ${pitch}°`;
}

// ========== CONTROLES DEL VISOR ==========

function toggleAutoRotate() {
    autoRotateEnabled = !autoRotateEnabled;
    
    if (btnAutoRotate) {
        btnAutoRotate.textContent = autoRotateEnabled ? '⏸️ Pausar' : '🎬 Auto-rotar';
        btnAutoRotate.style.background = autoRotateEnabled ? 
            'rgba(45,212,191,0.4)' : 'rgba(255,255,255,0.1)';
    }
    
    console.log('🎬 Auto-rotación:', autoRotateEnabled ? 'Activada' : 'Desactivada');
}

function toggleVRMode() {
    vrMode = !vrMode;
    
    if (btnVRMode) {
        btnVRMode.textContent = vrMode ? '📱 Normal' : '🥽 Modo VR';
        btnVRMode.style.background = vrMode ? 
            'rgba(45,212,191,0.4)' : 'rgba(255,255,255,0.1)';
    }
    
    onWindowResize();
    console.log('🥽 Modo VR:', vrMode ? 'Activado' : 'Desactivado');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        updateStatus('⛶ Modo pantalla completa activado');
    } else {
        document.exitFullscreen();
        updateStatus('⛶ Modo normal');
    }
}

function resetView() {
    if (controls && camera) {
        camera.position.set(0, 0, 0.1);
        controls.target.set(0, 0, 0);
        controls.update();
        updateStatus('🎯 Vista centrada');
    }
}

function updateBrightness() {
    if (sphereMesh && sphereMesh.material) {
        const color = new THREE.Color(currentBrightness, currentBrightness, currentBrightness);
        sphereMesh.material.color = color;
    }
}

function onWindowResize() {
    if (!camera || !renderer) return;
    
    if (vrMode) {
        leftCamera.aspect = (window.innerWidth / 2) / window.innerHeight;
        rightCamera.aspect = (window.innerWidth / 2) / window.innerHeight;
        leftCamera.updateProjectionMatrix();
        rightCamera.updateProjectionMatrix();
    } else {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }
    
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ========== NAV PANEL TOGGLE ==========
// Collapse/expand the left navigation panel. Use localStorage to remember state.
document.addEventListener('DOMContentLoaded', function() {
    try {
        const nav = document.querySelector('.navigation-panel');
        const btnToggle = document.getElementById('btnToggleNav');
        const btnOpen = document.getElementById('btnOpenNav');

        if (!nav) return;

        function setCollapsed(state, save = true) {
            if (state) {
                nav.classList.add('collapsed');
                if (btnOpen) btnOpen.hidden = false;
            } else {
                nav.classList.remove('collapsed');
                if (btnOpen) btnOpen.hidden = true;
            }
            if (save) localStorage.setItem('visor_nav_collapsed', state ? '1' : '0');
        }

        // initialize from storage
        const stored = localStorage.getItem('visor_nav_collapsed');
        if (stored === '1') setCollapsed(true, false);

        if (btnToggle) btnToggle.addEventListener('click', function() {
            const isCollapsed = nav.classList.contains('collapsed');
            setCollapsed(!isCollapsed);
        });

        if (btnOpen) btnOpen.addEventListener('click', function() {
            setCollapsed(false);
        });

    } catch (e) {
        console.warn('Nav toggle init error', e);
    }
});

// Verificar librerías al cargar
window.addEventListener('load', function() {
    console.log('🔍 Verificando librerías...');
    console.log('✅ Three.js:', typeof THREE !== 'undefined');
    console.log('✅ OrbitControls:', typeof THREE !== 'undefined' && !!THREE.OrbitControls);
    
    if (typeof THREE === 'undefined') {
        updateStatus('❌ Error: Three.js no disponible');
    }
});
