from flask import Flask, jsonify, session, redirect, url_for, request, render_template
import json
import socket
import qrcode
import io
import base64
import logging
import os
import snap7_bridge as snap7_bridge

app = Flask(__name__)
DB_FILE = 'Web/Reportes/Proyecto/scada_app/db.json'
app.secret_key = 'ibhv98iurbiubvireb56548956+89'

# Configuración básica de logging
logging.basicConfig(level=logging.INFO)

def read_db():
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Error al leer DB: {e}")
        return {}

def write_db(data):
    try:
        os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        logging.error(f"Error al escribir DB: {e}")

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
    
    # Procesar la acción a través del bridge de Snap7
    success = snap7_bridge.process_action("plc1", action)
    
    # Leer los datos actualizados
    data = read_db()
    
    if not success:
        return jsonify({"status": "error", "message": f"Error al procesar acción {action}"}), 400
    
    return jsonify(data)

@app.route('/api/plc2/button', methods=['POST'])
def plc2_button():
    update = request.get_json()
    action = update.get('action')
    
    # Procesar la acción a través del bridge de Snap7
    success = snap7_bridge.process_action("plc2", action)
    
    # Leer los datos actualizados
    data = read_db()
    
    if not success:
        return jsonify({"status": "error", "message": f"Error al procesar acción {action}"}), 400
    
    return jsonify(data)

@app.route('/api/plc3/button', methods=['POST'])
def plc3_button():
    update = request.get_json()
    action = update.get('action')
    
    # Procesar la acción a través del bridge de Snap7
    success = snap7_bridge.process_action("plc3", action)
    
    # Leer los datos actualizados
    data = read_db()
    
    if not success:
        return jsonify({"status": "error", "message": f"Error al procesar acción {action}"}), 400
    
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

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

# Inicializar el bridge de Snap7 al iniciar la aplicación
polling_thread = None

# Reemplaza before_first_request con un decorador de evento
@app.route('/initialize_snap7')
def initialize_snap7_route():
    return "Snap7 initialized"

def initialize_snap7():
    global polling_thread
    polling_thread = snap7_bridge.initialize()
    logging.info("Snap7 inicializado y sondeo iniciado")

# Registrar la función para que se ejecute una vez al iniciar
with app.app_context():
    initialize_snap7()

# Asegurar que las conexiones se cierren al detener la aplicación
import atexit

@atexit.register
def shutdown_snap7():
    snap7_bridge.shutdown()
    logging.info("Conexiones Snap7 cerradas")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)