<?php

declare(strict_types=1);

namespace EcoSignal\Controllers;

use EcoSignal\AppFactory;
use EcoSignal\Auth\AuthService;
use EcoSignal\Auth\JwtService;
use EcoSignal\Core\BaseController;
use EcoSignal\Core\HttpException;
use EcoSignal\Repositories\UserRepository;
use EcoSignal\Support\Text;

final class AuthController extends BaseController
{
    private UserRepository $users;
    private JwtService $jwt;
    private AuthService $auth;

    public function __construct()
    {
        parent::__construct();
        $this->users = AppFactory::users();
        $this->jwt = AppFactory::jwt();
        $this->auth = AppFactory::auth();
    }

    public function login(): void
    {
        $this->run(function (): void {
            $this->only('POST');
            $data = $this->request->json();

            $email = trim((string)($data['email'] ?? ''));
            $password = trim((string)($data['password'] ?? ''));

            if ($email === '' || $password === '') {
                throw new HttpException('Введите email и пароль', 422);
            }

            $appUser = $this->users->findUserByEmail($email);
            if ($appUser && password_verify($password, (string)$appUser['password_hash'])) {
                $token = $this->jwt->create($appUser, 'users');
                unset($appUser['password_hash']);
                $appUser['auth_source'] = 'users';

                $this->json([
                    'message' => 'Вход выполнен успешно',
                    'token' => $token,
                    'user' => $appUser,
                ]);
            }

            $superadmin = $this->users->findSuperadminByLogin($email);
            if ($superadmin && password_verify($password, (string)$superadmin['password_hash'])) {
                if (!(bool)$superadmin['is_active']) {
                    throw new HttpException('Учетная запись деактивирована', 403);
                }

                $this->users->touchLastLogin('superadmins', (int)$superadmin['id']);
                $token = $this->jwt->create([
                    'id' => (int)$superadmin['id'],
                    'login' => (string)$superadmin['login'],
                    'email' => (string)$superadmin['login'],
                    'role' => (string)$superadmin['role'],
                ], 'superadmins');

                $this->json([
                    'message' => 'Вход выполнен успешно',
                    'token' => $token,
                    'user' => [
                        'id' => (int)$superadmin['id'],
                        'login' => (string)$superadmin['login'],
                        'email' => (string)$superadmin['login'],
                        'name' => trim((string)($superadmin['full_name'] ?? '')) !== ''
                            ? (string)$superadmin['full_name']
                            : (string)$superadmin['login'],
                        'role' => (string)$superadmin['role'],
                        'created_at' => (string)$superadmin['created_at'],
                        'last_login_at' => $superadmin['last_login_at'] !== null ? (string)$superadmin['last_login_at'] : null,
                        'auth_source' => 'superadmins',
                    ],
                ]);
            }

            $orgAdmin = $this->users->findOrgAdminByLogin($email);
            if ($orgAdmin && password_verify($password, (string)$orgAdmin['password_hash'])) {
                if (!(bool)$orgAdmin['is_active']) {
                    throw new HttpException('Учетная запись деактивирована', 403);
                }

                $this->users->touchLastLogin('org_admins', (int)$orgAdmin['id']);
                $token = $this->jwt->create([
                    'id' => (int)$orgAdmin['id'],
                    'login' => (string)$orgAdmin['login'],
                    'role' => (string)$orgAdmin['role'],
                ], 'org_admins');

                $this->json([
                    'message' => 'Вход выполнен успешно',
                    'token' => $token,
                    'user' => [
                        'id' => (int)$orgAdmin['id'],
                        'login' => (string)$orgAdmin['login'],
                        'email' => (string)$orgAdmin['login'],
                        'role' => (string)$orgAdmin['role'],
                        'organization_id' => (int)$orgAdmin['organization_id'],
                        'organization_name' => (string)$orgAdmin['organization_name'],
                        'organization_type' => (string)$orgAdmin['org_type'],
                        'filial_id' => $orgAdmin['filial_id'] !== null ? (int)$orgAdmin['filial_id'] : null,
                        'filial_name' => $orgAdmin['filial_name'] !== null ? (string)$orgAdmin['filial_name'] : null,
                        'filial_region' => $orgAdmin['filial_region'] !== null ? (string)$orgAdmin['filial_region'] : null,
                        'created_at' => (string)$orgAdmin['created_at'],
                        'last_login_at' => $orgAdmin['last_login_at'] !== null ? (string)$orgAdmin['last_login_at'] : null,
                        'auth_source' => 'org_admins',
                    ],
                ]);
            }

            throw new HttpException('Неверный email или пароль', 401);
        });
    }

    public function register(): void
    {
        $this->run(function (): void {
            $this->only('POST');
            $data = $this->request->json();

            $fullName = trim((string)($data['fullname'] ?? ''));
            $email = trim((string)($data['email'] ?? ''));
            $password = trim((string)($data['password'] ?? ''));
            $role = trim((string)($data['role'] ?? 'citizen'));

            if ($fullName === '' || $email === '' || $password === '' || $role === '') {
                throw new HttpException('Заполните все поля', 422);
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new HttpException('Некорректный email', 422);
            }
            if (mb_strlen($password) < 6) {
                throw new HttpException('Пароль должен содержать минимум 6 символов', 422);
            }
            if (!in_array($role, ['citizen', 'agency'], true)) {
                throw new HttpException('Некорректная роль', 422);
            }

            [$firstName, $lastName] = Text::splitFullName($fullName);
            if ($firstName === '') {
                throw new HttpException('Укажите ФИО', 422);
            }

            if ($this->users->userEmailExists($email)) {
                throw new HttpException('Пользователь с таким email уже существует', 409);
            }

            $user = $this->users->createUser($email, password_hash($password, PASSWORD_DEFAULT), $firstName, $lastName ?: null, $role);
            $token = $this->jwt->create($user);

            $this->json([
                'message' => 'Регистрация успешна',
                'token' => $token,
                'user' => $user,
            ], 201);
        });
    }

    public function me(): void
    {
        $this->run(function (): void {
            $this->only('GET');
            $user = $this->auth->requireAuth($this->request);

            $this->json([
                'message' => 'Токен валиден',
                'user' => $user->toArray(),
            ]);
        });
    }
}

