const game = require('./game');
const { Creep } = require('./creep');
const _ = game._;
const { logging } = require('./logging');
const { StateMachineCreep } = require('./statemachcreep');
const { Terminal } = require('./terminal');

class CreepLabRat extends StateMachineCreep {
  tick (labman) {
    logging.info('labrat ticking');

    _.each (labman.room.active_containers_adj_mineral, cont => {
      logging.info('trying to add state set for active containers adj mineral');
      this.stmh_set(`acam:${cont.id}`, ss => {
        logging.info('adding state set');
        // This will drop off if our storage is already empty.
        logging.info(`room.get_storage=${this.room.get_storage()}`);
        this.stmh_dump_store_to_object(ss, this.room.get_storage());
        this.stmh_load_all_from_store(ss, cont);
        this.stmh_dump_store_to_object(ss, this.room.get_storage());
        return true;
      });
    });

    super.tick();
  }
}

class LabManager {
  constructor (room) {
    this.sm = room.get_spawnman();
    this.room = room;

    let rm = this.room.get_memory();
    rm.labman = rm.labman || {};
    this.m = rm.labman;

    this.term = new Terminal(room);
    this.has_terminal_structure = this.term.has_terminal_structure();

    const gm = game.memory();

    gm.trades_time = gm.trades_time || 0;
    logging.debug('thinking about doing trades');
    if (game.time() - gm.trades_time > 3000) {
      logging.debug('doing find_trades using terminal');
      gm.trades_time = game.time();
      gm.trades = this.term.find_trades(10, 1000);
    }

    rm.labman_comp_orders = rm.labman_comp_orders || [];
    this.comp_orders = rm.labman_comp_orders;
  }

  tick_need_credits (term_obj, movers) {
    if (term_obj.store.getUsedCapacity(game.RESOURCE_ENERGY) < 1500) {
      let mover = movers[0];
      logging.info('I need to put energy into the terminal.');
      if (mover) {
        logging.info('pushing state set to move energy into terminal');
        mover.stmh_set(`move_energy_into_terminal`, ss => {
          mover.stmh_dump_store_to_object(ss, this.room.get_storage());
          mover.stmh_load_resource_from_store(ss, this.room.get_storage(), game.RESOURCE_ENERGY);
          mover.stmh_dump_store_to_object(ss, term_obj);
          logging.info('state set pushed');
          return true;
        }); 
        mover.dump_logging_info();
      } else {
        logging.info('I have no labrat to move energy into the terminal...');
      }
    }
    return false;
  }

  tick_equalize_onto_terminal (stor, mover, term_obj) {
    if (stor) {
      logging.info('checking storage for resources needed in terminal');
      for (let rtype in stor.store) {
        logging.info(`looking at ${rtype}`);
        if (term_obj.store.getUsedCapacity(rtype) < 1000) {
          logging.info(`trying to move ${rtype} into terminal`);
          mover.stmh_set(`move_${rtype}_into_terminal_1k`, ss => {
            mover.stmh_dump_store_to_object(ss, stor);
            mover.stmh_load_resource_from_store(ss, stor, rtype);
            mover.stmh_dump_store_to_object(ss, term_obj);
            return true;
          });
        }
      }
    }
  }
  
  maintain_credits (term_obj, task) {
    // Try to sell things to maintain at least 50K in credits. BUT, _only_ if there
    // are no active component orders. If there are active component orders then the
    // terminal may be receiving parts for these orders and we don't want it selling
    // those as soon as they come in.
    if (this.comp_orders.length === 0 && game.market().credits < 10000) {
      let ctask = task.spawn_isolated(8, `terminal_seller`, ctask => {
        for (let rtype in term_obj.store) {
          if (rtype === game.RESOURCE_ENERGY) {
            continue;
          }

          let amount = term_obj.store.getUsedCapacity(rtype);

          let border = this.term.find_best_buyer(rtype);

          if (border) {
            let t_cost = game.market().calcTransactionCost(amount, this.room.get_name(), border.roomName);
            let deal_res = game.market().deal(
              border.id, Math.min(amount, border.amount), this.room.get_name()
            );
            logging.info(`deal_res = ${deal_res} for ${rtype} amount ${amount}`);
          }
        }
      });

      task.transfer(ctask, 0.2, 1);
    }
  }

