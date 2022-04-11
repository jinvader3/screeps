const game = require('./game');
const _ = game._;
const { logging } = require('./logging');

class AutoBuild2 {
  constructor (room) {
    this.room = room;
  }

  random_chain_fill (sx, sy, moves, cond, count) {
    let c = [sx, sy];

    const visited = {};
    const chain = [];

    while (chain.length < count) {
      moves = _.shuffle(moves);

      let valid = false;

      for (let move of moves) {
        let nx = c[0] + move[0];
        let ny = c[1] + move[1];
        let ni = nx + ny * 50;
        if (visited[ni] === true) {
          continue;
        }
        visited[ni] = true;
        if (cond(nx, ny)) {
          c = [nx, ny];
          valid = true;
          break;
        }
      }

      if (valid === false) {
        return null;
      }

      chain.push([c[0], c[1]]);
    }

    return chain;
  }

  flood_fill (sx, sy, moves, cond) {
    let cur = [];
    let pend = [];
    const labs = this.room.labs;

    cur.push([sx, sy]);

    const visited = {};

    while (cur.length > 0) {
      while (cur.length > 0) {
        let c = cur.pop();
        for (let move of moves) {
          let nx = c[0] + move[0];
          let ny = c[1] + move[1];
          let ni = nx + ny * 50;

          if (visited[ni] === true) {
            continue;
          }

          visited[ni] = true;

          if (nx < 0 || nx > 49 || ny < 0 || ny > 49) {
            continue;
          }

          if (cond(nx, ny) === true) {
            pend.push([nx, ny]);
          }
        }
      }

      cur = pend;
      pend = [];
    }
  }

  spot_valid (x, y) {
    const room = this.room;
    const structs = room.structs;
    const terrain = room.terrain;

    // No placement on border around room.
    if (x <= 1 || y <= 1 || x >= 49 || y >= 49) {
      return false;
    }

    // Spots orthogonal must be valid too.
    let a = this.spot_valid_inner(x + 1, y    );
    let b = this.spot_valid_inner(x - 1, y    );
    let c = this.spot_valid_inner(x,     y + 1);
    let d = this.spot_valid_inner(x,     y - 1);

    if (!a || !b || !c || !d) {
      return false;
    }

    // No construction site allowed. Means its taken.
    if (_.some(room.csites, c => c.pos.isEqualTo(x, y))) {
      return false;
    }

    // Do other checks.
    return this.spot_valid_inner(x, y);
  }

  spot_valid_inner(x, y) {
    const room = this.room;

    if (room.terrain.get(x, y) === game.TERRAIN_MASK_WALL) {
      return false;
    }

    if (_.some(
      _.filter(room.structs, s => s.structureType !== game.STRUCTURE_ROAD), 
      c => c.pos.isEqualTo(x, y)
    )) { 
      return false;
    }

    if (_.some(room.sources, c => c.pos.getRangeTo(x, y) < 2)) {
      return false;
    }
   
    if (room.room.controller.pos.getRangeTo(x, y) < 2) {
      return false;
    }

    return true;
  }

  find_valid_spots () {
    const source = this.room.sources[0];
    const moves = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const valids = [];

    const all_moves = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    let cx;
    let cy;

    for (let move of all_moves) {
      cx = source.pos.x + move[0];
      cy = source.pos.y + move[1];
      
      if (this.room.terrain.get(cx, cy) !== game.TERRAIN_MASK_WALL) {
        break;
      }
    }

    this.flood_fill(
      cx, cy,
      moves,
      (nx, ny) => {
        if (this.spot_valid(nx, ny)) {
          valids.push([nx, ny]);
        }

        return this.room.terrain.get(nx, ny) !== game.TERRAIN_MASK_WALL;
      }
    );

    return valids;
  }

  get_valid_chain (valids, count) {
    let chain = null;
    for (let x = 0; x < 10 && chain === null; ++x) {
      let valid = valids.shift();
      chain = this.random_chain_fill(
        valid[0], valid[1],
        [[1, 1], [1, -1], [-1, 1], [-1, -1]],
        (nx, ny) => {
          return this.spot_valid(nx, ny);
        },
        count
      );    
    }
    return chain;
  }

