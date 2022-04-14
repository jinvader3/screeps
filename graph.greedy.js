class Path {
  constructor (path) {
    this.path = path || [];
  }

  add (value) {
    this.path.push(value);
  }

  clone () {
    let out = [];
    for (let x = 0; x < this.path.length; ++x) {
      out.push(this.path[x]);
    }
    return out;
  }

  clone_add (value) {
    let out = this.clone();
    let path = new Path(out);
    path.add(value);
    return path;
  }
}

class GreedySolver {
  constructor (g) {
    this.g = g;
  }
  
  get_path_free_capacity (path) {
    if (path.length < 2) {
      return 0;
    }

    let most = Number.MAX_VALUE;
    let origin = path[0];

    for (let x = 1; x < path.length; ++x) {
      const move = path[x];
      const capacity = this.g.edges[origin][move].capacity;
      const flow = this.g.edges[origin][move].flow;
      const free = capacity - flow;
      most = Math.min(most, free);
      origin = move;
    }

    return most;
  }

  send_flow (path, flow) {
    let origin = path[0];

    console.log(`flow=${flow}`, path);   
 
    for (let x = 1; x < path.length; ++x) {
      const move = path[x];
      const edge = this.g.edges[origin][move];
      edge.flow += flow;
      origin = move;
    }
  }

  get_max_flow (source, sink) {
    let total_flow = 0;
    let flow = 1;
    while (flow > 0) {
      flow = this.cycle(source, sink);
      total_flow += flow;
    }
    console.log('total_flow', total_flow);
    return total_flow;
  }

  cycle (s, t) {
    const path = this.search_for_path_bfs(s, t);
    
    if (path.length === 0) {
      return 0;
    }

    if (path.length === 1) {
      throw new Error('BUG');
    }

    const path_flow_free_capacity = this.get_path_free_capacity(path);

    if (path_flow_free_capacity <= 0) {
      throw new Error('BUG');
    }

    this.send_flow(path, path_flow_free_capacity);

    return path_flow_free_capacity;
  }

  search_for_path_bfs (source, sink) {
    const q = [];
    const visited = {};
    const p = {};

    q.unshift(source);
    visited[source] = true;

    while (q.length > 0) {
      let cur = q.shift();
      const moves = Object.keys(this.g.edges[cur]);
      for (const move of moves) {
        const edge = this.g.edges[cur][move];
        const capacity = edge.capacity;
        const flow = edge.flow;
        if (visited[move] === true) {
          continue;
        }

        if (flow < capacity) {
          p[move] = cur;
          visited[move] = true;

          if (move === sink) {
            let path = [];
            cur = move;
            while (p[cur] !== undefined) {
              path.unshift(cur);
              cur = p[cur];
            }
            path.unshift(source);
            console.log('path', path);
            return path;
          }
          q.push(move);
        } else {
          console.log('flow-max', `${cur}->${move}`);
        }
      }
    }
  
    return [];
  }

  search_for_path_dfs (source, sink) {
    let cur = [];
    let pend = [];

    let new_path = new Path();
    new_path.add(source);
    cur.push([source, 0, new_path]);

    const visited = {};

    // Map out the best path.
    while (cur.length > 0) {
      while (cur.length > 0) {
        const cn = cur.pop();
        const moves = Object.keys(this.g.edges[cn[0]]);
        const cur_moves = cn[1] + 1;
        const path = cn[2];

        for (let move of moves) {
          const edge = this.g.edges[cn[0]][move];
          const capacity = edge.capacity;
          const flow = edge.flow;

          if (flow >= capacity) {
            // This edge has maximum flow. We can not use it.
            continue;
          }

          const best = visited[move] || Number.MAX_VALUE;

          if (best <= cur_moves) {
            // We have made it to this point in fewer jumps.
            continue;
          }

          if (move === sink) {
            path.add(sink);
            return path.path;
          }
        
          visited[cn[0]] = cur_moves;  
          let new_path = path.clone_add(move);
          pend.push([move, cur_moves, new_path]);
        }
      }
      cur = pend;
      pend = [];
    }

    return []; 
  }
}

module.exports.GreedySolver = GreedySolver;
