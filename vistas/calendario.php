<?php
session_start();
require_once __DIR__ . '/../includes/config.php';   // Zona horaria y hora de apertura (12:00h)
require_once __DIR__ . '/../bd/conexion.php';
require_once __DIR__ . '/../includes/funciones.php';
require_once __DIR__ . '/../includes/casilla.php';  // Datos del sorteo + HTML del interior (compartido con el fetch)

// Solo usuarios logueados
comprobarAutenticacion();

// "Hoy" y la hora: SIEMPRE los reales del servidor (Europe/Madrid, ver includes/config.php)
$hoy = date('Y-m-d');
$horaActual = (int) date('H');

$usuarioId = (int) $_SESSION['user_id'];

// ---------------------------------------------------------
// DATOS DE LA BBDD: solo 2 consultas para las 25 casillas (sin N+1)
// 1) Los 25 días (0 = 30 nov, 1..24 = diciembre) con premio y ganador (un único JOIN)
// 2) Las casillas en las que YA participó este empleado
// ---------------------------------------------------------
$diasBD = consultarSorteos($conn);
// Año del calendario: el de la BBDD (fecha del día 1); si faltara, el actual
$anio =isset($diasBD[1]) ? date('Y', strtotime($diasBD[1]['fecha'])) : date('Y');

// Lo que se puede enseñar de cada día a ESTE usuario (ver infoSorteo en includes/casilla.php).
// En la misma vuelta sacamos los premios que GANÓ este usuario y aún no ha abierto
// (le tocó en el clic de otro): si el día ya pasó, su casilla no sale "Expirada".
$infoDias = [];
$premiosPendientes = [];
foreach ($diasBD as $d => $fila) {
    $infoDias[$d] = infoSorteo($fila, $usuarioId);
    if ((int) $fila['ganador_id'] === $usuarioId && (int) $fila['abierto_por_ganador'] === 0) {
        $premiosPendientes[] = $d;
    }
}

$stmt = $conn->prepare("SELECT numero_dia FROM participaciones WHERE empleado_id = ?");
$stmt->execute([$usuarioId]);
$diasAbiertos = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));   // [1, 2, 5...]

// El día 0 (30 de noviembre) solo se pinta como casilla si existe en la BBDD
$primerDia = isset($diasBD[0]) ? 0 : 1;

// Colores corporativos de bloques IMC Toys para rotar en las cajas
$coloresIMC = ['imc-azul', 'imc-rojo', 'imc-naranja', 'imc-verde'];

$nombreCompleto = trim(($_SESSION['nombre'] ?? 'Usuario') . ' ' . ($_SESSION['apellidos'] ?? ''));

// Huecos antes del 1 de diciembre para que cada día caiga en su columna (L-D)
// date('N'): 1 = lunes ... 7 = domingo. En 2026 el 1 de diciembre es martes -> 1 hueco (30 nov)
$huecosPrevios = (int) date('N', strtotime($anio . '-12-01')) - 1;

// ---------------------------------------------------------
// PERSONAJES DECORATIVOS (img/calendario)
// Se leen todos los de la carpeta y se barajan en cada visita:
// 3 se sientan en el header y los 4 restantes encima de casillas.
// ---------------------------------------------------------
$personajes = glob(__DIR__ . '/../img/calendario/*.{png,webp}', GLOB_BRACE);
$personajes = array_map('basename', $personajes ?: []);
shuffle($personajes);

$personajesHeader   = array_slice($personajes, 0, 3);
$personajesCasillas = array_slice($personajes, 3, 4);

// ---------------------------------------------------------
// DÍAS DE PREMIO TOP: lazo + destellos dorados en las esquinas
// Wonderbox (4, 9 y 18) y Skating FC Barcelona (24).
// Cuando se conecte la BBDD podrá salir de dias_adviento.
// ---------------------------------------------------------
$diasPremioTop = [4, 9, 18, 24];

