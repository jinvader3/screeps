const { Creep } = require('./creep');
const game = require('./game');
const _ = game._;
const { logging } = require('./logging');

class CreepBooster extends Creep {
  // this.room
  // this.creep

  tick () {
    if (this.creep.spawning) {
      return;
    }

    let to_visit = this.creep.memory.to_visit;
    //
    if (to_visit === undefined) {
      logging.info('determining labs to visit');
      this.determine_labs_to_visit();
      to_visit = this.creep.memory.to_visit;
    }
    //
    if (to_visit.length === 0) {
      logging.info('turning creep control over');
      // Turn control over to the rightful driver.
      delete this.creep.memory.sc;
      // Now, the attribute `c` will be used to
      // pick the driver code to run the creep.
      return;
    }
    //
    const target_id = to_visit[0];
    const target = game.getObjectById()(target_id);
    logging.info('trying to boost creep', target_id, target);
    //
    if (target.boostCreep(this.creep) === game.ERR_NOT_IN_RANGE) {
      logging.info('moving to boost creep');
      this.creep.moveTo(target, {
        visualizePathStyle: {
          fill: 'transparent',
          stroke: 'yellow',
          lineStyle: 'dashed',
        },
      });
    } else {
      logging.info('shifting off target');
      to_visit.shift();
    }
    //
  }

  determine_labs_to_visit() {
    // See if the labs have any boosts.
    const labs = this.room.labs;
    const body = this.creep.body;
    const can_use = {};this.creep.can_use;

    _.each(this.creep.memory.can_use, cu => {
      can_use[cu] = true;
    });

    const to_visit = [];

    _.each(labs, lab => {
      const lab_has = _.filter(Object.keys(lab.store), n => n !== game.RESOURCE_ENERGY)[0];
      if (lab_has && can_use[lab_has]) {
        to_visit.push(lab.id);
      }
    });

    this.creep.memory.to_visit = to_visit;
  }
}

module.exports = {
  CreepBooster: CreepBooster,
}
