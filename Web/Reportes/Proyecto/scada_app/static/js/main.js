// Crear un espacio de nombres para la webcam
const webcamHandler = {
    videoElement: null,
    startButton: null,
    stopButton: null,
    captureButton: null,
    capturedImage: null,
    capturedContainer: null,
    streamActive: false,
    streamCheckInterval: null,
    
    // Inicializar el manejador de webcam
    init: function() {
        this.videoElement = document.getElementById('webcam-feed');
        this.startButton = document.getElementById('start-webcam');
        this.stopButton = document.getElementById('stop-webcam');
        this.captureButton = document.getElementById('capture-webcam');
        this.capturedImage = document.getElementById('captured-image');
        this.capturedContainer = document.getElementById('captured-image-container');
        
        // Configurar los event listeners
        this.setupEventListeners();
        
        // Verificar estado inicial
        this.checkWebcamStatus();
        
        // Configurar el intervalo para verificaciones periódicas
        // Usa un intervalo más largo para evitar sobrecarga
        this.streamCheckInterval = setInterval(() => this.checkWebcamStatus(), 5000);
    },
    
    // Configurar los event listeners para los botones
    setupEventListeners: function() {
        const self = this;
        
        this.startButton.addEventListener('click', function() {
            self.startWebcam();
        });
        
        this.stopButton.addEventListener('click', function() {
            self.stopWebcam(); 
        });
        
        this.captureButton.addEventListener('click', function() {
            self.captureImage();
        });
    },
    
    // Verificar el estado actual de la webcam
    checkWebcamStatus: function() {
        const self = this;
        
        fetch('/api/webcam/status')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                if (data.active) {
                    self.startButton.disabled = true;
                    self.stopButton.disabled = false;
                    self.captureButton.disabled = false;
                    
                    if (!self.streamActive) {
                        // Solo actualiza la fuente si el stream no está activo
                        self.videoElement.src = '/video_feed?' + new Date().getTime();
                        self.streamActive = true;
                    }
                } else {
                    self.startButton.disabled = false;
                    self.stopButton.disabled = true;
                    self.captureButton.disabled = true;
                    
                    if (self.streamActive) {
                        self.videoElement.src = '';
                        self.streamActive = false;
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error al verificar estado de la webcam:', error);
        });
    },
    
    // Iniciar la webcam
    startWebcam: function() {
        const self = this;
        
        fetch('/api/webcam/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Establecer la fuente del video con un parámetro de tiempo para evitar caché
                self.videoElement.src = '/video_feed?' + new Date().getTime();
                self.startButton.disabled = true;
                self.stopButton.disabled = false;
                self.captureButton.disabled = false;
                self.streamActive = true;
                
                // Agregar evento al registro
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Webcam iniciada', 'info');
                }
            } else {
                console.error('Error al iniciar la webcam:', data.message);
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Error al iniciar la webcam: ' + data.message, 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (typeof addLogEntry === 'function') {
                addLogEntry('Error al comunicarse con el servidor', 'error');
            }
        });
    },
    
    // Detener la webcam
    stopWebcam: function() {
        const self = this;
        
        fetch('/api/webcam/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Eliminar la fuente del video
                self.videoElement.src = '';
                self.startButton.disabled = false;
                self.stopButton.disabled = true;
                self.captureButton.disabled = true;
                self.streamActive = false;
                
                // Agregar evento al registro
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Webcam detenida', 'warning');
                }
            } else {
                console.error('Error al detener la webcam:', data.message);
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Error al detener la webcam: ' + data.message, 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (typeof addLogEntry === 'function') {
                addLogEntry('Error al comunicarse con el servidor', 'error');
            }
        });
    },
    
    // Capturar imagen
    captureImage: function() {
        const self = this;
        
        fetch('/api/webcam/capture')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Mostrar la imagen capturada
                self.capturedImage.src = data.image;
                self.capturedContainer.style.display = 'block';
                
                // Agregar evento al registro
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Imagen capturada desde webcam', 'success');
                }
            } else {
                console.error('Error al capturar imagen:', data.message);
                if (typeof addLogEntry === 'function') {
                    addLogEntry('Error al capturar imagen: ' + data.message, 'error');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (typeof addLogEntry === 'function') {
                addLogEntry('Error al comunicarse con el servidor', 'error');
            }
        });
    },
    
    // Limpiar recursos al descartar el manejador
    cleanup: function() {
        if (this.streamCheckInterval) {
            clearInterval(this.streamCheckInterval);
        }
    }
};

