FROM php:8.4.21-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libicu-dev libzip-dev \
    && docker-php-ext-install -j"$(nproc)" bcmath intl opcache pcntl pdo_mysql zip \
    && apt-get purge -y --auto-remove libicu-dev libzip-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 matahari \
    && useradd --uid 10001 --gid matahari --home-dir /nonexistent --shell /usr/sbin/nologin matahari \
    && sed -ri 's/^user = .*/user = matahari/; s/^group = .*/group = matahari/' /usr/local/etc/php-fpm.d/www.conf

COPY deploy/docker/php/php.ini /usr/local/etc/php/conf.d/90-matahari.ini
COPY deploy/docker/php/opcache.ini /usr/local/etc/php/conf.d/91-matahari-opcache.ini
COPY deploy/docker/php/entrypoint.sh /usr/local/bin/matahari-entrypoint

RUN chmod 0555 /usr/local/bin/matahari-entrypoint

WORKDIR /var/www/matahari/current/backend
USER matahari

ENTRYPOINT ["/usr/local/bin/matahari-entrypoint"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD php-fpm -t || exit 1
CMD ["php-fpm", "--nodaemonize"]
