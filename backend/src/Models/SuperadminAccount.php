<?php

declare(strict_types=1);

namespace EcoSignal\Models;

final class SuperadminAccount extends Account
{
    public function authSource(): string
    {
        return 'superadmins';
    }
}

