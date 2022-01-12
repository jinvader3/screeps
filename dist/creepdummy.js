class CreepDummy {
  constructor (room, creep) {
    this.creep = creep;
  }

  get_pos () {
    return this.creep.pos;
  }

  get_group() {
    return this.creep.memory.g;
  }

  get_name () {
    return this.creep.name;
  }

  tick () {
    console.log('creep dummy tick');
  }
}

module.exports.CreepDummy = CreepDummy;

