// Visor Panorámico JavaScript - ORB
// Variables globales
let uploadedImages = { img1: null, img2: null };
let renderer, scene, camera, controls, sphereMesh, sphere, textureLoader;
let autoRotateEnabled = false;
let currentBrightness = 1.0;
let vrMode = false;
let leftCamera, rightCamera; // Cámaras para vista estereoscópica
let generatedImageCounter = 1; // Contador para nomenclatura automática
let lastGeneratedCanvas = null; // Guardar el último canvas generado para descarga

// Sistema de hipervínculos
let hyperlinks = []; // Array de hipervínculos
let isCreatingHyperlink = false;
let hyperlinkMarkers = []; // Marcadores visuales 3D
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// Elementos DOM
const slot1 = document.getElementById('slot1');
const slot2 = document.getElementById('slot2');
const file1 = document.getElementById('file1');
const file2 = document.getElementById('file2');
const btnProcess = document.getElementById('btnProcess');
const statusEl = document.getElementById('status');
const coordinates = document.getElementById('coordinates');
const btnAutoRotate = document.getElementById('btnAutoRotate');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnReset = document.getElementById('btnReset');
const btnRewind = document.getElementById('btnRewind');
const btnFastForward = document.getElementById('btnFastForward');
const btnVRMode = document.getElementById('btnVRMode');
const btnCreateLink = document.getElementById('btnCreateLink');

// Panel de hipervínculos
const hyperlinkPanel = document.getElementById('hyperlinkPanel');
const linkTitle = document.getElementById('linkTitle');
const linkDestination = document.getElementById('linkDestination');
const btnSaveLink = document.getElementById('btnSaveLink');
const btnCancelLink = document.getElementById('btnCancelLink');
const linksContainer = document.getElementById('linksContainer');
const brightness = document.getElementById('brightness');
const brightnessValue = document.getElementById('brightnessValue');

// Panel de guardado de imágenes
const btnSaveImage = document.getElementById('btnSaveImage');
const savePanel = document.getElementById('savePanel');
const customFileName = document.getElementById('customFileName');
const btnDownloadCustom = document.getElementById('btnDownloadCustom');
const btnDownloadAuto = document.getElementById('btnDownloadAuto');
const btnCancelSave = document.getElementById('btnCancelSave');

function updateStatus(msg) {
    console.log('📱', msg);
    statusEl.textContent = msg;
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    updateStatus('✅ Sistema listo - Carga tus imágenes');
    
    // Configurar eventos de subida
    slot1.addEventListener('click', () => {
        console.log('🖱️ Click en slot1');
        file1.click();
    });
    slot2.addEventListener('click', () => {
        console.log('🖱️ Click en slot2');
        file2.click();
    });
    
    file1.addEventListener('change', (e) => {
        console.log('📁 File1 changed');
        handleImageUpload(e, 'img1', slot1);
    });
    file2.addEventListener('change', (e) => {
        console.log('📁 File2 changed');
        handleImageUpload(e, 'img2', slot2);
    });
    
    btnProcess.addEventListener('click', () => {
        console.log('🔄 Procesando panorámica...');
        createPanorama();
    });
    
    // Controles del visor estilo cinta
    btnAutoRotate.addEventListener('click', toggleAutoRotate);
    btnFullscreen.addEventListener('click', toggleFullscreen);
    btnReset.addEventListener('click', resetView);
    btnRewind.addEventListener('click', rewindFilm);
    btnFastForward.addEventListener('click', fastForwardFilm);
    btnVRMode.addEventListener('click', toggleVRMode);
    btnCreateLink.addEventListener('click', startCreatingHyperlink);
    
    // Eventos del panel de hipervínculos
    btnSaveLink.addEventListener('click', saveHyperlink);
    btnCancelLink.addEventListener('click', cancelHyperlink);
    
    // Eventos del panel de guardado de imágenes
    if (btnSaveImage) btnSaveImage.addEventListener('click', showSavePanel);
    if (btnDownloadCustom) btnDownloadCustom.addEventListener('click', downloadWithCustomName);
    if (btnDownloadAuto) btnDownloadAuto.addEventListener('click', downloadWithAutoName);
    if (btnCancelSave) btnCancelSave.addEventListener('click', hideSavePanel);
    
    // Control de brillo
    brightness.addEventListener('input', function() {
        const value = this.value;
        brightnessValue.textContent = value + '%';
        currentBrightness = value / 100;
        updateBrightness();
    });
    
    // Inicializar visor 3D
    initViewer();
    
    console.log('🚀 Sistema completamente inicializado');
});

