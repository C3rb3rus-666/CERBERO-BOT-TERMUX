import os
import sys
import time
import signal
import threading
import pty
from colorama import init

# Inicializa colorama para colores ANSI
init(autoreset=True)

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

child_pid = None
fd = None

def start_node_with_restart(script_path):
    global child_pid, fd

    def read_output():
        while True:
            try:
                output = os.read(fd, 1024).decode(errors='ignore')
                if not output:
                    break
                sys.stdout.write(output)
                sys.stdout.flush()
            except OSError:
                break

    while True:
        print(f"\033[31m[INFO] \033[34mIniciando index.js...\n")
        child_pid, fd = pty.fork()
        if child_pid == 0:
            os.execvp("node", ["node", script_path])
        else:
            reader_thread = threading.Thread(target=read_output, daemon=True)
            reader_thread.start()

            # Esperar a que el hijo termine
            pid, status = os.waitpid(child_pid, 0)
            exit_code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else -1

            if exit_code == 0:
                print(f"\n\033[32m[INFO] \033[34mindex.js finalizado correctamente (exit code: {exit_code}).")
                break
            else:
                print(f"\n\033[31m[ERROR] \033[34mindex.js falló (exit code: {exit_code}). Reiniciando en 5s...")
                time.sleep(5)

def terminate_process(signal_num, frame):
    print("\n\033[31m[INFO] \033[34mInterrupción detectada. Terminando proceso Node.js...")
    try:
        if child_pid:
            os.kill(child_pid, signal.SIGTERM)
            print("\033[31m[INFO] \033[34mProceso terminado.")
    except Exception as e:
        print(f"\033[31m[ERROR] \033[34mError terminando el proceso: {e}")
    sys.exit(0)

def display_ascii_art():
    while True:
        print(ascii_art)
        time.sleep(20)

if __name__ == "__main__":
    script_js = "index.js"
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), script_js)

    signal.signal(signal.SIGINT, terminate_process)
    threading.Thread(target=display_ascii_art, daemon=True).start()
    start_node_with_restart(script_path)

    while True:
        time.sleep(1)
