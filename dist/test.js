const test = require('ava');
const main = require('./main');
const { Room } = require('./room');
const { CreepGeneralWorker } = require('./creepgw');
const { CreepFighter } = require('./creepfighter');
const { CreepMiner } = require('./creepminer');
const { TaskEngine } = require('./task');
const { CreepUpgrader } = require('./creepupgrader');
const { CreepClaimer } = require('./creepclaimer');
const { CreepDummy } = require('./creepdummy');
const { Terminal } = require('./terminal');
const { PathManager } = require('./path');
const game = require('./game');
const _ = game._;


test.serial('market:basic', t => {
    let room = {
        get_terminal: () => {
        },
        get_name: () => {
            return 'E32S54';
        },
    };

    let term = new Terminal(room);

    let orders = [
        { type: game.ORDER_BUY, resourceType: 'energy', amount: 1020, price: 0.01 },
        { type: game.ORDER_SELL, resourceType: 'energy', amount: 1010, price: 0.01 },

        { type: game.ORDER_SELL, resourceType: 'H', amount: 2, price: 1.3 },
        { type: game.ORDER_BUY, resourceType: 'H', amount: 5, price: 0.3 },
        { type: game.ORDER_SELL, resourceType: 'H', amount: 7, price: 0.03 },
        { type: game.ORDER_BUY, resourceType: 'H', amount: 3, price: 2.3 },

        { type: game.ORDER_SELL, resourceType: 'O', amount: 12, price: 3.3 },
        { type: game.ORDER_BUY, resourceType: 'O', amount: 3, price: 1.1 },
        { type: game.ORDER_SELL, resourceType: 'O', amount: 9, price: 0.02 },
        { type: game.ORDER_BUY, resourceType: 'O', amount: 1, price: 5.8 },

        { type: game.ORDER_SELL, resourceType: 'L', amount: 3, price: 2.3 },
        { type: game.ORDER_BUY, resourceType: 'L', amount: 22, price: 0.2 },
        { type: game.ORDER_SELL, resourceType: 'L', amount: 5, price: 1.9 },
        { type: game.ORDER_BUY, resourceType: 'L', amount: 3, price: 3.8 },

        { type: game.ORDER_SELL, resourceType: 'LH2O', amount: 5, price: 1.3 },
        { type: game.ORDER_BUY, resourceType: 'LH2O', amount: 4, price: 5.2 },
        { type: game.ORDER_SELL, resourceType: 'LH2O', amount: 9, price: 2.1 },
        { type: game.ORDER_BUY, resourceType: 'LH2O', amount: 6, price: 1.2 },

        { type: game.ORDER_SELL, resourceType: 'LHO2', amount: 9, price: 1.0 },
        { type: game.ORDER_BUY, resourceType: 'LHO2', amount: 12, price: 0.6 },
        { type: game.ORDER_SELL, resourceType: 'LHO2', amount: 3, price: 0.3 },
        { type: game.ORDER_BUY, resourceType: 'LHO2', amount: 9, price: 1.2 },
     ];

    game.set_market({
        getAllOrders: () => orders,
        calcTransactionCost: (rtype, ra, rb) => {
            return 1;
        },
    });

    let res = term.find_product_supply_and_demand_of_batch('H', 2);
    //t.truthy(res.sell_price === 1.3);
    //t.truthy(res.buy_price === 2.3);
    //t.truthy(res.sell_orders.length === 1);
    //t.truthy(res.buy_orders.length === 1);
    //t.truthy(res.sell_orders[0].price === 1.3);
    //t.truthy(res.buy_orders[0].price === 2.3);

    term.find_trades(200, 100);

    t.pass();
});

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
    t.truthy(typeof c.get_memory === 'function');
  });

  t.pass();
});

