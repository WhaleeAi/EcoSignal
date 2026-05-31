<?php

declare(strict_types=1);

require_once __DIR__ . '/../app/bootstrap.php';

use App\Core\Container;
use App\Core\Http\Response;
use App\Core\Router;

Response::allowCors();

$router = new Router();

$router->post('/auth/login', static fn() => Container::loginController()->handle());
$router->post('/auth/register', static fn() => Container::registerController()->handle());
$router->get('/auth/me', static fn() => Container::meController()->handle());

$router->get('/categories', static fn() => Container::categoriesController()->handle());

$router->post('/appeals', static fn() => Container::createAppealController()->handle());
$router->get('/appeals/my', static fn() => Container::myAppealsController()->handle());
$router->get('/appeals/map', static fn() => Container::mapAppealsController()->handle());
$router->post('/appeals/process-ai', static fn() => Container::aiAppealController()->handle());
$router->post('/appeals/messages', static fn() => Container::userAppealController()->message());
$router->get('/appeals/{id}', static fn(string $id) => Container::userAppealController()->details((int)$id));

$router->post('/profile', static fn() => Container::profileController()->handle());

$router->get('/agent/dashboard', static fn() => Container::agentDashboardController()->handle());
$router->get('/agent/appeals', static fn() => Container::agentAppealsController()->list());
$router->post('/agent/appeals/update', static fn() => Container::agentAppealsController()->update());
$router->get('/agent/appeals/{id}', static fn(string $id) => Container::agentAppealsController()->details((int)$id));

$router->get('/superadmin/dashboard', static fn() => Container::superadminDashboardController()->handle());
$router->post('/superadmin/dashboard', static fn() => Container::superadminDashboardController()->handle());

$router->get('/global-admin/dashboard', static fn() => Container::globalAdminController()->dashboard());
$router->get('/global-admin/appeals', static fn() => Container::globalAdminController()->appeals());
$router->get('/global-admin/audit', static fn() => Container::globalAdminController()->audit());
$router->get('/global-admin/export', static fn() => Container::globalAdminController()->export());
$router->post('/global-admin/system-admins', static fn() => Container::globalAdminController()->createSystemAdmin());
$router->post('/global-admin/system-admins/delete', static fn() => Container::globalAdminController()->deleteSystemAdmin());
$router->post('/global-admin/users/delete', static fn() => Container::globalAdminController()->deleteUser());

$router->get('/ai-admin/dashboard', static fn() => Container::aiAdminController()->dashboard());
$router->post('/ai-admin/review', static fn() => Container::aiAdminController()->review());
$router->post('/ai-admin/requeue', static fn() => Container::aiAdminController()->requeue());
$router->post('/ai-admin/settings', static fn() => Container::aiAdminController()->settings());

$router->get('/images/{id}', static fn(string $id) => Container::imageController()->show((int)$id));

$basePath = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? ''))), '/');
$requestPath = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';

if ($basePath !== '' && $basePath !== '/' && str_starts_with($requestPath, $basePath)) {
    $requestPath = substr($requestPath, strlen($basePath));
}

$router->dispatch((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'), $requestPath ?: '/');
