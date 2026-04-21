// buscaminas.js — Buscaminas (Minesweeper) para WhatsApp
// Cerbero-Bot by C3rb3rus-666
//
// Reto de ingeniería: tablero interactivo por texto, flood-fill,
// primer clic seguro, banderas, renderizado emoji en chat.

// ─── Estado en memoria (una partida por grupo) ─────────────────
const activeGames = new Map();

const DIFFICULTIES = {
  facil:   { rows: 8,  cols: 8,  mines: 10, label: 'Fácil' },
  medio:   { rows: 9,  cols: 9,  mines: 15, label: 'Medio' },
  dificil: { rows: 10, cols: 10, mines: 25, label: 'Difícil' }
};

const HIDDEN = 0, REVEALED = 1, FLAGGED = 2;

// ─── Motor del juego ────────────────────────────────────────────

function createGame(difficulty = 'facil') {
  const config = DIFFICULTIES[difficulty] || DIFFICULTIES.facil;
  const { rows, cols, mines, label } = config;

  return {
    board: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        mine: false, state: HIDDEN, neighbors: 0
      }))
    ),
    rows, cols,
    totalMines: mines,
    minesPlaced: false,
    flagCount: 0,
    revealedCount: 0,
    gameOver: false,
    won: false,
    difficulty,
    diffLabel: label,
    startTime: Date.now(),
    moves: 0,
    lastPlayer: null
  };
}

/**
 * Coloca minas evitando la zona del primer clic (3×3 alrededor).
 * Después calcula los conteos de vecinos.
 */
function placeMines(game, safeRow, safeCol) {
  const { board, rows, cols, totalMines } = game;
  let placed = 0;

  const isSafe = (r, c) => Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1;

  while (placed < totalMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!board[r][c].mine && !isSafe(r, c)) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // Contar vecinos
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++;
        }
      }
      board[r][c].neighbors = count;
    }
  }

  game.minesPlaced = true;
}

/**
 * Revela una celda. Si tiene 0 vecinos, ejecuta flood-fill.
 * Retorna: 'ok', 'boom', 'win', 'already', 'flagged', 'invalid'
 */
function revealCell(game, row, col) {
  const { board, rows, cols } = game;

  if (row < 0 || row >= rows || col < 0 || col >= cols) return 'invalid';
  if (board[row][col].state === REVEALED) return 'already';
  if (board[row][col].state === FLAGGED) return 'flagged';

  // Primer clic: colocar minas (garantía de seguridad)
  if (!game.minesPlaced) placeMines(game, row, col);

  game.moves++;

  // ¡Mina!
  if (board[row][col].mine) {
    board[row][col].state = REVEALED;
    game.gameOver = true;
    game.won = false;
    return 'boom';
  }

  // Flood-fill iterativo (no recursivo para evitar stack overflow en tableros grandes)
  const stack = [[row, col]];
  while (stack.length) {
    const [r, c] = stack.pop();
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    if (board[r][c].state !== HIDDEN || board[r][c].mine) continue;

    board[r][c].state = REVEALED;
    game.revealedCount++;

    // Si tiene 0 vecinos, expandir en las 8 direcciones
    if (board[r][c].neighbors === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) stack.push([r + dr, c + dc]);
        }
      }
    }
  }

  // ¿Victoria?
  if (game.revealedCount >= (rows * cols - game.totalMines)) {
    game.gameOver = true;
    game.won = true;
    return 'win';
  }

  return 'ok';
}

/**
 * Alterna bandera en una celda oculta.
 */
function toggleFlag(game, row, col) {
  const { board, rows, cols } = game;

  if (row < 0 || row >= rows || col < 0 || col >= cols) return 'invalid';
  if (board[row][col].state === REVEALED) return 'revealed';

  if (board[row][col].state === HIDDEN) {
    board[row][col].state = FLAGGED;
    game.flagCount++;
    return 'placed';
  } else {
    board[row][col].state = HIDDEN;
    game.flagCount--;
    return 'removed';
  }
}

