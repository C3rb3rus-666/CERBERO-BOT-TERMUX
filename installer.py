import os
import sys
import time
from colorama import Fore, init

# Inicializa colorama para manejar colores
init(autoreset=True)

# Arte ASCII con colores ANSI
ascii_art = f"""
{Fore.RED}
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
         {Fore.BLUE}[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔
{Fore.RESET}
"""

# Mostrar el arte ASCII
print(ascii_art)
time.sleep(2)

# Función para instalar yt-dlp y ffmpeg
def install_tools():
    print(f"{Fore.CYAN}[INFO] {Fore.YELLOW}Iniciando la instalación de yt-dlp y ffmpeg...\n")

    # Instalar ffmpeg via apt (sin yt-dlp del sistema, que tiene Python roto)
    os.system("sudo apt update && sudo apt install -y ffmpeg")

    # Instalar yt-dlp via pip en el venv activo (evita el yt-dlp del sistema con Python roto)
    pip_result = os.system(f"{sys.executable} -m pip install -U yt-dlp")

    if pip_result == 0:
        # Crear symlink en /usr/local/bin para que node.js lo encuentre globalmente
        venv_ytdlp = os.path.join(os.path.dirname(sys.executable), "yt-dlp")
        if os.path.exists(venv_ytdlp):
            symlink_result = os.system(f"sudo ln -sf {venv_ytdlp} /usr/local/bin/yt-dlp")
            if symlink_result == 0:
                print(f"{Fore.GREEN}[SUCCESS] {Fore.WHITE}yt-dlp instalado y symlink creado en /usr/local/bin/yt-dlp")
            else:
                print(f"{Fore.YELLOW}[WARN] {Fore.WHITE}yt-dlp instalado pero no se pudo crear symlink (requiere sudo)")
        print(f"{Fore.GREEN}[SUCCESS] {Fore.WHITE}Instalación completada correctamente.")
    else:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}Hubo un problema durante la instalación de yt-dlp.")

# Comprobar si los comandos existen y funcionan correctamente
def check_command(command):
    if command == "yt-dlp":
        # Verificar que el yt-dlp encontrado realmente funciona (no el del sistema con Python roto)
        result = os.system(f"{command} --version > /dev/null 2>&1")
        if result != 0:
            print(f"{Fore.RED}[ERROR] {Fore.BLUE}El comando '{command}' no funciona correctamente.")
            return False
        else:
            print(f"{Fore.GREEN}[OK] {Fore.WHITE}El comando '{command}' está disponible y funciona.")
            return True
    if os.system(f"command -v {command} > /dev/null 2>&1") != 0:
        print(f"{Fore.RED}[ERROR] {Fore.BLUE}El comando '{command}' no está disponible.")
        return False
    else:
        print(f"{Fore.GREEN}[OK] {Fore.WHITE}El comando '{command}' está disponible.")
        return True

# Ejecutar la instalación solo si faltan los comandos
if not check_command("yt-dlp") or not check_command("ffmpeg"):
    install_tools()
else:
    print(f"{Fore.CYAN}[INFO] {Fore.WHITE}Todos los paquetes ya están instalados.")
