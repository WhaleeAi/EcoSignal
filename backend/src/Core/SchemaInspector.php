<?php

declare(strict_types=1);

namespace EcoSignal\Core;

use PDO;

final class SchemaInspector
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function tableExists(string $tableName): bool
    {
        $stmt = $this->pdo->prepare('SELECT to_regclass(:table_name) AS table_name');
        $stmt->execute(['table_name' => $tableName]);
        $row = $stmt->fetch();

        return !empty($row['table_name']);
    }

    public function columnExists(string $tableName, string $columnName): bool
    {
        $stmt = $this->pdo->prepare('
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = :table_name
              AND column_name = :column_name
            LIMIT 1
        ');
        $stmt->execute([
            'table_name' => $tableName,
            'column_name' => $columnName,
        ]);

        return (bool)$stmt->fetchColumn();
    }
}

