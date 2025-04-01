from flask import Flask, jsonify, session, redirect, url_for, request, render_template
import json
import socket
import qrcode
import io
import base64
import logging

app = Flask(__name__)
DB_FILE = 'db.json'
app.secret_key = 'ibhv98iurbiubvireb56548956+89'

# Configuración básica de logging
logging.basicConfig(level=logging.INFO)

def read_db():
    with open(DB_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def get_server_ip():
    """
    Obtiene la IP local del servidor para conexiones LAN.
    Se conecta a un servidor público (8.8.8.8) para determinar la IP de salida.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        usuario = request.form.get('username')
        contrasena = request.form.get('password')
        # Aquí defines tu lógica de autenticación; este es un ejemplo sencillo:
        if usuario == 'admin' and contrasena == 'admin':
            session['logged_in'] = True
            return redirect(url_for('index'))
        else:
            error = 'Credenciales inválidas. Inténtalo de nuevo.'
    return render_template('login.html', error=error)


@app.route('/')
def index():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    # Define el enlace a tu repositorio en GitHub
    repo_link = "https://jphajp.github.io/Simens_PLC_Comms/"  # Actualiza esta URL

    # Obtiene la IP del servidor y forma el enlace del dashboard
    server_ip = get_server_ip()
    dashboard_link = f"http://{server_ip}:5000"

    # Genera el código QR para el dashboard
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(dashboard_link)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    # Convierte la imagen a base64 para incrustarla en HTML
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    qr_image = f"data:image/png;base64,{img_str}"

    # Pasa las variables al template index.html
    return render_template("index.html", repo_link=repo_link, dashboard_link=dashboard_link, qr_image=qr_image)

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
            if opcua_set_value("ns=2;s=PLC1.Encender", nuevo_estado):
                log_entry = "PLC1: Encendido activado"
            else:
                log_entry = "PLC1: Error al enviar comando OPC UA para encender"
        else:
            plc1['state'] = "En espera"
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

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))


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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
