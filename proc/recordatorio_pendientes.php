<?php
/* =============================================================
   RECORDATORIO DE LAS 16:00h (premio sorteado y aún sin abrir)
   Pensado para lanzarlo con el Programador de tareas de Windows:
       C:\wamp64\bin\php\php8.4.15\php.exe C:\wamp64\www\calendario-adviento\proc\recordatorio_pendientes.php

   - Busca el sorteo de HOY (fecha real del servidor) con ganador elegido
     y abierto_por_ganador = 0.
   - Si lo hay, manda una Adaptive Card a Teams. Si no, no envía nada.
   - Desde el navegador solo lo puede lanzar un administrador con sesión.
   ============================================================= */

require_once __DIR__ . '/../includes/config.php';   // Zona horaria Europe/Madrid
require_once __DIR__ . '/../bd/conexion.php';
require_once __DIR__ . '/../includes/teams.php';

$desdeConsola = (PHP_SAPI === 'cli');

// Desde el NAVEGADOR solo puede lanzarlo un admin con sesión iniciada
// (si no, cualquiera que conozca la URL podría llenar Teams de avisos).
if (!$desdeConsola) {
    session_start();
    header('Content-Type: application/json; charset=utf-8');
    if (($_SESSION['rol'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'mensaje' => 'Solo un administrador puede lanzar el recordatorio.'], JSON_UNESCAPED_UNICODE);
        exit();
    }
}

$hoy = date('Y-m-d');

// ---------------------------------------------------------
// 1. Premio de HOY sorteado y sin abrir
// ---------------------------------------------------------
$stmt = $conn->prepare("SELECT d.numero_dia, e.nombre, e.apellidos, e.email, p.nombre AS premio
                        FROM dias_adviento d
                        INNER JOIN empleados e ON e.id = d.ganador_id
                        INNER JOIN premios   p ON p.id = d.premio_id
                        WHERE d.ganador_id IS NOT NULL
                          AND d.abierto_por_ganador = 0
                          AND d.fecha = ?
                        ORDER BY d.numero_dia");
$stmt->execute([$hoy]);
$pendientes = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ---------------------------------------------------------
// 2. Una tarjeta por cada premio pendiente (normalmente 0 o 1)
// ---------------------------------------------------------
$enviados = [];
foreach ($pendientes as $fila) {
    $textoDia = textoDia((int) $fila['numero_dia']);
    $resultado = enviarAvisoTeams('⏰ Recordatorio 16:00h — Premio pendiente de abrir', [
        'Día'     => $textoDia,
        'Ganador' => trim($fila['nombre'] . ' ' . ($fila['apellidos'] ?? '')),
        'Correo'  => $fila['email'],
        'Premio'  => $fila['premio'],
        'Hora'    => date('H:i') . 'h',
        'Estado'  => '⚠️ Aún no ha abierto su casilla',
    ]);
    $enviados[] = ['dia' => $textoDia, 'ganador' => $fila['email']] + $resultado;
}

// ---------------------------------------------------------
// 3. Resumen (en consola queda en el historial de la tarea programada)
// ---------------------------------------------------------
$resumen = [
    'ok'         => true,
    'fecha'      => $hoy . ' ' . date('H:i'),
    'pendientes' => count($pendientes),
    'mensaje'    => count($pendientes) === 0 ? 'No hay premios pendientes de abrir: no se envía nada.' : 'Recordatorio procesado.',
    'avisos'     => $enviados,
];

echo json_encode($resumen, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
