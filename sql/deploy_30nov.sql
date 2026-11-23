-- =========================================================
-- CALENDARIO DE ADVIENTO - IMC TOYS
-- DESPLIEGUE EN PRODUCCIÓN (arranque el lunes 30/11/2026)
--
-- Se puede importar en una base vacía O en una que ya exista:
--   - CREATE TABLE IF NOT EXISTS: no toca las tablas que ya estén.
--   - INSERT ... ON DUPLICATE KEY UPDATE id = id: si la fila ya
--     existe NO se modifica (no repone stock ni borra ganadores).
--   - No borra nada. Para limpiar datos de PRUEBAS usar
--     bd/reset_produccion.sql (eso sí borra participaciones).
--
-- Cómo usarlo (usuario root o de IT, NO el usuario de la app):
--   phpMyAdmin -> Importar -> este archivo -> Continuar
--   (o: mysql -u root -p < sql/deploy_30nov.sql)
--
-- Lo que este archivo NO puede hacer (datos privados):
--   - Cargar la plantilla de empleados (CSV de Factorial): paso 4.
--   - Elegir los administradores y su PIN: paso 5.
--
-- CHECKLIST DE SUBIDA (apertura de casillas: 12:00h, hora de Madrid)
--   [ ] Subir el código SIN las carpetas bd/, sql/, correo/ ni img/originales/
--   [ ] Importar este archivo con root/IT
--   [ ] Crear el usuario de la app con bd/usuario_bd.sql (contraseña real)
--   [ ] Crear bd/conexion.php e includes/teams_config.php desde los *.ejemplo.php
--   [ ] Importar el CSV de Factorial en empleados (paso 4)
--   [ ] Dar rol y PIN a los admins (paso 5): admins_sin_pin = 0 en las comprobaciones
--   [ ] PHP del servidor con curl, gd y mbstring activados
--   [ ] includes/config.php: HORA_APERTURA = 12
--   [ ] HTTPS hacia Power Automate: en Windows, curl.cainfo con un cacert.pem
--       válido en php.ini (así se verifica el certificado SSL)
--   [ ] Power Automate: zona horaria del flujo "(UTC+01:00) Madrid"
--       (si se queda en UTC, lo programado a las 12:00 saldría a las 13:00)
--   [ ] Programador de tareas de Windows: recordatorio_pendientes.php a las 16:00
--   [ ] Si se ha jugado en producción antes del 30: bd/reset_produccion.sql
--   [ ] Lunes 30/11 a las 12:00: abrir la casilla con un usuario de prueba y
--       comprobar que llega la tarjeta a Teams (si no, mirar el log de errores de PHP)
-- =========================================================

SET NAMES utf8mb4;
-- Hora de España en esta sesión (en noviembre/diciembre: UTC+1)
SET time_zone = '+01:00';

-- Si el hosting ya ha creado la base de datos y no deja crearla,
-- comentar la línea CREATE DATABASE y dejar solo el USE.
CREATE DATABASE IF NOT EXISTS bd_calendarioAdv
    DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;
USE bd_calendarioAdv;


-- ---------------------------------------------------------
-- 1. TABLAS (mismo esquema que bd/bd.sql y que la BBDD de pruebas)
--    Orden: primero las tablas a las que apuntan las claves foráneas.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    apellidos     VARCHAR(100) NULL,
    email         VARCHAR(150) NOT NULL,
    ubicacion     VARCHAR(100) NULL,
    departamento  VARCHAR(100) DEFAULT 'General',
    rol           ENUM('empleado', 'admin') NOT NULL DEFAULT 'empleado',
    participa     TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = se ha inscrito en registro.php
    excluido      TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = excluido por un admin
    pin           VARCHAR(255) NULL,               -- Hash del PIN (solo administradores)
    UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