  comp_order_deals (term_obj) {
    logging.wrapper('deals', () => {
      for (let corder of this.comp_orders) {
        if (corder.action === 'buy' && corder.count > 0) {
          logging.info(`Thinking about buying for corder ${corder.what} at count ${corder.count}.`);
          // Look for the item at the best price.
          const sorder = this.term.find_best_seller(corder.what);
          if (term_obj.cooldown === 0) {
            let deal_res = game.market().deal(sorder.id, corder.count, this.room.get_name());
            logging.info(`deal_res = ${deal_res}`);
            if (deal_res === game.OK) {
              this.term.force_orders_update();
              logging.info('The corder was set to zero. It has been fulfilled.');
              logging.info(`corder.count=${corder.count} sorder.amount=${sorder.amount}`);
              corder.count -= Math.min(corder.count, sorder.amount);
            }
            return;
          }
        }
      }
    });
  }

  clear_labs_out (labs, mover, term_obj) {
    let lab0_what = Object.keys(labs[0].store)[0];
    let lab1_what = Object.keys(labs[1].store)[0];
    let lab2_what = Object.keys(labs[2].store)[0];

    logging.info('There is no valid next_comp_order. Emptying labs.');

    const arg_set = [
      [lab0_what, labs[0], 'lab0'],
      [lab1_what, labs[1], 'lab1'],
      [lab2_what, labs[2], 'lab2'],
    ];

    for (let args of arg_set) {
      const what = args[0];
      const lab = args[1];
      const txt = args[2];
      if (what !== undefined) {
        mover.stmh_set(`move_product_outof_${txt}`, ss => {
          mover.stmh_dump_store_to_object(ss, this.room.get_storage());
          mover.stmh_load_resource_from_store(ss, lab, what);
          mover.stmh_dump_store_to_object(ss, term_obj);
          return true;
        });
      }
    }
  }

  comp_order_execute (labs, term_obj, next_comp_order, mover) {
      /////////////////////////////////
      // Sum up the total of the output between the output lab, terminal, and the creep
      // that is doing the work.
      let output_have = labs[2].store.getUsedCapacity(next_comp_order.output);
  
      if (output_have === next_comp_order.count) {
        logging.info('Going to set next_comp_order to zero because of output lab fulfilled.');
        next_comp_order.count = 0;
      }

      let lab0_what = Object.keys(labs[0].store)[0];
      let lab1_what = Object.keys(labs[1].store)[0];
      let lab2_what = Object.keys(labs[2].store)[0];

      // Put in an order to load up the labs.
      logging.info(`Creating orders to load up labratories.`);
      logging.info(`Lab-Input-A=${next_comp_order.inputs[0]}`);
      logging.info(`Lab-Input-B=${next_comp_order.inputs[1]}`);
      logging.info(`Lab-Output=${next_comp_order.output}`);
      logging.info(`lab2_what=${lab2_what} lab1_what=${lab1_what} lab0_what=${lab0_what}`);

      if (lab2_what === undefined || lab2_what === next_comp_order.output) {          
      } else {
        logging.info('lab2 has the wrong product in it');
        mover.stmh_set('move_product_outof_lab_c', ss => {
          mover.stmh_dump_store_to_object(ss, this.room.get_storage());
          mover.stmh_load_resource_from_store(ss, labs[2], lab2_what);
          mover.stmh_dump_store_to_object(ss, term_obj);
          return true;
        });    
      }

      if (lab0_what === undefined || lab0_what === next_comp_order.inputs[0]) {          
        if (term_obj.store.getUsedCapacity(next_comp_order.inputs[0]) > 0) {
          logging.info('moving product into lab0');
          mover.stmh_set('move_product_into_lab_aa', ss => {
            mover.stmh_dump_store_to_object(ss, this.room.get_storage());
            mover.stmh_load_resource_from_store(ss, term_obj, next_comp_order.inputs[0]);
            mover.stmh_dump_store_to_object(ss, labs[0]);
            return true;
          });
        }
      } else {
        logging.info('lab0 has the wrong product in it');
        mover.stmh_set('move_product_outof_lab_a', ss => {
          mover.stmh_dump_store_to_object(ss, this.room.get_storage());
          mover.stmh_load_resource_from_store(ss, labs[0], lab0_what);
          mover.stmh_dump_store_to_object(ss, term_obj);
          return true;
        });    
      }
     
      if (lab1_what === undefined || lab1_what === next_comp_order.inputs[1]) { 
        if (term_obj.store.getUsedCapacity(next_comp_order.inputs[1]) > 0) {
          mover.stmh_set('move_product_into_lab_b', ss => {
            mover.stmh_dump_store_to_object(ss, this.room.get_storage());
            mover.stmh_load_resource_from_store(ss, term_obj, next_comp_order.inputs[1]);
            mover.stmh_dump_store_to_object(ss, labs[1]);
            return true;
          });
        }
      } else {
        logging.info('lab1 has the wrong product in it');
        mover.stmh_set('move_product_outof_lab_b', ss => {
          mover.stmh_dump_store_to_object(ss, this.room.get_storage());
          mover.stmh_load_resource_from_store(ss, labs[1], lab1_what);
          mover.stmh_dump_store_to_object(ss, term_obj);
          return true;
        });
      }
        
      // If both input labs have the correct product and the output lab is cooled down
      // the process the inputs into the output.
      let a_have = labs[0].store.getUsedCapacity(next_comp_order.inputs[0]);
      let b_have = labs[1].store.getUsedCapacity(next_comp_order.inputs[1]);
      logging.info(`?=${labs[0].id} a_have=${a_have} b_have=${b_have}`);
      if (a_have > 0 && b_have > 0 && labs[2].cooldown === 0) {
        logging.info('running reaction');
        const res = labs[2].runReaction(labs[0], labs[1]);
        logging.info('res', res);
        if (res === game.OK) {
          next_comp_order.count -= Math.min(a_have, b_have);
        }
      }
      /////////////////////////
  }

