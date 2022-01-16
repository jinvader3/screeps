const game = require('./game');
const { Creep } = require('./creep');
const _ = game._;

class CreepUpgrader extends Creep {
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
        let amt = Math.min(
            this.creep.store.getFreeCapacity(game.RESOURCE_ENERGY),
            cont.store.getUsedCapacity(game.RESOURCE_ENERGY)
        );
        let res = this.creep.withdraw(
          cont, game.RESOURCE_ENERGY, 
          amt
        );
        this.creep.upgradeController(c);
        
        if (game.time() % 100 === 0) {
          this.creep.signController(c, 'Redbeard is real. Beware.');
        }
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
