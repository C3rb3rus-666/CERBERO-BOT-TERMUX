import fs from 'fs';
import path from 'path';

const RECOVERY_STATE_PATH = './sessions/recovery_state.json';

// ==========================================
// 🚀 UTILIDADES DE RECUPERACIÓN RÁPIDA
// ==========================================

export function guardarEstadoRecuperacion(estado) {
  try {
    fs.writeFileSync(RECOVERY_STATE_PATH, JSON.stringify(estado, null, 2));
  } catch (error) {
    console.error('Error guardando estado:', error.message);
  }
}

export function cargarEstadoRecuperacion() {
  try {
    if (fs.existsSync(RECOVERY_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(RECOVERY_STATE_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error('Error cargando estado:', error.message);
  }
  return { ultimaConexion: null, processedMessages: [] };
}

// Limpiar device-list obsoletos
export function limpiarDeviceLists() {
  try {
    const sessionsDir = './sessions';
    if (!fs.existsSync(sessionsDir)) return;
    
    const archivos = fs.readdirSync(sessionsDir);
    const deviceLists = archivos.filter(f => f.startsWith('device-list-'));
    
    if (deviceLists.length > 3) {
      // Mantener solo los 3 más recientes
      const sorted = deviceLists
        .map(f => ({ name: f, time: fs.statSync(path.join(sessionsDir, f)).mtime }))
        .sort((a, b) => b.time - a.time);
      
      sorted.slice(3).forEach(f => {
        try {
          fs.unlinkSync(path.join(sessionsDir, f.name));
          console.log(`🗑️ Eliminado: ${f.name}`);
        } catch (err) {}
      });
    }
  } catch (error) {
    console.error('Error limpiando device-lists:', error.message);
  }
}

// Validar integridad de creds (solo si existe y tiene datos)
export function validarCreds() {
  try {
    const credsPath = './sessions/creds.json';
    if (!fs.existsSync(credsPath)) {
      // No existe creds = sesión nueva, es normal
      return true;
    }
    
    const content = fs.readFileSync(credsPath, 'utf-8').trim();
    if (!content || content === '{}' || content === '') {
      // Creds vacío o corrupto
      console.warn('⚠️ Creds corrupto (vacío), limpiando...');
      return false;
    }
    
    const creds = JSON.parse(content);
    
    // Validar campos críticos solo si existen
    if (Object.keys(creds).length > 0 && (!creds.encKey || !creds.macKey)) {
      console.warn('⚠️ Creds corrupto (sin encKey/macKey), limpiando...');
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Error validando creds:', error.message);
    return false;
  }
}

// Rate limiter para reconexiones
export class ReconnectThrottler {
  constructor(initialDelay = 1000, maxDelay = 30000) {
    this.currentDelay = initialDelay;
    this.maxDelay = maxDelay;
    this.lastAttempt = 0;
  }

  shouldReconnect() {
    const now = Date.now();
    if (now - this.lastAttempt < this.currentDelay) {
      return false;
    }
    this.lastAttempt = now;
    return true;
  }

  getNextDelay() {
    const delay = this.currentDelay;
    this.currentDelay = Math.min(this.currentDelay * 1.5, this.maxDelay);
    return delay;
  }

  reset() {
    this.currentDelay = 1000;
    this.lastAttempt = 0;
  }
}

// Limpiar timers globales
export function limpiarAllTimers(timers = []) {
  timers.forEach(timer => {
    if (timer) {
      clearInterval(timer);
      clearTimeout(timer);
    }
  });
}

export default { guardarEstadoRecuperacion, cargarEstadoRecuperacion, limpiarDeviceLists, validarCreds, ReconnectThrottler, limpiarAllTimers };