  tick_trade (task, creeps, labs, movers) {
    const gm = game.memory();

    if (!gm.trades || gm.trades.length === 0) {
      logging.info('There are no trades to do analysis on.');
      return;
    }

    const term_obj = this.room.get_terminal();

    if (!term_obj) {
      return;
    }

    if (this.tick_need_credits(term_obj, movers)) {
      return true;
    }
   
    let mover = movers[0];
    let stor = this.room.get_storage();

    if (!mover) {
      return;
    }

    if (this.tick_equalize_onto_terminal(stor, mover, term_obj)) {
      return true;
    }

    // Do any selling to generate needed credits.
    this.maintain_credits(term_obj, task);
    // Do the buying for current orders.
    this.comp_order_deals(term_obj); 

    // Look for next non-zero count component order of action 'combine'.
    let next_comp_order = null;
    for (let x = 0; x < this.comp_orders.length; ++x) {
      const corder = this.comp_orders[x];
      if (corder.action === 'combine' && corder.count > 0) {
        next_comp_order = corder; 
        break;
      }      
    }

    if (next_comp_order) {
      this.comp_order_execute(labs, term_obj, next_comp_order, mover);
    } else {
      this.clear_labs_out(labs, mover, term_obj);
      logging.info('Clearing out component orders since there is no valid next order.');
      while (this.comp_orders.length > 0) {
        let e = this.comp_orders.pop();
        logging.info('bye entry', JSON.stringify(e)); 
      }
    }

    let best_trade = gm.trades[0];

    let profit_delta = best_trade.demand_price - best_trade.factory_price

    // TODO: Consider the fact that the supply_price may be lower than the demand_price!

    // I am going to try building things at a slight loss. It will help to test
    // the code. As long as the loss is not too much per item.
    if (profit_delta < -10) {
      logging.info('The best trade\'s factory price is larger than demand price.');
      return;
    }

    // If we have no component orders then create a list of them from the current
    // best product we can build.
    if (this.comp_orders.length === 0) {
      const count = 10;

      logging.info('Linearizing plan.');
      // Convert the trade plan into a linear list.
      const trade_parts = this.term.make_plan_linear(best_trade.plan);

      const comp_orders = this.comp_orders;

      const to_buy = {};  
      const to_combine = {};

      logging.info('trade_parts.length', trade_parts.length);
 
      for (let e of trade_parts) {
        logging.info('here');
        if (e[1] === undefined && e[2] === undefined) {
          // This is required to be bought.
          logging.info(`trade_part *must* buy ${e[3]}`);
          //comp_orders.push({
          //  action: 'buy',
          //  what: e[3],
          //  count: count,
          //});
          to_buy[e[3]] = to_buy[e[3]] || 0;
          to_buy[e[3]] += count;
        } else {
          logging.info(`trade_part *must* combine ${e[1]} + ${e[2]} = ${e[3]}`);
          //comp_orders.push({
          //  action: 'combine',
          //  what: [e[1], e[2]],
          //  into: e[3],
          //  count: count,
          //});
          to_combine[e[3]] = to_combine[e[3]] = {};
          to_combine[e[3]].what = [e[1], e[2]];
          to_combine[e[3]].count = to_combine[e[3]].count || 0;
          to_combine[e[3]].count += count;
        }
      }

      for (let k in to_buy) {
        logging.debug(`to_buy ${k}=${to_buy[k]}`);

        // Calculate how much is in the labs at this moment.
        const amount_in_labs = _.sumBy(labs, lab => {
          const what = Object.keys(lab.store)[0];
          if (what !== k) {
            return 0;
          }
          return lab.store.getUsedCapacity(k);
        });

        comp_orders.push({
          action: 'buy',
          what: k,
          count: to_buy[k] - term_obj.store.getUsedCapacity(k) - amount_in_labs,
        });
      }

      for (let k in to_combine) {
        logging.debug(`to_combine ${k}=${to_combine[k].count}`);
        comp_orders.push({
          action: 'combine',
          inputs: to_combine[k].what,
          output: k,
          count: to_combine[k].count //- term_obj.store.getUsedCapacity(k),
        });
      }
    }
    //
  }

