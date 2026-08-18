import { spawn } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const statePath = join(appRoot, 'node_modules', '.endge-local-packages.json')
const runParallelCommand = join(
  appRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'run-p.cmd' : 'run-p',
)
const packages = [
  localPackage('@endge/codegen', '../../../packages/@endge-codegen/'),
  localPackage('@endge/utils', '../../../packages/@endge-utils/'),
  localPackage('@endge/raph', '../../../packages/@endge-raph/'),
  localPackage('@endge/core', '../../../packages/@endge-core/'),
  localPackage('@endge/ui-vue', '../../../packages/@endge-ui-vue/'),
  localPackage('@endge/computation-sandbox', '../../../packages/@endge-computation-sandbox/'),
  localPackage('@endge/ui-vue-shadcn', '../../../packages/@endge-ui-vue-shadcn/'),
]

let child = null
let requestedSignal = null

try {
  if (existsSync(statePath)) {
    console.warn('Found stale Endge package links from a previous run. Restoring them first.')
    restorePackageLinks()
  }

  for (const pkg of packages)
    await ensurePackageBuilt(pkg)

  linkLocalPackages()

  child = spawn(runParallelCommand, ['dev:libs', 'dev:app'], {
    cwd: appRoot,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  const forwardSignal = (signal) => {
    requestedSignal = signal
    if (child && !child.killed)
      child.kill(signal)
  }
  const onSigint = () => forwardSignal('SIGINT')
  const onSigterm = () => forwardSignal('SIGTERM')

  process.on('SIGINT', onSigint)
  process.on('SIGTERM', onSigterm)

  const result = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })

  process.off('SIGINT', onSigint)
  process.off('SIGTERM', onSigterm)
  restorePackageLinks()

  const signal = requestedSignal ?? result.signal
  process.exitCode = requestedSignal
    ? 0
    : signal
      ? 1
      : result.code ?? 1
}
catch (error) {
  try {
    restorePackageLinks()
  }
  catch (restoreError) {
    console.error(restoreError)
  }
  console.error(error)
  process.exitCode = 1
}

function localPackage(name, relativePath) {
  return {
    name,
    directory: fileURLToPath(new URL(relativePath, import.meta.url)),
  }
}

async function ensurePackageBuilt(pkg) {
  const manifestPath = join(pkg.directory, 'package.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Local package "${pkg.name}" was not found at ${pkg.directory}`)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== pkg.name) {
    throw new Error(`Expected "${pkg.name}" at ${pkg.directory}, found "${manifest.name ?? 'unknown'}".`)
  }

  const entry = manifest.exports?.['.']?.import ?? manifest.module ?? manifest.main
  if (typeof entry !== 'string' || existsSync(join(pkg.directory, entry)))
    return

  if (typeof manifest.scripts?.build !== 'string')
    throw new Error(`Local package "${pkg.name}" is not built and has no build script.`)

  console.log(`Building missing local package "${pkg.name}"...`)
  await runCommand('pnpm', ['--dir', pkg.directory, 'run', 'build'])

  if (!existsSync(join(pkg.directory, entry)))
    throw new Error(`Local package "${pkg.name}" build completed without creating ${entry}.`)
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn(command, args, {
      cwd: appRoot,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    })

    buildProcess.once('error', reject)
    buildProcess.once('exit', (code, signal) => {
      if (code === 0)
        resolve()
      else
        reject(new Error(`Command "${command} ${args.join(' ')}" failed${signal ? ` with ${signal}` : ` with exit code ${code ?? 1}`}.`))
    })
  })
}

function linkLocalPackages() {
  readOrCreateLinkState()
  for (const pkg of packages)
    replaceLink(packageLinkPath(pkg), pkg.directory)

  console.log('Configurator uses local Endge packages for this development process.')
}

function readOrCreateLinkState() {
  if (existsSync(statePath))
    return

  const state = {
    links: Object.fromEntries(packages.map((pkg) => {
      const linkPath = packageLinkPath(pkg)
      if (!existsSync(linkPath) || !lstatSync(linkPath).isSymbolicLink()) {
        throw new Error(`Expected pnpm symlink for "${pkg.name}" at ${linkPath}. Run "pnpm install" first.`)
      }

      if (realpathSync(linkPath) === realpathSync(pkg.directory)) {
        throw new Error(`"${pkg.name}" is already linked locally, but its restore state is missing.`)
      }

      return [pkg.name, readlinkSync(linkPath)]
    })),
  }

  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
}

function restorePackageLinks() {
  if (!existsSync(statePath))
    return

  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  for (const [name, target] of Object.entries(state.links ?? {})) {
    if (typeof target !== 'string' || !target) {
      throw new Error(`Restore target for "${name}" is missing in ${statePath}.`)
    }
    replaceLink(packageLinkPath(name), target)
  }
  unlinkSync(statePath)
  console.log('Configurator restored registry Endge packages.')
}

function packageLinkPath(pkg) {
  const name = typeof pkg === 'string' ? pkg : pkg.name
  return join(appRoot, 'node_modules', ...name.split('/'))
}

function replaceLink(linkPath, target) {
  if (!existsSync(linkPath) || !lstatSync(linkPath).isSymbolicLink()) {
    throw new Error(`Refusing to replace non-symlink path: ${linkPath}`)
  }

  unlinkSync(linkPath)
  symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
}
