// webcam.js con funcionalidad dual de cámaras y fullscreen

document.addEventListener('DOMContentLoaded', function() {
    const videoElement = document.getElementById('webcam-feed');
    const startButton = document.getElementById('start-webcam');
    const stopButton = document.getElementById('stop-webcam');
    const captureButton = document.getElementById('capture-webcam');
    const capturedImage = document.getElementById('captured-image');
    const capturedContainer = document.getElementById('captured-image-container');
    
    // Elementos para fullscreen
    const webcamWrapper = document.getElementById('webcam-wrapper');
    const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    
    // Elementos para el toggle de cámaras
    const localCameraRadio = document.getElementById('local-camera');
    const ipCameraRadio = document.getElementById('ip-camera');
    const cameraTypeText = document.getElementById('camera-type-text');
    const statusDot = document.getElementById('status-dot');
    
    let streamActive = false;
    let streamUrl = '';
    let isFullscreen = false;
    let currentCamera = 'local'; // 'local' o 'ip'
    
    // Configuración de URLs
    const cameraConfig = {
        local: {
            startUrl: '/api/webcam/start',
            stopUrl: '/api/webcam/stop',
            statusUrl: '/api/webcam/status',
            captureUrl: '/api/webcam/capture',
            streamUrl: '/video_feed',
            name: 'Cámara Local'
        },
        ip: {
            startUrl: '/api/ip_camera/start',
            stopUrl: '/api/ip_camera/stop',
            statusUrl: '/api/ip_camera/status',
            captureUrl: '/api/ip_camera/capture',
            streamUrl: '/ip_video_feed',
            name: 'Cámara IP'
        }
    };
    
    // Función para actualizar el indicador de cámara
    function updateCameraIndicator() {
        cameraTypeText.textContent = cameraConfig[currentCamera].name;
        if (streamActive) {
            statusDot.classList.add('active');
        } else {
            statusDot.classList.remove('active');
        }
    }
    
    // Función para verificar el estado de la cámara actual
    function checkCameraStatus() {
        const config = cameraConfig[currentCamera];
        
        fetch(config.statusUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                if (data.active) {
                    startButton.disabled = true;
                    stopButton.disabled = false;
                    if (!streamActive) {
                        streamUrl = config.streamUrl + '?' + new Date().getTime();
                        videoElement.src = streamUrl;
                        streamActive = true;
                    }
                } else {
                    startButton.disabled = false;
                    stopButton.disabled = true;
                    if (streamActive) {
                        videoElement.src = '';
                        streamActive = false;
                    }
                }
            }
            updateCameraIndicator();
        })
        .catch(error => {
            console.error('Error al verificar estado de la cámara:', error);
            updateCameraIndicator();
        });
    }
    
    // Función para cambiar de cámara
    function switchCamera(newCamera) {
        if (newCamera === currentCamera) return;
        
        // Si hay una cámara activa, detenerla primero
        if (streamActive) {
            stopCurrentCamera().then(() => {
                currentCamera = newCamera;
                updateCameraIndicator();
                checkCameraStatus();
            });
        } else {
            currentCamera = newCamera;
            updateCameraIndicator();
            checkCameraStatus();
        }
    }
    
    // Función para detener la cámara actual
    function stopCurrentCamera() {
        const config = cameraConfig[currentCamera];
        
        return fetch(config.stopUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                videoElement.src = '';
                startButton.disabled = false;
                stopButton.disabled = true;
                streamActive = false;
                updateCameraIndicator();
                
                if (typeof addLogEntry === 'function') {
                    addLogEntry(`${cameraConfig[currentCamera].name} detenida`, 'info');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (typeof addLogEntry === 'function') {
                addLogEntry('Error al comunicarse con el servidor', 'error');
            }
        });
    }
    
    // Event listeners para el toggle de cámaras
    localCameraRadio.addEventListener('change', function() {
        if (this.checked) {
            switchCamera('local');
        }
    });
    
    ipCameraRadio.addEventListener('change', function() {
        if (this.checked) {
            switchCamera('ip');
        }
    });
    
    // Función para alternar pantalla completa
    function toggleFullscreen() {
        if (!isFullscreen) {
            enterFullscreen();
        } else {
            exitFullscreen();
        }
    }
    
    function enterFullscreen() {
        const fullscreenOverlay = document.createElement('div');
        fullscreenOverlay.id = 'fullscreen-overlay';
        fullscreenOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            position: relative;
            max-width: 98%;
            max-height: 98%;
            width: 98%;
            height: 98%;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const clonedImage = videoElement.cloneNode(true);
        clonedImage.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            width: 100%;
            height: auto;
            object-fit: contain;
            min-height: 80vh;
        `;
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<i class="fas fa-times"></i>';
        closeButton.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid white;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            z-index: 10001;
        `;
        
        closeButton.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 255, 255, 0.3)';
            this.style.transform = 'scale(1.1)';
        });
        
        closeButton.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 255, 255, 0.2)';
            this.style.transform = 'scale(1)';
        });
        
        // Indicador de cámara en fullscreen
        const fullscreenIndicator = document.createElement('div');
        fullscreenIndicator.style.cssText = `
            position: absolute;
            top: 15px;
            left: 15px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 10001;
        `;
        fullscreenIndicator.textContent = cameraConfig[currentCamera].name;
        
        imageContainer.appendChild(clonedImage);
        fullscreenOverlay.appendChild(imageContainer);
        fullscreenOverlay.appendChild(closeButton);
        fullscreenOverlay.appendChild(fullscreenIndicator);
        document.body.appendChild(fullscreenOverlay);
        
        closeButton.addEventListener('click', exitFullscreen);
        fullscreenOverlay.addEventListener('click', function(e) {
            if (e.target === fullscreenOverlay) {
                exitFullscreen();
            }
        });
        
        isFullscreen = true;
        fullscreenIcon.className = 'fas fa-compress';
        document.body.style.overflow = 'hidden';
        
        const updateInterval = setInterval(function() {
            if (streamActive && videoElement.src) {
                clonedImage.src = videoElement.src + '&t=' + new Date().getTime();
            }
            
            if (!isFullscreen) {
                clearInterval(updateInterval);
            }
        }, 100);
    }
    
    function exitFullscreen() {
        const overlay = document.getElementById('fullscreen-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        isFullscreen = false;
        fullscreenIcon.className = 'fas fa-expand';
        document.body.style.overflow = 'auto';
    }
    
    // Verificar estado inicial
    updateCameraIndicator();
    checkCameraStatus();
    
    // Event listeners para botones de control
    startButton.addEventListener('click', function() {
        const config = cameraConfig[currentCamera];
        
        fetch(config.startUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                streamUrl = config.streamUrl + '?' + new Date().getTime();
                videoElement.src = streamUrl;
                startButton.disabled = true;
                stopButton.disabled = false;
                streamActive = true;
                updateCameraIndicator();
                
                if (typeof addLogEntry === 'function') {
                    addLogEntry(`${config.name} iniciada`, 'info');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (typeof addLogEntry === 'function') {
                addLogEntry('Error al comunicarse con el servidor', 'error');
            }
        });
    });
    
    stopButton.addEventListener('click', function() {
        if (isFullscreen) {
            exitFullscreen();
        }
        stopCurrentCamera();
    });
    
    captureButton.addEventListener('click', function() {
        const config = cameraConfig[currentCamera];
        
        fetch(config.captureUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                capturedImage.src = data.image;
                capturedContainer.style.display = 'block';
                
                if (typeof addLogEntry === 'function') {
                    addLogEntry(`Imagen capturada de ${config.name}`, 'info');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (typeof addLogEntry === 'function') {
                addLogEntry('Error al comunicarse con el servidor', 'error');
            }
        });
    });
    
    // Event listeners para fullscreen
    if (toggleFullscreenBtn) {
        toggleFullscreenBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (streamActive) {
                toggleFullscreen();
            }
        });
    }
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && isFullscreen) {
            exitFullscreen();
        }
    });
    
    videoElement.addEventListener('dblclick', function() {
        if (streamActive) {
            toggleFullscreen();
        }
    });
    
    // Actualizar cuando cambie la visibilidad
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            checkCameraStatus();
        }
    });
});