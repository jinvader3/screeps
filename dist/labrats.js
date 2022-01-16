const game = require('./game');
const { Creep } = require('./creep');
const _ = game._;

class CreepLabRat extends Creep {
  tick () {
  }
}

class LabManager {
  constructor (room) {
    this.sm = room.get_spawnman();
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
    if (extractors.length > 0) {
      this.sm.reg_build(
        'miner',
        'labrat_extractor',
        labrat_extractor_bf,
        4,
        8,
        1,
        {
          // Treat an extractor just like a source.
          s: extractors[0].id,
        }
      );
    }

    if (labs.length > 0) {
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
      task.spawn(10, `labrat:${creep.get_name()}`, ctask => {
        creep.tick();
      });
    }
    ///////////////////////////    
  }
}

module.exports.CreepLabRat = CreepLabRat;
module.exports.LabManager = LabManager;
