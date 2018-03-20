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

const generateLevel = (width, height, depth) => {
    const initRect = Rect(0, 0, width, height)
    , tileMap = TileMap(width, height)
    , bspTree = makeBSP(initRect, depth, rect => {
        return [chooseAxis(rect),
                randBetween(0.3, 0.7)]
    })
    , rects = listRects(bspTree)
    rects.forEach(r => {
        const {x, y, w, h} = r
        , nx = x + 1
        , ny = y + 1
        , nw = w - randRange(1, 4)
        , nh = h - randRange(1, 4)
        if (nw <= 2)
            return;
        if (nh <= 2)
            return;
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
    })
    return tileMap
}

const init = () => Object.assign(state, {
    levelMap: generateLevel(35, 25, 3)
})

const update = dt => {}

const render = () => {
    clr()
    const {levelMap} = state
    // render map
    for (let j = 0; j < levelMap.h; j++) {
        for (let i = 0; i < levelMap.w; i++) {
            switch(getTile(levelMap, i, j)) {
            case T_EMPTY:
                stage.fillStyle = 'purple'
                break;
            case T_FLOOR:
                stage.fillStyle = 'lightgrey'
                break;
            case T_WALL:
                stage.fillStyle = 'grey'
                break;
            default:
                stage.fillStyle = 'pink'
            }
            stage.fillRect(i * tileW, j * tileW, tileW, tileW)
        }
    }
}

const loop = dt => {
    update(dt)
    render()
    window.requestAnimationFrame(loop)
}

init()
window.requestAnimationFrame(loop)
