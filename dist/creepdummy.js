class CreepDummy {
  constructor (room, creep) {
    this.creep = creep;
  }

  get_name () {
    return this.creep.name;
  }

  tick () {
    console.log('creep dummy tick');
  }
}

module.exports.CreepDummy = CreepDummy;

