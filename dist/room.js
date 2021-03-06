const game = require('./game');
const _ = game._;
const { CreepGeneralWorker } = require('./creepgw');
const { CreepDummy } = require('./creepdummy');
const { CreepMiner } = require('./creepminer');
const { CreepFighter } = require('./creepfighter');
const { CreepScout } = require('./creepscout');
const { CreepClaimer } = require('./creepclaimer');
const { CreepUpgrader } = require('./creepupgrader');
const { SpawnManager } = require('./spawn');
const { CreepRemoteMiner } = require('./creeprminer');
const { CreepRemoteHauler } = require('./creeprhauler');
const { Stats } = require('./stats');
const { CreepLabRat, LabManager } = require('./labrats');
const { logging } = require('./logging');
const { AutoBuilder } = require('./autobuild');
const { AutoBuild2 } = require('./autobuild2');
const { CreepBooster } = require('./creepbooster');
const { PowerMiner } = require('./powermining');
const { DepositMiner, CreepDepositMiner } = require('./depositmining');

///////////////////////////////////////////////////
// MODULE REGISTRATION                           //
//                                               //
// Modules extend the functionality of the room. //
//                                               //
///////////////////////////////////////////////////
const G_modules = [];
const G_creepclazzes = {};

function register_module(mod) {
  G_modules.push(mod);
}

function register_creep(clazz, jstype) {
  G_creepclazzes[clazz] = jstype;
}

register_creep('booster', CreepBooster);
register_creep('gw', CreepGeneralWorker);
register_creep('rminer', CreepRemoteMiner);
register_creep('rhauler', CreepRemoteHauler);
register_creep('miner', CreepMiner);
register_creep('fighter', CreepFighter);
register_creep('claimer', CreepClaimer);
register_creep('upgrader', CreepUpgrader);
register_creep('labrat', CreepLabRat);
register_creep('scout', CreepScout);
register_creep('depositminer', CreepDepositMiner);

register_module({
  priority: 0,
  name: 'powermining',
  entry: (new PowerMiner()).entry, 
});

register_module({
  priority: 0,
  name: 'depositmining',
  entry: (new DepositMiner()).entry, 
});

/////////////////////////////////////////////////
/////////////////////////////////////////////////
class Room {
  constructor (room, gecfg, ecfg) {
    this.room = room;
    this.creeps = [];
    this.creeps_by_group = {};

    // TODO: Deprecate access to `room.memory` in favor of this instead. Figure out
    //       a way to detect the access or even proxy it. How about ES6 Proxy objects?
    this.memory = this.room.memory;
    this.controller = this.room.controller;

    this.memory.clink_orders = this.memory.clink_orders || [];

    this.room.memory.mi = this.room.memory.mi || {};
    this.room.memory.jobs = this.room.memory.jobs || [];
    this.jobs = this.room.memory.jobs;
    this.room.memory.jobs_uid = this.room.memory.jobs_uid || 0;
    this.gecfg = gecfg;
    this.ecfg = ecfg;
    this.spawnman = new SpawnManager();
    this.stats = new Stats();
    // A smoothed cost map which looks like a gravity well around all 
    // the structures. This is supposed to keep the path finding using
    // the least amount of CPU possible.
    this._scm = null;   // This is the original.
    this.scm = null;    // This has creep positions added 
                        // or other dynamic per tick things.
    this.creep_group_counts = {}
    this.reg_put_intents = [];
    this.reg_get_intents = [];
    this.spawns = this.room.find(game.FIND_MY_SPAWNS);
    this.sources = this.room.find(game.FIND_SOURCES); 
    this.terrain = this.room.getTerrain();
    this.exts = [];
    this.towers = [];
    this.structs = [];
    this.roads = [];
    this.walls = [];
    this.ramparts = [];
    this.walls_and_ramparts = [];
    this.containers = [];
    this.containers_near_sources = [];
    this.active_containers_near_sources = [];
    this.containers_near_sources_with_energy = [];
    this.containers_adj_controller = [];
    this.active_containers_adj_controller = [];
    this.containers_adj_mineral = [];
    this.active_containers_adj_mineral = [];
    this.links = [];
    this.links_adj_storage = [];
    this.labs = [];
    this.extractors = [];
    this.minerals = this.room.find(game.FIND_MINERALS);
  }