// Manejo de subida de imágenes
function handleImageUpload(event, imageKey, slotElement) {
    const file = event.target.files[0];
    if (!file) return;

    console.log(`📁 Procesando ${imageKey}:`, file.name, `${Math.round(file.size/1024)}KB`);

    if (!file.type.startsWith('image/')) {
        alert('❌ Selecciona un archivo de imagen válido (JPG, PNG, WEBP)');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        alert('❌ La imagen es muy grande. Máximo 50MB permitido');
        return;
    }

    updateStatus(`📤 Procesando ${file.name}... (${Math.round(file.size/1024)}KB)`);
    
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = function() {
        console.log(`✅ ${imageKey} cargada:`, this.width, 'x', this.height);
        
        uploadedImages[imageKey] = this;
        
        slotElement.classList.add('loaded');
        slotElement.innerHTML = `
            <div>✅ ${file.name}</div>
            <img src="${url}" class="preview-thumb">
            <div style="font-size: 10px; color: #aaa;">${this.width}×${this.height}px</div>
        `;
        
        checkReadyToProcess();
        
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    img.onerror = function() {
        console.error('❌ Error cargando imagen');
        updateStatus('❌ Error al cargar imagen - Verifica el formato');
        alert('Error al cargar la imagen. Formatos soportados: JPG, PNG, WEBP');
        URL.revokeObjectURL(url);
    };

    img.src = url;
    event.target.value = '';
}

function checkReadyToProcess() {
    const hasImg1 = uploadedImages.img1 !== null;
    const hasImg2 = uploadedImages.img2 !== null;
    
    btnProcess.disabled = !(hasImg1 && hasImg2);
    
    if (hasImg1 && hasImg2) {
        updateStatus('🎯 ¡Perfecto! Listo para crear vista 180°');
        
        console.log('📊 Análisis imágenes:');
        console.log(`  - Img1: ${uploadedImages.img1.width}x${uploadedImages.img1.height}`);
        console.log(`  - Img2: ${uploadedImages.img2.width}x${uploadedImages.img2.height}`);
        
    } else {
        const count = (hasImg1 ? 1 : 0) + (hasImg2 ? 1 : 0);
        updateStatus(`📷 ${count}/2 imágenes cargadas`);
    }
}

// Crear panorámica 360°
function createPanorama() {
    if (!uploadedImages.img1 || !uploadedImages.img2) {
        alert('❌ Necesitas cargar ambas imágenes primero');
        return;
    }

    console.log('🔄 Iniciando creación de panorámica...');
    updateStatus('🔄 Procesando... Esto puede tomar unos segundos');
    
    // Resetear estado de guardado anterior
    resetImageGeneration();
    
    btnProcess.disabled = true;
    btnProcess.textContent = '⏳ Procesando...';

    setTimeout(() => {
        try {
            console.log('📐 Creando canvas para combinación...');
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const img1 = uploadedImages.img1;
            const img2 = uploadedImages.img2;
            
            console.log('📏 Dimensiones originales:');
            console.log('  - Imagen 1:', img1.width, 'x', img1.height);
            console.log('  - Imagen 2:', img2.width, 'x', img2.height);

            // Calcular dimensiones para panorámica 360° (proporción 2:1)
            const maxHeight = Math.max(img1.height, img2.height);
            const targetHeight = Math.min(maxHeight, 2048);
            const targetWidth = targetHeight * 2;
            
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            console.log('🎯 Canvas final:', targetWidth, 'x', targetHeight);

            // Limpiar canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, targetWidth, targetHeight);

            // Configurar filtrado de alta calidad
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            updateStatus('🎨 Combinando imágenes lado a lado...');

            const halfWidth = targetWidth / 2;
            
            // Dibujar primera imagen en la mitad izquierda
            ctx.drawImage(img1, 0, 0, halfWidth, targetHeight);
            console.log('✅ Imagen 1 dibujada en mitad izquierda');

            // Dibujar segunda imagen en la mitad derecha
            ctx.drawImage(img2, halfWidth, 0, halfWidth, targetHeight);
            console.log('✅ Imagen 2 dibujada en mitad derecha');

            updateStatus('🌐 Generando textura panorámica...');

            // Crear imagen combinada
            const combinedImage = new Image();
            combinedImage.onload = function() {
                console.log('🌐 Imagen combinada lista, cargando en visor 3D...');
                console.log('📐 Dimensiones imagen final:', this.width, 'x', this.height);
                
                // GUARDAR CANVAS para descarga posterior
                lastGeneratedCanvas = canvas;
                
                // AGREGAR DEBUG: Mostrar la imagen en consola
                console.log('🖼️ Data URL generada (primeros 100 chars):', combinedImage.src.substring(0, 100));
                
                loadPanoramaInViewer(combinedImage.src);
                
                updateStatus('✅ ¡Vista 180° creada! Arrastra para navegar');
                btnProcess.disabled = false;
                btnProcess.textContent = '🔄 Crear Vista 180°';
                
                // Habilitar botón de guardar imagen
                if (btnSaveImage) {
                    btnSaveImage.disabled = false;
                    btnSaveImage.style.display = 'block';
                }
                
                console.log('🎉 Proceso completado exitosamente - Imagen lista para guardar');
            };
            
            combinedImage.onerror = function() {
                console.error('❌ Error al crear imagen combinada');
                updateStatus('❌ Error al generar imagen final');
                btnProcess.disabled = false;
                btnProcess.textContent = '🔄 Crear Vista 180°';
            };
            
            combinedImage.src = canvas.toDataURL('image/jpeg', 0.95);

        } catch (error) {
            console.error('❌ Error en createPanorama:', error);
            updateStatus('❌ Error al crear panorámica - Inténtalo de nuevo');
            alert('Error al procesar las imágenes:\\n' + error.message);
            btnProcess.disabled = false;
            btnProcess.textContent = '🔄 Crear Vista 180°';
        }
    }, 100);
}

// Inicializar visor 3D
function initViewer() {
    console.log('🚀 Inicializando visor 3D...');
    const viewer = document.getElementById('viewer');
    
    if (typeof THREE === 'undefined') {
        console.error('❌ Three.js no está cargado');
        updateStatus('❌ Error: Three.js no disponible');
        return false;
    }
    
    try {
        // Limpiar visor anterior si existe
        if (renderer) {
            viewer.removeChild(renderer.domElement);
            renderer.dispose();
        }
        
        // Configurar renderer
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        viewer.appendChild(renderer.domElement);

        // Configurar escena
        scene = new THREE.Scene();
        
        // Configurar cámaras para vista estereoscópica (VR) - FOV ultra amplio para máxima inmersión
        camera = new THREE.PerspectiveCamera(110, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 0, 0.1); // Muy cerca del centro para vista panorámica
        camera.lookAt(1, 0, 0); // Orientación inicial correcta hacia el frente horizontalmente
        
        // Cámaras para modo VR (ojo izquierdo y derecho)
        leftCamera = new THREE.PerspectiveCamera(110, window.innerWidth / 2 / window.innerHeight, 0.1, 2000);
        rightCamera = new THREE.PerspectiveCamera(110, window.innerWidth / 2 / window.innerHeight, 0.1, 2000);
        
        // Separación entre ojos (distancia interpupilar típica: 6.4cm)
        const eyeSeparation = 0.01; // Separación muy pequeña para estar en el centro
        leftCamera.position.set(-eyeSeparation / 2, 0, 0.1); // Muy cerca del centro
        rightCamera.position.set(eyeSeparation / 2, 0, 0.1); // Muy cerca del centro

        // Controles panorámicos - CONFIGURACIÓN CORREGIDA
        if (!THREE.OrbitControls) {
            console.error('❌ OrbitControls no disponible');
            throw new Error('OrbitControls no se cargó correctamente');
        }
        
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        
        // Configuración básica para panorámicas - SOLO ROTACIÓN HORIZONTAL
        controls.enableRotate = true;      // HABILITAR rotación
        controls.enablePan = false;        // Deshabilitar paneo/traslación  
        controls.enableZoom = false;       // Deshabilitar zoom para posición fija
        controls.enableDamping = true;     // Suavizado
        controls.dampingFactor = 0.1;      // Factor de suavizado
        
        // Configuración de rotación - SOLO HORIZONTAL
        controls.rotateSpeed = 0.8;        // Velocidad suave
        controls.autoRotate = false;       // Sin auto-rotación inicial
        controls.autoRotateSpeed = 1.0;    // Velocidad auto-rotación más lenta
        
        // LÍMITES PARA MOVIMIENTO SOLO HORIZONTAL (como persona parada)
        controls.minPolarAngle = Math.PI / 2;      // Bloquear en posición horizontal
        controls.maxPolarAngle = Math.PI / 2;      // Bloquear en posición horizontal
        controls.minAzimuthAngle = -Infinity;      // Rotación horizontal infinita
        controls.maxAzimuthAngle = Infinity;       // Rotación horizontal infinita
        
        // Límites de zoom - PERMITIR rotación pero mantener distancia fija
        controls.enableZoom = false;              // Deshabilitar zoom
        controls.minDistance = 0.1;               // Distancia mínima pequeña
        controls.maxDistance = 0.1;               // Distancia máxima igual (posición fija)
        
        // Configuración del target
        controls.target.set(0, 0, 0);
        controls.update(); // Aplicar configuración
        
        console.log('🎮 Controles configurados para vista panorámica 360°');

        // Crear ESFERA para vista panorámica 360° (como Google Street View)
        const geometry = new THREE.SphereGeometry(5, 60, 40); // Radio 5 para primera persona
        // Invertir geometría para ver desde adentro
        geometry.scale(-1, 1, 1); // Invertir para vista interna

        textureLoader = new THREE.TextureLoader();
        
        // Material optimizado para panorámicas - SIN TEXTURA INICIAL
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x444444,  // Color gris para ver la esfera vacía
            side: THREE.DoubleSide, // Ambas caras visibles
            transparent: false
        });
        
        sphereMesh = new THREE.Mesh(geometry, material);
        sphere = sphereMesh; // Alias para compatibilidad
        scene.add(sphereMesh);

        // Eventos
        window.addEventListener('resize', onWindowResize);
        
        // DEBUG: Agregar listeners para verificar eventos de mouse
        renderer.domElement.addEventListener('mousedown', function(e) {
            console.log('🖱️ Mouse down detectado:', e.clientX, e.clientY);
        });
        
        renderer.domElement.addEventListener('mousemove', function(e) {
            if (e.buttons > 0) { // Solo si hay botón presionado
                console.log('🖱️ Mouse move con botón presionado');
            }
        });
        
        // Eventos para hipervínculos
        renderer.domElement.addEventListener('click', onRendererClick);
        renderer.domElement.addEventListener('mousemove', onRendererMouseMove);
        
        console.log('🎮 Event listeners configurados');
        
        console.log('✅ Visor 3D inicializado correctamente');
        console.log('🔍 Componentes verificados:', {
            renderer: !!renderer,
            scene: !!scene,
            camera: !!camera,
            controls: !!controls,
            sphereMesh: !!sphereMesh,
            textureLoader: !!textureLoader
        });
        
        // Cargar demo solo si no hay imágenes
        if (!uploadedImages.img1 && !uploadedImages.img2) {
            loadPanoramaInViewer('https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2400&q=80');
        }
        
        // Iniciar animación
        animate();
        
        return true;
        
    } catch (error) {
        console.error('❌ Error inicializando visor:', error);
        updateStatus('❌ Error al inicializar visor 3D');
        return false;
    }
}

