<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\IdentityProviderInterface;
use App\Contracts\IdentityRepositoryInterface;
use App\Core\Http\Request;
use App\Exceptions\HttpException;
use Throwable;

final class AuthService
{
    private JwtService $jwt;
    private array $identityProviders;
    private array $identityRepositories;

    public function __construct(JwtService $jwt, array $identityProviders, array $identityRepositories)
    {
        $this->jwt = $jwt;
        $this->identityProviders = $identityProviders;
        $this->identityRepositories = $identityRepositories;
    }

    public function login(string $login, string $password): array
    {
        foreach ($this->identityProviders as $provider) {
            if (!$provider instanceof IdentityProviderInterface) {
                continue;
            }

            $identity = $provider->authenticate($login, $password);
            if ($identity === null) {
                continue;
            }

            return [
                'message' => 'Вход выполнен успешно',
                'token' => $this->jwt->create($identity['token_identity'], $identity['auth_source']),
                'user' => $identity['user'],
            ];
        }

        throw new HttpException('Неверный email, логин или пароль', 401);
    }

    public function requireAuth(Request $request): array
    {
        $token = $request->bearerToken();
        if (!$token) {
            throw new HttpException('Токен не передан', 401);
        }

        try {
            $decoded = $this->jwt->decode($token);
            $subjectId = (int)($decoded->sub ?? 0);
            $authSource = (string)($decoded->auth_source ?? 'users');
            $repo = $this->identityRepositories[$authSource] ?? null;

            if ($subjectId <= 0 || !$repo instanceof IdentityRepositoryInterface) {
                throw new HttpException('Некорректный токен', 401);
            }

            $identity = $repo->findActiveIdentity($subjectId);
            if ($identity === null) {
                throw new HttpException('Пользователь не найден', 401);
            }

            return $identity;
        } catch (HttpException $error) {
            throw $error;
        } catch (Throwable) {
            throw new HttpException('Недействительный или просроченный токен', 401);
        }
    }
}
