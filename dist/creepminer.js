const game = require('./game');
const _ = game._;

class CreepMiner {
  constructor (room, creep) {
    this.creep = creep;
    this.room = room;
  }

  get_mode () {
    return this.creep.memory.m || 'i';
  }

  set_mode (mode) {
    this.creep.memory.m = mode;
  }

  set_target (trgt) {
    if (trgt === null) {
      this.creep.memory.t = null;
    } else {
      this.creep.memory.t = trgt.id;
    }
  }

  set_target_id (id) {
    this.creep.memory.t = id;
  }

  get_target (trgt) {
    return game.getObjectById()(this.creep.memory.t);
  }

  move_to (trgt) {
    return this.creep.moveTo(trgt);
  }

  debug () {
    if (this.creep.memory.g !== true) {
      return;
    }

    let args = [];

    for (let x = 0; x < arguments.length; ++x) {
      args.push(arguments[x]);
    }

    console.log.apply(console, args);
  }

  tick () {
    this.debug('creep miner tick');

    let source_id = this.creep.memory.s;
    let source = game.getObjectById()(source_id);

    if (this.creep.harvest(source) === game.ERR_NOT_IN_RANGE) {
      this.move_to(source);
    }
  }
}

module.exports = {
  CreepMiner: CreepMiner,
};