// Separar el código de actualización de datos para evitar conflictos con el stream de video
const dataHandler = {
    opTimers: {
        plc1: 0,
        plc2: 0,
        plc3: 0,
        robot: 0
    },
    previousLog: [],
    previousState: {
        plc1: {
            encendido: false,
            adelante: false,
            reversa: false,
            botones: {
                encender: false,
                adelante: false,
                reversa: false
            }
        },
        plc2: {
            deteccion: false,
            trabajando: false,
            progress: 0,
            botones: {
                toggle: false,
                reiniciar: false,
                skip: false
            }
        },
        plc3: {
            deteccion: false,
            trabajando: false,
            progress: 0,
            botones: {
                toggle: false,
                reiniciar: false,
                skip: false
            }
        },
        robot: {
            trabajando: false,
            progress: 0,
            botones: {
                toggle: false,
                reiniciar: false,
                skip: false
            }
        }
    },
    timerIntervals: {},
    dataFetchInterval: null,
    
    // Inicializar el manejador de datos
    init: function() {
        // Iniciar la actualización periódica de datos
        // Utilizamos fetchData directamente en lugar de una función anónima
        this.dataFetchInterval = setInterval(() => this.fetchData(), 1000);
    },
    
    // Función para obtener datos de la API
    fetchData: function() {
        // Usar fetch con opciones que aseguren no caché para datos actualizados
        fetch('/api/data', {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        })
        .then(response => response.json())
        .then(data => this.updateUI(data))
        .catch(error => {
            console.error('Error fetching data:', error);
            // Verificamos que addLogEntry exista antes de llamarla
            if (typeof addLogEntry === 'function') {
                addLogEntry('Error de comunicación con el servidor', 'error');
            }
        });
    },
    
    // Actualizar la interfaz con los nuevos datos
    updateUI: function(data) {
        // La implementación de updateUI existente se mantiene igual
        // pero ahora es un método de dataHandler
        
        // ...
        // El resto del código de updateUI se mantiene igual
        // ...

        // -------- Actualizar PLC1 --------
        document.getElementById('plc1-state').innerText = data.plc1.state;
        const plc1Encendido = data.plc1.focos.encendido;
        const plc1Adelante = data.plc1.focos.adelante;
        const plc1Reversa = data.plc1.focos.reversa;

        // Actualizar estados visuales
        ['encendido', 'adelante', 'reversa'].forEach(function (key) {
            const elem = document.getElementById('plc1-' + key);
            if (data.plc1.focos[key]) {
                elem.classList.remove('bg-secondary');
                elem.classList.add('bg-success', 'mb-1');
            } else {
                elem.classList.remove('bg-success');
                elem.classList.add('bg-secondary', 'mb-1');
            }
        });

        // Actualizar estado de los botones PLC1
        // Botón de encendido/apagado
        const btnEncender = document.getElementById('plc1-btn-encender');
        if (data.plc1.botones.encender !== previousState.plc1.botones.encender) {
            if (data.plc1.botones.encender) {
                btnEncender.innerHTML = '<i class="fas fa-power-off"></i> Apagar';
            } else {
                btnEncender.innerHTML = '<i class="fas fa-power-off"></i> Encender';
            }
            previousState.plc1.botones.encender = data.plc1.botones.encender;
        }

        // Detectar cambios reales en PLC1
        if (plc1Encendido !== previousState.plc1.encendido) {
            if (plc1Encendido) {
                startConveyor(); // Función nueva
                addLogEntry('Banda transportadora: Encendida', 'info');
            } else {
                stopConveyor(); // Función nueva
                addLogEntry('Banda transportadora: Apagada', 'warning');
            }
            previousState.plc1.encendido = plc1Encendido;
        }

        if (plc1Encendido) {
            if (plc1Adelante !== previousState.plc1.adelante) {
                if (plc1Adelante) {
                    startConveyor('forward'); // Función nueva con parámetro
                    addLogEntry('Banda transportadora: Iniciando movimiento adelante', 'info');
                } else if (previousState.plc1.adelante) {
                    stopConveyor(); // Función nueva
                    addLogEntry('Banda transportadora: Detenido movimiento adelante', 'warning');
                }
                previousState.plc1.adelante = plc1Adelante;
            }

            if (plc1Reversa !== previousState.plc1.reversa) {
                if (plc1Reversa) {
                    startConveyor('reverse'); // Función nueva con parámetro
                    addLogEntry('Banda transportadora: Iniciando movimiento en reversa', 'info');
                } else if (previousState.plc1.reversa) {
                    stopConveyor(); // Función nueva
                    addLogEntry('Banda transportadora: Detenido movimiento en reversa', 'warning');
                }
                previousState.plc1.reversa = plc1Reversa;
            }

            toggleOperationTimer('plc1', true);
        } else {
            toggleOperationTimer('plc1', false);
        }

        // -------- Actualizar PLC2 (Revolvedora) --------
        const plc2Progress = document.getElementById('plc2-progress');
        const currentPlc2Progress = data.plc2.progress;
        plc2Progress.style.width = currentPlc2Progress + '%';
        plc2Progress.setAttribute('aria-valuenow', currentPlc2Progress);
        plc2Progress.innerText = currentPlc2Progress + '%';

        if (currentPlc2Progress === 100 && previousState.plc2.progress < 100) {
            addLogEntry('Revolvedora: Proceso completado al 100%', 'success');
        } else if (currentPlc2Progress === 0 && previousState.plc2.progress > 0) {
            addLogEntry('Revolvedora: Proceso reiniciado', 'info');
        }
        previousState.plc2.progress = currentPlc2Progress;

        const plc2Deteccion = data.plc2.focos.deteccion;
        const plc2Trabajando = data.plc2.focos.trabajando;

        // Actualizar estados visuales
        ['deteccion', 'trabajando'].forEach(function (key) {
            const elem = document.getElementById('plc2-foco-' + key);
            if (data.plc2.focos[key]) {
                elem.classList.remove('bg-secondary');
                elem.classList.add('bg-success', 'mb-1');
            } else {
                elem.classList.remove('bg-success');
                elem.classList.add('bg-secondary', 'mb-1');
            }
        });

        // Actualizar estado de los botones PLC2
        // Actualización incondicional del botón PLC2
        const btnPlc2Toggle = document.getElementById('plc2-toggle');
        btnPlc2Toggle.innerHTML = data.plc2.botones.toggle
            ? '<i class="fas fa-pause"></i> Pausar'
            : '<i class="fas fa-play"></i> / <i class="fas fa-pause"></i>';
        previousState.plc2.botones.toggle = data.plc2.botones.toggle;


        // Detectar cambios reales en PLC2
        if (plc2Trabajando !== previousState.plc2.trabajando) {
            if (plc2Trabajando) {
                addLogEntry('Pistones: Iniciando trabajo', 'info');
                startPistons(); // Función nueva
            } else {
                addLogEntry('Pistones: Deteniendo trabajo', 'warning');
                stopPistons(); // Función nueva
            }
            previousState.plc2.trabajando = plc2Trabajando;
        }
        toggleOperationTimer('plc2', plc2Trabajando);

        // -------- Actualizar PLC3 (Empacadora Circular) --------
        const plc3Progress = document.getElementById('plc3-progress');
        const currentPlc3Progress = data.plc3.progress;
        plc3Progress.style.width = currentPlc3Progress + '%';
        plc3Progress.setAttribute('aria-valuenow', currentPlc3Progress);
        plc3Progress.innerText = currentPlc3Progress + '%';

        if (currentPlc3Progress === 100 && previousState.plc3.progress < 100) {
            addLogEntry('Empacadora: Proceso completado al 100%', 'success');
        } else if (currentPlc3Progress === 0 && previousState.plc3.progress > 0) {
            addLogEntry('Empacadora: Proceso reiniciado', 'info');
        }
        previousState.plc3.progress = currentPlc3Progress;

        const plc3Deteccion = data.plc3.focos.deteccion;
        const plc3Trabajando = data.plc3.focos.trabajando;

        // Actualizar estados visuales
        ['deteccion', 'trabajando'].forEach(function (key) {
            const elem = document.getElementById('plc3-foco-' + key);
            if (data.plc3.focos[key]) {
                elem.classList.remove('bg-secondary');
                elem.classList.add('bg-success', 'mb-1');
            } else {
                elem.classList.remove('bg-success');
                elem.classList.add('bg-secondary', 'mb-1');
            }
        });

        // Actualizar estado de los botones PLC3
        const btnPlc3Toggle = document.getElementById('plc3-toggle');
        btnPlc3Toggle.innerHTML = data.plc3.botones.toggle
            ? '<i class="fas fa-pause"></i> Pausar'
            : '<i class="fas fa-play"></i> / <i class="fas fa-pause"></i>';
        previousState.plc3.botones.toggle = data.plc3.botones.toggle;


        // Detectar cambios reales en PLC3
        if (plc3Trabajando !== previousState.plc3.trabajando) {
            if (plc3Trabajando) {
                addLogEntry('Empacadora: Iniciando trabajo', 'info');
                startPacker(); // Función nueva
            } else {
                addLogEntry('Empacadora: Deteniendo trabajo', 'warning');
                stopPacker(); // Función nueva
            }
            previousState.plc3.trabajando = plc3Trabajando;
        }
        toggleOperationTimer('plc3', plc3Trabajando);

        // -------- Actualizar Robot --------
        const robotProgress = document.getElementById('robot-progress');
        // Usa gcode_line como porcentaje en lugar de progress
        const currentRobotProgress = data.robot.gcode_line;
        robotProgress.style.width = currentRobotProgress + '%';
        robotProgress.setAttribute('aria-valuenow', currentRobotProgress);
        robotProgress.innerText = currentRobotProgress + '%';

        if (currentRobotProgress === 100 && previousState.robot.progress < 100) {
            addLogEntry('Robot: Proceso completado al 100%', 'success');
        } else if (currentRobotProgress === 0 && previousState.robot.progress > 0) {
            addLogEntry('Robot: Proceso reiniciado', 'info');
        }
        previousState.robot.progress = currentRobotProgress;

        // El robot tiene una estructura diferente en el JSON
        // No tiene focos.deteccion y focos.trabajando sino un único foco
        const robotTrabajando = data.robot.foco === "trabajando";

        // Actualizar estados visuales para el robot (solo trabajando)
        const elemRobotTrabajando = document.getElementById('robot-foco-trabajando');
        if (robotTrabajando) {
            elemRobotTrabajando.classList.remove('bg-secondary');
            elemRobotTrabajando.classList.add('bg-success', 'mb-1');
        } else {
            elemRobotTrabajando.classList.remove('bg-success');
            elemRobotTrabajando.classList.add('bg-secondary', 'mb-1');
        }

        // También actualizar el span con ID robot-foco
        const robotFocoGeneral = document.getElementById('robot-foco');
        robotFocoGeneral.innerText = data.robot.foco;
        if (data.robot.foco === "trabajando") {
            robotFocoGeneral.className = 'badge bg-success text-white';
        } else if (data.robot.foco === "detenido") {
            robotFocoGeneral.className = 'badge bg-warning text-dark';
        } else {
            robotFocoGeneral.className = 'badge bg-secondary text-white';
        }

        // Actualizar estado de los botones Robot
        const btnRobotToggle = document.getElementById('robot-toggle');
        btnRobotToggle.innerHTML = data.robot.botones.toggle
            ? '<i class="fas fa-pause"></i> Pausar'
            : '<i class="fas fa-play"></i> / <i class="fas fa-pause"></i>';
        previousState.robot.botones.toggle = data.robot.botones.toggle;

        // Detectar cambios reales en Robot
        if (robotTrabajando !== previousState.robot.trabajando) {
            if (robotTrabajando) {
                addLogEntry('Robot: Iniciando trabajo', 'info');
                robotAnimation.classList.add('robot-working');
            } else {
                addLogEntry('Robot: Deteniendo trabajo', 'warning');
                robotAnimation.classList.remove('robot-working');
            }
            previousState.robot.trabajando = robotTrabajando;
        }
        toggleOperationTimer('robot', robotTrabajando);

        // -------- Actualizar el log completo si ha cambiado --------
        if (data.log && Array.isArray(data.log)) {
            // Convertimos el log actual y el previo a strings para compararlos
            const currentLogString = JSON.stringify(data.log);
            const previousLogString = JSON.stringify(previousLog);
            if (currentLogString !== previousLogString) {
                // Si hay diferencias, actualizamos el contenedor completamente
                logContainer.innerHTML = '';
                data.log.forEach(function (entry) {
                    addLogEntry(entry);
                });
                // Guardamos la nueva versión del log
                previousLog = data.log.slice();
            }
        }

        // -------- Actualizar eficiencia general (simulada) --------
        updateEfficiency();
    },
    
    // Limpieza de recursos
    cleanup: function() {
        if (this.dataFetchInterval) {
            clearInterval(this.dataFetchInterval);
        }
        
        // Limpiar los intervalos de operación
        Object.keys(this.timerIntervals).forEach(key => {
            if (this.timerIntervals[key]) {
                clearInterval(this.timerIntervals[key]);
            }
        });
    }
};