function loadPanoramaInViewer(imageUrl) {
    console.log('🌐 Cargando panorámica en visor 3D...');
    updateStatus('🔄 Aplicando textura al visor 3D...');
    
    if (!textureLoader || !sphereMesh) {
        console.warn('⚠️ Visor 3D no está listo, inicializando...');
        initViewer();
        
        setTimeout(() => {
            if (!textureLoader || !sphereMesh) {
                console.error('❌ Visor 3D no se pudo inicializar');
                updateStatus('❌ Error: No se pudo inicializar el visor 3D');
                return;
            }
            loadPanoramaInViewer(imageUrl);
        }, 1000);
        return;
    }
    
    textureLoader.load(
        imageUrl, 
        // Éxito
        function(texture) {
            console.log('✅ Textura cargada correctamente en Three.js');
            
            try {
                console.log('🔍 Información de textura:');
                console.log('  - Ancho:', texture.image.width);
                console.log('  - Alto:', texture.image.height);
                console.log('  - Formato:', texture.format);
                console.log('  - Tipo:', texture.type);
                
                // Configurar textura panorámica - CORREGIR ORIENTACIÓN
                texture.mapping = THREE.UVMapping; // Mapeo UV básico
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.flipY = true; // Cambiar a true para corregir volteo
                
                // Liberar textura anterior
                if (sphereMesh.material.map) {
                    sphereMesh.material.map.dispose();
                }
                
                // Crear NUEVO material con la textura
                const newMaterial = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide, // Ambas caras
                    color: 0xffffff
                });
                
                // Aplicar nuevo material a la esfera
                sphereMesh.material.dispose(); // Limpiar material anterior
                sphereMesh.material = newMaterial;
                
                console.log('✅ Textura aplicada exitosamente');
                
                // Reset vista
                resetView();
                
                updateStatus('🎉 ¡Panorámica 180° cargada! Arrastra con el mouse para navegar');
                console.log('🎯 Panorámica lista - navegación habilitada');
                
            } catch (error) {
                console.error('❌ Error aplicando textura:', error);
                updateStatus('❌ Error al aplicar la textura');
            }
        },
        // Progreso
        function(progress) {
            if (progress.lengthComputable && progress.total > 0) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                updateStatus(`📥 Cargando textura: ${percent}%`);
            }
        },
        // Error
        function(error) {
            console.error('❌ Error cargando textura en Three.js:', error);
            updateStatus('❌ Error al cargar textura en visor 3D');
            alert('Error al cargar la panorámica en el visor 3D.\\nRevisa la consola para más detalles.');
        }
    );
}

