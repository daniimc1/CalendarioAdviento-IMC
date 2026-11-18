const canvas = document.getElementById('canvas-arbol-3d');
const ctx = canvas.getContext('2d');

// Escala de la interfaz (--escala-ui en styles.css): 0.75 en escritorio, como el zoom al 75%.
// El lienzo tiene los píxeles reales, pero se dibuja en un tamaño lógico mayor
// (ancho / escalaUI) y se encoge con setTransform. Se llama escalaUI para no
// confundirla con la "escala" de perspectiva 3D que se usa más abajo.
//
// RESPONSIVE DE LA ESCENA (árbol + regalos):
//  - Escritorio (≥ 1366px): tamaño completo, a los lados de la tarjeta.
//  - Escritorio pequeño (951-1365px): igual, pero proporcionalmente más pequeña
//    para que no toque la tarjeta.
//  - Tablet (768-950px): pequeña y abajo, en las esquinas inferiores (enmarca el formulario).
//  - Móvil (< 768px): aún más pequeña, abajo, en el hueco que deja la tarjeta
//    (styles.css sube la tarjeta en móvil). Solo se oculta si la pantalla es diminuta.
// Se consigue con la misma técnica que la escala del 75%: el tamaño lógico crece
// (ancho / escalaUI) y todo se dibuja proporcionalmente más pequeño.
let escalaUI = 1, ancho = 0, alto = 0, enTablet = false, enMovil = false, ocultarEscena = false;
function ajustarLienzo() {
    const escalaCSS = parseFloat(getComputedStyle(document.body).getPropertyValue('--escala-ui')) || 1;
    const anchoReal = window.innerWidth;
    const altoReal = window.innerHeight;
    enTablet = anchoReal >= 768 && anchoReal <= 950;
    enMovil = anchoReal < 768;
    ocultarEscena = anchoReal < 300 || (enMovil && altoReal < 560);   // No hay sitio sin tapar el formulario
    // Móvil: el árbol mide ~1/5 del alto de la pantalla y nunca más ancho de lo que cabe
    const escalaEscena = enMovil
        ? Math.min(0.42, (altoReal * 0.20) / 560, anchoReal / 900)
        : Math.min(1, anchoReal / 1366);
    escalaUI = escalaCSS * escalaEscena;
    canvas.width = anchoReal;
    canvas.height = window.innerHeight;
    ancho = anchoReal / escalaUI;
    alto = window.innerHeight / escalaUI;
}
ajustarLienzo();
window.addEventListener('resize', ajustarLienzo);

let rotacionY = 0;
let progresoDibujo = 0; 
let anguloEstrella = 0;

// Paleta corporativa festiva
const colores = [
    { r: 255, g: 249, b: 82 },  // Amarillo
    { r: 245, g: 56,  b: 150 }, // Rosa Bebé Llorón
    { r: 10,  g: 83,  b: 222 }, // Azul corporativo
    { r: 251, g: 69,  b: 69 },  // Rojo
    { r: 39,  g: 174, b: 96 }   // Verde
];

/* ==========================================================
   0. BOKEH LUMINOSO Y VISIBLE (ORBES CÁLIDOS DE FONDO)
   ========================================================== */
const totalBokehs = 26;

// Degradado radial de cada color pintado una sola vez (rendimiento: antes se creaba en cada fotograma)
const spritesBokeh = {};
function spriteBokeh(color) {
    const clave = color.r + ',' + color.g + ',' + color.b;
    if (!spritesBokeh[clave]) {
        const lienzo = document.createElement('canvas');
        lienzo.width = lienzo.height = 128;
        const c = lienzo.getContext('2d');
        const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
        grad.addColorStop(0.55, `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`);
        grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        c.fillStyle = grad;
        c.fillRect(0, 0, 128, 128);
        spritesBokeh[clave] = lienzo;
    }
    return spritesBokeh[clave];
}
const particulasBokeh = [];

// Tonos específicos para el bokeh: dorados cálidos, blanco perla y melocotón suave
const coloresBokeh = [
    { r: 255, g: 240, b: 180 }, // Oro suave
    { r: 255, g: 255, b: 255 }, // Blanco cálido
    { r: 255, g: 215, b: 150 }, // Ámbar festivo
    { r: 255, g: 190, b: 220 }  // Rosa translúcido
];

