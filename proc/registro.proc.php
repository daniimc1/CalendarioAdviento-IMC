<?php
session_start();

require_once __DIR__ . '/../bd/conexion.php';
require_once __DIR__ . '/../includes/funciones.php';

// Control de acceso al endpoint: solo peticiones POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../vistas/registro.php');
    exit();
}

$correo = $_POST['correo'] ?? '';
$correoSaneado = sanearDato($correo);

if (ValidaCampoVacio($correoSaneado)) {
    $_SESSION['errores'] = "El campo de correo no puede estar vacío.";
    $_SESSION['correo_recuperado'] = $correo;
    header('Location: ../vistas/registro.php');
    exit();
}

if (!validarCorreoEmpresa($correoSaneado)) {
    $_SESSION['errores'] = "El correo debe ser corporativo (@imctoys.com o @imc.es).";
    $_SESSION['correo_recuperado'] = $correo;
    header('Location: ../vistas/registro.php');
    exit();
}

try {
    // Buscamos al empleado para extraer su nombre y apellidos reales
    $stmt = $conn->prepare("SELECT id, nombre, apellidos, email, departamento, rol, participa, excluido FROM empleados WHERE email = ?");
    $stmt->execute([$correoSaneado]);
    $empleado = $stmt->fetch(PDO::FETCH_ASSOC);

    // Si no existe en la plantilla precargada de la empresa
    if (!$empleado) {
        $_SESSION['errores'] = "El correo no figura en la lista de empleados autorizados.";
        $_SESSION['correo_recuperado'] = $correoSaneado;
        header('Location: ../vistas/registro.php');
        exit();
    }

    // Excluido por un administrador: registrarse NO le vuelve a dar acceso
    // (excluido solo lo cambia un admin desde el panel)
    if ((int)$empleado['excluido'] === 1) {
        $_SESSION['errores'] = "Tu usuario no está habilitado para participar en el calendario de adviento. Si crees que es un error, habla con Recursos Humanos.";
        $_SESSION['correo_recuperado'] = $correoSaneado;
        header('Location: ../vistas/registro.php');
        exit();
    }

    // Si ya estaba inscrito no se puede volver a registrar: lo mandamos al login
    if ((int)$empleado['participa'] === 1) {
        $_SESSION['errores'] = "Ya estás inscrito en el calendario. Inicia sesión con tu correo.";
        $_SESSION['correo_recuperado'] = $correoSaneado;
        header('Location: ../vistas/login.php');
        exit();
    }

    // Activamos su participación
    $update = $conn->prepare("UPDATE empleados SET participa = 1 WHERE id = ?");
    $update->execute([$empleado['id']]);

    // Los administradores NUNCA inician sesión desde aquí: deben pasar
    // por el login, que es donde se comprueba su PIN.
    if ($empleado['rol'] === 'admin') {
        $_SESSION['mensaje'] = "Inscripción completada. Inicia sesión e introduce tu PIN de administrador.";
        $_SESSION['correo_recuperado'] = $correoSaneado;
        header('Location: ../vistas/login.php');
        exit();
    }

    // 4. Empleado normal: nuevo id de sesión (evita session fixation) y datos de MySQL
    session_regenerate_id(true);
    $_SESSION['user_id']   = $empleado['id'];
    $_SESSION['nombre']    = $empleado['nombre'];
    $_SESSION['apellidos'] = $empleado['apellidos'];
    $_SESSION['email']     = $empleado['email'];
    $_SESSION['rol']       = $empleado['rol'];

    //Rederigimos directamente al calendario
    header('Location: ../vistas/calendario.php');
    exit();

} catch (PDOException $e) {
    $_SESSION['errores'] = "Error interno del servidor. Inténtelo más tarde.";
    header('Location: ../vistas/registro.php');
    exit();
}