  record_stat (key, value) {
    this.stats.record_stat(`${this.get_name()}.${key}`, value);
  }

  get_name () {
    return this.room.name;
  }

  get_base_room () {
    return this.room;
  }

  get_terminal () {
    return this.room.terminal;
  }

  get_memory () {
    return this.room.memory;
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

  add_creep (creep) {
    const c = creep.memory.sc !== undefined ? creep.memory.sc : creep.memory.c;
    const g = creep.memory.g;

    if (G_creepclazzes[c] !== undefined) {
      const new_obj = new G_creepclazzes[c](this, creep);
      this.creeps_by_group[g] = this.creeps_by_group[g] || [];
      this.creeps.push(new_obj);
      this.creeps_by_group[g].push(new_obj);
    } else {
      logging.warn(`The creep ${creep.name} has an unknown ${c} class.`);
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
      'upgrader': 0,
    };

    this.creep_group_counts = creep_group_counts;

    function group_count (gname) {
      return creep_group_counts[gname] || 0;
    }
    
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
      logging.warn(`emergency room energy levels set for room ${this.room.name}`);
      roomEnergy = 300;
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
        for (let x = 0; x < 3; ++x) {
          body.push(game.WORK);
          yield body;
        }

        body.push(game.MOVE);
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

    if (this.ecfg.scout) {
      function *scout_bf () {
        let body = [];
        while (true) {
          body.push(game.MOVE);
          yield body;
        }
      }

      this.spawnman.reg_build2({
        clazz: 'scout',
        group: 'scout',
        build_gf: scout_bf,
        max_level: 1,
        priority: -100,
        count: 1,
        memory: {
        },
        post_ticks: 0,
      });
    }   
 
    /////////////////////////////////////////////
    if (this.ecfg.claimteam) {
      function *claimteam_bf () {
        let body = [];
        while (true) {
          body.push(game.MOVE);
          body.push(game.CLAIM);
          yield body;
        }
      }

      function *claimteam_builders_bf () {
        let body = [];
        while (true) {
          body.push(game.MOVE);
          body.push(game.MOVE);
          body.push(game.WORK);
          body.push(game.CARRY);
          yield body;
        }
      }

      _.each(this.ecfg.claimteam, op => {
        let trobj = game.rooms()[op.tr];
        let tr_has_no_spawn;
        let tr_my_controller;

        if (trobj) {
          tr_has_no_spawn = trobj && trobj.find(game.FIND_MY_SPAWNS).length === 0;
          tr_my_controller = trobj && trobj.controller && trobj.controller.my;
        } else {
          tr_has_no_spawn = true;
          tr_my_controller = false;
        }

        if (!trobj || !tr_my_controller) {
          logging.log('registered to build claimer [claim style]');
          this.spawnman.reg_build(
            // The creep class/clazz.
            'claimer',
            // The group.
            `claimer_${op.tr}`,
            claimteam_bf,
            // The max level.
            1,
            // The priority.
            5,
            // The count.
            op.count || 1,
            // The memory.
            {
              // The target room.
              tr: op.tr,
              // The allowable rooms or undefined for allow all.
              ar: op.ar,
              cpu: 1,
            }
          );
        } else {
          if (tr_has_no_spawn) {
            logging.log('registered to build claimer [build style]');
            this.spawnman.reg_build(
              // The creep class/clazz.
              'claimer',
              // The group.
              `claimer_${op.tr}`,
              claimteam_builders_bf,
              // The max level.
              40,
              // The priority.
              5,
              // The count.
              op.count || 6,
              // The memory.
              {
                // The target room.
                tr: op.tr,
                ar: op.ar,
                cpu: 0.32,
              }
            );            
          }
        }
      });  
    }
    /////////////////////////////////////////////

    /////////////////////////////////////////////
    if (this.ecfg.warfare_small) {
      function *fighter_bf () {
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
    /////////////////////////////////////////////

    function *miner_bf() {
        let body = [];
        body.push(game.MOVE);
        body.push(game.CARRY);
        while (true) {
            for (let x = 0; x < 2; ++x) {
              body.push(game.WORK);
              yield body;
            }
            body.push(game.MOVE);
            yield body;
        }
    }

    if (this.spawns.length > 0 && this.sources.length > 0 && this.memory.minera_path === undefined) {
      let res = PathFinder.search(
        this.spawns[0].pos,
        { pos: this.sources[0].pos, range: 1 },
        { maxRooms: 1 }
      );

      this.memory.minera_path = res.cost;
    } 

    if (this.sources.length > 0) {
      this.spawnman.reg_build2({
        clazz:      'miner',
        group:      'minera',
        build_gf:   miner_bf,
        max_level:  10,
        priority:   1,
        count:      1,
        memory:     {
          s: this.sources[0].id,
        },
        post_ticks: this.memory.minera_path,
      });
    }
  
    if (this.spawns.length > 0 && this.sources.length > 1 && this.memory.minerb_path === undefined) {
      let res = PathFinder.search(
        this.spawns[0].pos,
        { pos: this.sources[1].pos, range: 1 },
        { maxRooms: 1 }
      );

      this.memory.minerb_path = res.cost;
    } 

    if (this.sources.length > 1) {
      this.spawnman.reg_build(
          'miner',
          'minerb',
          miner_bf,
          10,
          1,
          1,
          {
              s: this.sources[1].id,
          }
      );
    }

    const clevel = this.room.controller ? this.room.controller.level : 0;
    let worker_count;

    const clevel_worker_count = {
      0: 0,
      1: 6,
      2: 5,
      3: 3,
      4: 2,
      5: 1,
      6: 1,
      7: 1,
      8: 1,
    };

    if (clevel < 6 || this.csites.length > 0) {
      // Once we reach RCL 6 we have labs. To save CPU don't spawn
      // any workers unless we have construction sites.
      worker_count = clevel_worker_count[clevel];

      this.spawnman.reg_build(
        'gw',
        'worker',
        worker_bf,
        7,
        -1,
        worker_count,
        {}
      );
    }

    let hauler_count = 1;

    if (_.sum(
      this.denergy_near_sources,
      de => de.resourceType === game.RESOURCE_ENERGY ? de.amount : 0
    ) > 200) {
      // If there is too much dropped resources then maybe the miners
      // are out digging the creeps or something is happening and requires
      // extra hauling help.
      //
      // BUT.. at RCL 6 we should be able to handle everything with a single
      // hauler and to save CPU don't spawn another.
      if (clevel < 6) {
        hauler_count = 2;
        logging.info('There is too much dropped energy. Increasing needed hauler count from 1 to 2.');
      }
    }

    this.spawnman.reg_build(
      'gw',
      'hauler',
      hauler_bf,
      18,
      1,
      hauler_count,
      {}
    );

    
    let stor_energy_amount = this.get_storage() ? this.get_storage().store.getUsedCapacity(game.RESOURCE_ENERGY) : 0;
    let srcs_count = this.sources.length;

    let upgrader_level;

    // The rationale here is that our logic is simple for
    // feeding the upgrader. It might be or it might not
    // be because the logic is in the hauler and upgrader
    // itself. So, what we are doing here is throttling
    // the upgrader based on avaliable energy in storage
    // and the number of construction sites. I likely had
    // an upgrader starve the room of energy by upgrading
    // too hard and this was my solution. It does make sense
    // here as a failsafe but logic elsewhere could be 
    // more important such as simply not ticking the upgrader.
    // TODO: Consider just not ticking the upgrader but then
    //       consider it was a waste to build him? Which is
    //       the best place.
    if (stor_energy_amount > 0) {
      upgrader_level = Math.floor(
        (stor_energy_amount / 10000) * 5
      ) * srcs_count;
    } else {
      if (this.csites.length === 0) {
        upgrader_level = 20;
      } else {
        upgrader_level = 1;
      }
    }

    // Compute the total path cost (moves needed) from the first spawn to
    // the controller. This allows the spawn code to recreate an upgrader
    // _and_ give it time to reach the work site before the old one expires.
    if (this.spawns.length > 0 && this.memory.upgrader_path === undefined) {
      let res = PathFinder.search(
        this.spawns[0].pos,
        { pos: this.controller.pos, range: 1 },
        { maxRooms: 1 }
      );
      // The upgrader is likely overbuilt so it has fatigue. This means this
      // value needs a multiplier. The spawn code will produce that value and
      // multiply it by this cost. 
      this.memory.upgrader_path = res.cost;
    }
    
    this.spawnman.reg_build2({
      clazz: 'upgrader',
      group: 'upgrader',
      build_gf: upgrader_bf,
      max_level: upgrader_level,
      priority: 2,
      count: 1,
      memory: {
        sc: 'booster',
        can_use: ['XGH2O', 'GH2O', 'GH'],
      },
      post_ticks: this.memory.upgrader_path,
    });
  }

  get_controller_link () {
    const c = this.room.controller;
    if (!c) {
      return null;
    }

    const links = _.filter(this.links, link => link.pos.getRangeTo(c) < 2.2);

    if (links.length === 0) {
      return null;
    }

    return links[0];
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

  tick_populate_lists () {
    // The `tick_need_spawn` will populate this.
    let denergy = _.filter(this.room.find(game.FIND_DROPPED_RESOURCES), 
      i => i.resourceType === game.RESOURCE_ENERGY
    );
    this.denergy = denergy;

    // Make a list of energy dropped adjacent to sources.
    this.denergy_near_sources = []
    _.each(this.sources, source => {
      _.each(this.denergy, de => {
        if (de.pos.getRangeTo(source) < 1.5) {
          this.denergy_near_sources.push(de);
        }
      });
    });

    _.each(this.room.find(game.FIND_STRUCTURES), s => {
      this.structs.push(s);
      switch (s.structureType) {
        case game.STRUCTURE_EXTENSION: this.exts.push(s); return;
        case game.STRUCTURE_TOWER: this.towers.push(s); return;
        case game.STRUCTURE_SPAWN: this.spawns.push(s); return;
        case game.STRUCTURE_ROAD: this.roads.push(s); return;
        case game.STRUCTURE_LAB: this.labs.push(s); return;
        case game.STRUCTURE_RAMPART: 
          this.ramparts.push(s); 
          this.walls_and_ramparts.push(s);
          return;
        case game.STRUCTURE_WALL: 
          this.walls.push(s); 
          this.walls_and_ramparts.push(s);
          return;
        case game.STRUCTURE_EXTRACTOR: this.extractors.push(s); return;
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
          if (_.some(this.minerals, mineral => s.pos.isNearTo(mineral))) {
            this.containers_adj_mineral.push(s);
            if (this.container_evaluate_state(s, 500, 1500)) {
              this.active_containers_adj_mineral.push(s);
            }
          }
          return;
      }
    });
    
    this.links_nearest_storage = [];
    if (this.room.storage && this.links.length > 0) {
      let tmp = _.map(this.links, link => [link, link.pos.getRangeTo(this.room.storage)]);
      tmp.sort((a, b) => a[1] > b[1] ? 1 : -1);
      this.links_nearest_storage = [tmp[0][0]]; 
    }


    this.csites = this.room.find(game.FIND_CONSTRUCTION_SITES);
    let sources_and_denergy = [];
    _.each(this.sources, source => sources_and_denergy.push(source));
    _.each(denergy, i => sources_and_denergy.push(i));

    this.record_stat('dropped.energy', _.sumBy(denergy, e => e.amount));

    // Quick and dirty tower code.
    this.hcreeps = this.room.find(game.FIND_HOSTILE_CREEPS);
  }

  tick (task) {
    // Enumerate different structures and sort them into lists for usage.
    this.tick_populate_lists();

    let valid_hcreeps = _.filter(this.hcreeps, hcreep => {
      if (this.gecfg.ally[hcreep.owner.username] !== undefined) {
        return false;
      }
      return true;
    });

    if (valid_hcreeps.length > 0) {
      // Handle hostile creeps.
      const fhcreep = _.sample(valid_hcreeps);
      _.each(this.towers, tower => tower.attack(fhcreep));
    } else {
      const roads_and_containers = _.filter(
        this.structs, s => s.structureType === game.STRUCTURE_ROAD || s.structureType === game.STRUCTURE_CONTAINER
      );

      const a_creep = _.sample(_.filter(this.creeps, c => c.creep.hits < c.creep.hitsMax));
      const a_struct = _.sample(_.filter(roads_and_containers, s => s.hits / s.hitsMax < 0.5));

      if (a_struct) {
        // Handle road repairs.
        _.each(this.towers, tower => tower.repair(a_struct));
      } else if (a_creep) {
        _.each(this.towers, tower => tower.heal(a_creep.creep));
      } else {
        // Handle ramparts and walls.
        if (Game.time % 20 === 0) {
          const target = this.walls_and_ramparts.sort((a, b) => a.hits - b.hits)[0];
          if (target) {
            _.each(this.towers, tower => tower.repair(target));
          }
        }
      }
    }

    // Do all the housework that requires a spawn here.
    if (this.spawns.length > 0) {
      this.tick_need_spawn();
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
          this.dt_repair_non_wall(0.5),
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
      this.dt_pull_energy_containers_nearby_sources({}),
      this.dt_pull_sources(true),
    ];

    const clink = this.get_controller_link();

    // Instead of the hauler moving energy to the controller
    // the miner at the farthest source will complete orders
    // created below _BUT_ disable this mechanism if the storage
    // falls below a certain threshold because we don't want to
    // starve the spawn.
    const clink_orders = this.memory.clink_orders;
    let clink_active = false;

    if (clink !== null && this.room.storage && this.room.storage.store.getUsedCapacity(game.RESOURCE_ENERGY) > 10000) {
      clink_active = true;      

      const delta = 12;
      this.memory.clink_amount = (this.memory.clink_amount || 0) + delta;

      if (this.memory.clink_amount > 800) {
        this.memory.clink_amount = 800;
      }

      if (this.memory.clink_amount >= 400) {
        this.memory.clink_amount -= 400;
        clink_orders.push(400);
      }

      while (_.sumBy(clink_orders, order => order) > 1600) {
        clink_orders.shift();
      }
    }

    let dt_hauler_pull = [
      this.dt_cond(
        () => this.group_count('worker') > 0,
        [
          // If we have workers.
          this.dt_pull_from_objects_with_stores(
            0.0, this.links_nearest_storage, {},
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
          this.dt_cond(
            // Don't pull from links if clink is active.
            () => !clink_active,
            [
              this.dt_pull_from_objects_with_stores(
                0.0, this.links_nearest_storage, {},
                lst => { 
                  lst.sort((a, b) => {
                    return a.store.getUsedCapacity(game.RESOURCE_ENERGY) >
                           b.store.getUsedCapacity(game.RESOURCE_ENERGY) ? -1 : 1;
                  })
                  return lst[0];
                }
              ),
            ]
          ),
          this.dt_pull_from_objects_with_stores(
            0.0, this.active_containers_near_sources
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
        () => this.hcreeps.length > 0,
        [ // IF the above is TRUE then do:
          this.dt_push_to_objects_with_stores(1.0, this.towers),
        ],
        [ // IF the above is FALSE then do:
          this.dt_cond(
            () => this.creep_group_counts.worker > 0, 
            [ // IF the above is TRUE then do:
              // Fill the storage until it hits 10k.
              this.dt_push_storage(10000)
            ],
          ), // FINALLY, do this also if !(hcreeps.length > 0)
          this.dt_push_to_objects_with_stores(1.0, this.spawns.concat(this.exts)),
          this.dt_push_to_objects_with_stores(1.0, this.towers),
          // TODO: Use link once upgrader has built it.
          this.dt_cond(
            () => clink === null,
            [
              this.dt_push_to_objects_with_stores(1.0, this.active_containers_adj_controller),
            ]
          ),
          this.dt_push_storage(1000000),
        ]
      ),
    ];

    let lab_creeps = [];
    let all_creeps = this.room.find(game.FIND_CREEPS);

    for (let ndx in this.creeps) {
      let creep = this.creeps[ndx];

      if (creep instanceof CreepLabRat || creep.get_memory().g === 'labrat_extractor') {
        lab_creeps.push(creep);
        continue;
      }

      let ctask;

      if (creep.get_group() === 'hauler') {
        let _dt_pull = () => this.dt_run(dt_hauler_pull, creep);
        let _dt_push = () => this.dt_run(dt_push_hauler, creep);
        ctask = task.spawn_isolated(0, `creep:${creep.get_name()}`, ctask => {
          let cm = creep.get_memory();
          logging.log(`CLZ:${cm.c} GRP:${cm.g}`);
          logging.log(`BODY:${_.map(creep.creep.body, part => part.type)}`);
          logging.log('------------------------');
          creep.tick(_dt_pull, _dt_push);
        });
      } else {
        let _dt_pull = () => this.dt_run(dt_worker_pull, creep);
        let _dt_push = () => this.dt_run(dt_push, creep);
        ctask = task.spawn_isolated(0, `creep:${creep.get_name()}`, ctask => {
          let cm = creep.get_memory();
          logging.log(`CLZ:${cm.c} GRP:${cm.g}`);
          logging.log(`BODY:${_.map(creep.creep.body, part => part.type)}`);
          logging.log('------------------------');
          creep.tick(_dt_pull, _dt_push);
        });
      }

      task.transfer(ctask, creep.get_memory().cpu || 0.32, 20);
    }

    if (this.ecfg.lab) {
      let lab_task = task.spawn_isolated(40, `labman`, ctask => {
        let labman = new LabManager(this);
        labman.tick(ctask, lab_creeps, this.labs, this.extractors);
      });
      task.transfer(lab_task, 1, 5);
    }


    if (this.ecfg.autobuild2) {
        let abtask = task.spawn_isolated(-40, 'autobuild2', ctask => {
          (new AutoBuild2(this)).tick(0.2);
        });
        
        task.transfer(abtask, 0.2, 1);
    } else {
      if (this.ecfg.autobuild) {
        let abtask = task.spawn_isolated(-40, 'autobuild', ctask => {
          (new AutoBuilder(this)).tick();
        });
        
        task.transfer(abtask, 0.2, 1);
      }
    }

    const spawn_task = task.spawn_isolated(100, `spawnman`, ctask => {
      let room_energy = this.room.energyCapacityAvailable;
      let workers = this.group_count('worker');
      let haulers = this.group_count('hauler');

      logging.debug(`workers=${workers} haulers=${haulers}`);
      if (workers === 0 && haulers === 0) {
        logging.warn('Setting total room energy to 300 due to no workers or haulers being present.');
        room_energy = 300;
      }

      this.spawnman.process(this, room_energy, this.creeps, this.spawns);
    });

    task.transfer(spawn_task, 1, 10);

    if (task.get_credit() > 0) {
      // Distribute the contents of our bucket across the modules.
      const cpu_slice = Math.min(1, task.get_credit() / G_modules.length);
      const cpu_bucket = 1;

      _.each(G_modules, mod => {
        const mod_task = task.spawn_isolated(mod.priority, `mod:${mod.name}`, ctask => {
          mod.entry(this, ctask);
        });
        task.transfer(mod_task, cpu_slice || mod.cpu_slice, cpu_bucket || mod.cpu_bucket);
      });
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

  ////////////////////////////////////////////////
  // DECISION TREE FAMILY OF FUNCTIONS         
  ////////////////////////////////////////////////

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

  dt_repair_non_wall (threshold, oneshot) {
    return (creep) => {
      let valid = _.filter(this.structs, s => {
        if (s.structureType === game.STRUCTURE_WALL || s.structureType === game.STRUCTURE_RAMPART) {
          return false;
        }
        return (s.hits / s.hitsMax) < threshold;
      });
      return [
        creep.get_pos().findClosestByPath(valid),
        oneshot
      ];
    };
  }

  dt_repair_any (threshold, oneshot) {
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

  dt_pull_energy_containers_nearby_sources (
    { oneshot = false, nearest = false }
  ) {
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

        if (nearest === false) {
          conts.sort((a, b) => { 
            let av = a.store.getUsedCapacity(
              game.RESOURCE_ENERGY
            );
            let bv = b.store.getUsedCapacity(
              game.RESOURCE_ENERGY
            );
            return av > bv ? -1 : 1;
          });
        }

        return [
            // Do not bother with the most close. Grab the one
            // with the most energy inside of it.
            nearest !== false ?
              creep.get_pos().findClosestByPath(conts) :
              conts.length > 0 ? conts[0] : null
            , 
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

      return [nearest, oneshot];
    };
  }

  dt_push_to_objects_with_stores (threshold, objlist, oneshot, least_first=false) {
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

module.exports.register_module = register_module;
module.exports.Room = Room;