for (let i = 0; i < totalBokehs; i++) {
    particulasBokeh.push({
        x: Math.random() * ancho,
        y: Math.random() * alto,
        radio: Math.random() * 45 + 20, // Orbes medianos y grandes
        color: coloresBokeh[i % coloresBokeh.length],
        velocidadY: -(Math.random() * 0.22 + 0.08),
        velocidadX: (Math.random() - 0.5) * 0.12,
        // Opacidad visible (0.18 a 0.35) para destacar contra el degradado rosa
        opacidadBase: Math.random() * 0.22 + 0.34,
        fase: Math.random() * Math.PI * 2
    });
}

/* ==========================================================
   1. PUNTOS DEL ÁRBOL 3D
   ========================================================== */
const totalPuntosArbol = 520;
const puntosArbol = [];

for (let i = 0; i < totalPuntosArbol; i++) {
    const frac = i / totalPuntosArbol;
    const t = Math.pow(frac, 1.25); 

    const radio = t * 215 + 10;
    const angulo = t * Math.PI * 28;

    puntosArbol.push({
        xOrig: Math.cos(angulo) * radio,
        yOrig: (0.5 - t) * 510,
        zOrig: Math.sin(angulo) * radio,
        color: colores[i % colores.length],
        tamanoBase: Math.random() * 1.8 + 2.2,
        tRelativo: frac * 0.46
    });
}

/* ==========================================================
   2. RÁFAGA DE POLVO DE HADAS (de la estrella del árbol a los regalos)
   No hay línea: el "haz" lo forman las propias partículas,
   que avanzan por la curva y se reciclan al llegar al final.
   ========================================================== */
const totalPolvoHadas = 320;
const polvoHadas = [];

const coloresPolvo = [
    { r: 255, g: 255, b: 255 }, // Blanco
    { r: 255, g: 248, b: 200 }, // Blanco cálido
    { r: 255, g: 223, b: 120 }, // Dorado claro
    { r: 255, g: 196, b: 70 }   // Dorado intenso
];

// Rellena (o recicla) una partícula con valores aleatorios
function prepararPolvo(p, tInicial) {
    const esNucleo = Math.random() < 0.55;      // 55% forman el haz central

    p.t = tInicial;
    p.velocidad = Math.random() * 0.0025 + 0.0015; // Avance por la curva en cada frame
    p.esNucleo = esNucleo;
    // Separación respecto al centro del haz: pequeña en el núcleo, amplia en el halo
    p.separacion = esNucleo ? Math.random() * 4 : Math.random() * 16 + 4;
    p.anguloSep = Math.random() * Math.PI * 2;
    p.deriva = esNucleo ? 0 : Math.random() * 18 + 6; // El halo se abre y "flota" al avanzar
    p.radio = esNucleo ? Math.random() * 0.9 + 0.5 : Math.random() * 1.6 + 0.6;
    p.esEstrella = !esNucleo && Math.random() < 0.12;
    p.color = coloresPolvo[Math.floor(Math.random() * coloresPolvo.length)];
    p.velocidadBrillo = Math.random() * 0.012 + 0.004;
    p.fase = Math.random() * Math.PI * 2;
}

for (let i = 0; i < totalPolvoHadas; i++) {
    const p = {};
    prepararPolvo(p, Math.random());
    polvoHadas.push(p);
}

/* ==========================================================
   3. LOS 18 REGALOS Y TARJETAS (CON HOVER INDIVIDUAL)
   ========================================================== */
