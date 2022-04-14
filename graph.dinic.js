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

module.exports.DinicSolver = DinicSolver;
