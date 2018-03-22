const canvas = document.getElementById('stage')
, stage = canvas.getContext('2d')
, stageW = 800
, stageH = 500
, state = {}
, tileW = 20
, AXS_HORIZONTAL = 'h'
, AXS_VERTICAL = 'v'
, T_EMPTY = 'empty'
, T_FLOOR = 'floor'
, T_WALL = 'wall'
, T_CDOOR = 'closed_door'
, T_ODOOR = 'opened_door'

canvas.width = stageW
canvas.height = stageH

const clr = () => {
    stage.fillStyle = 'black'
    stage.fillRect(0, 0, stageW, stageH)
}

const always = v => () => v

const range = (max, v) => Array.from({length: max}, always(v))

const randBetween = (min, max) => Math.random() * (max - min) + min

const randRange = (min, max) => {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
}

const choose = xs => xs.length > 0
      ? xs[randRange(0, xs.length)]
      : null


const chooseAxis = rect =>
      rect.w > rect.h
      ? AXS_VERTICAL
      : rect.w === rect.h
      ? choose([AXS_VERTICAL, AXS_HORIZONTAL])
      : AXS_HORIZONTAL

const TileMap = (w, h, tile=T_EMPTY) => ({
    w, h,
    tiles: range(w * h, tile)
})

const setTile = (tileMap, x, y, tile) => {
    const {w} = tileMap
    tileMap.tiles[y * w + x] = tile
}

const getTile = (tileMap, x, y) => {
    const {w} = tileMap
    return tileMap.tiles[y * w + x]
}

const Rect = (x, y, w, h) => ({
    x, y, w, h
})

const Leaf = rect => ({rect})
const Node = (left, right) => ({left, right})

const split = (axis, ratio, rect) => {
    const {x, y, w, h} = rect
    let amt
    if (axis === AXS_HORIZONTAL) {
        amt = Math.floor(h * ratio)
        return [
            Rect(x, y, w, amt),
            Rect(x, (y + amt), w, (h - amt))
        ]
    } else if (axis === AXS_VERTICAL) {
        amt = Math.floor(w * ratio)
        return [
            Rect(x, y, amt, h),
            Rect((x + amt), y, (w - amt), h)
        ]
    }
    throw new InvalidArgumentError(`${axis} is not a valid axis`)
}

const makeBSP = (rect, depth, cb) => {
    if (depth === 0) return Leaf(rect)

    const [axis, ratio] = cb(rect, depth)
    , [r1, r2] = split(axis, ratio, rect)

    return Node(makeBSP(r1, (depth - 1), cb),
                makeBSP(r2, (depth - 1), cb))
}

const listRects = tree => {
    if (tree.hasOwnProperty('rect')) return [tree.rect]
    return Array.concat(listRects(tree.left), listRects(tree.right))
}

const drawRoom = (tileMap, rect) => {
    const {x: nx, y: ny, w: nw, h: nh} = rect
    for (let j = ny; j < ny + nh; j++) {
        for (let i = nx; i < nx + nw; i++) {
            if (j === ny || j === (ny + nh) - 1) {
                setTile(tileMap, i, j, T_WALL)
                continue;
            }
            if (i === nx || i === (nx + nw) - 1) {
                setTile(tileMap, i, j, T_WALL)
                continue;
            }
            setTile(tileMap, i, j, T_FLOOR)
        }
    }
}

const digTunnel = (tileMap, x1, y1, x2, y2) => {
    const hDir =
          x1 > x2
          ? -1
          : x1 < x2
          ? 1
          : 0
    , vDir =
          y1 > y2
          ? -1
          : y1 < y2
          ? 1
          : 0
    let t;
    for (let y = y1; y !== y2 + vDir; y += vDir) {
        t = getTile(tileMap, x1, y)
        if (t === T_EMPTY)
            setTile(tileMap, x1, y, T_FLOOR)
        if (t === T_WALL)
            setTile(tileMap, x1, y, T_CDOOR)
    }
    for (let x = x1; x !== x2 + hDir; x += hDir) {
        t = getTile(tileMap, x, y1)
        if (t === T_EMPTY)
            setTile(tileMap, x, y1, T_FLOOR)
        if (t === T_WALL)
            setTile(tileMap, x, y1, T_CDOOR)
    }
}

const getFloorTiles = tileMap => {
    const floorTiles = []
    for (let j = 0; j < tileMap.h; j++) {
        for (let i = 0; i < tileMap.w; i++) {
            if (getTile(tileMap, i, j) === T_FLOOR)
                floorTiles.push([i, j])
        }
    }
    return floorTiles
}

