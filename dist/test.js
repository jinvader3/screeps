const test = require('ava');
const main = require('./main');
const { Room } = require('./room');
const { CreepGeneralWorker } = require('./creepgw');
const game = require('./game');
const _ = game._;

class GhostStore {
  constructor (total_capacity) {
    this.res = {};
    this.total_capacity = total_capacity;
  }

  set_resource (rtype, amount, capacity) {
    this.res[rtype] = {
      amount: amount,
      capacity: capacity,
    };
    return this;
  }

  getFreeCapacity (rtype) {
    rtype = rtype || game.RESOURCE_ENERGY;
    if (this.res[rtype] === undefined) {
      return 0;
    }
    return this.res[rtype].capacity - this.res[rtype].amount;
  }

  getUsedCapacity (rtype) {
    rtype = rtype || game.RESOURCE_ENERGY;
    if (this.res[rtype] === undefined) {
      return 0;
    }
    return this.res[rtype].amount;
  }

  getCapacity () {
    return this.total_capacity;
  }
}

class GhostRoomPosition {
  constructor (x, y, room_name) {
    this.roomName = room_name;
    this.x = x;
    this.y = y;
  }
}

class GhostCSite {
  constructor (name, stype) {
    this.id = name;
    this.structureType = stype;
    this.__type = 'csite';
  }
}

class GhostController {
  constructor (id) {
    this.id = id;
    this.ticksToDowngrade = 0;
    this.my = true;
    this.structureType = game.STRUCTURE_CONTROLLER;
    this.__type = 'controller';
  }
}

class GhostCreep {
  constructor (name, room) {
    this.name = name;
    this.memory = {};
    this.store = new GhostStore();
    this.pos = new GhostRoomPosition(0, 0, room.name);
  }

  upgradeController (trgt) {
    if (typeof trgt !== GhostController) {
      return game.ERR_INVALID_TARGET;
    }

    return game.OK;
  }

  transfer (trgt, restype, amount) {
    if (typeof trgt !== GhostSpawn) {
      return game.ERR_INVALID_TARGET;
    }

    return game.OK;
  }

  build (trgt) {
    if (typeof trgt !== GhostCSite) {
      return game.ERR_INVALID_TARGET;
    }

    return game.OK;
  }

  harvest (trgt) {
    if (typeof trgt !== GhostSource) {
      return game.ERR_INVALID_TARGET;
    }
    return game.OK;
  }

  withdraw (trgt, restype, amount) {
    return game.ERR_INVALID_TARGET;
  }
}

class GhostSource {
  constructor (id) {
    this.id = id;
    this.__type = 'source';
    this.structureType = game.STRUCTURE_SOURCE;
    this.energy = 0;
  }
}

class GhostSpawn {
  constructor (id) {
    this.id = id;
    this.__type = 'spawn';
    this.structureType = game.STRUCTURE_SPAWN;
    this.store = new GhostStore();
  }

  spawnCreep (parts, name, memory) {
  }
}

class GhostRoom {
  constructor (name) {
    this.name = name;
    this.objs = {};
    this.memory = {};
  }

  add_object (obj) {
    this.objs[obj.id] = obj;
  }

  find (what) {
    let out = [];

    _.each(this.objs, obj => {
      console.log('FIND', obj.id, obj.__type, what);
      if (what === game.FIND_MY_SPAWNS && obj.__type === 'spawn') {
        out.push(obj);
      } else if (what === game.FIND_SOURCES && obj.__type === 'source') {
        out.push(obj);
      } else if (what === game.FIND_CONSTRUCTION_SITES && obj.__type === 'csite') {
        console.log('pushing');
        out.push(obj);
      }
    });

    return out;
  }
}

test('Room:general1', t => {
  let room = new Room(new GhostRoom('E34N32'));
  // Test it works without adding anything.
  room.tick();
  t.pass();
});

