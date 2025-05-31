from flask import Flask, jsonify, session, redirect, url_for, request, render_template, Response
import json
import socket
import qrcode
import io
import base64
import logging
import os
import snap7_bridge as snap7_bridge
import threading
import time
import cv2
import atexit

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

# Variables globales para la webcam
camera = None
output_frame = None
camera_lock = threading.Lock()
camera_thread = None
camera_active = False

def read_db():
    """
    Lee los datos del archivo JSON utilizando la función de snap7_bridge
    """
    return snap7_bridge.read_db_json()

def write_db(data):
    """
    Escribe los datos al archivo JSON
    """
    return snap7_bridge.write_db_json(data)

def add_log_entry(message):
    """
    Añade una entrada al log
    """
    return snap7_bridge.add_log_entry(message)

def get_server_ip():
    """
    Obtiene la IP local del servidor para conexiones LAN.
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

def initialize_camera():
    """
    Inicializa la cámara web
    """
    global camera
    camera = cv2.VideoCapture(0)
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1080)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    time.sleep(2.0)  # Permitir que la cámara se inicie
    logger.info("Cámara inicializada")

def release_camera():
    """
    Libera los recursos de la cámara
    """
    global camera, camera_active
    camera_active = False
    if camera is not None:
        camera.release()
        camera = None
    logger.info("Cámara liberada")

def camera_thread_function():
    """
    Función para el hilo de la cámara que captura frames
    """
    global camera, output_frame, camera_lock, camera_active
    
    logger.info("Hilo de la cámara iniciado")
    
    while camera_active:
        if camera is None or not camera.isOpened():
            time.sleep(0.1)
            continue
            
        success, frame = camera.read()
        if not success:
            time.sleep(0.1)
            continue
            
        # Actualizar el último frame capturado
        with camera_lock:
            # Codificar el frame como JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            if ret:
                output_frame = buffer.tobytes()
            
        # Una pequeña pausa para no sobrecargar el CPU
        time.sleep(0.03)
    
    logger.info("Hilo de la cámara detenido")

def generate_frames():
    """
    Generador para streaming de video
    """
    global output_frame, camera_lock
    
    while True:
        with camera_lock:
            if output_frame is None:
                time.sleep(0.1)
                continue
            frame_data = output_frame
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')
        
        # Pequeña pausa para no sobrecargar la red
        time.sleep(0.03)

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        usuario = request.form.get('username')
        contrasena = request.form.get('password')
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
    repo_link = "https://jphajp.github.io/Simens_PLC_Comms/"

    # Obtiene la IP del servidor y forma el enlace del dashboard
    server_ip = get_server_ip()
    #dashboard_link = f"http://{server_ip}:5000"
    dashboard_link = f"https://plc.postretogourmet.com"

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
        
        # Utilizamos el módulo snap7_bridge para interactuar con el robot
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

@app.route('/video_feed')
def video_feed():
    """
    Ruta para transmitir el video de la webcam
    """
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    # Iniciar la cámara si no está activa
    start_camera()
    
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

def start_camera():
    """
    Inicia la cámara y el hilo de captura si no están activos
    """
    global camera, camera_active, camera_thread
    
    with camera_lock:
        if not camera_active:
            camera_active = True
            
            if camera is None:
                initialize_camera()
            
            if camera_thread is None or not camera_thread.is_alive():
                camera_thread = threading.Thread(target=camera_thread_function)
                camera_thread.daemon = True
                camera_thread.start()
            
            logger.info("Webcam iniciada")
            add_log_entry("Sistema: Webcam iniciada")

@app.route('/api/webcam/capture', methods=['GET'])
def capture_image():
    """
    Captura una imagen de la webcam
    """
    global output_frame
    
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    try:
        # Asegurar que la cámara esté activa
        start_camera()
        
        with camera_lock:
            if output_frame is None:
                return jsonify({"status": "error", "message": "No hay imagen disponible para capturar"}), 400
            
            # Hacer una copia del último frame
            image_data = output_frame
            
        # Convertir a base64 para enviar al cliente
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        logger.info("Imagen capturada de la webcam")
        add_log_entry("Sistema: Imagen capturada de la webcam")
        
        return jsonify({
            "status": "success", 
            "image": f"data:image/jpeg;base64,{image_base64}"
        })
    except Exception as e:
        logger.error(f"Error al capturar imagen: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
    
# Añadir estas rutas para el manejo de la webcam

@app.route('/api/webcam/status', methods=['GET'])
def webcam_status():
    """
    Devuelve el estado actual de la webcam
    """
    global camera_active
    
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    try:
        return jsonify({
            "status": "success", 
            "active": camera_active
        })
    except Exception as e:
        logger.error(f"Error al verificar estado de la webcam: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/webcam/start', methods=['POST'])
def start_webcam():
    """
    Inicia la webcam
    """
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    try:
        # Iniciar la cámara si no está activa
        start_camera()
        
        logger.info("Webcam iniciada por solicitud de usuario")
        add_log_entry("Sistema: Webcam iniciada por usuario")
        
        return jsonify({
            "status": "success"
        })
    except Exception as e:
        logger.error(f"Error al iniciar webcam: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/webcam/stop', methods=['POST'])
def stop_webcam():
    """
    Detiene la webcam
    """
    global camera_active
    
    if not session.get('logged_in'):
        return jsonify({"status": "error", "message": "No autorizado"}), 401
    
    try:
        # Liberar la cámara
        release_camera()
        
        logger.info("Webcam detenida por solicitud de usuario")
        add_log_entry("Sistema: Webcam detenida por usuario")
        
        return jsonify({
            "status": "success"
        })
    except Exception as e:
        logger.error(f"Error al detener webcam: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    logger.info("Usuario desconectado")
    return redirect(url_for('login'))

# Inicializar el bridge de Snap7 al iniciar la aplicación
polling_thread = None

def initialize_snap7():
    global polling_thread
    try:
        polling_thread = snap7_bridge.initialize()
        logger.info("Snap7 inicializado y sondeo iniciado")
    except Exception as e:
        logger.error(f"Error al inicializar Snap7: {e}")
        raise

@atexit.register
def shutdown_app():
    try:
        # Cierre de Snap7
        snap7_bridge.shutdown()
        logger.info("Conexiones Snap7 cerradas")
        
        # Cierre de la webcam
        release_camera()
    except Exception as e:
        logger.error(f"Error al cerrar recursos: {e}")

# Inicialización al arrancar la aplicación
with app.app_context():
    try:
        initialize_snap7()
        # Asegurar que la estructura del JSON sea correcta desde el inicio
        data = read_db()
        write_db(data)  # Esto verificará y reparará la estructura si es necesario
        logger.info("Inicialización completada correctamente")
    except Exception as e:
        logger.error(f"Error en la inicialización: {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)  # Cambiar debug a False en producción