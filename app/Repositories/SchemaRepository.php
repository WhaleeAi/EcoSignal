<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Repository;

final class SchemaRepository extends Repository
{
    public function hasTable(string $tableName): bool
    {
        return $this->tableExists($tableName);
    }

    public function hasColumn(string $tableName, string $columnName): bool
    {
        return $this->columnExists($tableName, $columnName);
    }
}
