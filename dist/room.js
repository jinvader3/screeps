const game = require('./game');
_ = game._;
const { CreepGeneralWorker } = require('./creepgw');
const { CreepDummy } = require('./creepdummy');
const { CreepMiner } = require('./creepminer');
const { CreepFighter } = require('./creepfighter');
const { CreepClaimer } = require('./creepclaimer');
const { CreepUpgrader } = require('./creepupgrader');

class Room {
  constructor (room) {
    this.room = room;
    this.creeps = [];
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

  get_controller () {
    return this.room.controller;
  }

  think_build_creep () {
  }

  add_creep (creep) {
    switch (creep.memory.c) {
      case 'gw': 
        this.creeps.push(new CreepGeneralWorker(this, creep));
        break;
      case 'miner': 
        this.creeps.push(new CreepMiner(this, creep));
        break;
      case 'fighter': 
        this.creeps.push(new CreepFighter(this, creep));
        break;
      case 'claimer': 
        this.creeps.push(new CreepClaimer(this, creep));
        break;
      case 'upgrader':
        this.creeps.push(new CreepUpgrader(this, creep));
        break;
      default: 
        this.creeps.push(new CreepDummy(this, creep));
        break;
    }
  }

  tick_need_spawn () {
    let creep_group_counts = {
      'worker': 0,
      'hauler': 0,
      'minera': 0,
      'minerb': 0,
      'fighter': 0,
      'upgrader': 0,
    };

    this.creep_group_counts = creep_group_counts;

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

    if (
      // We must have zero miner type As.
      creep_group_counts.minera < 1 && 
      // We must have at least one spawn.
      this.spawns.length > 0 &&
      // We must have at least one source.
      this.sources.length > 0) {
      this.spawns[0].spawnCreep(
        [game.WORK, game.WORK, game.WORK, game.WORK, game.WORK, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'miner', 'g': 'minera', 's': this.sources[0].id },
        }
      );
    }

    if (
      creep_group_counts.minerb < 1 && 
      this.sources.length > 1 && 
      this.spawns.length > 0) {
      this.spawns[0].spawnCreep(
        [game.WORK, game.WORK, game.WORK, game.WORK, game.WORK, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'miner', 'g': 'minerb', 's': this.sources[1].id },
        }
      );
    }

    let tclaim = 'E56S31';

    /*
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
    */

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

    /*
    if (creep_group_counts.fighter1 < 4 && this.spawns.length > 0) {
      this.spawns[0].spawnCreep(
        [game.ATTACK, game.MOVE],
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'fighter', 'g': 'fighter1', 'tr': 'E56S32' },
        }
      );
    }
    */

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

    //let req_work_power = 8;
    //let req_carry_power = 8;

    //let need_another = 
    //  creep_group_counts.worker < 2 ||
    //  work_power < req_work_power || 
    //  carry_power < req_carry_power;
    let need_another = true;

    if (creep_group_counts.worker >= 2) {
      need_another = false;
    }

    //console.log(`WORK-PWR[${work_power}] CARRY-PWR[${carry_power}]`);
    //console.log(`NEED_ANOTHER_WORKER=${need_another}`);

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

