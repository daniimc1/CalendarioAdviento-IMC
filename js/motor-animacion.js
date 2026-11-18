/* =============================================================
   MOTOR DE ANIMACIÓN: UN SOLO BUCLE requestAnimationFrame PARA TODO
   Antes cada canvas (bokeh, nieve, estrellas, confeti, muñeco...) tenía
   su propio bucle. Ahora todos se apuntan aquí con:
       registrarAnimacion(function (tiempo) { ...dibujar un fotograma... });
   Ventajas:
   - Un único requestAnimationFrame por página (menos trabajo para el navegador).
   - Máximo 60 fotogramas por segundo, también en monitores de 120/144 Hz.
   - Se PARA del todo cuando la pestaña no está visible (document.hidden)
     y vuelve a arrancar al volver a ella.
   Se carga ANTES que el resto de scripts de canvas.
   ============================================================= */
(function () {
    const tareas = [];               // Funciones de dibujo registradas
    const MS_POR_FOTOGRAMA = 1000 / 60;
    let enMarcha = false;
    let ultimoFotograma = 0;

    function bucle(ahora) {
        // Pestaña oculta: no pedimos más fotogramas (el bucle se detiene)
        if (document.hidden) {
            enMarcha = false;
            return;
        }
        requestAnimationFrame(bucle);

        // Límite de 60 FPS (el margen de 1 ms evita saltarse fotogramas en pantallas de 60 Hz)
        if (ahora - ultimoFotograma < MS_POR_FOTOGRAMA - 1) return;
        ultimoFotograma = ahora;

        const tiempo = Date.now();   // Los scripts usan Date.now() para sus ondas y temporizadores
        for (let i = 0; i < tareas.length; i++) {
            tareas[i](tiempo);
        }
    }

    function arrancar() {
        if (!enMarcha && !document.hidden) {
            enMarcha = true;
            requestAnimationFrame(bucle);
        }
    }

    // Al volver a la pestaña, el bucle se reanuda
    document.addEventListener('visibilitychange', arrancar);

    // API pública: cada script de canvas registra su función de dibujo
    window.registrarAnimacion = function (funcion) {
        tareas.push(funcion);
        arrancar();
    };
})();
