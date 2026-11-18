/* =============================================================
   BOKEH: orbes de luz desenfocadas de fondo (Canvas)
   Autocontenido: solo necesita un <canvas id="canvas-bokeh">.
   ============================================================= */
(function () {
    const canvas = document.getElementById('canvas-bokeh');
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

    // Tonos cálidos: oro suave, blanco, ámbar y rosa translúcido
    const colores = [
        { r: 255, g: 240, b: 180 },
        { r: 255, g: 255, b: 255 },
        { r: 255, g: 215, b: 150 },
        { r: 255, g: 190, b: 220 }
    ];

    const TOTAL_ORBES = 26;
    const orbes = [];

    for (let i = 0; i < TOTAL_ORBES; i++) {
        orbes.push({
            x: Math.random() * ancho,
            y: Math.random() * alto,
            radio: Math.random() * 45 + 20,            // Orbes medianos y grandes
            color: colores[i % colores.length],
            velocidadY: -(Math.random() * 0.22 + 0.08), // Suben despacio
            velocidadX: (Math.random() - 0.5) * 0.12,
            opacidadBase: Math.random() * 0.22 + 0.34,
            fase: Math.random() * Math.PI * 2           // Para que no laten a la vez
        });
    }

    // OPTIMIZACIÓN: el degradado radial de cada color se pinta UNA sola vez en un
    // lienzo pequeño ("sprite"). En cada fotograma solo se copia con drawImage,
    // escalado al radio del orbe y con su opacidad (globalAlpha). Se ve igual que
    // crear 26 degradados nuevos por fotograma, pero cuesta mucho menos.
    const RADIO_SPRITE = 64;
    const sprites = colores.map(({ r, g, b }) => {
        const lienzo = document.createElement('canvas');
        lienzo.width = lienzo.height = RADIO_SPRITE * 2;
        const c = lienzo.getContext('2d');
        const grad = c.createRadialGradient(RADIO_SPRITE, RADIO_SPRITE, 0, RADIO_SPRITE, RADIO_SPRITE, RADIO_SPRITE);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
        grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.5)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        c.fillStyle = grad;
        c.fillRect(0, 0, lienzo.width, lienzo.height);
        return lienzo;
    });

    function animar(tiempo) {
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.clearRect(0, 0, ancho, alto);

        orbes.forEach((o, i) => {
            o.x += o.velocidadX;
            o.y += o.velocidadY;

            // Si sale por un borde, reaparece por el contrario
            if (o.y < -o.radio * 2) o.y = alto + o.radio * 2;
            if (o.x < -o.radio * 2) o.x = ancho + o.radio * 2;
            if (o.x > ancho + o.radio * 2) o.x = -o.radio * 2;

            const pulso = (Math.sin(tiempo * 0.0018 + o.fase) + 1) / 2;
            ctx.globalAlpha = Math.min(1, o.opacidadBase * (0.75 + pulso * 1.25));
            ctx.drawImage(sprites[i % sprites.length], o.x - o.radio, o.y - o.radio, o.radio * 2, o.radio * 2);
        });
        ctx.globalAlpha = 1;
    }

    // Un único bucle para todos los canvas (js/motor-animacion.js)
    registrarAnimacion(animar);
})();
