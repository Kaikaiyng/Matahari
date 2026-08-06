import { createHash } from 'node:crypto'
import { copyFile, lstat, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const allowlistPath = fileURLToPath(new URL('../release-files.txt', import.meta.url))
const forbiddenSegments = new Set(['node_modules', 'test-results'])
const forbiddenNames = new Set(['auth.json', 'htpasswd', 'id_rsa', 'id_ed25519'])

function normalizePath(path) {
  return path.split(sep).join('/')
}

function assertSafeRelativePath(path) {
  const normalized = normalizePath(path)
  const segments = normalized.split('/')
  const filename = segments.at(-1)?.toLowerCase() ?? ''

  if (
    segments.some((segment) => forbiddenSegments.has(segment.toLowerCase())) ||
    filename === '.env' ||
    filename.startsWith('.env.') ||
    forbiddenNames.has(filename) ||
    /\.(sqlite|sqlite3|pem|key)$/i.test(filename)
  ) {
    throw new Error(`forbidden release path: ${normalized}`)
  }
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function assertEmptyOutput(output) {
  if (!(await pathExists(output))) {
    await mkdir(output, { recursive: true })
    return
  }

  const entries = await readdir(output)
  if (entries.length > 0) throw new Error('release output directory must be empty')
}

async function copyEntry(sourceRoot, outputRoot, relativePath) {
  assertSafeRelativePath(relativePath)
  const sourcePath = join(sourceRoot, relativePath)
  const outputPath = join(outputRoot, relativePath)
  const metadata = await lstat(sourcePath)

  if (metadata.isSymbolicLink()) {
    throw new Error(`symbolic links are not allowed in releases: ${normalizePath(relativePath)}`)
  }

  if (metadata.isDirectory()) {
    await mkdir(outputPath, { recursive: true })
    const entries = await readdir(sourcePath, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))
    for (const entry of entries) {
      await copyEntry(sourceRoot, outputRoot, join(relativePath, entry.name))
    }
    return
  }

  if (!metadata.isFile()) {
    throw new Error(`unsupported release file type: ${normalizePath(relativePath)}`)
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await copyFile(sourcePath, outputPath)
}

async function hashFile(path) {
  const hash = createHash('sha256')
  hash.update(await readFile(path))
  return hash.digest('hex')
}

async function listFiles(root, current = root) {
  const results = []
  const entries = await readdir(current, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))

  for (const entry of entries) {
    const path = join(current, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await listFiles(root, path)))
    } else if (entry.isFile()) {
      results.push(normalizePath(relative(root, path)))
    } else {
      throw new Error(`unsupported release file type: ${normalizePath(relative(root, path))}`)
    }
  }

  return results
}

function validateVersion(value, name) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`${name} must use x.y.z format`)
}

export async function createRelease({
  source,
  output,
  commit,
  buildTime,
  infrastructureVersion,
  phpVersion,
  nodeVersion,
}) {
  if (!/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('commit must be a 40-character lowercase Git commit')
  }
  if (new Date(buildTime).toISOString() !== buildTime) {
    throw new Error('build time must be a canonical UTC ISO timestamp')
  }
  if (!/^\d+$/.test(infrastructureVersion)) {
    throw new Error('infrastructure version must be a positive integer string')
  }
  validateVersion(phpVersion, 'PHP version')
  validateVersion(nodeVersion, 'Node version')

  const sourceRoot = resolve(source)
  const outputRoot = resolve(output)
  if (sourceRoot === outputRoot) throw new Error('release output must differ from source')

  await assertEmptyOutput(outputRoot)

  const allowlist = (await readFile(allowlistPath, 'utf8'))
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  for (const entry of allowlist) {
    if (!(await pathExists(join(sourceRoot, entry)))) {
      throw new Error(`required release path is missing: ${entry}`)
    }
    await copyEntry(sourceRoot, outputRoot, entry)
  }

  const composerLockPath = join(sourceRoot, 'backend', 'composer.lock')
  const npmLockPath = join(sourceRoot, 'frontend', 'package-lock.json')
  const composerLock = JSON.parse(await readFile(composerLockPath, 'utf8'))
  const laravelPackage = [...(composerLock.packages ?? []), ...(composerLock['packages-dev'] ?? [])]
    .find((dependency) => dependency.name === 'laravel/framework')
  if (!laravelPackage?.version) throw new Error('laravel/framework is missing from composer.lock')
  const laravelVersion = String(laravelPackage.version).replace(/^v/, '')
  validateVersion(laravelVersion, 'Laravel version')

  const migrations = (await readdir(join(outputRoot, 'backend', 'database', 'migrations')))
    .filter((name) => name.endsWith('.php'))
    .sort((left, right) => left.localeCompare(right, 'en'))
  const files = []
  for (const path of await listFiles(outputRoot)) {
    files.push({ path, sha256: await hashFile(join(outputRoot, path)) })
  }

  const manifest = {
    schema_version: 1,
    git_commit: commit,
    build_time_utc: buildTime,
    infrastructure_version: infrastructureVersion,
    runtime: {
      php: phpVersion,
      node: nodeVersion,
      laravel: laravelVersion,
    },
    lockfiles: {
      composer_sha256: await hashFile(composerLockPath),
      npm_sha256: await hashFile(npmLockPath),
    },
    migrations,
    files,
  }

  await writeFile(join(outputRoot, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

function parseArguments(arguments_) {
  const options = {}
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index]
    const value = arguments_[index + 1]
    if (!key?.startsWith('--') || value == null) throw new Error('release arguments must be --name value pairs')
    options[key.slice(2)] = value
  }

  const required = ['source', 'output', 'commit', 'build-time', 'infrastructure-version', 'php-version', 'node-version']
  for (const name of required) {
    if (!options[name]) throw new Error(`missing required argument: --${name}`)
  }
  return options
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  try {
    const options = parseArguments(process.argv.slice(2))
    await createRelease({
      source: options.source,
      output: options.output,
      commit: options.commit,
      buildTime: options['build-time'],
      infrastructureVersion: options['infrastructure-version'],
      phpVersion: options['php-version'],
      nodeVersion: options['node-version'],
    })
    process.stdout.write('Release staging tree created.\n')
  } catch (error) {
    process.stderr.write(`Release build failed: ${error instanceof Error ? error.message : 'unknown error'}\n`)
    process.exitCode = 1
  }
}
