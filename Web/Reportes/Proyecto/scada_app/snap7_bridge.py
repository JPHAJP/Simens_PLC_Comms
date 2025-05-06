from snap7 import Client
from snap7.util import get_bool, set_bool, get_int, set_int, get_uint, set_uint
import json
import logging
import time
import threading
import os

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("snap7_bridge.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("snap7_bridge")

# Ruta al archivo DB JSON
DB_FILE = 'Web/Reportes/Proyecto/scada_app/db.json'

# Definición de PLCs
PLCS = [
    {'name': 'PLC1', 'ip': '192.168.0.1', 'rack': 0, 'slot': 1},
    {'name': 'PLC2', 'ip': '192.168.0.2', 'rack': 0, 'slot': 1},
    {'name': 'PLC3', 'ip': '192.168.0.4', 'rack': 0, 'slot': 1}
]

# Mapeo de definición de datos de los PLCs
PLC_DATA_MAPPING = {
    "PLC1": {
        "db": 2,
        "variables": {
            "encendido": {"type": "bool", "byte": 0, "bit": 0, "read_write": True},
            "modo": {"type": "uint", "byte": 2, "read_write": True}  # 0=off, 1=adelante, 2=reversa
        }
    },
    "PLC2": {
        "db": 5,
        "variables": {
            "deteccion": {"type": "bool", "byte": 0, "bit": 0, "read_write": False},
            "comando": {"type": "uint", "byte": 2, "read_write": True},  # 0=normal, 1=reset, 2=skip
            "encendido": {"type": "bool", "byte": 4, "bit": 0, "read_write": True},
            "progreso": {"type": "int", "byte": 6, "read_write": False}  # 0-20 (convertir a %)
        }
    },
    "PLC3": {
        "db": 3,
        "variables": {
            "encendido": {"type": "bool", "byte": 0, "bit": 0, "read_write": True},
            "comando": {"type": "uint", "byte": 2, "read_write": True},  # 0=normal, 1=reset, 2=skip
            "deteccion": {"type": "bool", "byte": 4, "bit": 0, "read_write": False},
            "progreso": {"type": "int", "byte": 6, "read_write": False}  # 0-20 (convertir a %)
        }
    }
}

# Clientes Snap7 conectados
plc_clients = {}

# Semáforo para sincronizar acceso al archivo JSON
json_lock = threading.Lock()

def read_db_json():
    """Lee los datos del archivo JSON"""
    with json_lock:
        try:
            if os.path.exists(DB_FILE):
                with open(DB_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                # Crear estructura básica si no existe
                default_data = {
                    "plc1": {
                        "state": "En espera",
                        "focos": {"encendido": False, "adelante": False, "reversa": False}
                    },
                    "plc2": {
                        "progress": 0,
                        "focos": {"deteccion": False, "trabajando": False}
                    },
                    "plc3": {
                        "progress": 0,
                        "focos": {"deteccion": False, "trabajando": False}
                    },
                    "log": []
                }
                write_db_json(default_data)
                return default_data
        except Exception as e:
            logger.error(f"Error al leer JSON: {e}")
            return {}

def write_db_json(data):
    """Escribe los datos al archivo JSON"""
    with json_lock:
        try:
            os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
            with open(DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
        except Exception as e:
            logger.error(f"Error al escribir JSON: {e}")

def add_log_entry(message):
    """Añade una entrada al log en el archivo JSON"""
    data = read_db_json()
    if 'log' not in data:
        data['log'] = []
    data['log'].append(message)
    # Mantener solo las últimas 100 entradas
    if len(data['log']) > 100:
        data['log'] = data['log'][-100:]
    write_db_json(data)

def connect_plc(plc_config):
    """Conecta al PLC con los parámetros proporcionados"""
    client = Client()
    try:
        client.connect(plc_config['ip'], plc_config['rack'], plc_config['slot'])
        logger.info(f"Conectado a {plc_config['name']} ({plc_config['ip']})")
        return client
    except Exception as e:
        logger.error(f"Error conectando a {plc_config['name']} ({plc_config['ip']}): {e}")
        return None

def disconnect_plc(plc_name):
    """Desconecta el PLC especificado"""
    if plc_name in plc_clients and plc_clients[plc_name]:
        try:
            plc_clients[plc_name].disconnect()
            logger.info(f"Desconectado de {plc_name}")
        except Exception as e:
            logger.error(f"Error al desconectar {plc_name}: {e}")
        plc_clients[plc_name] = None

def connect_all_plcs():
    """Conecta a todos los PLCs definidos"""
    for plc_config in PLCS:
        plc_clients[plc_config['name']] = connect_plc(plc_config)

def disconnect_all_plcs():
    """Desconecta todos los PLCs"""
    for plc_name in plc_clients:
        disconnect_plc(plc_name)

def read_plc_data(plc_name):
    """Lee todos los datos configurados del PLC especificado y actualiza el JSON"""
    if plc_name not in plc_clients or not plc_clients[plc_name]:
        logger.warning(f"Cliente {plc_name} no conectado")
        return False
    
    client = plc_clients[plc_name]
    mapping = PLC_DATA_MAPPING.get(plc_name)
    if not mapping:
        logger.error(f"No hay mapeo definido para {plc_name}")
        return False
    
    try:
        db_num = mapping["db"]
        data = read_db_json()
        
        # PLC específico - determinar qué clave usar (plc1, plc2, plc3)
        json_key = plc_name.lower()
        
        # Leer variables
        for var_name, var_config in mapping["variables"].items():
            var_type = var_config["type"]
            byte_offset = var_config["byte"]
            
            if var_type == "bool":
                bit_offset = var_config["bit"]
                # Lee 1 byte para un bool
                buffer = client.db_read(db_num, byte_offset, 1)
                value = get_bool(buffer, 0, bit_offset)
                
                # Actualizar JSON según la variable
                if plc_name == "PLC1":
                    if var_name == "encendido":
                        data[json_key]["focos"]["encendido"] = value
                        if value:
                            data[json_key]["state"] = "Encendido"
                        else:
                            data[json_key]["state"] = "En espera"
                            data[json_key]["focos"]["adelante"] = False
                            data[json_key]["focos"]["reversa"] = False
                elif plc_name == "PLC2":
                    if var_name == "deteccion":
                        data[json_key]["focos"]["deteccion"] = value
                    elif var_name == "encendido":
                        data[json_key]["focos"]["trabajando"] = value
                elif plc_name == "PLC3":
                    if var_name == "encendido":
                        data[json_key]["focos"]["trabajando"] = value
                    elif var_name == "deteccion":
                        data[json_key]["focos"]["deteccion"] = value
                
                logger.debug(f"{plc_name}.{var_name} (bool) = {value}")
            
            elif var_type == "int":
                # Lee 2 bytes para un int
                buffer = client.db_read(db_num, byte_offset, 2)
                value = get_int(buffer, 0)
                
                # Actualizar JSON según la variable
                if var_name == "progreso":
                    # Convertir de 0-20 a porcentaje (0-100)
                    percentage = min(100, max(0, int(value * 5)))
                    data[json_key]["progress"] = percentage
                
                logger.debug(f"{plc_name}.{var_name} (int) = {value}")
            
            elif var_type == "uint":
                # Lee 2 bytes para un uint
                buffer = client.db_read(db_num, byte_offset, 2)
                value = get_uint(buffer, 0)
                
                # Actualizar JSON según la variable
                if plc_name == "PLC1" and var_name == "modo":
                    # Modo: 0=off, 1=adelante, 2=reversa
                    data[json_key]["focos"]["adelante"] = (value == 1)
                    data[json_key]["focos"]["reversa"] = (value == 2)
                    if value == 1:
                        data[json_key]["state"] = "Adelante"
                    elif value == 2:
                        data[json_key]["state"] = "Reversa"
                
                logger.debug(f"{plc_name}.{var_name} (uint) = {value}")
        
        # Guardar cambios en el JSON
        write_db_json(data)
        return True
    
    except Exception as e:
        logger.error(f"Error leyendo datos de {plc_name}: {e}")
        return False

def write_plc_variable(plc_name, var_name, value):
    """Escribe una variable específica al PLC"""
    if plc_name not in plc_clients or not plc_clients[plc_name]:
        logger.warning(f"Cliente {plc_name} no conectado")
        return False
    
    client = plc_clients[plc_name]
    mapping = PLC_DATA_MAPPING.get(plc_name)
    if not mapping:
        logger.error(f"No hay mapeo definido para {plc_name}")
        return False
    
    var_config = mapping["variables"].get(var_name)
    if not var_config:
        logger.error(f"Variable {var_name} no definida para {plc_name}")
        return False
    
    if not var_config.get("read_write", False):
        logger.warning(f"Variable {var_name} en {plc_name} es de solo lectura")
        return False
    
    try:
        db_num = mapping["db"]
        var_type = var_config["type"]
        byte_offset = var_config["byte"]
        
        if var_type == "bool":
            bit_offset = var_config["bit"]
            # Lee el byte actual
            buffer = client.db_read(db_num, byte_offset, 1)
            # Modifica el bit
            set_bool(buffer, 0, bit_offset, value)
            # Escribe el byte modificado
            client.db_write(db_num, byte_offset, buffer)
            logger.info(f"Escrito {plc_name}.{var_name} (bool) = {value}")
            
            # Registro
            add_log_entry(f"{plc_name}: {'Activado' if value else 'Desactivado'} {var_name}")
            return True
        
        elif var_type == "int":
            # Crea un buffer para int (2 bytes)
            buffer = bytearray(2)
            set_int(buffer, 0, value)
            client.db_write(db_num, byte_offset, buffer)
            logger.info(f"Escrito {plc_name}.{var_name} (int) = {value}")
            
            # Registro
            add_log_entry(f"{plc_name}: {var_name} establecido a {value}")
            return True
        
        elif var_type == "uint":
            # Crea un buffer para uint (2 bytes)
            buffer = bytearray(2)
            set_uint(buffer, 0, value)
            client.db_write(db_num, byte_offset, buffer)
            logger.info(f"Escrito {plc_name}.{var_name} (uint) = {value}")
            
            # Registro
            message = ""
            if plc_name == "PLC1" and var_name == "modo":
                mode_str = "Apagado" if value == 0 else "Adelante" if value == 1 else "Reversa"
                message = f"{plc_name}: Modo establecido a {mode_str}"
            elif var_name == "comando":
                cmd_str = "Normal" if value == 0 else "Reset" if value == 1 else "Skip"
                message = f"{plc_name}: Comando {cmd_str} enviado"
            else:
                message = f"{plc_name}: {var_name} establecido a {value}"
            add_log_entry(message)
            return True
    
    except Exception as e:
        logger.error(f"Error escribiendo {var_name} en {plc_name}: {e}")
        add_log_entry(f"ERROR: {plc_name} - No se pudo escribir {var_name}")
        return False

def plc1_control(action):
    """Controla las acciones del PLC1 (Banda transportadora)"""
    if action == "encender":
        # Lee el estado actual
        data = read_db_json()
        current_state = data["plc1"]["focos"]["encendido"]
        # Activa/desactiva el encendido
        new_state = not current_state
        result = write_plc_variable("PLC1", "encendido", new_state)
        if result:
            # Si estamos apagando, aseguramos que el modo se ponga en 0
            write_plc_variable("PLC1", "modo", 0)
        return result
    
    elif action == "adelante":
        # Lee el estado actual
        data = read_db_json()
        if not data["plc1"]["focos"]["encendido"]:
            add_log_entry("PLC1: No se puede avanzar, sistema apagado")
            return False
        
        current_adelante = data["plc1"]["focos"]["adelante"]
        if current_adelante:
            # Si ya está en adelante, lo ponemos en modo 0
            return write_plc_variable("PLC1", "modo", 0)
        else:
            # Ponemos en modo adelante (1)
            return write_plc_variable("PLC1", "modo", 1)
    
    elif action == "reversa":
        # Lee el estado actual
        data = read_db_json()
        if not data["plc1"]["focos"]["encendido"]:
            add_log_entry("PLC1: No se puede retroceder, sistema apagado")
            return False
        
        current_reversa = data["plc1"]["focos"]["reversa"]
        if current_reversa:
            # Si ya está en reversa, lo ponemos en modo 0
            return write_plc_variable("PLC1", "modo", 0)
        else:
            # Ponemos en modo reversa (2)
            return write_plc_variable("PLC1", "modo", 2)
    
    else:
        logger.warning(f"Acción desconocida para PLC1: {action}")
        return False

def plc2_control(action):
    """Controla las acciones del PLC2 (Revolvedora)"""
    if action == "toggle":
        # Lee el estado actual
        data = read_db_json()
        current_state = data["plc2"]["focos"]["trabajando"]
        # Activa/desactiva el encendido
        return write_plc_variable("PLC2", "encendido", not current_state)
    
    elif action == "reiniciar":
        # Envia comando reset (1)
        return write_plc_variable("PLC2", "comando", 1)
    
    elif action == "skip":
        # Envia comando skip (2)
        return write_plc_variable("PLC2", "comando", 2)
    
    else:
        logger.warning(f"Acción desconocida para PLC2: {action}")
        return False

def plc3_control(action):
    """Controla las acciones del PLC3 (Empacadora)"""
    if action == "toggle":
        # Lee el estado actual
        data = read_db_json()
        current_state = data["plc3"]["focos"]["trabajando"]
        write_plc_variable("PLC3", "comando", 0)
        # Activa/desactiva el encendido
        return write_plc_variable("PLC3", "encendido", not current_state)
        
    
    elif action == "reiniciar":
        # Envia comando reset (1)
        return write_plc_variable("PLC3", "comando", 1)
    
    elif action == "skip":
        # Envia comando skip (2)
        return write_plc_variable("PLC3", "comando", 2)
    
    else:
        logger.warning(f"Acción desconocida para PLC3: {action}")
        return False

def poll_plcs_task():
    """Función que se ejecuta en un hilo para sondear periódicamente los PLCs"""
    while True:
        try:
            for plc_name in plc_clients:
                # Intentar reconectar si está desconectado
                if plc_name in plc_clients and not plc_clients[plc_name]:
                    for plc_config in PLCS:
                        if plc_config['name'] == plc_name:
                            plc_clients[plc_name] = connect_plc(plc_config)
                            break
                
                # Leer datos del PLC si está conectado
                if plc_name in plc_clients and plc_clients[plc_name]:
                    read_plc_data(plc_name)
            
            # Esperar 1 segundo antes del siguiente sondeo
            time.sleep(1)
        except Exception as e:
            logger.error(f"Error en el ciclo de sondeo: {e}")
            time.sleep(5)  # Esperar un poco más si hay error

def start_polling():
    """Inicia el hilo de sondeo en segundo plano"""
    polling_thread = threading.Thread(target=poll_plcs_task, daemon=True)
    polling_thread.start()
    return polling_thread

# Funciones principales que se pueden llamar desde Flask

def initialize():
    """Inicializa la comunicación con los PLCs y comienza el sondeo"""
    connect_all_plcs()
    return start_polling()

def shutdown():
    """Finaliza las conexiones con los PLCs"""
    disconnect_all_plcs()

def process_action(plc, action):
    """Procesa una acción para un PLC específico"""
    if plc == "plc1":
        return plc1_control(action)
    elif plc == "plc2":
        return plc2_control(action)
    elif plc == "plc3":
        return plc3_control(action)
    else:
        logger.warning(f"PLC desconocido: {plc}")
        return False

# Cuando se importa este módulo, se inicializa automáticamente
polling_thread = None

if __name__ == "__main__":
    # Si se ejecuta directamente, inicia el sondeo en modo autónomo
    print("Iniciando comunicación con PLCs...")
    polling_thread = initialize()
    
    try:
        # Mantiene el programa en ejecución
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Cerrando conexiones...")
        shutdown()