// @flow
import type Room from './room';

const { Creep } = require('./creep');
const game = require('./game');
const _ = game._;
const { logging } = require('./logging');

class CreepClaimer extends Creep {
  get_target_room (): string {
    return this.creep.memory.tr;
  }

  in_target_room (): boolean {
    return this.creep.pos.roomName === this.creep.memory.tr;
  }

  travel_to_target_room (): void {
    this.creep.moveTo(
      new game.RoomPosition(25, 25, this.creep.memory.tr),
      { 
        reusePath: 20,
        costCallback: (room_name, cm) => {
          if (this.creep.memory.ar === undefined) {
            logging.log('using all rooms');
            return cm;
          }

          if (_.some(this.creep.memory.ar, name => room_name === name)) {
            logging.log(`using room ${room_name}`);
            return cm;
          }

          logging.log(`avoiding room ${room_name}`);
          cm = new game.PathFinder.CostMatrix();
          for (let x = 0; x < 50; ++x) {
            for (let y = 0; y < 50; ++y) {
              cm.set(x, y, 255);
            }
          }
          return cm;
        },
      }
    );
  }

  tick (): void {
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

  tick_spawn_builder (croom: Room): void {
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

    let crid = parseInt(this.creep.id.substr(-1), 16);
    let sources = croom.find(game.FIND_SOURCES);
    let source = sources[crid % sources.length];

    // Build the existing construction site.
    if (csite_spawn) {
      if (this.creep.pos.getRangeTo(source) === 1 &&
          this.creep.pos.getRangeTo(csite_spawn) === 1) {
          if (this.creep.store.getUsedCapacity(game.RESOURCE_ENERGY) === 0) {
            this.creep.harvest(source);
          } else {
            this.creep.build(csite_spawn);
          }
          return;
      }

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
          this.creep.moveTo(csite_spawn, { reusePath: 20 });
        } else {
          if (this.creep.harvest(source) === game.ERR_NOT_IN_RANGE) {
            this.creep.moveTo(source, { reusePath: 20 });
          }
        }
      }
      //this.creep.build(csite_spawn)
    } else {
      // Randomly place a new construction site near a source.
      //let x = source.pos.x;
      //let y = source.pos.y;
      //x += Math.floor(Math.random() * 5);
      //y += Math.floor(Math.random() * 5);
      //let res = croom.createConstructionSite(
      //  x, y, game.STRUCTURE_SPAWN
      //);
    }
  }

  tick_controller_worker (croom: any): void {
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
      if (res === game.ERR_NOT_IN_RANGE) {
        this.creep.moveTo(croom.controller, { reusePath: 20 });
      }
    } else {
      if (!croom.controller.my) {
        let res = this.creep.attackController(croom.controller);
        logging.log(`attackController = ${res}`);
        if (res === game.ERR_NOT_IN_RANGE) {
          this.creep.moveTo(croom.controller, { reusePath: 20 });
        }
      }
    }
  }
}

module.exports = {
  CreepClaimer: CreepClaimer,
}
