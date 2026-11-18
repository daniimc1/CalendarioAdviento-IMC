<?php
session_start();

if (!empty($_SESSION['user_id'])) {
    header('Location: calendario.php');
    exit();
}

$errores = "";
if (isset($_SESSION['errores'])) {
    $errores =$_SESSION['errores'];
    unset($_SESSION['errores']);
}

// Mensaje informativo (no es un error), p. ej. tras inscribirse un admin
$mensaje = "";
if (isset($_SESSION['mensaje'])) {
    $mensaje = $_SESSION['mensaje'];
    unset($_SESSION['mensaje']);
}

$correoGuardado = "";
if (isset($_SESSION['correo_recuperado'])) {
    $correoGuardado =$_SESSION['correo_recuperado'];
    unset($_SESSION['correo_recuperado']);
} elseif (isset($_COOKIE['correo_recordado'])) {
    $correoGuardado =$_COOKIE['correo_recordado'];
}

$recordarMarcado = isset($_COOKIE['correo_recordado']);
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso - Calendario de Adviento IMC Toys</title>
    <!-- Favicon: logo IMC recortado y cuadrado (el PNG original tiene mucho margen y se veía diminuto) -->
    <link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="../img/favicon-192.png">
    <link rel="apple-touch-icon" href="../img/favicon-192.png">
    <!-- Fuente: <link> en el head descarga en paralelo (más rápido que @import en el CSS) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="../css/styles.css">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" defer></script>
</head>
<body class="layout-login">

    <!-- 1. Capa de nieve cayendo -->
    <div id="contenedor-nieve"></div>
    
  <div class="techo-guirnalda-completa guirnalda-pino" aria-hidden="true">
    <canvas id="canvas-guirnalda"></canvas>
    <ul class="linea-luces">
        <!-- Puedes poner una tanda completa; el CSS se encargará de distribuirlas sin romper el ancho -->
        <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
        <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
        <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
        <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
        <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
        <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
        <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
    </ul>
</div>

    <!-- 3. Canvas del árbol 3D -->
    <canvas id="canvas-arbol-3d"></canvas>

    <div class="logo-superior-derecha">
        <img src="../img/logo-imc-sinfondo.png" alt="IMC Toys" class="logo-imc">
    </div>

    <!-- 4. Contenedor de acceso (centrado) -->
    <main class="contenedor-login">
        
        <!-- Figuras apoyadas sobre el borde superior de la caja de login -->
        <div class="figuras-login">
            <img src="../img/bbcry_navidena.png" alt="Bebé Llorón Navideña" class="figura figura-1">
            <img src="../img/kpop_navidena.png" alt="KPoP Navideña" class="figura figura-2">
            <img src="../img/unicornio-navidad.png" alt="Unicornio Navideño" class="figura figura-3">
            <img src="../img/dumpling_navideno.png" alt="Dumpling Navideño" class="figura figura-4">
        </div>

        <form action="../proc/login.proc.php" method="POST" class="caja-login">
            <input type="hidden" name="pin_admin" id="pin_admin" value="">
            <h1 class="titulo-login">Calendario de Adviento</h1>
            <p class="subtitulo-login">Accede con tu correo corporativo</p>

            <?php if (!empty($errores)): ?>
                <div role="alert" class="alerta-error">
                    <?php echo htmlspecialchars($errores); ?>
                </div>
            <?php endif; ?>

            <?php if (!empty($mensaje)): ?>
                <div role="status" class="alerta-exito">
                    <?php echo htmlspecialchars($mensaje); ?>
                </div>
            <?php endif; ?>

            <div class="grupo-input">
                <label for="correo">Correo corporativo</label>
                <input
                    type="email"
                    id="correo"
                    name="correo"
                    placeholder="nombre@imctoys.com"
                    value="<?php echo htmlspecialchars($correoGuardado); ?>"
                    required
                    autocomplete="email"
                >
                <span id="mensaje-error-correo" class="texto-error"></span>
            </div>

            <div class="grupo-checkbox">
                <input type="checkbox" id="recordar" name="recordar" value="1"
                    <?php if ($recordarMarcado) echo 'checked'; ?>>
                <label for="recordar">Recordar mi correo</label>
            </div>

            <button type="submit" class="btn-primario">Entrar al calendario</button>

            <div class="enlaces-login">
                ¿Aún no estás inscrito? <a href="registro.php" class="enlace-destacado">Inscríbete aquí</a>
            </div>
        </form>
    </main> 
    

    <script src="../js/script.js"></script>
    <script src="../js/motor-animacion.js"></script>   <!-- Bucle único de animación: antes que los canvas -->
    <script src="../js/arbol3d.js"></script>
    <script src="../js/guirnalda.js"></script>
</body>
</html>