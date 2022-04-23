const game = require('./game');
const { Creep } = require('./creep');
const _ = game._;
const { logging } = require('./logging');
const { StateMachineCreep } = require('./statemachcreep');
const { Terminal } = require('./terminal');

class CreepLabRat extends StateMachineCreep {
  tick (labman) {
    _.each (labman.room.active_containers_adj_mineral, cont => {
      this.stmh_set(`acam:${cont.id}`, ss => {
        // This will drop off if our storage is already empty.
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
    
    this.boosting = room.ecfg.lab_boosting || false;

    const gm = game.memory();

    gm.trades_time = gm.trades_time || 0;
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
        //mover.dump_logging_info();
      } else {
        logging.info('I have no labrat to move energy into the terminal...');
      }
    }
    return false;
  }

  tick_equalize_onto_terminal (stor, mover, term_obj) {
    if (stor) {
      for (let rtype in stor.store) {
        if (term_obj.store.getUsedCapacity(rtype) < 1000) {
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
    if (term_obj.cooldown > 0) {
      return;
    }

    // Sell things between work orders.
    if (game.market().credits < 100000) {
      let ctask = task.spawn_isolated(8, `terminal_seller`, ctask => {
        for (let rtype in term_obj.store) {
          //if (rtype !== game.RESOURCE_ENERGY && rtype != 'XKH2O') {
          //  continue;
          //}

          if (rtype !== 'XKH2O') {
            continue;
          }

          let amount = term_obj.store.getUsedCapacity(rtype);

          let border = this.term.find_best_buyer(rtype);

          if (border) {
            let t_cost = game.market().calcTransactionCost(amount, this.room.get_name(), border.roomName);
            let deal_res = game.market().deal(
              border.id, Math.min(amount - t_cost, border.amount), this.room.get_name()
            );
            logging.info(`deal_res = ${deal_res} for ${rtype} amount ${amount}`);
            return;
          }
        }
      });

      task.transfer(ctask, 0.1, 1);
    }
  }

  comp_order_deals (term_obj) {
    logging.wrapper('deals', () => {
      for (let corder of this.comp_orders) {
        if (corder.action === 'buy' && corder.count > 0) {
          //logging.info(`Thinking about buying for corder ${corder.what} at count ${corder.count}.`);
          // Look for the item at the best price.
          const sorder = this.term.find_best_seller(corder.what);
          if (sorder && term_obj.cooldown === 0) {
            let deal_res = game.market().deal(sorder.id, corder.count, this.room.get_name());
            //logging.info(`deal_res = ${deal_res}`);
            if (deal_res === game.OK) {
              this.term.force_orders_update();
              logging.info(`The corder for ${corder.what} was set to zero. It has been fulfilled.`);
              //logging.info(`corder.count=${corder.count} sorder.amount=${sorder.amount}`);
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
  
      //if (output_have === next_comp_order.count) {
      //  logging.info('Going to set next_comp_order to zero because of output lab fulfilled.');
      //  next_comp_order.count = 0;
      //  return;
      //}

      const have_some_product = (what) => {
        if (Object.keys(labs[0].store)[0] === what) {
          return true;
        }
        
        if (Object.keys(labs[1].store)[0] === what) {
          return true;
        }

        if (Object.keys(labs[2].store)[0] === what) {
          return true;
        }

        if (_.some(Object.keys(mover.creep.store), k => k === what)) {
          return true;
        }

        if (_.some(Object.keys(term_obj.store), k => k === what)) {
          return true;
        }

        return false;
      };

      let lab0_what = Object.keys(labs[0].store)[0];
      let lab1_what = Object.keys(labs[1].store)[0];
      let lab2_what = Object.keys(labs[2].store)[0];

      logging.info(`job ${next_comp_order.inputs[0]}+${next_comp_order.inputs[1]}=${next_comp_order.output}`);

      if (!have_some_product(next_comp_order.inputs[0])) {
        return true;
      }

      if (!have_some_product(next_comp_order.inputs[1])) {
        return true;
      }

      const self = this;

      function move_product_out_of_lab (name, lab) {
        const lab_what = Object.keys(lab.store)[0];
        if (lab_what) {
          mover.stmh_set(name, ss => {
            mover.stmh_dump_store_to_object(ss, self.room.get_storage());
            mover.stmh_load_resource_from_store(ss, lab, lab_what);
            mover.stmh_dump_store_to_object(ss, term_obj);
            return true;
          });
        }    
      }

      function move_product_into_lab (name, lab, what) {
        if (term_obj.store.getUsedCapacity(what) > 0) {
          mover.stmh_set(name, ss => {
            mover.stmh_dump_store_to_object(ss, self.room.get_storage());
            mover.stmh_load_resource_from_store(ss, term_obj, what);
            mover.stmh_dump_store_to_object(ss, lab);
            return true;
          });
        }
      }

      function lab_ready_for_io (lab, what) {
        const lab_what = Object.keys(lab.store)[0];
        return lab_what === undefined || lab_what === what;
      }

      if (lab_ready_for_io(labs[2], next_comp_order.output)) {
      } else {
        move_product_out_of_lab('mpoolc', labs[2]);
      }

      if (lab_ready_for_io(labs[0], next_comp_order.inputs[0])) {
        move_product_into_lab('mpila', labs[0], next_comp_order.inputs[0]);
      } else {
        move_product_out_of_lab('mpoola', labs[0]);
      }
      
      if (lab_ready_for_io(labs[1], next_comp_order.inputs[1])) {
        move_product_into_lab('mpilb', labs[1], next_comp_order.inputs[1]);
      } else {
        move_product_out_of_lab('mpoolb', labs[1]);
      }
        
      // If both input labs have the correct product and the output lab is cooled down
      // the process the inputs into the output.
      let a_have = labs[0].store.getUsedCapacity(next_comp_order.inputs[0]);
      let b_have = labs[1].store.getUsedCapacity(next_comp_order.inputs[1]);
      if (a_have > 0 && b_have > 0 && labs[2].cooldown === 0) {
        logging.info('running reaction', a_have, b_have);
        const res = labs[2].runReaction(labs[0], labs[1]);
        logging.info('res', res);
        if (res === game.OK) {
          // It only does a maximum of 5 per reaction cycle.
          next_comp_order.count -= Math.min(a_have, b_have, 5);
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

    //////////////////////////////////////////////////////////////////////
    // Look for next non-zero count component order of action 'combine'.//
    //////////////////////////////////////////////////////////////////////
    let next_comp_order = null;

    /*
    for (let x = 0; x < this.comp_orders.length; ++x) {
      const corder = this.comp_orders[x];
      if (corder.action === 'combine' && corder.count > 0) {
        next_comp_order = corder; 
        break;
      }      
    }
    */

    while (this.comp_orders.length > 0) {
      if (this.comp_orders[0].count > 0) {
        next_comp_order = this.comp_orders[0];
        break;
      }
      let item = this.comp_orders.shift();
      logging.info('shifted off', JSON.stringify(item));
    }

    ////////////////////////////////////////////////////////////////////////
    // Execute the choosen next comp order or clear out all completed orders.
    ////////////////////////////////////////////////////////////////////////
    let clear = false;

    if (next_comp_order) {
      if (next_comp_order.action === 'combine' && this.comp_order_execute(labs, term_obj, next_comp_order, mover) === true) {
        // This can happen IF we do not have ANY of a needed product. It keeps the 
        // whole process from deadlocking by just clearing it out.
        logging.info('comp_order_execute forced clear');
        clear = true;
      }
    } else {
      clear = true;
    }

    if (clear) {
      this.clear_labs_out(labs, mover, term_obj);
      logging.info('Clearing out component orders since there is no valid next order.');
      while (this.comp_orders.length > 0) {
        let e = this.comp_orders.shift();
        //logging.info('bye entry', JSON.stringify(e)); 
      }
    }

    if (this.comp_orders.length === 0) {
      // TODO: Make this configurable. Either choose the best profit wise
      //       or choose a specific product to create or create specific
      //       amounts of specific products.
      let best_trade = _.filter(gm.trades, trade => trade.product === 'XGH2O')[0]
      //let best_trade = gm.trades[0];

      let profit_delta = best_trade.demand_price - best_trade.factory_price

      // TODO: Consider the fact that the supply_price may be lower than the demand_price!

      this.m.best_trade = best_trade;
      this.m.profit_delta = profit_delta;

      //console.log(`profit_delta=${profit_delta} factory_price=${best_trade.factory_price}`);

      /////////////////////////////////////////////////////////////////////////
      // If the price is right then build the `comp_orders` array.           //
      /////////////////////////////////////////////////////////////////////////
      //if (profit_delta < -10) {
      //  logging.info('The best trade\'s factory price is larger than demand price.');
      //  return;
      //}

      logging.info(`The factory price is ${best_trade.factory_price}.`);
      if (best_trade.factory_price > 100) {
        logging.info('The factory price exceeds the set threshold.');
      }

      // Do any selling to generate needed credits. At this point, we can sell
      // anything in the terminal. 
      //this.maintain_credits(term_obj, task, true);
      this.build_new_comp_orders(term_obj, labs, best_trade);
    }
  }

  build_new_comp_orders(term_obj, labs, best_trade) {
    const count = 50;

    logging.info('Linearizing plan.');
    const trade_parts = this.term.make_plan_linear(best_trade.plan);
    const comp_orders = this.comp_orders;

    const to_buy = {};  
    const to_combine = {};

    logging.info('trade_parts.length', trade_parts.length);

    for (let e of trade_parts) {
      if (e[1] === undefined && e[2] === undefined) {
        // This is required to be bought.
        //logging.info(`trade_part *must* buy ${e[3]}`);
        //comp_orders.push({
        //  action: 'buy',
        //  what: e[3],
        //  count: count,
        //});
        to_buy[e[3]] = to_buy[e[3]] || 0;
        to_buy[e[3]] += count;
      } else {
        //logging.info(`trade_part *must* combine ${e[1]} + ${e[2]} = ${e[3]}`);
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
      //logging.debug(`to_buy ${k}=${to_buy[k]}`);

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
      //logging.debug(`to_combine ${k}=${to_combine[k].count}`);
      comp_orders.push({
        action: 'combine',
        inputs: to_combine[k].what,
        output: k,
        count: to_combine[k].count //- term_obj.store.getUsedCapacity(k),
      });
    }

    for (let item of comp_orders) {
      logging.info(JSON.stringify(item));
    }
  }

  move_product_out_of_lab (term_obj, mover, name, lab) {
    const lab_what = Object.keys(lab.store)[0];
    if (lab_what) {
      mover.stmh_set(name, ss => {
        mover.stmh_dump_store_to_object(ss, this.room.get_storage());
        mover.stmh_load_resource_from_store(ss, lab, lab_what);
        mover.stmh_dump_store_to_object(ss, term_obj);
        return true;
      });
    }    
  }

  move_product_into_lab (term_obj, mover, name, lab, what) {
    if (term_obj.store.getUsedCapacity(what) > 0) {
      mover.stmh_set(name, ss => {
        mover.stmh_dump_store_to_object(ss, this.room.get_storage());
        mover.stmh_load_resource_from_store(ss, term_obj, what);
        mover.stmh_dump_store_to_object(ss, lab);
        return true;
      });
    }
  }
  
  tick_boosting (task, creeps, labs, movers) { 
    const term_obj = this.room.get_terminal();

    if (movers.length === 0) {
      return;
    }

    const mover = movers[0];   
 
    // TODO: Make this configurable.
    const lab_setup = ['XGH2O'];


    for (let lndx = 0; lndx < lab_setup.length; ++lndx) {
      logging.info(`inspecting lab setup ${lndx}`);
      const lab_has = _.filter(Object.keys(labs[lndx].store), n => n !== game.RESOURCE_ENERGY)[0];
      const lab_need = lab_setup[lndx];
      const lab_free = labs[lndx].store.getFreeCapacity(lab_need);
      const term_amount = term_obj.store.getUsedCapacity(lab_need);

      logging.info(lab_has, lab_free, lab_need, term_amount);

      if (lab_has && lab_has !== lab_need) {
        // Clear out the lab's contents.
        logging.info(`moving product ${lab_has} out of lab ${lndx}`);
        this.move_product_out_of_lab(
          term_obj, mover, `boosting_move_out_${lndx}`, labs[lndx]
        );
        continue;
      }

      const can_move = Math.min(lab_free, term_amount);

      if (can_move > 0) {
        // Try to add more.
        logging.info(`moving ${lab_need} into lab ${lndx}`);
        this.move_product_into_lab(
          term_obj, mover, `boosting_move_into_${lndx}`, labs[lndx], lab_need
        );
        continue;
      }

      if (labs[lndx].store.getFreeCapacity(game.RESOURCE_ENERGY) > 0) {
        this.move_product_into_lab(
          this.room.get_storage(), mover, `boosting_move_energy_into_${lndx}`, 
          labs[lndx], game.RESOURCE_ENERGY
        );
        continue;
      }
    }
  }

  tick (task, creeps, labs, extractors) {
    if (labs.length < 3 || !this.has_terminal_structure) {
      return;
    }

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

      if (!has_extractor) {
        return;
      }

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
      this.sm.reg_build(
        'labrat',
        'labrat_mover',
        labrat_mover_bf,
        4,
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

   if (this.boosting) {
      this.tick_boosting(task, creeps, labs, movers);  
    } else {
      // (2/4) look at the trade data and see what we can try to build
      // (3/4) look at what we can sell and sell it
      this.tick_trade(task, creeps, labs, movers);
    }

    // (4/4) let creeps ticks
    for (let creep of creeps) {
      logging.debug(`ticking creep ${creep.get_name()}`);
      let ctask = task.spawn_isolated(10, `labrat:${creep.get_name()}`, ctask => {
        if (creep instanceof CreepLabRat) {
          creep.tick(this);
        } else {
          creep.tick();
        }
      });

      task.transfer(ctask, creep.creep.memory.cpu || 0.6, 2);
    }
    ///////////////////////////    
  }
}

module.exports.CreepLabRat = CreepLabRat;
module.exports.LabManager = LabManager;
