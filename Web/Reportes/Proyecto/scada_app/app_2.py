from flask import Flask, jsonify, session, redirect, url_for, request, render_template
import json
import socket
import qrcode
import io
import base64
import logging
import os
import snap7_bridge as snap7_bridge
import threading

app = Flask(__name__)
DB_FILE = 'Web/Reportes/Proyecto/scada_app/db.json'
app.secret_key = 'ibhv98iurbiubvireb56548956+89'

# Configuración básica de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("flask_app.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("flask_app")

# Semáforo para sincronizar acceso al archivo JSON desde Flask
json_lock = threading.Lock()

def read_db():
    """
    Lee los datos del archivo JSON utilizando la función mejorada de snap7_bridge
    para evitar duplicación de código y asegurar consistencia.
    """
    return snap7_bridge.read_db_json()

def write_db(data):
    """
    Escribe los datos al archivo JSON utilizando la función mejorada de snap7_bridge
    para evitar duplicación de código y asegurar consistencia.
    """
    return snap7_bridge.write_db_json(data)

def add_log_entry(message):
    """
    Añade una entrada al log utilizando la función de snap7_bridge
    """
    return snap7_bridge.add_log_entry(message)

def get_server_ip():
    """
    Obtiene la IP local del servidor para conexiones LAN.
    Se conecta a un servidor público (8.8.8.8) para determinar la IP de salida.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception as e:
        logger.error(f"Error obteniendo IP: {e}")
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
            logger.info(f"Usuario {usuario} ha iniciado sesión")
            return redirect(url_for('index'))
        else:
            logger.warning(f"Intento de login fallido para usuario: {usuario}")
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
    try:
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
    except Exception as e:
        logger.error(f"Error generando QR: {e}")
        qr_image = ""

    # Pasa las variables al template index.html
    return render_template("index.html", repo_link=repo_link, dashboard_link=dashboard_link, qr_image=qr_image)

@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        data = read_db()
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error en get_data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/update', methods=['POST'])
def update_data():
    try:
        update = request.get_json()
        if not update:
            return jsonify({"status": "error", "message": "Datos JSON no válidos"}), 400
            
        data = read_db()
        for key, value in update.items():
            if key in data:
                data[key] = value
        
        write_db(data)
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error en update_data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/plc1/button', methods=['POST'])
def plc1_button():
    try:
        update = request.get_json()
        if not update:
            return jsonify({"status": "error", "message": "Datos JSON no válidos"}), 400
            
        action = update.get('action')
        if not action:
            return jsonify({"status": "error", "message": "Acción no especificada"}), 400
        
        # Procesar la acción a través del bridge de Snap7
        logger.info(f"Procesando acción PLC1: {action}")
        success = snap7_bridge.process_action("plc1", action)
        
        # Leer los datos actualizados
        data = read_db()
        
        if not success:
            logger.warning(f"Error al procesar acción PLC1: {action}")
            return jsonify({"status": "error", "message": f"Error al procesar acción {action}"}), 400
        
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error en plc1_button: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/plc2/button', methods=['POST'])
def plc2_button():
    try:
        update = request.get_json()
        if not update:
            return jsonify({"status": "error", "message": "Datos JSON no válidos"}), 400
            
        action = update.get('action')
        if not action:
            return jsonify({"status": "error", "message": "Acción no especificada"}), 400
        
        # Procesar la acción a través del bridge de Snap7
        logger.info(f"Procesando acción PLC2: {action}")
        success = snap7_bridge.process_action("plc2", action)
        
        # Leer los datos actualizados
        data = read_db()
        
        if not success:
            logger.warning(f"Error al procesar acción PLC2: {action}")
            return jsonify({"status": "error", "message": f"Error al procesar acción {action}"}), 400
        
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error en plc2_button: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/plc3/button', methods=['POST'])
def plc3_button():
    try:
        update = request.get_json()
        if not update:
            return jsonify({"status": "error", "message": "Datos JSON no válidos"}), 400
            
        action = update.get('action')
        if not action:
            return jsonify({"status": "error", "message": "Acción no especificada"}), 400
        
        # Procesar la acción a través del bridge de Snap7
        logger.info(f"Procesando acción PLC3: {action}")
        success = snap7_bridge.process_action("plc3", action)
        
        # Leer los datos actualizados
        data = read_db()
        
        if not success:
            logger.warning(f"Error al procesar acción PLC3: {action}")
            return jsonify({"status": "error", "message": f"Error al procesar acción {action}"}), 400
        
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error en plc3_button: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/robot/button', methods=['POST'])
def robot_button():
    try:
        update = request.get_json()
        if not update:
            return jsonify({"status": "error", "message": "Datos JSON no válidos"}), 400
            
        action = update.get('action')
        if not action:
            return jsonify({"status": "error", "message": "Acción no especificada"}), 400
        
        # Utilizamos el módulo snap7_bridge para interactuar con el PLC3
        logger.info(f"Procesando acción Robot: {action}")
        success = snap7_bridge.process_action("robot", action)
        
        # Leer los datos actualizados
        data = read_db()
        
        if not success:
            logger.warning(f"Error al procesar acción Robot: {action}")
            return jsonify({"status": "error", "message": f"Error al procesar acción {action}"}), 400
        
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error en robot_button: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500



# @app.route('/api/robot/button', methods=['POST'])
# def robot_button():
#     try:
#         update = request.get_json()
#         if not update:
#             return jsonify({"status": "error", "message": "Datos JSON no válidos"}), 400
            
#         action = update.get('action')
#         if not action:
#             return jsonify({"status": "error", "message": "Acción no especificada"}), 400
        
#         # Utilizamos el semáforo para evitar problemas de concurrencia
#         data = read_db()
        
#         # Asegurarse de que la estructura sea correcta
#         if 'robot' not in data:
#             data['robot'] = {'foco': 'detenido', 'gcode_line': 0, 'total_lines': 100}
        
#         robot = data.get('robot', {})
#         log_entry = ""
        
#         if action == 'toggle':
#             current_state = robot.get('foco', 'detenido')
#             new_state = 'detenido' if current_state == 'trabajando' else 'trabajando'
#             robot['foco'] = new_state
#             log_entry = "Robot: " + ("Detenido" if new_state == 'detenido' else "Iniciando trabajo")
#         elif action == 'reiniciar':
#             robot['gcode_line'] = 0
#             log_entry = "Robot: Proceso reiniciado"
#         elif action == 'skip':
#             robot['gcode_line'] = robot.get('total_lines', 100)
#             log_entry = "Robot: Proceso completado (skip)"
#         else:
#             return jsonify({"status": "error", "message": "Acción desconocida"}), 400

#         data['robot'] = robot
#         write_db(data)
        
#         # Añadir log usando la función de snap7_bridge
#         if log_entry:
#             snap7_bridge.add_log_entry(log_entry)
        
#         return jsonify(data)
#     except Exception as e:
#         logger.error(f"Error en robot_button: {e}")
#         return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    logger.info("Usuario desconectado")
    return redirect(url_for('login'))

# Inicializar el bridge de Snap7 al iniciar la aplicación
polling_thread = None

@app.route('/initialize_snap7')
def initialize_snap7_route():
    global polling_thread
    try:
        if polling_thread is None:
            initialize_snap7()
            return jsonify({"status": "success", "message": "Snap7 inicializado correctamente"})
        return jsonify({"status": "success", "message": "Snap7 ya estaba inicializado"})
    except Exception as e:
        logger.error(f"Error al inicializar Snap7: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

def initialize_snap7():
    global polling_thread
    try:
        polling_thread = snap7_bridge.initialize()
        logger.info("Snap7 inicializado y sondeo iniciado")
    except Exception as e:
        logger.error(f"Error al inicializar Snap7: {e}")
        raise

# Registrar la función para que se ejecute una vez al iniciar
# Desde Flask 2.3.0, before_first_request está obsoleto
# Usamos with app.app_context() para ejecutar código de inicialización
# Esta parte se ejecutará cuando se importe el módulo
with app.app_context():
    try:
        initialize_snap7()
        # Asegurar que la estructura del JSON sea correcta desde el inicio
        data = read_db()
        write_db(data)  # Esto verificará y reparará la estructura si es necesario
        logger.info("Inicialización completada correctamente")
    except Exception as e:
        logger.error(f"Error en la inicialización: {e}")

# Asegurar que las conexiones se cierren al detener la aplicación
import atexit

@atexit.register
def shutdown_snap7():
    try:
        snap7_bridge.shutdown()
        logger.info("Conexiones Snap7 cerradas")
    except Exception as e:
        logger.error(f"Error al cerrar conexiones Snap7: {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)  # Cambiar debug a False en producción