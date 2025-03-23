from flask import Flask, jsonify, render_template, request
import json
#from opcua import Client
import logging

app = Flask(__name__)
DB_FILE = 'db.json'

# Configuración básica de logging
logging.basicConfig(level=logging.INFO)

def read_db():
    with open(DB_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# ============================================
# Sección OPC UA comentada para futura implementación
# opcua_url = "opc.tcp://direccion_del_plc:4840"  # Reemplaza con la dirección real de tu PLC o servidor OPC UA
# opcua_client = Client(opcua_url)
#
# try:
#     opcua_client.connect()
#     logging.info("Conexión OPC UA establecida")
# except Exception as e:
#     logging.error("Error conectando OPC UA: %s", e)
# ============================================

def opcua_set_value(node_id, value):
    """
    Envía el valor especificado al nodo OPC UA indicado.
    (Actualmente comentado, se simula una respuesta exitosa)
    """
    # try:
    #     node = opcua_client.get_node(node_id)
    #     node.set_value(value)
    #     return True
    # except Exception as e:
    #     logging.error("Error al escribir en el nodo %s: %s", node_id, e)
    #     return False
    return True

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data', methods=['GET'])
def get_data():
    data = read_db()
    return jsonify(data)

@app.route('/api/update', methods=['POST'])
def update_data():
    update = request.get_json()
    data = read_db()
    for key, value in update.items():
        if key in data:
            data[key] = value
    write_db(data)
    return jsonify({"status": "success"})

@app.route('/api/plc1/button', methods=['POST'])
def plc1_button():
    update = request.get_json()
    action = update.get('action')
    data = read_db()
    plc1 = data.get('plc1', {})

    # Aseguramos la estructura necesaria
    if 'focos' not in plc1:
        plc1['focos'] = {'encendido': False, 'adelante': False, 'reversa': False}
    if 'state' not in plc1:
        plc1['state'] = "En espera"

    log_entry = ""
    if action == 'encender':
        nuevo_estado = not plc1['focos']['encendido']
        plc1['focos']['encendido'] = nuevo_estado
        if nuevo_estado:
            plc1['state'] = "Encendido"
            # Envía el comando OPC UA para encender (actualiza el nodo según corresponda)
            if opcua_set_value("ns=2;s=PLC1.Encender", nuevo_estado):
                log_entry = "PLC1: Encendido activado"
            else:
                log_entry = "PLC1: Error al enviar comando OPC UA para encender"
        else:
            plc1['state'] = "En espera"
            # Al apagar, se desactivan las direcciones
            plc1['focos']['adelante'] = False
            plc1['focos']['reversa'] = False
            if opcua_set_value("ns=2;s=PLC1.Encender", nuevo_estado):
                log_entry = "PLC1: Encendido desactivado"
            else:
                log_entry = "PLC1: Error al enviar comando OPC UA para apagar"
    elif action == 'adelante':
        if plc1['focos']['encendido']:
            nuevo_estado = not plc1['focos']['adelante']
            plc1['focos']['adelante'] = nuevo_estado
            if nuevo_estado:
                plc1['focos']['reversa'] = False
                plc1['state'] = "Adelante"
                if opcua_set_value("ns=2;s=PLC1.Adelante", nuevo_estado):
                    log_entry = "PLC1: Dirección puesta a Adelante"
                else:
                    log_entry = "PLC1: Error al enviar comando OPC UA para avanzar"
            else:
                plc1['state'] = "Encendido"
                if opcua_set_value("ns=2;s=PLC1.Adelante", nuevo_estado):
                    log_entry = "PLC1: Dirección Adelante desactivada"
                else:
                    log_entry = "PLC1: Error al enviar comando OPC UA para detener avance"
        else:
            log_entry = "PLC1: No se puede cambiar dirección, sistema apagado"
    elif action == 'reversa':
        if plc1['focos']['encendido']:
            nuevo_estado = not plc1['focos']['reversa']
            plc1['focos']['reversa'] = nuevo_estado
            if nuevo_estado:
                plc1['focos']['adelante'] = False
                plc1['state'] = "Reversa"
                if opcua_set_value("ns=2;s=PLC1.Reversa", nuevo_estado):
                    log_entry = "PLC1: Dirección puesta a Reversa"
                else:
                    log_entry = "PLC1: Error al enviar comando OPC UA para reversa"
            else:
                plc1['state'] = "Encendido"
                if opcua_set_value("ns=2;s=PLC1.Reversa", nuevo_estado):
                    log_entry = "PLC1: Dirección Reversa desactivada"
                else:
                    log_entry = "PLC1: Error al enviar comando OPC UA para detener reversa"
        else:
            log_entry = "PLC1: No se puede cambiar dirección, sistema apagado"
    else:
        return jsonify({"status": "error", "message": "Acción desconocida"}), 400

    # Actualizar el log en la base de datos
    if 'log' not in data:
        data['log'] = []
    data['log'].append(log_entry)
    write_db(data)
    return jsonify(data)


@app.route('/api/plc2/button', methods=['POST'])
def plc2_button():
    update = request.get_json()
    action = update.get('action')
    data = read_db()
    plc2 = data.get('plc2', {})
    log_entry = ""
    
    if action == 'toggle':
        current = plc2.get('focos', {}).get('trabajando', False)
        plc2['focos']['trabajando'] = not current
        log_entry = "Revolvedora: Trabajo " + ("iniciado" if not current else "pausado")
    elif action == 'reiniciar':
        plc2['progress'] = 0
        log_entry = "Revolvedora: Proceso reiniciado"
    elif action == 'skip':
        plc2['progress'] = 100
        log_entry = "Revolvedora: Proceso completado (skip)"
    else:
        return jsonify({"status": "error", "message": "Acción desconocida"}), 400

    # Remover la clave 'detenido' si existe, ya que no se usará
    if 'focos' in plc2 and 'detenido' in plc2['focos']:
        del plc2['focos']['detenido']
    
    if 'log' not in data:
        data['log'] = []
    data['log'].append(log_entry)
    write_db(data)
    return jsonify(data)


@app.route('/api/plc3/button', methods=['POST'])
def plc3_button():
    update = request.get_json()
    action = update.get('action')
    data = read_db()
    plc3 = data.get('plc3', {})
    log_entry = ""
    
    if action == 'toggle':
        current = plc3.get('focos', {}).get('trabajando', False)
        plc3['focos']['trabajando'] = not current
        log_entry = "Empacadora: Trabajo " + ("iniciado" if not current else "pausado")
    elif action == 'reiniciar':
        plc3['progress'] = 0
        log_entry = "Empacadora: Proceso reiniciado"
    elif action == 'skip':
        plc3['progress'] = 100
        log_entry = "Empacadora: Proceso completado (skip)"
    else:
        return jsonify({"status": "error", "message": "Acción desconocida"}), 400

    # Remover la clave 'detenido' si existe, ya que no se usará
    if 'focos' in plc3 and 'detenido' in plc3['focos']:
        del plc3['focos']['detenido']
    
    if 'log' not in data:
        data['log'] = []
    data['log'].append(log_entry)
    write_db(data)
    return jsonify(data)


@app.route('/api/robot/button', methods=['POST'])
def robot_button():
    update = request.get_json()
    action = update.get('action')
    data = read_db()
    robot = data.get('robot', {})
    log_entry = ""
    
    if action == 'toggle':
        # Aquí se podría simular una pausa o reanudación del trabajo
        current_state = robot.get('foco', 'trabajando')
        new_state = 'detenido' if current_state == 'trabajando' else 'trabajando'
        robot['foco'] = new_state
        log_entry = "Robot: " + ("Detenido" if new_state == 'detenido' else "Iniciando trabajo")
    elif action == 'reiniciar':
        robot['gcode_line'] = 0
        log_entry = "Robot: Proceso reiniciado"
    elif action == 'skip':
        robot['gcode_line'] = robot.get('total_lines', 100)
        log_entry = "Robot: Proceso completado (skip)"
    else:
        return jsonify({"status": "error", "message": "Acción desconocida"}), 400

    if 'log' not in data:
        data['log'] = []
    data['log'].append(log_entry)
    write_db(data)
    return jsonify(data)

@app.route('/api/robot/button', methods=['POST'], endpoint='robot_button_toggle')
def robot_button_toggle():
    update = request.get_json()
    action = update.get('action')
    data = read_db()
    robot = data.get('robot', {})
    log_entry = ""
    
    if action == 'toggle':
        # Aquí se podría simular una pausa o reanudación del trabajo
        current_state = robot.get('foco', 'trabajando')
        new_state = 'detenido' if current_state == 'trabajando' else 'trabajando'
        robot['foco'] = new_state
        log_entry = "Robot: " + ("Detenido" if new_state == 'detenido' else "Iniciando trabajo")
    elif action == 'reiniciar':
        robot['gcode_line'] = 0
        log_entry = "Robot: Proceso reiniciado"
    elif action == 'skip':
        robot['gcode_line'] = robot.get('total_lines', 100)
        log_entry = "Robot: Proceso completado (skip)"
    else:
        return jsonify({"status": "error", "message": "Acción desconocida"}), 400

    if 'log' not in data:
        data['log'] = []
    data['log'].append(log_entry)
    write_db(data)
    return jsonify(data)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

