<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../bd/conexion.php';

// Leer el JSON que envía el fetch de JS
$input = json_decode(file_get_contents('php://input'), true);
$correo = isset($input['correo']) ? trim($input['correo']) : '';

if (empty($correo)) {
    echo json_encode(['es_admin' => false]);
    exit();
}

try {
    $stmt = $conn->prepare("SELECT rol FROM empleados WHERE email = :email");
    $stmt->bindParam(':email', $correo, PDO::PARAM_STR);
    $stmt->execute();
    $empleado = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($empleado && $empleado['rol'] === 'admin') {
        echo json_encode(['es_admin' => true]);
    } else {
        echo json_encode(['es_admin' => false]);
    }
} catch (PDOException $e) {
    echo json_encode(['es_admin' => false]);
}
exit();