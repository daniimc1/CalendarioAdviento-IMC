-- =========================================================
-- CALENDARIO DE ADVIENTO - IMC TOYS
-- PUESTA A CERO ANTES DEL 30 DE NOVIEMBRE (producción)
--
-- Borra TODO lo jugado en las pruebas y deja las 25 casillas
-- cerradas y sin ganador. NO toca:
--   - los empleados ni sus PIN de administrador,
--   - el catálogo de premios (solo repone sus unidades),
--   - la fecha, el premio asignado ni es_laborable de cada día
--     (fines de semana y el festivo del 8 siguen bloqueados).
--
-- Cómo usarlo: phpMyAdmin -> bd_calendarioAdv -> pestaña SQL
-- -> pegar este archivo entero -> Continuar.
-- Ejecutarlo SOLO antes del 30 de noviembre: no se puede deshacer.
-- =========================================================

USE bd_calendarioAdv;

START TRANSACTION;

-- 1. Participaciones de prueba (quién abrió qué casilla).
--    Se usa DELETE y no TRUNCATE: TRUNCATE no se puede deshacer
--    dentro de una transacción. Ninguna tabla apunta a participaciones,
--    así que no hay claves foráneas que lo impidan.
DELETE FROM participaciones;

-- 2. Ganadores de prueba: todas las casillas vuelven a "sin sortear".
--    Se mantienen fecha, premio_id y es_laborable de cada día.
UPDATE dias_adviento
SET ganador_id = NULL,
    abierto_por_ganador = 0;

-- 3. Stock de premios: cada uno vuelve a tener todas sus unidades.
UPDATE premios
SET unidades_disponibles = unidades_totales;

COMMIT;

-- 4. Los ids de participaciones vuelven a empezar en 1 (fuera de la transacción).
ALTER TABLE participaciones AUTO_INCREMENT = 1;


-- =========================================================
-- COMPROBACIONES (deben salir como se indica)
-- =========================================================

-- 0 participaciones
SELECT COUNT(*) AS participaciones FROM participaciones;

-- 0 días con ganador o abiertos
SELECT COUNT(*) AS dias_con_ganador
FROM dias_adviento
WHERE ganador_id IS NOT NULL OR abierto_por_ganador = 1;

-- 0 premios con stock descuadrado
SELECT COUNT(*) AS premios_descuadrados
FROM premios
WHERE unidades_disponibles <> unidades_totales;

-- Días bloqueados: deben salir 7 (sábados y domingos 5, 6, 12, 13, 19, 20 y el festivo 8)
SELECT numero_dia, fecha, es_laborable
FROM dias_adviento
WHERE es_laborable = 0
ORDER BY numero_dia;
