class CreepDummy {
  constructor (room, creep) {
    this.creep = creep;
  }

  tick () {
    console.log('creep dummy tick');
  }
}

module.exports.CreepDummy = CreepDummy;

