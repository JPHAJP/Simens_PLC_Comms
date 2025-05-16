// Modificación mínima para webcam.js (separado del main_old.js)
// Crea un nuevo archivo llamado webcam.js con este contenido

document.addEventListener('DOMContentLoaded', function() {
    const videoElement = document.getElementById('webcam-feed');
    const startButton = document.getElementById('start-webcam');
    const stopButton = document.getElementById('stop-webcam');
    const captureButton = document.getElementById('capture-webcam');
    const capturedImage = document.getElementById('captured-image');
    const capturedContainer = document.getElementById('captured-image-container');
    
    let streamActive = false;
    let streamUrl = '/video_feed?' + new Date().getTime();
    
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
    
    // Verificar estado inicial y configurar un intervalo para actualizaciones
    checkWebcamStatus();
    
    // También actualizar cuando se refresque la página (para prevenir problemas con main_old.js)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            checkWebcamStatus();
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
                // Actualizar la URL con un timestamp para evitar cacheo
                streamUrl = '/video_feed?' + new Date().getTime();
                videoElement.src = streamUrl;
                startButton.disabled = true;
                stopButton.disabled = false;
                streamActive = true;
                
                // Intento agregar evento al registro si existe la función
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
                // Mostrar la imagen capturada
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