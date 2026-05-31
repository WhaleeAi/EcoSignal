<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\UserRepositoryInterface;
use App\Exceptions\HttpException;
use App\Models\User;

final class RegistrationService
{
    private UserRepositoryInterface $users;
    private JwtService $jwt;
    private NameService $names;

    public function __construct(UserRepositoryInterface $users, JwtService $jwt, NameService $names)
    {
        $this->users = $users;
        $this->jwt = $jwt;
        $this->names = $names;
    }

    public function register(array $data): array
    {
        $fullName = trim((string)($data['fullname'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $password = trim((string)($data['password'] ?? ''));
        $role = trim((string)($data['role'] ?? 'citizen'));
        $allowedRoles = ['citizen'];

        if ($fullName === '' || $email === '' || $password === '' || $role === '') {
            throw new HttpException('Заполните все поля', 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpException('Некорректный email', 422);
        }

        if (mb_strlen($password) < 6) {
            throw new HttpException('Пароль должен содержать минимум 6 символов', 422);
        }

        if (!in_array($role, $allowedRoles, true)) {
            throw new HttpException('Некорректная роль', 422);
        }

        [$firstName, $lastName] = $this->names->splitFullName($fullName);
        if ($firstName === '') {
            throw new HttpException('Укажите ФИО', 422);
        }

        if ($this->users->emailExists($email)) {
            throw new HttpException('Пользователь с таким email уже существует', 409);
        }

        $user = $this->users->create(
            new User($email, $firstName, $lastName, $role),
            password_hash($password, PASSWORD_DEFAULT)
        );

        return [
            'message' => 'Регистрация успешна',
            'token' => $this->jwt->create($user),
            'user' => $user,
        ];
    }
}