  tick (task, creeps, labs, extractors) {
    if (labs.length < 3 || !this.has_terminal_structure) {
      return;
    }

    logging.info('ticking');

    function *labrat_extractor_bf() {
      let body = []
      body.push(game.MOVE);
      body.push(game.CARRY);
      while (true) {
        body.push(game.MOVE);
        body.push(game.WORK);
        yield body;
      }
    }

    function *labrat_mover_bf() {
      let body = []
      while (true) {
        body.push(game.MOVE);
        body.push(game.CARRY);
        yield body;
      }
    }

    // (1/4) schedule creep creation
    _.each(this.room.minerals, mineral => {
      let has_extractor = _.some(
        mineral.pos.findInRange(FIND_STRUCTURES, 1.8), 
        s => s.structureType === game.STRUCTURE_EXTRACTOR
      );

      logging.info(`looking at mineral ${mineral.id}`);

      if (!has_extractor) {
        logging.info('skipping mineral because it has no extractor');
        return;
      }

      logging.info('registering spawn build for labrat_extractor');
      this.sm.reg_build(
        'miner',
        'labrat_extractor',
        labrat_extractor_bf,
        40,
        8,
        1,
        {
          // Treat an extractor just like a source.
          s: mineral.id,
        }
      );
    });

    if (labs.length >= 3) {
      logging.info('registering spawn build for labrat_mover');
      this.sm.reg_build(
        'labrat',
        'labrat_mover',
        labrat_mover_bf,
        40,
        8,
        1,
        {}
      );
    }

    let movers = [];

    for (let creep of creeps) {
      if (creep instanceof CreepLabRat) {
        movers.push(creep);
      }
    }

    // (2/4) look at the trade data and see what we can try to build
    // (3/4) look at what we can sell and sell it
    this.tick_trade(task, creeps, labs, movers);

    // (4/4) let creeps ticks
    for (let creep of creeps) {
      logging.debug(`ticking creep ${creep.get_name()}`);
      task.spawn(10, `labrat:${creep.get_name()}`, ctask => {
        if (creep instanceof CreepLabRat) {
          creep.tick(this);
        } else {
          creep.tick();
        }
      });
    }
    ///////////////////////////    
  }
}

module.exports.CreepLabRat = CreepLabRat;
module.exports.LabManager = LabManager;
