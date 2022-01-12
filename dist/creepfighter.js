const game = require('./game');
const _ = game._;

class CreepFighter {
  constructor (room, creep) {
    this.creep = creep;
    this.room = room;
  }

  // now you tell me how im hacked and we could be friends but i see
  // you and nobody else wants to do that then we going to always be
  // enemies;
  get_pos () {
    return this.creep.pos;
  }

  get_name () {
    return this.creep.name;
  }

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

    let hcreeps = game.rooms()[this.creep.pos.roomName].find(
      game.FIND_HOSTILE_CREEPS
    );

    let nearest = this.creep.pos.findClosestByPath(hcreeps);

    if (nearest) {
      if (this.creep.attack(nearest) === game.ERR_NOT_IN_RANGE) {
        this.creep.moveTo(nearest);
      }
    }

    let hstructs = game.rooms()[this.creep.pos.roomName].find(
      game.FIND_STRUCTURES
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
