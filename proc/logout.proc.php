<?php
session_start();
$_SESSION = [];
session_destroy();
header('Location: ../vistas/login.php');
exit();
?>