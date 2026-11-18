<?php
/* =============================================================
   CONFIGURACIÓN GENERAL DEL CALENDARIO (PRODUCCIÓN)
   Lo cargan vistas/calendario.php, proc/abrir_dia.proc.php y
   proc/recordatorio_pendientes.php.

   - Siempre se usa la fecha y la hora REALES del servidor.
   - Las casillas se desbloquean a las 12:00h (hora de España).
   - Los días bloqueados (findes y festivo) salen de es_laborable en la BBDD.

   (El interruptor de los avisos a Teams es ACTIVAR_WEBHOOK_TEAMS,
    en includes/teams.php.)
   ============================================================= */

// Zona horaria de España (el desbloqueo de las 12:00 tiene que ser exacto)
date_default_timezone_set('Europe/Madrid');

// Hora a partir de la cual se puede abrir la casilla del día
const HORA_APERTURA = 12;