// ─── Renderizado ────────────────────────────────────────────────

function getElapsed(game) {
  const s = Math.floor((Date.now() - game.startTime) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Genera el tablero como texto para WhatsApp.
 * Usa emojis para un look visual divertido.
 */

// Emojis para números de vecinos (index = cantidad)
const NUM_EMOJI = ['⬜', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

// Emojis para etiquetas de columna
const COL_EMOJI = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯', '🇰', '🇱', '🇲', '🇳', '🇴'];

function renderBoard(game) {
  const { board, rows, cols, totalMines, flagCount, diffLabel, gameOver, won, moves } = game;

  // ─── Branding ───
  const brand = `━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `  💣 *BUSCAMINAS*\n` +
                `  _𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓_\n` +
                `  _Coded by C3rb3rus-666_\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // ─── Header ───
  let header;
  if (gameOver && won) {
    header = brand +
             `🏆✨ *¡COMPLETADO!* ✨🏆\n` +
             `🎯 ${diffLabel} (${rows}×${cols}) • 🎮 ${moves} jugadas • ⏱️ ${getElapsed(game)}\n`;
  } else if (gameOver) {
    header = brand +
             `💥☠️ *¡BOOM! PISASTE UNA MINA!* ☠️💥\n` +
             `💀 ${diffLabel} (${rows}×${cols}) • 🎮 ${moves} jugadas • ⏱️ ${getElapsed(game)}\n`;
  } else {
    header = brand +
             `〔 ${diffLabel} (${rows}×${cols}) 〕\n` +
             `🚩 ${flagCount}/${totalMines} banderas • 🎮 ${moves} • ⏱️ ${getElapsed(game)}\n`;
  }

  // ─── Referencia de columnas en texto claro ───
  const colLetters = Array.from({length: cols}, (_, i) => String.fromCharCode(65 + i)).join('   ');
  let grid = `\n📍 *${colLetters}*\n`;
  grid += '⬛' + COL_EMOJI.slice(0, cols).join('') + '\n';

  // ─── Filas del tablero ───
  const ROW_NUM = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  for (let r = 0; r < rows; r++) {
    let rowStr = ROW_NUM[r] || `${r+1}`;

    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];

      if (gameOver) {
        // ─── Game Over: revelar todo ───
        if (cell.mine && cell.state === REVEALED) {
          rowStr += '💥';  // La mina que pisaste
        } else if (cell.mine && cell.state === FLAGGED) {
          rowStr += '✅';  // Bandera correcta
        } else if (cell.mine) {
          rowStr += '💣';  // Minas no encontradas
        } else if (cell.state === FLAGGED && !cell.mine) {
          rowStr += '❌';  // Bandera incorrecta
        } else if (cell.state === REVEALED) {
          rowStr += NUM_EMOJI[cell.neighbors];
        } else {
          rowStr += '⬜';  // Celda sin revelar
        }
      } else {
        // ─── Juego activo ───
        if (cell.state === HIDDEN) {
          rowStr += '🟦';  // Oculta
        } else if (cell.state === FLAGGED) {
          rowStr += '🚩';  // Bandera
        } else {
          rowStr += NUM_EMOJI[cell.neighbors];
        }
      }
    }

    grid += rowStr + '\n';
  }

  // ─── Footer ───
  let footer;
  if (gameOver && won) {
    footer = '\n🎉 _¡Felicidades! Todas las celdas seguras reveladas._\n' +
             '🔄 _Escribe *!minas nuevo* para otra partida._\n' +
             '━━━━━━━━━━━━━━━━━━━━━━━';
  } else if (gameOver) {
    footer = '\n😵 _Escribe *!minas nuevo* para intentarlo de nuevo._\n' +
             '━━━━━━━━━━━━━━━━━━━━━━━';
  } else {
    footer = '\n📍 _Letra = columna, Número = fila_' +
             '\n▸ *!minas A3* → Revelar celda' +
             '\n▸ *!minas bandera A3* → 🚩\n' +
             '━━━━━━━━━━━━━━━━━━━━━━━';
  }

  return header + grid + footer;
}

// ─── Parsing de coordenadas ─────────────────────────────────────

function parseCoord(str, game) {
  if (!str) return null;
  const match = str.toUpperCase().match(/^([A-O])(\d{1,2})$/);
  if (!match) return null;

  const col = match[1].charCodeAt(0) - 65;
  const row = parseInt(match[2]) - 1;

  if (row < 0 || row >= game.rows || col < 0 || col >= game.cols) return null;
  return { row, col };
}

// ─── Handler principal del comando !minas ───────────────────────

export async function handleBuscaminas(sock, msg) {
  const chatId = msg.key.remoteJid;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const senderName = msg.pushName || senderJid.split('@')[0];
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
  const args = text.split(/\s+/).slice(1); // Quitar '!minas'
  const sub = args[0]?.toLowerCase();

  // ─── Ayuda / Sin argumentos ───
  if (!sub || sub === 'ayuda' || sub === 'help') {
    const game = activeGames.get(chatId);
    if (game && !game.gameOver) {
      // Si hay partida activa, mostrar tablero
      await sock.sendMessage(chatId, { text: renderBoard(game) }, { quoted: msg });
    } else {
      await sock.sendMessage(chatId, {
        text: `━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `  💣 *BUSCAMINAS*\n` +
              `  _𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓_\n` +
              `  _Coded by C3rb3rus-666_\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `〔 🆕 *INICIAR PARTIDA* 〕\n` +
              `▸ *!minas nuevo* — Fácil (8×8, 10 💣)\n` +
              `▸ *!minas nuevo medio* — Medio (9×9, 15 💣)\n` +
              `▸ *!minas nuevo dificil* — Difícil (10×10, 25 💣)\n\n` +
              `〔 🎮 *JUGAR* 〕\n` +
              `▸ *!minas A3* — Revelar columna A, fila 3\n` +
              `▸ *!minas bandera A3* — Poner/quitar 🚩\n` +
              `▸ *!minas ver* — Ver tablero actual\n` +
              `▸ *!minas rendirse* — Abandonar partida\n\n` +
              `〔 📍 *COORDENADAS* 〕\n` +
              `LETRA = columna (A,B,C...)\n` +
              `NÚMERO = fila (1,2,3...)\n` +
              `Ejemplo: *A1* = columna A, fila 1\n\n` +
              `〔 📖 *SÍMBOLOS* 〕\n` +
              `🟦 oculta · ⬜ vacía · 1️⃣-8️⃣ minas cerca\n` +
              `🚩 bandera · 💣 mina · 💥 ¡boom!\n` +
              `✅ correcta · ❌ incorrecta\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💡 _El primer clic nunca es mina_\n` +
              `🤝 _Todos pueden jugar la misma partida_\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━`
      }, { quoted: msg });
    }
    return;
  }

  // ─── Nueva partida ───
  if (sub === 'nuevo' || sub === 'new' || sub === 'iniciar') {
    const existingGame = activeGames.get(chatId);
    if (existingGame && !existingGame.gameOver) {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ Ya hay una partida en curso.\n` +
              `Usa *!minas rendirse* para abandonarla o sigue jugando.`
      }, { quoted: msg });
      return;
    }

    const diff = args[1]?.toLowerCase() || 'facil';
    if (!DIFFICULTIES[diff]) {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ Dificultad no válida.\n` +
              `Opciones: *facil*, *medio*, *dificil*`
      }, { quoted: msg });
      return;
    }

    const game = createGame(diff);
    game.lastPlayer = senderName;
    activeGames.set(chatId, game);

    await sock.sendMessage(chatId, {
      text: `🆕 *${senderName}* inició una partida de Buscaminas!\n\n` + renderBoard(game)
    }, { quoted: msg });
    return;
  }

  // ─── Ver tablero ───
  if (sub === 'ver' || sub === 'tablero' || sub === 'board') {
    const game = activeGames.get(chatId);
    if (!game || game.gameOver) {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] No hay partida activa. Usa *!minas nuevo* para iniciar.`
      }, { quoted: msg });
      return;
    }
    await sock.sendMessage(chatId, { text: renderBoard(game) }, { quoted: msg });
    return;
  }

  // ─── Rendirse ───
  if (sub === 'rendirse' || sub === 'surrender' || sub === 'salir') {
    const game = activeGames.get(chatId);
    if (!game || game.gameOver) {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] No hay partida activa.`
      }, { quoted: msg });
      return;
    }
    game.gameOver = true;
    game.won = false;

    await sock.sendMessage(chatId, {
      text: `🏳️ *${senderName}* se ha rendido.\n\n` + renderBoard(game)
    }, { quoted: msg });
    activeGames.delete(chatId);
    return;
  }

  // ─── Bandera ───
  if (sub === 'bandera' || sub === 'flag' || sub === 'b') {
    const game = activeGames.get(chatId);
    if (!game || game.gameOver) {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] No hay partida activa. Usa *!minas nuevo* para iniciar.`
      }, { quoted: msg });
      return;
    }

    const coordStr = args[1];
    const coord = coordStr ? parseCoord(coordStr, game) : null;
    if (!coord) {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ Coordenada inválida. Ejemplo: *!minas bandera A3*`
      }, { quoted: msg });
      return;
    }

    const result = toggleFlag(game, coord.row, coord.col);
    if (result === 'revealed') {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ Esa celda ya fue revelada, no se puede marcar.`
      }, { quoted: msg });
      return;
    }

    const colLabel = String.fromCharCode(65 + coord.col);
    const rowLabel = coord.row + 1;
    const action = result === 'placed' ? '🚩 Bandera colocada' : '↩️ Bandera retirada';

    await sock.sendMessage(chatId, {
      text: `${action} en *${colLabel}${rowLabel}* por ${senderName}\n\n` + renderBoard(game)
    }, { quoted: msg });
    return;
  }

  // ─── Revelar celda (default: intentar parsear como coordenada) ───
  const game = activeGames.get(chatId);

  // Verificar si es una coordenada válida
  const coord = game ? parseCoord(sub, game) : null;

  if (!coord) {
    // Si no hay partida o no es coordenada reconocible
    if (sub && /^[a-oA-O]\d{1,2}$/.test(sub) && (!game || game.gameOver)) {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] No hay partida activa. Usa *!minas nuevo* para iniciar.`
      }, { quoted: msg });
    } else {
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ Comando no reconocido. Escribe *!minas* para ver la ayuda.`
      }, { quoted: msg });
    }
    return;
  }

  if (!game || game.gameOver) {
    await sock.sendMessage(chatId, {
      text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] No hay partida activa. Usa *!minas nuevo* para iniciar.`
    }, { quoted: msg });
    return;
  }

  const result = revealCell(game, coord.row, coord.col);
  game.lastPlayer = senderName;

  if (result === 'already') {
    await sock.sendMessage(chatId, {
      text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ Esa celda ya fue revelada.`
    }, { quoted: msg });
    return;
  }

  if (result === 'flagged') {
    const colLabel = String.fromCharCode(65 + coord.col);
    await sock.sendMessage(chatId, {
      text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ Esa celda tiene bandera 🚩\n` +
            `Usa *!minas bandera ${colLabel}${coord.row + 1}* para quitarla primero.`
    }, { quoted: msg });
    return;
  }

  // Construir mensaje según resultado
  let prefix = '';
  if (result === 'boom') {
    prefix = `💥 *¡${senderName} pisó una mina!*\n\n`;
  } else if (result === 'win') {
    prefix = `🎊 *¡${senderName} completó el Buscaminas!* 🏆\n\n`;
  }

  await sock.sendMessage(chatId, {
    text: prefix + renderBoard(game)
  }, { quoted: msg });

  // Limpiar partidas terminadas
  if (game.gameOver) {
    activeGames.delete(chatId);
  }
}
