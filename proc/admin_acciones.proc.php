<?php
/* =============================================================
   ACCIONES DEL PANEL DE ADMINISTRACIÓN (endpoint JSON para fetch)
   - accion = 'toggle_excluido'  -> excluido 0 <-> 1 (excluir sin borrar).
                                    "participa" NO se toca: solo indica si se ha registrado.
   - accion = 'toggle_rol'       -> empleado <-> admin (nunca sobre uno mismo)
   - accion = 'crear_empleado'   -> alta con participa = 1
   Siempre responde JSON: { ok: true|false, mensaje, ... }
   ============================================================= */
session_start();
require_once __DIR__ . '/../bd/conexion.php';
require_once __DIR__ . '/../includes/funciones.php';

header('Content-Type: application/json; charset=utf-8');

function responder(array $datos, int $codigo = 200) {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit();
}

// ---------------------------------------------------------
// 1. SEGURIDAD: solo POST, solo administradores y token CSRF
// ---------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(['ok' => false, 'mensaje' => 'Método no permitido.'], 405);
}

if (($_SESSION['rol'] ?? '') !== 'admin') {
    responder(['ok' => false, 'mensaje' => 'Solo un administrador puede hacer esto.'], 403);
}

// El token lo genera vista_admin.php: así otra web no puede lanzar estas
// acciones aprovechando que el admin tiene la sesión abierta (CSRF).
if (empty($_SESSION['csrf_admin']) || !hash_equals($_SESSION['csrf_admin'], $_POST['csrf'] ?? '')) {
    responder(['ok' => false, 'mensaje' => 'La página ha caducado. Recárgala e inténtalo de nuevo.'], 403);
}

$accion  = $_POST['accion'] ?? '';
$adminId = (int) $_SESSION['user_id'];

try {
    // ---------------------------------------------------------
    // 2. EXCLUIR / VOLVER A INCLUIR (columna excluido)
    //    Excluido: no entra, no sortea y no puede volver a registrarse.
    // ---------------------------------------------------------
    if ($accion === 'toggle_excluido') {
        $id = (int) ($_POST['id'] ?? 0);

        $stmt = $conn->prepare("UPDATE empleados SET excluido = 1 - excluido WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            responder(['ok' => false, 'mensaje' => 'Ese empleado no existe.'], 404);
        }

        $stmt = $conn->prepare("SELECT participa, excluido FROM empleados WHERE id = ?");
        $stmt->execute([$id]);
        $fila = $stmt->fetch(PDO::FETCH_ASSOC);
        $excluido  = (int) $fila['excluido'];
        $participa = (int) $fila['participa'];

        if ($excluido) {
            $mensaje = 'Excluido: no podrá entrar, ni entrar en el sorteo, ni volver a registrarse. Sus datos se conservan.';
        } else {
            $mensaje = $participa
                ? 'Vuelve a participar en el sorteo.'
                : 'Ya no está excluido. Participará cuando se registre.';
        }

        responder(['ok' => true, 'excluido' => $excluido, 'participa' => $participa, 'mensaje' => $mensaje]);
    }

    // ---------------------------------------------------------
    // 3. ALTERNAR ROL (empleado / admin)
    // ---------------------------------------------------------
    if ($accion === 'toggle_rol') {
        $id = (int) ($_POST['id'] ?? 0);

        // Nadie puede quitarse el rol a sí mismo (así nunca se queda el panel sin admin)
        if ($id === $adminId) {
            responder(['ok' => false, 'mensaje' => 'No puedes cambiar tu propio rol.'], 400);
        }

        $stmt = $conn->prepare("UPDATE empleados SET rol = IF(rol = 'admin', 'empleado', 'admin') WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            responder(['ok' => false, 'mensaje' => 'Ese empleado no existe.'], 404);
        }

        $stmt = $conn->prepare("SELECT rol FROM empleados WHERE id = ?");
        $stmt->execute([$id]);
        $rol = $stmt->fetchColumn();

        responder([
            'ok'      => true,
            'rol'     => $rol,
            'mensaje' => $rol === 'admin'
                ? 'Ahora es administrador. Para entrar necesitará un PIN de administrador.'
                : 'Ahora es empleado.',
        ]);
    }

    // ---------------------------------------------------------
    // 4. NUEVO EMPLEADO
    // ---------------------------------------------------------
    if ($accion === 'crear_empleado') {
        $nombre       = mb_strtoupper(sanearDato($_POST['nombre'] ?? ''));
        $apellidos    = mb_strtoupper(sanearDato($_POST['apellidos'] ?? ''));
        $email        = strtolower(sanearDato($_POST['email'] ?? ''));
        $departamento = sanearDato($_POST['departamento'] ?? '') ?: 'General';

        if ($nombre === '' || $email === '') {
            responder(['ok' => false, 'mensaje' => 'El nombre y el correo son obligatorios.'], 400);
        }
        if (mb_strlen($nombre) > 100 || mb_strlen($apellidos) > 100 || mb_strlen($departamento) > 100) {
            responder(['ok' => false, 'mensaje' => 'Algún campo es demasiado largo (máximo 100 caracteres).'], 400);
        }
        if (!validarCorreoEmpresa($email)) {
            responder(['ok' => false, 'mensaje' => 'El correo debe ser corporativo (@imctoys.com o @imc.es).'], 400);
        }

        $stmt = $conn->prepare("SELECT COUNT(*) FROM empleados WHERE email = ?");
        $stmt->execute([$email]);
        if ((int) $stmt->fetchColumn() > 0) {
            responder(['ok' => false, 'mensaje' => 'Ya existe un empleado con ese correo.'], 409);
        }

        $stmt = $conn->prepare("INSERT INTO empleados (nombre, apellidos, email, ubicacion, departamento, rol, participa)
                                VALUES (?, ?, ?, 'IMC', ?, 'empleado', 1)");
        $stmt->execute([$nombre, $apellidos !== '' ? $apellidos : null, $email, $departamento]);

        responder(['ok' => true, 'mensaje' => "Empleado dado de alta: $nombre $apellidos ($email)."]);
    }

    responder(['ok' => false, 'mensaje' => 'Acción desconocida.'], 400);

} catch (PDOException $e) {
    // 23000 = clave duplicada (por si dos admins dan de alta el mismo correo a la vez)
    if ($e->getCode() === '23000') {
        responder(['ok' => false, 'mensaje' => 'Ya existe un empleado con ese correo.'], 409);
    }
    responder(['ok' => false, 'mensaje' => 'Error de base de datos. Inténtalo de nuevo.'], 500);
}
