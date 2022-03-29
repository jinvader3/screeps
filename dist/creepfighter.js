const { Creep } = require('./creep');
const game = require('./game');
const _ = game._;

class CreepFighter extends Creep {
  get_target_room () {
    return this.creep.memory.tr;
  }

  in_target_room () {
    return this.creep.pos.roomName === this.creep.memory.tr;
  }

  travel_to_target_room () {
    this.creep.moveTo(new RoomPosition(25, 25, this.creep.memory.tr));
  }

  tick () {
    if (!this.in_target_room()) {
      this.travel_to_target_room();
      return;
    }

    let nearest;

    let hcreeps = game.rooms()[this.creep.pos.roomName].find(
      game.FIND_HOSTILE_CREEPS
    );

    nearest = this.creep.pos.findClosestByPath(hcreeps);

    if (nearest) {
      if (this.creep.attack(nearest) === game.ERR_NOT_IN_RANGE) {
        this.creep.moveTo(nearest);
      }
    }

    let hstructs = game.rooms()[this.creep.pos.roomName].find(
      game.FIND_HOSTILE_STRUCTURES
    );

    nearest = this.creep.pos.findClosestByPath(hstructs);
    if (nearest) {
      if (this.creep.attack(nearest) === game.ERR_NOT_IN_RANGE) {
        this.creep.moveTo(nearest);
      }
    }
  }
}

module.exports = {
  CreepFighter: CreepFighter,
}
