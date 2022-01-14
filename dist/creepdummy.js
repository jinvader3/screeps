const { Creep } = require('./creep');

class CreepDummy extends Creep {
  tick () {
    console.log('creep dummy tick');
  }
}

module.exports.CreepDummy = CreepDummy;