function animate() {
    requestAnimationFrame(animate);
    
    // Auto-rotación usando OrbitControls
    if (autoRotateEnabled && controls) {
        controls.autoRotate = true;
    } else if (controls) {
        controls.autoRotate = false;
    }
    
    controls.update();
    updateCoordinates();
    
    if (vrMode) {
        // Renderizado estereoscópico (modo VR)
        renderStereo();
    } else {
        // Renderizado normal
        renderer.render(scene, camera);
    }
}

function renderStereo() {
    // Sincronizar posición de cámaras VR con la cámara principal
    leftCamera.position.copy(camera.position);
    rightCamera.position.copy(camera.position);
    leftCamera.rotation.copy(camera.rotation);
    rightCamera.rotation.copy(camera.rotation);
    
    // Ajustar separación de ojos
    const eyeSeparation = 64;
    leftCamera.translateX(-eyeSeparation / 2);
    rightCamera.translateX(eyeSeparation / 2);
    
    // Limpiar pantalla
    renderer.clear();
    
    // Renderizar ojo izquierdo (mitad izquierda de la pantalla)
    renderer.setViewport(0, 0, window.innerWidth / 2, window.innerHeight);
    renderer.render(scene, leftCamera);
    
    // Renderizar ojo derecho (mitad derecha de la pantalla)
    renderer.setViewport(window.innerWidth / 2, 0, window.innerWidth / 2, window.innerHeight);
    renderer.render(scene, rightCamera);
    
    // Restaurar viewport completo
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
}

