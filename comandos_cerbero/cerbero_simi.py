import sys
import json
import os
import random
from difflib import get_close_matches

# --- CONFIGURACIÓN ---
# Usamos rutas absolutas para evitar errores cuando Node llama al script
DIRECTORIO_BASE = os.path.dirname(os.path.abspath(__file__))
ARCHIVO_DB = os.path.join(DIRECTORIO_BASE, "conocimientos.json")

def cargar_conocimientos():
    """Carga el archivo JSON. Si no existe, devuelve un diccionario vacío."""
    if not os.path.exists(ARCHIVO_DB):
        return {}
    try:
        with open(ARCHIVO_DB, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        # Si el archivo está corrupto, empezamos de cero pero avisamos en consola (stderr)
        return {}

def guardar_conocimientos(data):
    """Guarda el diccionario en el archivo JSON."""
    try:
        with open(ARCHIVO_DB, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except Exception:
        return False

def limpiar_texto(texto):
    """Normaliza el texto a minúsculas y quita espacios extra."""
    return texto.lower().strip()

def procesar_entrada(mensaje_usuario):
    db = cargar_conocimientos()
    mensaje_clean = limpiar_texto(mensaje_usuario)

    # ---------------------------------------------------------
    # 1. LÓGICA DE APRENDIZAJE
    # Comandos soportados: "aprende: x | y" o "enseñar: x | y"
    # ---------------------------------------------------------
    if mensaje_clean.startswith(("aprende:", "enseñar:", "enseña:")):
        try:
            # Quitamos la palabra clave del inicio
            if ":" in mensaje_clean:
                contenido = mensaje_usuario.split(":", 1)[1]
            else:
                return "Formato incorrecto. Usa dos puntos (:)."

            # Separamos pregunta y respuesta por la barra "|"
            if "|" not in contenido:
                return "Te faltó la barra separadora. Ejemplo: aprende: saludo | hola bro"

            partes = contenido.split("|")
            pregunta = limpiar_texto(partes[0])
            respuesta = partes[1].strip() # La respuesta respeta mayúsculas originales

            if not pregunta or not respuesta:
                return "No puedes dejar la pregunta o la respuesta vacías."

            # Guardamos en la base de datos
            if pregunta in db:
                # Si ya existe la pregunta, añadimos la nueva respuesta a la lista
                # Evitamos duplicados exactos
                if respuesta not in db[pregunta]:
                    db[pregunta].append(respuesta)
            else:
                # Si es nueva, creamos la lista
                db[pregunta] = [respuesta]

            guardar_conocimientos(db)
            return f"Listo, aprendido. Ahora sé responder a: '{pregunta}'"

        except Exception as e:
            return "Ocurrió un error al intentar aprender."

    # ---------------------------------------------------------
    # 2. LÓGICA DE RESPUESTA
    # ---------------------------------------------------------
    
    # A) Búsqueda exacta
    if mensaje_clean in db:
        return random.choice(db[mensaje_clean])

    # B) Búsqueda aproximada (Fuzzy matching)
    # Esto ayuda si el usuario tiene errores de dedo (ej: "hloa" en vez de "hola")
    coincidencias = get_close_matches(mensaje_clean, db.keys(), n=1, cutoff=0.5)
    
    if coincidencias:
        mejor_coincidencia = coincidencias[0]
        respuesta = random.choice(db[mejor_coincidencia])
        # Opcional: Podrías devolver también la coincidencia encontrada
        return respuesta

    # C) Búsqueda por subcadenas (clave contenida en mensaje)
    # Busca si alguna clave está completamente contenida en el mensaje
    mejores_coincidencias = [key for key in db if key in mensaje_clean]
    if mejores_coincidencias:
        # Elegir la clave más larga que esté contenida
        mejor_key = max(mejores_coincidencias, key=len)
        return random.choice(db[mejor_key])

    # D) Búsqueda inversa (mensaje contenido en clave)
    # Busca si el mensaje está contenido en alguna clave
    mejores_coincidencias_inv = [key for key in db if mensaje_clean in key]
    if mejores_coincidencias_inv:
        # Elegir la clave más larga que contenga el mensaje
        mejor_key = max(mejores_coincidencias_inv, key=len)
        return random.choice(db[mejor_key])

    # E) Búsqueda por palabras en común
    # Divide el mensaje y las claves en palabras, y busca la clave con más palabras coincidentes
    palabras_mensaje = set(mensaje_clean.split())
    mejores_claves = []
    max_coincidencias = 0
    for key in db:
        palabras_key = set(key.split())
        coincidencias = len(palabras_mensaje & palabras_key)
        if coincidencias > max_coincidencias:
            max_coincidencias = coincidencias
            mejores_claves = [key]
        elif coincidencias == max_coincidencias and coincidencias > 0:
            mejores_claves.append(key)
    if mejores_claves:
        mejor_key = random.choice(mejores_claves)
        return random.choice(db[mejor_key])

    # F) No sabe la respuesta
    frases_desconocido = [
        "No sé qué significa eso. Enséñame escribiendo: 'aprende: tu pregunta | mi respuesta'",
        "Estoy chiquito, no te entiendo.",
        "¿Ah? Enséñame qué responder a eso.",
        "Error 404: Conocimiento no encontrado."
    ]
    return random.choice(frases_desconocido)

def main():
    # sys.argv[0] es el nombre del script
    # sys.argv[1] es el mensaje que viene desde Node.js
    

    # Configurar salida estándar a UTF-8 para evitar errores de codificación en consola
    if sys.stdout.encoding != 'utf-8':
        try:
            import os
            if hasattr(sys.stdout, 'fileno') and os.isatty(sys.stdout.fileno()):
                sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
        except Exception:
            pass  # Si no se puede, continuar sin error

    if len(sys.argv) < 2:
        print("Error: El script espera un argumento (el mensaje).")
        return

    # Unimos todos los argumentos por si Node no entrecomilló bien, 
    # aunque lo ideal es recibir un solo string.
    mensaje = " ".join(sys.argv[1:])
    
    # Procesamos y obtenemos el texto final
    respuesta = procesar_entrada(mensaje)
    
    # Imprimimos la respuesta (Esto es lo que leerá Node.js)
    print(respuesta)

if __name__ == "__main__":
    main()
