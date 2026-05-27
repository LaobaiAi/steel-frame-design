import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const BACKEND_SCRIPT = path.join(ROOT_DIR, 'servers', 'web_api_server.py')

function autoStartBackend(): Plugin {
  let backend: ChildProcess | null = null
  let restartCount = 0
  const MAX_RESTART = 3

  const startBackend = (): void => {
    if (backend) {
      try { backend.kill('SIGTERM') } catch { /* already dead */ }
    }

    console.log('[auto-backend] 正在启动后端...')
    backend = spawn('python', [BACKEND_SCRIPT], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      shell: true,
    })

    backend.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.log(`[backend] ${text}`)
    })

    backend.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.log(`[backend] ${text}`)
    })

    backend.on('exit', (code: number | null) => {
      backend = null
      if (code === 0 || code === null) return
      restartCount++
      if (restartCount > MAX_RESTART) {
        console.log(`[auto-backend] 后端已崩溃 ${MAX_RESTART} 次，停止自动重启`)
        return
      }
      console.log(`[auto-backend] 后端异常退出 (code=${code})，${3}秒后第${restartCount}次重启...`)
      setTimeout(startBackend, 3000)
    })

    backend.on('error', (err: Error) => {
      console.log(`[auto-backend] 启动后端失败: ${err.message}`)
      backend = null
    })
  }

  return {
    name: 'auto-start-backend',
    configureServer(server) {
      startBackend()

      server.httpServer?.once('close', () => {
        restartCount = MAX_RESTART + 1 // 禁止自动重启
        if (backend) {
          console.log('[auto-backend] Vite 关闭，停止后端')
          try { backend.kill('SIGTERM') } catch { /* ok */ }
          backend = null
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), autoStartBackend()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/output': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
