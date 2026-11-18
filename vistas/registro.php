<?php
session_start();

// Si el usuario ya está autenticado, lo enviamos directamente al calendario
if (isset($_SESSION['user_id'])) {
    header('Location: calendario.php');
    exit();
}

// Recuperamos el mensaje de error si viene rebotado del proc
$error = $_SESSION['errores'] ?? '';
unset($_SESSION['errores']);

// Recuperamos el correo tecleado para no obligarle a escribirlo de nuevo
$correoGuardado = $_SESSION['correo_recuperado'] ?? '';
unset($_SESSION['correo_recuperado']);
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registro - Calendario IMC Toys</title>
    <!-- Favicon: logo IMC recortado y cuadrado (el PNG original tiene mucho margen y se veía diminuto) -->
    <link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="../img/favicon-192.png">
    <link rel="apple-touch-icon" href="../img/favicon-192.png">
    <!-- Fuente: <link> en el head descarga en paralelo (más rápido que @import en el CSS) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="../css/styles.css">
</head>
<body class="layout-login">

    <!-- CAPAS (de atrás hacia delante, ver z-index en styles.css)
         1 Bokeh -> 2 Suelo de nieve -> 3 Muñeco -> 4 Nieve cayendo
         -> 10 Formulario -> 11 Buzón (el sobre vuela por encima del formulario)
         -> 25 Guirnalda -->
    <canvas id="canvas-bokeh"       class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-suelo-nieve" class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-muneco"      class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-nieve"       class="capa-canvas" aria-hidden="true"></canvas>
    <canvas id="canvas-buzon"       class="capa-canvas" aria-hidden="true"></canvas>

    <!-- Guirnalda: mismas bombillas CSS que el login + rama de pino en canvas detrás -->
    <div class="techo-guirnalda-completa guirnalda-pino" aria-hidden="true">
        <canvas id="canvas-guirnalda"></canvas>
        <ul class="linea-luces">
            <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
            <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
            <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
            <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
            <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
            <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
            <li class="red"></li><li class="yellow"></li><li class="blue"></li><li class="pink"></li><li class="green"></li>
        </ul>
    </div>

    <!-- Logo IMC Toys arriba a la derecha (igual que en el login) -->
    <div class="logo-superior-derecha">
        <img src="../img/logo-imc-sinfondo.png" alt="IMC Toys" class="logo-imc">
    </div>

    <!-- Formulario: por encima de las capas de fondo -->
    <main class="contenedor-registro">
        <!-- Figuras apoyadas sobre el borde superior de la caja (mismas clases que el login) -->
        <div class="figuras-login">
            <img src="../img/capi-navidena.png" alt="Capi Navideña" class="figura figura-reg-1">
            <img src="../img/holo-navideno.png" alt="Holo Navideño" class="figura figura-reg-2">
            <img src="../img/lumi-navidena.png" alt="Lumi Navideña" class="figura figura-reg-3">
        </div>

        <form action="../proc/registro.proc.php" method="POST" class="caja-login">
            <h1 class="titulo-login">Inscripción al Calendario</h1>
            <p class="subtitulo-login">Introduce tu correo corporativo de IMC Toys</p>

            <?php if (!empty($error)): ?>
                <div role="alert" class="alerta-error">
                    <?php echo htmlspecialchars($error); ?>
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
                <!-- Aviso de validaciones.js (oculto mientras está vacío) -->
                <span id="mensaje-error-correo" class="texto-error" aria-live="polite"></span>
            </div>

            <button type="submit" class="btn-primario" disabled>Inscribirme</button>

            <div class="enlaces-login">
                ¿Ya estás inscrito? <a href="login.php" class="enlace-destacado">Inicia sesión</a>
            </div>
        </form>
    </main>

    <!-- SCRIPTS: primero las capas visuales, al final validaciones.js.
         muneco3d.js y buzon.js deben cargarse ANTES que validaciones.js:
         el muñeco escucha su evento y el buzón expone animarEnvioBuzon(). -->
    <script src="../js/motor-animacion.js"></script>   <!-- Bucle único de animación: antes que los canvas -->
    <script src="../js/bokeh.js"></script>
    <script src="../js/suelo-nieve.js"></script>
    <script src="../js/guirnalda.js"></script>
    <script src="../js/muneco3d.js"></script>
    <script src="../js/nieve.js"></script>
    <script src="../js/buzon.js"></script>
    <script src="../js/validaciones.js"></script>
</body>
</html>
