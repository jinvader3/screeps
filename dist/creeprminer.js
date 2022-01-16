const { Creep } = require('./creep');
const game = require('./game');
const _ = game._;

class CreepRemoteMiner extends Creep {
  move_to (trgt) {
    return this.creep.moveTo(trgt);
  }

  tick () {
    let source_ndx = this.creep.memory.sndx || 0;
    let source_info = this.creep.memory.s[source_ndx % this.creep.memory.s.length];
    let source = game.getObjectById()(source_info.sid);
    let source_room = source_info.room;

    console.log(`source_ndx=${source_ndx} sid=${source_info.sid} room=${source_info.room}`);

    if (!source) {
      if (source_room) {
        let pos = new RoomPosition(25, 25, source_room);
        this.creep.moveTo(pos);
      }
      return;
    }

    if (source.energy === 0) {
      this.creep.memory.sndx = source_ndx + 1;
      return;
    }

    let res = this.creep.harvest(source);
    console.log('res', res);
    if (res === game.ERR_NOT_IN_RANGE) {
      this.move_to(source);
      return;
    }
  }
}

module.exports = {
  CreepRemoteMiner: CreepRemoteMiner,
};
