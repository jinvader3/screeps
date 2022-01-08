const game = require('./game');
_ = game._;
const { CreepGeneralWorker } = require('./creepgw');
const { CreepDummy } = require('./creepdummy');
const { CreepMiner } = require('./creepminer');
const { CreepFighter } = require('./creepfighter');
const { CreepClaimer } = require('./creepclaimer');

class Room {
  constructor (room) {
    this.room = room;
    this.creeps = [];
    this.spawns = room.find(game.FIND_MY_SPAWNS);
    this.sources = room.find(game.FIND_SOURCES);
    this.room.memory.mi = this.room.memory.mi || {};
    this.room.memory.jobs = this.room.memory.jobs || [];
    this.jobs = this.room.memory.jobs;
    this.room.memory.jobs_uid = this.room.memory.jobs_uid || 0;
    this.breq = [];
    this.room.memory.res_xfer_intents = this.room.memory.res_xfer_intents || [];
    this.res_xfer_intents = this.room.memory.res_xfer_intents;
  }

  request_build_creep (ruid, body_unit, unit_min, unit_max, group, group_count, priority, memory) {
    if (!_.some(this.breq, breq => {
      if (breq.ruid === ruid) {
          breq.body_unit = body_unit;
          breq.unit_min = unit_min;
          breq.unit_max = unit_max;
          breq.group = group;
          breq.group_count = group_count;
          breq.priority = priority;
          breq.memory = memory
          return true;
        } else { 
          return false 
        }
    })) {
      this.breq.push({
        ruid: ruid,
        body_unit: body_unit,
        unit_min: unit_min,
        unit_max: unit_max,
        clazz: clazz,
        priority: priority,
      });
    }
  }

  think_build_creep () {
  }

  add_creep (creep) {
    switch (creep.memory.c) {
      case 'gw': this.creeps.push(new CreepGeneralWorker(this, creep)); break;
      case 'miner': this.creeps.push(new CreepMiner(this, creep)); break;
      case 'fighter': this.creeps.push(new CreepFighter(this, creep)); break;
      case 'claimer': this.creeps.push(new CreepClaimer(this, creep)); break;
      default: this.creeps.push(new CreepDummy(this, creep)); break;
    }
  }

  tick_need_spawn () {
    let creep_group_counts = {
      'worker': 0,
      'minera': 0,
      'minerb': 0,
      'fighter': 0,
    };

    function group_count (gname) {
      return creep_group_counts[gname] || 0;
    }

    this.reg_put_intents = [];
    this.reg_get_intents = [];

    _.each(this.creeps, creep => {
      if (creep.creep.memory === undefined) {
        return;
      }
      if (creep_group_counts[creep.creep.memory.g] === undefined) {
        creep_group_counts[creep.creep.memory.g] = 0;
      }
      creep_group_counts[creep.creep.memory.g]++;
    });

    if (creep_group_counts.minera < 1 && this.spawns.length > 0) {
      this.spawns[0].spawnCreep(
        [game.WORK, game.WORK, game.WORK, game.WORK, game.WORK, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'miner', 'g': 'minera', 's': this.sources[0].id },
        }
      );
    }

