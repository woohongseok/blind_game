import {
  Mesh, BoxGeometry, MeshStandardMaterial, Group,
} from 'three'

const S = 2, E = 4

function carve(rows: number, cols: number) {
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))
  const stack: [number, number][] = [[0, 0]]
  visited[0][0] = true

  const dirs = [
    { flag: 1, opp: 2, dr: -1, dc: 0 },
    { flag: 2, opp: 1, dr: 1, dc: 0 },
    { flag: 4, opp: 8, dr: 0, dc: 1 },
    { flag: 8, opp: 4, dr: 0, dc: -1 },
  ]

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1]
    const open = dirs.filter(d => {
      const nr = r + d.dr, nc = c + d.dc
      return nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]
    })

    if (!open.length) { stack.pop(); continue }

    const d = open[Math.floor(Math.random() * open.length)]
    const nr = r + d.dr, nc = c + d.dc
    grid[r][c] |= d.flag
    grid[nr][nc] |= d.opp
    visited[nr][nc] = true
    stack.push([nr, nc])
  }

  return grid
}

export function generateMaze(rows: number, cols: number, cellSize: number) {
  const grid = carve(rows, cols)
  const group = new Group()
  const mat = new MeshStandardMaterial({ color: 0x8b7355 })
  const h = 3, t = 0.3
  const hGeo = new BoxGeometry(cellSize, h, t)
  const vGeo = new BoxGeometry(t, h, cellSize)
  const walls: { x: number; z: number; hw: number; hd: number }[] = []
  const ox = -(cols * cellSize) / 2
  const oz = -(rows * cellSize) / 2

  function addH(cx: number, cz: number) {
    const m = new Mesh(hGeo, mat)
    m.position.set(cx, h / 2, cz)
    group.add(m)
    walls.push({ x: cx, z: cz, hw: cellSize / 2, hd: t / 2 })
  }

  function addV(cx: number, cz: number) {
    const m = new Mesh(vGeo, mat)
    m.position.set(cx, h / 2, cz)
    group.add(m)
    walls.push({ x: cx, z: cz, hw: t / 2, hd: cellSize / 2 })
  }

  // horizontal walls (row boundaries)
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hasWall = r === 0 || r === rows || !(grid[r - 1][c] & S)
      if (hasWall) addH(ox + c * cellSize + cellSize / 2, oz + r * cellSize)
    }
  }

  // vertical walls (column boundaries)
  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r < rows; r++) {
      const hasWall = c === 0 || c === cols || !(grid[r][c - 1] & E)
      if (hasWall) addV(ox + c * cellSize, oz + r * cellSize + cellSize / 2)
    }
  }

  return {
    mesh: group,
    walls,
    grid,
    start: { x: ox + cellSize / 2, z: oz + cellSize / 2 },
    goal: { x: ox + (cols - 0.5) * cellSize, z: oz + (rows - 0.5) * cellSize },
    width: cols * cellSize,
    depth: rows * cellSize,
  }
}