    if (creep_group_counts.hauler === 0) {
      let ea = this.room.energyCapacityAvailable;
      // WORK, CARRY, MOVE, MOVE is one unit
      let unit_cost = 50 + 50;
      let unit_count = Math.floor(ea / unit_cost);
      let body_spec = [];

      for (let x = 0; x < unit_count; ++x) {
        body_spec.push(game.CARRY);
        body_spec.push(game.MOVE);
      }

      this.spawns[0].spawnCreep(
        body_spec,
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'gw', 'g': 'hauler' },
        }
      );        
    }

    if (creep_group_counts.upgrader === 0) {
      let ea = this.room.energyCapacityAvailable;
      let unit_cost = 50 + 100 + 100 + 50;
      let unit_count = Math.floor(ea / unit_cost);
      let body_spec = [];

      for (let x = 0; x < unit_count; ++x) {
        body_spec.push(game.CARRY);
        body_spec.push(game.WORK);
        body_spec.push(game.WORK);
        body_spec.push(game.MOVE);
      }

      this.spawns[0].spawnCreep(
        body_spec,
        this.room.name + ':' + game.time(),
        {
          memory: { 'c': 'upgrader', 'g': 'upgrader' },
        }
      );        
    }
  }

  container_evaluate_state (cont, on_amount, off_amount) {
    let m = this.room.memory;
    m.aconts = m.aconts || {};
    
    let used = cont.store.getUsedCapacity(game.RESOURCE_ENERGY);
    
    let state = m.aconts[cont.id] || 'on';

    if (state === 'on') {
      if (used < on_amount) {
        m.aconts[cont.id] = 'off';
      } else {
        m.aconts[cont.id] = 'on';
      } 
    } else {
      if (used > off_amount) {
        m.aconts[cont.id] = 'on';
      } else {
        m.aconts[cont.id] = 'off';
      }
    }

    return m.aconts[cont.id] === 'on';
  }

  tick (task) {
    // The `tick_need_spawn` will populate this.
    this.creep_group_counts = {}

    this.spawns = this.room.find(game.FIND_MY_SPAWNS);
    this.sources = this.room.find(game.FIND_SOURCES); 
 
    // Do all the housework that requires a spawn here.
    if (this.spawns.length > 0) {
      this.tick_need_spawn();
    }

    this.exts = [];
    this.towers = [];
    this.spawns = [];
    this.structs = [];
    this.roads = [];
    this.containers = [];
    this.containers_near_sources = [];
    this.active_containers_near_sources = [];
    this.containers_near_sources_with_energy = [];
    this.containers_adj_controller = [];
    this.active_containers_adj_controller = [];

    _.each(this.room.find(game.FIND_STRUCTURES), s => {
      this.structs.push(s);
      switch (s.structureType) {
        case game.STRUCTURE_EXTENSION: this.exts.push(s); return;
        case game.STRUCTURE_TOWER: this.towers.push(s); return;
        case game.STRUCTURE_SPAWN: this.spawns.push(s); return;
        case game.STRUCTURE_ROAD: this.roads.push(s); return;
        case game.STRUCTURE_CONTAINER: 
          this.containers.push(s); 
          if (_.some(this.sources, src => s.pos.isNearTo(src))) {
            this.containers_near_sources.push(s);
            if (this.container_evaluate_state(s, 500, 1500)) {
              this.active_containers_near_sources.push(s);
            }
            if (s.store.getUsedCapacity(game.RESOURCE_ENERGY) > 0) {
              this.containers_near_sources_with_energy.push(s);
            }
          }
          if (s.pos.isNearTo(this.room.controller)) {
            this.containers_adj_controller.push(s);
            if (!this.container_evaluate_state(s, 500, 1500)) {
              this.active_containers_adj_controller.push(s);
            }
          }
          return;
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

    
    // This is the decision tree for energy pushes. Where do I take
    // the energy to?
    let dt_push = [
      this.dt_push_controller_below_ticks(1000),
      this.dt_push_to_objects_with_stores(1.0, this.spawns),
      this.dt_push_to_objects_with_stores(1.0, this.exts),
      this.dt_push_to_objects_with_stores(1.0, this.towers),
      this.dt_cond(
        () => {
          // Make sure there is always enough to keep the spawns and
          // extensions filled. Don't pump the controller so hard we
          // run completely dry.
          let rstor = this.room.storage;
          if (!rstor)
            return true;
          if (rstor.store.getUsedCapacity(game.RESOURCE_ENERGY) > 3000)
            return true;
          return false;
        },
        [
          this.dt_repair(0.5),
          this.dt_push_nearest_csite(),
          this.dt_push_to_objects_with_stores(
            1.0, this.active_containers_adj_controller 
          ),
          this.dt_push_controller_always(),
        ]
      ),
    ];

    let dt_worker_pull = [
      this.dt_pull_storage(),
      this.dt_pull_energy_nearby_sources(),
      this.dt_pull_energy_containers_nearby_sources(),
      this.dt_pull_sources(),
    ];

    let dt_hauler_pull = [
      this.dt_cond(
        () => this.creep_group_counts.worker > 0,
        [
          // If we have workers.
          this.dt_pull_from_objects_with_stores(
            0.0, this.active_containers_near_sources
          ),
          this.dt_pull_energy_nearby_sources(),
        ],
        [
          // If there are no workers. Then, do their job.
          this.dt_pull_storage(),
          this.dt_pull_from_objects_with_stores(
            0.0, this.containers_near_sources_with_energy
          ),
          this.dt_pull_energy_nearby_sources(),
        ]
      ),
    ];

    let dt_push_hauler = [
      this.dt_cond(
        () => this.creep_group_counts.worker > 0, 
        [
          // Fill the storage until it hits 10k.
          this.dt_push_storage(10000)
        ],
      ),
      this.dt_push_to_objects_with_stores(1.0, this.spawns),
      this.dt_push_to_objects_with_stores(1.0, this.exts),
      this.dt_push_to_objects_with_stores(1.0, this.towers),
      this.dt_push_container_adjacent_controller(),
    ];

     for (let ndx in this.creeps) {
      let creep = this.creeps[ndx];
      if (creep.get_group() === 'hauler') {
        let _dt_pull = () => this.dt_run(dt_hauler_pull, creep);
        let _dt_push = () => this.dt_run(dt_push_hauler, creep);
        task.spawn(0, `creep:${creep.get_name()}`, ctask => {
          creep.tick(_dt_pull, _dt_push);
        });
      } else {
        let _dt_pull = () => this.dt_run(dt_worker_pull, creep);
        let _dt_push = () => this.dt_run(dt_push, creep);
        task.spawn(0, `creep:${creep.get_name()}`, ctask => {
          creep.tick(_dt_pull, _dt_push);
        });
      }

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

  dt_pull_storage () {
    return (creep) => {
      if (!this.room.storage) {
        return null;
      }

      if (this.room.storage.store.getUsedCapacity(
        game.RESOURCE_ENERGY
      ) == 0) {
        return null;
      }

      return this.room.storage;
    };
  }

  dt_cond (cond_func, dtlist_true, dtlist_false) {
    return creep => {
      if (cond_func()) {
        return dtlist_true ? dtlist_true : null;
      }
      return dtlist_false ? dtlist_false : null;
    };
  }

  dt_pull_sources () {
    return (creep) => {
      let sources = _.filter(this.sources, s => {
        return this.sum_get_intent(s, game.RESOURCE_ENERGY) < s.energy;
      });
      return _.sample(_.filter(sources, s => s.energy > 0));
    };
  }

  dt_repair (threshold) {
    return (creep) => {
      let valid = _.filter(this.structs, s => {
        return (s.hits / s.hitsMax) < threshold;
      });
      return creep.get_pos().findClosestByPath(valid);
    };
  }

  dt_push_storage (threshold_amount) {
    return (creep) => {
      if (!this.room.storage) {
        return null;
      }
      
      let used = this.room.storage.store.getUsedCapacity(
        game.RESOURCE_ENERGY
      );
      let free = this.room.storage.store.getFreeCapacity(
        game.RESOURCE_ENERGY
      );

      if (used > threshold_amount) {
        return null;
      }

      return this.room.storage;
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
        let ratio = road.hits / road.hitsMax;
        return ratio < threshold;
      });
      return road;
    };
  }

  dt_pull_energy_containers_nearby_sources () {
    return (creep) => {
        let conts = _.reduce(this.sources, (iv, source) => {
          let conts = _.filter(
              source.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
              return struct.structureType === game.STRUCTURE_CONTAINER
          });
          conts = _.filter(conts, cont => 
            cont.store.getUsedCapacity(game.RESOUCE_ENERGY) > 0
          );
          _.each(conts, cont => iv.push(cont));
          return iv;
        }, []);
        return creep.get_pos().findClosestByPath(conts);
    };
  }  

  dt_pull_energy_containers_nearby_sources_with_most (min_threshold_amount) {
    return (creep) => {
        let conts = _.reduce(this.sources, (iv, source) => {
          let conts = _.filter(
              source.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
              return struct.structureType === game.STRUCTURE_CONTAINER
          });
          conts = _.filter(conts, cont => 
            cont.store.getUsedCapacity(game.RESOUCE_ENERGY) > min_threshold_amount
          );
          _.each(conts, cont => iv.push(cont));
          return iv;
        }, []);

        conts.sort((a, b) => {
          let au = a.store.getUsedCapacity(game.RESOURCE_ENERGY);
          let bu = b.store.getUsedCapacity(game.RESOURCE_ENERGY);
          return au > bu ? -1 : 1;
        });

        return conts.length > 0 ? conts[0] : null;
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
      return creep.get_pos().findClosestByPath(energy);
      //return _.sample(energy);
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

      if (trgt === null) {
        continue;
      }

      if (trgt.length !== undefined) {
        // The entry provided a sub-list (decision list) which
        // we can execute.
        let res = this.dt_run(trgt, creep);
        if (res !== null) {
          return res;
        } 
      } else {
        if (trgt) {
          return trgt;
        }
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

  dt_push_container_adjacent_controller () {
    return (creep) => {
        let c = this.room.controller;
        let cont = _.filter(
            c.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
            return struct.structureType === game.STRUCTURE_CONTAINER
        });
        return cont.length > 0 ? cont[0] : null;
    };
  }

  dt_pull_from_objects_with_stores (threshold, objlist) {
    return (creep) => {
      let valids = _.filter(
        objlist, s => {
          let free = s.store.getFreeCapacity(game.RESOURCE_ENERGY);
          let used = s.store.getUsedCapacity(game.RESOURCE_ENERGY);
          let ratio = used / (used + free);
          if (ratio > threshold) {
            if (!this.max_get_intent(s, game.RESOURCE_ENERGY)) {
              return true;
            }
          }
          return false;
        }
      );
      if (valids.length === 0) {
          return null;
      }
      return creep.get_pos().findClosestByPath(valids);
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
      if (valids.length === 0) {
          return null;
      }
      return creep.get_pos().findClosestByPath(valids);
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
