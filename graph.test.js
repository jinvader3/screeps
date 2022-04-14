const { Graph } = require('./graph.js');
const { _ } = require('./lodash-core');
const { GreedySolver } = require('./graph.greedy.js');
const { DinicSolver } = require('./graph.dinic.js');

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
      throw new Error('Coordinate Out Of Bounds');
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
const data = fs.readFileSync('./w1n1.json');
const decoder = new StringDecoder('utf8');
const data_utf8 = decoder.write(data);
const data_json = JSON.parse(data_utf8);

for (let item of data_json.terrain) {
  const x = item.x;
  const y = item.y;
  const typ = item.type;

  if (typ === 'wall') {
    room.set(x, y, false);
  } else {
    room.set(x, y, true);
  }
}

g = room.build_exit_vector_graph(19, 29);

//g = room.build_graph();
let ds_g = new DinicSolver(g, '4:20', '49:24');
console.log(ds_g.get_max_flow());

/*
// TEST CASE GEEK FOR GEEKS
// https://www.geeksforgeeks.org/dinics-algorithm-maximum-flow/
g = new Graph();
g.add_edge('s', '1', 10);
g.add_edge('s', '2', 10);
g.add_edge('1', '2', 2);
g.add_edge('1', '4', 8);
g.add_edge('1', '3', 4);
g.add_edge('2', '4', 9);
g.add_edge('4', '3', 6);
g.add_edge('4', 't', 10);
g.add_edge('3', 't', 10);
console.assert((new DinicSolver(g, 's', 't')).get_max_flow() === 19);
*/

/*
let tc2_edges = [
  ['d', 't', 3],
  ['e', 'd', 8],
  ['d', 'c', 1],
  ['b', 'c', 4],
  ['c', 't', 1],
  ['b', 't', 10],
  ['a', 'b', 2],
  ['a', 'd', 3],
  ['s', 'e', 9],
  ['s', 'a', 4],
];

tc2_edges = _.shuffle(tc2_edges);

// HARLEM'S TEST CASE
g = new Graph();
for (let ed of tc2_edges) {
  g.add_edge(ed[0], ed[1], ed[2]);
}
console.assert((new DinicSolver(g, 's', 't')).get_max_flow() === 6);
*/

/*
g = new Graph();
// WIKIPEDIA TEST CASE (19)
g.add_edge('s', '1', 10);
g.add_edge('s', '2', 10);
g.add_edge('1', '3', 4);
g.add_edge('2', '4', 9);
g.add_edge('1', '4', 8);
g.add_edge('1', '2', 2);
g.add_edge('3', 't', 10);
g.add_edge('4', '3', 6);
g.add_edge('4', 't', 10);
console.assert((new DinicSolver(g, 's', 't')).get_max_flow() === 19);
*/
