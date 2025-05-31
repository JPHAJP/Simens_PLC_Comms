// webcam.js con funcionalidad de fullscreen corregida

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
    
    let streamActive = false;
    let streamUrl = '/video_feed?' + new Date().getTime();
    let isFullscreen = false;
    
    // Función para verificar si la webcam ya está activa
    function checkWebcamStatus() {
        fetch('/api/webcam/status')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                if (data.active) {
                    startButton.disabled = true;
                    stopButton.disabled = false;
                    if (!streamActive) {
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
        })
        .catch(error => {
            console.error('Error al verificar estado de la webcam:', error);
        });
    }
    
    // Función para alternar pantalla completa (método mejorado)
    function toggleFullscreen() {
        if (!isFullscreen) {
            enterFullscreen();
        } else {
            exitFullscreen();
        }
    }
    
    function enterFullscreen() {
        // Crear overlay de pantalla completa
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
        
        // Crear contenedor para la imagen (más grande)
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
        
        // Clonar la imagen (más grande)
        const clonedImage = videoElement.cloneNode(true);
        clonedImage.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            width: 100%;
            height: auto;
            object-fit: contain;
            min-height: 80vh;
        `;
        
        // Crear botón de cerrar
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
        
        // Ensamblar elementos
        imageContainer.appendChild(clonedImage);
        fullscreenOverlay.appendChild(imageContainer);
        fullscreenOverlay.appendChild(closeButton);
        document.body.appendChild(fullscreenOverlay);
        
        // Event listeners para cerrar
        closeButton.addEventListener('click', exitFullscreen);
        fullscreenOverlay.addEventListener('click', function(e) {
            if (e.target === fullscreenOverlay) {
                exitFullscreen();
            }
        });
        
        // Actualizar estado
        isFullscreen = true;
        fullscreenIcon.className = 'fas fa-compress';
        document.body.style.overflow = 'hidden';
        
        // Actualizar la imagen clonada periódicamente
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
    checkWebcamStatus();
    
    // También actualizar cuando se refresque la página
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            checkWebcamStatus();
        }
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
    
    // Salir de fullscreen con la tecla Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && isFullscreen) {
            exitFullscreen();
        }
    });
    
    // Doble clic en la imagen para fullscreen
    videoElement.addEventListener('dblclick', function() {
        if (streamActive) {
            toggleFullscreen();
        }
    });
    
    // Iniciar la webcam
    startButton.addEventListener('click', function() {
        fetch('/api/webcam/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                streamUrl = '/video_feed?' + new Date().getTime();
                videoElement.src = streamUrl;
                startButton.disabled = true;
                stopButton.disabled = false;
                streamActive = true;
                
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Webcam iniciada', 'info');
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
    
    // Detener la webcam
    stopButton.addEventListener('click', function() {
        if (isFullscreen) {
            exitFullscreen();
        }
        
        fetch('/api/webcam/stop', {
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
                
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Webcam detenida', 'info');
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
    
    // Capturar imagen
    captureButton.addEventListener('click', function() {
        fetch('/api/webcam/capture')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                capturedImage.src = data.image;
                capturedContainer.style.display = 'block';
                
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Imagen capturada', 'info');
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
});