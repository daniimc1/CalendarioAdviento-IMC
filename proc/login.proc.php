<?php
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST'){
    header('Location: ../vistas/login.php');
    exit();
}

require_once __DIR__ . '/../bd/conexion.php';
require_once __DIR__ . '/../includes/funciones.php';

// Recuperar el dato del correo del formulario y sanearlo 
$correo = isset($_POST['correo']) ? sanearDato($_POST['correo']) : '';
$pinAdmin = isset($_POST['pin_admin']) ? trim($_POST['pin_admin']) : '';

// Validamos si el campo del correo está vacío
if(ValidaCampoVacio($correo)){
    $_SESSION['errores'] = "El campo de correo no puede estar vacío";
    header('Location: ../vistas/login.php');
    exit();
}

// Validamos si el formato del correo es válido y pertenece a la empresa
if(!validarCorreoEmpresa($correo)){
    $_SESSION['errores'] = "El correo no es válido. Debe ser un correo corporativo de IMC Toys.";
    header('Location: ../vistas/login.php');
    exit();
}

try {
    // 1. Añadimos 'pin' a la consulta
    $stmt = $conn->prepare("SELECT id, nombre, apellidos, email, rol, participa, excluido, pin
                            FROM empleados WHERE email = :email");
    $stmt->bindParam(':email', $correo, PDO::PARAM_STR);
    $stmt->execute();

    $empleado = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if(!$empleado){
        $_SESSION['errores'] = "El correo no figura en la lista de empleados";
        $_SESSION['correo_recuperado'] = $correo;
        header('Location: ../vistas/login.php');
        exit();
    }

    // Excluido por un administrador (baja, fuera de sorteo...): no puede entrar
    if((int)$empleado['excluido'] === 1){
        $_SESSION['errores'] = "Tu usuario no está habilitado para participar en el calendario de adviento. Si crees que es un error, habla con Recursos Humanos.";
        header('Location: ../vistas/login.php');
        exit();
    }

    // Comprobamos si el usuario tiene permiso para participar en el calendario
    if((int)$empleado['participa'] !== 1){
        $_SESSION['errores'] = "Tu usuario no está autorizado para participar en el calendario de adviento.";
        header('Location: ../vistas/login.php');
        exit();
    }

    // 2. Control de seguridad exclusivo para Administradores
    //    Primer envío sin PIN: se vuelve al login pidiendo el PIN (sin error).
    //    Así ningún endpoint público responde "este correo es admin" sin pasar por el login.
    if ($empleado['rol'] === 'admin') {
        if ($pinAdmin === '') {
            $_SESSION['pedir_pin'] = true;
            $_SESSION['correo_recuperado'] = $correo;
            header('Location: ../vistas/login.php');
            exit();
        }
        if (!password_verify($pinAdmin, $empleado['pin'] ?? '')) {
            $_SESSION['errores'] = "PIN de administrador incorrecto o no facilitado.";
            $_SESSION['correo_recuperado'] = $correo;
            header('Location: ../vistas/login.php');
            exit();
        }
    }

    // Cookie "Recordar mi correo"
    if (isset($_POST['recordar'])) {
        setcookie('correo_recordado', $correo, time() + (86400 * 30), '/');
    } else {
        setcookie('correo_recordado', '', time() - 3600, '/');
    }

    // Nuevo id de sesión al entrar: evita que alguien reutilice uno preparado de antemano (session fixation)
    session_regenerate_id(true);

    // Crear variables de sesión
    $_SESSION['user_id'] = $empleado['id'];
    $_SESSION['nombre'] = $empleado['nombre'];
    $_SESSION['apellidos'] = $empleado['apellidos'];
    $_SESSION['email'] = $empleado['email'];
    $_SESSION['rol'] = $empleado['rol'];
    
    // Redirección según rol o directo al calendario
    header('Location: ../vistas/calendario.php');
    exit();

} catch (PDOException $e){
    $_SESSION['errores'] = "Error interno del servidor. Por favor, inténtelo más tarde.";
    header('Location: ../vistas/login.php');
    exit();
}