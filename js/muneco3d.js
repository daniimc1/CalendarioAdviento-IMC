/* =============================================================
   MUÑECO DE NIEVE 3D - MASCOTA IMC TOYS (Canvas 2D)
   - Volumen con degradados radiales, sombrero de copa y chapa con el logo.
   - Estados: 'idle' | 'saludo' | 'exito' | 'duda'
   - Control externo:  window.cambiarEstadoMuneco('exito')
   - También escucha el evento 'correo:validacion' de validaciones.js
   Autocontenido: solo necesita un <canvas id="canvas-muneco">.
   ============================================================= */
(function () {
    const canvas = document.getElementById('canvas-muneco');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    // Escala de la interfaz (--escala-ui en styles.css): 0.75 en login/registro de escritorio.
    // El lienzo tiene los píxeles reales de la ventana, pero se dibuja en un tamaño
    // "lógico" mayor (ancho / escala) y se encoge con setTransform: igual que el zoom del navegador.
    let escala = 1, ancho = 0, alto = 0;
    function ajustarLienzo() {
        escala = parseFloat(getComputedStyle(document.body).getPropertyValue('--escala-ui')) || 1;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ancho = window.innerWidth / escala;
        alto = window.innerHeight / escala;
    }
    ajustarLienzo();
    window.addEventListener('resize', ajustarLienzo);

    /* ----------------------------------------------------------
       CONFIGURACIÓN
       ---------------------------------------------------------- */
    const PALETA = {
        rojo: '#E3001B',
        naranja: '#FF9E1B',
        verde: '#24D024',
        azul: '#0055A5',
        azulOscuro: '#003B73',
        amarillo: '#fff952',
        dorado: '#FFD24A'
    };

    const RADIO_BASE = 135;
    const RADIO_CABEZA = 85;
    const ALTO_TOTAL = 560;          // Del suelo a la punta del sombrero (para escalar)

    // Centros relativos al punto del suelo (0, 0), en "unidades de diseño"
    const Y_BASE = -RADIO_BASE;                                  // -135
    const Y_CUELLO = -RADIO_BASE * 2 + 20;                       // -250 (unión de las bolas)
    const Y_CABEZA = Y_CUELLO - RADIO_CABEZA + 15;               // -320

    // Logo corporativo para la chapa
    const logo = new Image();
    logo.src = '../img/logo-imc-sinfondo.png';

    /* ----------------------------------------------------------
       ESTADO
       ---------------------------------------------------------- */
    let estado = 'idle';             // Estado que se dibuja
    let estadoBase = 'idle';         // Último estado que pidió el formulario
    let hoverActivo = false;

    let anguloBrazo = 0.35;          // Ángulo actual del brazo derecho (radianes)
    let inclinacionCabeza = 0;       // Inclinación actual de la cabeza
    let aperturaSonrisa = 0;         // 0 = sonrisa normal, 1 = gran sonrisa
    let inicioSalto = -1;            // Momento en que empezó el saltito de 'exito'

    const particulas = [];

    /* ----------------------------------------------------------
       POSICIÓN Y ESCALA SEGÚN LA PANTALLA
       ---------------------------------------------------------- */
    function colocacion() {
        if (ancho > 950) {
            // Escritorio: a la izquierda, ocupando buena parte del alto
            const escala = Math.min(1, (alto * 0.86) / ALTO_TOTAL);
            return { x: ancho * 0.16, suelo: alto * 0.94, escala: escala };
        }
        if (ancho < 768) {
            // Móvil: abajo a la izquierda, en el hueco bajo el formulario (no lo tapa)
            const escala = Math.min(0.46, (alto * 0.29) / ALTO_TOTAL);   // ~245px de alto en un móvil de 844px
            return { x: ancho * 0.25, suelo: alto * 0.985, escala: escala };
        }
        // Tablet: centrado abajo y más pequeño, asomando bajo el formulario
        const escala = Math.min(0.55, (alto * 0.45) / ALTO_TOTAL);
        return { x: ancho * 0.5, suelo: alto * 0.99, escala: escala };
    }

    /* ----------------------------------------------------------
       UTILIDADES DE DIBUJO
       ---------------------------------------------------------- */
    // Esfera con volumen: luz arriba-izquierda, sombra lila/azulada abajo-derecha
    function esferaNieve(cx, cy, r) {
        const grad = ctx.createRadialGradient(
            cx - r * 0.38, cy - r * 0.42, r * 0.05,
            cx + r * 0.1, cy + r * 0.12, r * 1.05
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, '#f6f8ff');
        grad.addColorStop(0.7, '#dfe3f6');
        grad.addColorStop(0.9, '#c3c3e6');
        grad.addColorStop(1, '#a9a6d6');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Luz de borde (rim light) abajo-derecha: refuerza el 3D
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        const rim = ctx.createRadialGradient(cx + r * 0.55, cy + r * 0.6, 0, cx + r * 0.55, cy + r * 0.6, r * 0.6);
        rim.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        rim.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = rim;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
    }

    // Brillo plástico de juguete (punto blanco)
    function brilloPlastico(x, y, r, alpha) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Estrella de 4 puntas (para las chispas)
    function estrella4(x, y, tam) {
        ctx.beginPath();
        ctx.moveTo(x, y - tam);
        ctx.lineTo(x + tam * 0.22, y - tam * 0.22);
        ctx.lineTo(x + tam, y);
        ctx.lineTo(x + tam * 0.22, y + tam * 0.22);
        ctx.lineTo(x, y + tam);
        ctx.lineTo(x - tam * 0.22, y + tam * 0.22);
        ctx.lineTo(x - tam, y);
        ctx.lineTo(x - tam * 0.22, y - tam * 0.22);
        ctx.closePath();
        ctx.fill();
    }

    // Rama con ramitas (brazo)
    function dibujarRama(largo) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Sombra de la rama
        ctx.strokeStyle = 'rgba(60, 35, 25, 0.35)';
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.lineTo(largo, 3);
        ctx.stroke();

        // Tronco con degradado
        const grad = ctx.createLinearGradient(0, -5, 0, 5);
        grad.addColorStop(0, '#9a6b4f');
        grad.addColorStop(1, '#5d3a28');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(largo * 0.5, -6, largo, 0);
        ctx.stroke();

        // Ramitas laterales del brazo
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(largo * 0.45, -3);
        ctx.lineTo(largo * 0.55, 18);
        ctx.moveTo(largo * 0.68, -3);
        ctx.lineTo(largo * 0.8, -22);
        ctx.stroke();

        // Mano: 3 dedos en abanico en la punta
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(largo, 0);
        ctx.lineTo(largo + 18, -17);   // Dedo superior
        ctx.moveTo(largo, 0);
        ctx.lineTo(largo + 24, 0);     // Dedo central
        ctx.moveTo(largo, 0);
        ctx.lineTo(largo + 18, 16);    // Dedo inferior
        ctx.stroke();
    }

    /* ----------------------------------------------------------
       PARTES DEL MUÑECO
       ---------------------------------------------------------- */
    function dibujarSombraSuelo(salto) {
        // Cuanto más alto salta, más pequeña y suave es la sombra
        const factor = 1 - Math.min(0.4, salto / 120);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, RADIO_BASE * 1.15 * factor);
        grad.addColorStop(0, 'rgba(70, 40, 110, 0.28)');
        grad.addColorStop(1, 'rgba(70, 40, 110, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, RADIO_BASE * 1.15 * factor, 26 * factor, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function dibujarBotones() {
        const colores = [PALETA.rojo, PALETA.naranja, PALETA.verde];
        const lado = 26;

        colores.forEach((color, i) => {
            const bx = 6 - i * 3;                       // Ligera curva siguiendo la esfera
            const by = Y_BASE - 70 + i * 48;

            // Sombra proyectada sobre la nieve
            ctx.fillStyle = 'rgba(80, 60, 140, 0.22)';
            ctx.beginPath();
            ctx.roundRect(bx - lado / 2 + 4, by - lado / 2 + 5, lado, lado, 7);
            ctx.fill();

            // Cara lateral (relieve)
            ctx.fillStyle = shade(color, 0.7);
            ctx.beginPath();
            ctx.roundRect(bx - lado / 2 + 2, by - lado / 2 + 3, lado, lado, 7);
            ctx.fill();

            // Cara frontal con degradado
            const grad = ctx.createLinearGradient(bx - lado / 2, by - lado / 2, bx + lado / 2, by + lado / 2);
            grad.addColorStop(0, shade(color, 1.25));
            grad.addColorStop(1, color);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(bx - lado / 2, by - lado / 2, lado, lado, 7);
            ctx.fill();

            // Brillo plástico
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.beginPath();
            ctx.roundRect(bx - lado / 2 + 4, by - lado / 2 + 3, lado - 12, 6, 3);
            ctx.fill();
            brilloPlastico(bx + 6, by + 5, 1.8, 0.5);
        });
    }

    function dibujarBufanda(tiempo) {
        const y = Y_CUELLO;
        const franjas = [PALETA.rojo, PALETA.naranja, PALETA.verde];

        // --- Extremo colgante (detrás del nudo), ondulando con el viento ---
        ctx.save();
        ctx.translate(-38, y + 14);
        const segmentos = 6;
        const largoSeg = 18;
        const anchoCola = 34;
        let px = 0;
        let py = 0;
        const puntosIzq = [];
        const puntosDer = [];
        for (let i = 0; i <= segmentos; i++) {
            const onda = Math.sin(tiempo * 0.004 - i * 0.7) * (i * 2.2); // Más movimiento en la punta
            const x = px + onda;
            const yy = py + i * largoSeg;
            puntosIzq.push([x - anchoCola / 2, yy]);
            puntosDer.push([x + anchoCola / 2, yy]);
        }
        ctx.fillStyle = PALETA.azulOscuro;
        ctx.beginPath();
        ctx.moveTo(puntosIzq[0][0], puntosIzq[0][1]);
        puntosIzq.forEach(([x, yy]) => ctx.lineTo(x, yy));
        for (let i = puntosDer.length - 1; i >= 0; i--) ctx.lineTo(puntosDer[i][0], puntosDer[i][1]);
        ctx.closePath();
        ctx.fill();

        // Franjas en la cola
        franjas.forEach((color, i) => {
            const idx = 3 + i;
            if (!puntosIzq[idx + 1]) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(puntosIzq[idx][0], puntosIzq[idx][1]);
            ctx.lineTo(puntosDer[idx][0], puntosDer[idx][1]);
            ctx.lineTo(puntosDer[idx][0], puntosDer[idx][1] + 9);
            ctx.lineTo(puntosIzq[idx][0], puntosIzq[idx][1] + 9);
            ctx.closePath();
            ctx.fill();
        });

        // Flecos de la punta
        const ultimo = puntosIzq.length - 1;
        ctx.strokeStyle = PALETA.azul;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let f = 0; f < 5; f++) {
            const fx = puntosIzq[ultimo][0] + 4 + f * 6.5;
            const fy = puntosIzq[ultimo][1];
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx + Math.sin(tiempo * 0.006 + f) * 3, fy + 12);
            ctx.stroke();
        }
        ctx.restore();

        // --- Lazo alrededor del cuello: ancho y mullido ---
        const grad = ctx.createLinearGradient(0, y - 22, 0, y + 24);
        grad.addColorStop(0, '#2f7fd0');
        grad.addColorStop(0.5, PALETA.azul);
        grad.addColorStop(1, PALETA.azulOscuro);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, y, RADIO_CABEZA * 0.98, 24, 0, 0, Math.PI * 2);
        ctx.fill();

        // Franjas verticales del lazo (recortadas a la forma de la bufanda)
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, y, RADIO_CABEZA * 0.98, 24, 0, 0, Math.PI * 2);
        ctx.clip();
        franjas.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.fillRect(-58 + i * 16, y - 26, 10, 52);
            ctx.fillRect(22 + i * 16, y - 26, 10, 52);
        });
        // Sombreado inferior para que parezca mullida
        const sombra = ctx.createLinearGradient(0, y - 24, 0, y + 24);
        sombra.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        sombra.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        sombra.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = sombra;
        ctx.fillRect(-RADIO_CABEZA, y - 26, RADIO_CABEZA * 2, 52);
        ctx.restore();

        // Nudo
        ctx.fillStyle = PALETA.azulOscuro;
        ctx.beginPath();
        ctx.ellipse(-30, y + 6, 20, 17, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function dibujarChapaLogo() {
        const cx = -30;
        const cy = Y_CUELLO + 10;
        const r = 44;          // Chapa más grande para que el logo se lea bien

        // Sombra del broche
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(cx + 2, cy + 4, r, 0, Math.PI * 2);
        ctx.fill();

        // Bisel metálico brillante
        const bisel = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        bisel.addColorStop(0, '#ffffff');
        bisel.addColorStop(0.3, '#d9dde6');
        bisel.addColorStop(0.55, '#9aa3b5');
        bisel.addColorStop(0.8, '#eef1f6');
        bisel.addColorStop(1, '#7d8699');
        ctx.fillStyle = bisel;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Esmalte blanco interior
        const esmalte = ctx.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, r - 4);
        esmalte.addColorStop(0, '#ffffff');
        esmalte.addColorStop(1, '#eef2f8');
        ctx.fillStyle = esmalte;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
        ctx.fill();

        // Logo (solo cuando la imagen ya ha cargado)
        if (logo.complete && logo.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
            ctx.clip();
            // El PNG (500x550) es casi todo transparente: el logo solo ocupa
            // la zona x 144-348, y 209-352. Recortamos esa zona (con un poco de aire)
            const recorte = { x: 136, y: 201, w: 220, h: 159 };
            const prop = recorte.w / recorte.h;
            const w = (r - 6) * 2 * 0.92;        // Ancho que cabe dentro del círculo
            const h = w / prop;
            ctx.drawImage(
                logo,
                recorte.x, recorte.y, recorte.w, recorte.h,   // Zona del PNG
                cx - w / 2, cy - h / 2, w, h                   // Dónde se pinta
            );
            ctx.restore();
        }

        // Reflejo de cristal sobre el esmalte
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
        ctx.clip();
        const reflejo = ctx.createLinearGradient(cx - r, cy - r, cx, cy);
        reflejo.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        reflejo.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = reflejo;
        ctx.beginPath();
        ctx.ellipse(cx - 10, cy - 14, r * 0.7, r * 0.35, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function dibujarCara(tiempo) {
        const cx = 0;
        const cy = Y_CABEZA;

        // Mofletes rosados
        ['-1', '1'].forEach((lado) => {
            const s = Number(lado);
            const grad = ctx.createRadialGradient(cx + s * 44, cy + 14, 0, cx + s * 44, cy + 14, 16);
            grad.addColorStop(0, 'rgba(255, 120, 160, 0.45)');
            grad.addColorStop(1, 'rgba(255, 120, 160, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx + s * 44, cy + 14, 16, 0, Math.PI * 2);
            ctx.fill();
        });

        // Ojos de carbón con brillo plástico (parpadeo cada ~4s)
        const parpadeo = (tiempo % 4200) < 140 ? 0.15 : 1;
        [-1, 1].forEach((s) => {
            const ex = cx + s * 27;
            const ey = cy - 14;
            const grad = ctx.createRadialGradient(ex - 3, ey - 4, 1, ex, ey, 11);
            grad.addColorStop(0, '#4a4a5a');
            grad.addColorStop(1, '#0d0d14');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(ex, ey, 10, 11 * parpadeo, 0, 0, Math.PI * 2);
            ctx.fill();
            if (parpadeo === 1) {
                brilloPlastico(ex - 3.5, ey - 4.5, 3.4, 0.95);
                brilloPlastico(ex + 3.5, ey + 3.5, 1.5, 0.6);
            }
        });

        // Cejas: suben en 'exito', una se arquea en 'duda'
        ctx.strokeStyle = '#3a3040';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const subida = aperturaSonrisa * 5;
        ctx.beginPath();
        ctx.moveTo(cx - 38, cy - 33 - subida);
        ctx.quadraticCurveTo(cx - 27, cy - 40 - subida, cx - 16, cy - 33 - subida);
        if (estado === 'duda') {
            ctx.moveTo(cx + 16, cy - 40);
            ctx.quadraticCurveTo(cx + 27, cy - 50, cx + 38, cy - 42);
        } else {
            ctx.moveTo(cx + 16, cy - 33 - subida);
            ctx.quadraticCurveTo(cx + 27, cy - 40 - subida, cx + 38, cy - 33 - subida);
        }
        ctx.stroke();

        // Nariz de zanahoria 3D (cono con degradado y estrías)
        const nx = cx + 2;
        const ny = cy + 2;
        const gradNariz = ctx.createLinearGradient(nx, ny - 10, nx, ny + 10);
        gradNariz.addColorStop(0, '#ffb04d');
        gradNariz.addColorStop(0.5, '#ff7a00');
        gradNariz.addColorStop(1, '#c94f00');
        ctx.fillStyle = gradNariz;
        ctx.beginPath();
        ctx.moveTo(nx - 2, ny - 11);
        ctx.quadraticCurveTo(nx + 30, ny - 4, nx + 46, ny + 3);
        ctx.quadraticCurveTo(nx + 28, ny + 8, nx - 2, ny + 11);
        ctx.quadraticCurveTo(nx - 8, ny, nx - 2, ny - 11);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 60, 0, 0.45)';
        ctx.lineWidth = 1.5;
        [12, 22, 32].forEach((d) => {
            ctx.beginPath();
            ctx.moveTo(nx + d, ny - 7 + d * 0.15);
            ctx.lineTo(nx + d + 3, ny + 7 - d * 0.1);
            ctx.stroke();
        });
        brilloPlastico(nx + 8, ny - 5, 2.6, 0.8);

        // Boca
        ctx.strokeStyle = '#2b2233';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        if (estado === 'duda') {
            // Boquita de sorpresa / duda
            ctx.fillStyle = '#5a2a3a';
            ctx.beginPath();
            ctx.ellipse(cx + 8, cy + 36, 8, 10, 0.2, 0, Math.PI * 2);
            ctx.fill();
            brilloPlastico(cx + 5, cy + 32, 2, 0.5);
        } else if (aperturaSonrisa > 0.05) {
            // Gran sonrisa abierta (crece con aperturaSonrisa)
            const r = 22 + aperturaSonrisa * 6;
            ctx.fillStyle = '#5a2a3a';
            ctx.beginPath();
            ctx.arc(cx, cy + 20, r, 0.15, Math.PI - 0.15);
            ctx.closePath();
            ctx.fill();
            // Lengua
            ctx.save();
            ctx.clip();
            ctx.fillStyle = '#ff6f8f';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 20 + r * 0.95, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            // Sonrisa de "puntitos de carbón"
            for (let i = 0; i < 7; i++) {
                const a = 0.45 + i * ((Math.PI - 0.9) / 6);
                const px = cx + Math.cos(a) * 26;
                const py = cy + 12 + Math.sin(a) * 22;
                ctx.fillStyle = '#2b2233';
                ctx.beginPath();
                ctx.arc(px, py, 3.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function dibujarSombrero() {
        const baseY = Y_CABEZA - RADIO_CABEZA + 14; // Apoyado en la coronilla
        const anchoAla = 128;
        const anchoCopa = 86;
        const altoCopa = 92;

        ctx.save();
        ctx.translate(4, baseY);
        ctx.rotate(-0.08); // Ligeramente ladeado: más simpático

        // Ala (elipse con brillo)
        const gradAla = ctx.createLinearGradient(0, -12, 0, 12);
        gradAla.addColorStop(0, '#3a3a48');
        gradAla.addColorStop(1, '#0b0b12');
        ctx.fillStyle = gradAla;
        ctx.beginPath();
        ctx.ellipse(0, 0, anchoAla / 2, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Copa
        const gradCopa = ctx.createLinearGradient(-anchoCopa / 2, 0, anchoCopa / 2, 0);
        gradCopa.addColorStop(0, '#2a2a36');
        gradCopa.addColorStop(0.3, '#4a4a5c');
        gradCopa.addColorStop(0.55, '#15151e');
        gradCopa.addColorStop(1, '#050508');
        ctx.fillStyle = gradCopa;
        ctx.beginPath();
        ctx.moveTo(-anchoCopa / 2, -4);
        ctx.lineTo(-anchoCopa / 2 + 4, -altoCopa);
        ctx.lineTo(anchoCopa / 2 - 4, -altoCopa);
        ctx.lineTo(anchoCopa / 2, -4);
        ctx.ellipse(0, -4, anchoCopa / 2, 9, 0, 0, Math.PI, false);
        ctx.closePath();
        ctx.fill();

        // Tapa superior
        ctx.fillStyle = '#3c3c4c';
        ctx.beginPath();
        ctx.ellipse(0, -altoCopa, anchoCopa / 2 - 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cinta ancha azul IMC
        const gradCinta = ctx.createLinearGradient(-anchoCopa / 2, 0, anchoCopa / 2, 0);
        gradCinta.addColorStop(0, '#1b6fc2');
        gradCinta.addColorStop(0.35, '#3d8fe0');
        gradCinta.addColorStop(0.6, PALETA.azul);
        gradCinta.addColorStop(1, PALETA.azulOscuro);
        ctx.fillStyle = gradCinta;
        ctx.beginPath();
        ctx.moveTo(-anchoCopa / 2 + 1, -10);
        ctx.lineTo(-anchoCopa / 2 + 2, -32);
        ctx.ellipse(0, -32, anchoCopa / 2 - 2, 7, 0, Math.PI, 0, true);
        ctx.lineTo(anchoCopa / 2 - 1, -10);
        ctx.ellipse(0, -10, anchoCopa / 2 - 1, 8, 0, 0, Math.PI, false);
        ctx.closePath();
        ctx.fill();

        // Ramita de acebo con bayas
        const hx = anchoCopa / 2 - 18;
        const hy = -24;
        [[-0.6, '#1f8a3a'], [0.5, '#2bab4b']].forEach(([giro, color]) => {
            ctx.save();
            ctx.translate(hx, hy);
            ctx.rotate(giro);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(10, -10, 24, -4);
            ctx.lineTo(19, 0);
            ctx.lineTo(24, 4);
            ctx.quadraticCurveTo(10, 10, 0, 0);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 60, 20, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(2, 0);
            ctx.lineTo(20, 0);
            ctx.stroke();
            ctx.restore();
        });
        [[-3, -3], [4, -6], [2, 3]].forEach(([dx, dy]) => {
            const grad = ctx.createRadialGradient(hx + dx - 1.5, hy + dy - 1.5, 0.5, hx + dx, hy + dy, 5);
            grad.addColorStop(0, '#ff7a7a');
            grad.addColorStop(1, '#b0001a');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(hx + dx, hy + dy, 5, 0, Math.PI * 2);
            ctx.fill();
            brilloPlastico(hx + dx - 1.5, hy + dy - 1.8, 1.4, 0.9);
        });

        // Reflejo satinado en la copa
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(-anchoCopa / 2 + 12, -altoCopa + 8, 8, altoCopa - 48);

        ctx.restore();
    }

    /* ----------------------------------------------------------
       PARTÍCULAS: chispas doradas y micro-estrellas
       ---------------------------------------------------------- */
    function emitirChispas(x, y, cantidad) {
        for (let i = 0; i < cantidad; i++) {
            if (particulas.length > 160) return;
            particulas.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.3) * 2.6,
                vy: -(Math.random() * 2.2 + 0.4),
                radio: Math.random() * 2 + 0.8,
                esEstrella: Math.random() < 0.3,
                color: Math.random() < 0.55 ? PALETA.dorado : (Math.random() < 0.5 ? '#ffffff' : PALETA.amarillo),
                vida: 1,
                desgaste: Math.random() * 0.018 + 0.012,
                fase: Math.random() * Math.PI * 2
            });
        }
    }

    function actualizarYDibujarParticulas(tiempo) {
        for (let i = particulas.length - 1; i >= 0; i--) {
            const p = particulas[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.035;           // Gravedad suave: caen como polvo
            p.vx *= 0.99;
            p.vida -= p.desgaste;

            if (p.vida <= 0) {
                particulas.splice(i, 1);
                continue;
            }

            const centelleo = 0.6 + Math.sin(tiempo * 0.02 + p.fase) * 0.4;
            const alpha = p.vida * centelleo;

            // Halo
            ctx.fillStyle = hexToRgba(p.color, alpha * 0.3);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radio * 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = hexToRgba(p.color, alpha);
            if (p.esEstrella) {
                estrella4(p.x, p.y, p.radio * 2.6 * centelleo);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /* ----------------------------------------------------------
       COLORES
       ---------------------------------------------------------- */
    // Aclara (>1) u oscurece (<1) un color hexadecimal
    function shade(hex, factor) {
        const n = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
        const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
        const b = Math.min(255, Math.round((n & 255) * factor));
        return `rgb(${r}, ${g}, ${b})`;
    }

    function hexToRgba(hex, alpha) {
        const n = parseInt(hex.replace('#', ''), 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }

    /* ----------------------------------------------------------
       BUCLE PRINCIPAL
       ---------------------------------------------------------- */
    function animar(tiempo) {
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.clearRect(0, 0, ancho, alto);
        // Pantallas diminutas (muy estrechas o muy bajas): no hay sitio bajo el formulario
        if (window.innerWidth < 300 || (window.innerWidth < 768 && window.innerHeight < 560)) return;

        const pos = colocacion();

        // --- Objetivos según el estado (los valores se acercan poco a poco) ---
        let objetivoBrazo = 0.35;      // Relajado, hacia abajo
        let objetivoCabeza = 0;
        let objetivoSonrisa = 0;

        if (estado === 'saludo') {
            objetivoBrazo = -1.05 + Math.sin(tiempo * 0.012) * 0.35;
        } else if (estado === 'exito') {
            objetivoBrazo = -1.15 + Math.sin(tiempo * 0.016) * 0.45;
            objetivoSonrisa = 1;
        } else if (estado === 'duda') {
            objetivoBrazo = 0.75;      // Brazo bien bajo
            objetivoCabeza = 0.16;     // Cabeza ladeada con curiosidad
        }

        anguloBrazo += (objetivoBrazo - anguloBrazo) * 0.14;
        inclinacionCabeza += (objetivoCabeza - inclinacionCabeza) * 0.1;
        aperturaSonrisa += (objetivoSonrisa - aperturaSonrisa) * 0.12;

        // --- Saltito de alegría (solo al entrar en 'exito') ---
        let salto = 0;
        if (inicioSalto >= 0) {
            const progreso = (tiempo - inicioSalto) / 650;
            if (progreso >= 1) {
                inicioSalto = -1;
            } else {
                salto = Math.sin(progreso * Math.PI) * 45;
            }
        }

        // Respiración en reposo
        const respiracion = Math.sin(tiempo * 0.0025) * 3;

        ctx.save();
        ctx.translate(pos.x, pos.suelo);
        ctx.scale(pos.escala, pos.escala);

        // 1. Sombra en el suelo (no salta)
        dibujarSombraSuelo(salto);

        // Todo el cuerpo sube con el salto
        ctx.translate(0, -salto);

        // Squash & stretch: se estira un poco en el aire y respira en reposo
        const estiramiento = 1 + salto / 600;
        ctx.scale(1 / estiramiento, estiramiento);

        // 2. Brazo izquierdo (detrás del cuerpo, quieto con leve balanceo)
        ctx.save();
        ctx.translate(-RADIO_BASE * 0.78, Y_BASE - 95);
        ctx.scale(-1, 1);   // Espejo del brazo derecho: mismas ramitas y dedos
        ctx.rotate(0.45 + Math.sin(tiempo * 0.002) * 0.05);
        dibujarRama(110);
        ctx.restore();

        // 3. Cuerpo
        esferaNieve(0, Y_BASE, RADIO_BASE);
        dibujarBotones();

        // 4. Cabeza + bufanda + sombrero (se inclinan juntos desde el cuello)
        ctx.save();
        ctx.translate(0, Y_CUELLO + respiracion);
        ctx.rotate(inclinacionCabeza);
        ctx.translate(0, -Y_CUELLO);

        esferaNieve(0, Y_CABEZA, RADIO_CABEZA);
        dibujarCara(tiempo);
        dibujarSombrero();
        dibujarBufanda(tiempo);
        dibujarChapaLogo();

        ctx.restore();

        // 5. Brazo derecho (el que saluda), por delante del cuerpo
        const hombroX = RADIO_BASE * 0.78;
        const hombroY = Y_BASE - 95;
        const largoBrazo = 110;

        ctx.save();
        ctx.translate(hombroX, hombroY);
        ctx.rotate(anguloBrazo);
        dibujarRama(largoBrazo);
        ctx.restore();

        // Punta de la mano en coordenadas de pantalla (para soltar chispas)
        const manoLocalX = hombroX + Math.cos(anguloBrazo) * (largoBrazo + 14);
        const manoLocalY = hombroY + Math.sin(anguloBrazo) * (largoBrazo + 14);
        const manoX = pos.x + (manoLocalX / estiramiento) * pos.escala;
        const manoY = pos.suelo + (manoLocalY * estiramiento - salto) * pos.escala;

        ctx.restore();

        // 6. Chispas (en coordenadas de pantalla, fuera de la escala)
        if (estado === 'saludo' || estado === 'exito') {
            emitirChispas(manoX, manoY, estado === 'exito' ? 3 : 2);
        }
        actualizarYDibujarParticulas(tiempo);
    }

    // Un único bucle para todos los canvas (js/motor-animacion.js)
    registrarAnimacion(animar);

    /* ----------------------------------------------------------
       CONTROL DE ESTADOS
       ---------------------------------------------------------- */
    function cambiarEstadoMuneco(nuevoEstado) {
        const validos = ['idle', 'saludo', 'exito', 'duda'];
        if (!validos.includes(nuevoEstado)) return;

        // El hover ('saludo') no pisa a 'exito' ni a 'duda'
        if (nuevoEstado !== 'saludo') estadoBase = nuevoEstado;

        if (nuevoEstado === 'exito' && estado !== 'exito') {
            inicioSalto = Date.now(); // Saltito solo al entrar en 'exito'
        }
        estado = nuevoEstado;
    }

    // Expuesto para que cualquier otro script pueda controlarlo
    window.cambiarEstadoMuneco = cambiarEstadoMuneco;

    // Hover: si el ratón está sobre el muñeco, saluda
    window.addEventListener('mousemove', (e) => {
        const pos = colocacion();
        const cuerpoX = pos.x;
        const cuerpoY = pos.suelo - 260 * pos.escala;   // Centro aproximado de todo el muñeco
        const radioDeteccion = 230 * pos.escala;

        const encima = Math.hypot(e.clientX / escala - cuerpoX, e.clientY / escala - cuerpoY) < radioDeteccion;

        if (encima && !hoverActivo) {
            hoverActivo = true;
            if (estadoBase === 'idle') cambiarEstadoMuneco('saludo');
        } else if (!encima && hoverActivo) {
            hoverActivo = false;
            if (estado === 'saludo') estado = estadoBase;
        }
    });

    // Compatibilidad con validaciones.js
    document.addEventListener('correo:validacion', (e) => {
        const traduccion = { vacio: 'idle', valido: 'exito', invalido: 'duda' };
        cambiarEstadoMuneco(traduccion[e.detail.estado] || 'idle');
    });
})();
