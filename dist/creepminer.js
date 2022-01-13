const game = require('./game');
const _ = game._;

class CreepMiner {
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
    let source_id = this.creep.memory.s;
    let source = game.getObjectById()(source_id);

    // Look for chest around the source.
    let cont = this.find_container_near_source(source);

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
