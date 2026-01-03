import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Crear la carpeta de sesiones si no existe
const sessionsDir = 'sessions';
await mkdir(sessionsDir, { recursive: true });

// Guardar la sesión
export async function saveSession(sessionId, data) {
    const filePath = join(sessionsDir, `${sessionId}.json`);
    await writeFile(filePath, JSON.stringify(data, null, 2));
}

// Cargar la sesión
export async function loadSession(sessionId) {
    const filePath = join(sessionsDir, `${sessionId}.json`);
    try {
        const data = await readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return null; // No hay sesión guardada
    }
}
