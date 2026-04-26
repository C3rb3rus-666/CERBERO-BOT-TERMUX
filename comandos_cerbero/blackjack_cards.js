/**
 * blackjack_cards.js
 * Genera una imagen compuesta de las cartas de blackjack usando canvas.
 * Las cartas se renderizan con colores, palos y valores reales.
 */

import { createCanvas } from 'canvas';

const CARD_W = 80;
const CARD_H = 110;
const PADDING = 12;
const RADIUS = 8;

const PALO_EMOJI = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
const ROJO = '#D32F2F';
const NEGRO = '#1A1A1A';
const VERDE_MESA = '#1B5E20';
const OCULTA_BG = '#1565C0';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function dibujarCartaOculta(ctx, x, y) {
  // Fondo azul oscuro con patrón de rombos
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fillStyle = OCULTA_BG;
  ctx.fill();
  ctx.strokeStyle = '#90CAF9';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Patrón interior
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#1976D2';
  for (let dy = -CARD_H; dy < CARD_H * 2; dy += 12) {
    for (let dx = -CARD_W; dx < CARD_W * 2; dx += 12) {
      ctx.fillRect(x + dx, y + dy, 6, 6);
    }
  }
  ctx.restore();

  // Símbolo central
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#E3F2FD';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', x + CARD_W / 2, y + CARD_H / 2);
}

function dibujarCarta(ctx, x, y, valor, palo) {
  const esRojo = palo === '♥' || palo === '♦';
  const color = esRojo ? ROJO : NEGRO;

  // Sombra
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  // Fondo blanco con borde
  roundRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fillStyle = '#FAFAFA';
  ctx.fill();
  ctx.strokeStyle = '#BDBDBD';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Valor + palo arriba-izquierda
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(String(valor), x + 6, y + 5);

  ctx.font = '13px Arial';
  ctx.fillText(palo, x + 6, y + 22);

  // Valor + palo abajo-derecha (rotado 180°)
  ctx.save();
  ctx.translate(x + CARD_W - 6, y + CARD_H - 5);
  ctx.rotate(Math.PI);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = color;
  ctx.fillText(String(valor), 0, 0);
  ctx.font = '13px Arial';
  ctx.fillText(palo, 0, 17);
  ctx.restore();

  // Símbolo central grande
  ctx.font = `${CARD_W * 0.45}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(palo, x + CARD_W / 2, y + CARD_H / 2 + 4);
}

/**
 * Genera un Buffer PNG con las cartas mostradas.
 * @param {Array} cartasJugador - Array de objetos {valor, palo}
 * @param {Array} cartasCrupier - Array de objetos {valor, palo}
 * @param {boolean} mostrarTodoCrupier - Si false, oculta la segunda carta del crupier
 * @param {number} totalJugador
 * @param {number} totalCrupier - Solo relevante si mostrarTodoCrupier=true
 */
export function generarImagenBlackjack(cartasJugador, cartasCrupier, mostrarTodoCrupier, totalJugador, totalCrupier) {
  const maxCartas = Math.max(cartasJugador.length, cartasCrupier.length);
  const anchoCartas = maxCartas * (CARD_W + PADDING) + PADDING;
  const ancho = Math.max(anchoCartas, 300);
  const alto = 2 * (CARD_H + PADDING * 3) + 60; // 2 filas + etiquetas

  const canvas = createCanvas(ancho, alto);
  const ctx = canvas.getContext('2d');

  // Fondo mesa verde
  ctx.fillStyle = VERDE_MESA;
  ctx.fillRect(0, 0, ancho, alto);

  // Textura de mesa (líneas sutiles)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < ancho; i += 20) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, alto); ctx.stroke();
  }

  // ── Fila CRUPIER ──
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#FFF176';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const labelCrupierTotal = mostrarTodoCrupier ? ` (${totalCrupier})` : ' (??)';
  ctx.fillText(`🎩 CRUPIER${labelCrupierTotal}`, PADDING, 18);

  const filaY1 = 30;
  for (let i = 0; i < cartasCrupier.length; i++) {
    const cx = PADDING + i * (CARD_W + PADDING);
    if (!mostrarTodoCrupier && i === 1) {
      dibujarCartaOculta(ctx, cx, filaY1);
    } else {
      dibujarCarta(ctx, cx, filaY1, cartasCrupier[i].valor, cartasCrupier[i].palo);
    }
  }

  // ── Fila JUGADOR ──
  const filaY2 = filaY1 + CARD_H + PADDING * 2 + 20;
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#A5D6A7';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🃏 TÚ (${totalJugador})`, PADDING, filaY2 - 16);

  for (let i = 0; i < cartasJugador.length; i++) {
    const cx = PADDING + i * (CARD_W + PADDING);
    dibujarCarta(ctx, cx, filaY2, cartasJugador[i].valor, cartasJugador[i].palo);
  }

  return canvas.toBuffer('image/png');
}
