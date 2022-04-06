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

/*
  Return true if the spot is valid for construction of an essential building.
*/
function spot_valid (room, x, y) {
  const structs = room.structs;
  const terrain = room.terrain;

  if (x <= 1 || y <= 1 || x >= 49 || y >= 49) {
    return false;
  }

  let a = x == 49 || spot_valid_inner(room, x + 1, y    );
  let b = x == 0 || spot_valid_inner(room,  x - 1, y    );
  let c = y == 49 || spot_valid_inner(room, x,     y + 1);
  let d = y == 0 || spot_valid_inner(room,  x,     y - 1);

  if (!a || !b || !c || !d) {
    return false;
  }

  if (_.some(room.csites, c => c.pos.isEqualTo(x, y))) {
    return false;
  }

  return spot_valid_inner(room, x, y);
}

function spot_valid_inner(room, x, y) {
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

function find_free_spot (room) {
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
        
        if (spot_valid(room, nx, ny)) {
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

function tick_construction_structures (room) {
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

  if (room.csites.length > 0) {
    // Only create one construction site at a time.
    logging.info('maximum construction sites reached');
    return;
  }

  const stb = [
    game.STRUCTURE_SPAWN, game.STRUCTURE_EXTENSION, game.STRUCTURE_STORAGE,
    game.STRUCTURE_TOWER, game.STRUCTURE_LAB, game.STRUCTURE_TERMINAL,
    game.STRUCTURE_FACTORY,
  ];

  const link_count = _.sumBy(structs, s => s.structureType === game.STRUCTURE_LINK);

  if (link_count === 2) {
    // IF the two links have been built already, for each source, then schedule
    // the third link to be build within the base. The miners will detect the
    // construction of the third link and start sending energy to it.
    logging.debug('link_count === 2; scheduling construction of third link');
    stb.push(game.STRUCTURE_LINK);
  }

  const cl = room.room.controller.level;

  _.some(stb, tb => {
    const can_have = game.CONTROLLER_STRUCTURES[tb][cl];
    const have = _.sumBy(structs, s => s.structureType === tb ? 1 : 0);
    if (have < can_have) {
      logging.info(`creating csite for ${tb}`);
      // Find free spot and place a construction site.
      const spot = find_free_spot(room);
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

function tick_construction_roads (room) {
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

module.exports.tick = function (room) {
  tick_construction_structures(room);
  tick_construction_roads(room);
}

