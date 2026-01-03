import subprocess
import signal
import sys
import os
from colorama import Fore, init

# Inicializa colorama para manejar los colores
init(autoreset=True)

def find_and_kill_process(script_name):
    """
    Encuentra el proceso que está ejecutando el script (por ejemplo, 'index.js') y lo mata.
    Si hay varios procesos, los mata todos.
    """
    try:
        # Utiliza pgrep para encontrar el PID del proceso ejecutando 'node index.js'
        result = subprocess.run(
            ["pgrep", "-f", f"node.*{script_name}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Si la salida no está vacía, obtenemos los PIDs
        if result.stdout:
            pids = result.stdout.strip().split("\n")  # Divide la salida por líneas
            for pid in pids:
                pid = pid.strip()  # Elimina cualquier espacio o salto de línea
                if pid:
                    print(f"{Fore.BLUE}[INFO] Proceso encontrado con PID {pid}. Terminando proceso...")
                    os.kill(int(pid), signal.SIGTERM)  # Envia una señal de terminación al proceso encontrado
                    print(f"{Fore.RED}[INFO] Proceso {pid} terminado.")
        else:
            print(f"{Fore.YELLOW}[WARN] No se encontró ningún proceso ejecutando el script.")
    
    except Exception as e:
        print(f"{Fore.RED}[ERROR] Error al encontrar o matar el proceso: {e}")

def main():
    """
    El programa se ejecuta cuando recibe una señal SIGINT (CTRL+C) para matar el proceso de index.js.
    """
    script_name = "index.js"
    find_and_kill_process(script_name)

if __name__ == "__main__":
    main()
