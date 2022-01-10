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

  find_container_near_source (source) {
    let cont = _.filter(
      source.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
      return struct.structureType === game.STRUCTURE_CONTAINER;
    });

    return cont.length > 0 ? cont[0] : null;
  }

  tick () {
    let source_id = this.creep.memory.s;
    let source = game.getObjectById()(source_id);

    // Look for chest around the source.
    let cont = this.find_container_near_source(source);

    if (cont) {
      if (!cont.pos.isEqualTo(this.creep.pos)) {
        this.move_to(cont);
      } else {
        this.creep.harvest(source);
      }
    } else {
      let res = this.creep.harvest(source);
      if (res === game.ERR_NOT_IN_RANGE) {
        this.move_to(source);
      } else if (res === game.OK) {
        // Check if a construction site already exists. This is a simple
        // method. It is not accurate.
        // TODO: push construction requests to the room for evaluation
        //       and planning
        if (this.room.csites.length === 0) { 
          this.room.room.createConstructionSite(
            this.creep.pos,
            game.STRUCTURE_CONTAINER,
          );
        }
      }
    }
  }
}

module.exports = {
  CreepMiner: CreepMiner,
};
