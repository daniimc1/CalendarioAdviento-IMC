<?php
// PLANTILLA: copia este archivo como bd/conexion.php y pon los datos reales del servidor.
// bd/conexion.php está en .gitignore: la contraseña nunca se sube al repositorio.

// Hora de España para TODA la aplicación (todas las páginas y procesos cargan este archivo)
date_default_timezone_set('Europe/Madrid');

// Usuario propio del calendario (no root): se crea con bd/usuario_bd.sql
$servername = "localhost";
$dbusername = "USUARIO_MYSQL";
$dbpassword = "CONTRASEÑA_MYSQL";
$dbname = "bd_calendarioAdv";

try {
    $conn = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8mb4",$dbusername,$dbpassword);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // MySQL con la misma hora que PHP (CURRENT_TIMESTAMP en hora de Madrid)
    $conn->exec("SET time_zone = '" . date('P') . "'");
} catch (PDOException $e){
    // El detalle técnico va al log de errores del servidor, nunca a la pantalla
    error_log('Error de conexión a la BBDD: ' . $e->getMessage());
    http_response_code(500);
    die("El calendario no está disponible en este momento. Inténtalo de nuevo en unos minutos.");
}

?>