// Código de inicialización que se ejecuta cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar el manejador de webcam
    webcamHandler.init();
    
    // Inicializar el manejador de datos
    dataHandler.init();
    
    // Configurar los event listeners para los botones principales
    setupMainEventListeners();
    
    // Función para inicializar los event listeners principales
    function setupMainEventListeners() {
        // ... todos los event listeners existentes ...
        // Los event listeners de la webcam ya están manejados por webcamHandler
    }
    
    // Función para agregar entradas al log global
    window.addLogEntry = function(message, type = 'info') {
        const logContainer = document.getElementById('log-container');
        if (!logContainer) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        const now = new Date();
        const timeStr = now.toLocaleTimeString();

        const timestamp = document.createElement('span');
        timestamp.className = 'log-timestamp';
        timestamp.textContent = `[${timeStr}]`;

        const messageSpan = document.createElement('span');
        switch (type) {
            case 'warning':
                messageSpan.className = 'text-warning';
                break;
            case 'error':
                messageSpan.className = 'text-danger';
                break;
            case 'success':
                messageSpan.className = 'text-success';
                break;
            default:
                messageSpan.className = 'text-dark';
        }
        messageSpan.textContent = ' ' + message;

        logEntry.appendChild(timestamp);
        logEntry.appendChild(messageSpan);

        // Se agrega al principio del contenedor
        logContainer.insertBefore(logEntry, logContainer.firstChild);

        // Limitar a 50 entradas
        if (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.lastChild);
        }
    };
    
    // Limpieza cuando la página se descarga
    window.addEventListener('beforeunload', function() {
        webcamHandler.cleanup();
        dataHandler.cleanup();
    });
});