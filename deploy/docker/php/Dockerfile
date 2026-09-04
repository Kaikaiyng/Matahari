FROM php:8.4.21-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libicu-dev libzip-dev libpq-dev \
    && docker-php-ext-install -j"$(nproc)" bcmath intl opcache pcntl pdo_pgsql zip \
    && apt-mark manual libpq5 libicu72 libzip4 \
    && apt-get purge -y --auto-remove libicu-dev libzip-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 rylay \
    && useradd --uid 10001 --gid rylay --home-dir /nonexistent --shell /usr/sbin/nologin rylay \
    && sed -ri 's/^user = .*/user = rylay/; s/^group = .*/group = rylay/' /usr/local/etc/php-fpm.d/www.conf

COPY deploy/docker/php/php.ini /usr/local/etc/php/conf.d/90-rylay.ini
COPY deploy/docker/php/opcache.ini /usr/local/etc/php/conf.d/91-rylay-opcache.ini
COPY deploy/docker/php/entrypoint.sh /usr/local/bin/rylay-entrypoint

RUN chmod 0555 /usr/local/bin/rylay-entrypoint

WORKDIR /var/www/rylay/current/backend
USER rylay

ENTRYPOINT ["/usr/local/bin/rylay-entrypoint"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD php-fpm -t || exit 1
CMD ["php-fpm", "--nodaemonize"]
