/*
  This module does two major items of work.

  (1) It creates construction site(s) for spawns, extensions, factories, labs, 
      and storage. 

  (2) It creates construction sites for roads through swamps.

    It does this by checking on each tick the location of all friendly creeps
    in the room and if any are on a swamp tile then it increments the counter
    for that tile by one and decrements all incremented swamp tiles by X where
    X is some decay value. If the counter for the tile reaches Y, where Y is
    some value, and there are fewer than Z construction sites then a road
    construction site will be created for that tile. This process continues 
    until most of the swamp tiles used by the creeps have been paved over with
    a road.
*/
const game = require('./game');
_ = game._;
const { logging } = require('./logging');

class AutoBuilder {
  constructor (room) {
    this.room = room;
    this.reserved = [];
  }

  lab_reserve_spots (lab, need) {
    let moves = [
      [-1,  1], [-1, -1],
      [ 1, -1], [ 1,  1],
    ];

    let count = 0;

    this.flood_fill(
      lab.pos.x, lab.pos.y,
      moves,
      (nx, ny) => {
        if (this.spot_valid(nx, ny)) {
          count++;
          if (count <= need) {
            this.reserved.push([nx, ny]);
            // Keep searching here.
            return true;
          } else {
            // Stop searching here.
            return false;
          }
        }
        // Stop searching here.
        return false;
      }
    ); 
  }

  lab_connection_count (lab) {
    let moves = [
      [-1,  1], [-1, -1],
      [ 1, -1], [ 1,  1],
      [ 1,  0], [-1,  0],
      [ 0,  1], [ 0, -1],
    ];

    const labs = this.room.labs;
    let connection_count = -1;

    this.flood_fill(
      lab.pos.x, lab.pos.y,
      moves,
      (nx, ny) => {
        if (_.some(labs, lab => lab.pos.isEqualTo(nx, ny))) {
          connection_count++;
          if (connection_count === 2) {
            return false;
          }
          return true;
        } else {
          return false;
        }
      } 
    );

    return connection_count;
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

  /*
    Return true if the spot is valid for construction of an essential building.
  */
  spot_valid (x, y) {
    const room = this.room;
    const structs = room.structs;
    const terrain = room.terrain;

    // Do not allow matches to reserved spots.
    if (_.some(this.reserved, i => i[0] === x && i[1] === y)) {
      return false;
    }
    
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

  find_free_spot () {
    const room = this.room;
    // Get first source as origin point.
    const origin = room.sources[0].pos;

    let cur = [[
      origin.x,
      origin.y,
    ]];

    let pms = [
      [-1,-1],
      [1,-1],
      [1,1],
      [-1,1],
    ];

    let pen = [];

    let marked = {};

    while (cur.length > 0) {
      while (cur.length > 0) {
        let n = cur.pop();
        let x = n[0];
        let y = n[1];
        for (let i = 0; i < pms.length; ++i) {
          const m = pms[i];
          let nx = x + m[0];
          let ny = y + m[1];

          if (nx < 0 || ny < 0 || nx > 49 || ny > 49) {
            continue;
          }

          if (marked[nx + ny * 50] === true) {
            continue;
          }

          if (room.terrain.get(nx, ny) === game.TERRAIN_MASK_WALL) {
            // Walls are blocking.
            room.room.visual.rect(nx - 0.5, ny - 0.5, 1, 1, { fill: 'blue', opacity: 0.2 });
            continue;
          }
          
          if (this.spot_valid(room, nx, ny)) {
            return new RoomPosition(nx, ny, room.room.name);
          }

          room.room.visual.rect(nx - 0.5, ny - 0.5, 1, 1, { fill: 'red', opacity: 0.2 });

          marked[nx + ny * 50] = true;
    
          pen.push([nx, ny]);
        }
      }

      cur = pen;
      pen = [];
    }

    return null;
  }

  tick_construction_structures () {
    const room = this.room;
    // Lets see what we can build.
    const structs = room.structs;

    if (!room.room.controller) {
      // Only if the room has a controller.
      logging.info('room has no controller');
      return;
    }

    if (!room.room.controller.my) {
      // Only if it is _our_ controller.
      logging.info('this is not our controller');
      return;
    }

    const cl = room.room.controller.level;
    
    /*
    const lab_can_have = game.CONTROLLER_STRUCTURES[game.STRUCTURE_LAB][cl];
    const lab_have = room.labs.length;

    if (lab_can_have - lab_have > 0) {
      // Find any labs. Find any unmatched labs and reserve match spots
      // around them.
      _.each(room.labs, lab => {
          const count = this.lab_connection_count(lab);
          logging.info('lab connection count', count);
          if (count < 2) {
            // Because the lab does not have two other labs connected
            // onto it. We reserve all spots around it until it does.
            this.lab_reserve_spots(lab, 2 - count);
          }
      });

      // We only reserved the exact number of needed spots. Pick one and build a lab.
      if (this.reserved.length > 0) {
        const spot = this.reserved[0];
        logging.info('reserved spot exists', spot[0], spot[1]);
        logging.info('@', room.room.createConstructionSite(spot[0], spot[1], game.STRUCTURE_LAB));
        return;
      }
    }

    if (room.csites.length > 0) {
      // Only create one construction site at a time.
      logging.info('maximum construction sites reached');
      return;
    }
    */

    const stb = [
      game.STRUCTURE_SPAWN, game.STRUCTURE_EXTENSION, game.STRUCTURE_STORAGE,
      game.STRUCTURE_TOWER, game.STRUCTURE_TERMINAL, //game.STRUCTURE_LAB,
      game.STRUCTURE_FACTORY,
    ];
    
    if (room.links.length === 2) {
      // IF the two links have been built already, for each source, then schedule
      // the third link to be build within the base. The miners will detect the
      // construction of the third link and start sending energy to it.
      logging.debug('link_count === 2; scheduling construction of third link');
      stb.push(game.STRUCTURE_LINK);
    }

    _.some(stb, tb => {
      const can_have = game.CONTROLLER_STRUCTURES[tb][cl];
      const have = _.sumBy(structs, s => s.structureType === tb ? 1 : 0);

      if (have < can_have) {
        logging.info(`creating csite for ${tb}`);
        // Find free spot and place a construction site.
        const spot = this.find_free_spot();

        if (spot) {
          console.log('spot', spot.x, spot.y);
          room.room.visual.rect(spot.x - 0.5, spot.y - 0.5, 1, 1, { fill: 'green', opacity: 0.1 });
          logging.log(room.room.createConstructionSite(spot, tb));
        } else {
          logging.info('no spot found');
        }
        
        return true;
      }
    });
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
    this.tick_construction_structures();
    this.tick_construction_roads();
  }
}

module.exports.AutoBuilder = AutoBuilder;