// Días donde se pueden sentar: laborables, ni festivo ni pasados sin abrir,
// ni la casilla de hoy ni las que llevan lazo o destellos (los taparían).
$diasCandidatos = [];
for ($d = 1; $d <= 24; $d++) {
    $f = sprintf('%s-12-%02d', $anio, $d);
    $ds = (int) date('N', strtotime($f));
    $esLaborable = isset($diasBD[$d]) ? (int) $diasBD[$d]['es_laborable'] === 1 : ($ds <= 5 && $d !== 8);
    $tieneLazoPrevisto = ($ds === 5 || $d === 24 || $f === $hoy || in_array($d, $diasPremioTop));
    $estaDisponible = $f > $hoy || in_array($d, $diasAbiertos);
    if ($esLaborable && !$tieneLazoPrevisto && $estaDisponible) {
        $diasCandidatos[] = $d;
    }
}
shuffle($diasCandidatos);

// Día => imagen del personaje que se sienta encima
$personajePorDia = [];
foreach ($personajesCasillas as $i => $img) {
    if (isset($diasCandidatos[$i])) {
        $personajePorDia[$diasCandidatos[$i]] = $img;
    }
}

// Posición de las bombillas sobre la guirnalda, en % de la imagen
// (x, y, giro en grados). La esquina derecha usa las mismas, en espejo.
$lucesGuirnalda = [
    [6, 5, -10], [18, 3, 8], [30, 9, -6], [42, 14, 10], [54, 12, -8], [66, 7, 6], [78, 5, -12], [89, 7, 10],
    [5, 22, 14], [8, 35, -8], [11, 49, 10], [14, 63, -6], [16, 77, 8]
];
$coloresLuces = ['red', 'yellow', 'blue', 'pink', 'green'];
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calendario de Adviento - IMC Toys</title>
    <!-- Favicon: logo IMC recortado y cuadrado (el PNG original tiene mucho margen y se veía diminuto) -->
    <link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="../img/favicon-192.png">
    <link rel="apple-touch-icon" href="../img/favicon-192.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap">
    <link rel="stylesheet" href="../css/styles.css">
    <link rel="stylesheet" href="../css/calendario.css">