const regalos18 = [
    { id: 1,  tipo: 'caja',    x: -110, y: -15,  w: 64, h: 74, d: 24, col: '#0055A5', cinta: '#fff952', delay: 0.68 },
    { id: 2,  tipo: 'caja',    x: -30,  y: -25,  w: 76, h: 64, d: 26, col: '#24D024', cinta: '#ffffff', delay: 0.70 },
    { id: 3,  tipo: 'tarjeta', x: 60,   y: -18,  w: 56, h: 36, d: 10, col: '#fff952', cinta: '#E3001B', delay: 0.71 },
    { id: 4,  tipo: 'caja',    x: 130,  y: 0,    w: 68, h: 70, d: 24, col: '#E3001B', cinta: '#fff952', delay: 0.72 },
    { id: 5,  tipo: 'caja',    x: -65,  y: -70,  w: 56, h: 52, d: 20, col: '#f53896', cinta: '#fff952', delay: 0.74 },
    { id: 6,  tipo: 'caja',    x: 15,   y: -85,  w: 52, h: 48, d: 20, col: '#fff952', cinta: '#0A53DE', delay: 0.75 },
    { id: 7,  tipo: 'tarjeta', x: 85,   y: -58,  w: 52, h: 32, d: 10, col: '#0055A5', cinta: '#fff952', delay: 0.76 },
    { id: 8,  tipo: 'caja',    x: -140, y: 35,   w: 64, h: 58, d: 22, col: '#E3001B', cinta: '#ffffff', delay: 0.78 },
    { id: 9,  tipo: 'caja',    x: -85,  y: 38,   w: 70, h: 64, d: 24, col: '#f53896', cinta: '#0055A5', delay: 0.80 },
    { id: 10, tipo: 'caja',    x: -10,  y: 28,   w: 80, h: 66, d: 26, col: '#0A53DE', cinta: '#fff952', delay: 0.82 },
    { id: 11, tipo: 'caja',    x: 65,   y: 32,   w: 68, h: 62, d: 24, col: '#24D024', cinta: '#E3001B', delay: 0.84 },
    { id: 12, tipo: 'tarjeta', x: 135,  y: 46,   w: 54, h: 32, d: 10, col: '#f53896', cinta: '#fff952', delay: 0.86 },
    { id: 13, tipo: 'tarjeta', x: -150, y: 92,   w: 54, h: 32, d: 10, col: '#fff952', cinta: '#0055A5', delay: 0.88 },
    { id: 14, tipo: 'caja',    x: -95,  y: 90,   w: 62, h: 52, d: 20, col: '#24D024', cinta: '#ffffff', delay: 0.90 },
    { id: 15, tipo: 'caja',    x: -25,  y: 84,   w: 76, h: 54, d: 22, col: '#E3001B', cinta: '#fff952', delay: 0.92 },
    { id: 16, tipo: 'caja',    x: 45,   y: 88,   w: 70, h: 50, d: 20, col: '#fff952', cinta: '#0055A5', delay: 0.94 },
    { id: 17, tipo: 'caja',    x: 115,  y: 92,   w: 64, h: 48, d: 20, col: '#f53896', cinta: '#ffffff', delay: 0.95 },
    { id: 18, tipo: 'caja',    x: -25,  y: -125, w: 46, h: 42, d: 18, col: '#E3001B', cinta: '#fff952', delay: 0.96 }
];

regalos18.forEach((r) => {
    r.escalaHover = 1.0;
    r.offsetY = 0;
});

regalos18.sort((a, b) => a.y - b.y);

let indiceRegaloHover = null;

const destellosRegalos = [];
for (let i = 0; i < 40; i++) {
    destellosRegalos.push({
        xRel: (Math.random() - 0.5) * 380,
        yRel: (Math.random() - 0.5) * 260,
        radio: Math.random() * 2 + 1,
        color: colores[i % colores.length],
        fase: Math.random() * Math.PI * 2
    });
}

/* ==========================================================
   LISTENERS GLOBALES
   ========================================================== */
const contenedorLogo = document.querySelector('.logo-superior-derecha');
if (contenedorLogo) {
    setTimeout(() => {
        contenedorLogo.classList.add('visible');
    }, 3400);
}

window.addEventListener('mousemove', (e) => {
    if (progresoDibujo < 0.95) {
        indiceRegaloHover = null;
        return;
    }

    const mouseX = e.clientX / escalaUI;   // Ratón en píxeles de pantalla -> tamaño lógico
    const mouseY = e.clientY / escalaUI;

    // Misma posición de la pila de regalos que en animar()
    const rX = ancho * (enMovil ? 0.76 : enTablet ? 0.85 : 0.80);
    const rY = enMovil ? alto - 250 : enTablet ? alto - 190 : alto * 0.72;

    let encontrado = null;

    for (let i = regalos18.length - 1; i >= 0; i--) {
        const r = regalos18[i];
        const cajaX = rX + r.x;
        const cajaY = rY + r.y;
        const prof = r.d || 0;

        if (
            mouseX >= cajaX - r.w / 2 &&
            mouseX <= cajaX + r.w / 2 + prof &&
            mouseY >= cajaY - r.h / 2 - prof * 0.5 &&
            mouseY <= cajaY + r.h / 2
        ) {
            encontrado = i;
            break;
        }
    }

    indiceRegaloHover = encontrado;
    document.body.style.cursor = encontrado !== null ? 'pointer' : 'default';
});

/* ==========================================================
   UTILIDADES GRÁFICAS SEGURAS
   ========================================================== */
