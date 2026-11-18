/* =============================================================
   VALIDACIONES DEL FORMULARIO DE REGISTRO
   - Valida en tiempo real el correo corporativo (@imc.es / @imctoys.com).
   - Marca el input con .input-error y escribe el aviso en el <span>.
   - Activa / desactiva el botón de envío.
   - Avisa al muñeco con el evento 'correo:validacion'.
   Solo mejora la experiencia: la validación que cuenta está en PHP.
   ============================================================= */
(function () {
    const inputCorreo = document.getElementById('correo');
    if (!inputCorreo) return;

    const formulario   = inputCorreo.form;
    const btnEnviar    = formulario.querySelector('button[type="submit"]');
    const mensajeError = document.getElementById('mensaje-error-correo');

    // Igual que validarCorreoEmpresa() en PHP
    const regexCorporativo = /^[a-zA-Z0-9._%+-]+@(imc\.es|imctoys\.com)$/i;

    // Devuelve 'vacio', 'valido' o 'invalido'
    function comprobarCorreo(valor) {
        if (valor === '') return 'vacio';
        return regexCorporativo.test(valor) ? 'valido' : 'invalido';
    }

    // Avisa a quien quiera escuchar (el muñeco) sin depender de él
    function notificarEstado(estado) {
        document.dispatchEvent(new CustomEvent('correo:validacion', {
            detail: { estado: estado }
        }));
    }

    // Lanza el sobre al buzón (si buzon.js está cargado). Devuelve una promesa.
    function enviarAlBuzon() {
        if (typeof window.animarEnvioBuzon === 'function') {
            return window.animarEnvioBuzon();
        }
        return Promise.resolve();
    }

    let estadoAnterior = null;   // Para animar solo al PASAR a válido, no en cada tecla

    // avisarSiVacio: true al salir del campo o al enviar
    function validarCorreo(avisarSiVacio) {
        const estado = comprobarCorreo(inputCorreo.value.trim());

        // El correo acaba de volverse válido (y no es la carga de la página)
        if (estado === 'valido' && estadoAnterior !== null && estadoAnterior !== 'valido') {
            enviarAlBuzon();
        }
        estadoAnterior = estado;
        let textoError = '';

        if (estado === 'invalido') {
            textoError = 'Debes usar un correo corporativo (@imc.es o @imctoys.com)';
        } else if (estado === 'vacio' && avisarSiVacio) {
            textoError = 'El correo corporativo es obligatorio';
        }

        inputCorreo.classList.toggle('input-error', textoError !== '');
        // Con el texto vacío, .texto-error:empty oculta el span y no deja hueco
        if (mensajeError) mensajeError.textContent = textoError;
        btnEnviar.disabled = estado !== 'valido';

        notificarEstado(estado);
        return estado === 'valido';
    }

    inputCorreo.addEventListener('input', () => validarCorreo(false));
    inputCorreo.addEventListener('blur',  () => validarCorreo(true));

    // Al pulsar "Inscribirme": si el correo es válido, primero vuela el sobre
    // al buzón y después se envía el formulario de verdad a PHP.
    let enviando = false;
    formulario.addEventListener('submit', (e) => {
        e.preventDefault();
        if (enviando || !validarCorreo(true)) return;

        enviando = true;
        btnEnviar.disabled = true;
        // formulario.submit() no vuelve a disparar este evento, así que no hay bucle
        enviarAlBuzon().then(() => formulario.submit());
    });

    // Estado inicial: PHP puede haber rellenado el correo tras un error
    validarCorreo(false);
})();