function updateCoordinates() {
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yaw = Math.round(THREE.MathUtils.radToDeg(euler.y));
    const pitch = Math.round(THREE.MathUtils.radToDeg(euler.x));
    coordinates.textContent = `Yaw: ${yaw}° Pitch: ${pitch}°`;
}

function toggleAutoRotate() {
    autoRotateEnabled = !autoRotateEnabled;
    btnAutoRotate.textContent = autoRotateEnabled ? '⏸️ Pausar' : '🎬 Auto-avanzar';
    btnAutoRotate.style.background = autoRotateEnabled ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.1)';
}

function rewindFilm() {
    if (controls) {
        // Rebobinar (rotar hacia la izquierda)
        controls.rotateLeft(Math.PI / 4); // Rotar 45° a la izquierda
        console.log('⏪ Rebobinando cinta...');
    }
}

function fastForwardFilm() {
    if (controls) {
        // Avanzar rápido (rotar hacia la derecha)
        controls.rotateLeft(-Math.PI / 4); // Rotar 45° a la derecha
        console.log('⏩ Avanzando cinta...');
    }
}

function toggleVRMode() {
    vrMode = !vrMode;
    btnVRMode.textContent = vrMode ? '📱 Modo Normal' : '🥽 Modo VR';
    btnVRMode.style.background = vrMode ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.1)';
    
    if (vrMode) {
        updateStatus('🥽 Modo VR activado - Usa lentes VR para mejor experiencia');
        console.log('🥽 Modo VR activado - Vista estereoscópica');
    } else {
        updateStatus('📱 Modo normal activado');
        console.log('📱 Modo normal - Vista única');
    }
    
    // Redimensionar para modo VR
    onWindowResize();
}

// ========== SISTEMA DE HIPERVÍNCULOS ==========

function startCreatingHyperlink() {
    isCreatingHyperlink = !isCreatingHyperlink;
    
    if (isCreatingHyperlink) {
        btnCreateLink.textContent = '❌ Cancelar Enlace';
        btnCreateLink.style.background = 'rgba(255,100,100,0.3)';
        hyperlinkPanel.style.display = 'block';
        updateStatus('🔗 Modo crear enlace activado - Haz clic donde quieras colocar el enlace');
        
        // Deshabilitar controles de cámara temporalmente
        controls.enabled = false;
    } else {
        cancelHyperlink();
    }
}

function cancelHyperlink() {
    isCreatingHyperlink = false;
    btnCreateLink.textContent = '🔗 Crear Enlace';
    btnCreateLink.style.background = 'rgba(255,255,255,0.1)';
    hyperlinkPanel.style.display = 'none';
    updateStatus('✅ Modo crear enlace cancelado');
    
    // Limpiar campos
    linkTitle.value = '';
    linkDestination.value = '';
    
    // Rehabilitar controles de cámara
    controls.enabled = true;
}