</head>
<body class="layout-calendario">

    <!-- Degradados compartidos por todos los lazos SVG (se usan con fill: url(#...) en el CSS).
         Definirlos una sola vez evita repetirlos en cada casilla. -->
    <svg width="0" height="0" style="position: absolute;" aria-hidden="true" focusable="false">
        <defs>
            <radialGradient id="lazo-degradado-rojo" cx="35%" cy="30%" r="75%">
                <stop offset="0%"   stop-color="#ff6b78"/>
                <stop offset="55%"  stop-color="#e3172f"/>
                <stop offset="100%" stop-color="#8f0012"/>
            </radialGradient>
            <radialGradient id="lazo-degradado-oro" cx="35%" cy="30%" r="75%">
                <stop offset="0%"   stop-color="#fff1a8"/>
                <stop offset="55%"  stop-color="#ffc21a"/>
                <stop offset="100%" stop-color="#b87400"/>
            </radialGradient>
        </defs>
    </svg>

    <!-- CAPAS DE FONDO (de atrás hacia delante, z-index en calendario.css)
         Bokeh -> Estela + estrellas doradas -> Suelo de nieve -> Nieve cayendo
         -> [contenido] -> Guirnaldas de las esquinas -> Confeti -->
    <canvas id="canvas-bokeh"        class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-estela-fondo" class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-suelo-nieve"  class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-nieve"        class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-efectos"      class="capa-canvas" aria-hidden="true"></canvas>

    <!-- GUIRNALDAS DE ESQUINA: imagen PNG + bombillas del login por encima.
         La derecha es la misma pieza volteada con scaleX(-1). -->
    <?php foreach (['izq', 'der'] as $lado): ?>
        <div class="guirnalda-esquina guirnalda-<?= $lado ?>" aria-hidden="true">
            <img src="../img/guirlanda-sinfondo.png" alt="" class="guirnalda-img" decoding="async">
            <ul class="linea-luces luces-esquina">
                <?php foreach ($lucesGuirnalda as $i => [$x, $y, $giro]): ?>
                    <li class="<?= $coloresLuces[$i % count($coloresLuces)] ?>"
                        style="left: <?= $x ?>%; top: <?= $y ?>%; --giro: <?= $giro ?>deg;"></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endforeach; ?>

    <!-- HEADER FLOTANTE (efecto cristal) -->
    <header class="header-calendario">
        <!-- 3 personajes al azar sentados sobre el borde superior del header -->
        <div class="figuras-header" aria-hidden="true">
            <?php foreach ($personajesHeader as $img): ?>
                <img src="../img/calendario/<?= htmlspecialchars($img) ?>" alt="" class="personaje-header" decoding="async">
            <?php endforeach; ?>
        </div>

        <!-- Izquierda: píldora de la edición y, SOLO para el rol admin, acceso al panel.
             Un empleado normal no lo ve, y aunque escriba la ruta, vista_admin.php
             lo devuelve al calendario con comprobarAdmin(). -->
        <div class="header-izq">
            <span class="badge-edicion">Edición <?= $anio ?></span>
            <?php if (esAdmin()): ?>
                <a href="vista_admin.php" class="btn-ir-admin">Admin</a>
            <?php endif; ?>
        </div>

        <!-- Centro: título y bienvenida -->
        <div class="header-centro">
            <h1>Calendario de Adviento <span class="sin-corte">IMC Toys</span></h1>
            <p>Hola, <strong><?= htmlspecialchars($nombreCompleto) ?></strong> — Abre tu sorpresa diaria a partir de las <?= HORA_APERTURA . ':00h' ?></p>
        </div>

        <!-- Derecha: cerrar sesión + logo -->
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

    <!-- CUADRÍCULA: 7 columnas (lunes a domingo) -->
    <main class="contenedor-calendario">
      <!-- Cuerpo: su ancho se calcula en CSS para que las 4 filas quepan en pantalla -->
      <div class="calendario-cuerpo">
        <div class="dias-semana" aria-hidden="true">
            <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
        </div>

        <div class="grid-calendario">

            <!-- Huecos de noviembre para alinear el 1 de diciembre con su día de la semana.
                 Si el día 0 (30 nov) está en la BBDD, ese último hueco es una casilla real (bucle de abajo). -->
            <?php for ($h = $huecosPrevios; $h >= ($primerDia === 0 ? 2 : 1); $h--): ?>
                <div class="casilla casilla-previa imc-azul" aria-hidden="true">
                    <span class="casilla-tapa">
                        <span class="casilla-num"><?= 31 - $h ?></span>
                        <span class="casilla-mes">nov</span>
                        <?php if ($h === 1): ?><span class="casilla-tag">¡Empezamos!</span><?php endif; ?>
                    </span>
                </div>
            <?php endfor; ?>

            <?php $contadorRojas = 0; // Para alternar las esquinas del lazo y el acebo ?>
            <?php for ($dia = $primerDia; $dia <= 24; $dia++): ?>
                <?php
                // Día 0 = 30 de noviembre (casilla de arranque, mantiene el aspecto de noviembre)
                $esDiaCero = ($dia === 0);
                // La fecha manda la BBDD (la misma que valida abrir_dia.proc.php); si faltara, la calculamos
                $fechaCasilla = $diasBD[$dia]['fecha']
                    ?? ($esDiaCero ? "$anio-11-30" : sprintf('%s-12-%02d', $anio, $dia));
                $diaSemana = (int) date('N', strtotime($fechaCasilla)); // 6 = Sáb, 7 = Dom
                $colorClase = $esDiaCero ? 'imc-azul' : $coloresIMC[($dia - 1) % count($coloresIMC)];
                $tieneLazo = false;
                $bloqueada = false;

                // Laborable según la BBDD (si no estuviera, calculamos: L-V y no el 8)
                $esLaborable = isset($diasBD[$dia])
                    ? (int) $diasBD[$dia]['es_laborable'] === 1
                    : ($diaSemana <= 5 && $dia !== 8);

                // Qué se puede enseñar de este día (premio entregado, esperando, sin ganador...)
                $info = $infoDias[$dia] ?? ['tipo' => 'sin_premio'];
                $participo = in_array($dia, $diasAbiertos);

                // Lógica de estados por prioridad. Lo abierto manda:
                //  - las casillas en las que participó este usuario
                //  - y las que su GANADOR ya abrió: se ven abiertas para TODOS (foto + ganador)
                if ($participo || $info['tipo'] === 'premio') {
                    $estado = 'casilla-abierta';
                    $etiqueta = 'Abierta';
                    $mensaje = '';
                } elseif (!$esLaborable) {
                    $estado = 'casilla-festivo';
                    $etiqueta = ($dia === 8) ? 'Festivo' : 'Finde';
                    $colorClase = 'imc-escarchado';
                    $bloqueada = true;
                    $mensaje = ($dia === 8)
                        ? 'El 8 de diciembre es festivo: hoy no hay sorpresa.'
                        : 'Los fines de semana el calendario descansa. ¡Nos vemos el lunes!';
                } elseif ($fechaCasilla === $hoy) {
                    if ($horaActual >= HORA_APERTURA) {
                        $estado = 'casilla-hoy';
                        $etiqueta = '¡Ábreme!';
                        $tieneLazo = true;
                        $mensaje = '';
                    } else {
                        $estado = 'casilla-espera-hora';
                        $etiqueta = 'A las ' . HORA_APERTURA . ':00h';
                        $tieneLazo = true;
                        $mensaje = 'La sorpresa de hoy se desbloquea a las ' . HORA_APERTURA . ':00h. ¡Ya queda poco!';
                    }
                } elseif ($fechaCasilla > $hoy) {
                    $estado = 'casilla-futura';
                    $etiqueta = $esDiaCero ? '¡Empezamos!' : 'Próximamente';
                    $mensaje = 'Esta casilla se abrirá el ' . ($esDiaCero ? '30 de noviembre' : "$dia de diciembre") . ' a partir de las ' . HORA_APERTURA . ':00h.';
                    // Lazo visual en los viernes o el día 24 como pista de premio top
                    if ($diaSemana === 5 || $dia === 24) {
                        $tieneLazo = true;
                    }
                } elseif (in_array($dia, $premiosPendientes)) {
                    // Día pasado que GANÓ este usuario y aún no abrió: se puede abrir
                    // (mismo aspecto que la casilla de hoy para que llame la atención)
                    $estado = 'casilla-hoy';
                    $etiqueta = '¡Tu premio!';
                    $tieneLazo = true;
                    $mensaje = '';
                } else {
                    // Día laborable pasado que no se abrió (pendiente de decidir con Raquel)
                    $estado = 'casilla-pasada';
                    $etiqueta = 'Expirada';
                    $colorClase = 'imc-escarchado';
                    $bloqueada = true;
                    $mensaje = 'El ' . ($esDiaCero ? '30 de noviembre' : "$dia de diciembre") . ' ya ha pasado y esta casilla no se abrió a tiempo.';
                }

                // ¿Se puede pedir al servidor que la abra? Solo la de hoy tras las 12:00
                // (o un premio pendiente del ganador). El servidor lo vuelve a validar.
                $abrible = ($estado === 'casilla-hoy');

                // Premio top: lazo (si la caja no está bloqueada)
                $esPremioTop = in_array($dia, $diasPremioTop);
                if ($esPremioTop && !$bloqueada) {
                    $tieneLazo = true;
                }

                // Destellos dorados en las esquinas: premios top y la casilla de hoy
                $esPremioEspecial = $esPremioTop || $estado === 'casilla-hoy';

                // Adornos de las esquinas (img/decoracion), según el color de la caja:
                //  - Doradas (naranjas): bolas colgando arriba a la derecha.
                //  - Rojas: lazo en una esquina y acebo en la contraria; se van alternando
                //    caja a caja (arriba-izq/abajo-der y arriba-der/abajo-izq) para repartirlos.
                // Las bloqueadas (escarchadas) y el 30 de noviembre no llevan adornos.
                $adornos = [];
                if (!$esDiaCero && !$bloqueada) {
                    if ($colorClase === 'imc-naranja') {
                        $adornos[] = ['bolasnavidad-sinfondo.png', 'deco-bolas'];
                    } elseif ($colorClase === 'imc-rojo') {
                        $alterna = ($contadorRojas++ % 2 === 0);
                        $adornos[] = ['lazo-rojo.png', 'deco-lazo ' . ($alterna ? 'deco-arriba-izq' : 'deco-arriba-der')];
                        $adornos[] = ['acebo-sinfondo.png', 'deco-acebo ' . ($alterna ? 'deco-abajo-der' : 'deco-abajo-izq')];
                    } elseif ($colorClase === 'imc-verde' && $dia !== 24) {
                        // Verdes (4 y 16): campanas arriba a la derecha. El 24 tiene su propio lazo grande.
                        $adornos[] = ['campana-navidad.png', 'deco-campanas'];
                    }
                }

                // GRAN PREMIO FINAL (24 dic): marco dorado luminoso y lazo dorado grande
                $esGranFinal = ($dia === 24 && !$bloqueada);

                // Azules cerradas (30 nov, 1, 9, 17, 21): copos y destellos por las esquinas.
                // Si ya lleva los destellos de premio especial (el 9) no se duplican.
                $conCopos = ($colorClase === 'imc-azul' && !$bloqueada && !$esPremioEspecial
                             && $estado !== 'casilla-abierta');

                // Naranjas cerradas (3, 7, 11, 15, 23): estrellitas doradas abajo a la izquierda,
                // para equilibrar las bolas que cuelgan a la derecha
                $conEstrellasOro = ($colorClase === 'imc-naranja' && !$bloqueada && !$esPremioEspecial
                                    && $estado !== 'casilla-abierta');

                ?>

                <!-- data-*: lo que necesita calendario.js para los modales.
                     Los datos del premio SOLO salen cuando el ganador ya lo abrió (tipo 'premio'). -->
                <button type="button"
                        class="casilla <?= $estado ?> <?= $colorClase ?> <?= $esDiaCero ? 'casilla-previa' : '' ?> <?= $tieneLazo ? 'con-lazo' : '' ?> <?= $esPremioEspecial ? 'premio-especial' : '' ?> <?= $esGranFinal ? 'casilla-final' : '' ?>"
                        data-dia="<?= $dia ?>"
                        data-estado="<?= $estado ?>"
                        data-abrible="<?= $abrible ? '1' : '0' ?>"
                        data-mensaje="<?= htmlspecialchars($mensaje) ?>"
                        data-participo="<?= $participo ? '1' : '0' ?>"
                        data-tipo="<?= $info['tipo'] ?>"
                        <?php if ($info['tipo'] === 'premio'): ?>
                        data-mio="<?= $info['mio'] ? '1' : '0' ?>"
                        data-premio-nombre="<?= htmlspecialchars($info['premio']) ?>"
                        data-premio-descripcion="<?= htmlspecialchars($info['descripcion']) ?>"
                        data-premio-imagen="<?= htmlspecialchars($info['imagen']) ?>"
                        data-ganador-nombre="<?= htmlspecialchars($info['ganador']) ?>"
                        <?php endif; ?>
                        aria-label="<?= $esDiaCero ? '30 de noviembre' : "$dia de diciembre" ?>: <?= htmlspecialchars($etiqueta) ?>">

                    <!-- Personaje sentado encima (reparto aleatorio hecho arriba) -->
                    <?php if (isset($personajePorDia[$dia])): ?>
                        <img src="../img/calendario/<?= htmlspecialchars($personajePorDia[$dia]) ?>"
                             alt="" class="personaje-casilla" aria-hidden="true" loading="lazy" decoding="async">
                    <?php endif; ?>


                    <!-- Interior: lo que se ve con la puerta abierta. Lo pinta htmlInteriorCasilla()
                         (includes/casilla.php), la MISMA función que usa el fetch al abrir en directo -->
                    <span class="casilla-interior" aria-hidden="true"><?= $estado === 'casilla-abierta' ? htmlInteriorCasilla($info) : '' ?></span>

                    <!-- Puerta / tapa de la caja -->
                    <span class="casilla-tapa">
                        <?php if ($bloqueada): ?>
                            <!-- Nieve solo en casillas bloqueadas: efecto "congelado" -->
                            <img src="../img/nieve-casilla.png" alt="" class="capa-nieve" aria-hidden="true" loading="lazy" decoding="async">
                        <?php endif; ?>
                        <?php if ($esPremioEspecial): ?>
                            <!-- Destellos dorados en las esquinas interiores (no tocan el número) -->
                            <span class="destellos" aria-hidden="true">
                                <i class="estrella"></i><i class="punto"></i><i class="estrella"></i>
                                <i class="punto"></i><i class="estrella"></i><i class="punto"></i>
                            </span>
                        <?php endif; ?>
                        <?php if ($conCopos): ?>
                            <!-- Copos y destellos blancos en las esquinas (el centro queda libre) -->
                            <span class="destellos destellos-copos" aria-hidden="true">
                                <i class="copo-casilla"></i><i class="punto"></i><i class="estrella"></i>
                                <i class="punto"></i><i class="copo-casilla"></i><i class="estrella"></i>
                            </span>
                        <?php endif; ?>
                        <?php if ($conEstrellasOro): ?>
                            <!-- Estrellitas doradas (SVG) con brillo suave, en la zona izquierda / inferior izquierda -->
                            <span class="estrellas-oro" aria-hidden="true">
                                <?php for ($e = 0; $e < 4; $e++): ?>
                                    <svg class="estrellita" viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
                                <?php endfor; ?>
                                <i class="chispa"></i><i class="chispa"></i>
                            </span>
                        <?php endif; ?>
                        <?php foreach ($adornos as [$imgAdorno, $claseAdorno]): ?>
                            <img src="../img/decoracion/<?= $imgAdorno ?>" alt="" class="deco <?= $claseAdorno ?>" aria-hidden="true" loading="lazy" decoding="async">
                        <?php endforeach; ?>
                        <?php if ($esGranFinal): ?>
                            <!-- Lazo dorado GRANDE del gran premio final. Sobresale por encima de la caja:
                                 lazadas traseras y delanteras con pliegues, nudo con arrugas y dos caídas
                                 laterales que bajan hacia los lados (el centro, donde va el 24, queda libre). -->
                            <svg class="lazo lazo-final" viewBox="0 0 120 72" aria-hidden="true">
                                <!-- Caídas laterales (cintas) con su pliegue -->
                                <path class="lazo-caida" d="M54 34 C44 42, 30 50, 14 58 L23 59 L22 68 C36 58, 48 48, 58 38 Z"/>
                                <path class="lazo-caida" d="M66 34 C76 42, 90 50, 106 58 L97 59 L98 68 C84 58, 72 48, 62 38 Z"/>
                                <path class="lazo-pliegue" d="M55 36 C46 43, 34 50, 20 57 L23 59 C36 52, 47 45, 57 38 Z"/>
                                <path class="lazo-pliegue" d="M65 36 C74 43, 86 50, 100 57 L97 59 C84 52, 73 45, 63 38 Z"/>
                                <!-- Lazadas traseras (más oscuras: dan volumen) -->
                                <path class="lazo-lazada-tras" d="M57 27 C46 2, 18 2, 16 18 C15 30, 36 34, 57 31 Z"/>
                                <path class="lazo-lazada-tras" d="M63 27 C74 2, 102 2, 104 18 C105 30, 84 34, 63 31 Z"/>
                                <!-- Lazadas delanteras -->
                                <path class="lazo-lazada" d="M57 29 C44 10, 8 8, 6 22 C4 38, 34 42, 57 33 Z"/>
                                <path class="lazo-lazada" d="M63 29 C76 10, 112 8, 114 22 C116 38, 86 42, 63 33 Z"/>
                                <!-- Pliegues interiores de las lazadas -->
                                <path class="lazo-pliegue" d="M56 30 C44 20, 22 17, 19 24 C24 32, 40 34, 56 32 Z"/>
                                <path class="lazo-pliegue" d="M64 30 C76 20, 98 17, 101 24 C96 32, 80 34, 64 32 Z"/>
                                <!-- Brillos -->
                                <path class="lazo-brillo" d="M12 17 C18 11, 30 10, 38 15"/>
                                <path class="lazo-brillo" d="M82 15 C90 10, 102 11, 108 17"/>
                                <!-- Nudo con arrugas -->
                                <rect class="lazo-nudo" x="51" y="22" width="18" height="16" rx="6"/>
                                <path class="lazo-arruga" d="M55.5 25 C56.5 29, 56.5 32, 55.5 35.5"/>
                                <path class="lazo-arruga" d="M64.5 25 C63.5 29, 63.5 32, 64.5 35.5"/>
                                <path class="lazo-brillo" d="M57 25.5 C59 24.3, 61.5 24.3, 63 25.2"/>
                            </svg>
                        <?php elseif ($tieneLazo): ?>
                            <!-- Lazo de regalo relleno (los colores los pone el CSS) -->
                            <svg class="lazo" viewBox="0 0 64 46" aria-hidden="true">
                                <path class="lazo-cinta" d="M28 22 L19 44 L24.5 40.5 L28.5 45 L32 24 Z"/>
                                <path class="lazo-cinta" d="M36 22 L45 44 L39.5 40.5 L35.5 45 L32 24 Z"/>
                                <path class="lazo-lazada" d="M31 21 C22 5, 4 1, 3 12 C2 23, 18 27, 31 23 Z"/>
                                <path class="lazo-lazada" d="M33 21 C42 5, 60 1, 61 12 C62 23, 46 27, 33 23 Z"/>
                                <path class="lazo-pliegue" d="M30 21 C22 12, 11 9, 10 14 C13 19, 22 22, 30 22 Z"/>
                                <path class="lazo-pliegue" d="M34 21 C42 12, 53 9, 54 14 C51 19, 42 22, 34 22 Z"/>
                                <path class="lazo-brillo" d="M8 9 C12 5, 19 6, 23 10"/>
                                <path class="lazo-brillo" d="M41 10 C45 6, 52 5, 56 9"/>
                                <rect class="lazo-nudo" x="26.5" y="15.5" width="11" height="10" rx="3.5"/>
                            </svg>
                        <?php endif; ?>
                        <span class="casilla-num"><?= $esDiaCero ? 30 : $dia ?></span>
                        <span class="casilla-mes"><?= $esDiaCero ? 'nov' : 'dic' ?></span>
                        <span class="casilla-tag"><?= $etiqueta ?></span>
                        <?php if ($bloqueada): ?>
                            <svg class="candado" viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="5" y="11" width="14" height="10" rx="2"/>
                                <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
                            </svg>
                        <?php endif; ?>
                    </span>
                </button>
            <?php endfor; ?>
        </div>
      </div>
    </main>
    <!-- AVISO (toast) para casillas que aún no se pueden abrir -->
    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <!-- Scripts: SweetAlert2 (modal del premio) + capas reutilizadas + lógica del calendario -->
    <!-- defer: se descargan en paralelo sin frenar el pintado del HTML y se ejecutan en orden.
         motor-animacion.js va primero: es el bucle ÚNICO que comparten todos los canvas. -->
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" defer></script>
    <script src="../js/motor-animacion.js" defer></script>
    <script src="../js/bokeh.js" defer></script>
    <script src="../js/suelo-nieve.js" defer></script>
    <script src="../js/nieve.js" defer></script>
    <script src="../js/calendario.js" defer></script>
</body>
</html>
