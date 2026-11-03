import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nextCli = resolve(projectRoot, 'node_modules/next/dist/bin/next')
const child = spawn(
  process.execPath,
  [nextCli, 'dev', '--hostname', '127.0.0.1', ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIREBASE_PROJECT_ID: 'demo-venturego-local',
      FIREBASE_STORAGE_BUCKET: 'demo-venturego-local.appspot.com',
      FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
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