function onRendererClick(event) {
    if (!isCreatingHyperlink) return;
    
    // Calcular posición del mouse
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Hacer raycast para encontrar la posición en 3D
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphereMesh);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        
        // Mostrar preview del marcador
        showHyperlinkPreview(point, event.clientX - rect.left, event.clientY - rect.top);
        
        console.log('📍 Punto seleccionado para hipervínculo:', point);
    }
}

function onRendererMouseMove(event) {
    if (isCreatingHyperlink) {
        // Cambiar cursor cuando está en modo crear enlace
        renderer.domElement.style.cursor = 'crosshair';
    } else {
        renderer.domElement.style.cursor = 'grab';
    }
}

function showHyperlinkPreview(point3D, screenX, screenY) {
    // Crear marcador temporal
    const tempMarker = document.createElement('div');
    tempMarker.className = 'hyperlink-marker';
    tempMarker.innerHTML = '🔗';
    tempMarker.style.left = screenX - 15 + 'px';
    tempMarker.style.top = screenY - 15 + 'px';
    tempMarker.id = 'tempMarker';
    
    // Remover marcador anterior si existe
    const oldMarker = document.getElementById('tempMarker');
    if (oldMarker) oldMarker.remove();
    
    document.body.appendChild(tempMarker);
    
    // Guardar la posición 3D para uso posterior
    window.tempHyperlinkPosition = point3D;
    
    updateStatus('📍 Posición seleccionada - Completa la información del enlace');
}

function saveHyperlink() {
    if (!window.tempHyperlinkPosition) {
        alert('❌ Primero selecciona una posición haciendo clic en la panorámica');
        return;
    }
    
    const title = linkTitle.value.trim();
    const destination = linkDestination.value.trim();
    
    if (!title || !destination) {
        alert('❌ Completa todos los campos del enlace');
        return;
    }
    
    // Crear el hipervínculo
    const hyperlink = {
        id: Date.now(),
        title: title,
        destination: destination,
        position3D: window.tempHyperlinkPosition,
        created: new Date().toLocaleString()
    };
    
    hyperlinks.push(hyperlink);
    createHyperlinkMarker(hyperlink);
    updateHyperlinksList();
    
    // Limpiar y cerrar
    const tempMarker = document.getElementById('tempMarker');
    if (tempMarker) tempMarker.remove();
    
    cancelHyperlink();
    
    console.log('✅ Hipervínculo creado:', hyperlink);
    updateStatus(`✅ Enlace "${title}" creado exitosamente`);
}

function createHyperlinkMarker(hyperlink) {
    // TODO: Crear marcador 3D persistente
    // Por ahora, simplemente loggeamos
    console.log('🔗 Marcador creado para:', hyperlink.title);
}

function updateHyperlinksList() {
    linksContainer.innerHTML = '';
    
    hyperlinks.forEach(link => {
        const linkElement = document.createElement('div');
        linkElement.style.cssText = 'background: rgba(45,212,191,0.1); padding: 8px; margin: 5px 0; border-radius: 6px; border: 1px solid #2dd4bf;';
        linkElement.innerHTML = `
            <div style="font-weight: bold; color: #2dd4bf;">${link.title}</div>
            <div style="font-size: 11px; color: #aaa;">→ ${link.destination}</div>
            <div style="font-size: 10px; color: #666;">${link.created}</div>
            <button onclick="removeHyperlink(${link.id})" style="margin-top: 5px; padding: 2px 6px; font-size: 10px; background: rgba(255,100,100,0.3);">🗑️ Eliminar</button>
        `;
        linksContainer.appendChild(linkElement);
    });
}

