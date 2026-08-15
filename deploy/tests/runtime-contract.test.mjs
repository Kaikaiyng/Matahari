import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('PHP image is pinned and contains only runtime dependencies', async () => {
  const dockerfile = await readFile('deploy/docker/php/Dockerfile', 'utf8')

  assert.match(dockerfile, /^FROM php:8\.4\.21-fpm-bookworm$/m)
  assert.match(dockerfile, /docker-php-ext-install[\s\S]*bcmath[\s\S]*pdo_mysql/)
  assert.match(dockerfile, /USER rylay/)
  assert.doesNotMatch(dockerfile, /COPY\s+(backend|frontend)/i)
  assert.doesNotMatch(dockerfile, /composer|nodejs|npm/i)
})

test('application Nginx serves the SPA and only forwards controlled Laravel entry points', async () => {
  const nginx = await readFile('deploy/docker/nginx/app.conf', 'utf8')

  assert.match(nginx, /location \/api\//)
  assert.match(nginx, /location = \/health/)
  assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html/)
  assert.match(nginx, /fastcgi_pass php:9000/)
  assert.match(nginx, /server_tokens off/)
  assert.match(nginx, /location ~ \\.php\$/)
  assert.doesNotMatch(nginx, /autoindex on|server_tokens on/)
})

test('mobile App Nginx serves the independent App build and shared Laravel API', async () => {
  const nginx = await readFile('deploy/docker/nginx/mobile-app.conf', 'utf8')

  assert.match(nginx, /root \/var\/www\/rylay\/current\/app\/dist/)
  assert.match(nginx, /location \/api\//)
  assert.match(nginx, /fastcgi_pass php:9000/)
  assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html/)
  assert.match(nginx, /location ~ \\.php\$/)
})

test('production PHP configuration suppresses details and secures sessions', async () => {
  const php = await readFile('deploy/docker/php/php.ini', 'utf8')
  const opcache = await readFile('deploy/docker/php/opcache.ini', 'utf8')

  assert.match(php, /display_errors=Off/)
  assert.match(php, /expose_php=Off/)
  assert.match(php, /session\.cookie_secure=1/)
  assert.match(opcache, /opcache\.validate_timestamps=0/)
})
