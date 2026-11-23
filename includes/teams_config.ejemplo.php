<?php
// PLANTILLA: copia este archivo como includes/teams_config.php y pon la URL real
// del flujo de Power Automate (desencadenador "Cuando se recibe una solicitud de webhook de Teams").
define('TEAMS_WEBHOOK_URL', 'URL_DEL_FLUJO_DE_POWER_AUTOMATE');

// OPCIONAL: verificación del certificado HTTPS. Si no se define, se activa sola salvo
// en Windows sin curl.cainfo/openssl.cafile en php.ini (ver includes/teams.php).
// define('TEAMS_SSL_VERIFICAR', true);