CREATE TABLE IF NOT EXISTS premios (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    nombre                VARCHAR(150) NOT NULL,
    descripcion           TEXT NULL,
    imagen                VARCHAR(255) NULL,
    unidades_totales      INT NOT NULL,
    unidades_disponibles  INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

CREATE TABLE IF NOT EXISTS dias_adviento (
    numero_dia          INT PRIMARY KEY,               -- 0 = 30 nov, 1..24 = diciembre
    fecha               DATE NOT NULL,
    es_laborable        TINYINT(1) NOT NULL DEFAULT 1, -- 0 = finde o festivo
    premio_id           INT NULL,
    ganador_id          INT NULL,                      -- NULL hasta el sorteo
    abierto_por_ganador TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY fecha (fecha),
    UNIQUE KEY uk_ganador_unico (ganador_id),          -- Una persona gana como máximo 1 día
    KEY premio_id (premio_id),
    CONSTRAINT dias_adviento_ibfk_1 FOREIGN KEY (premio_id)  REFERENCES premios(id)   ON DELETE SET NULL,
    CONSTRAINT fk_dia_ganador       FOREIGN KEY (ganador_id) REFERENCES empleados(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

CREATE TABLE IF NOT EXISTS participaciones (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id  INT NOT NULL,
    numero_dia   INT NOT NULL,
    premio_id    INT NULL,                             -- NULL = ese día no le tocó premio
    fecha_hora   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY empleado_id (empleado_id, numero_dia),  -- No se abre el mismo día dos veces
    KEY premio_id (premio_id),
    KEY fk_participaciones_dia (numero_dia),
    CONSTRAINT participaciones_ibfk_1 FOREIGN KEY (empleado_id) REFERENCES empleados(id)              ON DELETE CASCADE,
    CONSTRAINT participaciones_ibfk_2 FOREIGN KEY (premio_id)   REFERENCES premios(id)                ON DELETE SET NULL,
    CONSTRAINT fk_participaciones_dia FOREIGN KEY (numero_dia)  REFERENCES dias_adviento(numero_dia) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;


-- ---------------------------------------------------------
-- 2. PREMIOS (12). Si ya existen, no se tocan (ni el stock).
--    unidades_totales = número de días que tiene asignado cada premio.
-- ---------------------------------------------------------
INSERT INTO premios (id, nombre, descripcion, imagen, unidades_totales, unidades_disponibles) VALUES
(1,  'Desayuno Pa de Pas',            'Zumo de naranja natural, bocadillo y café en Pa de Pas.',            'img/premios/desayuno-padepas.jpg',           4, 4),
(2,  'Cactus Socks',                  'Calcetines originales con diseño de cactus en maceta.',               'img/premios/calcetinescactus-sinfondo.png',  1, 1),
(3,  'Bombones Caja Roja',            'Surtido clásico de bombones Nestlé Caja Roja.',                       'img/premios/bombonescajaroja-sinfondo.png',  2, 2),
(4,  'Turrón Suchard',                'Tableta de turrón de chocolate crujiente Suchard.',                   'img/premios/suchard-sinfondo.png',           3, 3),
(5,  'Wonderbox Belleza',             'Cofre regalo Wonderbox Belleza y Caprichos.',                         'img/premios/wonderbox-belleza-sinfondo.png', 1, 1),
(6,  'Venchi Mini Libro Bombones',    'Libro metálico navideño con surtido de bombones Venchi.',             'img/premios/venchi-sinfondo.png',            1, 1),
(7,  'Wonderbox Cinesa',              'Cofre regalo Wonderbox con entradas y menú para Cinesa.',             'img/premios/wonderboxcine-sinfondo.png',     1, 1),
(8,  'Sushi Socks',                   'Caja de calcetines temáticos con presentación de sushi.',             'img/premios/caletinessushi-sinfondo.png',    1, 1),
(9,  'Happy Socks',                   'Bola navideña con calcetines estampados Happy Socks.',                'img/premios/calcetinesnavidad-sinfondo.png', 1, 1),
(10, 'Wonderbox Bienestar',           'Cofre regalo Wonderbox Actividades a la Carta y Bienestar.',          'img/premios/wonderboxact.png',               1, 1),
(11, 'Burger Socks',                  'Caja estilo hamburguesa con calcetines temáticos Burger Socks.',      'img/premios/calcetineshamb-sinfondo.png',    1, 1),
(12, 'Pista de hielo - FC Barcelona', 'Entradas para disfrutar de la pista de hielo del FC Barcelona.',      'img/premios/premio-skating.jpg',             1, 1)
ON DUPLICATE KEY UPDATE id = id;


-- ---------------------------------------------------------
-- 3. LOS 25 DÍAS (0 = lunes 30/11 ... 24 = jueves 24/12)
--    Bloqueados (es_laborable = 0): sáb/dom 5, 6, 12, 13, 19, 20 y el festivo del 8.
--    Si ya existen, no se tocan (no se pierden ganadores).
-- ---------------------------------------------------------
INSERT INTO dias_adviento (numero_dia, fecha, es_laborable, premio_id) VALUES
(0,  '2026-11-30', 1, 1),    -- Lunes · Desayuno Pa de Pas
(1,  '2026-12-01', 1, 2),    -- Cactus Socks
(2,  '2026-12-02', 1, 3),    -- Bombones Caja Roja
(3,  '2026-12-03', 1, 4),    -- Turrón Suchard
(4,  '2026-12-04', 1, 5),    -- Wonderbox Belleza
(5,  '2026-12-05', 0, NULL), -- Sábado
(6,  '2026-12-06', 0, NULL), -- Domingo
(7,  '2026-12-07', 1, 6),    -- Venchi Mini Libro Bombones
(8,  '2026-12-08', 0, NULL), -- Festivo
(9,  '2026-12-09', 1, 7),    -- Wonderbox Cinesa
(10, '2026-12-10', 1, 1),    -- Desayuno Pa de Pas
(11, '2026-12-11', 1, 8),    -- Sushi Socks
(12, '2026-12-12', 0, NULL), -- Sábado
(13, '2026-12-13', 0, NULL), -- Domingo
(14, '2026-12-14', 1, 9),    -- Happy Socks
(15, '2026-12-15', 1, 4),    -- Turrón Suchard
(16, '2026-12-16', 1, 1),    -- Desayuno Pa de Pas
(17, '2026-12-17', 1, 3),    -- Bombones Caja Roja
(18, '2026-12-18', 1, 10),   -- Wonderbox Bienestar
(19, '2026-12-19', 0, NULL), -- Sábado
(20, '2026-12-20', 0, NULL), -- Domingo
(21, '2026-12-21', 1, 1),    -- Desayuno Pa de Pas
(22, '2026-12-22', 1, 11),   -- Burger Socks
(23, '2026-12-23', 1, 4),    -- Turrón Suchard
(24, '2026-12-24', 1, 12)    -- Pista de hielo - FC Barcelona
ON DUPLICATE KEY UPDATE numero_dia = numero_dia;


-- ---------------------------------------------------------
-- 4. EMPLEADOS (MANUAL, después de importar este archivo)
--    phpMyAdmin -> tabla empleados -> Importar -> CSV de Factorial
--    Columnas: nombre, apellidos, email, ubicacion, departamento
--    (participa y excluido se quedan a 0; cada uno se inscribe en registro.php).
--    Los correos repetidos se rechazan (email es UNIQUE).
-- ---------------------------------------------------------


-- ---------------------------------------------------------
-- 5. ADMINISTRADORES (MANUAL, después del paso 4)
--    Sin PIN, un admin NO puede entrar (login.proc.php lo exige).
--    Generar el hash del PIN en el servidor:
--        php -r "echo password_hash('PIN_ELEGIDO', PASSWORD_DEFAULT), PHP_EOL;"
--    Quitar los "-- " de las dos líneas siguientes y poner los correos y el hash:
-- ---------------------------------------------------------
-- UPDATE empleados SET rol = 'admin', pin = 'HASH_GENERADO'
-- WHERE email IN ('admin1@imctoys.com', 'admin2@imctoys.com');


-- =========================================================
-- COMPROBACIONES (resultado esperado al lado)
-- =========================================================
SELECT COUNT(*) AS premios FROM premios;                                         -- 12
SELECT COUNT(*) AS dias, MIN(fecha) AS primero, MAX(fecha) AS ultimo
FROM dias_adviento;                                                              -- 25 · 2026-11-30 · 2026-12-24
SELECT COUNT(*) AS dias_bloqueados FROM dias_adviento WHERE es_laborable = 0;    -- 7
SELECT COUNT(*) AS dias_con_ganador FROM dias_adviento
WHERE ganador_id IS NOT NULL OR abierto_por_ganador = 1;                         -- 0 antes del 30
SELECT COUNT(*) AS participaciones FROM participaciones;                         -- 0 antes del 30
-- Stock que no cuadra con los días asignados (debe salir vacío)
SELECT p.id, p.nombre, p.unidades_totales, p.unidades_disponibles, COUNT(d.numero_dia) AS dias_asignados
FROM premios p LEFT JOIN dias_adviento d ON d.premio_id = p.id
GROUP BY p.id, p.nombre, p.unidades_totales, p.unidades_disponibles
HAVING dias_asignados <> p.unidades_totales OR p.unidades_disponibles <> p.unidades_totales;
-- Tras los pasos 4 y 5: empleados > 0 y ningún admin sin PIN
SELECT COUNT(*) AS empleados, SUM(rol = 'admin') AS admins,
       SUM(rol = 'admin' AND pin IS NULL) AS admins_sin_pin                      -- admins >= 1 · admins_sin_pin = 0
FROM empleados;
