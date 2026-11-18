/* =============================================================
   GUIRNALDA DE PINO (Canvas) detrás de las bombillas CSS
   - Rama de pino colgando en ondas, piñas y lazos rojos.
   - Es estática: solo se redibuja al cambiar el tamaño de la ventana,
     así que no consume nada en cada fotograma.
   - El parpadeo lo ponen las bombillas CSS (.linea-luces).
   Necesita un <canvas id="canvas-guirnalda"> dentro de la guirnalda.
   ============================================================= */
(function () {
    const canvas = document.getElementById('canvas-guirnalda');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const SEPARACION_GANCHOS = 190;   // Distancia entre los puntos de los que cuelga
    const CAIDA = 16;                 // Cuánto cuelga la rama entre gancho y gancho
    const Y_GANCHO = 6;

    const verdes = ['#0f5e2c', '#16733a', '#1f8a45', '#2a9d52', '#0b4a22'];

    // Altura de la rama en cada x (ondas colgantes)
    function yRama(x) {
        const fase = ((x % SEPARACION_GANCHOS) + SEPARACION_GANCHOS) % SEPARACION_GANCHOS;
        return Y_GANCHO + Math.sin((fase / SEPARACION_GANCHOS) * Math.PI) * CAIDA;
    }

    function dibujarAgujas(ancho) {
        ctx.lineCap = 'round';

        // Dos pasadas: una oscura de fondo y otra más clara por encima (volumen)
        [{ alpha: 0.9, largo: 15, oscuro: true }, { alpha: 1, largo: 11, oscuro: false }].forEach((capa) => {
            for (let x = -20; x < ancho + 20; x += 2.5) {
                const cy = yRama(x);
                for (let n = 0; n < 4; n++) {
                    const angulo = Math.random() * Math.PI * 2;
                    const largo = capa.largo * (0.6 + Math.random() * 0.5);
                    ctx.strokeStyle = capa.oscuro ? '#0a3d1c' : verdes[(Math.random() * verdes.length) | 0];
                    ctx.globalAlpha = capa.alpha;
                    ctx.lineWidth = capa.oscuro ? 2.2 : 1.6;
                    ctx.beginPath();
                    ctx.moveTo(x, cy);
                    ctx.lineTo(x + Math.cos(angulo) * largo, cy + Math.sin(angulo) * largo * 0.8);
                    ctx.stroke();
                }
            }
        });
        ctx.globalAlpha = 1;

        // Toques de nieve sobre la rama
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        for (let x = 0; x < ancho; x += 7) {
            if (Math.random() < 0.45) {
                ctx.beginPath();
                ctx.arc(x + Math.random() * 4, yRama(x) - 6 - Math.random() * 3, Math.random() * 1.8 + 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function dibujarPina(x, y) {
        // Cuerpo con degradado
        const grad = ctx.createLinearGradient(x - 8, y, x + 8, y);
        grad.addColorStop(0, '#5a3418');
        grad.addColorStop(0.5, '#8a5428');
        grad.addColorStop(1, '#4a2a12');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(x, y + 13, 8, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Escamas
        ctx.strokeStyle = 'rgba(40, 20, 8, 0.75)';
        ctx.lineWidth = 1;
        for (let fila = 0; fila < 5; fila++) {
            const fy = y + 3 + fila * 5;
            const fw = 7 - Math.abs(fila - 2) * 1.2;
            ctx.beginPath();
            ctx.moveTo(x - fw, fy);
            ctx.quadraticCurveTo(x, fy + 4, x + fw, fy);
            ctx.stroke();
        }

        // Punta nevada
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function dibujarLazo(x, y) {
        ctx.save();
        ctx.translate(x, y);

        // Cintas colgantes
        ctx.fillStyle = '#a3001a';
        [-1, 1].forEach((s) => {
            ctx.beginPath();
            ctx.moveTo(0, 2);
            ctx.lineTo(s * 9, 22);
            ctx.lineTo(s * 5, 20);
            ctx.lineTo(s * 3, 24);
            ctx.lineTo(s * 2, 3);
            ctx.closePath();
            ctx.fill();
        });

        // Lazadas con degradado
        [-1, 1].forEach((s) => {
            const grad = ctx.createRadialGradient(s * 8, -2, 1, s * 9, 0, 11);
            grad.addColorStop(0, '#ff4a5e');
            grad.addColorStop(1, '#b0001a');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(s * 9, 0, 10, 6.5, s * -0.35, 0, Math.PI * 2);
            ctx.fill();
        });

        // Nudo central con brillo
        ctx.fillStyle = '#E3001B';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(-1.5, -1.5, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function dibujar() {
        // El canvas mide lo mismo que su contenedor
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const ancho = canvas.width;

        ctx.clearRect(0, 0, ancho, canvas.height);
        dibujarAgujas(ancho);

        // En cada gancho: piña colgando y lazo encima
        for (let x = 0; x <= ancho + SEPARACION_GANCHOS; x += SEPARACION_GANCHOS) {
            dibujarPina(x + 10, Y_GANCHO + 10);
            dibujarPina(x - 9, Y_GANCHO + 14);
            dibujarLazo(x, Y_GANCHO + 4);
        }
    }

    dibujar();

    // Redibujar al cambiar el tamaño (con un pequeño retardo para no repetirlo 100 veces)
    let temporizador = null;
    window.addEventListener('resize', () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(dibujar, 150);
    });
})();
