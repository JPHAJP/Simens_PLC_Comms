document.addEventListener('DOMContentLoaded', function () {
    // Variables globales
    let opTimers = {
        plc1: 0,
        plc2: 0,
        plc3: 0,
        robot: 0
    };

    // Variable para almacenar el log previo (para evitar duplicados)
    let previousLog = [];

    // Variables para mantener el estado previo de los dispositivos y botones
    let previousState = {
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
            foco: '',
            progress: 0,
            botones: {
                toggle: false,
                reiniciar: false,
                skip: false
            }
        }
    };

    // Elementos de animación
    const logContainer = document.getElementById('log-container');
    const conveyorAnimation = document.getElementById('conveyor-animation');
    const conveyorBelt = document.getElementById('conveyor-belt');
    const pistonAnimation = document.getElementById('piston-animation');
    const packerAnimation = document.getElementById('packer-animation');
    const robotAnimation = document.getElementById('robot-animation');

    // Contadores para tiempos de operación
    let timerIntervals = {};

    // Función para agregar una entrada al log con timestamp
    function addLogEntry(message, type = 'info') {
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
    }

    // Función para formatear el tiempo
    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [h.toString().padStart(2, '0'),
        m.toString().padStart(2, '0'),
        s.toString().padStart(2, '0')].join(':');
    }

    // Función para iniciar/detener timers
    function toggleOperationTimer(device, isActive) {
        const timerElement = document.getElementById(`op-time-${device}`);
        if (isActive) {
            if (timerIntervals[device]) return;
            timerIntervals[device] = setInterval(() => {
                opTimers[device]++;
                timerElement.innerText = formatTime(opTimers[device]);
            }, 1000);
        } else {
            if (timerIntervals[device]) {
                clearInterval(timerIntervals[device]);
                timerIntervals[device] = null;
            }
        }
    }

    // Función para activar la banda transportadora
    function startConveyor(direction = 'forward') {
        const conveyorBelt = document.getElementById('conveyor-belt');
        conveyorBelt.classList.remove('conveyor-belt-forward', 'conveyor-belt-reverse');

        if (direction === 'forward') {
            conveyorBelt.classList.add('conveyor-belt-forward');
        } else {
            conveyorBelt.classList.add('conveyor-belt-reverse');
        }
    }

    // Función para detener la banda transportadora
    function stopConveyor() {
        const conveyorBelt = document.getElementById('conveyor-belt');
        conveyorBelt.classList.remove('conveyor-belt-forward', 'conveyor-belt-reverse');
    }

    // Función para activar los pistones
    function startPistons() {
        const pistonAnimation = document.getElementById('piston-animation');
        pistonAnimation.classList.add('piston-active');
    }

    // Función para detener los pistones
    function stopPistons() {
        const pistonAnimation = document.getElementById('piston-animation');
        pistonAnimation.classList.remove('piston-active');
    }

    // Función para activar la empacadora
    function startPacker() {
        const packerAnimation = document.getElementById('packer-animation');
        packerAnimation.classList.add('packer-active');
    }

    // Función para detener la empacadora
    function stopPacker() {
        const packerAnimation = document.getElementById('packer-animation');
        packerAnimation.classList.remove('packer-active');
    }


    // Función para actualizar la interfaz
    function updateUI(data) {
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
            : '<i class="fas fa-play"></i> Continuar';
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
            : '<i class="fas fa-play"></i> Continuar';
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
        const robotPercent = Math.round((data.robot.gcode_line / data.robot.total_lines) * 100);
        robotProgress.style.width = robotPercent + '%';
        robotProgress.setAttribute('aria-valuenow', robotPercent);
        robotProgress.innerText = robotPercent + '%';

        if (robotPercent === 100 && previousState.robot.progress < 100) {
            addLogEntry('Robot: Código G completado al 100%', 'success');
        } else if (robotPercent === 0 && previousState.robot.progress > 0) {
            addLogEntry('Robot: Código G reiniciado', 'info');
        }
        previousState.robot.progress = robotPercent;

        document.getElementById('robot-line').innerText = data.robot.gcode_line;
        document.getElementById('robot-total-lines').innerText = data.robot.total_lines;

        const robotFoco = document.getElementById('robot-foco');
        const currentRobotState = data.robot.foco;

        // Actualizar estado de los botones Robot
        const btnRobotToggle = document.getElementById('robot-toggle');
        if (data.robot.botones.toggle !== previousState.robot.botones.toggle) {
            if (data.robot.botones.toggle) {
                btnRobotToggle.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            } else {
                btnRobotToggle.innerHTML = '<i class="fas fa-play"></i> Continuar';
            }
            previousState.robot.botones.toggle = data.robot.botones.toggle;
        }

        if (currentRobotState !== previousState.robot.foco) {
            if (currentRobotState === 'trabajando') {
                robotFoco.classList.remove('bg-secondary', 'bg-warning', 'bg-info');
                robotFoco.classList.add('bg-success');
                robotFoco.innerText = 'Trabajando';
                robotAnimation.classList.add('robot-working');
                addLogEntry('Robot: Iniciando trabajo', 'info');
                toggleOperationTimer('robot', true);
            } else if (currentRobotState === 'detenido') {
                robotFoco.classList.remove('bg-secondary', 'bg-success', 'bg-info');
                robotFoco.classList.add('bg-warning', 'text-dark');
                robotFoco.innerText = 'Detenido';
                robotAnimation.classList.remove('robot-working');
                addLogEntry('Robot: Detenido', 'warning');
                toggleOperationTimer('robot', false);
            } else if (currentRobotState === 'terminado') {
                robotFoco.classList.remove('bg-secondary', 'bg-success', 'bg-warning');
                robotFoco.classList.add('bg-info', 'text-dark');
                robotFoco.innerText = 'Terminado';
                robotAnimation.classList.remove('robot-working');
                addLogEntry('Robot: Proceso terminado', 'success');
                toggleOperationTimer('robot', false);
            } else {
                robotFoco.classList.remove('bg-success', 'bg-warning', 'bg-info');
                robotFoco.classList.add('bg-secondary');
                robotFoco.innerText = 'Desconocido';
                robotAnimation.classList.remove('robot-working');
                toggleOperationTimer('robot', false);
            }
            previousState.robot.foco = currentRobotState;
        }

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
    }

    // Función para calcular y actualizar la eficiencia general (simulada)
    function updateEfficiency() {
        const plc1Active = document.getElementById('plc1-encendido').classList.contains('bg-success');
        const plc2Active = document.getElementById('plc2-foco-trabajando').classList.contains('bg-success');
        const plc3Active = document.getElementById('plc3-foco-trabajando').classList.contains('bg-success');
        const robotActive = document.getElementById('robot-foco').classList.contains('bg-success');

        // Se cuenta cuántas máquinas están encendidas
        const activeCount = [plc1Active, plc2Active, plc3Active, robotActive].filter(Boolean).length;

        // La eficiencia se define de forma lineal: 4 encendidas = 100%, 2 = 50%, etc.
        const efficiency = ((activeCount) / 4) * 100;

        const efficiencyBar = document.getElementById('efficiency-progress');
        efficiencyBar.style.width = efficiency + '%';
        efficiencyBar.style.height = '2rem';
        efficiencyBar.innerText = efficiency + '%';

        if (efficiency > 75) {
            efficiencyBar.className = 'progress-bar bg-success';
        } else if (efficiency > 40) {
            efficiencyBar.className = 'progress-bar bg-warning';
        } else {
            efficiencyBar.className = 'progress-bar bg-danger';
        }
    }


    // Función para obtener los datos de la API
    function fetchData() {
        fetch('/api/data')
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error fetching data:', error);
                addLogEntry('Error de comunicación con el servidor', 'error');
            });
    }

    // -------- Event Listeners --------
    document.getElementById('plc1-btn-encender').addEventListener('click', function () {
        const buttonText = this.textContent.trim();
        if (buttonText.includes('Encender')) {
            this.innerHTML = '<i class="fas fa-power-off"></i> Apagar';
            addLogEntry('Comando: Encender banda transportadora', 'info');
        } else {
            this.innerHTML = '<i class="fas fa-power-off"></i> Encender';
            addLogEntry('Comando: Apagar banda transportadora', 'info');
        }
        fetch('/api/plc1/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'encender' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción encender:', error);
                addLogEntry('Error al enviar comando de encendido', 'error');
            });
    });

    document.getElementById('plc1-btn-adelante').addEventListener('click', function () {
        addLogEntry('Comando: Banda transportadora - Avance', 'info');
        fetch('/api/plc1/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'adelante' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción adelante:', error);
                addLogEntry('Error al enviar comando de avance', 'error');
            });
    });

    document.getElementById('plc1-btn-reversa').addEventListener('click', function () {
        addLogEntry('Comando: Banda transportadora - Reversa', 'info');
        fetch('/api/plc1/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reversa' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción reversa:', error);
                addLogEntry('Error al enviar comando de reversa', 'error');
            });
    });

    document.getElementById('plc2-toggle').addEventListener('click', function () {
        // Desactivar el botón temporalmente para evitar múltiples clics
        this.disabled = true;

        // Determinar el nuevo estado que queremos
        const currentState = previousState.plc2.botones.toggle;
        const newState = !currentState;

        // Log de la acción
        addLogEntry(`Comando: ${newState ? 'Activar' : 'Pausar'} revolvedora`, 'info');

        fetch('/api/plc2/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle', newState: newState })
        })
            .then(response => response.json())
            .then(data => {
                updateUI(data);
                this.disabled = false;
            })
            .catch(error => {
                console.error('Error en acción toggle PLC2:', error);
                addLogEntry('Error al enviar comando a revolvedora', 'error');
                this.disabled = false;
            });
    });

    document.getElementById('plc2-reiniciar').addEventListener('click', function () {
        addLogEntry('Comando: Reiniciar revolvedora', 'info');
        fetch('/api/plc2/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reiniciar' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción reiniciar PLC2:', error);
                addLogEntry('Error al reiniciar revolvedora', 'error');
            });
    });

    document.getElementById('plc2-skip').addEventListener('click', function () {
        addLogEntry('Comando: Skip revolvedora', 'info');
        fetch('/api/plc2/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'skip' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción skip PLC2:', error);
                addLogEntry('Error al enviar comando skip a revolvedora', 'error');
            });
    });

    document.getElementById('plc3-toggle').addEventListener('click', function () {
        const buttonText = this.textContent.trim();
        if (buttonText.includes('Pausar')) {
            this.innerHTML = '<i class="fas fa-play"></i> Continuar';
            addLogEntry('Comando: Pausar empacadora', 'info');
        } else {
            this.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            addLogEntry('Comando: Continuar empacadora', 'info');
        }
        fetch('/api/plc3/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción toggle PLC3:', error);
                addLogEntry('Error al enviar comando a empacadora', 'error');
            });
    });

    document.getElementById('plc3-reiniciar').addEventListener('click', function () {
        addLogEntry('Comando: Reiniciar empacadora', 'info');
        fetch('/api/plc3/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reiniciar' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción reiniciar PLC3:', error);
                addLogEntry('Error al reiniciar empacadora', 'error');
            });
    });

    document.getElementById('plc3-skip').addEventListener('click', function () {
        addLogEntry('Comando: Skip empacadora', 'info');
        fetch('/api/plc3/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'skip' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción skip PLC3:', error);
                addLogEntry('Error al enviar comando skip a empacadora', 'error');
            });
    });

    document.getElementById('robot-toggle').addEventListener('click', function () {
        const buttonText = this.textContent.trim();
        if (buttonText.includes('Pausar')) {
            this.innerHTML = '<i class="fas fa-play"></i> Continuar';
            addLogEntry('Comando: Pausar robot', 'info');
        } else {
            this.innerHTML = '<i class="fas fa-pause"></i> Pausar';
            addLogEntry('Comando: Continuar robot', 'info');
        }
        fetch('/api/robot/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción toggle Robot:', error);
                addLogEntry('Error al enviar comando al robot', 'error');
            });
    });

    document.getElementById('robot-reiniciar').addEventListener('click', function () {
        addLogEntry('Comando: Reiniciar robot', 'info');
        fetch('/api/robot/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reiniciar' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción reiniciar Robot:', error);
                addLogEntry('Error al reiniciar robot', 'error');
            });
    });

    document.getElementById('robot-skip').addEventListener('click', function () {
        addLogEntry('Comando: Skip robot', 'info');
        fetch('/api/robot/button', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'skip' })
        })
            .then(response => response.json())
            .then(data => updateUI(data))
            .catch(error => {
                console.error('Error en acción skip Robot:', error);
                addLogEntry('Error al enviar comando skip al robot', 'error');
            });
    });

    document.getElementById('clear-log').addEventListener('click', function () {
        logContainer.innerHTML = '';
        addLogEntry('Log limpiado por el usuario', 'info');
        previousLog = [];
    });

    // Actualizar la interfaz cada 1000 milisegundos (1 segundo)
    setInterval(fetchData, 1000);
});