  follow_plan () {
    if (this.room.csites.length > 0) {
      logging.info('maximum number of csites');
      return;
    }    

    const plan = this.room.memory.plan;
    const cl = this.room.room.controller.level;
    const have = {};
    const structs = _.map(this.room.structs, s => s);
     
    if (this.room.room.storage) {
      structs.push(this.room.room.storage);
    }
    
    if (this.room.room.terminal) {
      structs.push(this.room.room.terminal);
    }    

    const stb = [
      game.STRUCTURE_TOWER,
      game.STRUCTURE_SPAWN, 
      game.STRUCTURE_STORAGE,
      game.STRUCTURE_EXTENSION, 
      game.STRUCTURE_TERMINAL,
      game.STRUCTURE_LAB,
      game.STRUCTURE_FACTORY,
    ];

    for (let tb of stb) {
      const limit = game.CONTROLLER_STRUCTURES[tb][cl];
      const count = _.sumBy(structs, s => s.structureType === tb);
      logging.info(`looking at ${tb} with limit ${limit} and count ${count}`);
      if (count < limit) {
        logging.info('getting spots');
        const spots = _.filter(plan, item => item[0] === tb)
        logging.info('trying to build on spots');
        if (_.some(spots, spot => {
          // Stop on the first valid spot.
          return this.room.room.createConstructionSite(spot[1], spot[2], tb) === game.OK;
        })) {
          logging.info('successful build');
          // Stop on the first valid spot.
          break;
        }
      }
    }  
  }

  tick_construction_roads () {
    const room = this.room;

    room.room.memory.roadtrack = room.room.memory.roadtrack || {};
    const track = room.room.memory.roadtrack;

    // Where are all of the creeps for this room?
    _.each(room.creeps, creep => {
      const ground = room.terrain.get(creep.creep.pos.x, creep.creep.pos.y);
      const i = creep.creep.pos.x + creep.creep.pos.y * 50;
      if (ground === game.TERRAIN_MASK_SWAMP) {
        track[i] = track[i] === undefined ? 1 : track[i] + 1;
      }
    });

    _.each(track, (v, k) => {
      track[k] -= 0.01;
      if (track[k] <= 0) {
        track[k] = undefined;
      }

      let y = Math.floor(k / 50);
      let x = k - y * 50;

      if (track[k] > 30.0) {
        room.room.visual.rect(x - 0.5, y - 0.5, 1, 1, { fill: 'orange' });
      }
    });

    if (room.csites.length > 0) {
      return;
    }

    _.some(track, (v, k) => {
      let y = Math.floor(k / 50);
      let x = k - y * 50;

      if (v > 30.0) {
        if (!_.some(room.roads, r => r.pos.isEqualTo(x, y))) {
          room.room.createConstructionSite(x, y, game.STRUCTURE_ROAD);
          return true;
        }
      }
      return false;
    });
  }

  tick () {
    if (this.room.sources.length === 0) {
      logging.info('no sources');
      return;
    }

    if (this.room.memory.plan !== undefined) {
      logging.info('plan already built');
      this.tick_construction_roads();
      this.follow_plan()
      return;
    }

    // find all valid spots ordered by distance
    const valids = this.find_valid_spots();
    logging.info('got valid spots');

    const stb = [
      game.STRUCTURE_SPAWN, game.STRUCTURE_STORAGE,
      game.STRUCTURE_TOWER, game.STRUCTURE_TERMINAL,
      game.STRUCTURE_EXTENSION, 
      //game.STRUCTURE_LAB,
      game.STRUCTURE_FACTORY,
    ];

    const tobe_placed = [];
    const structs = _.map(this.room.structs, s => s);
    
    if (this.room.room.storage) {
      structs.push(this.room.room.storage);
    }
    
    if (this.room.room.terminal) {
      structs.push(this.room.room.terminal);
    }

    _.each(stb, tb => {
      const limit = game.CONTROLLER_STRUCTURES[tb][8];
      const have = _.sumBy(structs, s => s.structureType === tb ? 1 : 0);
      const delta = limit - have;
      for (let x = 0; x < delta; ++x) {
        const valid = valids.shift(); 
        tobe_placed.push([tb, valid[0], valid[1]]);
      }
    });

    logging.info('placed all structures except labs');

    let limit;
    let have;

    limit = game.CONTROLLER_STRUCTURES[game.STRUCTURE_LAB][8];
    have = _.sumBy(this.room.structs, s => s.structureType === game.STRUCTURE_LAB ? 1 : 0);
    let lab_chain = this.get_valid_chain(valids, limit - have);

    if (lab_chain !== null) {
      logging.info('have valid lab_chain');
      for (let pos of lab_chain) {
        tobe_placed.push([game.STRUCTURE_LAB, pos[0], pos[1]]);
      }

      // We should now have a valid room plan.
      this.room.memory.plan = tobe_placed; 
    } else {
      logging.info('have no valid lab chain');
    }
  }
}

module.exports.AutoBuild2 = AutoBuild2;
