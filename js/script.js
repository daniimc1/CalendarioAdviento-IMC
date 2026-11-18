/* =============================================================
   1. ANIMACIÓN DE NIEVE (solo si la página tiene #contenedor-nieve)
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const contenedor = document.getElementById('contenedor-nieve');
    if (!contenedor) return;

    const maxCopos = 40; // Límite para que no sature la vista

    function crearCopo() {
        if (contenedor.children.length >= maxCopos) return;

        const copo = document.createElement('div');
        copo.classList.add('copo');

        // Tamaño aleatorio entre 4px y 8px
        const tamano = Math.floor(Math.random() * 5) + 4;
        copo.style.width = `${tamano}px`;
        copo.style.height = `${tamano}px`;

        // Posición horizontal aleatoria
        copo.style.left = `${Math.random() * (window.innerWidth - 20)}px`;

        // Duración variable de caída para que no caigan todos al mismo tiempo
        const duracion = (Math.random() * 3 + 4).toFixed(1);
        copo.style.animationDuration = `${duracion}s`;

        contenedor.appendChild(copo);

        // Eliminar del DOM tras completar la animación
        setTimeout(() => {
            copo.remove();
        }, duracion * 1000);
    }

    // Genera un copo cada 150ms de forma continua
    setInterval(crearCopo, 150);
});


/* =============================================================
   2. VALIDACIÓN DEL CORREO (login y registro) + PIN DE ADMIN (login)
   Esta validación solo mejora la experiencia del usuario.
   La validación que de verdad cuenta está en PHP (proc/).
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {

    const inputCorreo = document.getElementById('correo');
    if (!inputCorreo) return; // Página sin formulario de correo

    const formulario   = inputCorreo.form; // El <form> al que pertenece el input
    const btnEnviar    = formulario.querySelector('button[type="submit"]');
    const mensajeError = document.getElementById('mensaje-error-correo'); // Opcional

    // Solo @imc.es o @imctoys.com (igual que validarCorreoEmpresa() en PHP)
    const regexCorporativo = /^[a-zA-Z0-9._%+-]+@(imc\.es|imctoys\.com)$/i;

    // avisarSiVacio: true cuando el usuario sale del campo (blur) o envía
    function validarCorreo(avisarSiVacio) {
        const valor = inputCorreo.value.trim();
        let textoError = '';

        if (valor === '') {
            if (avisarSiVacio) textoError = 'El correo corporativo es obligatorio';
        } else if (!regexCorporativo.test(valor)) {
            textoError = 'Debes usar un correo corporativo (@imc.es o @imctoys.com)';
        }

        const esValido = valor !== '' && textoError === '';

        inputCorreo.classList.toggle('input-error', textoError !== '');
        if (mensajeError) mensajeError.textContent = textoError;
        btnEnviar.disabled = !esValido;

        return esValido;
    }

    inputCorreo.addEventListener('input', () => validarCorreo(false));
    inputCorreo.addEventListener('blur',  () => validarCorreo(true));

    // Al cargar: por si PHP rellenó el correo (cookie o error anterior)
    validarCorreo(false);

    /* ---------- PIN DE ADMINISTRADOR (solo en el login) ---------- */
    const inputPin = document.getElementById('pin_admin'); // Solo existe en login.php
    if (!inputPin) return; // En registro.php termina aquí

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault(); // Paramos el envío para preguntar el rol antes

        if (!validarCorreo(true)) return;

        try {
            // Preguntamos al servidor si el correo es de un administrador
            const respuesta = await fetch('../proc/verificar_rol.proc.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo: inputCorreo.value.trim() })
            });
            const datos = await respuesta.json();

            if (datos.es_admin) {
                const { value: pin } = await Swal.fire({
                    title: 'Acceso de Administrador',
                    text: 'Introduce tu PIN de seguridad para acceder al panel',
                    input: 'password',
                    inputPlaceholder: '••••',
                    inputAttributes: {
                        maxlength: '10',
                        autocapitalize: 'off',
                        autocorrect: 'off',
                        style: 'text-align: center; letter-spacing: 6px; font-size: 1.4rem;'
                    },
                    confirmButtonText: 'Verificar e Ingresar',
                    confirmButtonColor: '#E3001B',
                    showCancelButton: true,
                    cancelButtonText: 'Cancelar'
                });

                if (!pin) return;      // Canceló: no enviamos nada
                inputPin.value = pin;  // Rellenamos el input hidden de login.php
            }
        } catch {
            // Si falla el fetch enviamos igualmente: PHP volverá a comprobarlo todo
        }

        formulario.submit();
    });
});
