<?php
/* =============================================================
   GENERA EL CORREO DE NAVIDAD COMO ARCHIVO .eml (listo para enviar)
   Herramienta interna: NO va a producción.

   Por qué: al copiar y pegar en Outlook se pierden colores y tamaños
   de letra, y el GIF incrustado bloquea el envío. Un .eml lleva el HTML
   tal cual y las imágenes como adjuntos internos (cid:), como un correo
   de verdad: Outlook lo muestra exactamente igual que la plantilla.

   Uso (desde la carpeta del proyecto):
       C:\wamp64\bin\php\php8.4.15\php.exe correo\generar_eml.php
   Crea correo\correo_navidad.eml -> doble clic para abrirlo en Outlook.
   - Outlook clásico: se abre como BORRADOR listo para enviar (X-Unsent).
   - Nuevo Outlook: se abre como mensaje; usa "Reenviar" para enviarlo.
   ============================================================= */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Solo desde consola.');
}

// ---------------------------------------------------------
// DATOS DEL ENVÍO: si se dejan vacíos, se quedan los [marcadores]
// ---------------------------------------------------------
$para    = '';                                         // Destinatario, ej. 'cliente@empresa.com'
$asunto  = 'Felices fiestas de parte de IMC Toys';
$datos = [
    '[nombre del cliente]'   => '',                    // Cliente destinatario
    '[Nombre y apellidos]'   => '',                    // Firma
    '[Cargo]'                => '',
    '[correo@imc.es]'        => '',
];

// ---------------------------------------------------------
// 1. HTML de la plantilla con los datos rellenados
// ---------------------------------------------------------
$carpeta = __DIR__;
$html = file_get_contents($carpeta . '/plantilla_correo_clientes.html');
foreach ($datos as $marcador => $valor) {
    if ($valor !== '') {
        $html = str_replace($marcador, htmlspecialchars($valor, ENT_QUOTES, 'UTF-8'), $html);
    }
}

// Las imágenes pasan a ser adjuntos internos: src="cid:..."
// (El fondo degradado ya no es una imagen: son franjas de color en la propia plantilla,
//  porque el Nuevo Outlook no muestra imágenes de fondo incrustadas.)
$imagenes = [
    'banner-navidad.gif' => ['cid' => 'banner_imc', 'tipo' => 'image/gif'],
    'logo-imc.png'       => ['cid' => 'logo_imc',   'tipo' => 'image/png'],
];
foreach ($imagenes as $archivo => &$img) {
    $img['datos'] = file_get_contents($carpeta . '/' . $archivo);
    $html = str_replace('src="' . $archivo . '"', 'src="cid:' . $img['cid'] . '"', $html);
}
unset($img);   // Rompe la referencia del foreach

// ---------------------------------------------------------
// 2. Montaje del mensaje MIME (multipart/related = HTML + imágenes internas)
// ---------------------------------------------------------
$fin = "\r\n";
$limite = 'imc_' . bin2hex(random_bytes(8));

$cabeceras = [];
if ($para !== '') {
    $cabeceras[] = 'To: ' . $para;
}
$cabeceras[] = 'Subject: =?UTF-8?B?' . base64_encode($asunto) . '?=';
$cabeceras[] = 'X-Unsent: 1';                      // Outlook clásico lo abre como borrador para enviar
$cabeceras[] = 'MIME-Version: 1.0';
$cabeceras[] = 'Content-Type: multipart/related; type="text/html"; boundary="' . $limite . '"';

$mensaje = implode($fin, $cabeceras) . $fin . $fin;

// Cuerpo HTML
$mensaje .= '--' . $limite . $fin
    . 'Content-Type: text/html; charset=UTF-8' . $fin
    . 'Content-Transfer-Encoding: base64' . $fin . $fin
    . chunk_split(base64_encode($html), 76, $fin);

// Imágenes
foreach ($imagenes as $archivo => $img) {
    $mensaje .= '--' . $limite . $fin
        . 'Content-Type: ' . $img['tipo'] . '; name="' . $archivo . '"' . $fin
        . 'Content-Transfer-Encoding: base64' . $fin
        . 'Content-ID: <' . $img['cid'] . '>' . $fin
        . 'Content-Disposition: inline; filename="' . $archivo . '"' . $fin . $fin
        . chunk_split(base64_encode($img['datos']), 76, $fin);
}
$mensaje .= '--' . $limite . '--' . $fin;

$salida = $carpeta . '/correo_navidad.eml';
file_put_contents($salida, $mensaje);

$pendientes = array_keys(array_filter($datos, fn($v) => $v === ''));
echo 'Creado: ' . $salida . ' (' . round(strlen($mensaje) / 1024) . " KB)\n";
if ($pendientes) {
    echo 'Marcadores sin rellenar (se verán tal cual): ' . implode(', ', $pendientes) . "\n";
}
