/* =============================================================
   BUZÓN DE JUGUETE IMC TOYS (Canvas) - lateral derecho
   - Soporte: 3 bloques de juguete apilados (rojo, naranja, verde).
   - Caja abovedada azul IMC con volumen, ranura y pestillo dorados.
   - Nieve continua en el tejado (curvas Bézier) y montículo en la base.
   - Banderín rojo metálico con un círculo blanco en relieve (la "i" del logo).
   - Tamaño: lo alto del buzón queda a la altura de los hombros del muñeco.
   - window.animarEnvioBuzon(): un sobre vuela desde el campo de correo
     hasta la ranura con estela dorada; al entrar, la ranura rebota y el
     banderín sube con rebote elástico. Devuelve una Promesa.
   Necesita un <canvas id="canvas-buzon"> a pantalla completa.
   ============================================================= */
(function () {
    const canvas = document.getElementById('canvas-buzon');
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

    const COLORES = {
        rojo: '#E3001B',
        naranja: '#FF9E1B',
        verde: '#24D024',
        azul: '#0055A5',
        dorado: '#FFD24A',
        doradoClaro: '#fff3b0',
        doradoOscuro: '#a87400'
    };

    /* ----------------------------------------------------------
       MEDIDAS (unidades de diseño; origen = suelo, centro del soporte)
       ---------------------------------------------------------- */
    const PROFUNDIDAD = 10;      // Falso 3D de los bloques (cara superior y lateral)

    // Bloques de abajo a arriba
    const BLOQUES = [
        { color: COLORES.verde,   lado: 50 },   // Abajo
        { color: COLORES.naranja, lado: 46 },
        { color: COLORES.rojo,    lado: 42 }    // Arriba
    ];
    const ALTO_SOPORTE = BLOQUES.reduce((suma, b) => suma + b.lado, 0); // 176

    const CAJA = {
        izq: -108,
        der: 80,
        base: -ALTO_SOPORTE - 4,
        altoRecto: 56,
        altoArco: 40
    };
    const CAJA_CENTRO_X = (CAJA.izq + CAJA.der) / 2;
    const CAJA_RADIO_X = (CAJA.der - CAJA.izq) / 2;
    const ALTO_TOTAL = -CAJA.base + CAJA.altoRecto + CAJA.altoArco + 12; // Con la nieve

    /* ----------------------------------------------------------
       ESTADO
       ---------------------------------------------------------- */
    let anguloBandera = 0;          // 0 = bajada, -PI/2 = levantada
    let velocidadBandera = 0;
    let banderaArribaHasta = 0;
    let inicioReboteRanura = -1;
    let sobre = null;
    const particulas = [];

    /* ----------------------------------------------------------
       COLOCACIÓN
       ---------------------------------------------------------- */
    function colocacion() {
        if (ancho > 950) {
            const suelo = alto * 0.925;
            // Hombros del muñeco (mismas fórmulas que muneco3d.js):
            // suelo del muñeco = alto * 0.94, escala = min(1, alto*0.86/560), bufanda a -250
            const escalaMuneco = Math.min(1, (alto * 0.86) / 560);
            const yHombros = alto * 0.94 - 250 * escalaMuneco;
            // x1.25: el buzón sobresale un poco por encima de los hombros para ganar presencia
            const escala = Math.max(0.7, Math.min(1.4, ((suelo - yHombros) / ALTO_TOTAL) * 1.25));
            return { x: ancho * 0.84, suelo: suelo, escala: escala };
        }
        if (ancho < 768) {
            // Móvil: en la esquina inferior derecha, por debajo del formulario
            return { x: ancho * 0.78, suelo: alto * 0.975, escala: 0.46 };
        }
        return { x: ancho * 0.86, suelo: alto * 0.965, escala: 0.55 };
    }

    function puntoRanura() {
        const p = colocacion();
        return {
            x: p.x + (CAJA.izq - 6) * p.escala,
            y: p.suelo + (CAJA.base - CAJA.altoRecto * 0.6) * p.escala
        };
    }

    /* ----------------------------------------------------------
       UTILIDADES
       ---------------------------------------------------------- */
    function rebote(t) {
        return Math.exp(-6 * t) * Math.sin(t * 22);
    }

    function suavizar(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function puntoBezier(a, c, b, t) {
        return {
            x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
            y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y
        };
    }

    // Aclara (>1) u oscurece (<1) un color hexadecimal
    function tono(hex, factor) {
        const n = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
        const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
        const b = Math.min(255, Math.round((n & 255) * factor));
        return `rgb(${r}, ${g}, ${b})`;
    }

    function degradadoOro(x1, y1, x2, y2) {
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, COLORES.doradoOscuro);
        g.addColorStop(0.35, COLORES.doradoClaro);
        g.addColorStop(0.55, COLORES.dorado);
        g.addColorStop(1, COLORES.doradoOscuro);
        return g;
    }

    function trazarCaja() {
        ctx.beginPath();
        ctx.moveTo(CAJA.izq, CAJA.base);
        ctx.lineTo(CAJA.izq, CAJA.base - CAJA.altoRecto);
        ctx.ellipse(CAJA_CENTRO_X, CAJA.base - CAJA.altoRecto, CAJA_RADIO_X, CAJA.altoArco, 0, Math.PI, 0);
        ctx.lineTo(CAJA.der, CAJA.base);
        ctx.closePath();
    }

    /* ----------------------------------------------------------
       SOPORTE: BLOQUES DE JUGUETE
       ---------------------------------------------------------- */
    // Dibuja un cubo con cara frontal, cara superior y cara lateral (falso 3D)
    function dibujarBloque(cx, abajoY, lado, color) {
        const izq = cx - lado / 2;
        const arriba = abajoY - lado;
        const d = PROFUNDIDAD;

        // Cara lateral derecha (la más oscura)
        ctx.fillStyle = tono(color, 0.62);
        ctx.beginPath();
        ctx.moveTo(izq + lado, arriba + 4);
        ctx.lineTo(izq + lado + d, arriba - d + 4);
        ctx.lineTo(izq + lado + d, abajoY - d - 2);
        ctx.lineTo(izq + lado, abajoY - 2);
        ctx.closePath();
        ctx.fill();

        // Cara superior (la más clara)
        ctx.fillStyle = tono(color, 1.25);
        ctx.beginPath();
        ctx.moveTo(izq + 4, arriba);
        ctx.lineTo(izq + d + 4, arriba - d);
        ctx.lineTo(izq + lado + d, arriba - d);
        ctx.lineTo(izq + lado, arriba);
        ctx.closePath();
        ctx.fill();

        // Cara frontal con bisel (degradado diagonal de luz a sombra)
        const grad = ctx.createLinearGradient(izq, arriba, izq + lado, abajoY);
        grad.addColorStop(0, tono(color, 1.18));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, tono(color, 0.8));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(izq, arriba, lado, lado, 8);
        ctx.fill();

        // Bisel interior: marco claro arriba-izquierda, oscuro abajo-derecha
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(izq + 5, abajoY - 8);
        ctx.lineTo(izq + 5, arriba + 8);
        ctx.quadraticCurveTo(izq + 5, arriba + 5, izq + 8, arriba + 5);
        ctx.lineTo(izq + lado - 8, arriba + 5);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.moveTo(izq + lado - 5, arriba + 8);
        ctx.lineTo(izq + lado - 5, abajoY - 8);
        ctx.quadraticCurveTo(izq + lado - 5, abajoY - 5, izq + lado - 8, abajoY - 5);
        ctx.lineTo(izq + 8, abajoY - 5);
        ctx.stroke();

        // Brillo plástico
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.roundRect(izq + 9, arriba + 9, lado * 0.32, 5, 2.5);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(izq + lado * 0.32 + 14, arriba + 11.5, 2.4, 0, Math.PI * 2);
        ctx.fill();
    }

    function dibujarSoporte() {
        let y = 0;
        BLOQUES.forEach((b) => {
            // Sombra de contacto del bloque de arriba sobre el de abajo
            ctx.fillStyle = 'rgba(30, 20, 60, 0.18)';
            ctx.fillRect(-b.lado / 2 + 2, y - 3, b.lado, 4);

            dibujarBloque(0, y, b.lado, b.color);
            y -= b.lado;
        });
    }

    function dibujarMonticulo() {
        // Sombra lila en el suelo
        ctx.fillStyle = 'rgba(150, 130, 210, 0.28)';
        ctx.beginPath();
        ctx.ellipse(6, 6, 74, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Montículo que abraza el bloque inferior
        const grad = ctx.createRadialGradient(-14, -18, 4, 0, -4, 78);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.6, '#eff0fb');
        grad.addColorStop(0.9, '#d6d2f0');
        grad.addColorStop(1, '#c2bae6');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-74, 6);
        ctx.quadraticCurveTo(-58, -12, -36, -18);
        ctx.quadraticCurveTo(-18, -26, 0, -20);
        ctx.quadraticCurveTo(22, -28, 40, -16);
        ctx.quadraticCurveTo(62, -8, 76, 6);
        ctx.closePath();
        ctx.fill();

        // Pequeñas sombras azuladas en los pliegues
        ctx.strokeStyle = 'rgba(140, 125, 210, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-30, -12);
        ctx.quadraticCurveTo(-14, -8, 2, -12);
        ctx.moveTo(14, -10);
        ctx.quadraticCurveTo(30, -6, 44, -8);
        ctx.stroke();

        // Escarcha
        ctx.fillStyle = '#ffffff';
        [[-46, -10], [-8, -22], [30, -18], [56, -4]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 1.6, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /* ----------------------------------------------------------
       CAJA AZUL IMC
       ---------------------------------------------------------- */
    function dibujarCaja() {
        // Tablilla dorada de unión con el soporte
        ctx.fillStyle = degradadoOro(-34, CAJA.base, 34, CAJA.base + 6);
        ctx.beginPath();
        ctx.roundRect(-34, CAJA.base, 68, 6, 3);
        ctx.fill();

        // 1. Volumen vertical: arco iluminado, base más oscura
        trazarCaja();
        const gradV = ctx.createLinearGradient(0, CAJA.base - CAJA.altoRecto - CAJA.altoArco, 0, CAJA.base);
        gradV.addColorStop(0, '#2f86de');
        gradV.addColorStop(0.45, COLORES.azul);
        gradV.addColorStop(1, '#003a75');
        ctx.fillStyle = gradV;
        ctx.fill();

        ctx.save();
        trazarCaja();
        ctx.clip();

        // 2. Curvatura horizontal: reflejo central claro, laterales profundos
        const gradH = ctx.createLinearGradient(CAJA.izq, 0, CAJA.der, 0);
        gradH.addColorStop(0, 'rgba(0, 20, 60, 0.55)');
        gradH.addColorStop(0.22, 'rgba(0, 20, 60, 0)');
        gradH.addColorStop(0.48, 'rgba(140, 200, 255, 0.28)');
        gradH.addColorStop(0.78, 'rgba(0, 20, 60, 0)');
        gradH.addColorStop(1, 'rgba(0, 20, 60, 0.6)');
        ctx.fillStyle = gradH;
        ctx.fillRect(CAJA.izq, CAJA.base - 120, CAJA.der - CAJA.izq, 125);

        // 3. Reflejo especular (plástico/metal lacado)
        const gradBrillo = ctx.createLinearGradient(0, CAJA.base - CAJA.altoRecto - 24, 0, CAJA.base - CAJA.altoRecto + 6);
        gradBrillo.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradBrillo.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
        gradBrillo.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradBrillo;
        ctx.beginPath();
        ctx.ellipse(CAJA_CENTRO_X - 6, CAJA.base - CAJA.altoRecto - 8, CAJA_RADIO_X * 0.78, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 4. Pestillo dorado en relieve (lateral, junto a la puerta)
        const px = CAJA.izq + 24;
        const py = CAJA.base - CAJA.altoRecto * 0.45;
        ctx.fillStyle = 'rgba(0, 20, 50, 0.35)';
        ctx.beginPath();
        ctx.roundRect(px - 9, py - 5 + 2, 22, 12, 4);
        ctx.fill();
        ctx.fillStyle = degradadoOro(px - 9, py - 6, px + 13, py + 6);
        ctx.beginPath();
        ctx.roundRect(px - 9, py - 6, 22, 12, 4);
        ctx.fill();
        ctx.fillStyle = '#7a5200';
        ctx.beginPath();
        ctx.arc(px + 2, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(px - 6, py - 4, 10, 2);
    }

    // Puerta frontal con ranura dorada (rebota al recibir la carta)
    function dibujarPuerta(tiempo) {
        let apertura = 1;
        if (inicioReboteRanura >= 0) {
            const t = (tiempo - inicioReboteRanura) / 1000;
            if (t > 1.3) inicioReboteRanura = -1;
            else apertura = 1 + rebote(t) * 0.8;
        }

        const grosor = 13 * apertura;
        const izq = CAJA.izq - grosor;
        const arriba = CAJA.base - CAJA.altoRecto + 8;

        // Panel de la puerta (azul más oscuro)
        ctx.beginPath();
        ctx.moveTo(CAJA.izq + 2, CAJA.base);
        ctx.lineTo(izq, CAJA.base + 1);
        ctx.lineTo(izq, arriba + 6);
        ctx.quadraticCurveTo(izq + 1, arriba - 4, CAJA.izq + 2, arriba - 8);
        ctx.closePath();
        const grad = ctx.createLinearGradient(izq, 0, CAJA.izq + 2, 0);
        grad.addColorStop(0, '#002a57');
        grad.addColorStop(1, '#004a90');
        ctx.fillStyle = grad;
        ctx.fill();

        // Bisel dorado brillante
        ctx.lineJoin = 'round';
        ctx.strokeStyle = degradadoOro(izq, arriba, CAJA.izq, CAJA.base);
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 250, 220, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ranura de cartas en relieve dorado
        const ry = CAJA.base - CAJA.altoRecto * 0.6;
        ctx.fillStyle = degradadoOro(izq - 3, ry - 6, izq + grosor, ry + 6);
        ctx.beginPath();
        ctx.roundRect(izq - 2, ry - 6, grosor + 3, 12, 3);
        ctx.fill();
        ctx.fillStyle = '#05101f';
        ctx.beginPath();
        ctx.roundRect(izq + 1, ry - 2.2, grosor - 3, 4.4, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(izq, ry - 5, grosor, 1.2);

        // Bisagra inferior
        ctx.fillStyle = degradadoOro(izq, CAJA.base - 7, izq, CAJA.base);
        ctx.fillRect(izq - 2, CAJA.base - 7, grosor + 7, 4);
    }

    // Manto de nieve continuo con curvas Bézier
    function dibujarNieveTejado() {
        const topeY = CAJA.base - CAJA.altoRecto;
        const rx = CAJA_RADIO_X + 5;
        const ry = CAJA.altoArco + 7;

        // Borde superior: elipse un poco mayor que el arco
        // Borde inferior: ondulado con quadraticCurveTo (goterones blanditos)
        function trazarManto(desplazY) {
            ctx.beginPath();
            ctx.ellipse(CAJA_CENTRO_X, topeY + desplazY, rx, ry, 0, Math.PI, 0);

            const pasos = 8;
            for (let i = 0; i < pasos; i++) {
                // De derecha a izquierda, siguiendo el arco por dentro
                const a1 = (i / pasos) * Math.PI;
                const a2 = ((i + 1) / pasos) * Math.PI;
                const aMedio = (a1 + a2) / 2;
                const radioIntX = rx - 6;
                const radioIntY = ry - 9;
                const x2 = CAJA_CENTRO_X + Math.cos(a2) * radioIntX;
                const y2 = topeY + desplazY - Math.sin(a2) * radioIntY;
                const caida = i % 2 === 0 ? 11 : 4;         // Goterón grande / pequeño
                const cx = CAJA_CENTRO_X + Math.cos(aMedio) * radioIntX;
                const cy = topeY + desplazY - Math.sin(aMedio) * radioIntY + caida;
                if (i === 0) {
                    ctx.lineTo(CAJA_CENTRO_X + radioIntX, topeY + desplazY);
                }
                ctx.quadraticCurveTo(cx, cy, x2, y2);
            }
            ctx.closePath();
        }

        // 1. Sombra lila desplazada (da grosor al manto)
        trazarManto(4);
        ctx.fillStyle = 'rgba(140, 125, 210, 0.45)';
        ctx.fill();

        // 2. Manto principal con degradado
        trazarManto(0);
        const grad = ctx.createLinearGradient(0, topeY - ry, 0, topeY + 8);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.6, '#f4f5fd');
        grad.addColorStop(1, '#d9d6f1');
        ctx.fillStyle = grad;
        ctx.fill();

        // 3. Brillo superior suave (volumen esponjoso)
        ctx.save();
        trazarManto(0);
        ctx.clip();
        const brillo = ctx.createRadialGradient(CAJA_CENTRO_X - 20, topeY - ry + 6, 2, CAJA_CENTRO_X - 20, topeY - ry + 6, rx * 0.7);
        brillo.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        brillo.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = brillo;
        ctx.fillRect(CAJA.izq - 10, topeY - ry - 10, CAJA.der - CAJA.izq + 20, ry + 20);
        ctx.restore();

        // 4. Destellos de escarcha
        ctx.fillStyle = '#ffffff';
        [[-44, 0.75], [-4, 0.95], [34, 0.8]].forEach(([dx, f]) => {
            ctx.beginPath();
            ctx.arc(CAJA_CENTRO_X + dx, topeY - ry * f + 3, 1.8, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Banderín rojo metálico con la "i" blanca en relieve
    function dibujarBandera(tiempo) {
        let objetivo = Math.sin(tiempo * 0.0022) * 0.08;                 // Reposo: vaivén suave
        if (tiempo < banderaArribaHasta) {
            objetivo = -Math.PI / 2 + Math.sin(tiempo * 0.004) * 0.04;    // Levantado
        }
        velocidadBandera += (objetivo - anguloBandera) * 0.09;
        velocidadBandera *= 0.8;
        anguloBandera += velocidadBandera;

        ctx.save();
        ctx.translate(CAJA.der - 12, CAJA.base - CAJA.altoRecto * 0.5);
        ctx.rotate(anguloBandera);

        // Varilla plateada
        const gradVarilla = ctx.createLinearGradient(0, -2.5, 0, 2.5);
        gradVarilla.addColorStop(0, '#ffffff');
        gradVarilla.addColorStop(0.5, '#b9c0cc');
        gradVarilla.addColorStop(1, '#6c7484');
        ctx.fillStyle = gradVarilla;
        ctx.beginPath();
        ctx.roundRect(0, -2.5, 48, 5, 2.5);
        ctx.fill();

        // Banderín rojo metálico
        const onda = Math.sin(tiempo * 0.005) * 1;
        ctx.beginPath();
        ctx.moveTo(34, -2);
        ctx.lineTo(34, -22);
        ctx.quadraticCurveTo(48, -24 + onda, 62, -22);
        ctx.lineTo(62, 0);
        ctx.quadraticCurveTo(48, 2 + onda, 34, 2);
        ctx.closePath();
        const gradPlaca = ctx.createLinearGradient(0, -24, 0, 2);
        gradPlaca.addColorStop(0, '#ff5a6a');
        gradPlaca.addColorStop(0.45, COLORES.rojo);
        gradPlaca.addColorStop(1, '#8a0010');
        ctx.fillStyle = gradPlaca;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Brillo especular del metal
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.roundRect(37, -19, 22, 4, 2);
        ctx.fill();

        // Círculo blanco en relieve (la "i" del logo IMC Toys)
        const cx = 48;
        const cy = -10 + onda * 0.3;
        ctx.fillStyle = 'rgba(80, 0, 10, 0.4)';      // Sombra del relieve
        ctx.beginPath();
        ctx.arc(cx + 1, cy + 1.5, 5.5, 0, Math.PI * 2);
        ctx.fill();
        const gradPunto = ctx.createRadialGradient(cx - 1.8, cy - 1.8, 0.5, cx, cy, 5.5);
        gradPunto.addColorStop(0, '#ffffff');
        gradPunto.addColorStop(0.7, '#f4f4f8');
        gradPunto.addColorStop(1, '#c9ccd6');
        ctx.fillStyle = gradPunto;
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Pivote dorado
        const gradPivote = ctx.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 5);
        gradPivote.addColorStop(0, '#ffffff');
        gradPivote.addColorStop(0.4, COLORES.dorado);
        gradPivote.addColorStop(1, COLORES.doradoOscuro);
        ctx.fillStyle = gradPivote;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /* ----------------------------------------------------------
       SOBRE EN VUELO
       ---------------------------------------------------------- */
    function dibujarSobre(x, y, giro, escala) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(giro);
        ctx.scale(escala, escala);

        const w = 46;
        const h = 31;

        ctx.fillStyle = 'rgba(80, 20, 60, 0.2)';
        ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);

        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(-w / 2, -h / 2, w, h);

        // Borde festivo (rayas rojas y verdes)
        ctx.save();
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2, w, h);
        ctx.rect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
        ctx.clip('evenodd');
        for (let i = -w; i < w * 2; i += 8) {
            ctx.fillStyle = (i / 8) % 2 === 0 ? COLORES.rojo : '#1f8a45';
            ctx.beginPath();
            ctx.moveTo(-w / 2 + i, -h / 2);
            ctx.lineTo(-w / 2 + i + 4, -h / 2);
            ctx.lineTo(-w / 2 + i + 4 - h, h / 2);
            ctx.lineTo(-w / 2 + i - h, h / 2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // Solapa
        ctx.strokeStyle = 'rgba(150, 120, 90, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 4, -h / 2 + 4);
        ctx.lineTo(0, 3);
        ctx.lineTo(w / 2 - 4, -h / 2 + 4);
        ctx.stroke();

        // Sello de lacre con estrella dorada
        const g = ctx.createRadialGradient(-1.5, 1.5, 1, 0, 3, 7);
        g.addColorStop(0, '#ff4a5e');
        g.addColorStop(1, '#9e0016');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 3, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORES.dorado;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? 3.8 : 1.6;
            const a = -Math.PI / 2 + i * (Math.PI / 5);
            const px = Math.cos(a) * r;
            const py = 3 + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    /* ----------------------------------------------------------
       PARTÍCULAS: estela dorada y confeti
       ---------------------------------------------------------- */
    function emitirEstela(x, y) {
        for (let i = 0; i < 3; i++) {
            particulas.push({
                tipo: 'chispa',
                x: x + (Math.random() - 0.5) * 12,
                y: y + (Math.random() - 0.5) * 12,
                vx: (Math.random() - 0.5) * 0.8,
                vy: Math.random() * 0.6 + 0.1,
                radio: Math.random() * 2 + 0.8,
                color: Math.random() < 0.6 ? COLORES.dorado : '#ffffff',
                vida: 1,
                desgaste: Math.random() * 0.025 + 0.018
            });
        }
    }

    function emitirConfeti(x, y) {
        const colores = [COLORES.dorado, COLORES.doradoClaro, '#ffffff', COLORES.naranja, COLORES.rojo, COLORES.verde];
        for (let i = 0; i < 55; i++) {
            const angulo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
            const fuerza = Math.random() * 5 + 2.5;
            particulas.push({
                tipo: 'confeti',
                x: x,
                y: y,
                vx: Math.cos(angulo) * fuerza,
                vy: Math.sin(angulo) * fuerza,
                ancho: Math.random() * 5 + 3,
                alto: Math.random() * 3 + 2,
                giro: Math.random() * Math.PI,
                velocidadGiro: (Math.random() - 0.5) * 0.4,
                color: colores[(Math.random() * colores.length) | 0],
                vida: 1,
                desgaste: Math.random() * 0.012 + 0.008
            });
        }
    }

    function actualizarParticulas() {
        for (let i = particulas.length - 1; i >= 0; i--) {
            const p = particulas[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vida -= p.desgaste;

            if (p.tipo === 'confeti') {
                p.vy += 0.12;
                p.vx *= 0.98;
                p.giro += p.velocidadGiro;
            }

            if (p.vida <= 0) {
                particulas.splice(i, 1);
                continue;
            }

            ctx.fillStyle = p.color;
            if (p.tipo === 'confeti') {
                ctx.globalAlpha = p.vida;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.giro);
                ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto * Math.abs(Math.cos(p.giro * 2)));
                ctx.restore();
            } else {
                ctx.globalAlpha = p.vida * 0.25;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radio * 2.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = p.vida;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    /* ----------------------------------------------------------
       BUCLE PRINCIPAL
       ---------------------------------------------------------- */
    // Pantallas diminutas (muy estrechas o muy bajas): el buzón taparía el formulario
    function sinSitio() {
        return window.innerWidth < 300 || (window.innerWidth < 768 && window.innerHeight < 560);
    }

    function animar(tiempo) {
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.clearRect(0, 0, ancho, alto);
        if (sinSitio()) return;
        const pos = colocacion();

        ctx.save();
        ctx.translate(pos.x, pos.suelo);
        ctx.scale(pos.escala, pos.escala);

        dibujarSoporte();
        dibujarMonticulo();         // Por delante del bloque rojo: lo "abraza"
        dibujarBandera(tiempo);     // Detrás de la caja cuando está bajada
        dibujarCaja();
        dibujarNieveTejado();
        dibujarPuerta(tiempo);

        ctx.restore();

        // Sobre en vuelo
        if (sobre) {
            const t = Math.min(1, (tiempo - sobre.inicio) / sobre.duracion);
            const tt = suavizar(t);
            const destino = puntoRanura();
            const p = puntoBezier(sobre.origen, sobre.control, destino, tt);

            emitirEstela(p.x, p.y);
            const giro = Math.sin(t * Math.PI * 3) * 0.25;
            const escala = (1 - tt * 0.6) * (1 + Math.sin(t * Math.PI) * 0.25);
            dibujarSobre(p.x, p.y, giro, escala);

            if (t >= 1) {
                inicioReboteRanura = tiempo;
                banderaArribaHasta = tiempo + 5000;
                emitirConfeti(destino.x, destino.y);
                const resolver = sobre.resolver;
                sobre = null;
                setTimeout(resolver, 450);
            }
        }

        actualizarParticulas();
    }

    // Un único bucle para todos los canvas (js/motor-animacion.js)
    registrarAnimacion(animar);

    /* ----------------------------------------------------------
       API PÚBLICA
       ---------------------------------------------------------- */
    window.animarEnvioBuzon = function () {
        if (sinSitio()) return Promise.resolve();   // Sin buzón visible: se envía sin animación
        if (sobre) return sobre.promesa;

        const input = document.getElementById('correo');
        const caja = input
            ? input.getBoundingClientRect()
            : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        // getBoundingClientRect da píxeles de pantalla: los pasamos al tamaño lógico del lienzo
        const origen = { x: (caja.left + caja.width * 0.75) / escala, y: (caja.top + caja.height / 2) / escala };
        const destino = puntoRanura();

        let resolver;
        const promesa = new Promise((r) => { resolver = r; });

        sobre = {
            origen: origen,
            control: { x: (origen.x + destino.x) / 2, y: Math.min(origen.y, destino.y) - 170 },
            inicio: Date.now(),
            duracion: 1300,
            resolver: resolver,
            promesa: promesa
        };
        return promesa;
    };
})();
