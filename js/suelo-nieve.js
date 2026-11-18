/* =============================================================
   SUELO DE NIEVE (Canvas) en la parte inferior de la pantalla
   - Dos capas de colinas: una lejana (lila translúcido) y el manto principal.
   - Relieve orgánico con quadraticCurveTo y montículos donde se apoyan
     el muñeco (izquierda) y el buzón (derecha).
   - Es estático: solo se redibuja al cambiar el tamaño de la ventana.
   Necesita un <canvas id="canvas-suelo-nieve">.
   ============================================================= */
(function () {
    const canvas = document.getElementById('canvas-suelo-nieve');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Une una lista de puntos con curvas suaves:
    // cada curva va del punto medio de un tramo al del siguiente,
    // usando el punto real como control (así no hay picos).
    function trazarCurvaSuave(puntos) {
        ctx.moveTo(puntos[0].x, puntos[0].y);
        for (let i = 1; i < puntos.length - 1; i++) {
            const medioX = (puntos[i].x + puntos[i + 1].x) / 2;
            const medioY = (puntos[i].y + puntos[i + 1].y) / 2;
            ctx.quadraticCurveTo(puntos[i].x, puntos[i].y, medioX, medioY);
        }
        const ultimo = puntos[puntos.length - 1];
        ctx.lineTo(ultimo.x, ultimo.y);
    }

    // Convierte [fracciónX, fracciónY] en píxeles
    function aPixeles(lista, ancho, alto) {
        return lista.map(([fx, fy]) => ({ x: fx * ancho, y: fy * alto }));
    }

    function dibujar() {
        // Escala de la interfaz (--escala-ui en styles.css): 0.75 en login/registro de escritorio
        const escala = parseFloat(getComputedStyle(document.body).getPropertyValue('--escala-ui')) || 1;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ancho = window.innerWidth / escala;   // Tamaño lógico en el que se dibuja
        const alto = window.innerHeight / escala;
        const escritorio = ancho > 950;
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.clearRect(0, 0, ancho, alto);

        /* ---------- 1. Colinas lejanas (profundidad) ---------- */
        const lejanas = aPixeles([
            [-0.05, 0.86], [0.1, 0.83], [0.25, 0.86], [0.42, 0.82],
            [0.6, 0.855], [0.76, 0.82], [0.92, 0.85], [1.05, 0.83]
        ], ancho, alto);

        ctx.beginPath();
        trazarCurvaSuave(lejanas);
        ctx.lineTo(ancho, alto);
        ctx.lineTo(0, alto);
        ctx.closePath();
        const gradLejos = ctx.createLinearGradient(0, alto * 0.8, 0, alto);
        gradLejos.addColorStop(0, 'rgba(240, 232, 255, 0.55)');
        gradLejos.addColorStop(1, 'rgba(205, 190, 240, 0.35)');
        ctx.fillStyle = gradLejos;
        ctx.fill();

        /* ---------- 2. Manto principal ---------- */
        // Montículos más altos bajo el muñeco (≈16%) y el buzón (≈84%)
        const xMuneco = escritorio ? 0.16 : 0.5;
        const principal = aPixeles(escritorio ? [
            [-0.05, 0.93], [0.06, 0.915], [xMuneco, 0.905], [0.27, 0.93],
            [0.4, 0.915], [0.52, 0.935], [0.66, 0.918], [0.84, 0.905],
            [0.95, 0.925], [1.05, 0.915]
        ] : [
            [-0.05, 0.96], [0.2, 0.95], [xMuneco, 0.94], [0.8, 0.95], [1.05, 0.955]
        ], ancho, alto);

        ctx.beginPath();
        trazarCurvaSuave(principal);
        ctx.lineTo(ancho, alto);
        ctx.lineTo(0, alto);
        ctx.closePath();

        const gradNieve = ctx.createLinearGradient(0, alto * 0.89, 0, alto);
        gradNieve.addColorStop(0, '#ffffff');
        gradNieve.addColorStop(0.35, '#f3f4fc');
        gradNieve.addColorStop(0.7, '#e1e3f6');
        gradNieve.addColorStop(1, '#cbc4ec');
        ctx.fillStyle = gradNieve;
        ctx.fill();

        /* ---------- 3. Sombras suaves en los valles (volumen) ---------- */
        ctx.save();
        ctx.clip();   // Solo dentro del manto
        for (let i = 1; i < principal.length - 1; i++) {
            const p = principal[i];
            const sombra = ctx.createRadialGradient(p.x, p.y + 40, 0, p.x, p.y + 40, ancho * 0.12);
            sombra.addColorStop(0, 'rgba(150, 140, 210, 0.16)');
            sombra.addColorStop(1, 'rgba(150, 140, 210, 0)');
            ctx.fillStyle = sombra;
            ctx.fillRect(p.x - ancho * 0.12, p.y, ancho * 0.24, alto);
        }

        // Brillos de escarcha
        for (let i = 0; i < 70; i++) {
            const x = Math.random() * ancho;
            const y = alto * 0.92 + Math.random() * alto * 0.08;
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.6 + 0.3})`;
            ctx.beginPath();
            ctx.arc(x, y, Math.random() * 1.4 + 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        /* ---------- 4. Borde superior iluminado ---------- */
        ctx.beginPath();
        trazarCurvaSuave(principal);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    dibujar();

    let temporizador = null;
    window.addEventListener('resize', () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(dibujar, 150);
    });
})();
