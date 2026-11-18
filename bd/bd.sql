-- =========================================================
-- CALENDARIO DE ADVIENTO - IMC TOYS
-- Estructura de la base de datos (sin datos de empleados).
--
-- Motor InnoDB: es el único de MySQL que respeta las
-- FOREIGN KEY. Con MyISAM las claves foráneas se ignoran.
-- =========================================================

CREATE DATABASE IF NOT EXISTS bd_calendarioAdv
    DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;
USE bd_calendarioAdv;


-- ---------------------------------------------------------
-- 1. EMPLEADOS (se rellena con el CSV de Factorial)
--    participa = 0 por defecto: el empleado pasa a 1
--    cuando se inscribe desde la página de registro.
--    excluido = 1 lo pone SOLO un admin (bajas, personal fuera
--    de sorteo): no puede entrar, ni sortear, ni re-registrarse.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    apellidos     VARCHAR(100) NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    ubicacion     VARCHAR(100) NULL,
    departamento  VARCHAR(100) DEFAULT 'General',
    rol           ENUM('empleado', 'admin') NOT NULL DEFAULT 'empleado',
    participa     TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = se ha registrado
    excluido      TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = excluido por un admin
    pin           VARCHAR(255) NULL       -- Hash del PIN (solo administradores)
) ENGINE=InnoDB;


-- ---------------------------------------------------------
-- 2. PREMIOS (inventario)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS premios (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    nombre                VARCHAR(150) NOT NULL,
    descripcion           TEXT NULL,
    imagen                VARCHAR(255) NULL,    -- NULL = sin foto (el JS pone un icono)
    unidades_totales      INT NOT NULL,
    unidades_disponibles  INT NOT NULL
) ENGINE=InnoDB;


-- ---------------------------------------------------------
-- 3. DÍAS DEL CALENDARIO
--    Cada día tiene su premio y, tras el primer clic, su ganador.
--    uk_ganador_unico: una persona solo puede ganar UN día en todo
--    el calendario (MySQL permite varios NULL = días sin ganador).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS dias_adviento (
    numero_dia          INT PRIMARY KEY,               -- 0 (30 nov) y del 1 al 24
    fecha               DATE NOT NULL,
    es_laborable        TINYINT(1) NOT NULL DEFAULT 1, -- 0 = finde o festivo
    premio_id           INT NULL,
    ganador_id          INT NULL,                      -- NULL hasta el sorteo
    abierto_por_ganador TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY fecha (fecha),
    UNIQUE KEY uk_ganador_unico (ganador_id),
    CONSTRAINT dias_adviento_ibfk_1 FOREIGN KEY (premio_id) REFERENCES premios(id) ON DELETE SET NULL,
    CONSTRAINT fk_dia_ganador FOREIGN KEY (ganador_id) REFERENCES empleados(id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- ---------------------------------------------------------
-- 4. PARTICIPACIONES (quién abre qué día y cuándo)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS participaciones (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    empleado_id  INT NOT NULL,
    numero_dia   INT NOT NULL,
    premio_id    INT NULL,                -- NULL = ese día no le tocó premio físico
    fecha_hora   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
    FOREIGN KEY (premio_id)   REFERENCES premios(id)   ON DELETE SET NULL,
    FOREIGN KEY (numero_dia)  REFERENCES dias_adviento(numero_dia) ON DELETE RESTRICT,
    -- CLAVE: impide que un empleado abra el mismo día dos veces,
    -- aunque alguien se salte la validación de PHP.
    UNIQUE (empleado_id, numero_dia)
) ENGINE=InnoDB;

UPDATE empleados SET pin = '$2y$10$pd6C7aLbyBWMmy6rkAUqrOpCFddp5A67ErzCFZUTMJlqQkWKQbWPS' WHERE rol = 'admin';


INSERT INTO premios (id, nombre, descripcion, imagen, unidades_totales, unidades_disponibles) VALUES
(1,  'Desayuno Pa de Pas',           'Zumo de naranja natural, bocadillo y café en Pa de Pas.',               'img/premios/desayuno-padepas.jpg',           4, 4),
(2,  'Cactus Socks',                 'Calcetines originales con diseño de cactus en maceta.',                  'img/premios/calcetinescactus-sinfondo.png',  1, 1),
(3,  'Bombones Caja Roja',           'Surtido clásico de bombones Nestlé Caja Roja.',                          'img/premios/bombonescajaroja-sinfondo.png',  2, 2),
(4,  'Turrón Suchard',               'Tableta de turrón de chocolate crujiente Suchard.',                      'img/premios/suchard-sinfondo.png',           3, 3),
(5,  'Wonderbox Belleza',            'Cofre regalo Wonderbox Belleza y Caprichos.',                            'img/premios/wonderbox-belleza-sinfondo.png', 1, 1),
(6,  'Venchi Mini Libro Bombones',   'Libro metálico navideño con surtido de bombones Venchi.',                'img/premios/venchi-sinfondo.png',            1, 1),
(7,  'Wonderbox Cinesa',             'Cofre regalo Wonderbox con entradas y menú para Cinesa.',                'img/premios/wonderboxcine-sinfondo.png',     1, 1),
(8,  'Sushi Socks',                  'Caja de calcetines temáticos con presentación de sushi.',                'img/premios/caletinessushi-sinfondo.png',    1, 1),
(9,  'Happy Socks',                  'Bola navideña con calcetines estampados Happy Socks.',                   'img/premios/calcetinesnavidad-sinfondo.png', 1, 1),
(10, 'Wonderbox Bienestar',          'Cofre regalo Wonderbox Actividades a la Carta y Bienestar.',             'img/premios/wonderboxact.png',               1, 1),
(11, 'Burger Socks',                 'Caja estilo hamburguesa con calcetines temáticos Burger Socks.',         'img/premios/calcetineshamb-sinfondo.png',    1, 1),
(12, 'Pista de hielo - FC Barcelona', 'Entradas para disfrutar de la pista de hielo del FC Barcelona.',   'img/premios/premio-skating.jpg',             1, 1);


-- ganador_id y abierto_por_ganador empiezan a NULL / 0 (valores por defecto)
INSERT INTO dias_adviento (numero_dia, fecha, es_laborable, premio_id) VALUES
(0,  '2026-11-30', 1, 1),    -- Desayuno Pa de Pas
(1,  '2026-12-01', 1, 2),    -- Cactus Socks
(2,  '2026-12-02', 1, 3),    -- Bombones Caja Roja
(3,  '2026-12-03', 1, 4),    -- Turrón Suchard
(4,  '2026-12-04', 1, 5),    -- Wonderbox Belleza
(5,  '2026-12-05', 0, NULL), -- Sábado
(6,  '2026-12-06', 0, NULL), -- Domingo
(7,  '2026-12-07', 1, 6),    -- Venchi Mini Libro bombones
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
(24, '2026-12-24', 1, 12);   -- Pista de hielo - FC Barcelona
