const game = require('./game');
_ = game._;
const { CreepGeneralWorker } = require('./creepgw');
const { CreepDummy } = require('./creepdummy');
const { CreepMiner } = require('./creepminer');
const { CreepFighter } = require('./creepfighter');
const { CreepClaimer } = require('./creepclaimer');
const { CreepUpgrader } = require('./creepupgrader');
const { SpawnManager } = require('./spawn');
const { CreepRemoteMiner } = require('./creeprminer');
const { CreepRemoteHauler } = require('./creeprhauler');
const { Stats } = require('./stats');
const { CreepLabRat, LabManager } = require('./labrats');

class Room {
  constructor (room, ecfg) {
    this.room = room;
    this.creeps = [];
    this.room.memory.mi = this.room.memory.mi || {};
    this.room.memory.jobs = this.room.memory.jobs || [];
    this.jobs = this.room.memory.jobs;
    this.room.memory.jobs_uid = this.room.memory.jobs_uid || 0;
    this.breq = [];
    this.room.memory.res_xfer_intents = this.room.memory.res_xfer_intents || [];
    this.res_xfer_intents = this.room.memory.res_xfer_intents;
    this.ecfg = ecfg;
    this.spawnman = new SpawnManager();
    this.stats = new Stats();
  }

  record_stat (key, value) {
    this.stats.record_stat(`${this.get_name()}.${key}`, value);
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

  get_name () {
    return this.room.name;
  }

  get_terminal () {
    return this.room.terminal;
  }

  get_controller () {
    return this.room.controller;
  }

  get_storage () {
    return this.room.storage;
  }

  get_spawnman () {
    return this.spawnman;
  }

  think_build_creep () {
  }

  hook_creep_method (creep, method, stat_name) {
    creep[`_${method}`] = creep[method];

    let work_count = _.sumBy(creep.body, part => part.type === game.WORK);
    
    switch (method) {
      case 'upgradeController': 
        creep.upgradeController = trgt => {
          let res = creep._upgradeController(trgt);
          if (res === game.OK) {
            let value = creep.memory[stat_name] === undefined ? 0 : creep.memory[stat_name];
            creep.memory[stat_name] += work_count;
          }
          return res;
        };
        break;
      case 'repair': 
        creep.repair = trgt => {
          let res = creep._repair(trgt);
          if (res === game.OK) {
            let value = creep.memory[stat_name] === undefined ? 0 : creep.memory[stat_name];
            creep.memory[stat_name] += work_count;
          }
          return res;
        };
        break;    
      case 'withdraw': 
        creep.withdraw = (trgt, rtype, amt) => {
          let res = creep._withdraw(trgt, rtype, amt);
          if (res === game.OK) {
            let value = creep.memory[stat_name] === undefined ? 0 : creep.memory[stat_name];
            creep.memory[stat_name] += amt;
          }
          return res;
        };
        break; 
      case 'transfer': 
        creep.transfer = (trgt, rtype, amt) => {
          let res = creep._transfer(trgt, rtype, amt);
          if (res === game.OK) {
            let value = creep.memory[stat_name] === undefined ? 0 : creep.memory[stat_name];
            creep.memory[stat_name] += amt;
          }
          return res;
        };
        break;
      case 'harvest': 
        creep.harvest = trgt => {
          let res = creep._harvest(trgt);
          if (res === game.OK) {
            let value = creep.memory[stat_name] === undefined ? 0 : creep.memory[stat_name];
            creep.memory[stat_name] += work_count;
          }
          return res;
        };
        break;
      default:
        throw new Error('The method specified is unknown.'); 
    }
  }

  add_creep_death (creep_memory) {
    const m = creep_memory;
    const score = (m.st_up || 0) + (m.st_rp || 0) + (m.st_xf || 0);
    const rm = this.room.memory; 
    rm.scores = rm.scores ? rm.scores : [];

    this.record_stat('creep.death', {
      c: m.c,
      g: m.g,
      score: score,
    }); 
  }

  add_creep (creep) {
    this.hook_creep_method(creep, 'harvest', 'st_hr');
    this.hook_creep_method(creep, 'upgradeController', 'st_up');
    this.hook_creep_method(creep, 'repair', 'st_rp');
    this.hook_creep_method(creep, 'withdraw', 'st_wt');
    this.hook_creep_method(creep, 'transfer', 'st_xf');

    if (game.RoomVisual) {
      const cm = creep.memory;
      const score = (cm.st_hr || 0) + (cm.st_up || 0) + 
                    (cm.st_rp || 0) + (cm.st_xf || 0);
      let rv = new game.RoomVisual(creep.pos.roomName);
      rv.text(`${score}`, creep.pos.x, creep.pos.y);
    }

    switch (creep.memory.c) {
      case 'gw': 
        this.creeps.push(new CreepGeneralWorker(this, creep));
        break;
      case 'rminer':
        this.creeps.push(new CreepRemoteMiner(this, creep));
        break;
      case 'rhauler':
        this.creeps.push(new CreepRemoteHauler(this, creep));
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
      case 'labrat':
        this.creeps.push(new CreepLabRat(this, creep));
        break;
      default: 
        this.creeps.push(new CreepDummy(this, creep));
        break;
    }
  }

  group_count (gname) {
    if (this.creep_group_counts[gname] === undefined) {
      return 0;
    }

    return this.creep_group_counts[gname];
  }

  tick_need_spawn () {
    let creep_group_counts = {
      'worker': 0,
      'hauler': 0,
      'minera': 0,
      'minerb': 0,
      'fighter1': 0,
      'upgrader': 0,
    };

    this.creep_group_counts = creep_group_counts;

    function group_count (gname) {
      return creep_group_counts[gname] || 0;
    }
    
    ////////////////////////////////////////////////////////////
    let cur_opto_cycle = game.time() >> 11;
    this.room.memory.opto = this.room.memory.opto || {};
    let opto = this.room.memory.opto;
    if (cur_opto_cycle !== opto.cycle) {
      // Save previous heuristic. This should over time reflect
      // the direction needed to improve performance.
      opto.history = opto.history || [];
      if (opto.worker_level_adj !== undefined) {
        opto.history.push({
          control: opto.energy_spent_control,
          worker_level_adj: opto.worker_level_adj,
          hauler_level_adj: opto.hauler_level_adj
        });
      }
      // Start a new cycle with a random offset.
      opto.cycle = cur_opto_cycle;
      // Generate new random multi-dimensional variable offset.
      opto.worker_level_adj = 
        -Math.round(Math.random() * 4);
      opto.hauler_level_adj =
        -Math.round(Math.random() * 4);
      opto.energy_spent_control = 0;
    }
    ////////////////////////////////////////////////////////////

    _.each(this.creeps, creep => {
      if (creep.creep.memory === undefined) {
        return;
      }
      if (creep_group_counts[creep.creep.memory.g] === undefined) {
        creep_group_counts[creep.creep.memory.g] = 0;
      }
      creep_group_counts[creep.creep.memory.g]++;
    });

    let roomEnergy = this.room.energyCapacityAvailable;
    if (creep_group_counts.worker === 0 && creep_group_counts.hauler === 0) {
      console.log(`emergency room energy levels set for room ${this.room.name}`);
      roomEnergy = 300;
    }
    
    /*
    if (this.room.name === 'E56S31') {
      let tclaim = 'E57S31';

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
          if (group_count('claimer_' + tclaim) < 6) {
            console.log('trying to spawn claimer to create spawn');
            let res = this.spawns[0].spawnCreep(
              [game.MOVE, game.MOVE, game.WORK, game.CARRY],
              this.room.name + ':' + game.time(),
              {
                memory: {
                  'c': 'claimer',
                  'g': 'claimer_' + tclaim,
                  'tr': tclaim,
                }
              }
            );
            console.log('res', res);
          }
        }
      }

      //console.log('----------------');
   }
    */

    function *miner_bf() {
        let body = [];
        body.push(game.MOVE);
        body.push(game.CARRY);
        while (true) {
            body.push(game.WORK);
            yield body
        }
    }    

    function *remote_miner_bf() {
        let body = [];
        body.push(game.MOVE);
        body.push(game.CARRY);
        while (true) {
            body.push(game.MOVE);
            body.push(game.WORK);
            yield body
        }
    }    

    function *remote_hauler_bf() {
        let body = [];
        body.push(game.MOVE);
        body.push(game.WORK);
    
        while (true) {
            body.push(game.MOVE);
            body.push(game.CARRY);
            yield body
        }
    }

    function *worker_bf() {
      let body = [];
      while (true) {
        body.push(game.MOVE);
        body.push(game.MOVE);
        body.push(game.WORK);
        body.push(game.CARRY);
        yield body
      }
    }

    function *hauler_bf() {
      let body = [];
      while (true) {
        body.push(game.MOVE);
        body.push(game.CARRY); 
        yield body;
      } 
    }

    function *upgrader_bf() {
      let body = [];
      body.push(game.CARRY);
      body.push(game.MOVE);
      while (true) {
        body.push(game.WORK);
        yield body;
      }
    }

    if (this.ecfg.remote_sources) {
      _.each(this.ecfg.remote_sources, rsrc_op => {
        this.spawnman.reg_build(
          'rminer',
          `miner_remote:${rsrc_op.uid}`,
          remote_miner_bf,
          rsrc_op.mining_level,
          5,
          1,
          {
            s: rsrc_op.sources,
          }
        );        
        this.spawnman.reg_build(
          'rhauler',
          `hauler_remote:${rsrc_op.uid}`,
          remote_hauler_bf,
          rsrc_op.hauling_power,
          6,
          1,
          {
            s: rsrc_op.sources,
          },
          rsrc_op.hauling_power
        );        
      });
    }

    if (this.ecfg.warfare_small) {
      function *fighter_bf() {
        let body = [];
        while (true) {
          body.push(game.MOVE);
          body.push(game.ATTACK); 
          yield body;
        } 
      }
      _.each(this.ecfg.warfare_small, op => {
        this.spawnman.reg_build(
          'fighter',
          `warfare_small:${op.uid}`,
          fighter_bf,
          op.max_level,
          5,
          op.count,
          {
            tr: op.room,
          }
        );
      });
    }

    function *miner_bf() {
        let body = [];
        body.push(game.MOVE);
        body.push(game.CARRY);
        while (true) {
            body.push(game.WORK);
            yield body
        }
    }    

    if (this.sources.length > 0) {
      this.spawnman.reg_build(
          'miner',
          'minera',
          miner_bf,
          5,
          0,
          1,
          {
              s: this.sources[0].id,
          }
      );
    }
  
    if (this.sources.length > 1) {
      this.spawnman.reg_build(
          'miner',
          'minerb',
          miner_bf,
          5,
          1,
          1,
          {
              s: this.sources[1].id,
          }
      );      
    }

    this.spawnman.reg_build(
      'gw',
      'worker',
      worker_bf,
      7,
      -1,
      2,
      {}
    );

    this.spawnman.reg_build(
      'gw',
      'hauler',
      hauler_bf,
      18,
      1,
      1,
      {}
    );

    
    let stor_energy_amount = this.get_storage() ? this.get_storage().store.getUsedCapacity(game.RESOURCE_ENERGY) : 0;
    let srcs_count = this.sources.length;

    let upgrader_level = Math.floor((stor_energy_amount / 10000) * 5) * srcs_count;
    
    this.spawnman.reg_build(
      'upgrader',
      'upgrader',
      upgrader_bf,
      upgrader_level,
      2,
      1,
      {}
    );
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
    this.reg_put_intents = [];
    this.reg_get_intents = [];

    this.spawns = this.room.find(game.FIND_MY_SPAWNS);
    this.sources = this.room.find(game.FIND_SOURCES); 
 
    // Do all the housework that requires a spawn here.
    if (this.spawns.length > 0) {
      this.tick_need_spawn();
    }

    this.exts = [];
    this.towers = [];
    this.structs = [];
    this.roads = [];
    this.containers = [];
    this.containers_near_sources = [];
    this.active_containers_near_sources = [];
    this.containers_near_sources_with_energy = [];
    this.containers_adj_controller = [];
    this.active_containers_adj_controller = [];
    this.links = [];
    this.links_adj_storage = [];
    this.labs = [];
    this.extractors = [];

    _.each(this.room.find(game.FIND_STRUCTURES), s => {
      this.structs.push(s);
      switch (s.structureType) {
        case game.STRUCTURE_EXTENSION: this.exts.push(s); return;
        case game.STRUCTURE_TOWER: this.towers.push(s); return;
        case game.STRUCTURE_SPAWN: this.spawns.push(s); return;
        case game.STRUCTURE_ROAD: this.roads.push(s); return;
        case game.STRUCTURE_LAB: this.labs.push(s); return;
        case game.StRUCTURE_EXTRACTOR: this.extractors.push(s); return;
        case game.STRUCTURE_LINK:
          this.links.push(s);
          let rstor = this.room.storage;
          if (rstor) {
            if (s.pos.isNearTo(rstor)) {
              this.links_adj_storage.push(s);
            }
          }
          return;
        case game.STRUCTURE_CONTAINER: 
          this.containers.push(s); 
          if (_.some(this.sources, src => s.pos.isNearTo(src))) {
            this.containers_near_sources.push(s);
            if (this.container_evaluate_state(s, 100, 1200)) {
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


    this.record_stat('dropped.energy', _.sumBy(denergy, e => e.amount));

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
      this.dt_push_to_objects_with_stores(1.0, this.spawns.concat(this.exts)),
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
        () => this.group_count('worker') > 0,
        [
          // If we have workers.
          this.dt_pull_from_objects_with_stores(
            0.0, this.links_adj_storage, {},
            lst => { 
              lst.sort((a, b) => {
                return a.store.getUsedCapacity(game.RESOURCE_ENERGY) >
                       b.store.getUsedCapacity(game.RESOURCE_ENERGY) ? -1 : 1;
              })
              return lst[0];
            }
          ),
          this.dt_pull_from_objects_with_stores(
            0.0, this.active_containers_near_sources
          ),
          this.dt_pull_energy_nearby_sources(),
        ],
        [
          // If there are no workers. Then, do their job.
          // If we have workers.
          this.dt_pull_from_objects_with_stores(
            0.0, this.links_adj_storage,
          ),
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
      this.dt_push_to_objects_with_stores(1.0, this.spawns.concat(this.exts)),
      this.dt_push_to_objects_with_stores(1.0, this.towers),
      this.dt_push_to_objects_with_stores(1.0, this.active_containers_adj_controller),
      this.dt_push_storage(100000),
    ];

    let lab_creeps = [];

    for (let ndx in this.creeps) {
      let creep = this.creeps[ndx];

      if (creep instanceof CreepLabRat) {
        lab_creeps.push(creep);
        continue;
      }

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

    let lab_task = task.spawn_isolated(40, `labman`, ctask => {
      let labman = new LabManager(this);
      labman.tick(ctask, lab_creeps, this.labs, this.extractors);
    });

    task.transfer(lab_task, 1, 5);

    task.spawn(100, `spawnman`, ctask => {
      let room_energy = this.room.energyCapacityAvailable;
      let workers = this.group_count('worker');
      let haulers = this.group_count('hauler');

      if (workers === 0 && haulers === 0) {
        room_energy = 300;
      }

      this.spawnman.process(this, room_energy, this.creeps, this.spawns);
    });
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

  dt_pull_storage (oneshot) {
    return (creep) => {
      if (!this.room.storage) {
        return [null, false];
      }

      if (this.room.storage.store.getUsedCapacity(
        game.RESOURCE_ENERGY
      ) == 0) {
        return [null, false];
      }

      return [this.room.storage, oneshot];
    };
  }

  dt_cond (cond_func, dtlist_true, dtlist_false) {
    return creep => {
      if (cond_func()) {
        return dtlist_true ? [dtlist_true, false] : [null, false];
      }
      return dtlist_false ? [dtlist_false, false] : [null, false];
    };
  }

  dt_pull_sources (oneshot) {
    return (creep) => {
      let sources = _.filter(this.sources, s => {
        return this.sum_get_intent(s, game.RESOURCE_ENERGY) < s.energy;
      });
      return [
        _.sample(_.filter(sources, s => s.energy > 0)),
        oneshot
      ];
    };
  }

  dt_repair (threshold, oneshot) {
    return (creep) => {
      let valid = _.filter(this.structs, s => {
        return (s.hits / s.hitsMax) < threshold;
      });
      return [
        creep.get_pos().findClosestByPath(valid),
        oneshot
      ];
    };
  }

  dt_push_storage (threshold_amount, oneshot) {
    return (creep) => {
      if (!this.room.storage) {
        return [null, oneshot];
      }
      
      let used = this.room.storage.store.getUsedCapacity(
        game.RESOURCE_ENERGY
      );
      let free = this.room.storage.store.getFreeCapacity(
        game.RESOURCE_ENERGY
      );

      if (used > threshold_amount) {
        return [null, oneshot];
      }

      return [
        this.room.storage,
        oneshot
      ];
    };
  }

  dt_push_road_repair_nearby (threshold, oneshot) {
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
      return [road, oneshot];
    };
  }

  dt_pull_energy_containers_nearby_sources (oneshot) {
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
        return [
            creep.get_pos().findClosestByPath(conts),
            oneshot
        ];
    };
  }  

  dt_pull_energy_containers_nearby_sources_with_most (min_threshold_amount, oneshot) {
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

        return [
            conts.length > 0 ? conts[0] : null,
            oneshot
        ];
    };
  }  

  dt_pull_energy_nearby_sources (oneshot) {
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
      return [
        creep.get_pos().findClosestByPath(energy),
        oneshot
      ];
    };
  }

  dt_push_controller_always (oneshot) {
    return (creep) => {
      let c = this.room.controller;
      if (c && c.my) {
        return [c, oneshot];
      }
      return [null, oneshot];
    };
  }

  dt_push_controller_below_ticks (below_ticks, oneshot) {
    return (creep) => {
      let c = this.room.controller;
      if (c && c.my && c.ticksToDowngrade <= below_ticks) {
        return [c, oneshot];
      }
      return [null, oneshot];
    };
  }

  dt_run (dt, creep) {
    for (let x = 0; x < dt.length; ++x) {
      let dte = dt[x];
      let trgt = dte(creep);

      if (!trgt[0]) {
        continue;
      }

      // It returned a list. Which is going to be a set of
      // decision tree nodes we need to execute.
      if (trgt[0].length !== undefined) {
        let res = this.dt_run(trgt[0], creep);
        // If it gave us a valid target then return it.
        if (res.trgt) {
          return {
            trgt: res.trgt,
            opts: res.opts,
          }
        }
        
        // If not, then keep going.
        continue;
      }

      // We have a valid target.
      return {
        trgt: trgt[0],
        opts: trgt[1],
      };
    }
    
    return {
        trgt: null,
        oneshot: false,
    };
  }

  dt_push_nearest_csite (oneshot) {
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
      return [bcsite, oneshot];
    };
  }

  dt_push_container_adjacent_controller (oneshot) {
    return (creep) => {
        let c = this.room.controller;
        let cont = _.filter(
            c.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
            return struct.structureType === game.STRUCTURE_CONTAINER
        });
        return [
            cont.length > 0 ? cont[0] : null,
            oneshot
        ];
    };
  }

  dt_pull_from_objects_with_stores (threshold, objlist, oneshot, efunc) {
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
          return [null, oneshot];
      }
      let nearest;
      
      if (efunc) {
        nearest = efunc(valids);
      } else {
        nearest = creep.get_pos().findClosestByPath(valids);
      }

      console.log('nearest', nearest);
      return [nearest, oneshot];
    };
  }

  dt_push_to_objects_with_stores (threshold, objlist, oneshot) {
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
          return [null, oneshot];
      }
      return [creep.get_pos().findClosestByPath(valids), oneshot];
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
