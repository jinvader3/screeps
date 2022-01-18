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

    let links = _.filter(
      stor.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
      return struct.structureType === game.STRUCTURE_LINK;
    });

    return links.length > 0 ? links[0] : null;    
  }

  find_link_near_container (cont) {
    let links = _.filter(
      cont.pos.findInRange(game.FIND_STRUCTURES, 1.8), struct => {
      return struct.structureType === game.STRUCTURE_LINK;
    });

    return links.length > 0 ? links[0] : null;
  }

  tick () {
    logging.debug('tick');

    let source_id = this.creep.memory.s;
    let source = game.getObjectById()(source_id);

    logging.debug(`source_id:${source_id} source:${source}`);

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
    let cont = this.find_container_near_source(source);
    logging.debug(`cont:${cont}`);

    if (cont) {
      let link = this.find_link_near_container(cont);
      let dlink = this.find_link_near_storage();

      if (!link) {
        if (this.room.csites.length === 0) {
          let pos = this.creep.pos;
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
