$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$phpIni = Join-Path $repoRoot 'tools\php\php.ini'
php -c $phpIni @args
