<?php

declare(strict_types=1);

namespace EcoSignal;

use EcoSignal\Auth\AuthService;
use EcoSignal\Auth\JwtService;
use EcoSignal\Core\Database;
use EcoSignal\Repositories\UserRepository;

final class AppFactory
{
    public static function pdo(): \PDO
    {
        return Database::connection();
    }

    public static function jwt(): JwtService
    {
        return new JwtService();
    }

    public static function users(): UserRepository
    {
        return new UserRepository(self::pdo());
    }

    public static function auth(): AuthService
    {
        return new AuthService(self::jwt(), self::users());
    }
}

