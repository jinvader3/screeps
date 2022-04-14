class Edge {
  constructor (capacity) {
    this.capacity = capacity;
    this.flow = 0;
  }
};

class Graph {
  constructor () {
    this.edges = {};
  }

  add_edge (u, v, capacity) {
    this.edges[u] = this.edges[u] || {};
    this.edges[u][v] = new Edge(capacity);
  }
}

module.exports.Edge = Edge;
module.exports.Graph = Graph;