function removeHyperlink(id) {
    hyperlinks = hyperlinks.filter(link => link.id !== id);
    updateHyperlinksList();
    console.log('🗑️ Hipervínculo eliminado:', id);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function resetView() {
    if (controls && camera) {
        // Resetear a posición inicial - vista frontal horizontal fija
        camera.position.set(0, 0, 0.1); // Muy cerca del centro de la esfera
        camera.lookAt(1, 0, 0); // Mirar hacia el frente horizontalmente
        controls.target.set(0, 0, 0); // Target en el centro
        controls.update();
        console.log('🎯 Vista reseteada - orientación frontal horizontal');
    }
}

function updateBrightness() {
    if (sphereMesh && sphereMesh.material) {
        const color = new THREE.Color(currentBrightness, currentBrightness, currentBrightness);
        sphereMesh.material.color = color;
        sphereMesh.material.needsUpdate = true;
        console.log('🔆 Brillo ajustado a:', Math.round(currentBrightness * 100) + '%');
    }
}

function onWindowResize() {
    if (vrMode) {
        // En modo VR, cada ojo usa la mitad de la pantalla
        camera.aspect = (window.innerWidth / 2) / window.innerHeight;
        leftCamera.aspect = (window.innerWidth / 2) / window.innerHeight;
        rightCamera.aspect = (window.innerWidth / 2) / window.innerHeight;
        leftCamera.updateProjectionMatrix();
        rightCamera.updateProjectionMatrix();
    } else {
        // Modo normal, pantalla completa
        camera.aspect = window.innerWidth / window.innerHeight;
    }
    
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Verificar librerías al cargar
window.addEventListener('load', function() {
    console.log('🔍 Verificando librerías...');
    console.log('Three.js disponible:', typeof THREE !== 'undefined');
    console.log('OrbitControls disponible:', typeof THREE !== 'undefined' && !!THREE.OrbitControls);
    
    if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
        console.log('🚀 Three.js y OrbitControls listos');
    } else {
        console.error('❌ Error: Librerías no disponibles');
    }
});

// ========== SISTEMA DE GUARDADO DE IMÁGENES ==========

function showSavePanel() {
    if (!lastGeneratedCanvas) {
        alert('❌ No hay ninguna imagen panorámica generada para guardar');
        return;
    }
    
    if (savePanel) {
        savePanel.style.display = 'block';
        
        // Generar nombre automático sugerido
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const autoName = `panoramica_${String(generatedImageCounter).padStart(3, '0')}_${timestamp}`;
        
        if (customFileName) {
            customFileName.value = autoName;
            customFileName.focus();
            customFileName.select();
        }
        
        updateStatus('💾 Panel de guardado abierto - Elige nombre para la imagen');
        console.log('💾 Panel de guardado mostrado');
    }
}

function hideSavePanel() {
    if (savePanel) {
        savePanel.style.display = 'none';
        updateStatus('✅ Panel de guardado cerrado');
    }
}

function downloadWithCustomName() {
    const customName = customFileName ? customFileName.value.trim() : '';
    
    if (!customName) {
        alert('❌ Por favor ingresa un nombre para el archivo');
        return;
    }
    
    if (!isValidFileName(customName)) {
        alert('❌ Nombre de archivo inválido. Usa solo letras, números, guiones y guiones bajos');
        return;
    }
    
    const fileName = `${customName}.jpg`;
    downloadCanvas(fileName);
    
    hideSavePanel();
    console.log('✅ Descarga iniciada con nombre personalizado:', fileName);
}

function downloadWithAutoName() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `panoramica_${String(generatedImageCounter).padStart(3, '0')}_${timestamp}.jpg`;
    
    downloadCanvas(fileName);
    
    // Incrementar contador para próxima imagen
    generatedImageCounter++;
    
    hideSavePanel();
    console.log('✅ Descarga iniciada con nombre automático:', fileName);
}

function downloadCanvas(fileName) {
    if (!lastGeneratedCanvas) {
        alert('❌ No hay canvas disponible para descargar');
        return;
    }
    
    updateStatus('⬇️ Preparando descarga...');
    
    try {
        // Crear enlace de descarga
        const dataURL = lastGeneratedCanvas.toDataURL('image/jpeg', 0.98);
        const downloadLink = document.createElement('a');
        downloadLink.download = fileName;
        downloadLink.href = dataURL;
        
        // Simular clic para iniciar descarga
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        updateStatus(`✅ Imagen descargada: ${fileName} → Muévela de Descargas a ORB`);
        
        // Log para seguimiento
        console.log('📁 Archivo descargado:', fileName);
        console.log('📐 Dimensiones:', lastGeneratedCanvas.width, 'x', lastGeneratedCanvas.height);
        console.log('📊 Tamaño aproximado:', Math.round(dataURL.length / 1024), 'KB');
        
        // Mostrar notificación de éxito
        showDownloadNotification(fileName);
        
    } catch (error) {
        console.error('❌ Error al descargar imagen:', error);
        updateStatus('❌ Error al guardar la imagen');
        alert('Error al guardar la imagen:\\n' + error.message);
    }
}

function isValidFileName(fileName) {
    // Validar que el nombre solo contenga caracteres permitidos
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(fileName) && fileName.length > 0 && fileName.length <= 50;
}

