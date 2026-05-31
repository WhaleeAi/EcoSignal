<?php

declare(strict_types=1);

namespace EcoSignal\Models;

final class OrgAdminAccount extends Account
{
    public function authSource(): string
    {
        return 'org_admins';
    }
}

