<?php
/* =============================================================
   ABRIR UNA CASILLA DEL CALENDARIO (endpoint JSON para fetch)
   - Sortea el ganador del día (primer clic) y registra la participación del empleado.
   - Valida SIEMPRE con la fecha y la hora reales del servidor.
   Siempre responde JSON: { ok: true|false, ... }
   ============================================================= */

session_start();
require_once __DIR__ . '/../includes/config.php';    // Zona horaria Europe/Madrid y HORA_APERTURA
require_once __DIR__ . '/../bd/conexion.php';
require_once __DIR__ . '/../includes/funciones.php';
require_once __DIR__ . '/../includes/teams.php';     // URL del webhook, interruptor y enviarAvisoTeams()
require_once __DIR__ . '/../includes/casilla.php';   // infoSorteo() + htmlInteriorCasilla() (igual que calendario.php)

header('Content-Type: application/json; charset=utf-8');

// Corta la ejecución devolviendo un JSON
function responder(array $datos) {
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit();
}

// ---------------------------------------------------------
// 1. SEGURIDAD BÁSICA: solo POST y solo usuarios logueados
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    responder(['ok' => false, 'mensaje' => 'Método no permitido.']);
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    responder(['ok' => false, 'mensaje' => 'Tu sesión ha caducado. Vuelve a iniciar sesión.']);
}

$empleadoId = (int) $_SESSION['user_id'];

// Ya no necesitamos escribir en la sesión: la liberamos para que otras peticiones
// del mismo usuario no esperen a que termine esta (ni el aviso a Teams).
session_write_close();

// Si un admin lo ha excluido mientras tenía la sesión abierta, ya no puede jugar
$stmt = $conn->prepare("SELECT excluido FROM empleados WHERE id = ?");
$stmt->execute([$empleadoId]);
if ((int) $stmt->fetchColumn() === 1) {
    http_response_code(403);
    responder(['ok' => false, 'mensaje' => 'Tu usuario no está habilitado para participar en el calendario.']);
}

// ---------------------------------------------------------
// 2. ABRIR CASILLA
// ---------------------------------------------------------
$dia = filter_var($_POST['dia'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 24]]);
if ($dia === false || $dia === null) {
    http_response_code(400);
    responder(['ok' => false, 'mensaje' => 'Casilla no válida.']);
}

$avisoTeams = null;   // Se rellena si hay que avisar a Teams (se envía tras el COMMIT)

