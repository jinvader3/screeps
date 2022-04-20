const { Graph } = require('./graph.js');
const { _ } = require('./lodash-core');
const { GreedySolver } = require('./graph.greedy.js');
const { DinicSolver } = require('./graph.dinic.js');
const { Image } = require('./graph.image.js');

class Room {
  constructor (w, h) {
    this.passable = [];
    this.w = w;
    this.h = h;

    for (let x = 0; x < w * h; ++x) {
      this.passable[x] = true;
    }
  }

  set (x, y, passable) {
    if (y >= this.h || x >= this.w || x < 0 || y < 0) {
      throw new Error('Coordinate Out Of Bounds');
    }

    const i = x + y * this.w;
    this.passable[i] = passable;
  }

  get (x, y) {
    if (y >= this.h || x >= this.w || x < 0 || y < 0) {
      return false;
    }

    const i = x + y * this.w;

    return this.passable[i];
  }

  valid (x, y) {
    if (y >= this.h || x >= this.w || x < 0 || y < 0) {
      return false;
    }
    
    return this.get(x, y);
  }

  get_exit_tiles () {
    const exits = [];

    for (let x = 0; x < 50; ++x) {
      if (this.valid(x, 0)) {
        exits.push([x, 0]);
      }
      if (this.valid(x, 49)) {
        exits.push([x, 49]);
      }
    }

    for (let y = 1; y < 49; ++y) {
      if (this.valid(0, y)) {
        exits.push([0, y]);
      }
      if (this.valid(49, y)) {
        exits.push([49, y]);
      }
    }

    return exits;
  }

  build_exit_vector_graph (sx, sy) {
    const evm = this.build_exit_vector_image(sx, sy);
    const g = new Graph();

    const moves = [
      [1, 0],   // 0
      [1, -1],  // 1
      [1, 1],   // 2
      [-1, 0],  // 3
      [-1, -1], // 4
      [-1, 1],  // 5
      [0, 1],   // 6
      [0, -1],  // 7
    ];
    
    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        const i = x + y * 50;
        if (evm[i] === -1) {
          continue;
        }
        const move = moves[evm[i]];
        const nx = x + move[0];
        const ny = y + move[1];
        const ni = nx + ny * 50;
        g.add_edge(`${x}:${y}`, `${nx}:${ny}`, 1);
      }
    }

    return g;
  }

  build_room_matrix () {
    let i = Image.zeros(50, 50);
    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        i.set(x, y, this.get(x, y) ? 1 : 0);
      }
    }
    return i; 
  }

  build_exit_vector_image (sx, sy) {
    const q = [];

    const moves = [
      [1, 0],   // 0
      [1, -1],  // 1
      [1, 1],   // 2
      [-1, 0],  // 3
      [-1, -1], // 4
      [-1, 1],  // 5
      [0, 1],   // 6
      [0, -1],  // 7
    ];

    if (!this.valid(sx, sy)) {
      throw new Error('The source is unreachable in the room.');
    }

    const vm = [];

    for (let x = 0; x < 50 * 50; ++x) {
      vm.push(-1);
    }

    let exits = this.get_exit_tiles();
    for (let exit of exits) { 
      vm[exit[0] + exit[1] * 50] = 0;
      q.unshift([exit[0], exit[1], 0]);
    }

    console.log(`got ${exits.length} exit tiles`);

    while (q.length > 0) {
      const cnode = q.pop();
      for (let move of moves) {
        const nx = cnode[0] + move[0];
        const ny = cnode[1] + move[1];
        const ni = nx + ny * 50;
        const nm = cnode[2];

        if (!this.valid(nx, ny)) {
          continue;
        }

        if ((vm[ni] === -1) || (vm[ni] > nm + 1)) {
          vm[ni] = nm + 1;
          q.unshift([nx, ny, nm + 1]);
        }
      }
    }

    let _nvm = [];

    for (let x = 0; x < 50 * 50; ++x) {
      _nvm.push(-1);
    }

    for (let y = 0; y < 50; ++y) {
      let line = [];
      for (let x = 0; x < 50; ++x) {
        if (vm[x + y * 50] !== -1) {
          let least = Number.MAX_VALUE;
          let least_dir = null;   
          for (let mi in moves) {
            const move = moves[mi];
            const nx = x + move[0];
            const ny = y + move[1];
            const ni = nx + ny * 50;
            const nv = vm[ni];
            if (nv > -1 && nv < least) {
              least = nv;
              least_dir = mi;
            }
          }
          _nvm[x + y * 50] = least_dir;
        } else {
          _nvm[x + y * 50] = -1;
        }

        let s = new String(_nvm[x + y * 50]);
        while (s.length < 3) {
          s = ' ' + s;
        }
        //let s = this.get(x, y) === true ? ' ' : 'X';
        line.push(s);
      }
      line = line.join('');
      console.log(line);
    }

    return _nvm;
  }

  build_graph () {
    const g = new Graph();

    const moves = [
      [1, 0], [1, -1], [1, 1],
      [-1, 0], [-1, -1], [-1, 1],
      [0, 1], [0, -1],
    ];

    for (let y = 0; y < this.h; ++y) {
      for (let x = 0; x < this.w; ++x) {
        const ka = `${x}:${y}`;
        for (let move of moves) {
          const nx = x + move[0];
          const ny = y + move[1];
          if (!this.valid(nx, ny)) {
            continue;
          }
          const kb = `${nx}:${ny}`;
          g.add_edge(ka, kb, 1);
        }
      }    
    }

    return g;
  }
}

let g;

const fs = require('fs');
const { StringDecoder } = require('string_decoder');
const room = new Room(50, 50);
const data = fs.readFileSync('./shard3_e1s3.json');
const decoder = new StringDecoder('utf8');
const data_utf8 = decoder.write(data);
const data_json = JSON.parse(data_utf8);

for (let y = 0; y < 50; ++y) {
  for (let x = 0; x < 50; ++x) {
    room.set(x, y, true);
  }
}

for (let item of data_json.terrain) {
  const x = item.x;
  const y = item.y;
  const typ = item.type;

  if (typ === 'wall') {
    room.set(x, y, false);
  }
}

for (let y = 0; y < 50; ++y) {
  const line = [];
  for (let x = 0; x < 50; ++x) {
    line.push(room.get(x, y) ? ' ' : 'W');
  }
  console.log(line.join(''));
}

const planner = new Planner();
// sources
planner.add_reqspot(11, 10, 2);
planner.add_reqspot(15, 6, 2);
// controller
planner.add_reqspot(10, 30, 2);
// mineral
planner.add_reqspot(27, 34, 2);
planner.plan(room);

