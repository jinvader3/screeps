const { Creep } = require('./creep');
const game = require('./game');
const _ = game._;
const { logging } = require('./logging');

class CreepClaimer extends Creep {
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
      logging.log('!this.in_target_room()');
      this.travel_to_target_room();
      return;
    }
    
    let croom = game.rooms()[this.creep.memory.tr];
    let can_claim = _.some(this.creep.body, part => part.type === game.CLAIM);
    logging.log(`croom:${croom.name} can_claim:${can_claim}`);

    if (can_claim) {
      return logging.wrapper('worker', () => {
        return this.tick_controller_worker(croom);
      });
    }

    return logging.wrapper('builder', () => {
      return this.tick_spawn_builder(croom);
    });
  }

  tick_spawn_builder (croom) {
    // This creep is only intended to establish an initial foothold
    // in the room at this time. It only builds a single spawn.
    if (croom.find(game.FIND_MY_SPAWNS).length > 0) {
      this.creep.memory.name = `${this.creep.memory.tr}:${game.time()}`;
      this.creep.memory.c = 'gw';
      this.creep.memroy.g = 'worker';
      return;
    }

    // Look for an existing construction site for a spawn.
    let csites = croom.find(game.FIND_CONSTRUCTION_SITES);
    let csite_spawn = _.find(
      csites, csite => csite.structureType === game.STRUCTURE_SPAWN
    );

    let source = croom.find(game.FIND_SOURCES)[0];

    // Build the existing construction site.
    if (csite_spawn) {
      let dx = csite_spawn.pos.x - this.creep.pos.x;
      let dy = csite_spawn.pos.y - this.creep.pos.y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1.5) {
        if (this.creep.store.getUsedCapacity(game.RESOURCE_ENERGY) === 0) {
          this.creep.moveTo(source);
        } else {
          this.creep.build(csite_spawn);
        }
      } else {
        logging.debug('dist >= 1.1');
        if (this.creep.store.getFreeCapacity(game.RESOURCE_ENERGY) === 0) {
          logging.debug('moving to csite_spawn');
          this.creep.moveTo(csite_spawn);
        } else {
          if (this.creep.harvest(source) === game.ERR_NOT_IN_RANGE) {
            this.creep.moveTo(source);
          }
        }
      }
      //this.creep.build(csite_spawn)
    } else {
      // Randomly place a new construction site near a source.
      let x = source.pos.x;
      let y = source.pos.y;
      x += Math.floor(Math.random() * 5);
      y += Math.floor(Math.random() * 5);

      let res = croom.createConstructionSite(
        x, y, game.STRUCTURE_SPAWN
      );
    }
  }

  tick_controller_worker (croom) {
    if (!croom) {
      logging.log('!croom');
      return;
    }

    if (croom && croom.controller && croom.controller.my) {
      logging.log('room is already owned; shutting down');
      return;
    }

    if (croom.controller.level == 0) {
      let res = this.creep.claimController(croom.controller);
      logging.log(`claimController = ${res}`);
      if (res === ERR_NOT_IN_RANGE) {
        this.creep.moveTo(croom.controller);
      }
    } else {
      if (!croom.controller.my) {
        let res = this.creep.attackController(croom.controller);
        logging.log(`attackController = ${res}`);
        if (res === ERR_NOT_IN_RANGE) {
          this.creep.moveTo(croom.controller);
        }
      }
    }
  }
}

module.exports = {
  CreepClaimer: CreepClaimer,
}
