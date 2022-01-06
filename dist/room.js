const game = require('./game');
_ = game._;
const { CreepGeneralWorker } = require('./creepgw');
const { CreepDummy } = require('./creepdummy');
const { CreepMiner } = require('./creepminer');

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

  request_build_creep (ruid, body_unit, unit_min, unit_max, clazz, priority) {
    if (!_.some(this.breq, breq => {
      if (breq.ruid === ruid) {
        breq.body_unit = body_unit;
        breq.unit_min = unit_min;
        breq.unit_max = unit_max;
        breq.clazz = clazz;
        breq.priority = priority;
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
      default: this.creeps.push(new CreepDummy(this, creep)); break;
    }
  }

  tick () {
    // Do any accounting from registration of resource transfer intentions
    // on the previous tick.
    _.each(this.res_xfer_intents, intent => {
      let creep = game.creeps[intent.creep];
      let job = this.get_job_by_juid(intent.juid);
      
      if (creep === undefined || job === null)
        return;

      let delta = intent.amount - creep.store.getUsedCapacity(intent.rtype);

      if (delta > 0) {
        job.amount -= delta;
      }
    });

    let creep_group_counts = {
      'worker': 0,
      'minera': 0,
      'minerb': 0,
    };

    _.each(this.creeps, creep => {
      if (creep.creep.memory === undefined) {
        return;
      }
      if (creep_group_counts[creep.creep.memory.g] === undefined) {
        creep_group_counts[creep.creep.memory.g] = 0;
      }
      creep_group_counts[creep.creep.memory.g]++;
    });

    /*
    if (creep_group_counts.minera < 1 && this.spawns.length > 0) {
      this.spawns[0].spawnCreep(
        [game.WORK, game.WORK, game.WORK, game.MOVE, game.MOVE, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'miner', 'g': 'minera', 's': this.sources[0].id },
        }
      );
    }

    if (creep_group_counts.minerb < 1 && this.sources.length > 1 && this.spawns.length > 0) {
      this.spawns[0].spawnCreep(
        [game.WORK, game.WORK, game.WORK, game.MOVE, game.MOVE, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'miner', 'g': 'minerb', 's': this.sources[1].id },
        }
      );
    }
    */

    if (creep_group_counts.worker < 6 && this.spawns.length > 0) {
      this.spawns[0].spawnCreep(
        [game.WORK, game.CARRY, game.MOVE, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'gw', 'g': 'worker', 's': this.sources[1].id },
        }
      );
    }

    let csites = this.room.find(game.FIND_CONSTRUCTION_SITES);
    let denergy = _.filter(this.room.find(game.FIND_DROPPED_RESOURCES), 
      i => i.resourceType === game.RESOURCE_ENERGY
    );

    let sources_and_denergy = [];
    _.each(this.sources, source => sources_and_denergy.push(source));
    _.each(denergy, i => sources_and_denergy.push(i));

    let dt_pull = [
      this.dt_pull_sources(),
    ];

    let dt_push = [
      this.dt_push_controller_below_ticks(1000),
      this.dt_push_spawns(0),
      this.dt_push_nearest_csite(),
      this.dt_push_controller_always(),
    ];

    for (let ndx in this.creeps) {
      let creep = this.creeps[ndx];
      console.log('ticking creep');
      creep.tick(
        () => this.dt_run(dt_pull, creep), 
        () => this.dt_run(dt_push, creep)
      );
    }
  }

  dt_pull_sources () {
    return (creep) => {
      console.log('dt_pull_sources');
      _.each(this.sources, s => {
        console.log('@', s.energy);
      });
      return _.sample(_.filter(this.sources, s => s.energy > 0));
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
    console.log('dt_run');
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
        let cx = x - cx;
        let cy = y - cy;
        let dist = Math.sqrt(cx * cx + cy * cy);
        if (bdist === null || dist < bdist) {
          bdist = dist;
          bcsite = csite;
        }
      });
      return bcsite;
    };
  }

  dt_push_spawns (threshold) {
    return (creep) => {
      let spawns = _.filter(
        this.spawns, s => s.store.getFreeCapacity(game.RESOURCE_ENERGY) > threshold
      );
      return _.sample(spawns);
    };
  }

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
