import subprocess
import time
import threading
import os
import signal
import sys
import json
from colorama import Fore, init

# Inicializa colorama para manejar colores
init(autoreset=True)

# Arte ASCII
ascii_art = """
\033[31m
         ....''''..                     .',,,'.
      .:dkkk0KXNNX0d;.               .;d0XNWNK0Oxc,.
     .c0XKx;.':xXWMWN0d;.       .':ldKWMWXko;',:d0KOc.
     '::,.      'o0WWWMWKx:.  .'cOXWWWWW0l.      .,cl'
                  .:xXWWWXd.  ,oOWMMWXx:.
     ...             .cddc'   ..:ddl:'            .'
     ;dc.   ..:loooc'                .;coddol,.   'ko.
     cx,  .ckXWWWMMWXk,    .    .   :0NWWMWWWNO,   lx'
    .;;. .cXWWWMMMWWWNx.  :c. .;c, .dNWWMMWWWWWk.  .'
        .;dOkdllldOXXo.   lo. .'oc  .dXKkoc:;;cc;.
        ...        .;,.  ;d;   .:x; .::.         .'
     .,.              .,lc'      'cl;.            .,.
   .,dx;             .lo.          .ol.           .d0l.
  'dXNd.             .o,            ':.            cXWO,
.;kNMWx.           .':ol,.       .,clll;..          ;0MWKc
.:ONWWMNk,.    .,:lx0NWMWNO:.  .;cONWWMWXOdc;.   ';l0WWWWO'
 ;0WWWWWWN0xoox0NWWMMWMMWWMNKkOXWWMWWMMMWWMWWXOxkKWWWWWWNx'
 .dWWWMMWWWWWMMMMMMWWMMMMWWWWWWWWWWMWWWMMMWMMMMMMMMMMWWN0l.
  ;0WWWWMMWMMWWMMMMMMMMMMWWWMMMWWWWMMWWMMMMMMMWMMMWWMWNOo'
   ,xXWWWWMMMMMMMMMMWWMMMWMMMMMMWWWMMMWWMWWWWWMMMMMWXOo;.
     .:loodxxxxxOKXNWN0xdxxxxxOKXKKOdodxkOOOOOOkkxdl;.. 
               .:ONWWX0koc:;,;clllodxOOxl:.
                 .l0WWMWWWWWNNWWWWMWNK0d;.
                   .;dOXNWWWWWWWWWWKx:.
                       .,,,;:::;;,,'   
         \033[34m [𝐂𝐄𝐑𝐁𝐄𝐑𝐎] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔
"""

def execute_uname_system():
    """
    Ejecuta el comando 'uname-system' y retorna su salida.
    """
    try:
        result = subprocess.run(
            ["uname-system"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        return result.stdout.strip()
    except FileNotFoundError:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}El comando 'uname-system' no está disponible.")
        return None

def create_error_log(error_message):
    """
    Crea un archivo 'error_log.json' en la carpeta raíz del bot con el mensaje de error.
    """
    error_log_path = os.path.join(os.getcwd(), "error_log.json")
    error_data = {
        "error": error_message,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    try:
        with open(error_log_path, "w") as error_file:
            json.dump(error_data, error_file, indent=4)
        print(f"{Fore.BLUE}[INFO] Archivo de error creado: {error_log_path}")
    except Exception as e:
        print(f"{Fore.RED}[ERROR] No se pudo crear el archivo de error: {e}")

def start_script_in_xfce4_terminal(script_path):
    """
    Inicia el script Node.js en una nueva ventana de terminal y devuelve el PID del proceso.
    """
    global child_process
    try:
        command = f"xfce4-terminal --hold -e 'bash -c \"node {script_path}; exec bash\"'"
        child_process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"{Fore.RED}[INFO] {Fore.BLUE}Script {script_path} iniciado en una nueva ventana.")
        return child_process
    except FileNotFoundError:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}xfce4-terminal no está instalado en el sistema.")
        return None
    except Exception as e:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}No se pudo iniciar el script {script_path} en xfce4-terminal: {e}")
        return None

def start_script_in_xterm(script_path):
    """
    Inicia el script Node.js en una nueva ventana de terminal usando xterm.
    """
    global child_process
    try:
        child_process = subprocess.Popen(
            ["xterm", "-hold", "-e", f"node {script_path}"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print(f"{Fore.RED}[INFO] {Fore.BLUE}Script {script_path} iniciado en una nueva ventana con xterm.")
        return child_process
    except FileNotFoundError:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}xterm no está instalado en el sistema.")
        return None
    except Exception as e:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}No se pudo iniciar el script {script_path} con xterm: {e}")
        return None