function oscurecerColor(colorStr, factor) {
    if (!colorStr) return '#999999';
    if (colorStr.toLowerCase() === '#ffffff') return 'rgb(215,215,215)';
    let hex = colorStr.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (isNaN(num)) return colorStr;
    const r = Math.min(255, Math.max(0, Math.floor(((num >> 16) & 255) * factor)));
    const g = Math.min(255, Math.max(0, Math.floor(((num >> 8) & 255) * factor)));
    const b = Math.min(255, Math.max(0, Math.floor((num & 255) * factor)));
    return `rgb(${r},${g},${b})`;
}

function dibujarLazoNavideno(cx, cy, d, escalaAnim, colorCinta) {
    const esc = Math.max(0.2, escalaAnim || 1);
    const centroX = cx + d * 0.5;
    const centroY = cy - d * 0.25;

    ctx.save();
    ctx.fillStyle = colorCinta;
    ctx.strokeStyle = oscurecerColor(colorCinta, 0.7);
    ctx.lineWidth = 1;

    const rX = Math.max(1, 7 * esc);
    const rY = Math.max(1, 4 * esc);

    ctx.beginPath();
    ctx.ellipse(centroX - 7 * esc, centroY - 5 * esc, rX, rY, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(centroX + 7 * esc, centroY - 5 * esc, rX, rY, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centroX, centroY, Math.max(1, 3.5 * esc), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centroX - 2 * esc, centroY + 2 * esc);
    ctx.quadraticCurveTo(centroX - 8 * esc, centroY + 9 * esc, centroX - 11 * esc, centroY + 13 * esc);
    ctx.quadraticCurveTo(centroX - 5 * esc, centroY + 8 * esc, centroX, centroY + 3 * esc);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centroX + 2 * esc, centroY + 2 * esc);
    ctx.quadraticCurveTo(centroX + 8 * esc, centroY + 9 * esc, centroX + 11 * esc, centroY + 13 * esc);
    ctx.quadraticCurveTo(centroX + 5 * esc, centroY + 8 * esc, centroX, centroY + 3 * esc);
    ctx.fill();

    ctx.restore();
}

function renderizarElementoRegalo(cx, cy, w, h, d, colBase, colCinta, esTarjeta, escalaAnim) {
    if (w <= 0 || h <= 0) return;
    const esc = Math.max(0.2, escalaAnim || 1);

    const colSuperior = colBase;
    const colFrontal = oscurecerColor(colBase, 0.88);
    const colLateral = oscurecerColor(colBase, 0.72);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.beginPath();
    ctx.ellipse(cx + d * 0.4, cy + h / 2 + 4, Math.max(1, w * 0.58), Math.max(1, 6 * esc), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colFrontal;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    ctx.fillStyle = colLateral;
    ctx.beginPath();
    ctx.moveTo(cx + w / 2, cy - h / 2);
    ctx.lineTo(cx + w / 2 + d, cy - h / 2 - d * 0.5);
    ctx.lineTo(cx + w / 2 + d, cy + h / 2 - d * 0.5);
    ctx.lineTo(cx + w / 2, cy + h / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colSuperior;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h / 2);
    ctx.lineTo(cx - w / 2 + d, cy - h / 2 - d * 0.5);
    ctx.lineTo(cx + w / 2 + d, cy - h / 2 - d * 0.5);
    ctx.lineTo(cx + w / 2, cy - h / 2);
    ctx.closePath();
    ctx.fill();

    if (esTarjeta) {
        ctx.fillStyle = colCinta;
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, cy - h / 2);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + w / 2, cy - h / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff952';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, 3.5 * esc), 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = colCinta;
        ctx.fillRect(cx - 3, cy - h / 2, 6, h);

        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - h / 2);
        ctx.lineTo(cx - 3 + d, cy - h / 2 - d * 0.5);
        ctx.lineTo(cx + 3 + d, cy - h / 2 - d * 0.5);
        ctx.lineTo(cx + 3, cy - h / 2);
        ctx.closePath();
        ctx.fill();

        dibujarLazoNavideno(cx, cy - h / 2, d, esc, colCinta);
    }
}

