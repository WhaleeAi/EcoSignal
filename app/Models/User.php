<?php

declare(strict_types=1);

namespace App\Models;

final class User
{
    private string $email;
    private string $firstName;
    private string $lastName;
    private string $role;

    public function __construct(string $email, string $firstName, string $lastName, string $role)
    {
        $this->email = $email;
        $this->firstName = $firstName;
        $this->lastName = $lastName;
        $this->role = $role;
    }

    public function email(): string
    {
        return $this->email;
    }

    public function firstName(): string
    {
        return $this->firstName;
    }

    public function lastName(): string
    {
        return $this->lastName;
    }

    public function role(): string
    {
        return $this->role;
    }
}
