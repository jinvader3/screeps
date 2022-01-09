const game = require('./game');
const _ = game._;

class CreepMiner {
  constructor (room, creep) {
    this.creep = creep;
    this.room = room;
  }

  get_name () {
    return this.creep.name;
  }

  move_to (trgt) {
    return this.creep.moveTo(trgt);
  }

  tick () {
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
