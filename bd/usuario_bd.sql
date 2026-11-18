-- =========================================================
-- CALENDARIO DE ADVIENTO - IMC TOYS
-- USUARIO DE MySQL QUE USA LA APLICACIÓN (bd/conexion.php)
--
-- Lo ejecuta UNA vez un administrador de MySQL (root o IT),
-- en phpMyAdmin -> pestaña SQL, en el servidor donde se aloje.
-- La contraseña debe ser la misma que $dbpassword en bd/conexion.php.
--
-- Permisos mínimos: solo filas de bd_calendarioAdv.
-- No puede ver otras bases, ni borrar/crear tablas, ni crear usuarios.
-- (El script bd/reset_produccion.sql usa ALTER TABLE: lo ejecuta root, no este usuario.)
--
-- 'localhost': solo se conecta desde la misma máquina que la web.
-- Si la BBDD estuviera en otro servidor, IT cambiaría ese valor.
-- =========================================================

CREATE USER IF NOT EXISTS 'Administrador'@'localhost' IDENTIFIED BY 'CONTRASEÑA_DE_conexion.php';

GRANT SELECT, INSERT, UPDATE, DELETE ON bd_calendarioAdv.* TO 'Administrador'@'localhost';

FLUSH PRIVILEGES;

-- Comprobación: debe mostrar solo USAGE y los 4 permisos sobre bd_calendarioAdv
SHOW GRANTS FOR 'Administrador'@'localhost';
