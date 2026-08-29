#!/usr/bin/env node
// MuseFlow 单实例 Vite 管理 — 仅对当前工程的 5202 端口负责，禁止 killall/pkill
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PID_FILE = resolve(ROOT, '.museflow-vite.pid')
const PORT = 5202
const HOST = '127.0.0.1'

function isPidAlive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

function readOldPid() {
  if (!existsSync(PID_FILE)) return null
  const raw = readFileSync(PID_FILE, 'utf8').trim()
  const pid = Number(raw)
  if (!Number.isFinite(pid) || pid <= 0) return null
  return pid
}

function cleanup() {
  try {
    if (existsSync(PID_FILE) && Number(readFileSync(PID_FILE, 'utf8').trim()) === process.pid) {
      unlinkSync(PID_FILE)
    } else if (existsSync(PID_FILE)) {
      // 子进程 PID 场景：若文件内是子进程 PID 且已退出，清理
      const pid = Number(readFileSync(PID_FILE, 'utf8').trim())
      if (!isPidAlive(pid)) unlinkSync(PID_FILE)
    }
  } catch {}
}

async function killOldIfValid() {
  const oldPid = readOldPid()
  if (oldPid === null || oldPid === process.pid) return
  if (!isPidAlive(oldPid)) {
    try { unlinkSync(PID_FILE) } catch {}
    return
  }
  // 校验是否为本工程的 node/vite 进程（避免误杀）
  try {
    const comm = execSync(`ps -p ${oldPid} -o comm= 2>/dev/null || true`, { encoding: 'utf8' }).trim().toLowerCase()
    if (!comm.includes('node')) {
      try { unlinkSync(PID_FILE) } catch {}
      return
    }
  } catch {
    // ps 失败则保守不杀，仅清理文件
    return
  }
  // 校验端口归属：旧 PID 必须正在监听 5202
  try {
    const lsof = execSync(`lsof -ti TCP:${PORT} 2>/dev/null || true`, { encoding: 'utf8' }).trim()
    const pids = lsof.split(/\s+/).map(Number).filter(Boolean)
    if (!pids.includes(oldPid)) {
      try { unlinkSync(PID_FILE) } catch {}
      return
    }
  } catch {
    // lsof 不可用时，仅按 PID 存活判断
  }
  console.log(`[dev-server] 发现旧实例 PID ${oldPid}（:${PORT}），发送 SIGTERM…`)
  try { process.kill(oldPid, 'SIGTERM') } catch {}
  for (let i = 0; i < 25; i++) {
    if (!isPidAlive(oldPid)) break
    await new Promise(r => setTimeout(r, 200))
  }
  if (isPidAlive(oldPid)) {
    console.warn(`[dev-server] 旧实例 PID ${oldPid} 未退出，请手动 kill ${oldPid}`)
  } else {
    console.log(`[dev-server] 旧实例已退出`)
    try { if (readOldPid() === oldPid) unlinkSync(PID_FILE) } catch {}
  }
}

async function main() {
  await killOldIfValid()

  writeFileSync(PID_FILE, String(process.pid), 'utf8')

  const child = spawn('npx', ['vite', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })

  try { writeFileSync(PID_FILE, String(child.pid), 'utf8') } catch {}

  const forward = (sig) => {
    console.log(`[dev-server] 收到 ${sig}，转发至 Vite ${child.pid}…`)
    try { child.kill(sig) } catch {}
  }
  process.on('SIGINT', () => forward('SIGINT'))
  process.on('SIGTERM', () => forward('SIGTERM'))
  child.on('exit', (code, sig) => {
    console.log(`[dev-server] Vite 退出 code=${code} sig=${sig}`)
    cleanup()
    // 清理子进程 PID 文件（若仍指向该子进程）
    try {
      if (existsSync(PID_FILE) && Number(readFileSync(PID_FILE, 'utf8').trim()) === child.pid) {
        unlinkSync(PID_FILE)
      }
    } catch {}
    process.exit(code ?? 0)
  })
  child.on('error', (err) => {
    console.error(`[dev-server] 启动失败: ${err.message}`)
    cleanup()
    process.exit(1)
  })
  process.on('exit', cleanup)
}

main().catch(err => {
  console.error(err)
  cleanup()
  process.exit(1)
})