def start_script_directly(script_path):
    """
    Ejecuta directamente el script Node.js en el mismo proceso
    y muestra la salida en tiempo real.
    """
    try:
        process = subprocess.Popen(
            ["node", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print(f"{Fore.RED}[INFO] {Fore.BLUE}Ejecutando {script_path} directamente...\n")

        # Leer la salida en tiempo real
        def read_output(stream, color):
            for line in iter(stream.readline, ""):
                print(f"{color}{line.strip()}")  # Imprime línea con color
            stream.close()

        # Crea hilos para leer stdout y stderr simultáneamente
        stdout_thread = threading.Thread(target=read_output, args=(process.stdout, Fore.BLUE), daemon=True)
        stderr_thread = threading.Thread(target=read_output, args=(process.stderr, Fore.RED), daemon=True)

        # Inicia los hilos
        stdout_thread.start()
        stderr_thread.start()

        # Espera a que el proceso termine
        process.wait()
        print(f"{Fore.RED}[INFO] {Fore.BLUE}El proceso {script_path} ha terminado con código {process.returncode}.")

        return process
    except Exception as e:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}Error al ejecutar el script directamente: {e}")
        return None

def terminate_processes(signal, frame):
    """
    Manejador para la señal SIGINT (CTRL+C), termina los procesos padre e hijo.
    """
    print(f"{Fore.RED}[INFO] {Fore.BLUE}Interrumpido con CTRL+C. Terminando los procesos...")
    
    # Ejecuta el script kill_process.py
    try:
        subprocess.run(["python3", "kill_process.py"], check=True)
    except Exception as e:
        print(f"[ERROR] No se pudo ejecutar kill_process.py: {e}")
    
    # Termina el proceso principal
    sys.exit(0)  # Termina el proceso principal.

def is_process_running(script_name):
    """
    Verifica si un proceso con el nombre dado (index.js) está corriendo usando pgrep.
    """
    try:
        # Buscar el proceso 'node' ejecutando el script 'index.js'
        result = subprocess.run(["pgrep", "-f", f"node.*{script_name}"], stdout=subprocess.PIPE)
        return result.returncode == 0
    except Exception as e:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}Error al verificar el proceso: {e}")
        return False

def monitor_script(script_name, script_path):
    """
    Supervisa el script lanzado y lo reinicia si deja de ejecutarse.
    Si el script falla o muere, crea un archivo de registro de error.
    """
    while True:
        if not is_process_running(script_name):
            print(f"{Fore.RED}[WARN] {Fore.BLUE}El script {script_name} no está corriendo. Reiniciándolo...")
            create_error_log(f"El script {script_name} ha dejado de ejecutarse.")
            # Reinicia el script
            if execute_uname_system() == "cerbero-os":
                start_script_directly(script_path)  # Reinicia directamente si es cerbero-os
            else:
                start_script_in_xfce4_terminal(script_path) # Usa xterm para otros sistemas
        time.sleep(5)  # Verifica cada 5 segundos

def display_ascii_art():
    """
    Muestra el arte ASCII cada 20 segundos.
    """
    while True:
        print(ascii_art)
        time.sleep(20)

if __name__ == "__main__":
    script_js = "index.js"
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), script_js)

    # Configura el manejador de la señal SIGINT
    signal.signal(signal.SIGINT, terminate_processes)

    # Inicia el arte ASCII en un hilo separado
    threading.Thread(target=display_ascii_art, daemon=True).start()

    # Verificar el sistema con 'uname-system'
    system_name = execute_uname_system()
    if system_name == "cerbero-os":
        print(f"{Fore.RED}[INFO] {Fore.BLUE}Sistema detectado: {system_name}. Ejecutando el script directamente.")
        start_script_directly(script_path)
        threading.Thread(target=monitor_script, args=("index.js", script_path), daemon=True).start()
    else:
        print(f"{Fore.RED}[INFO] {Fore.BLUE}Sistema no detectado como 'cerbero-os'. Usando xterm para ejecutar el script.")
        start_script_in_xfce4_terminal(script_path)
        threading.Thread(target=monitor_script, args=("index.js", script_path), daemon=True).start()

    # Mantén el programa corriendo para que los hilos trabajen
    while True:
        time.sleep(1)