    if (creep_group_counts.minerb < 1 && this.sources.length > 1 && this.spawns.length > 0) {
      this.spawns[0].spawnCreep(
        [game.WORK, game.WORK, game.WORK, game.WORK, game.WORK, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'miner', 'g': 'minerb', 's': this.sources[1].id },
        }
      );
    }

    let tclaim = 'E56S31';

    console.log('tclaim', tclaim);
    console.log('our-room', game.rooms()[tclaim]);
    if (game.rooms()[tclaim] !== undefined) {
      console.log('our-room', game.rooms()[tclaim].controller.my);
    }
    console.log('creep_group_counts', creep_group_counts['claimer_' + tclaim]);

    if (
      // If the room is not claimed by us and we do not have at least
      // one claimer built then build one.
      (!game.rooms()[tclaim] || !game.rooms()[tclaim].controller.my) &&
      group_count('claimer_' + tclaim) < 1
      ) {
      console.log('trying to build claimer');
      this.spawns[0].spawnCreep(
        [game.MOVE, game.CLAIM],
        this.room.name + ':' + game.time(),
        {
          memory: {
            'c': 'claimer',
            'g': 'claimer_' + tclaim,
            'tr': tclaim,
          },
        }
      );
    }

    if (game.rooms()[tclaim] && game.rooms()[tclaim].controller.my) {
      let troom = game.rooms()[tclaim];

      if (troom.find(FIND_MY_SPAWNS).length == 0) {
        if (group_count('claimer_' + tclaim) < 4) {
          console.log('trying to spawn claimer to create spawn');
          this.spawns[0].spawnCreep(
            [game.MOVE, game.MOVE, game.work, game.CARRY],
            this.room.name + ':' + game.time(),
            {
              memory: {
                'c': 'claimer',
                'g': 'claimer_' + tclaim,
                'tr': tclaim,
              }
            }
          );
        }
      }
    }

    if (creep_group_counts.fighter1 < 4 && this.spawns.length > 0) {
      this.spawns[0].spawnCreep(
        [game.ATTACK, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'fighter', 'g': 'fighter1', 'tr': 'E56S32' },
        }
      );
    }

    // Need a total work and carry power of 6 by 6 no fewer than 2 creeps.
    let work_power = 0;
    let carry_power = 0;

    _.each(this.creeps, creep => {
      //if (creep.creep.memory.c === 'fighter') {
      //  creep.creep.memory.tr = 'E56S32';
      //}

      if (creep.creep.memory.c !== 'gw') {
        return;
      }
      _.each(creep.creep.body, part => {
        if (part.type === game.WORK) {
          work_power++;
        }
        if (part.type === game.CARRY) {
          carry_power++;
        }
      });
    });

    let need_another = creep_group_counts.worker < 2 ||
                       work_power < 8 || carry_power < 8;

    if (creep_group_counts.worker >= 6) {
      need_another = false;
    }

    console.log('work_power', work_power);
    console.log('carry_power', carry_power);
    console.log('need_another', need_another);

    if (need_another) {
      let ea = this.room.energyCapacityAvailable;
      // WORK, CARRY, MOVE, MOVE is one unit
      let unit_cost = 100 + 50 + 50 + 50;
      let unit_count = Math.floor(ea / unit_cost);
      let body_spec = [];

      for (let x = 0; x < unit_count; ++x) {
        body_spec.push(game.WORK);
        body_spec.push(game.CARRY);
        body_spec.push(game.MOVE);
        body_spec.push(game.MOVE);
      }

      this.spawns[0].spawnCreep(
        body_spec,
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'gw', 'g': 'worker' },
        }
      );
    }

  }

  tick () {
    // Do all the housework that requires a spawn here.
    if (this.spawns.length > 0) {
      this.tick_need_spawn();
    }

    this.exts = [];
    this.towers = [];
    this.spawns = [];

    _.each(this.room.find(game.FIND_STRUCTURES), s => {
      switch (s.structureType) {
        case game.STRUCTURE_EXTENSION: this.exts.push(s); return;
        case game.STRUCTURE_TOWER: this.towers.push(s); return;
        case game.STRUCTURE_SPAWN: this.spawns.push(s); return;
      }
    });

    this.csites = this.room.find(game.FIND_CONSTRUCTION_SITES);
    let denergy = _.filter(this.room.find(game.FIND_DROPPED_RESOURCES), 
      i => i.resourceType === game.RESOURCE_ENERGY
    );

    let sources_and_denergy = [];
    _.each(this.sources, source => sources_and_denergy.push(source));
    _.each(denergy, i => sources_and_denergy.push(i));

    // Quick and dirty tower code.
    this.hcreeps = this.room.find(game.FIND_HOSTILE_CREEPS);
    if (this.hcreeps.length > 0) {
      let fhcreep = this.hcreeps[0];
      _.each(this.towers, tower => tower.attack(fhcreep));
    }

    // This is the decision tree for energy pulls. Where do I get
    // energy from?
    let dt_pull = [
      this.dt_pull_energy_nearby_sources(),
      this.dt_pull_sources(),
    ];

    // This is the decision tree for energy pushes. Where do I take
    // the energy to?
    let dt_push = [
      this.dt_push_controller_below_ticks(1000),
      this.dt_push_to_objects_with_stores(1.0, this.spawns),
      this.dt_push_to_objects_with_stores(1.0, this.exts),
      this.dt_push_to_objects_with_stores(1.0, this.towers),
      this.dt_push_road_repair_nearby(0.5),
      this.dt_push_nearest_csite(),
      this.dt_push_controller_always(),
    ];

    for (let ndx in this.creeps) {
      let creep = this.creeps[ndx];
      // Provide each creep with the decision tree entry function.
      creep.tick(
        () => this.dt_run(dt_pull, creep), 
        () => this.dt_run(dt_push, creep)
      );
    }
  }

  reg_put_intent (creep, trgt, restype, amount) {
    this.reg_put_intents.push({
      creep: creep,
      trgt: trgt.id,
      restype: restype,
      amount: amount,
    });
  }

  reg_get_intent (creep, trgt, restype, amount) {
    this.reg_get_intents.push({
      creep: creep,
      trgt: trgt.id,
      restype: restype,
      amount: amount,
    });
  }

  sum_get_intent (trgt, restype) {
    return _.sumBy(this.reg_get_intents, i => {
      if (i.trgt === trgt.id && i.restype === restype) {
        return i.amount;
      }
      return 0;
    });
  }

  max_get_intent (trgt, restype) {
    if (trgt.resourceType !== undefined && trgt.resourceType === restype) {
      let amount = _.sumBy(this.reg_get_intents, i => {
        if (i.trgt === trgt.id && i.restype === restype) {
          return i.amount;
        }
        return 0;
      });

      return amount >= trgt.amount;
    }

    switch (trgt.structureType) {
      case game.STRUCTURE_SOURCE:
        if (restype !== game.RESOURCE_ENERGY) {
          return true;
        }

        let count = _.sumBy(this.reg_get_intents, i => {
          if (i.trgt === trgt.id && i.restype === restype) {
            return 1;
          }
          return 0;
        });

        if (count >= this.get_source_spots(trgt)) {
          return true;
        } else {
          return false;
        }
      default:
        return false;
    }
  }

  max_put_intent (trgt, restype) {
    let amount = _.sumBy(this.reg_put_intents, i => {
      if (i.trgt === trgt.id && i.restype === restype) {
        return i.amount;
      }

      return 0;
    });

    switch (trgt.structureType) {
      case game.STRUCTURE_CONTROLLER: 
        if (restype === game.RESOURCE_ENERGY) {
          // TODO: unless its maxed out in level
          return false;
        }
        return true;
      case game.STRUCTURE_SPAWN:
      case game.STRUCTURE_EXTENSION:
        return trgt.store.getFreeCapacity(restype) - amount <= 0;
      default:
        return false;
    }
  }

  dt_pull_sources () {
    return (creep) => {
      let sources = _.filter(this.sources, s => {
        return this.sum_get_intent(s, game.RESOURCE_ENERGY) < s.energy;
      });
      return _.sample(_.filter(sources, s => s.energy > 0));
    };
  }

  dt_push_road_repair_nearby (threshold) {
    return (creep) => {
      let pos = creep.creep.pos;
      let structs = this.room.lookForAtArea(
        game.LOOK_STRUCTURES, pos.y - 3, pos.x - 3, pos.y + 3, pos.x + 3, true
      );
      let roads = _.filter(structs, s => s.structureType === game.STRUCTURE_ROAD);
      let road = _.find(roads, road => {
        let ratio = road.hits / ratio.hitsMax;
        return ratio < threshold;
      });
      return road;
    };
  }
  
  dt_pull_energy_nearby_sources () {
    return (creep) => {
      let energy = _.reduce(this.sources, (iv, source) => {
        let pos = source.pos;
        let energy = this.room.lookForAtArea(
          game.LOOK_ENERGY, pos.y - 1, pos.x - 1, pos.y + 1, pos.x + 1, true
        );
        _.each(energy, i => iv.push(i.energy));
        return iv;
      }, []);
      energy = _.filter(energy, e => {
        return !this.max_get_intent(e, game.RESOURCE_ENERGY);
      });
      return _.sample(energy);
    };
  }

  dt_push_controller_always () {
    return (creep) => {
      let c = this.room.controller;
      if (c && c.my) {
        return c;
      }
      return null;
    };
  }

  dt_push_controller_below_ticks (below_ticks) {
    return (creep) => {
      let c = this.room.controller;
      if (c && c.my && c.ticksToDowngrade <= below_ticks) {
        return c;
      }
      return null;
    };
  }

  dt_run (dt, creep) {
    for (let x = 0; x < dt.length; ++x) {
      let dte = dt[x];
      let trgt = dte(creep);
      if (trgt) {
        return trgt;
      }
    }

    return null;
  }

  dt_push_nearest_csite () {
    return (creep) => {
      let cx = creep.creep.pos.x;
      let cy = creep.creep.pos.y;
      let bcsite = null;
      let bdist = null;
      _.each(this.csites, csite => {
        let x = csite.pos.x;
        let y = csite.pos.y;
        let dx = x - cx;
        let dy = y - cy;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (bdist === null || dist < bdist) {
          bdist = dist;
          bcsite = csite;
        }
      });
      return bcsite;
    };
  }

  dt_push_to_objects_with_stores (threshold, objlist) {
    return (creep) => {
      let valids = _.filter(
        objlist, s => {
          let free = s.store.getFreeCapacity(game.RESOURCE_ENERGY);
          let used = s.store.getUsedCapacity(game.RESOURCE_ENERGY);
          let ratio = used / (used + free);
          if (ratio < threshold) {
            if (!this.max_put_intent(s, game.RESOURCE_ENERGY)) {
              return true;
            }
          }
          return false;
        }
      );
      return _.sample(valids);
    };
  }

  /*
   * OBSOLETE BY: dt_push_to_objects_with_stores
   *
  dt_push_extensions (threshold) {
    return (creep) => {
      let exts = _.filter(
        this.exts, s => {
          let free = s.store.getFreeCapacity(game.RESOURCE_ENERGY);
          let used = s.store.getUsedCapacity(game.RESOURCE_ENERGY);
          let ratio = used / free;
          if (ratio < threshold) {
            if (!this.max_put_intent(s, game.RESOURCE_ENERGY)) {
              return true;
            }
          }
          return false;
        }
      );
      return _.sample(exts);
    };
  }

  dt_push_spawns (threshold) {
    return (creep) => {
      let spawns = _.filter(
        this.spawns, s => {
          let free = s.store.getFreeCapacity(game.RESOURCE_ENERGY);
          let used = s.store.getUsedCapacity(game.RESOURCE_ENERGY);
          let ratio = used / free;
          if (ratio < threshold) {
            if (!this.max_put_intent(s, game.RESOURCE_ENERGY)) {
              return true;
            }
          }
          return false;
        }
      );
      return _.sample(spawns);
    };
  }
  */

  count_source_spots (src) {
    let spots = this.room.lookAtArea(
      src.pos.y - 1, src.pos.x - 1, src.pos.y + 1, src.pos.x + 1
    );

    let count = 0;
    for (let _y = -1; _y < 2; ++_y) {
      for (let _x = -1; _x < 2; ++_x) {
        let x = _x + src.pos.x;
        let y = _y + src.pos.y;

        if (spots[y] === undefined) continue;

        let spot = spots[y][x];
  
        if (spot === undefined) continue;
  
        spot = _.filter(spot, item => item.type !== 'creep');
  
        if (spot.length > 1) continue;
        if (spot[0].terrain === 'plain') {
          count++;
        }
      }
    }
    
    return count;
  }

  get_source_spots (src) {
    this.room.memory.ssc = this.room.memory.ssc || {};
    if (this.room.memory.ssc[src.id] === undefined) {
      this.room.memory.ssc[src.id] = this.count_source_spots(src);
    }
    return this.room.memory.ssc[src.id];
  }
}

module.exports.Room = Room;
