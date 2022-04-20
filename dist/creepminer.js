const { Creep } = require('./creep');
const game = require('./game');
const _ = game._;
const { logging } = require('./logging');

class CreepMiner extends Creep {
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

  find_link_near_storage () {
    let stor = this.room.get_storage();

    if (!stor) {
      return null;
    }

    let links = _.map(this.room.links, link => [link, link.pos.getRangeTo(stor)]);

    if (links.length === 0) {
      return null;
    }

    links.sort((a, b) => a[1] > b[1] ? 1 : -1);

    return links[0][0];
  }

  will_i_send_energy_toward_spawn (my_cont) {
    if (this.room.links.length < 2) {
      // No other possibility.
      return false;
    }

    // Check if the link we will use is the link nearest
    // to the storage and IF it is THEN we will be sending
    // energy toward storage/spawn.
    let la = this.find_link_near_container(my_cont);
    let lb = this.find_link_near_storage();
    return la.id !== lb.id;
  }

  find_link_near_container (cont) {
    let links = _.filter(
      cont.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
      return struct.structureType === game.STRUCTURE_LINK;
    });

    return links.length > 0 ? links[0] : null;
  }

  get_my_source () {
    let source_id = this.creep.memory.s;
    let source = game.getObjectById()(source_id);
    return source;
  }

  tick () {
    logging.debug('tick');

    const source = this.get_my_source();

    logging.debug(`source_id:${source.id} source:${source}`);

    if (!source) {
      logging.debug('no valid source');
      if (this.creep.memory.sr) {
        logging.debug(`traveling to source room ${this.creep.memory.sr}`);
        let pos = new RoomPosition(0, 0, this.creep.memory.sr);
        this.creep.moveTo(pos);
      }
      return;
    }

    // Look for chest around the source.
    const cont = this.find_container_near_source(source);
    logging.debug(`cont:${cont}`);

    if (cont) {
      const link = this.find_link_near_container(cont);
      const dlink = this.find_link_near_storage();
      const send_energy = this.will_i_send_energy_toward_spawn(cont);

      logging.debug(`send_energy=${send_energy}`);

      if (!link) {
        if (this.room.csites.length === 0) {
          const pos = this.creep.pos;
          let x = pos.x;
          let y = pos.y;
          let jmp = [-1, 1];
          x += jmp[Math.round(Math.random())];
          y += jmp[Math.round(Math.random())];
          // Try to build a link around this container.
          this.room.room.createConstructionSite(
            x, y,
            game.STRUCTURE_LINK
          );
        }
      }

      if (!cont.pos.isEqualTo(this.creep.pos)) {
        this.move_to(cont);
      } else {
        this.creep.harvest(source);
        // Decrease CPU usage by only transfering when our capacity is at half.
        const total_capacity = this.creep.store.getCapacity(game.RESOURCE_ENERGY);
        const used_capacity = this.creep.store.getUsedCapacity(game.RESOURCE_ENERGY);
        if (send_energy && used_capacity > total_capacity * 0.5) {
          const clink_orders = this.room.memory.clink_orders;

          this.creep.transfer(link, game.RESOURCE_ENERGY);

          while (clink_orders[0] === 0) {
            clink_orders.shift();
          }

          const clink = this.room.get_controller_link();

          if (clink !== null && clink_orders.length > 0) {
            // Try to complete the clink orders.
            if (link.store.getUsedCapacity(game.RESOURCE_ENERGY) >= clink_orders[0]) {
              if (clink.store.getFreeCapacity(game.RESOURCE_ENERGY) >= clink_orders[0]) {
                link.transferEnergy(clink, clink_orders[0]);
                clink_orders[0] = 0;
              }
            }
          } else {
            // Without any clink orders.
            const link_total_capacity = link.store.getCapacity(game.RESOURCE_ENERGY);
            const link_used_capacity = link.store.getUsedCapacity(game.RESOURCE_ENERGY);
            if (link.cooldown === 0 &&
                link.isActive() && 
                link_used_capacity > link_total_capacity * 0.9) {
              logging.info('link.transfer', link.transferEnergy(dlink));
            }
          }
        }
      }
    } else {
      let res = this.creep.harvest(source);
      logging.debug(`harvest = ${res}`);
      if (res === game.ERR_NOT_IN_RANGE) {
        logging.debug('moving to source');
        this.move_to(source);
      } else if (res === game.OK) {
        logging.debug('thinking about creating csite for contanier');
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
