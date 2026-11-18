/* =============================================================
   CALENDARIO DE ADVIENTO - Efectos e interacción
   1. Fondo: estrellas doradas + 4 estrellas fugaces alrededor de la cuadrícula
      (desactivable con mostrarEstelaFondo). Los copos blancos los pone nieve.js
   2. Confeti al abrir una casilla
   3. Clics: abrir / vibración + aviso, y modal SweetAlert2
   4. Toast
   Los dibujos se hacen dentro del bucle ÚNICO de js/motor-animacion.js.
   Las guirnaldas de las esquinas ya no son Canvas: son una imagen PNG
   con las bombillas CSS del login por encima (ver calendario.php).

   La apertura real se pide al servidor con fetch (proc/abrir_dia.proc.php):
   PHP valida fecha, hora, que no se repita y hace el sorteo.
   ============================================================= */
(function () {

    /* ----------------------------------------------------------
       CONFIGURACIÓN
       ---------------------------------------------------------- */
    const mostrarEstelaFondo = true;   // Pon false para quitar la estela fugaz del fondo

    const canvasEstela = document.getElementById('canvas-estela-fondo');
    const canvasEfectos = document.getElementById('canvas-efectos');
    const ctxEstela = canvasEstela ? canvasEstela.getContext('2d') : null;
    const ctxEfectos = canvasEfectos ? canvasEfectos.getContext('2d') : null;
    const grid = document.querySelector('.grid-calendario');

    let ancho = window.innerWidth;
    let alto = window.innerHeight;
    let marco = null;   // Rectángulo de la cuadrícula (se mide al cargar y al redimensionar)

    function ajustarTamanos() {
        ancho = window.innerWidth;
        alto = window.innerHeight;
        [canvasEstela, canvasEfectos].forEach((c) => {
            if (!c) return;
            c.width = ancho;
            c.height = alto;
        });
        // Medimos la cuadrícula solo aquí: hacerlo en cada fotograma fuerza al navegador a recalcular el layout
        if (grid) {
            const r = grid.getBoundingClientRect();
            marco = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, rx: r.width / 2 + 34, ry: r.height / 2 + 30 };
        }
    }

    /* ==========================================================
       1. FONDO: ESTRELLAS DORADAS + ESTRELLAS FUGACES
       ========================================================== */

    // Estrella de 5 puntas
    function estrella5(ctx, x, y, radioExt, giro) {
        const radioInt = radioExt * 0.45;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? radioExt : radioInt;
            const a = -Math.PI / 2 + giro + i * (Math.PI / 5);
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    // OPTIMIZACIÓN: los halos dorados (de las estrellas y de la cabeza de cada cometa)
    // se pintan UNA vez en un lienzo pequeño y luego solo se copian con drawImage.
    // Así no se crean decenas de degradados ni se usa shadowBlur en cada fotograma.
    function crearSpriteHalo(r, g, b) {
        const lienzo = document.createElement('canvas');
        lienzo.width = lienzo.height = 64;
        const c = lienzo.getContext('2d');
        const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        c.fillStyle = grad;
        c.fillRect(0, 0, 64, 64);
        return lienzo;
    }
    const spriteHalo = crearSpriteHalo(255, 220, 120);    // Halo de las estrellas
    const spriteCabeza = crearSpriteHalo(255, 210, 74);   // Resplandor de la cabeza del cometa

    // --- A. Estrellas doradas flotando y titilando por todo el fondo ---
    const estrellas = [];
    for (let i = 0; i < 38; i++) {
        estrellas.push({
            x: Math.random(),                           // En fracción de pantalla
            y: Math.random(),
            vx: (Math.random() - 0.5) * 0.00010,
            vy: -(Math.random() * 0.00014 + 0.00004),   // Suben muy despacio
            tam: Math.random() * 4 + 4,                 // 4px a 8px de radio
            giro: Math.random() * Math.PI,
            velocidadGiro: (Math.random() - 0.5) * 0.004,
            fase: Math.random() * Math.PI * 2
        });
    }

    function dibujarEstrellas(tiempo) {
        estrellas.forEach((e) => {
            e.x += e.vx + Math.sin(tiempo * 0.0005 + e.fase) * 0.00006;
            e.y += e.vy;
            e.giro += e.velocidadGiro;
            if (e.y < -0.05) { e.y = 1.05; e.x = Math.random(); }
            if (e.x < -0.05) e.x = 1.05;
            if (e.x > 1.05) e.x = -0.05;

            const x = e.x * ancho;
            const y = e.y * alto;
            const titileo = (Math.sin(tiempo * 0.002 + e.fase) + 1) / 2;   // 0 -> 1
            const tam = e.tam * (0.8 + titileo * 0.35);

            // Halo cálido (sprite precalculado, ver crearSpriteHalo)
            ctxEstela.globalAlpha = 0.35 * titileo + 0.1;
            ctxEstela.drawImage(spriteHalo, x - tam * 3, y - tam * 3, tam * 6, tam * 6);

            // Estrella con degradado dorado
            const oro = ctxEstela.createLinearGradient(x, y - tam, x, y + tam);
            oro.addColorStop(0, '#fff3b0');
            oro.addColorStop(0.5, '#ffd24a');
            oro.addColorStop(1, '#e8a400');
            ctxEstela.globalAlpha = 0.55 + titileo * 0.45;
            ctxEstela.fillStyle = oro;
            estrella5(ctxEstela, x, y, tam, e.giro);
            ctxEstela.globalAlpha = 1;
        });
    }

    // --- B. Estela fugaz que rodea la cuadrícula ---
    // Recorrido: un "rectángulo redondeado" (superelipse) un poco más grande que la cuadrícula
    function puntoOrbita(t) {
        const a = t * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const n = 0.35;   // < 1: esquinas redondeadas y lados casi rectos
        return {
            x: marco.cx + marco.rx * Math.sign(c) * Math.pow(Math.abs(c), n),
            y: marco.cy + marco.ry * Math.sign(s) * Math.pow(Math.abs(s), n)
        };
    }

    // Varias estrellas fugaces a la vez, repartidas por la órbita (desfase = fracción de vuelta)
    const cometas = [
        { desfase: 0.00, cola: 0.15, escala: 1.00 },
        { desfase: 0.25, cola: 0.11, escala: 0.80 },
        { desfase: 0.50, cola: 0.14, escala: 0.95 },
        { desfase: 0.75, cola: 0.10, escala: 0.75 }
    ];
    const VELOCIDAD_VUELTA = 0.00006;  // Vueltas por milisegundo (~17 s por vuelta)
    const SEGMENTOS_COLA = 32;
    const chispasEstela = [];

    function dibujarCometa(cometa, tiempo) {
        const tCabeza = (tiempo * VELOCIDAD_VUELTA + cometa.desfase) % 1;
        const e = cometa.escala;

        // Cola: segmentos cada vez más finos y transparentes hacia atrás
        for (let i = 0; i < SEGMENTOS_COLA; i++) {
            const f1 = i / SEGMENTOS_COLA;              // 0 = cabeza, 1 = final de la cola
            const f2 = (i + 1) / SEGMENTOS_COLA;
            const p1 = puntoOrbita((tCabeza - f1 * cometa.cola + 1) % 1);
            const p2 = puntoOrbita((tCabeza - f2 * cometa.cola + 1) % 1);
            const fuerza = 1 - f1;

            // Resplandor ancho
            ctxEstela.strokeStyle = `rgba(255, 200, 80, ${0.18 * fuerza})`;
            ctxEstela.lineWidth = (16 * fuerza + 2) * e;
            ctxEstela.beginPath();
            ctxEstela.moveTo(p1.x, p1.y);
            ctxEstela.lineTo(p2.x, p2.y);
            ctxEstela.stroke();

            // Núcleo brillante
            ctxEstela.strokeStyle = `rgba(255, 246, 210, ${0.85 * fuerza})`;
            ctxEstela.lineWidth = (3.5 * fuerza + 0.5) * e;
            ctxEstela.beginPath();
            ctxEstela.moveTo(p1.x, p1.y);
            ctxEstela.lineTo(p2.x, p2.y);
            ctxEstela.stroke();
        }

        // Cabeza: núcleo blanco con resplandor
        const cabeza = puntoOrbita(tCabeza);
        const radioBrillo = 26 * e;   // Mismo alcance que tenía el shadowBlur
        ctxEstela.drawImage(spriteCabeza, cabeza.x - radioBrillo, cabeza.y - radioBrillo, radioBrillo * 2, radioBrillo * 2);
        ctxEstela.fillStyle = '#fffbe8';
        ctxEstela.beginPath();
        ctxEstela.arc(cabeza.x, cabeza.y, 5 * e, 0, Math.PI * 2);
        ctxEstela.fill();
        ctxEstela.fillStyle = 'rgba(255, 236, 150, 0.95)';
        estrella5(ctxEstela, cabeza.x, cabeza.y, 9 * e, tiempo * 0.003 + cometa.desfase * 6);

        // Una chispa por fotograma desde la cabeza
        chispasEstela.push({
            x: cabeza.x + (Math.random() - 0.5) * 8,
            y: cabeza.y + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 0.6,
            vy: Math.random() * 0.5 + 0.1,
            radio: (Math.random() * 1.8 + 0.6) * e,
            vida: 1,
            desgaste: Math.random() * 0.02 + 0.012,
            fase: Math.random() * Math.PI * 2
        });
    }

    function dibujarEstelaFugaz(tiempo) {
        if (!marco) return;

        // 1. Rastro tenue de toda la órbita (da sensación de recorrido)
        ctxEstela.beginPath();
        for (let i = 0; i <= 120; i++) {
            const p = puntoOrbita(i / 120);
            if (i === 0) ctxEstela.moveTo(p.x, p.y);
            else ctxEstela.lineTo(p.x, p.y);
        }
        ctxEstela.strokeStyle = 'rgba(255, 220, 130, 0.10)';
        ctxEstela.lineWidth = 2;
        ctxEstela.stroke();

        // 2. Las estrellas fugaces
        ctxEstela.lineCap = 'round';
        cometas.forEach((c) => dibujarCometa(c, tiempo));

        // 3. Chispas cayendo y apagándose
        for (let i = chispasEstela.length - 1; i >= 0; i--) {
            const c = chispasEstela[i];
            c.x += c.vx;
            c.y += c.vy;
            c.vida -= c.desgaste;
            if (c.vida <= 0) {
                chispasEstela.splice(i, 1);
                continue;
            }
            const brillo = (Math.sin(tiempo * 0.012 + c.fase) + 1) / 2;
            ctxEstela.fillStyle = `rgba(255, 226, 140, ${c.vida * (0.4 + brillo * 0.6)})`;
            ctxEstela.beginPath();
            ctxEstela.arc(c.x, c.y, c.radio, 0, Math.PI * 2);
            ctxEstela.fill();
        }
    }

    function dibujarFondo(tiempo) {
        ctxEstela.clearRect(0, 0, ancho, alto);
        dibujarEstrellas(tiempo);
        if (mostrarEstelaFondo) dibujarEstelaFugaz(tiempo);
    }

    /* ==========================================================
       2. CONFETI DORADO
       ========================================================== */
    const confeti = [];
    const coloresConfeti = ['#FFD24A', '#fff3b0', '#ffffff', '#FF9E1B', '#E3001B', '#24D024', '#0055A5'];

    function lanzarConfeti(x, y) {
        for (let i = 0; i < 90; i++) {
            const angulo = Math.random() * Math.PI * 2;
            const fuerza = Math.random() * 7 + 2;
            confeti.push({
                x: x,
                y: y,
                vx: Math.cos(angulo) * fuerza,
                vy: Math.sin(angulo) * fuerza - 3,      // Un poco hacia arriba
                ancho: Math.random() * 6 + 3,
                alto: Math.random() * 3 + 2,
                giro: Math.random() * Math.PI,
                velocidadGiro: (Math.random() - 0.5) * 0.4,
                color: coloresConfeti[(Math.random() * coloresConfeti.length) | 0],
                vida: 1,
                desgaste: Math.random() * 0.01 + 0.008
            });
        }
    }

    let hayConfetiPintado = false;   // Para no borrar un lienzo que ya está vacío

    function dibujarConfeti() {
        // Sin confeti en marcha no hay nada que hacer (casi siempre): ni siquiera borrar
        if (confeti.length === 0) {
            if (hayConfetiPintado) {
                ctxEfectos.clearRect(0, 0, ancho, alto);
                hayConfetiPintado = false;
            }
            return;
        }
        hayConfetiPintado = true;
        ctxEfectos.clearRect(0, 0, ancho, alto);

        for (let i = confeti.length - 1; i >= 0; i--) {
            const c = confeti[i];
            c.x += c.vx;
            c.y += c.vy;
            c.vy += 0.18;        // Gravedad
            c.vx *= 0.98;        // Rozamiento del aire
            c.giro += c.velocidadGiro;
            c.vida -= c.desgaste;

            if (c.vida <= 0 || c.y > alto + 20) {
                confeti.splice(i, 1);
                continue;
            }

            ctxEfectos.save();
            ctxEfectos.globalAlpha = c.vida;
            ctxEfectos.translate(c.x, c.y);
            ctxEfectos.rotate(c.giro);
            ctxEfectos.fillStyle = c.color;
            ctxEfectos.fillRect(-c.ancho / 2, -c.alto / 2, c.ancho, c.alto * Math.abs(Math.cos(c.giro * 2)));
            ctxEfectos.restore();
        }
    }

    /* ==========================================================
       DIBUJO DE CADA FOTOGRAMA (las dos capas de este archivo).
       Va dentro del bucle único de js/motor-animacion.js.
       ========================================================== */
    function animar(tiempo) {
        if (ctxEstela) dibujarFondo(tiempo);
        if (ctxEfectos) dibujarConfeti();
    }

    ajustarTamanos();
    registrarAnimacion(animar);

    // Al terminar de cargar fuentes e imágenes la cuadrícula puede moverse: volvemos a medirla
    window.addEventListener('load', ajustarTamanos);

    let temporizador = null;
    window.addEventListener('resize', () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(ajustarTamanos, 150);
    });


    /* ==========================================================
       3. INTERACCIÓN CON LAS CASILLAS (fetch -> proc/abrir_dia.proc.php)
       ========================================================== */
    const toast = document.getElementById('toast');
    const URL_ABRIR = '../proc/abrir_dia.proc.php';
    const ROJO_IMC = '#E3001B';

    // SweetAlert2 con nuestra configuración común.
    // heightAuto: false es OBLIGATORIO aquí: por defecto Swal pone height:auto en <html> y <body>,
    // el calendario mide su alto con cqh (100cqh) y las filas se quedaban a 0px (casillas apiladas).
    const Alerta = Swal.mixin({ heightAuto: false, confirmButtonColor: ROJO_IMC });

    document.querySelectorAll('.casilla[data-dia]').forEach((casilla) => {
        casilla.addEventListener('click', () => {
            if (casilla.dataset.estado === 'casilla-abierta') {
                mostrarResultado(casilla, false);       // Ya abierta: volvemos a enseñar lo que salió
            } else if (casilla.dataset.abrible === '1') {
                abrirCasilla(casilla);                  // El servidor decide (fecha, hora, sorteo)
            } else {
                vibrar(casilla);
                mostrarToast(casilla.dataset.mensaje);
            }
        });
    });

    // Pide al servidor abrir la casilla y, si dice que sí, anima la puerta
    async function abrirCasilla(casilla) {
        if (casilla.classList.contains('abriendo')) return;   // Evita doble clic
        casilla.classList.add('abriendo');

        const datosEnvio = new FormData();
        datosEnvio.append('accion', 'abrir');
        datosEnvio.append('dia', casilla.dataset.dia);

        let datos;
        try {
            const respuesta = await fetch(URL_ABRIR, { method: 'POST', body: datosEnvio });
            datos = await respuesta.json();
        } catch (error) {
            datos = { ok: false, mensaje: 'No hemos podido conectar con el servidor. Inténtalo de nuevo.' };
        }

        if (!datos.ok) {
            // El servidor no deja abrirla: la puerta vuelve a cerrarse
            casilla.classList.remove('abriendo');
            vibrar(casilla);
            Alerta.fire({ icon: 'info', title: 'Un momento...', text: datos.mensaje });
            return;
        }

        // Guardamos en la casilla lo que se puede enseñar (mismos data-* que pone PHP)
        guardarInfo(casilla, datos.info);
        casilla.dataset.participo = '1';

        // El interior lo genera el servidor con la MISMA función que usa calendario.php
        // (htmlInteriorCasilla en includes/casilla.php): así se ve igual que al recargar
        casilla.querySelector('.casilla-interior').innerHTML = datos.interior_html;

        if (datos.ganador) {
            const r = casilla.getBoundingClientRect();
            lanzarConfeti(r.left + r.width / 2, r.top + r.height / 2);
        }

        // Esperamos a que la puerta termine de girar y la dejamos abierta
        setTimeout(() => {
            casilla.classList.remove('abriendo', 'casilla-hoy', 'casilla-futura', 'casilla-pasada', 'casilla-festivo', 'casilla-espera-hora');
            casilla.classList.add('casilla-abierta');
            casilla.dataset.estado = 'casilla-abierta';
            casilla.dataset.abrible = '0';
            mostrarResultado(casilla, true, datos.mensaje);
        }, 750);
    }

    // Copia la info del sorteo (respuesta del servidor) a los data-* de la casilla
    function guardarInfo(casilla, info) {
        casilla.dataset.tipo = info.tipo;
        if (info.tipo === 'premio') {
            casilla.dataset.mio = info.mio ? '1' : '0';
            casilla.dataset.premioNombre = info.premio;
            casilla.dataset.premioDescripcion = info.descripcion || '';
            casilla.dataset.premioImagen = info.imagen || '';
            casilla.dataset.ganadorNombre = info.ganador;
        }
    }

    // Modal con lo que hay en la casilla. Sirve para:
    //  - el resultado al abrirla (esNueva = true, con el mensaje del servidor)
    //  - volver a verla, o verla SIN haber participado (solo lectura: no hay fetch,
    //    ni sorteo, ni avisos a Teams; solo se leen los data-* que ya tiene la casilla)
    function mostrarResultado(casilla, esNueva, mensajeServidor = '') {
        const d = casilla.dataset;
        const dia = Number(d.dia);
        const textoDia = dia === 0 ? '30 de noviembre' : `${dia} de diciembre`;

        if (d.tipo === 'premio') {
            const esMio = d.mio === '1';
            const opciones = {
                title: esMio
                    ? (esNueva ? '¡Enhorabuena, has ganado!' : `Tu premio del ${textoDia}`)
                    : `Premio del ${textoDia}`,
                html: `<strong>${escaparHTML(d.premioNombre)}</strong>` +
                      (d.premioDescripcion ? `<br>${escaparHTML(d.premioDescripcion)}` : '') +
                      (esMio ? '' : `<p class="swal-ganador">🏆 Lo ganó <strong>${escaparHTML(d.ganadorNombre)}</strong></p>`),
                confirmButtonText: esMio ? '¡Genial, gracias!' : '¡Enhorabuena!',
            };
            // Imagen NULL o vacía: icono en vez de imagen rota
            if (d.premioImagen) {
                opciones.imageUrl = '../' + d.premioImagen;
                opciones.imageAlt = d.premioNombre;
                opciones.imageHeight = 180;
                opciones.customClass = { image: 'swal-premio-img' };   // Encuadre y bordes (calendario.css)
            } else {
                opciones.icon = 'success';
            }
            Alerta.fire(opciones);
            return;
        }

        // Sin premio que enseñar (todavía o nunca): mensaje informativo
        const textos = {
            esperando:   ['Premio asignado', 'Este premio ya tiene dueño. Cuando el ganador abra su casilla, verás aquí qué era y quién lo ganó.'],
            sin_ganador: [textoDia, 'Este día se quedó sin ganador: todos los participantes ya tenían su premio.'],
            sin_premio:  [textoDia, 'Esta casilla no guardaba premio. ¡Nos vemos en la siguiente!'],
        };
        const [titulo, texto] = textos[d.tipo] || textos.sin_premio;
        Alerta.fire({
            icon: 'info',
            title: titulo,
            text: (esNueva && mensajeServidor) ? mensajeServidor : texto,
            confirmButtonText: '¡Vale!',
        });
    }

    // Evita inyectar HTML con los textos que vienen de la BBDD
    function escaparHTML(texto) {
        const div = document.createElement('div');
        div.textContent = texto || '';
        return div.innerHTML;
    }

    function vibrar(casilla) {
        casilla.classList.remove('vibrando');
        void casilla.offsetWidth;          // Fuerza reflow para poder repetir la animación
        casilla.classList.add('vibrando');
    }

    // Al terminar la vibración quitamos la clase para poder repetirla
    document.addEventListener('animationend', (e) => {
        if (e.animationName === 'shake') e.target.classList.remove('vibrando');
    });

    /* ==========================================================
       4. TOAST (casillas que aún no se pueden abrir)
       ========================================================== */
    let temporizadorToast = null;
    function mostrarToast(texto) {
        if (!texto) return;
        toast.textContent = texto;
        toast.classList.add('visible');
        clearTimeout(temporizadorToast);
        temporizadorToast = setTimeout(() => toast.classList.remove('visible'), 2800);
    }
})();
