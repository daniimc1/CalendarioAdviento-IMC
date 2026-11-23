<?php
/* =============================================================
   AVISOS A MICROSOFT TEAMS (Power Automate)
   Lo usan proc/abrir_dia.proc.php y proc/recordatorio_pendientes.php,
   así la URL, el interruptor y el formato de la tarjeta están en un solo sitio.
   ============================================================= */

// TEAMS_WEBHOOK_URL (privado, fuera de git). Si falta el archivo en el servidor, el calendario
// sigue funcionando: solo dejan de salir los avisos y queda anotado en el log de errores de PHP.
if (file_exists(__DIR__ . '/teams_config.php')) {
    require_once __DIR__ . '/teams_config.php';
}
define('ACTIVAR_WEBHOOK_TEAMS', true);    // PRODUCCIÓN: avisos activos (false solo para pruebas locales)

// Verificación del certificado HTTPS de Power Automate:
//  - Por defecto, ACTIVADA.
//  - Solo se desactiva en Windows sin lista de certificados configurada (WAMP trae
//    curl.cainfo vacío en php.ini y la conexión HTTPS fallaría).
//  - Se puede forzar con define('TEAMS_SSL_VERIFICAR', true|false) en teams_config.php.
function verificarSslTeams(): bool {
    if (defined('TEAMS_SSL_VERIFICAR')) {
        return (bool) TEAMS_SSL_VERIFICAR;
    }
    $hayListaCertificados = ini_get('curl.cainfo') !== '' || ini_get('openssl.cafile') !== '';
    return PHP_OS_FAMILY !== 'Windows' || $hayListaCertificados;
}

// "10 de diciembre" (el día 0 es el 30 de noviembre)
function textoDia(int $dia): string {
    return $dia === 0 ? '30 de noviembre' : "$dia de diciembre";
}

// Envía una Adaptive Card v1.4 al flujo de Power Automate.
// Timeout corto (3 s para conectar, 4 s en total) y try/catch: si Teams falla, el empleado ni se entera.
// Devuelve el código HTTP y el error de cURL para el log (Power Automate responde 202 si lo acepta).
function enviarAvisoTeams(string $titulo, array $datos): array {
    if (!ACTIVAR_WEBHOOK_TEAMS) {
        return ['enviado' => false, 'motivo' => 'ACTIVAR_WEBHOOK_TEAMS = false'];
    }
    if (!defined('TEAMS_WEBHOOK_URL') || TEAMS_WEBHOOK_URL === '' || TEAMS_WEBHOOK_URL === 'URL_DEL_FLUJO_DE_POWER_AUTOMATE') {
        return ['enviado' => false, 'motivo' => 'Falta includes/teams_config.php o no tiene la URL real del flujo'];
    }
    if (!function_exists('curl_init')) {
        return ['enviado' => false, 'motivo' => 'La extensión cURL de PHP no está activada'];
    }

    // Lista "Clave: valor" de la tarjeta
    $hechos = [];
    foreach ($datos as $clave => $valor) {
        $hechos[] = ['title' => $clave, 'value' => (string) $valor];
    }

    $tarjeta = [
        'type' => 'message',
        'attachments' => [[
            'contentType' => 'application/vnd.microsoft.card.adaptive',
            'content' => [
                '$schema' => 'http://adaptivecards.io/schemas/adaptive-card.json',
                'type'    => 'AdaptiveCard',
                'version' => '1.4',
                'body'    => [
                    ['type' => 'TextBlock', 'text' => $titulo, 'weight' => 'Bolder', 'size' => 'Medium', 'color' => 'Attention', 'wrap' => true],
                    ['type' => 'FactSet', 'facts' => $hechos],
                ],
            ],
        ]],
    ];

    try {
        $ch = curl_init(TEAMS_WEBHOOK_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json; charset=utf-8'],
            CURLOPT_POSTFIELDS     => json_encode($tarjeta, JSON_UNESCAPED_UNICODE),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,    // Máx. 3 s para conectar
            CURLOPT_TIMEOUT        => 4,    // Máx. 4 s en total
            // Verificación SSL activada salvo en WAMP sin certificados (ver verificarSslTeams)
            CURLOPT_SSL_VERIFYPEER => verificarSslTeams(),
            CURLOPT_SSL_VERIFYHOST => verificarSslTeams() ? 2 : 0,
        ]);
        $cuerpo    = curl_exec($ch);
        $codigo    = curl_getinfo($ch, CURLINFO_HTTP_CODE);   // 202 = Power Automate lo ha aceptado
        $errorCurl = curl_error($ch);                          // '' si no hubo error de conexión

        return [
            'enviado'    => $cuerpo !== false && $codigo >= 200 && $codigo < 300,
            'http_code'  => $codigo,
            'curl_error' => $errorCurl,
            'respuesta'  => is_string($cuerpo) ? mb_substr($cuerpo, 0, 300) : '',
        ];
    } catch (Throwable $e) {
        // El aviso a Teams es secundario: nunca rompe la respuesta al usuario
        return ['enviado' => false, 'motivo' => $e->getMessage()];
    }
}