const setPlayerStart = tileMap => {
    const {player} = state
    , floorTiles = getFloorTiles(tileMap)
    const [startX, startY] = choose(floorTiles)
    player.x = startX
    player.y = startY
}

const setStairs = tileMap => {
    const {player} = state
    const floorTiles = getFloorTiles(tileMap)
    let n = 100
    while (n) {
        const [x, y] = choose(floorTiles)
        if (player.x !== x && player.y !== y) {
            tileMap.exit = {x, y}
        }
        n--
    }
}

const generateLevel = (width, height, depth) => {
    const initRect = Rect(0, 0, width, height)
    , tileMap = TileMap(width, height)
    , bspTree = makeBSP(initRect, depth, rect => {
        return [chooseAxis(rect),
                randBetween(0.3, 0.7)]
    })
    , rects = listRects(bspTree)
    rects.forEach((r, i) => {
        const {x, y, w, h} = r
        , nx = x + 1
        , ny = y + 1
        , nw = w - randRange(1, 4)
        , nh = h - randRange(1, 4)
        if (nw <= 2)
            return;
        if (nh <= 2)
            return;
        const nr = rects[(i + 1) % rects.length]
        drawRoom(tileMap, Rect(nx, ny, nw, nh))
        digTunnel(tileMap,
                  nx + Math.floor(nw / 2),
                  ny + Math.floor(nh / 2),
                  nr.x + Math.ceil(nr.w / 2),
                  nr.y + Math.ceil(nr.h / 2))
    })
    setPlayerStart(tileMap)
    setStairs(tileMap)
    return tileMap
}

const init = () => {
    Object.assign(state, {
        player: {
            x: 0, y: 0
        }
    })
    Object.assign(state, {
        levelMap: generateLevel(32, 25, 3)
    })
}

const update = dt => {}

const render = () => {
    clr()
    const {levelMap, player} = state
    // render map
    for (let j = 0; j < levelMap.h; j++) {
        for (let i = 0; i < levelMap.w; i++) {
            switch(getTile(levelMap, i, j)) {
            case T_EMPTY:
                stage.fillStyle = 'black'
                break;
            case T_FLOOR:
                stage.fillStyle = 'lightgrey'
                break;
            case T_WALL:
                stage.fillStyle = 'grey'
                break;
            case T_CDOOR:
                stage.fillStyle = 'brown'
                break;
            case T_ODOOR:
                stage.fillStyle = 'orange'
                break;
            default:
                stage.fillStyle = 'black'
            }
            stage.fillRect(i * tileW, j * tileW, tileW, tileW)
            if (levelMap.exit.x === i && levelMap.exit.y === j) {
                stage.fillStyle = 'green'
                stage.fillRect(i * tileW, j * tileW, tileW, tileW)
            }
            if (player.x === i && player.y === j) {
                stage.fillStyle = 'yellow'
                stage.fillRect(player.x * tileW, player.y * tileW,
                               tileW, tileW)
            }
        }
    }
}

const loop = dt => {
    update(dt)
    render()
    window.requestAnimationFrame(loop)
}

const movePlayer = (dx, dy) => {
    const {levelMap, player} = state
    , {x, y} = player
    , newX = x + dx
    , newY = y + dy
    , t = getTile(levelMap, newX, newY)
    if (t === T_WALL || t === T_EMPTY) return;
    if (t === T_CDOOR) {
        setTile(levelMap, newX, newY, T_ODOOR)
        return
    }
    console.log(levelMap.exit)
    console.log(newX, newY)
    if (newX === levelMap.exit.x &&
        newY === levelMap.exit.y) {
        Object.assign(state, {
            levelMap: generateLevel(32, 25, 3)
        })
        return;
    }
    player.x = newX, player.y = newY
}

document.addEventListener('keydown', ev => {
    const {player} = state
    if (ev.key === 'j') {
        movePlayer(0, 1)
    } else if (ev.key === 'k') {
        movePlayer(0, -1)
    } else if (ev.key === 'h') {
        movePlayer(-1, 0)
    } else if (ev.key === 'l') {
        movePlayer(1, 0)
    } else if (ev.key === 'y') {
        movePlayer(-1, -1)
    } else if (ev.key === 'u') {
        movePlayer(1, -1)
    } else if (ev.key === 'n') {
        movePlayer(-1, 1)
    } else if (ev.key === 'm') {
        movePlayer(1, 1)
    }
})

init()
window.requestAnimationFrame(loop)
