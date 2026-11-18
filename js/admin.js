/* =============================================================
   PANEL DE ADMINISTRACIÓN
   1. Filtro de la tabla de días (Todos / Con ganador / Pendientes)
   2. Buscador en tiempo real + filtro de empleados
   3. Acciones por fila (participa / rol) con fetch a admin_acciones.proc.php
   4. Alta de empleado con un modal de SweetAlert2
   El servidor vuelve a validarlo todo: aquí solo hay comodidad visual.
   ============================================================= */
(function () {
    const URL_ACCIONES = '../proc/admin_acciones.proc.php';
    const CSRF = document.body.dataset.csrf;
    const Alerta = Swal.mixin({ heightAuto: false, confirmButtonColor: '#E3001B', cancelButtonText: 'Cancelar' });

    // Envía una acción al servidor y devuelve su JSON (o un error legible)
    async function enviarAccion(datos) {
        const formulario = new FormData();
        formulario.append('csrf', CSRF);
        Object.entries(datos).forEach(([clave, valor]) => formulario.append(clave, valor));
        try {
            const respuesta = await fetch(URL_ACCIONES, { method: 'POST', body: formulario });
            return await respuesta.json();
        } catch (error) {
            return { ok: false, mensaje: 'No se pudo conectar con el servidor.' };
        }
    }

    // Marca como activo el botón pulsado dentro de su grupo de filtros
    function activarFiltro(boton) {
        boton.parentElement.querySelectorAll('.filtro').forEach((b) => b.classList.remove('activo'));
        boton.classList.add('activo');
    }

    // Muestra el mensaje "no hay resultados" si todas las filas están ocultas
    function actualizarFilaVacia(tbody) {
        const visibles = tbody.querySelectorAll('tr:not(.fila-vacia):not([hidden])').length;
        tbody.querySelector('.fila-vacia').hidden = visibles > 0;
        return visibles;
    }

    /* ==========================================================
       1. FILTRO DE DÍAS
       ========================================================== */
    const tbodyDias = document.querySelector('#tabla-dias tbody');

    document.querySelectorAll('[data-filtro-dias]').forEach((boton) => {
        boton.addEventListener('click', () => {
            activarFiltro(boton);
            const filtro = boton.dataset.filtroDias;
            tbodyDias.querySelectorAll('tr[data-estado]').forEach((fila) => {
                const estado = fila.dataset.estado;
                fila.hidden = !(
                    filtro === 'todos' ||
                    (filtro === 'con_ganador' && (estado === 'abierto' || estado === 'pendiente')) ||
                    filtro === estado
                );
            });
            actualizarFilaVacia(tbodyDias);
        });
    });

    /* ==========================================================
       2. BUSCADOR + FILTRO DE EMPLEADOS (se combinan)
       ========================================================== */
    const tbodyEmp = document.querySelector('#tabla-empleados tbody');
    const buscador = document.getElementById('buscador-empleados');
    const contador = document.getElementById('contador-empleados');
    let filtroEstado = 'todos';   // todos | participa | sin_registrar | excluido

    // Quita tildes para que "dominguez" encuentre "Domínguez"
    const normalizar = (texto) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    function filtrarEmpleados() {
        const busqueda = normalizar(buscador.value.trim());
        tbodyEmp.querySelectorAll('tr[data-id]').forEach((fila) => {
            const coincideTexto = busqueda === '' || normalizar(fila.dataset.busqueda).includes(busqueda);
            const coincideFiltro = filtroEstado === 'todos' || fila.dataset.estado === filtroEstado;
            fila.hidden = !(coincideTexto && coincideFiltro);
        });
        contador.textContent = actualizarFilaVacia(tbodyEmp);
    }

    buscador.addEventListener('input', filtrarEmpleados);

    document.querySelectorAll('[data-filtro-emp]').forEach((boton) => {
        boton.addEventListener('click', () => {
            activarFiltro(boton);
            filtroEstado = boton.dataset.filtroEmp;
            filtrarEmpleados();
        });
    });

    /* ==========================================================
       3. ACCIONES POR FILA
       ========================================================== */
    const kpiParticipantes = document.getElementById('kpi-participantes');

    tbodyEmp.addEventListener('click', async (evento) => {
        const boton = evento.target.closest('.btn-accion');
        if (!boton || boton.disabled) return;

        const fila = boton.closest('tr');
        const nombre = fila.dataset.nombre;
        const accion = boton.dataset.accion;
        const badgeRol = fila.querySelector('[data-campo="rol"]');
        const esAdmin = badgeRol.textContent.trim() === 'Admin';
        const excluido = fila.dataset.estado === 'excluido';
        const registrado = fila.dataset.participa === '1';

        // Confirmación con el texto adecuado a lo que va a pasar
        const preguntas = {
            toggle_excluido: !excluido
                ? ['¿Excluir del calendario?', `${nombre} no podrá iniciar sesión, ni entrar en el sorteo, ni volver a registrarse. Sus datos no se borran.`, 'Sí, excluir']
                : ['¿Volver a incluir?', registrado
                    ? `${nombre} vuelve a participar en el sorteo y podrá iniciar sesión.`
                    : `${nombre} deja de estar excluido y podrá registrarse para participar.`, 'Sí, incluir'],
            toggle_rol: esAdmin
                ? ['¿Quitar el rol de admin?', `${nombre} pasará a ser empleado y no podrá entrar en este panel.`, 'Sí, quitar']
                : ['¿Hacer administrador?', `${nombre} podrá entrar en este panel. Para iniciar sesión necesitará un PIN de administrador.`, 'Sí, hacer admin'],
        };
        const [titulo, texto, textoConfirmar] = preguntas[accion];

        const confirmacion = await Alerta.fire({
            icon: 'question', title: titulo, text: texto,
            showCancelButton: true, confirmButtonText: textoConfirmar,
        });
        if (!confirmacion.isConfirmed) return;

        boton.disabled = true;
        const datos = await enviarAccion({ accion, id: fila.dataset.id });
        boton.disabled = false;

        if (!datos.ok) {
            Alerta.fire({ icon: 'error', title: 'No se pudo guardar', text: datos.mensaje });
            return;
        }

        // Actualizamos la fila sin recargar la página
        if (accion === 'toggle_excluido') {
            // Mismo criterio que PHP: excluido manda; si no, "participa" = se ha registrado
            const estado = datos.excluido ? 'excluido' : (datos.participa ? 'participa' : 'sin_registrar');
            const etiquetas = { participa: 'Participa', sin_registrar: 'Sin registrar', excluido: 'Excluido' };
            const badge = fila.querySelector('[data-campo="estado"]');
            fila.dataset.estado = estado;
            badge.textContent = etiquetas[estado];
            badge.className = 'badge badge-emp-' + estado;
            boton.textContent = datos.excluido ? 'Incluir' : 'Excluir';
            // Solo cambia el número de participantes si estaba registrado
            if (datos.participa) {
                kpiParticipantes.textContent = Number(kpiParticipantes.textContent) + (datos.excluido ? -1 : 1);
            }
        } else {
            badgeRol.textContent = datos.rol === 'admin' ? 'Admin' : 'Empleado';
            badgeRol.className = 'badge badge-rol-' + datos.rol;
            boton.textContent = datos.rol === 'admin' ? 'Quitar admin' : 'Hacer admin';
        }
        filtrarEmpleados();   // Por si con el filtro activo la fila ya no debe verse

        Alerta.fire({ icon: 'success', title: 'Guardado', text: datos.mensaje, timer: 2200, showConfirmButton: false });
    });

    /* ==========================================================
       4. NUEVO EMPLEADO (modal con formulario)
       ========================================================== */
    document.getElementById('btn-nuevo-empleado').addEventListener('click', () => {
        Alerta.fire({
            title: 'Nuevo empleado',
            html: `
                <div class="form-alta">
                    <label>Nombre *<input id="alta-nombre" class="swal2-input" maxlength="100" autocomplete="off"></label>
                    <label>Apellidos<input id="alta-apellidos" class="swal2-input" maxlength="100" autocomplete="off"></label>
                    <label>Correo corporativo *<input id="alta-email" type="email" class="swal2-input" maxlength="150" placeholder="nombre@imc.es" autocomplete="off"></label>
                    <label>Departamento<input id="alta-departamento" class="swal2-input" maxlength="100" placeholder="General" autocomplete="off"></label>
                    <p class="form-alta-nota">Se crea con <strong>participa = Sí</strong>, rol empleado y ubicación IMC.</p>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Dar de alta',
            focusConfirm: false,
            didOpen: () => document.getElementById('alta-nombre').focus(),
            // preConfirm: valida y envía; si devuelve false el modal sigue abierto
            preConfirm: async () => {
                const valor = (id) => document.getElementById(id).value.trim();
                const datos = {
                    accion: 'crear_empleado',
                    nombre: valor('alta-nombre'),
                    apellidos: valor('alta-apellidos'),
                    email: valor('alta-email').toLowerCase(),
                    departamento: valor('alta-departamento'),
                };

                if (!datos.nombre || !datos.email) {
                    Swal.showValidationMessage('El nombre y el correo son obligatorios.');
                    return false;
                }
                if (!/^[^\s@]+@(imctoys\.com|imc\.es)$/.test(datos.email)) {
                    Swal.showValidationMessage('El correo debe ser @imctoys.com o @imc.es.');
                    return false;
                }

                const respuesta = await enviarAccion(datos);
                if (!respuesta.ok) {
                    Swal.showValidationMessage(respuesta.mensaje);   // p. ej. "Ya existe un empleado con ese correo"
                    return false;
                }
                return respuesta;
            },
        }).then((resultado) => {
            if (!resultado.isConfirmed) return;
            Alerta.fire({ icon: 'success', title: '¡Alta completada!', text: resultado.value.mensaje })
                .then(() => location.reload());   // Recargamos para ver la fila nueva en su sitio
        });
    });
})();
