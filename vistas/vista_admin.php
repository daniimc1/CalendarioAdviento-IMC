<?php
session_start();
require_once __DIR__ . '/../bd/conexion.php';
require_once __DIR__ . '/../includes/funciones.php';

// Solo administradores: si no está logueado va al login,
// y si es empleado normal vuelve al calendario.
comprobarAdmin();

date_default_timezone_set('Europe/Madrid');
$hoy = date('Y-m-d');                 // El panel usa SIEMPRE la fecha real del servidor
$adminId = (int) $_SESSION['user_id'];

// Token CSRF: cada acción del panel lo envía y admin_acciones.proc.php lo comprueba
if (empty($_SESSION['csrf_admin'])) {
    $_SESSION['csrf_admin'] = bin2hex(random_bytes(32));
}

// ---------------------------------------------------------
// 1. EMPLEADOS (con el día que han ganado, si alguno)
//    dias_adviento.ganador_id es UNIQUE: como mucho una fila por empleado
// ---------------------------------------------------------
$empleados = $conn->query(
    "SELECT e.id, e.nombre, e.apellidos, e.email, e.ubicacion, e.departamento, e.rol, e.participa, e.excluido,
            d.numero_dia AS dia_ganado, d.abierto_por_ganador
     FROM empleados e
     LEFT JOIN dias_adviento d ON d.ganador_id = e.id
     ORDER BY e.excluido, e.participa DESC, e.nombre, e.apellidos"
)->fetchAll(PDO::FETCH_ASSOC);

$totalPlantilla  = count($empleados);
// Estado de cada empleado: 'excluido' (lo decide un admin) manda sobre 'participa' (se ha registrado)
foreach ($empleados as &$e) {
    $e['estado'] = (int) $e['excluido'] === 1 ? 'excluido' : ((int) $e['participa'] === 1 ? 'participa' : 'sin_registrar');
}
unset($e);

$etiquetasEmpleado = ['participa' => 'Participa', 'sin_registrar' => 'Sin registrar', 'excluido' => 'Excluido'];
$totalParticipan = count(array_filter($empleados, fn($e) => $e['estado'] === 'participa'));

// ---------------------------------------------------------
// 2. DÍAS DEL CALENDARIO con premio, ganador y hora de apertura
//    La hora de apertura es la participación del propio ganador ese día.
// ---------------------------------------------------------
$dias = $conn->query(
    "SELECT d.numero_dia, d.fecha, d.es_laborable, d.premio_id, d.ganador_id, d.abierto_por_ganador,
            p.nombre AS premio, p.imagen,
            e.nombre AS ganador_nombre, e.apellidos AS ganador_apellidos, e.email AS ganador_email,
            pa.fecha_hora AS apertura,
            (SELECT COUNT(*) FROM participaciones x WHERE x.numero_dia = d.numero_dia) AS jugadas
     FROM dias_adviento d
     LEFT JOIN premios p         ON p.id = d.premio_id
     LEFT JOIN empleados e       ON e.id = d.ganador_id
     LEFT JOIN participaciones pa ON pa.numero_dia = d.numero_dia AND pa.empleado_id = d.ganador_id
     ORDER BY d.fecha"
)->fetchAll(PDO::FETCH_ASSOC);

// Estado de cada día (el mismo criterio para la tabla, los filtros y las tarjetas)
$etiquetasEstado = [
    'abierto'     => 'Abierto',
    'pendiente'   => 'Pendiente de abrir',
    'sin_ganador' => 'Sin ganador',
    'proximo'     => 'Próximo',
    'finde'       => 'Finde/Festivo',
];

$diasSemana = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
$meses      = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

$premiosAbiertos = 0;
$pendientes      = 0;
$diasRestantes   = 0;

foreach ($dias as &$d) {
    if ((int) $d['es_laborable'] === 0) {
        $d['estado'] = 'finde';
    } elseif ($d['ganador_id'] !== null) {
        $d['estado'] = (int) $d['abierto_por_ganador'] === 1 ? 'abierto' : 'pendiente';
    } elseif ($d['premio_id'] === null || $d['fecha'] < $hoy || (int) $d['jugadas'] > 0) {
        $d['estado'] = 'sin_ganador';      // Ya pasó (o ya se jugó) y no hubo ganador
    } else {
        $d['estado'] = 'proximo';
    }

    $t = strtotime($d['fecha']);
    $d['texto_fecha'] = $diasSemana[(int) date('N', $t)] . ' ' . (int) date('j', $t) . ' ' . $meses[(int) date('n', $t)];

    if ($d['estado'] === 'abierto')   $premiosAbiertos++;
    if ($d['estado'] === 'pendiente') $pendientes++;
    if ((int) $d['es_laborable'] === 1 && $d['fecha'] >= $hoy) $diasRestantes++;
}
unset($d);   // Rompe la referencia del foreach (buena práctica tras usar &)

