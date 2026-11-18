<?php
/* =============================================================
   SORTEO DE CADA DÍA: datos públicos + HTML del interior de la casilla
   Lo usan vistas/calendario.php (al cargar) y proc/abrir_dia.proc.php
   (al abrir en directo, devuelve el MISMO HTML en el JSON). Así la
   casilla se pinta exactamente igual en los dos casos.
   ============================================================= */

// Días con su premio y su ganador. Con $dia = null devuelve los 25 días.
function consultarSorteos(PDO $conn, ?int $dia = null): array {
    $sql = "SELECT d.numero_dia, d.fecha, d.es_laborable, d.premio_id, d.ganador_id, d.abierto_por_ganador,
                   p.nombre AS premio, p.descripcion, p.imagen,
                   e.nombre AS ganador_nombre, e.apellidos AS ganador_apellidos
            FROM dias_adviento d
            LEFT JOIN premios   p ON p.id = d.premio_id
            LEFT JOIN empleados e ON e.id = d.ganador_id";

    if ($dia === null) {
        $filas = $conn->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $stmt = $conn->prepare($sql . " WHERE d.numero_dia = ?");
        $stmt->execute([$dia]);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    $porDia = [];
    foreach ($filas as $fila) {
        $porDia[(int) $fila['numero_dia']] = $fila;
    }
    return $porDia;
}

// "ALBERT" + "VENTURA MALLOFRE" -> "Albert Ventura" (nombre + primer apellido)
function nombreCorto(?string $nombre, ?string $apellidos): string {
    $primerApellido = strtok(trim($apellidos ?? ''), ' ') ?: '';
    return mb_convert_case(mb_strtolower(trim($nombre . ' ' . $primerApellido)), MB_CASE_TITLE, 'UTF-8');
}

// Lo que se puede ENSEÑAR de un día a quien lo mira:
//  'sin_premio'  -> el día no tiene premio (fines de semana, festivo)
//  'sin_ganador' -> tiene premio pero no hay ganador
//  'esperando'   -> hay ganador pero aún no lo ha abierto: no se desvela nada
//  'premio'      -> el ganador ya lo abrió: foto, premio y ganador para TODOS
function infoSorteo(array $fila, int $usuarioId): array {
    if ($fila['premio_id'] === null) {
        return ['tipo' => 'sin_premio'];
    }
    if ($fila['ganador_id'] === null) {
        return ['tipo' => 'sin_ganador'];
    }
    if ((int) $fila['abierto_por_ganador'] === 0) {
        return ['tipo' => 'esperando'];
    }
    return [
        'tipo'        => 'premio',
        'mio'         => (int) $fila['ganador_id'] === $usuarioId,
        'premio'      => $fila['premio'],
        'descripcion' => $fila['descripcion'] ?? '',
        'imagen'      => $fila['imagen'] ?? '',
        'ganador'     => nombreCorto($fila['ganador_nombre'], $fila['ganador_apellidos']),
    ];
}

// ¿La imagen va A SANGRE (rellenando la casilla)? Solo si cumple las dos cosas:
//  1) Es apaisada: ancho / alto >= 1.33 (getimagesize). Con 1.33, Suchard (1.326)
//     se ve entero y la postal del 24 (1.339) sigue a sangre.
//  2) Es una FOTO CON FONDO, no un producto recortado: sus 4 esquinas son opacas.
//     Los PNG "sinfondo" tienen las esquinas transparentes; a sangre la puerta les
//     taparía el producto (p. ej. la bola de Happy Socks), así que se ven enteros.
// static: cada imagen se analiza una sola vez por petición aunque salga en varias casillas.
function seVeASangre(string $rutaImagen): bool {
    static $cache = [];
    if (!isset($cache[$rutaImagen])) {
        $archivo = dirname(__DIR__) . '/' . $rutaImagen;     // Las rutas de la BBDD son relativas a la raíz
        $medidas = is_file($archivo) ? getimagesize($archivo) : false;
        if (!$medidas) {
            $cache[$rutaImagen] = true;                       // Si no se puede medir: a sangre
        } else {
            $cache[$rutaImagen] = ($medidas[0] / $medidas[1]) >= 1.33 && !tieneEsquinasTransparentes($archivo, $medidas);
        }
    }
    return $cache[$rutaImagen];
}

// true si alguna esquina del PNG es transparente (solo los PNG pueden serlo)
function tieneEsquinasTransparentes(string $archivo, array $medidas): bool {
    if ($medidas['mime'] !== 'image/png') {
        return false;
    }
    $im = imagecreatefrompng($archivo);
    [$w, $h] = $medidas;
    foreach ([[0, 0], [$w - 1, 0], [0, $h - 1], [$w - 1, $h - 1]] as [$x, $y]) {
        $alfa = (imagecolorat($im, $x, $y) >> 24) & 127;      // GD: 0 = opaco, 127 = transparente
        if ($alfa > 100) {
            return true;
        }
    }
    return false;
}

// HTML del hueco de la casilla abierta (todo escapado con htmlspecialchars)
function htmlInteriorCasilla(array $info): string {
    $h = fn($texto) => htmlspecialchars((string) $texto, ENT_QUOTES, 'UTF-8');

    switch ($info['tipo']) {
        case 'premio':
            if ($info['imagen'] !== '') {
                $src = '../' . $h($info['imagen']);
                if (seVeASangre($info['imagen'])) {
                    // Foto apaisada con fondo: a sangre, rellena toda la casilla
                    $foto = '<img src="' . $src . '" alt="" class="premio-foto" loading="lazy" decoding="async">';
                } else {
                    // Producto: ENTERO y grande sobre fondo de estudio, a la derecha de la puerta
                    $foto = '<img src="' . $src . '" alt="" class="premio-foto premio-entera" loading="lazy" decoding="async">';
                }
            } else {
                $foto = '<span class="interior-icono">🎁</span>';
            }
            return $foto
                . '<span class="banda-premio">'
                . '<strong>🏆 ' . $h($info['ganador']) . '</strong>'
                . '<span>' . $h($info['premio']) . '</span>'
                . '</span>';

        case 'esperando':
            return '<span class="aviso-interior">'
                . '<span class="aviso-icono">🎁</span>'
                . '<strong>Premio asignado</strong>'
                . '<small>Esperando al ganador</small>'
                . '</span>';

        case 'sin_ganador':
            return '<span class="aviso-interior">'
                . '<img src="../img/logo-imc-sinfondo.png" alt="" class="interior-logo" loading="lazy" decoding="async">'
                . '<small>Sin ganador</small>'
                . '</span>';

        default: // sin_premio
            return '<span class="aviso-interior">'
                . '<img src="../img/logo-imc-sinfondo.png" alt="" class="interior-logo" loading="lazy" decoding="async">'
                . '<small>Sin premio</small>'
                . '</span>';
    }
}
