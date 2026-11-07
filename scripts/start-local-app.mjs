import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nextCli = resolve(projectRoot, 'node_modules/next/dist/bin/next')
const child = spawn(
  process.execPath,
  [nextCli, 'dev', '--hostname', 'localhost', ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
    },
  },
)

child.on('error', (error) => {
  console.error('Unable to start the local Next.js server.', error)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
