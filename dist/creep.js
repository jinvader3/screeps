class Creep {
  constructor (room, creep) {
    this.creep = creep;
    this.room = room;
  }

  get_ttl () { return this.creep.ticksToLive; }
  get_memory () { return this.creep.memory; }
  get_pos() { return this.creep.pos; }
  get_group() { return this.creep.memory.g; }
  get_name () { return this.creep.name; }

  tick () {
  }
}

module.exports.Creep = Creep;