test.serial('path:cm1', t => {
  const structs = [
  ];

  function add_struct (x, y, id) {
    structs.push({
      pos: {
        x: x, 
        y: y, 
      },
      id: id,
    });
  }

  const broom = {
    find: (what) => {
      if (what !== game.FIND_STRUCTURES) {
        t.fail();
      }
      return structs;
    },
    getPositionAt: (x, y) => {
      return {
        x: x,
        y: y,
      };
    },
    findPathTo: (a, b) => {
      let cur = [a];
      let pen = [];
      let been = {};
      let iter = 0;

      console.log('===FINDPATHTO===')
      console.log('start', a);
      console.log('end', b);

      let dirs = [
        [-1, 0], [1, 0],
        [-1, 1], [1, -1],
        [-1, -1], [1, 1],
        [0, 1], [0, -1],
      ];

      //console.log('start', cur[0]);

      while (cur.length > 0) {
        while (cur.length > 0) {
          let chead = cur.pop();
          for (let dir of dirs) {
            let nx = chead.x + dir[0];
            let ny = chead.y + dir[1];
            if (nx < 0 || ny < 0 || nx > 49 || ny > 49) {
              continue;
            }
            let nhead = { x: nx, y: ny };
            if (been[nx + ny * 50] === undefined) {
              if (!_.some(structs, s => s.pos.x === nx && s.pos.y === ny)) {
                been[nx + ny * 50] = iter;
                pen.push(nhead);
              }
            }
          }
        }
        iter += 1;
        cur = pen;
        pen = [];
      }
      
      let cpos = b;
      let best = 9999;
      let path = [b]
      //
      //for (let z = 0; z < 25; ++z) {
      while (true) {
        //console.log('cpos', cpos);
        at_end = true;
        for (let dir of dirs) {
          let nx = cpos.x + dir[0];
          let ny = cpos.y + dir[1];
          if (nx < 0 || ny < 0 || nx > 49 || ny > 49) {
            continue;
          }
          let v = been[nx + ny * 50];
          if (v < best) {
            at_end = false;
            best = v;
            best_pos = { x: nx, y: ny };
            path.push(best_pos);
          }
        }
        //
        if (at_end) {
          break;
        }
        //
        cpos = best_pos;
        //
      }

      path.push(a);
      path = _.reverse(path); 
      console.log(path);
      return path;
    },
    lookAtArea: (top, left, bottom, right, as_array) => {
      t.truthy(!as_array);

      let out = {};
      
      for (let y = top; y < bottom + 1; ++y) {
        for (let x = left; x < right + 1; ++x) {
          if (x < 0 || y < 0) {
            continue;
          }
          if (x > 49 || y > 49) {
            continue;
          }
          let stuff = _.filter(structs, s => s.pos.x === x && s.pos.y === y);
          out[y] = out[y] || {};
          out[y][x] = stuff;
          out[y][x].push({ type: 'terrain', terrain: 'plain' });     
        }
      }

      return out;
    },
  };

  const room = {
    get_base_room: () => broom,
  };

  class CostMatrix {
    constructor () {
      this.d = new Uint8Array(50 * 50);
    }

    set (x, y, v) {
      this.d[x + y * 50] = v;
    }

    get (x, y) {
      return this.d[x + y * 50];
    }
  }

  game.set_path_finder({
    CostMatrix: CostMatrix,
  });

  console.log('!!!!', game.path_finder().CostMatrix);

  add_struct(3, 0, 'c1')
  add_struct(4, 3, 'e1');
  add_struct(5, 4, 'e2');
  add_struct(4, 5, 'e3');
  add_struct(4, 6, 'e4');
  add_struct(5, 7, 'e5');
  add_struct(6, 8, 'e6');
  add_struct(7, 9, 'e7');
  add_struct(20, 20, 'e8');
  add_struct(21, 3, 'e9');

  let pm = new PathManager(room);

  let cm = pm.get_all_stop_cost_matrix_dialated(50);

  const fs = require('fs');

  const data = [];

  for (let y = 0; y < 50; ++y) {
    let row = [];
    data.push('\n');
    for (let x = 0; x < 50; ++x) {
      let v = cm.get(x, y);
      data.push(`${x} ${y} ${v}\n`);
    }
  }

  fs.writeFileSync('test.plot', data.join(''));

  t.pass();
});

test.serial('bootup', t => {
  game.memory().creeps = {};
  game.memory().creeps['E32S87:apple'] = {
    c: 'gw',
    g: 'worker',
  };

  game.creeps()['E32S87:apple'] = {
    memory: game.memory().creeps['E32S87:apple'],
    name: 'E32S87:apple',
    store: {
      getUsedCapacity: type => {
        t.truthy(type === game.RESOURCE_ENERGY);
        return 0;
      },
      getFreeCapacity: type => {
        return 10;
      },
    },
    pos: {
      findClosestByPath: objs => {
        return objs[0];
      },
    },
    pickup: trgt => game.OK,
  };

  game.memory().rooms = {
    'E32S87': {},
  };

  let a = false;
  let b = false;
  let c = false;

  game.rooms()['E32S87'] = {
    energyCapacityAvailable: 1000,
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
    memory: game.memory().rooms['E32S87'],
    spawns: [
      {
        spawning: null,
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
        {
            id: 's1',
            energy: 100,
            pos: {
                x: 0,
                y: 0,
                findInRange: (what, dist) => {
                    return [];
                },
            },
        },
    ],
    lookForAtArea: (code, top, left, bottom, right) => {
        console.log('lookForAtArea', code, top, left, bottom, right);
        return [];
    },
    find: (code) => {
      console.log('find', code);
      t.truthy(code !== undefined);
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
  console.log(res);
  t.truthy(res.length === 0);
  //res = main.loop();
  //t.truthy(res.length === 0);

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