test('Room:general2', t => {
  let groom = new GhostRoom('E34N32');
  let so0 = new GhostSource('xmns2');
  let so1 = new GhostSource('mxjs1');
  let sp0 = new GhostSpawn('sp32');
  groom.add_object(so0);
  groom.add_object(so1);
  groom.add_object(sp0);
  so0.energy = 100;
  room = new Room(groom);  
  let gcreep = new GhostCreep('c392', groom);
  gcreep.memory.c = 'gw';
  game.setGetObjectByIdTrampoline(id => {
    return _.find(groom.objs, obj => obj.id === id);
  });
  room.add_creep(gcreep);

  let ca = false;

  sp0.store.set_resource(game.RESOURCE_ENERGY, 0, 100);

  gcreep.store.set_resource(game.RESOURCE_ENERGY, 0, 100);
  gcreep.harvest = () => { 
    ca = true; 
    return game.OK 
  };
  let cb = false;
  gcreep.upgradeController = () => { cb = true; return game.OK; };
  // it should harvest
  room.tick();
  t.truthy(ca && !cb);
  gcreep.harvest = () => {
    ca = true;
    gcreep.store.set_resource(game.RESOURCE_ENERGY, 100, 100);
    return game.OK 
  };
  // it should harvest and we will fill its energy
  room.tick();
  t.truthy(ca && !cb);
  // it should upgradeController
  room.tick();
  t.truthy(cb);
  ca = false;
  cb = false;
  // it should upgradeController again and we will empty its energy
  room.tick();
  t.truthy(!ca && cb);
  gcreep.upgradeController = () => { 
    cb = true; 
    gcreep.store.set_resource(game.RESOURCE_ENERGY, 0, 100);
    return game.OK;
  };
  room.tick();
  ca = false;
  cb = false;
  room.tick();
  t.truthy(ca && !cb);


  t.pass();
});

test('Room:general3', t => {
  let groom = new GhostRoom('E34N32');
  let so0 = new GhostSource('xmns2');
  let so1 = new GhostSource('mxjs1');
  let sp0 = new GhostSpawn('sp32');
  let cs0 = new GhostCSite('cs22');
  let ct0 = new GhostController('ct32');

  groom.add_object(so0);
  groom.add_object(so1);
  groom.add_object(sp0);
  groom.add_object(cs0);
  groom.add_object(ct0);

  so0.energy = 100;

  room = new Room(groom);  
  let gcreep = new GhostCreep('c392', groom);
  gcreep.memory.c = 'gw';
  game.setGetObjectByIdTrampoline(id => {
    return _.find(groom.objs, obj => obj.id === id);
  });
  room.add_creep(gcreep);

  let ca = false;
  gcreep.store.set_resource(game.RESOURCE_ENERGY, 100, 100);
  sp0.store.set_resource(game.RESOURCE_ENERGY, 100, 100);

  gcreep.harvest = (trgt) => { 
    console.log('@harvesting');
    ca = true; 
    return game.OK 
  };

  cs0.pos = { x: 5, y: 5 };

  let cb = false;
  gcreep.upgradeController = (trgt) => { 
    console.log('upgrade called', trgt.id);
    if (trgt.id === 'ct32') {
      cb = true; 
    }
    if (trgt.id === 'cs22') {
      cc = true;
    }
    return game.OK; 
  };

  groom.controller = ct0;
 
  ct0.ticksToDowngrade = 90000;
  room.tick();
  // It should have found a construction site.
  t.truthy(!ca && !cb && cc);
});

test('Room:general4', t => {
  let groom = new GhostRoom('E34N32');
  let so0 = new GhostSource('xmns2');
  let so1 = new GhostSource('mxjs1');
  let sp0 = new GhostSpawn('sp32');
  let cs0 = new GhostCSite('cs22');
  //let ct0 = new GhostController('ct32');

  groom.add_object(so0);
  groom.add_object(so1);
  groom.add_object(sp0);
  groom.add_object(cs0);
  //groom.add_object(ct0);

  so0.energy = 100;

  room = new Room(groom);  

  let gcreep0 = new GhostCreep('c392', groom);
  gcreep0.memory.c = 'gw';
  room.add_creep(gcreep0);
  let gcreep1 = new GhostCreep('c392', groom);
  gcreep1.memory.c = 'gw';
  room.add_creep(gcreep1);
  
  game.setGetObjectByIdTrampoline(id => {
    return _.find(groom.objs, obj => obj.id === id);
  });

  let ca = false;
  gcreep0.store.set_resource(game.RESOURCE_ENERGY, 100, 100);
  gcreep1.store.set_resource(game.RESOURCE_ENERGY, 100, 100);
  sp0.store.set_resource(game.RESOURCE_ENERGY, 0, 100);

  gcreep0.harvest = (trgt) => { 
    ca = true; 
    return game.OK 
  };
  gcreep1.harvest = gcreep0.harvest;

  cs0.pos = { x: 5, y: 5 };

  let cb = false;
  gcreep0.upgradeController = (trgt) => { 
    console.log('creep0 upgrade');
    return game.OK; 
  };

  gcreep1.upgradeController = (trgt) => {
    console.log('creep1 upgrade');
    return game.OK;
  };

  room.tick();
});

 /*
test('bar', async t => {
  // t.fail()
  // t.pass()
  const bar = Promise.resolve('bar');
  t.is(await bar, 'bar');
});
*/
