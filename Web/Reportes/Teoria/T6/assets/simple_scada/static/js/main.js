document.addEventListener('DOMContentLoaded', function() {
    const focoElement = document.getElementById('foco');
    const toggleButton = document.getElementById('toggleFoco');

    // Actualiza la apariencia del foco según su estado (encendido/apagado)
    function updateFoco(state) {
        if (state) {
            focoElement.classList.remove('apagado');
            focoElement.classList.add('encendido');
        } else {
            focoElement.classList.remove('encendido');
            focoElement.classList.add('apagado');
        }
    }

    // Consulta la API para obtener el estado actual del foco
    function fetchData() {
        fetch('/api/data')
            .then(response => response.json())
            .then(data => {
                updateFoco(data.foco);
                console.log("Estado recibido de la API:", data.foco);
            })
            .catch(error => console.error("Error al obtener datos:", error));
    }

    // Realiza una consulta cada 2 segundos para mantener la información actualizada
    setInterval(fetchData, 2000);
    fetchData();

    // Al hacer clic en el botón se envía el nuevo estado (se invierte el actual)
    toggleButton.addEventListener('click', function() {
        const currentState = focoElement.classList.contains('encendido');
        const newState = !currentState;
        fetch('/api/foco', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({foco: newState})
        })
        .then(response => response.json())
        .then(data => {
            updateFoco(data.foco);
            console.log("Estado actualizado a:", data.foco);
        })
        .catch(error => console.error("Error al actualizar estado:", error));
    });
});
