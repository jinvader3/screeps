const { Creep } = require('./creep');
const game = require('./game');
const _ = game._;

class CreepRemoteHauler extends Creep {
  move_to (trgt) {
    return this.creep.moveTo(trgt);
  }

  tick () {
    let tick_sleep = this.creep.memory.tick_sleep ? true : false;
    this.creep.memory.tick_sleep = false;

    let room = game.rooms()[this.creep.pos.roomName];
    let source_ndx = this.creep.memory.sndx || 0;
    let source_info = this.creep.memory.s[source_ndx % this.creep.memory.s.length];
    let source = game.getObjectById()(source_info.sid);
    let source_room = source_info.room;

    console.log(
      `[hauler] source_ndx=${source_ndx} sid=${source_info.sid} room=${source_info.room}`
    );
    
    if (this.creep.pos.roomName === this.room.get_name()) {
      let amt = this.creep.store.getUsedCapacity(game.RESOURCE_ENERGY)      
      if (amt > 0) {
        let stor = room.storage;
        if (stor) {
          if (this.creep.transfer(stor, game.RESOURCE_ENERGY, amt) === game.ERR_NOT_IN_RANGE) {
            this.creep.moveTo(stor);
          }
        }
      } else {
        // If we are in our home room; ignore all dropped energy.
        let pos = new RoomPosition(0, 0, source_room);
        this.creep.moveTo(pos);
      }
      return;      
    }

    if (this.creep.store.getFreeCapacity(game.RESOURCE_ENERGY) === 0) {
      console.log('[hauler] going home');
      let pos = new RoomPosition(25, 25, this.room.get_name());
      this.creep.moveTo(pos);
      return;  
    }

    let denergy_list = room.find(game.FIND_DROPPED_RESOURCES);

    console.log(`denergy_list.length=${denergy_list.length}`);

    if (denergy_list.length === 0) {
      // If no dropped energy then are we in target room?
      if (!tick_sleep && source_room !== this.creep.pos.roomName) {
        // No, then keep going.
        let pos = new RoomPosition(25, 25, source_room);
        this.creep.moveTo(pos);
        return;
      }
      // Yes, then switch to the next target.
      this.creep.memory.sndx = source_ndx + 1;
      return;
    } else {
      this.creep.memory.tick_sleep = true;
    }

    // Pickup the energy.
    let denergy = this.creep.pos.findClosestByRange(denergy_list);
    let res = this.creep.pickup(denergy);
    if (res === game.ERR_NOT_IN_RANGE) {
      this.creep.moveTo(denergy);
      return;
    } else if (res === game.OK) {
    }
  }
}

module.exports = {
  CreepRemoteHauler: CreepRemoteHauler,
};