function showDownloadNotification(fileName) {
    // Crear notificación temporal con instrucciones
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(45,212,191,0.95);
        color: white;
        padding: 25px 30px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 2000;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        border: 2px solid #2dd4bf;
        text-align: center;
        max-width: 400px;
        line-height: 1.4;
    `;
    
    notification.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 10px;">✅</div>
        <div>¡Imagen descargada exitosamente!</div>
        <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">${fileName}</div>
        
        <div style="margin: 15px 0; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 6px; font-size: 11px; font-weight: normal;">
            <div style="color: #ffeb3b; margin-bottom: 5px;">📁 Para mover a la carpeta ORB:</div>
            <div>1. Ve a tu carpeta de <strong>Descargas</strong></div>
            <div>2. Busca el archivo: <span style="color: #fff; font-family: monospace;">${fileName}</span></div>
            <div>3. Córtalo y pégalo en:</div>
            <div style="font-family: monospace; color: #2dd4bf; margin-top: 3px;">C:\\Users\\aldo0\\OneDrive\\Escritorio\\ORB</div>
        </div>
        
        <button onclick="this.parentNode.remove(); openORBFolder();" style="
            background: rgba(255,255,255,0.2); 
            border: 1px solid white; 
            color: white; 
            padding: 8px 15px; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 11px;
            margin: 5px;
        ">� Abrir carpeta ORB</button>
        
        <button onclick="this.parentNode.remove(); openDownloadsFolder();" style="
            background: rgba(255,255,255,0.2); 
            border: 1px solid white; 
            color: white; 
            padding: 8px 15px; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 11px;
            margin: 5px;
        ">📥 Abrir Descargas</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remover después de 10 segundos (más tiempo para leer las instrucciones)
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }
    }, 10000);
}

// Función para limpiar recursos al crear nueva imagen
function resetImageGeneration() {
    lastGeneratedCanvas = null;
    if (btnSaveImage) {
        btnSaveImage.disabled = true;
        btnSaveImage.style.display = 'none';
    }
    if (savePanel) {
        savePanel.style.display = 'none';
    }
}

// Funciones para abrir carpetas del sistema
function openORBFolder() {
    try {
        // Intentar abrir la carpeta ORB usando diferentes métodos
        const orbPath = 'C:\\Users\\aldo0\\OneDrive\\Escritorio\\ORB';
        
        // Método 1: Usar file:// protocol
        window.open('file:///' + orbPath.replace(/\\/g, '/'), '_blank');
        
        console.log('📂 Intentando abrir carpeta ORB:', orbPath);
        
        // Mostrar instrucciones adicionales si no se abre automáticamente
        setTimeout(() => {
            showFolderInstructions('ORB', orbPath);
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error abriendo carpeta ORB:', error);
        showFolderInstructions('ORB', 'C:\\Users\\aldo0\\OneDrive\\Escritorio\\ORB');
    }
}

function openDownloadsFolder() {
    try {
        // Intentar abrir la carpeta de Descargas
        const downloadsPath = 'C:\\Users\\aldo0\\Downloads';
        
        // Método 1: Usar file:// protocol
        window.open('file:///' + downloadsPath.replace(/\\/g, '/'), '_blank');
        
        console.log('📥 Intentando abrir carpeta Descargas:', downloadsPath);
        
        // Mostrar instrucciones adicionales si no se abre automáticamente
        setTimeout(() => {
            showFolderInstructions('Descargas', downloadsPath);
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error abriendo carpeta Descargas:', error);
        showFolderInstructions('Descargas', 'C:\\Users\\aldo0\\Downloads');
    }
}

function showFolderInstructions(folderName, folderPath) {
    const instructions = document.createElement('div');
    instructions.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        z-index: 1500;
        border: 1px solid #444;
        max-width: 300px;
    `;
    
    instructions.innerHTML = `
        <div style="color: #2dd4bf; font-weight: bold; margin-bottom: 8px;">
            📂 Abrir ${folderName} manualmente:
        </div>
        <div style="line-height: 1.4;">
            1. Abre el <strong>Explorador de archivos</strong><br>
            2. Navega a: <span style="font-family: monospace; color: #ffeb3b;">${folderPath}</span><br>
            3. O copia esta ruta en la barra de direcciones
        </div>
        <button onclick="this.parentNode.remove();" style="
            margin-top: 10px;
            background: rgba(45,212,191,0.3);
            border: 1px solid #2dd4bf;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        ">Entendido</button>
    `;
    
    document.body.appendChild(instructions);
    
    // Auto-remover después de 8 segundos
    setTimeout(() => {
        if (instructions && instructions.parentNode) {
            instructions.parentNode.removeChild(instructions);
        }
    }, 8000);
}