$h = fn($texto) => htmlspecialchars((string) $texto, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de administración - Calendario IMC Toys</title>
    <!-- Favicon: logo IMC recortado y cuadrado (el PNG original tiene mucho margen y se veía diminuto) -->
    <link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="../img/favicon-192.png">
    <link rel="apple-touch-icon" href="../img/favicon-192.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap">
    <link rel="stylesheet" href="../css/styles.css">
    <link rel="stylesheet" href="../css/calendario.css">   <!-- Cabecera, botones y logo compartidos -->
    <link rel="stylesheet" href="../css/admin.css">
</head>
<body class="layout-admin" data-csrf="<?= $h($_SESSION['csrf_admin']) ?>">

    <!-- Mismo fondo que el calendario: bokeh + nieve cayendo -->
    <canvas id="canvas-bokeh" class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-nieve" class="capa-canvas" aria-hidden="true"></canvas>

    <!-- CABECERA (misma pieza de cristal que el calendario) -->
    <header class="header-calendario header-admin">
        <div class="header-izq">
            <a href="calendario.php" class="btn-salir btn-volver">&larr; Calendario</a>
        </div>
        <div class="header-centro">
            <h1>Panel de administración</h1>
            <p>Hola, <strong><?= $h(trim(($_SESSION['nombre'] ?? '') . ' ' . ($_SESSION['apellidos'] ?? ''))) ?></strong> · Datos a <?= date('d/m/Y H:i') ?></p>
        </div>
        <div class="header-der">
            <a href="../proc/logout.proc.php" class="btn-salir">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 16l4-4-4-4M19 12H9"/></svg>
                Salir
            </a>
            <span class="logo-header-caja">
                <img src="../img/logo-imc-sinfondo.png" alt="IMC Toys" class="logo-header">
            </span>
        </div>
    </header>

    <main class="admin-contenido">

        <!-- =====================================================
             BLOQUE 1 · RESUMEN (4 tarjetas)
             ===================================================== -->
        <section class="kpis" aria-label="Resumen">
            <article class="kpi">
                <span class="kpi-icono">👥</span>
                <span class="kpi-valor" id="kpi-participantes"><?= $totalParticipan ?></span>
                <span class="kpi-titulo">Participantes activos</span>
                <span class="kpi-nota">de <?= $totalPlantilla ?> en plantilla</span>
            </article>
            <article class="kpi">
                <span class="kpi-icono">🎁</span>
                <span class="kpi-valor"><?= $premiosAbiertos ?></span>
                <span class="kpi-titulo">Premios abiertos</span>
                <span class="kpi-nota">el ganador ya vio su premio</span>
            </article>
            <article class="kpi <?= $pendientes > 0 ? 'kpi-aviso' : '' ?>">
                <span class="kpi-icono">⏳</span>
                <span class="kpi-valor"><?= $pendientes ?></span>
                <span class="kpi-titulo">Pendientes de abrir</span>
                <span class="kpi-nota"><?= $pendientes > 0 ? 'hay ganadores sin entrar' : 'todo al día' ?></span>
            </article>
            <article class="kpi">
                <span class="kpi-icono">📅</span>
                <span class="kpi-valor"><?= $diasRestantes ?></span>
                <span class="kpi-titulo">Días jugables restantes</span>
                <span class="kpi-nota">laborables desde hoy</span>
            </article>
        </section>

        <!-- =====================================================
             BLOQUE 2 · SEGUIMIENTO DE DÍAS Y GANADORES
             ===================================================== -->
        <section class="tarjeta">
            <div class="tarjeta-cabecera">
                <h2>Seguimiento de días y ganadores</h2>
                <div class="filtros" role="group" aria-label="Filtrar días">
                    <button type="button" class="filtro activo" data-filtro-dias="todos">Todos</button>
                    <button type="button" class="filtro" data-filtro-dias="con_ganador">Con ganador</button>
                    <button type="button" class="filtro" data-filtro-dias="pendiente">Pendientes de abrir</button>
                </div>
            </div>

            <div class="tabla-scroll">
                <table class="tabla-admin" id="tabla-dias">
                    <thead>
                        <tr>
                            <th>Día</th>
                            <th>Premio</th>
                            <th>Ganador</th>
                            <th>Estado</th>
                            <th>Apertura</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($dias as $d): ?>
                            <tr data-estado="<?= $d['estado'] ?>" class="<?= $d['fecha'] === $hoy ? 'fila-hoy' : '' ?>">
                                <td class="celda-dia"><?= $h($d['texto_fecha']) ?><?= $d['fecha'] === $hoy ? ' <span class="badge badge-hoy">Hoy</span>' : '' ?></td>
                                <td>
                                    <?php if ($d['premio'] !== null): ?>
                                        <span class="premio-celda">
                                            <?php if ($d['imagen']): ?>
                                                <img src="../<?= $h($d['imagen']) ?>" alt="" class="miniatura" loading="lazy" width="44" height="44">
                                            <?php else: ?>
                                                <span class="miniatura miniatura-vacia">🎁</span>
                                            <?php endif; ?>
                                            <?= $h($d['premio']) ?>
                                        </span>
                                    <?php else: ?>
                                        <span class="texto-suave">—</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php if ($d['ganador_id'] !== null): ?>
                                        <strong><?= $h(trim($d['ganador_nombre'] . ' ' . $d['ganador_apellidos'])) ?></strong>
                                        <span class="correo"><?= $h($d['ganador_email']) ?></span>
                                    <?php else: ?>
                                        <span class="texto-suave">—</span>
                                    <?php endif; ?>
                                </td>
                                <td><span class="badge badge-<?= $d['estado'] ?>"><?= $etiquetasEstado[$d['estado']] ?></span></td>
                                <td class="celda-apertura">
                                    <?= $d['apertura'] ? $h(date('d/m H:i', strtotime($d['apertura']))) : '<span class="texto-suave">—</span>' ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                        <tr class="fila-vacia" hidden><td colspan="5">No hay días con este filtro.</td></tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- =====================================================
             BLOQUE 3 · GESTIÓN DE EMPLEADOS
             ===================================================== -->
        <section class="tarjeta">
            <div class="tarjeta-cabecera">
                <h2>Gestión de empleados <span class="contador" id="contador-empleados"><?= $totalPlantilla ?></span></h2>
                <button type="button" class="btn-primario-admin" id="btn-nuevo-empleado">+ Nuevo empleado</button>
            </div>

            <div class="barra-busqueda">
                <input type="search" id="buscador-empleados" class="buscador"
                       placeholder="Buscar por nombre, apellidos, correo o departamento…" aria-label="Buscar empleados">
                <div class="filtros" role="group" aria-label="Filtrar empleados">
                    <button type="button" class="filtro activo" data-filtro-emp="todos">Todos</button>
                    <button type="button" class="filtro" data-filtro-emp="participa">Participan</button>
                    <button type="button" class="filtro" data-filtro-emp="sin_registrar">Sin registrar</button>
                    <button type="button" class="filtro" data-filtro-emp="excluido">Excluidos</button>
                </div>
            </div>

            <div class="tabla-scroll">
                <table class="tabla-admin" id="tabla-empleados">
                    <thead>
                        <tr>
                            <th>Empleado</th>
                            <th>Departamento</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Ha ganado</th>
                            <th class="col-acciones">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($empleados as $e): ?>
                            <?php
                            $esYo = (int) $e['id'] === $adminId;
                            $nombreCompleto = trim($e['nombre'] . ' ' . $e['apellidos']);
                            // Texto en minúsculas sobre el que busca el JS
                            $textoBusqueda = mb_strtolower($nombreCompleto . ' ' . $e['email'] . ' ' . $e['departamento']);
                            ?>
                            <tr data-id="<?= (int) $e['id'] ?>"
                                data-estado="<?= $e['estado'] ?>"
                                data-participa="<?= (int) $e['participa'] ?>"
                                data-nombre="<?= $h($nombreCompleto) ?>"
                                data-busqueda="<?= $h($textoBusqueda) ?>">
                                <td>
                                    <strong><?= $h($nombreCompleto) ?></strong><?= $esYo ? ' <span class="badge badge-tu">Tú</span>' : '' ?>
                                    <span class="correo"><?= $h($e['email']) ?></span>
                                </td>
                                <td><?= $h($e['departamento']) ?><span class="correo"><?= $h($e['ubicacion']) ?></span></td>
                                <td><span class="badge badge-rol-<?= $h($e['rol']) ?>" data-campo="rol"><?= $e['rol'] === 'admin' ? 'Admin' : 'Empleado' ?></span></td>
                                <td><span class="badge badge-emp-<?= $e['estado'] ?>" data-campo="estado"><?= $etiquetasEmpleado[$e['estado']] ?></span></td>
                                <td>
                                    <?php if ($e['dia_ganado'] !== null): ?>
                                        <span class="badge <?= (int) $e['abierto_por_ganador'] ? 'badge-abierto' : 'badge-pendiente' ?>">
                                            🏆 <?= (int) $e['dia_ganado'] === 0 ? '30 nov' : (int) $e['dia_ganado'] . ' dic' ?>
                                        </span>
                                    <?php else: ?>
                                        <span class="texto-suave">—</span>
                                    <?php endif; ?>
                                </td>
                                <td class="col-acciones">
                                    <button type="button" class="btn-accion" data-accion="toggle_excluido">
                                        <?= $e['estado'] === 'excluido' ? 'Incluir' : 'Excluir' ?>
                                    </button>
                                    <button type="button" class="btn-accion" data-accion="toggle_rol" <?= $esYo ? 'disabled title="No puedes cambiar tu propio rol"' : '' ?>>
                                        <?= $e['rol'] === 'admin' ? 'Quitar admin' : 'Hacer admin' ?>
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                        <tr class="fila-vacia" hidden><td colspan="6">Ningún empleado coincide con la búsqueda.</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="../js/motor-animacion.js"></script>   <!-- Bucle único de animación: antes que los canvas -->
    <script src="../js/bokeh.js"></script>
    <script src="../js/nieve.js"></script>
    <script src="../js/admin.js"></script>
</body>
</html>
