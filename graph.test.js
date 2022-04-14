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
//
const room = new Room(50, 50);
const data = fs.readFileSync('./e3s1.json');
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

const rimage = room.build_room_matrix();

const parts = require('./parts');

const max_piece_counts = {};

// Just a conversion from letter to numerical used in matrices.
const letter_to_id = {
  e: parts.e,
  s: parts.s,
  l: parts.l,
  t: parts.t,
  w: parts.w,
  o: parts.o,
  p: parts.p,
  x: parts.x,
  m: parts.m,
  a: parts.a,
  n: parts.n,
  f: parts.f,
};

max_piece_counts[parts.e] = 60; // extension
max_piece_counts[parts.s] = 3;  // spawn
max_piece_counts[parts.l] = 1;  // link (special)
max_piece_counts[parts.t] = 1;  // storage
max_piece_counts[parts.w] = 6;  // tower
max_piece_counts[parts.o] = 1;  // observer
max_piece_counts[parts.p] = 1;  // power spawn
max_piece_counts[parts.m] = 1;  // terminal
max_piece_counts[parts.a] = 10; // labs
max_piece_counts[parts.n] = 1;  // nuker
max_piece_counts[parts.f] = 1;  // factory


function count_string_to_piece_counts (cstr) {
  const out = {};
  for (let x = 0; x < cstr.length / 3; ++x) {
    const code = cstr[x*3+0];
    const id = letter_to_id[code];
    const num = parseInt(cstr.substr(x*3+1, 2));
    out[id] = num;
  }
  return out;
}
function add_piece_counts_check_exceeding (a, b, max) {
  let c = {};

  for (let k in a) {
    c[k] = (c[k] || 0) + a[k];
  }

  for (let k in b) {
    c[k] = (c[k] || 0) + b[k];
  }

  for (let k in c) {
    if (max[k] === undefined) {
      throw new Error(`BUG k=${k}`);
    }

    if (c[k] > max[k]) {
      return true;
    }
  }

  return false;
}
function add_counts (a, b) {
  let c = {};

  for (let k in a) {
    c[k] = (c[k] || 0) + a[k];
  }

  for (let k in b) {
    c[k] = (c[k] || 0) + b[k];
  }

  return c;
}
function check_piece_counts_maxed (a, b) {
  for (let k in b) {
    if (a[k] === undefined) {
      return false;
    }

    if (a[k] < b[k]) {
      return false;
    }
    if (a[k] > b[k]) {
      throw new Error('BUG');
    }
  }

  for (let k in a) {
    if (b[k] === undefined) {
      throw new Error('BUG');
    }
  }

  return true;
}

function randomly_select_complete_set_of_parts () {
  let counts = {};

  let to_use_parts = [];
  let tmp = [];

  do {
    // Randomly select parts that do not cause us to exceed our maximum
    // piece counts, but don't stop iterating until we reach the maximum
    // number of each piece type. 
    const rndx = Math.floor(Math.random() * parts.parts.length);
    let spart = parts.parts[rndx];
    const pcounts = count_string_to_piece_counts(spart[0]);

    if (add_piece_counts_check_exceeding(counts, pcounts, max_piece_counts)) {
      // This part has too many pieces to be valid.
      continue;
    }

    if (Math.random() > 0.5) {
      tmp.push(spart[1].rotate_90());
    } else {
      tmp.push(spart[1].clone());
    }

    to_use_parts.push(spart[1]);
    counts = add_counts(counts, pcounts);
  } while (!check_piece_counts_maxed(counts, max_piece_counts));

  console.log(`completed with ${to_use_parts.length} parts`);

  return to_use_parts;
}

function bfs_tile_list (sx, sy, validf) {
  const q = [];
  const l = [];
  const visited = {};
  const moves = [
    [1, 0], [1, -1], [1, 1],
    [-1, 0], [-1, -1], [-1, 1],
    [0, 1], [0, -1],
  ];

  visited[sx + sy * 50] = true;
  q.push([sx, sy]);

  while (q.length > 0) {
    let cn = q.pop();
    for (let move of moves) {
      let nx = cn[0] + move[0];
      let ny = cn[1] + move[1];
      let ni = nx + ny * 50;
      if (visited[ni] === true) {
        continue;
      }
      if (validf(nx, ny)) {
        visited[ni] = true;
        q.unshift([nx, ny]);
        l.unshift([nx, ny]);
      }
    }
  }

  return l;
}

function try_placing_parts_via_tiles (rimage, part_list, tiles) { 
  rimage = rimage.clone();
  let simage = Image.zeros(rimage.w, rimage.h);

  while (tiles.length > 0 && part_list.length > 0) {
    const ctile = tiles.pop();
    const cpart = part_list[0];
    //console.log('ctile', ctile);
    //console.log(cpart.d);
    const v = cpart.valid(rimage, ctile[0], ctile[1])
    if (v.sum() == cpart.w * cpart.h) {
      // It fit.
      console.log('fit at', ctile);
      // Mark area as impassable.
      rimage.blend(ctile[0], ctile[1], cpart);
      simage.blend(ctile[0], ctile[1], cpart);
      part_list.shift();
    }
  }

  return simage;
}

// (1) randomly pick parts that constitute all pieces at RCL8
// (2) DFS the area from source[0] and push each spot onto
//     a list in the order of enumeration
// (3) randomly permutate the list of picked parts
// (4) try to fit the parts one at a time by moving up the list and
//     trying to place the part (ensuring the parts are next to each
//     other on each placement)
// (5) goto 3 if unable to place all parts and goto 1 if still unable
//     to place all parts after X iterations

let part_list = randomly_select_complete_set_of_parts();
let tiles = bfs_tile_list(9, 7, (nx, ny) => {
  const v = room.get(nx, ny);
  return v;
});
console.log(`tiles is ${tiles.length} long`);
let simage = try_placing_parts_via_tiles(rimage, part_list, tiles);

for (let y = 0; y < 50; ++y) {
  let row = [];
  for (let x = 0; x < 50; ++x) {
    let v = new String(simage.get(x, y));
    v = v.length == 2 ? v : ' ' + v;
    row.push(v);
  }
  row = row.join(' ');
  console.log(row);
}





