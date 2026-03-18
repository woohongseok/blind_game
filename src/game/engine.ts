import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  PlaneGeometry,
  DirectionalLight,
  AmbientLight,
  Vector3,
  Raycaster,
  BufferGeometry,
  LineBasicMaterial,
  Line,
  AudioListener,
  PositionalAudio,
  AudioLoader,
} from 'three'
import { generateMaze } from './maze'
import growlUrl from '@assets/sounds/monster-growl.ogg'
import roarUrl from '@assets/sounds/monster-roars-snarls.ogg'

function collides(
  px: number, pz: number, r: number,
  walls: { x: number; z: number; hw: number; hd: number }[],
) {
  for (const w of walls) {
    if (
      px + r > w.x - w.hw && px - r < w.x + w.hw &&
      pz + r > w.z - w.hd && pz - r < w.z + w.hd
    ) return true
  }
  return false
}

export function createGame(
  canvas: HTMLCanvasElement,
  onPointerLockChange?: (locked: boolean) => void,
  onStaminaChange?: (ratio: number) => void,
  onLivesChange?: (lives: number) => void,
) {
  const scene = new Scene()
  const camera = new PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000)
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)

  // lights
  scene.add(new AmbientLight(0x404040, 2))
  const dirLight = new DirectionalLight(0xffffff, 3)
  dirLight.position.set(5, 10, 5)
  scene.add(dirLight)

  // maze
  const maze = generateMaze(15, 15, 4)
  scene.add(maze.mesh)

  // ground
  const ground = new Mesh(
    new PlaneGeometry(maze.width + 4, maze.depth + 4),
    new MeshStandardMaterial({ color: 0x2a6e3f }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // goal marker
  const goal = new Mesh(
    new BoxGeometry(1.5, 0.2, 1.5),
    new MeshStandardMaterial({ color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 0.5 }),
  )
  goal.position.set(maze.goal.x, 0.1, maze.goal.z)
  scene.add(goal)

  // player
  const player = new Mesh(
    new BoxGeometry(0.8, 1.8, 0.8),
    new MeshStandardMaterial({ color: 0x4488ff }),
  )
  player.position.set(maze.start.x, 0.9, maze.start.z)
  scene.add(player)

  // monster
  const monster = new Mesh(
    new BoxGeometry(0.9, 2, 0.9),
    new MeshStandardMaterial({ color: 0x8b0000 }),
  )
  monster.position.set(maze.goal.x, 1, maze.goal.z)
  scene.add(monster)

  // spatial audio
  const listener = new AudioListener()
  camera.add(listener)

  const growlSound = new PositionalAudio(listener)
  growlSound.setRefDistance(5)
  monster.add(growlSound)

  const chaseSound = new PositionalAudio(listener)
  chaseSound.setRefDistance(5)
  monster.add(chaseSound)

  const goalSound = new PositionalAudio(listener)
  goalSound.setRefDistance(8)
  goal.add(goalSound)

  const audioLoader = new AudioLoader()
  audioLoader.load(growlUrl, (buf) => {
    growlSound.setBuffer(buf)
    growlSound.setLoop(true)
    growlSound.play()
  })
  audioLoader.load(roarUrl, (buf) => {
    chaseSound.setBuffer(buf)
    chaseSound.setLoop(true)
  })

  // spawn helpers
  const cellCenters: { x: number; z: number }[] = []
  const ox = -maze.width / 2
  const oz = -maze.depth / 2
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      cellCenters.push({ x: ox + c * 4 + 2, z: oz + r * 4 + 2 })
    }
  }

  function randomCellAwayFrom(pos: Vector3, minDist: number) {
    const far = cellCenters.filter(c => Math.hypot(c.x - pos.x, c.z - pos.z) > minDist)
    const pool = far.length ? far : cellCenters
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // pathfinding helpers
  function toCell(x: number, z: number): [number, number] {
    return [
      Math.max(0, Math.min(14, Math.floor((z - oz) / 4))),
      Math.max(0, Math.min(14, Math.floor((x - ox) / 4))),
    ]
  }

  function bfsNextStep(fromX: number, fromZ: number, toX: number, toZ: number) {
    const [sr, sc] = toCell(fromX, fromZ)
    const [er, ec] = toCell(toX, toZ)
    if (sr === er && sc === ec) return null

    const visited: boolean[][] = Array.from({ length: 15 }, () => Array(15).fill(false))
    const parent: ([number, number] | null)[][] = Array.from({ length: 15 }, () => Array(15).fill(null))
    const queue: [number, number][] = [[sr, sc]]
    visited[sr][sc] = true
    const nbrs: [number, number, number][] = [[1, -1, 0], [2, 1, 0], [4, 0, 1], [8, 0, -1]]

    while (queue.length) {
      const [r, c] = queue.shift()!
      if (r === er && c === ec) break
      for (const [flag, dr, dc] of nbrs) {
        if (!(maze.grid[r][c] & flag)) continue
        const nr = r + dr, nc = c + dc
        if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15 || visited[nr][nc]) continue
        visited[nr][nc] = true
        parent[nr][nc] = [r, c]
        queue.push([nr, nc])
      }
    }

    if (!visited[er][ec]) return null
    let cur: [number, number] = [er, ec]
    while (parent[cur[0]][cur[1]]) {
      const p = parent[cur[0]][cur[1]]!
      if (p[0] === sr && p[1] === sc) break
      cur = p
    }
    return { x: ox + cur[1] * 4 + 2, z: oz + cur[0] * 4 + 2 }
  }

  function canCatch(mx: number, mz: number, px: number, pz: number) {
    const [mr, mc] = toCell(mx, mz)
    const [pr, pc] = toCell(px, pz)
    if (mr === pr && mc === pc) return true
    const dr = pr - mr, dc = pc - mc
    if (Math.abs(dr) + Math.abs(dc) !== 1) return false
    if (dr === -1) return !!(maze.grid[mr][mc] & 1)
    if (dr === 1) return !!(maze.grid[mr][mc] & 2)
    if (dc === 1) return !!(maze.grid[mr][mc] & 4)
    if (dc === -1) return !!(maze.grid[mr][mc] & 8)
    return false
  }

  // lives
  const monsterSpeed = 2
  const monsterRadius = 0.45
  const catchDistance = 1.5
  const detectRange = 20
  let monsterState: 'patrol' | 'chase' = 'patrol'
  let patrolTarget: { x: number; z: number } | null = null
  let lives = 3
  let invincibleUntil = 0
  let gameOver = false

  // camera state
  let cameraYaw = 0
  let cameraPitch = 0.4
  const cameraDistance = 8

  // input state
  const keys: Record<string, boolean> = {}

  const onKeyDown = (e: KeyboardEvent) => {
    keys[e.code] = true
    if (e.code === 'Space') fireLaser()
  }
  const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false }

  let isPointerLocked = false
  const onMouseMove = (e: MouseEvent) => {
    if (!isPointerLocked) return
    cameraYaw -= e.movementX * 0.003
    cameraPitch = Math.max(-0.3, Math.min(1.2, cameraPitch + e.movementY * 0.003))
  }

  const onClick = () => {
    canvas.requestPointerLock()
    if (listener.context.state === 'suspended') listener.context.resume()
  }

  const onLockChange = () => {
    isPointerLocked = document.pointerLockElement === canvas
    onPointerLockChange?.(isPointerLocked)
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('click', onClick)
  document.addEventListener('pointerlockchange', onLockChange)

  const onResize = () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  }
  window.addEventListener('resize', onResize)

  const walkSpeed = 6
  const sprintSpeed = 12
  const arrowSpeed = 2
  const maxStamina = 100
  const staminaDrain = 30
  const staminaRegen = 20
  const playerRadius = 0.4
  let stamina = maxStamina
  let sprintLockedUntil = 0
  let lastTime = performance.now()
  let animId = 0

  // wall bump sound
  let bumpBuffer: AudioBuffer | null = null
  function getBumpBuffer() {
    if (bumpBuffer) return bumpBuffer
    const ctx = listener.context
    const len = Math.floor(ctx.sampleRate * 0.1)
    bumpBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = bumpBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate
      data[i] = Math.sin(2 * Math.PI * 150 * t) * 0.5 * (1 - t / 0.1)
    }
    return bumpBuffer
  }
  let lastBumpTime = 0

  function playBump() {
    const ctx = listener.context
    const source = ctx.createBufferSource()
    source.buffer = getBumpBuffer()
    source.connect(ctx.destination)
    source.start()
    source.onended = () => source.disconnect()
  }

  // jumpscare sound — sudden harsh noise burst
  let jumpscareBuffer: AudioBuffer | null = null
  function getJumpscareBuffer() {
    if (jumpscareBuffer) return jumpscareBuffer
    const ctx = listener.context
    const len = Math.floor(ctx.sampleRate * 0.4)
    jumpscareBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = jumpscareBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate
      const decay = 1 - t / 0.4
      const noise = Math.random() * 2 - 1
      const tone = Math.sin(2 * Math.PI * 180 * t) + Math.sin(2 * Math.PI * 311 * t)
      data[i] = (noise * 0.5 + tone * 0.5) * decay
    }
    return jumpscareBuffer
  }

  function playJumpscare() {
    const ctx = listener.context
    const source = ctx.createBufferSource()
    source.buffer = getJumpscareBuffer()
    const gain = ctx.createGain()
    gain.gain.value = 1.0
    source.connect(gain).connect(ctx.destination)
    source.start()
    source.onended = () => { source.disconnect(); gain.disconnect() }
  }

  // goal beacon — periodic ping from exit
  let beaconBuffer: AudioBuffer | null = null
  function getBeaconBuffer() {
    if (beaconBuffer) return beaconBuffer
    const ctx = listener.context
    const len = Math.floor(ctx.sampleRate * 0.12)
    beaconBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = beaconBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate
      data[i] = Math.sin(2 * Math.PI * 1200 * t) * 0.6 * (1 - t / 0.12)
    }
    return beaconBuffer
  }
  let lastBeaconTime = 0
  const beaconInterval = 3000

  // sonar (10-ray fan, -45° to +45°)
  const raycaster = new Raycaster()
  raycaster.far = 100
  const laserSpeed = 40
  const rayCount = 10
  const fanAngle = Math.PI / 2 // 90°
  const rayDelay = 60 // ms between each ray

  let beepBuffer: AudioBuffer | null = null
  function getBeepBuffer() {
    if (beepBuffer) return beepBuffer
    const ctx = listener.context
    const len = Math.floor(ctx.sampleRate * 0.15)
    beepBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = beepBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = Math.sin(2 * Math.PI * 800 * i / ctx.sampleRate) > 0 ? 0.3 : -0.3
    }
    return beepBuffer
  }

  function playBeepAt(point: Vector3) {
    const ctx = listener.context
    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 8
    panner.positionX.value = point.x
    panner.positionY.value = point.y
    panner.positionZ.value = point.z
    const source = ctx.createBufferSource()
    source.buffer = getBeepBuffer()
    source.connect(panner).connect(ctx.destination)
    source.start()
    source.onended = () => { source.disconnect(); panner.disconnect() }
  }

  let rays: { origin: Vector3; dir: Vector3; hitDist: number; hitPoint: Vector3 | null; start: number; beeped: boolean }[] = []
  let rayLines: (Line | null)[] = []

  function fireLaser() {
    if (listener.context.state === 'suspended') listener.context.resume()

    for (const line of rayLines) { if (line) { scene.remove(line); line.geometry.dispose() } }
    rayLines = []
    rays = []

    const origin = new Vector3(player.position.x, 1, player.position.z)
    const startTime = performance.now()

    for (let i = 0; i < rayCount; i++) {
      const angle = cameraYaw + fanAngle / 2 - (fanAngle / (rayCount - 1)) * i
      const dir = new Vector3(-Math.sin(angle), 0, -Math.cos(angle))
      raycaster.set(origin.clone(), dir)
      const hits = raycaster.intersectObjects(maze.mesh.children)
      rays.push({
        origin: origin.clone(), dir,
        hitDist: hits.length > 0 ? hits[0].distance : -1,
        hitPoint: hits.length > 0 ? hits[0].point : null,
        start: startTime + i * rayDelay, beeped: false,
      })
      rayLines.push(null)
    }
  }

  function loop() {
    const now = performance.now()
    const dt = (now - lastTime) / 1000
    lastTime = now

    // arrow key camera rotation
    if (keys['ArrowLeft']) cameraYaw += arrowSpeed * dt
    if (keys['ArrowRight']) cameraYaw -= arrowSpeed * dt
    if (keys['ArrowUp']) cameraPitch = Math.max(-0.3, cameraPitch - arrowSpeed * dt)
    if (keys['ArrowDown']) cameraPitch = Math.min(1.2, cameraPitch + arrowSpeed * dt)

    // WASD movement relative to camera direction
    const forward = new Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw))
    const right = new Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw))
    const move = new Vector3()

    if (keys['KeyW']) move.add(forward)
    if (keys['KeyS']) move.sub(forward)
    if (keys['KeyA']) move.sub(right)
    if (keys['KeyD']) move.add(right)

    const isMoving = move.lengthSq() > 0
    const wantsSprint = isMoving && (keys['ShiftLeft'] || keys['ShiftRight'])
    const sprinting = wantsSprint && stamina > 0 && now > sprintLockedUntil

    if (sprinting) {
      stamina = Math.max(0, stamina - staminaDrain * dt)
      if (stamina <= 0) sprintLockedUntil = now + 3000
    } else {
      stamina = Math.min(maxStamina, stamina + staminaRegen * dt)
    }
    onStaminaChange?.(stamina / maxStamina)

    if (isMoving) {
      move.normalize().multiplyScalar((sprinting ? sprintSpeed : walkSpeed) * dt)

      // axis-separated collision
      const nx = player.position.x + move.x
      const nz = player.position.z + move.z
      const blockedX = collides(nx, player.position.z, playerRadius, maze.walls)
      const blockedZ = collides(player.position.x, nz, playerRadius, maze.walls)
      if (!blockedX) player.position.x = nx
      if (!blockedZ) player.position.z = nz
      if ((blockedX || blockedZ) && now - lastBumpTime > 300) {
        playBump()
        lastBumpTime = now
      }

      player.rotation.y = Math.atan2(move.x, move.z)
    }

    // goal beacon
    if (!gameOver && now - lastBeaconTime > beaconInterval) {
      lastBeaconTime = now
      if (goalSound.isPlaying) goalSound.stop()
      goalSound.setBuffer(getBeaconBuffer())
      goalSound.play()
    }

    // monster AI — BFS pathfinding
    if (!gameOver) {
      const dist = Math.hypot(
        player.position.x - monster.position.x,
        player.position.z - monster.position.z,
      )

      if (now > invincibleUntil && dist < catchDistance
        && canCatch(monster.position.x, monster.position.z, player.position.x, player.position.z)) {
        lives--
        onLivesChange?.(lives)

        if (lives <= 0) {
          gameOver = true
          if (growlSound.isPlaying) growlSound.stop()
          if (chaseSound.isPlaying) chaseSound.stop()
          monsterState = 'patrol'
        } else {
          const pCell = randomCellAwayFrom(monster.position, 20)
          player.position.set(pCell.x, 0.9, pCell.z)
          const mCell = randomCellAwayFrom(player.position, 20)
          monster.position.set(mCell.x, 1, mCell.z)
          invincibleUntil = now + 2000
        }

        playJumpscare()
      } else {
        const newState = dist < detectRange ? 'chase' : 'patrol'
        if (newState !== monsterState) {
          monsterState = newState
          if (newState === 'chase') {
            if (growlSound.isPlaying) growlSound.stop()
            if (!chaseSound.isPlaying && chaseSound.buffer) chaseSound.play()
          } else {
            if (chaseSound.isPlaying) chaseSound.stop()
            if (!growlSound.isPlaying && growlSound.buffer) growlSound.play()
          }
        }

        let tx: number, tz: number

        if (dist < detectRange) {
          // chase player
          patrolTarget = null
          const next = bfsNextStep(
            monster.position.x, monster.position.z,
            player.position.x, player.position.z,
          )
          tx = next ? next.x : player.position.x
          tz = next ? next.z : player.position.z
        } else {
          // random patrol
          if (!patrolTarget || Math.hypot(patrolTarget.x - monster.position.x, patrolTarget.z - monster.position.z) < 1) {
            patrolTarget = cellCenters[Math.floor(Math.random() * cellCenters.length)]
          }
          const next = bfsNextStep(
            monster.position.x, monster.position.z,
            patrolTarget.x, patrolTarget.z,
          )
          tx = next ? next.x : patrolTarget.x
          tz = next ? next.z : patrolTarget.z
        }

        const tdx = tx - monster.position.x
        const tdz = tz - monster.position.z
        const tdist = Math.hypot(tdx, tdz)
        if (tdist > 0.1) {
          const smx = (tdx / tdist) * monsterSpeed * dt
          const smz = (tdz / tdist) * monsterSpeed * dt
          if (!collides(monster.position.x + smx, monster.position.z, monsterRadius, maze.walls)) {
            monster.position.x += smx
          }
          if (!collides(monster.position.x, monster.position.z + smz, monsterRadius, maze.walls)) {
            monster.position.z += smz
          }
          monster.rotation.y = Math.atan2(tdx, tdz)
        }
      }
    }

    // sonar update
    if (rays.length > 0) {
      let allDone = true
      for (let i = 0; i < rays.length; i++) {
        const r = rays[i]
        if (now < r.start) { allDone = false; continue }
        const elapsed = (now - r.start) / 1000
        const traveled = elapsed * laserSpeed
        const maxDist = r.hitDist > 0 ? r.hitDist : 100
        const arrivalTime = maxDist / laserSpeed

        if (traveled >= maxDist && r.hitPoint && !r.beeped) {
          playBeepAt(r.hitPoint)
          r.beeped = true
        }

        const done = elapsed > arrivalTime + (r.hitDist > 0 ? 0.2 : 0)
        if (done) {
          if (rayLines[i]) { scene.remove(rayLines[i]!); rayLines[i]!.geometry.dispose(); rayLines[i] = null }
        } else {
          allDone = false
          const end = r.origin.clone().add(r.dir.clone().multiplyScalar(Math.min(traveled, maxDist)))
          if (!rayLines[i]) {
            rayLines[i] = new Line(
              new BufferGeometry().setFromPoints([r.origin, end]),
              new LineBasicMaterial({ color: 0xff0000 }),
            )
            scene.add(rayLines[i]!)
          } else {
            const pos = rayLines[i]!.geometry.attributes.position
            pos.setXYZ(1, end.x, end.y, end.z)
            pos.needsUpdate = true
          }
        }
      }
      if (allDone) rays = []
    }

    // third-person camera
    camera.position.set(
      player.position.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
      player.position.y + Math.sin(cameraPitch) * cameraDistance,
      player.position.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
    )
    camera.lookAt(player.position.x, player.position.y + 1, player.position.z)

    renderer.render(scene, camera)
    animId = requestAnimationFrame(loop)
  }

  animId = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(animId)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('click', onClick)
    document.removeEventListener('pointerlockchange', onLockChange)
    window.removeEventListener('resize', onResize)
    for (const line of rayLines) { if (line) { scene.remove(line); line.geometry.dispose() } }
    if (growlSound.isPlaying) growlSound.stop()
    if (chaseSound.isPlaying) chaseSound.stop()
    if (goalSound.isPlaying) goalSound.stop()
    renderer.dispose()
  }
}
