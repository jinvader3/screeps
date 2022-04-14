const { Graph } = require('./graph.js');
const { _ } = require('./lodash-core');
//const { GreedySolver } = require('./graph.greedy.js');

class FlowNode {
  constructor (u, min_flow) {
    this.u = u;
    this.min_flow = min_flow;
  }
}

class DinicSolver {
  constructor (g, source, sink) {
    this.g = g;
    this.create_back_graph();
    this.source = source;
    this.sink = sink;
  }

  create_back_graph () {
    let new_edges = [];

    for (let v in this.g.edges) {
      for (let u in this.g.edges[v]) {
        // Add reverse edges.
        new_edges.push([u, v]);
      }
    }
  
    for (let ne of new_edges) {
      this.g.add_edge(ne[0], ne[1], 0);
    }
  }

  get_max_flow () {
    let total_flow = 0;
    this.bfs_create_level();
    while (this.level[this.sink]) {
      console.log('level', this.level);
      let sent;
      do {
        sent = this.dfs_send_flow();
        total_flow += sent;
      } while (sent > 0);
      this.bfs_create_level();
    }
    for (let u in this.g.edges) {
      const edges = this.g.edges[u];
      for (let v in edges) {
        const edge = edges[v];
        const flow = edge.flow;
        const cap = edge.capacity;
        if (flow > 0) {
          console.log(`${u}->${v} ${flow}/${cap}`);
        }
      }
    }
    console.log(`total_flow=${total_flow}`);
    return total_flow;
  }

  dfs_send_flow () {
    let q = [];

    q.push(new FlowNode(this.source, Number.MAX_VALUE));

    const p = {};

    let total_flow = 0;

    while (q.length > 0) {
      const cnode = q.pop();
      const clevel = this.level[cnode.u];
      const edges = this.g.edges[cnode.u];
      for (const v of Object.keys(edges)) {
        const edge = edges[v];
        const flow = edge.flow;
        const capacity = edge.capacity;
        const residual = capacity - flow;
        const nlevel = this.level[v];

        if (residual <= 0) {
          // Must be flowable.
          continue;
        }

        if (clevel + 1 !== nlevel) {
          // Must obey the level graph.
          continue;
        }

        p[v] = cnode.u;

        if (v === this.sink) {
          //const min_flow = Math.min(cnode.min_flow, residual);
          let min_flow = Number.MAX_VALUE;
          let f;
          f = v;
          while (f !== this.source) {
            const edge = this.g.edges[p[f]][f];
            const _flow = edge.flow;
            const _cap = edge.capacity;
            min_flow = Math.min(min_flow, _cap - _flow);
            f = p[f];
          }
          f = v;
          while (f !== this.source) {
            // edge: p[f] -> f
            console.log(`FSET ${p[f]}->${f} AT ${min_flow}`);
            this.g.edges[p[f]][f].flow += min_flow;
            this.g.edges[f][p[f]].flow -= min_flow;
            f = p[f];
          }
          total_flow += min_flow;
        }

        ///
        q.push(new FlowNode(v, Math.min(cnode.min_flow, residual)));
        ///
      }
    }
  
    return total_flow;
  } 

  bfs_create_level () {
    const q = [];
    const visited = {};
    
    this.level = {};
    
    q.push([this.source, 0]);
    visited[this.source] = true;
    this.level[this.source] = 0;

    while (q.length > 0) {
      console.log('doing bfs cl');
      let node = q.shift();
      let cur = node[0];
      const moves = Object.keys(this.g.edges[cur] || {});
      const cur_level = node[1] + 1;
      console.log('moves', moves);
      for (const move of moves) {
        const edge = this.g.edges[cur][move];
        const capacity = edge.capacity;
        const flow = edge.flow;
        
        if (visited[move] === true) {
          continue;
        }

        if (flow >= capacity) {
          continue;
        }

        console.log('move', move);

        this.level[move] = cur_level;
        visited[move] = true;
        q.push([move, cur_level]);
       }
    }
  } 
}

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
