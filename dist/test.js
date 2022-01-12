const test = require('ava');
const main = require('./main');
const { Room } = require('./room');
const { CreepGeneralWorker } = require('./creepgw');
const { CreepFighter } = require('./creepfighter');
const { CreepMiner } = require('./creepminer');
const { TaskEngine } = require('./task');
const { CreepClaimer } = require('./creepclaimer');
const { CreepDummy } = require('./creepdummy');
const game = require('./game');
const _ = game._;

test.serial('creep_iface', t => {
  // Ensure each creep sub-type has the proper interface.
  let c;

  let room = {};
  let base_creep = {
    name: 'test',
    memory: {
      g: 'okay',
    },
  };

  let clazzes = [
    CreepGeneralWorker, 
    CreepFighter, 
    CreepMiner,
    CreepClaimer,
    CreepDummy,
    CreepUpgrader,
  ];

  _.each(clazzes, clazz => {
    let c = new clazz(room, base_creep);
    console.log('testing', clazz, typeof c.get_pos);
    t.truthy(c.get_name() === base_creep.name);
    t.truthy(typeof c.tick === 'function');
    t.truthy(typeof c.get_pos === 'function');
    t.truthy(typeof c.get_group === 'function');
    t.truthy(c.get_group() === 'okay')
  });

  t.pass();
});

test.serial('bootup', t => {
  game.memory().creeps = {};
  game.memory().creeps['E32S87:apple'] = {
    c: 'gw',
    g: 'hauler',
  };

  game.creeps()['E32S87:apple'] = {
    memory: game.memory().creeps['E32S87:apple'],
    name: 'E32S87:apple',
    store: {
      getUsedCapacity: type => {
        t.truthy(type === game.RESOURCE_ENERGY);
        return 1;
      },
    },
    pos: {
      findClosestByPath: objs => {
        return objs[0];
      },
    },
    repair: () => {
      return game.OK;
    },
    pickup: () => {
      console.log('pickup');
      return game.OK;
    },
    upgradeController: (trgt) => {
      console.log('upgrade', trgt);
      return game.OK;
    },
  };

  game.memory().rooms = {
    'E32S87': {},
  };

  let a = false;
  let b = false;
  let c = false;

  game.rooms()['E32S87'] = {
    controller: {
      my: true,
      id: 'c3',
      pos: {
        findInRange: (what, dist) => {
          let res = game.rooms()['E32S87'].containers;
          console.log('findInRange', res.length);
          return res;
        },
      },
    },
    createConstructionSite: () => {
      console.log('create construction site... instant create')
      game.rooms()['E32S87'].containers.push({
        id: 'b5',
        structureType: game.STRUCTURE_CONTAINER,
        pos: {
          isEqualTo: other => true,
        },
      });
      return game.OK;
    },
    memory: game.memory().rooms['E32S87'],
    spawns: [
      {
        spawnCreep: () => {
          return game.OK;
        },
      },
    ],
    get_controller: () => {
      return game.rooms()['E32S87'].controller;
    },
    containers: [
    ],
    sources: [
    ],
    find: (code) => {
      switch (code) {
        case game.FIND_MY_SPAWNS: return game.rooms()['E32S87'].spawns;
        case game.FIND_SOURCES: return game.rooms()['E32S87'].sources;
        case game.FIND_HOSTILE_CREEPS: return [];
        case game.FIND_CONSTRUCTION_SITES: return [];
        case game.FIND_STRUCTURES: return [];
      }
    },
  };

  game.setGetObjectByIdTrampoline(id => {
    console.log('resolve id', id);
    switch (id) {
      case 's1': return game.rooms()['E32S87'].sources[0];
      case 'c3': return game.rooms()['E32S87'].controller;
      default: throw new Error(`unknown id ${id}`);
    }
  });

  let res = main.loop();
  t.truthy(res.length === 0);
  res = main.loop();
  t.truthy(res.length === 0);

  t.pass();
});

