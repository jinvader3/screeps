const game = require('./game');
const { Creep } = require('./creep');
const _ = game._;
const { logging } = require('./logging');
const { StateMachineCreep } = require('./statemachcreep');

class CreepLabRat extends StateMachineCreep {
  tick (labman) {
    logging.info('labrat ticking');

    _.each (labman.room.active_containers_adj_mineral, cont => {
      this.stmh_set(`acam:${cont.id}`, ss => {
        // This will drop off if our storage is already empty.
        this.stmh_dump_store_to_object(this.room.get_storage());
        this.stmh_load_all_from_store(cont);
        this.stmh_dump_store_to_object(this.room.get_storage());
        return true;
      });
    });

    super.tick();
  }
}

class LabManager {
  constructor (room) {
    this.sm = room.get_spawnman();
    this.room = room;
  }

  tick (task, creeps, labs, extractors) {
    function *labrat_extractor_bf() {
      let body = []
      body.push(game.MOVE);
      body.push(game.CARRY);
      while (true) {
        body.push(game.MOVE);
        body.push(game.WORK);
        yield body;
      }
    }

    function *labrat_mover_bf() {
      let body = []
      while (true) {
        body.push(game.MOVE);
        body.push(game.CARRY);
        yield body;
      }
    }

    // (1/4) schedule creep creation
    _.each(this.room.minerals, mineral => {
      let has_extractor = _.some(
        mineral.pos.findInRange(FIND_STRUCTURES, 1.8), 
        s => s.structureType === game.STRUCTURE_EXTRACTOR
      );

      logging.info(`looking at mineral ${mineral.id}`);

      if (!has_extractor) {
        logging.info('skipping mineral because it has no extractor');
        return;
      }

      logging.info('registering spawn build for labrat_extractor');
      this.sm.reg_build(
        'miner',
        'labrat_extractor',
        labrat_extractor_bf,
        40,
        8,
        1,
        {
          // Treat an extractor just like a source.
          s: mineral.id,
        }
      );
    });

    if (labs.length > 0) {
      logging.info('registering spawn build for labrat_mover');
      this.sm.reg_build(
        'labrat',
        'labrat_mover',
        labrat_mover_bf,
        4,
        8,
        1,
        {}
      );
    }

    // (2/4) look at the trade data and see what we can try to build
    // (3/4) look at what we can sell and sell it

    // (4/4) let creeps ticks
    for (let creep of creeps) {
      logging.debug(`ticking creep ${creep.get_name()}`);
      task.spawn(10, `labrat:${creep.get_name()}`, ctask => {
        if (creep instanceof CreepLabRat) {
          creep.tick(this);
        } else {
          creep.tick();
        }
      });
    }
    ///////////////////////////    
  }
}

module.exports.CreepLabRat = CreepLabRat;
module.exports.LabManager = LabManager;
