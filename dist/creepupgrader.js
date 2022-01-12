const game = require('./game');
const _ = game._;

class CreepUpgrader {
  constructor (room, creep) {
    this.creep = creep;
    this.room = room;
  }

  get_pos() {
    return this.creep.pos;
  }

  get_group() {
    return this.creep.memory.g;
  }

  get_name () {
    return this.creep.name;
  }

  move_to (trgt) {
    return this.creep.moveTo(trgt);
  }

  find_container_near_controller (c) {
    let cont = _.filter(
      c.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
      return struct.structureType === game.STRUCTURE_CONTAINER;
    });

    return cont.length > 0 ? cont[0] : null;
  }

  tick () {
    let c = this.room.get_controller();
    let cont = this.find_container_near_controller(c);

    if (cont) {
      if (!cont.pos.isEqualTo(this.creep.pos)) {
        this.move_to(cont);
      } else {
        this.creep.pickup(cont);
        this.creep.upgradeController(c);
      }
    } else {
      if (this.creep.pos.inRangeTo(c, 1.8)) {
        if (this.room.csites.length === 0) { 
          this.room.room.createConstructionSite(
            this.creep.pos,
            game.STRUCTURE_CONTAINER,
          );
        }
      } else {
        this.creep.moveTo(c);
      }
    }
  }
}

module.exports = {
  CreepUpgrader: CreepUpgrader,
};