try {
    $conn->beginTransaction();

    // 2.1 Bloqueamos la fila del día: si dos personas hacen clic a la vez,
    //     la segunda espera aquí hasta que la primera termine (sin sorteos dobles).
    $stmt = $conn->prepare("SELECT numero_dia, fecha, es_laborable, premio_id, ganador_id, abierto_por_ganador
                            FROM dias_adviento WHERE numero_dia = ? FOR UPDATE");
    $stmt->execute([$dia]);
    $diaBD = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$diaBD) {
        $conn->rollBack();
        responder(['ok' => false, 'mensaje' => 'Esa casilla no existe en el calendario.']);
    }

    // 2.2 Reglas de fecha. Siempre con la fecha y la hora del SERVIDOR (nunca del navegador).
    // Excepción: el GANADOR de un día anterior que aún no abrió su premio puede abrirlo cuando entre.
    $hoy = date('Y-m-d');
    $premioPendienteDelGanador = $diaBD['fecha'] < $hoy
        && $diaBD['ganador_id'] !== null
        && (int) $diaBD['ganador_id'] === $empleadoId
        && (int) $diaBD['abierto_por_ganador'] === 0;

    if (!$premioPendienteDelGanador) {
        if ((int) $diaBD['es_laborable'] === 0) {
            $conn->rollBack();
            responder(['ok' => false, 'mensaje' => 'Este día el calendario descansa. ¡No hay casilla que abrir!']);
        }
        if ($diaBD['fecha'] !== $hoy) {
            $conn->rollBack();
            responder(['ok' => false, 'mensaje' => 'Solo puedes abrir la casilla del día de hoy.']);
        }
        if ((int) date('H') < HORA_APERTURA) {
            $conn->rollBack();
            responder(['ok' => false, 'mensaje' => 'La sorpresa de hoy se desbloquea a las 12:00h. ¡Ya queda poco!']);
        }
    }

    // 2.3 ¿Ya abrió este empleado esta casilla?
    $stmt = $conn->prepare("SELECT id FROM participaciones WHERE empleado_id = ? AND numero_dia = ?");
    $stmt->execute([$empleadoId, $dia]);
    if ($stmt->fetch()) {
        $conn->rollBack();
        responder(['ok' => false, 'mensaje' => 'Ya abriste esta casilla. ¡Vuelve mañana a por otra sorpresa!']);
    }

    $premioId  = $diaBD['premio_id'] !== null ? (int) $diaBD['premio_id'] : null;
    $ganadorId = $diaBD['ganador_id'] !== null ? (int) $diaBD['ganador_id'] : null;
    $sorteoAhora = false;

    // 2.4 PRIMER CLIC DEL DÍA: hay premio pero aún no hay ganador -> sorteo
    if ($premioId !== null && $ganadorId === null) {

        // Solo si quedan unidades del premio (FOR UPDATE también aquí: el mismo premio sale varios días)
        $stmt = $conn->prepare("SELECT unidades_disponibles FROM premios WHERE id = ? FOR UPDATE");
        $stmt->execute([$premioId]);
        $quedan = (int) $stmt->fetchColumn();

        if ($quedan > 0) {
            // Regla estricta: cada persona registrada (empleado o admin) gana COMO MÁXIMO
            // un premio en todo el calendario. Solo entran los que aún no han ganado nada
            // y que no han sido excluidos por un administrador.
            $stmt = $conn->query("SELECT id FROM empleados
                                  WHERE participa = 1 AND excluido = 0
                                    AND id NOT IN (SELECT ganador_id FROM dias_adviento WHERE ganador_id IS NOT NULL)
                                  ORDER BY RAND() LIMIT 1");
            $elegido = $stmt->fetchColumn();

            // Si ya no queda nadie sin premio, el día se queda SIN ganador (no se repite persona)
            if ($elegido !== false) {
                $ganadorId = (int) $elegido;
                $sorteoAhora = true;

                $stmt = $conn->prepare("UPDATE dias_adviento SET ganador_id = ? WHERE numero_dia = ?");
                $stmt->execute([$ganadorId, $dia]);

                $stmt = $conn->prepare("UPDATE premios SET unidades_disponibles = unidades_disponibles - 1
                                        WHERE id = ? AND unidades_disponibles > 0");
                $stmt->execute([$premioId]);
            }
        }
    }

    // 2.5 ¿El que ha hecho clic es el ganador?
    $esGanador = ($ganadorId !== null && $ganadorId === $empleadoId);

    if ($esGanador) {
        $stmt = $conn->prepare("UPDATE dias_adviento SET abierto_por_ganador = 1 WHERE numero_dia = ?");
        $stmt->execute([$dia]);

        $stmt = $conn->prepare("INSERT INTO participaciones (empleado_id, numero_dia, premio_id) VALUES (?, ?, ?)");
        $stmt->execute([$empleadoId, $dia, $premioId]);
    } else {
        $stmt = $conn->prepare("INSERT INTO participaciones (empleado_id, numero_dia, premio_id) VALUES (?, ?, NULL)");
        $stmt->execute([$empleadoId, $dia]);
    }

    // 2.6 Datos del premio (para el modal y para Teams)
    $premio = null;
    if ($premioId !== null) {
        $stmt = $conn->prepare("SELECT nombre, descripcion, imagen FROM premios WHERE id = ?");
        $stmt->execute([$premioId]);
        $premio = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // 2.7 Preparamos el aviso de Teams (se envía después del COMMIT). Solo UNO por clic:
    //  - Aviso 1 'sorteo': el ganador se acaba de elegir en ESTE clic. Si le ha tocado al
    //    mismo que hace clic, la tarjeta ya dice "✅ Abierto al instante" y NO se manda el 2.
    //  - Aviso 2 'abierto': el ganador ya estaba elegido de antes (abierto_por_ganador era 0
    //    al leer la fila) y ahora entra él y abre su casilla.
    if ($premio && $ganadorId !== null) {
        if ($sorteoAhora) {
            $avisoTeams = 'sorteo';
        } elseif ($esGanador && (int) $diaBD['abierto_por_ganador'] === 0) {
            $avisoTeams = 'abierto';
        }
    }

    $conn->commit();

} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    responder(['ok' => false, 'mensaje' => 'Error al abrir la casilla. Inténtalo de nuevo en unos segundos.']);
}

// ---------------------------------------------------------
// 3. RESPUESTA PARA EL JS
// ---------------------------------------------------------
if ($esGanador) {
    $respuesta = [
        'ok'          => true,
        'ganador'     => true,
        'dia'         => $dia,
        'nombre'      => $premio['nombre'],
        'descripcion' => $premio['descripcion'] ?? '',
        'imagen'      => $premio['imagen'],      // Puede ser null (día 24)
    ];
} else {
    $respuesta = [
        'ok'      => true,
        'ganador' => false,
        'dia'     => $dia,
        'mensaje' => match (true) {
            $premio && $ganadorId !== null
                => '¡Ho, ho, ho! El premio de hoy ya tiene dueño, pero la magia de la Navidad sigue en marcha. ¡Prueba suerte en la siguiente casilla!',
            (bool) $premio      // Hay premio pero ya no queda nadie sin ganar
                => 'Hoy el premio se queda en el saco de Papá Noel: todos los participantes ya tienen el suyo. ¡Gracias por pasarte!',
            default
                => 'Hoy esta casilla no guarda premio, pero gracias por pasarte. ¡Nos vemos en la siguiente!',
        },
    ];
}

// Estado del día DESPUÉS del clic y el HTML del interior, generado con la misma
// función que usa calendario.php al recargar: así la casilla se ve idéntica.
$filaDia = consultarSorteos($conn, $dia)[$dia];
$respuesta['info'] = infoSorteo($filaDia, $empleadoId);
$respuesta['interior_html'] = htmlInteriorCasilla($respuesta['info']);

// Si este clic no genera aviso a Teams, terminamos aquí
if ($avisoTeams === null) {
    responder($respuesta);
}

// ---------------------------------------------------------
// 4. ENVIAMOS YA LA RESPUESTA AL NAVEGADOR...
//    Así la puerta se abre al instante y el aviso a Teams (que puede tardar
//    hasta 4 s) se manda DESPUÉS, sin que el empleado lo note.
// ---------------------------------------------------------
ignore_user_abort(true);                         // Aunque el navegador cierre la conexión, PHP sigue
$json = json_encode($respuesta, JSON_UNESCAPED_UNICODE);
header('Content-Length: ' . strlen($json));      // El navegador sabe que la respuesta ya está completa
header('Connection: close');
echo $json;

if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();                    // PHP-FPM / FastCGI
} else {
    while (ob_get_level() > 0) {                 // Apache con mod_php (WAMP)
        ob_end_flush();
    }
    flush();
}

// ---------------------------------------------------------
// 5. ...Y LUEGO LA NOTIFICACIÓN A MICROSOFT TEAMS
//    Si Teams falla o tarda, el empleado ya tiene su respuesta.
// ---------------------------------------------------------
$stmt = $conn->prepare("SELECT nombre, apellidos, email FROM empleados WHERE id = ?");
$stmt->execute([$ganadorId]);
$ganador = $stmt->fetch(PDO::FETCH_ASSOC);

if ($ganador) {
    $nombreGanador = trim($ganador['nombre'] . ' ' . ($ganador['apellidos'] ?? ''));
    $textoDia = textoDia($dia);

    if ($avisoTeams === 'sorteo') {
        $titulo = "🎁 Calendario de Adviento — Ganador del $textoDia";
        $estado = $esGanador ? '✅ Abierto al instante' : '⏳ Pendiente de abrir la casilla';
    } else {
        $titulo = "🎉 Calendario de Adviento — Premio del $textoDia entregado";
        $estado = '✅ El ganador ya ha abierto su casilla y ha visto su premio';
    }

    $resultado = enviarAvisoTeams($titulo, [
        'Día'     => $textoDia,
        'Ganador' => $nombreGanador,
        'Correo'  => $ganador['email'],
        'Premio'  => $premio['nombre'],
        'Hora'    => date('H:i') . 'h',   // Hora de Madrid del clic
        'Estado'  => $estado,
    ]);

    // El empleado no ve nada técnico: si falla, queda anotado en el log de errores de PHP
    if (!$resultado['enviado']) {
        error_log('Aviso Teams no enviado (día ' . $dia . '): ' . json_encode($resultado, JSON_UNESCAPED_UNICODE));
    }
}
exit();
