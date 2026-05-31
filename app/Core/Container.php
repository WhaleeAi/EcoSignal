<?php

declare(strict_types=1);

namespace App\Core;

use App\Controllers\CategoriesController;
use App\Controllers\CreateAppealController;
use App\Controllers\AgentAppealsController;
use App\Controllers\AgentDashboardController;
use App\Controllers\AiAppealController;
use App\Controllers\AiAdminController;
use App\Controllers\GlobalAdminController;
use App\Controllers\ImageController;
use App\Controllers\MapAppealsController;
use App\Controllers\LoginController;
use App\Controllers\MeController;
use App\Controllers\MyAppealsController;
use App\Controllers\ProfileController;
use App\Controllers\RegisterController;
use App\Controllers\SuperadminDashboardController;
use App\Controllers\UserAppealController;
use App\Core\Http\Request;
use App\Repositories\AppealRepository;
use App\Repositories\AppealReadRepository;
use App\Repositories\AiModerationRepository;
use App\Repositories\CategoryRepository;
use App\Repositories\ImageRepository;
use App\Repositories\OrgAdminRepository;
use App\Repositories\ProfileRepository;
use App\Repositories\SchemaRepository;
use App\Repositories\SuperadminDashboardRepository;
use App\Repositories\SystemAdminRepository;
use App\Repositories\UserRepository;
use App\Services\AccessService;
use App\Services\AiAppealProcessingService;
use App\Services\AiAdminService;
use App\Services\AppealService;
use App\Services\AppealViewService;
use App\Services\AuthService;
use App\Services\CategoryService;
use App\Services\GlobalAdminService;
use App\Services\ImageService;
use App\Services\JwtService;
use App\Services\NameService;
use App\Services\OpenRouterModerationClient;
use App\Services\ProfileService;
use App\Services\RegistrationService;
use App\Services\SuperadminDashboardService;
use App\Services\UploadService;

final class Container
{
    private function __construct()
    {
    }

    public static function schemaRepository(): SchemaRepository
    {
        return new SchemaRepository(Database::connection());
    }

    public static function userRepository(): UserRepository
    {
        return new UserRepository(Database::connection());
    }

    public static function orgAdminRepository(): OrgAdminRepository
    {
        return new OrgAdminRepository(Database::connection());
    }

    public static function systemAdminRepository(): SystemAdminRepository
    {
        return new SystemAdminRepository(Database::connection());
    }

    public static function categoryRepository(): CategoryRepository
    {
        return new CategoryRepository(Database::connection());
    }

    public static function appealRepository(): AppealRepository
    {
        return new AppealRepository(Database::connection());
    }

    public static function appealReadRepository(): AppealReadRepository
    {
        return new AppealReadRepository(Database::connection());
    }

    public static function imageRepository(): ImageRepository
    {
        return new ImageRepository(Database::connection());
    }

    public static function profileRepository(): ProfileRepository
    {
        return new ProfileRepository(Database::connection());
    }

    public static function superadminDashboardRepository(): SuperadminDashboardRepository
    {
        return new SuperadminDashboardRepository(Database::connection());
    }

    public static function aiModerationRepository(): AiModerationRepository
    {
        return new AiModerationRepository(Database::connection());
    }

    public static function jwtService(): JwtService
    {
        return new JwtService();
    }

    public static function authService(): AuthService
    {
        $users = self::userRepository();
        $orgAdmins = self::orgAdminRepository();
        $systemAdmins = self::systemAdminRepository();

        return new AuthService(
            self::jwtService(),
            [$users, $orgAdmins, $systemAdmins],
            [
                'users' => $users,
                'org_admins' => $orgAdmins,
                'system_admins' => $systemAdmins,
            ]
        );
    }

    public static function accessService(): AccessService
    {
        return new AccessService();
    }

    public static function appealViewService(): AppealViewService
    {
        return new AppealViewService(
            self::appealReadRepository(),
            self::imageRepository(),
            self::accessService()
        );
    }

    public static function loginController(?Request $request = null): LoginController
    {
        return new LoginController(self::authService(), $request);
    }

    public static function registerController(?Request $request = null): RegisterController
    {
        return new RegisterController(
            new RegistrationService(self::userRepository(), self::jwtService(), new NameService()),
            $request
        );
    }

    public static function categoriesController(?Request $request = null): CategoriesController
    {
        return new CategoriesController(
            self::authService(),
            new CategoryService(self::categoryRepository()),
            $request
        );
    }

    public static function createAppealController(?Request $request = null): CreateAppealController
    {
        return new CreateAppealController(
            self::authService(),
            new AppealService(self::appealRepository(), self::categoryRepository(), new UploadService()),
            $request
        );
    }

    public static function myAppealsController(?Request $request = null): MyAppealsController
    {
        return new MyAppealsController(
            self::authService(),
            new AppealService(self::appealRepository(), self::categoryRepository(), new UploadService()),
            $request
        );
    }

    public static function meController(?Request $request = null): MeController
    {
        return new MeController(self::authService(), $request);
    }

    public static function mapAppealsController(?Request $request = null): MapAppealsController
    {
        return new MapAppealsController(self::appealViewService(), $request);
    }

    public static function agentDashboardController(?Request $request = null): AgentDashboardController
    {
        return new AgentDashboardController(self::authService(), self::appealViewService(), $request);
    }

    public static function agentAppealsController(?Request $request = null): AgentAppealsController
    {
        return new AgentAppealsController(self::authService(), self::appealViewService(), $request);
    }

    public static function userAppealController(?Request $request = null): UserAppealController
    {
        return new UserAppealController(self::authService(), self::appealViewService(), $request);
    }

    public static function profileController(?Request $request = null): ProfileController
    {
        return new ProfileController(
            self::authService(),
            new ProfileService(self::profileRepository(), new NameService()),
            $request
        );
    }

    public static function superadminDashboardController(?Request $request = null): SuperadminDashboardController
    {
        return new SuperadminDashboardController(
            self::authService(),
            new SuperadminDashboardService(self::superadminDashboardRepository(), self::accessService()),
            $request
        );
    }

    public static function globalAdminController(?Request $request = null): GlobalAdminController
    {
        return new GlobalAdminController(
            self::authService(),
            new GlobalAdminService(Database::connection(), self::accessService()),
            $request
        );
    }

    public static function aiAdminController(?Request $request = null): AiAdminController
    {
        return new AiAdminController(
            self::authService(),
            new AiAdminService(Database::connection(), self::accessService(), dirname(__DIR__, 2) . '/storage/ai_errors.log'),
            $request
        );
    }

    public static function imageController(?Request $request = null): ImageController
    {
        return new ImageController(new ImageService(self::imageRepository()), $request);
    }

    public static function aiAppealController(?Request $request = null): AiAppealController
    {
        return new AiAppealController(
            self::authService(),
            new AiAppealProcessingService(
                self::appealReadRepository(),
                self::imageRepository(),
                self::aiModerationRepository(),
                new OpenRouterModerationClient()
            ),
            $request
        );
    }
}
