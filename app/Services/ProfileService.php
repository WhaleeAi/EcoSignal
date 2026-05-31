<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\HttpException;
use App\Repositories\ProfileRepository;

final class ProfileService
{
    private ProfileRepository $profiles;
    private NameService $names;

    public function __construct(ProfileRepository $profiles, NameService $names)
    {
        $this->profiles = $profiles;
        $this->names = $names;
    }

    public function update(array $user, array $data): array
    {
        $authSource = (string)($user['auth_source'] ?? 'users');
        if ($authSource === 'org_admins') {
            return $this->updateOrgAdmin($user, $data);
        }

        if ($authSource === 'system_admins') {
            throw new HttpException('Профиль системного администратора изменяется через базу данных', 403);
        }

        return $this->updateRegularUser($user, $data);
    }

    private function updateOrgAdmin(array $user, array $data): array
    {
        $login = trim((string)($data['login'] ?? $user['login'] ?? ''));
        $about = trim((string)($data['about'] ?? ''));
        $password = trim((string)($data['password'] ?? ''));

        if ($login === '') {
            throw new HttpException('Укажите логин', 422);
        }

        if (mb_strlen($about) > 1000) {
            throw new HttpException('Поле "О себе" слишком длинное', 422);
        }

        if ($password !== '' && mb_strlen($password) < 6) {
            throw new HttpException('Пароль должен содержать минимум 6 символов', 422);
        }

        $userId = (int)$user['id'];
        if ($this->profiles->orgAdminLoginExists($login, $userId)) {
            throw new HttpException('Оргадмин с таким логином уже существует', 409);
        }

        $fields = ['login = :login', 'about = :about'];
        $params = [
            'login' => $login,
            'about' => $about !== '' ? $about : null,
        ];

        if ($password !== '') {
            $fields[] = 'password_hash = :password_hash';
            $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }

        $this->profiles->updateOrgAdmin($userId, $fields, $params);
        $updated = $this->profiles->findOrgAdmin($userId);

        if (!$updated) {
            throw new HttpException('Пользователь не найден', 404);
        }

        return ['message' => 'Профиль обновлен', 'user' => $updated];
    }

    private function updateRegularUser(array $user, array $data): array
    {
        $fullName = trim((string)($data['fullname'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $about = trim((string)($data['about'] ?? ''));
        $password = trim((string)($data['password'] ?? ''));

        if ($fullName === '') {
            throw new HttpException('Укажите ФИО', 422);
        }

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpException('Некорректный email', 422);
        }

        if (mb_strlen($about) > 1000) {
            throw new HttpException('Поле "О себе" слишком длинное', 422);
        }

        if ($password !== '' && mb_strlen($password) < 6) {
            throw new HttpException('Пароль должен содержать минимум 6 символов', 422);
        }

        [$firstName, $lastName] = $this->names->splitFullName($fullName);
        if ($firstName === '') {
            throw new HttpException('Укажите ФИО', 422);
        }

        if (mb_strlen($firstName) > 100 || mb_strlen($lastName) > 100) {
            throw new HttpException('ФИО слишком длинное', 422);
        }

        $userId = (int)$user['id'];
        if ($this->profiles->userEmailExists($email, $userId)) {
            throw new HttpException('Пользователь с таким email уже существует', 409);
        }

        $fields = [
            'first_name = :first_name',
            'last_name = :last_name',
            'email = :email',
            'about = :about',
        ];
        $params = [
            'first_name' => $firstName,
            'last_name' => $lastName !== '' ? $lastName : null,
            'email' => $email,
            'about' => $about !== '' ? $about : null,
        ];

        if ($password !== '') {
            $fields[] = 'password_hash = :password_hash';
            $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        }

        $this->profiles->updateUser($userId, $fields, $params);
        $updated = $this->profiles->findUser($userId);

        if (!$updated) {
            throw new HttpException('Пользователь не найден', 404);
        }

        return ['message' => 'Профиль обновлен', 'user' => $updated];
    }
}
