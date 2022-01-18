const game = require('./game');
_ = game._;

class PathManager {
  constructor (room) {
    this.room = room;
    this.broom = room.get_base_room();
  }

  get_clear_spots_around_struct (struct) {
    const sy = struct.pos.y;
    const sx = struct.pos.x;
    const out = [];

    let top = sy > 0 ? sy - 1 : 0;
    let bottom = sy < 49 ? sy + 1 : 49;
    let left = sx > 0 ? sx - 1 : 0;
    let right = sx < 49 ? sx + 1 : 49;

    const area = this.broom.lookAtArea(top, left, bottom, right, false);

    for (let ox of [-1, 0, 1]) {
      for (let oy of [-1, 0, 1]) {
        if (ox === 0 && oy === 0) {
          continue;
        }

        let nx = sx + ox;
        let ny = sy + oy;

        if (area[ny] === undefined) {
          continue;
        }

        if (area[ny][nx] === undefined) {
          continue;
        }

        const spot = _.filter(area[ny][nx], mark => mark.type !== 'creep');
        
        if (spot.length > 1) {
          continue;
        }
        
        if (spot[0].type !== 'terrain') {
          continue;
        }

        if (spot[0].terrain === 'wall') {
          continue;
        }

        out.push([nx, ny]);
      }
    }

    return out;
  }

  dialate_cost_matrix (cm, vv) {
    for (let x = 0; x < 50; ++x) {
      for (let y = 0; y < 50; ++y) {
        let v = cm.get(x, y);

        if (v !== vv) {
          continue;
        }

        for (let ox of [-1, 0, 1]) {
          for (let oy of [-1, 0, 1]) {
            let nx = x + ox;
            let ny = y + oy;
            if (nx > 0 && ny > 0 && nx < 50 && ny < 50) {
              let nv = cm.get(nx, ny);
              if (nv === 0) {
                cm.set(nx, ny, v * 2);
              }
            }
          }
        }
      }
    }

    return cm;
  }

  get_all_stop_cost_matrix_smoothed () {
    return this.get_all_stop_cost_matrix_dialated(254);
  }

  get_all_stop_cost_matrix_dialated (dialated_count) {
    let cm = this.get_all_stop_cost_matrix();
    
    for (let d = 0; d < dialated_count; ++d) {
      this.dialate_cost_matrix(cm, d + 1);
    }

    return cm;
  }

  get_all_stop_cost_matrix () {
    let structs = this.broom.find(game.FIND_STRUCTURES);
    let sources = this.broom.find(game.FIND_SOURCES);

    for (let source of sources) {
      structs.push(source);
    }

    structs.push(this.broom.controller);

    if (structs.length === 0) {
      throw new Error('The room is empty!');
    }
    
    let prev_struct = structs[0];
    let clear_spots = this.get_clear_spots_around_struct(prev_struct);

    if (clear_spots.length === 0) {
      throw new Error('Impossible room layout. Structure completely inaccessible.');
    }

    let prev_pos = this.broom.getPositionAt(clear_spots[0][0], clear_spots[0][1]);

    let long_road = [];
    let very_first = true;

    for (let x = 1; x < structs.length; ++x) {
      const cur_struct = structs[x];

      clear_spots = this.get_clear_spots_around_struct(cur_struct);

      if (clear_spots.length === 0) {
        continue;
      }

      const clear_spot = _.sample(clear_spots);
      const cur_pos = this.broom.getPositionAt(clear_spot[0], clear_spot[1]);
      const path = this.broom.findPath(prev_pos, cur_pos, {
        ignoreCreeps: true,
      });

      if (path.length === 0) {
        continue;
      }

      const path_last = path[path.length - 1];

      very_first = true;

      for (let y = 0; y < path.length; ++y) {
        if (very_first || y > 0) {
          const path_part = path[y];
          long_road.push(path_part);
          very_first = false;
        }
      }

      prev_pos = this.broom.getPositionAt(path_last.x, path_last.y);
    }

    // Plot road onto a map. Then dialate that a few times. This is the area in which
    // all inter-room pathing operations search within. This will reduce the amount of
    // CPU needed.
    let cm = new (game.path_finder().CostMatrix)();

    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        cm.set(x, y, 0);
      }
    }   
 
    // Mark all around each structure.
    for (let s of structs) {
      const clear_spots = this.get_clear_spots_around_struct(s);
      for (let spot of clear_spots) {
        cm.set(spot[0], spot[1], 2);
      }
    }

    // Mark the path between all structures.
    for (let x = 0; x < long_road.length; ++x) {
      let part = long_road[x];
      cm.set(part.x, part.y, 1);
    }

    // Mark all construction sites except containers and roads as impassable.
    let csites = this.broom.find(game.FIND_CONSTRUCTION_SITES);

    for (let csite of csites) {
      let a = csite.structureType === STRUCTURE_ROAD;
      let b = csite.structureType === STRUCTURE_CONTAINER;
      if (a || b) {
        continue;
      }
    
      cm.set(csite.pos.x, csite.pos.y, 255);
    }

    // Remark structures and walls as impassabe EXCEPT for containers.
    for (let s of structs) {
      if (s.structureType === STRUCTURE_ROAD) {
        cm.set(s.pos.x, s.pos.y, 1);
        continue;
      }

      if (s.structureType !== STRUCTURE_CONTAINER) {
        cm.set(s.pos.x, s.pos.y, 255);
      }
    }

    let terrain = this.broom.getTerrain();

    for (let y = 0; y < 50; ++y) {
      for (let x = 0; x < 50; ++x) {
        switch (terrain.get(x, y)) {
          case game.TERRAIN_MASK_WALL:
            // Walls are currently impassable unless we build tunnels.
            cm.set(x, y, 255); 
            break
          case game.TERRAIN_MASK_SWAMP:
            // Allow swamp to be high but NOT impassable.
            cm.set(x, y, Math.min(cm.get(x, y, 255) * 2, 254));
            break;
        }
      }
    }

    // Double the cost of swamps.

    return cm;
  }
}

module.exports.PathManager = PathManager;
