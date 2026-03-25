<?php

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';

try {
    $pdo = getPDO();
    echo "DB connection OK";
} catch (Throwable $e) {
    echo "DB error: " . $e->getMessage();
}