/* =============================================================
   NIEVE: copos cayendo en tiempo real (Canvas)
   Autocontenido: solo necesita un <canvas id="canvas-nieve">.
   ============================================================= */
(function () {
    const canvas = document.getElementById('canvas-nieve');
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

    const TOTAL_COPOS = 90;
    const copos = [];

    // Rellena (o recicla) un copo con valores aleatorios
    function prepararCopo(copo, empezarArriba) {
        copo.x = Math.random() * ancho;
        copo.y = empezarArriba ? -10 : Math.random() * alto; // Al cargar ya hay nieve repartida
        copo.radio = Math.random() * 2.5 + 1;                 // 1px a 3.5px
        copo.velocidadY = copo.radio * 0.35 + 0.3;            // Los grandes caen más rápido (perspectiva)
        copo.amplitud = Math.random() * 1.2 + 0.3;            // Cuánto se balancea
        copo.fase = Math.random() * Math.PI * 2;
        copo.opacidad = Math.random() * 0.4 + 0.5;
    }

    for (let i = 0; i < TOTAL_COPOS; i++) {
        const copo = {};
        prepararCopo(copo, false);
        copos.push(copo);
    }

    function animar(ahora) {
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.clearRect(0, 0, ancho, alto);
        const tiempo = ahora * 0.001;

        copos.forEach((c) => {
            c.y += c.velocidadY;
            c.x += Math.sin(tiempo + c.fase) * c.amplitud * 0.5; // Vaivén lateral

            // Al salir por abajo vuelve a caer desde arriba
            if (c.y > alto + 10) prepararCopo(c, true);

            // Halo suave + núcleo blanco
            ctx.fillStyle = `rgba(255, 255, 255, ${c.opacidad * 0.25})`;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.radio * 2.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(255, 255, 255, ${c.opacidad})`;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.radio, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Un único bucle para todos los canvas (js/motor-animacion.js)
    registrarAnimacion(animar);
})();