function clear_game_memory() {
  game.memory_clear();
}

test.serial('tasks:singletask', t => {
  clear_game_memory();
  let te = new TaskEngine();
  let a = false;
  let task = te.spawn(0, 'apple', task => {
    a = true;
  });
  task.credit(1);
  te.run_tasks();
  t.truthy(a);
  t.pass();
});

test.serial('tasks:creditandcharge', t => {
  clear_game_memory();
  game.cpu().setUsed(0);
  let te = new TaskEngine();
  let a = false;
  let b = false;
  let c = false;
  let task;

  task = te.spawn(0, 'apple', task => {
    game.cpu().setUsed(9);
    a = true;
  });

  task.credit(10);
  te.run_tasks();
  t.truthy(a);

  task = te.spawn(0, 'apple', task => {
    game.cpu().setUsed(10);
    b = true;
  });

  te.run_tasks();
  t.truthy(b);

  task = te.spawn(0, 'apple', task => {
    c = true;
  });
  
  te.run_tasks();
  t.truthy(!c);

  t.pass();
});

test.serial('tasks:indepchildcredit', t => {
  console.log('tasks:indepchildcredit');
  clear_game_memory();

  game.cpu().setUsed(0);

  let te = new TaskEngine();
  let a = false;
  let b = false;
  let task;

  task = te.spawn(0, 'apple', task => {
    task.spawn_isolated(0, 'isolated_apple', () => {
      b = true;
    });
    game.cpu().setUsed(5);
    a = true;
  });

  console.log('!!!', task.get_credit());

  task.credit(10);
  te.run_tasks();
  t.truthy(a && !b);

  console.log('==');

  a = false;
  b = false;

  task = te.spawn(0, 'apple', task => {
    let ctask = task.spawn_isolated(0, 'isolated_apple', () => {
      b = true;
    });

    // Take 10 credits from task and give to ctask.
    task.transfer(ctask, 10, 20);
    game.cpu().setUsed(5);
    a = true;
  });
  
  console.log('!!!', task.get_credit());

  te.run_tasks();
  t.truthy(a && b);

  console.log('==');

  a = false;
  b = false;

  task = te.spawn(0, 'apple', task => {
    let ctask = task.spawn_isolated(0, 'isolated_apple', () => {
      b = true;
    });
    // Take 10 credits from task and give to ctask.
    console.log('transfer');
    task.transfer(ctask, 20, 20);
    game.cpu().setUsed(5);
    a = true;
  });

  console.log('@@@', task.get_credit());

  te.run_tasks();
  t.truthy(!a && !b);
  // It should have a deficit. That is the cost of the transfer
  // and the run-time.
  t.truthy(task.get_credit() === -5);

  t.pass();
});

test.serial('tasks:childtaskandpriority', t => {
  console.log('tasks:childtaskandpriority');
  clear_game_memory();
  game.cpu().setUsed(0);
  let te = new TaskEngine();
  let a = false;
  let b = false;
  let c = false;
  let d = 0;
  let e = false;
  let task = te.spawn(0, 'apple', task => {
    console.log('apple running')
    a = d++;
    task.spawn(0, 'grape', ctask => {
      console.log('grape running');
      b = d++;
    });
    task.spawn(1, 'fox', ctask => {
      console.log('fox running');
      c = d++;
    });
    task.spawn(-1, 'turtle', ctask => {
      console.log('turtle running');
      e = d++;
    });
  });
  
  task.credit(1);
  t.truthy(te.pending_tasks());
  te.run_tasks();
  t.truthy(!te.pending_tasks());
  t.truthy(a === 0);
  t.truthy(e === 1);
  t.truthy(b === 2);
  t.truthy(c === 3); 
  t.pass();
});

/*
test('bar', async t => {
  // t.fail()
  // t.pass()
  const bar = Promise.resolve('bar');
  t.is(await bar, 'bar');
});
*/
