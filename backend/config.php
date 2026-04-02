<?php

declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_PORT = '5432';
const DB_NAME = 'ecosignal';
const DB_USER = 'postgres';
const DB_PASSWORD = '123456';

const JWT_SECRET = 'eco_signal_super_secret_key_123456';
const JWT_ALGO = 'HS256';
const JWT_EXPIRE_SECONDS = 3600 * 24; // 24 часа