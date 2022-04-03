const game = require('./game');
_ = game._;
const { logging } = require('./logging');

function spot_valid (room, x, y) {
  const structs = room.structs;
  const terrain = room.terrain;

  let a = x == 49 || spot_valid_inner(room, x + 1, y    );
  let b = x == 0 || spot_valid_inner(room,  x - 1, y    );
  let c = y == 49 || spot_valid_inner(room, x,     y + 1);
  let d = y == 0 || spot_valid_inner(room,  x,     y - 1);

  if (!a || !b || !c || !d) {
    return false;
  }

  return spot_valid_inner(room, x, y);
}

function spot_valid_inner(room, x, y) {
  if (room.terrain.get(x, y) === game.TERRAIN_MASK_WALL) {
    return false;
  }

  if (_.some(room.structs, c => c.pos.isEqualTo(x, y))) { 
    return false;
  }
  
  if (_.some(room.csites, c => c.pos.isEqualTo(x, y))) {
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
    origin.x + 2,
    origin.y + 2,
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
          return;
        }

        if (marked[nx + ny * 50] === true) {
          return;
        }
        
        if (spot_valid(room, nx, ny)) {
          return new RoomPosition(nx, ny, room.room.name);
        }

        marked[nx + ny * 50] = true;
  
        pen.push([nx, ny]);
      }
    }

    cur = pen;
    pen = [];
  }

  return null;
}

module.exports.tick = function (room) {
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

  if (room.csites.length > 1) {
    // Only create one construction site at a time.
    logging.info('maximum construction sites reached');
    return;
  }

  const stb = [
    game.STRUCTURE_SPAWN, game.STRUCTURE_EXTENSION, game.STRUCTURE_STORAGE,
    game.STRUCTURE_TOWER, game.STRUCTURE_LAB, game.STRUCTURE_TERMINAL,
    game.STRUCTURE_FACTORY,
  ];

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
        //room.room.visual.rect(spot.x, spot.y, 1, 1);
        logging.log(room.room.createConstructionSite(spot, tb));
      } else {
        logging.info('no spot found');
      }
      
      return true;
    }
  });
}
