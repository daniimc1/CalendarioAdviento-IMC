<?php

//Comprueba campos vacíos
function ValidaCampoVacio($campo) {
    return empty($campo);
}

function sanearDato($dato) {
    $datoSinEspacios = trim($dato); // Elimina espacios en blanco
    $datoSeguro = strip_tags($datoSinEspacios); // Evita inyección de código
    return $datoSeguro;
}

function validarCorreoEmpresa(string $correo): bool {
    $correoLimpio = strtolower(trim($correo));

    if (!filter_var($correoLimpio, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    // Solo dominios corporativos
    $dominiosValidos = ['@imctoys.com', '@imc.es'];
    foreach ($dominiosValidos as $dominio) {
        if (str_ends_with($correoLimpio, $dominio)) {
            return true;
        }
    }

    return false;
}

function esAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

// Solo usuarios con sesión iniciada: si no, al login
function comprobarAutenticacion() {
    if (!isset($_SESSION['user_id'])) {
        header('Location: ../vistas/login.php');
        exit();
    }
}

// Solo administradores: si no hay sesión va al login; si es empleado, al calendario
function comprobarAdmin() {
    comprobarAutenticacion();
    if (!esAdmin()) {
        header('Location: ../vistas/calendario.php');
        exit();
    }
}