function dibujarEstrella(cx, cy, picos, radioExt, radioInt, rot, color) {
    const paso = Math.PI / picos;
    ctx.beginPath();
    for (let i = 0; i < 2 * picos; i++) {
        const r = (i % 2 === 0) ? radioExt : radioInt;
        const x = cx + Math.cos(i * paso + rot) * r;
        const y = cy + Math.sin(i * paso + rot) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

/* ==========================================================
   BUCLE PRINCIPAL DE ANIMACIÓN
   ========================================================== */
/* ==========================================================
   ESTELA MÁGICA (estrella del árbol -> bajo la tarjeta -> regalos)
   ========================================================== */
const chispasCascada = [];          // Chispas que caen desde la estela
const MAX_CHISPAS_CASCADA = 260;

// Recorrido de la estela para t entre 0 y 1:
//   0    -> 0.62 : Bézier cúbica desde la estrella, bajando por debajo de la tarjeta
//   0.62 -> 1    : arco que envuelve la pila de regalos por arriba
const TRAMO_CURVA = 0.62;
const ARCO_INICIO = 2.55;           // Ángulo (rad) abajo-izquierda de los regalos
const ARCO_FIN = ARCO_INICIO + 4.1; // Da la vuelta por arriba hasta abajo-derecha

function puntoEstela(t, geo) {
    // Elipse que rodea la pila de regalos
    const elipse = { cx: geo.regalosX, cy: geo.regalosY - 15, rx: 205, ry: 140 };

    if (t <= TRAMO_CURVA) {
        const u = t / TRAMO_CURVA;
        const p0 = { x: geo.estrellaX, y: geo.estrellaY + 16 };                    // Bajo la estrella
        const p1 = { x: geo.estrellaX + ancho * 0.05, y: geo.estrellaY + alto * 0.6 };
        const p2 = { x: ancho * 0.42, y: alto * 0.97 };                            // Pasa bajo la tarjeta
        const p3 = {                                                                // Entra en el arco
            x: elipse.cx + Math.cos(ARCO_INICIO) * elipse.rx,
            y: elipse.cy + Math.sin(ARCO_INICIO) * elipse.ry
        };
        const a = (1 - u) * (1 - u) * (1 - u);
        const b = 3 * (1 - u) * (1 - u) * u;
        const c = 3 * (1 - u) * u * u;
        const d = u * u * u;
        return {
            x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
            y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
        };
    }

    const v = (t - TRAMO_CURVA) / (1 - TRAMO_CURVA);
    const angulo = ARCO_INICIO + v * (ARCO_FIN - ARCO_INICIO);
    return {
        x: elipse.cx + Math.cos(angulo) * elipse.rx,
        y: elipse.cy + Math.sin(angulo) * elipse.ry
    };
}

// RENDIMIENTO: cada punto de luz (halo suave + núcleo) se pinta UNA vez por color en un
// lienzo pequeño ("sprite") y en cada fotograma solo se copia con drawImage, escalado
// y con su opacidad (globalAlpha). Antes eran 2 círculos por punto y por fotograma
// (más de 2.000 en total), cada uno con un color nuevo construido como texto.
const spritesLuz = {};
function spriteLuz(color, factorHalo, alphaHalo) {
    const clave = color.r + ',' + color.g + ',' + color.b + ',' + factorHalo + ',' + alphaHalo;
    if (!spritesLuz[clave]) {
        const R = 8;                                   // Radio del núcleo dentro del sprite
        const lado = Math.ceil(R * factorHalo * 2);
        const lienzo = document.createElement('canvas');
        lienzo.width = lienzo.height = lado;
        const c = lienzo.getContext('2d');
        const m = lado / 2;
        c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alphaHalo})`;   // Halo
        c.beginPath();
        c.arc(m, m, R * factorHalo, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;                   // Núcleo
        c.beginPath();
        c.arc(m, m, R, 0, Math.PI * 2);
        c.fill();
        spritesLuz[clave] = lienzo;
    }
    return spritesLuz[clave];
}

// Punto de luz de radio 'radio' con halo de radio * factorHalo
function dibujarLuz(color, x, y, radio, alpha, factorHalo, alphaHalo) {
    const tam = radio * factorHalo;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(spriteLuz(color, factorHalo, alphaHalo), x - tam, y - tam, tam * 2, tam * 2);
    ctx.globalAlpha = 1;
}

// Estrellita de 4 puntas
function destello4(x, y, tam) {
    ctx.beginPath();
    ctx.moveTo(x, y - tam * 1.8);
    ctx.lineTo(x + tam * 0.3, y - tam * 0.3);
    ctx.lineTo(x + tam * 1.8, y);
    ctx.lineTo(x + tam * 0.3, y + tam * 0.3);
    ctx.lineTo(x, y + tam * 1.8);
    ctx.lineTo(x - tam * 0.3, y + tam * 0.3);
    ctx.lineTo(x - tam * 1.8, y);
    ctx.lineTo(x - tam * 0.3, y - tam * 0.3);
    ctx.closePath();
    ctx.fill();
}

function emitirChispaCascada(x, y, fuerte) {
    if (chispasCascada.length >= MAX_CHISPAS_CASCADA) return;
    const esOro = Math.random() < 0.65;
    chispasCascada.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * (fuerte ? 1.2 : 0.5),
        vy: Math.random() * 0.4 + (fuerte ? 0.3 : 0.1),
        radio: Math.random() * (fuerte ? 1.8 : 1.2) + 0.5,
        esEstrella: Math.random() < 0.18,
        color: esOro ? { r: 255, g: 214, b: 90 } : { r: 255, g: 255, b: 255 },
        vida: 1,
        desgaste: Math.random() * 0.012 + 0.008,
        fase: Math.random() * Math.PI * 2,
        velocidadBrillo: Math.random() * 0.012 + 0.006
    });
}

function renderizarEstela(geo) {
    const tiempo = Date.now();
    // La estela "se dibuja" al principio y luego queda completa
    const progresoEstela = Math.min(1, Math.max(0, (progresoDibujo - 0.46) / 0.22));
    const sueloY = alto * 0.97;     // Las chispas se desvanecen antes de llegar aquí

    ctx.save();

    // --- A. Haz de polvo de hadas a lo largo del recorrido ---
    polvoHadas.forEach((p) => {
        p.t += p.velocidad;
        if (p.t > 1) prepararPolvo(p, 0);   // Llega a los regalos: renace en la estrella
        if (p.t > progresoEstela) return;

        const centro = puntoEstela(p.t, geo);
        const flotacion = Math.sin(tiempo * 0.002 + p.fase) * (p.esNucleo ? 1 : 4);
        const apertura = p.separacion + p.deriva * p.t * 0.6;
        const posX = centro.x + Math.cos(p.anguloSep) * apertura;
        const posY = centro.y + Math.sin(p.anguloSep) * apertura * 0.7 + flotacion;

        const fundido = Math.min(1, p.t * 12) * Math.min(1, (1 - p.t) * 6);
        const brillo = (Math.sin(tiempo * p.velocidadBrillo + p.fase) + 1) / 2;
        const alpha = (0.35 + brillo * 0.65) * fundido;
        if (alpha <= 0.02) return;

        if (p.esEstrella) {
            // Estrellitas (pocas): se dibujan igual que siempre
            ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha * 0.25})`;
            ctx.beginPath();
            ctx.arc(posX, posY, p.radio * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
            destello4(posX, posY, p.radio * (0.8 + brillo * 0.5));
        } else {
            dibujarLuz(p.color, posX, posY, p.radio, alpha, 3, 0.25);   // Halo x3 al 25% + núcleo
        }
    });

    // --- B. Cabeza: núcleo de luz que recorre la estela en bucle ---
    // Mientras se dibuja va en la punta; después cicla de la estrella a los regalos
    const tCabeza = progresoEstela < 1 ? progresoEstela : (tiempo * 0.00016) % 1;
    const cabeza = puntoEstela(tCabeza, geo);

    // Cascada: la cabeza suelta chispas fuertes y el resto del recorrido, suaves
    for (let i = 0; i < 3; i++) emitirChispaCascada(cabeza.x, cabeza.y, true);
    for (let i = 0; i < 2; i++) {
        const tAzar = Math.random() * progresoEstela;
        const punto = puntoEstela(tAzar, geo);
        emitirChispaCascada(punto.x, punto.y, false);
    }

    // Resplandor cálido (glow) con degradado radial: sin shadowBlur, más ligero
    const pulso = 1 + Math.sin(tiempo * 0.008) * 0.12;
    const radioGlow = 26 * pulso;
    const glow = ctx.createRadialGradient(cabeza.x, cabeza.y, 0, cabeza.x, cabeza.y, radioGlow);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    glow.addColorStop(0.18, 'rgba(255, 244, 190, 0.85)');
    glow.addColorStop(0.45, 'rgba(255, 205, 90, 0.35)');
    glow.addColorStop(1, 'rgba(255, 190, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cabeza.x, cabeza.y, radioGlow, 0, Math.PI * 2);
    ctx.fill();

    // Destello en cruz que gira despacio
    ctx.save();
    ctx.translate(cabeza.x, cabeza.y);
    ctx.rotate(tiempo * 0.002);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    destello4(0, 0, 5.5 * pulso);
    ctx.restore();

    // Núcleo blanco
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cabeza.x, cabeza.y, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // --- C. Cascada de chispas cayendo ---
    for (let i = chispasCascada.length - 1; i >= 0; i--) {
        const c = chispasCascada[i];
        c.x += c.vx + Math.sin(tiempo * 0.003 + c.fase) * 0.15;   // Vaivén suave
        c.y += c.vy;
        c.vy += 0.012;                                            // Gravedad muy ligera
        c.vida -= c.desgaste;

        // Se apaga antes de tocar el suelo
        const margenSuelo = Math.min(1, Math.max(0, (sueloY - c.y) / 70));
        if (c.vida <= 0 || margenSuelo <= 0) {
            chispasCascada.splice(i, 1);
            continue;
        }

        const centelleo = (Math.sin(tiempo * c.velocidadBrillo + c.fase) + 1) / 2;  // Opacidad senoidal
        const alpha = c.vida * margenSuelo * (0.3 + centelleo * 0.7);

        if (c.esEstrella) {
            ctx.fillStyle = `rgba(${c.color.r}, ${c.color.g}, ${c.color.b}, ${alpha * 0.25})`;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.radio * 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(${c.color.r}, ${c.color.g}, ${c.color.b}, ${alpha})`;
            destello4(c.x, c.y, c.radio * (0.7 + centelleo * 0.6));
        } else {
            dibujarLuz(c.color, c.x, c.y, c.radio, alpha, 2.8, 0.25);   // Halo x2.8 al 25% + núcleo
        }
    }

    ctx.restore();
}

function animar() {
    ctx.setTransform(escalaUI, 0, 0, escalaUI, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);

    if (progresoDibujo < 1) {
        progresoDibujo += 0.005;
    }

    rotacionY += 0.011;
    anguloEstrella += 0.008;

    const distanciaCamara = 650;
    const cosY = Math.cos(rotacionY);
    const sinY = Math.sin(rotacionY);

    // Tablet y móvil: árbol abajo a la izquierda y regalos abajo a la derecha (ver ajustarLienzo)
    const centroX = ancho * (enMovil ? 0.24 : enTablet ? 0.14 : 0.20);
    // Móvil: árbol algo más arriba, con aire por debajo (la perspectiva agranda la base
    // hasta ~1.5 veces, por eso el centro va 480 unidades por encima del borde)
    const centroY = enMovil ? alto - 480 : enTablet ? alto - 290 : alto * 0.47;
    const yPuntaEstrella = -(0.5 * 520) + centroY - 8;

    const regalosX = ancho * (enMovil ? 0.76 : enTablet ? 0.85 : 0.80);
    const regalosY = enMovil ? alto - 250 : enTablet ? alto - 190 : alto * 0.72;

    /* --------------------------------------------------------
       0. BOKEH LUMINOSO (CÍRCULOS DECORATIVOS VISIBLES)
       -------------------------------------------------------- */
    particulasBokeh.forEach((b) => {
        b.y += b.velocidadY;
        b.x += b.velocidadX;

        if (b.y < -b.radio * 2) b.y = alto + b.radio * 2;
        if (b.x < -b.radio * 2) b.x = ancho + b.radio * 2;
        if (b.x > ancho + b.radio * 2) b.x = -b.radio * 2;

        const pulso = (Math.sin(Date.now() * 0.0018 + b.fase) + 1) / 2;
        const alpha = b.opacidadBase * (0.75 + pulso * 1.25);

        // Degradado precalculado (spriteBokeh): se copia escalado con su opacidad
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(spriteBokeh(b.color), b.x - b.radio, b.y - b.radio, b.radio * 2, b.radio * 2);
        ctx.globalAlpha = 1;
    });

    // Pantallas diminutas: solo los orbes de luz; el árbol y los regalos taparían el formulario
    if (ocultarEscena) return;

    /* --------------------------------------------------------
       1. ÁRBOL 3D
       -------------------------------------------------------- */
    const proyectadosArbol = [];

    puntosArbol.forEach((p) => {
        if (p.tRelativo > progresoDibujo) return;

        const xRot = p.xOrig * cosY - p.zOrig * sinY;
        const zRot = p.xOrig * sinY + p.zOrig * cosY;
        const yRot = p.yOrig;

        const escala = distanciaCamara / (distanciaCamara + zRot);
        proyectadosArbol.push({
            x: xRot * escala + centroX,
            y: -yRot * escala + centroY,
            z: zRot,
            escala: escala,
            color: p.color,
            tamano: p.tamanoBase
        });
    });

    if (proyectadosArbol.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.8;
        ctx.moveTo(proyectadosArbol[0].x, proyectadosArbol[0].y);
        for (let i = 1; i < proyectadosArbol.length; i++) {
            ctx.lineTo(proyectadosArbol[i].x, proyectadosArbol[i].y);
        }
        ctx.stroke();
    }

    /* --------------------------------------------------------
       2. ESTELA MÁGICA: de la estrella del árbol a los regalos
       -------------------------------------------------------- */
    if (progresoDibujo > 0.46) {
        renderizarEstela({
            estrellaX: centroX,
            estrellaY: yPuntaEstrella,
            regalosX: regalosX,
            regalosY: regalosY
        });
    }

    /* --------------------------------------------------------
       3. BOMBILLAS DEL ÁRBOL
       -------------------------------------------------------- */
    proyectadosArbol.forEach((p) => {
        const opacidad = Math.min(1, Math.max(0.2, (p.z + 260) / 520));
        const radio = Math.max(0.8, p.tamano * p.escala);

        dibujarLuz(p.color, p.x, p.y, radio, opacidad, 2.6, 0.38);   // Halo x2.6 al 38% + bombilla

        if (p.z > 60 || p.z === 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacidad * 0.8})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radio * 0.45, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    /* --------------------------------------------------------
       4. LOS 18 REGALOS Y TARJETAS (HOVER INDIVIDUAL)
       -------------------------------------------------------- */
    if (progresoDibujo > 0.68) {
        regalos18.forEach((r, i) => {
            if (progresoDibujo < r.delay) return;

            const progresoElemento = Math.min(1, (progresoDibujo - r.delay) / 0.035);
            const escalaBase = Math.max(0.2, 0.4 + 0.6 * progresoElemento);

            const objetivoEscala = (indiceRegaloHover === i) ? 1.12 : 1.0;
            const objetivoOffsetY = (indiceRegaloHover === i) ? -8 : 0;

            r.escalaHover += (objetivoEscala - r.escalaHover) * 0.15;
            r.offsetY += (objetivoOffsetY - r.offsetY) * 0.15;

            const escalaFinal = escalaBase * r.escalaHover;

            renderizarElementoRegalo(
                regalosX + r.x * escalaBase,
                regalosY + (r.y + r.offsetY) * escalaBase,
                r.w * escalaFinal,
                r.h * escalaFinal,
                r.d * escalaFinal,
                r.col,
                r.cinta,
                r.tipo === 'tarjeta',
                escalaFinal
            );
        });

        destellosRegalos.forEach((d) => {
            const brillo = (Math.sin(Date.now() * 0.005 + d.fase) + 1) / 2;
            ctx.fillStyle = `rgba(${d.color.r}, ${d.color.g}, ${d.color.b}, ${brillo * 0.85})`;
            ctx.beginPath();
            ctx.arc(regalosX + d.xRel, regalosY + d.yRel, Math.max(0.5, d.radio * brillo), 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /* --------------------------------------------------------
       5. ESTRELLA DEL ÁRBOL
       -------------------------------------------------------- */
    if (proyectadosArbol.length > 0) {
        const brilloPulso = Math.sin(Date.now() * 0.005) * 5 + 18;

        ctx.save();
        ctx.shadowColor = '#fff952';
        ctx.shadowBlur = brilloPulso;
        dibujarEstrella(centroX, yPuntaEstrella, 5, 15, 6, anguloEstrella, '#fff952');
        dibujarEstrella(centroX, yPuntaEstrella, 5, 7, 3, anguloEstrella, '#ffffff');
        ctx.restore();
    }

    /* --------------------------------------------------------
       6. DESTELLO EN EL REGALO 18
       -------------------------------------------------------- */
    if (progresoDibujo >= 0.96 && ancho > 950) {
        const lazoX = regalosX - 25;
        const lazoY = regalosY - 150;
        const pulsoLazo = Math.sin(Date.now() * 0.006) * 4 + 14;

        ctx.save();
        ctx.shadowColor = '#fff952';
        ctx.shadowBlur = pulsoLazo;
        dibujarEstrella(lazoX, lazoY, 4, 12, 5, -anguloEstrella, '#fff952');
        dibujarEstrella(lazoX, lazoY, 4, 6, 2, -anguloEstrella, '#ffffff');
        ctx.restore();
    }

}

// Un único bucle para todos los canvas (js/motor-animacion.js)
registrarAnimacion(animar);