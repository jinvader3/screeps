/*

  I need a really decent decimal/fixed... precision class/object
  to use in place of the fast but inaccurate floating point model
  that javascript is using. For now, it will work for testing but
  it really is particularly off in accuracy.
*/
const game = require('./game');
_ = game._;


// Its the REACTIONS table but in reverse.
const g_reactions_reverse = {};
const g_reactions_all = {};

for (let i0 in game.REACTIONS) {
  let t = game.REACTIONS[i0];
  for (let i1 in t) {
    let p = t[i1];
    g_reactions_reverse[p] = [i0, i1];
    g_reactions_all[p] = true;  
    g_reactions_all[i0] = true;
    g_reactions_all[i1] = true;
  }
}

let g_orders = null;
let g_orders_age = game.time();

class Terminal {
  constructor (room) {
    this.room = room;
    this.term = room.get_terminal();
  }

  has_terminal_structure() {
    return this.term !== undefined && this.term !== null;
  }

  make_plan_linear (plan, out, depth) {
    out = out || [];
    depth = depth || 0;
    out.push([depth, plan.a, plan.b, plan.c]);
  
    if (plan.afp)
      this.make_plan_linear(plan.afp, out, depth + 1);
    if (plan.bfp)
      this.make_plan_linear(plan.bfp, out, depth + 1);

    if (depth === 0) {
      // Sort the linear list so that the most basic components are first in line.
      out.sort((a, b) => a[0] > b[0] ? -1 : 1);
    }

    return out;
  }

  get_market_orders () {
    if (g_orders === null || (game.time() - g_orders_age > 20)) {
      g_orders = game.market().getAllOrders();
    }
    return g_orders;
  }

  force_orders_update () {
    g_orders = null;
  }

  /// This will calculate all the possible trades using the known
  /// products. It will calculate not only a simple direct buy and
  /// sell but also the production of each sub-reagent. And, from
  /// this yield the best possible price. It _does not_ calculate
  /// the cost of production in terms of energy, creeps, and time
  /// because that would make this function too complicated. One can
  /// calculate that from the output of this function if desired.
  ///
  /// Here, we look at market prices only and use known factory/lab
  /// relationships to knowingly combine cheaper lesser reagents to
  /// form more expensive (hopefully) reagent/outputs.
  find_trades (batch_size, energy_batch_size) {
    let st = game.time();
    let trades = [];
    let summary = {};

    let eres = this.find_product_supply_and_demand_of_batch(
      game.RESOURCE_ENERGY, energy_batch_size
    );

    if (eres === null) {
      // We need a good energy price reference. It might help to lower
      // the batch size on it but that will result in a less accurate
      // answer on the actual market price point.
      return [];
    }

    for (let k in g_reactions_all) {
      let res = this.find_product_supply_and_demand_of_batch(k, batch_size);

      if (res === null) 
        continue

      res.product = k;

      // These are the most simple of trades. No factory/lab needed.
      // Just help move product.
      let demand_p = 
        res.demand_price - res.demand_eprice * eres.supply_price;
      let supply_p = 
        res.supply_price + res.supply_eprice * eres.supply_price;

      // Go ahead and store that "real" energy included price.
      res.demand_p = demand_p;
      res.supply_p = supply_p;

      if (res.supply_orders.length > 0 && res.demand_orders.length > 0) {
        if (demand_p < supply_p) {
          console.log(k, demand_p, supply_p);
          trades.push(res);
        }
        console.log('summary', k, res);
        summary[k] = res;
      } else {
        console.log('summary attempt', k);
      }
    }

    function engine(k) {
      let obj;
      if (g_reactions_reverse[k] === undefined) {
        obj = {
          c: k,
        };
        obj.bt = summary[k] === undefined ? 9999 : summary[k].supply_p;
      } else {
        let i0 = g_reactions_reverse[k][0];
        let i1 = g_reactions_reverse[k][1];
        let afp = engine(i0);
        let bfp = engine(i1);
        obj = {
            c: k,
            a: i0,
            b: i1,
            // market
            am: summary[i0] === undefined ? 9999 : summary[i0].supply_p,
            bm: summary[i1] === undefined ? 9999 : summary[i1].supply_p,
            afp: afp,
            bfp: bfp,
            // factor/lab
            af: afp.bt,
            bf: bfp.bt,
        };
        obj.ab = obj.af < obj.am ? obj.af : obj.am;
        obj.bb = obj.bf < obj.bm ? obj.bf : obj.bm;
        obj.bt = obj.ab + obj.bb;
      }

      return obj;
    }

    let w = [];
     
    // What can we produce using our labs?
    for (let k in g_reactions_reverse) {
      let plan = engine(k);
      // the best buy order batch price
      let m_demand_p = summary[k] === undefined ? 0 : summary[k].demand_p;
      // the best sell order batch price
      let m_supply_p = summary[k] === undefined ? 9999 : summary[k].supply_p;
      let best_supply_p = plan.bt > m_supply_p ? m_supply_p : plan.bt;
      let i = {
        'product': k,
        // how much to produce it
        'factory_price': plan.bt,
        // how much the market will pay for it
        'demand_price': m_demand_p,
        // how much the market will sell it for
        'supply_price': m_supply_p,
        // the best price we can acquire it for (produce or market)
        'best_supply_price': best_supply_p,
        // the best profit possible
        'delta': m_demand_p - best_supply_p,
        // the plan on how to produce it the cheapest way
        'plan': plan,
      };
      w.push(i);
    }

    w.sort((a, b) => a.delta > b.delta ? -1 : 1);

    for (let x = 0; x < w.length; ++x) {
      let o = w[x];
      console.log(x, o); 
    }

    let et = game.time();
    let tt = et - st;
    console.log('test total cpu', tt);

    return w;
  }

  find_best_seller (product) {
    let orders = this.get_market_orders();

    orders = _.filter(
      orders, 
      order => order.type === game.ORDER_SELL && order.resourceType === product && order.amount > 0
    );

    orders.sort((a, b) => a.price > b.price ? 1 : -1);

    return orders[0];
  }

  find_best_buyer (product) {
    let orders = this.get_market_orders();

    orders = _.filter(
      orders, 
      order => order.type === game.ORDER_BUY && order.resourceType === product && order.amount > 0
    );

    orders.sort((a, b) => a.price > b.price ? -1 : 1);

    return orders[0];
  }

  find_product_supply_and_demand_of_batch (product, batch_size) {
    let st = game.time();
    let orders = this.get_market_orders();

    let borders = [];
    let sorders = [];

    _.each(orders, order => {
      if (order.resourceType !== product) {
        return;
      }
      if (order.type === game.ORDER_BUY) {
        borders.push(order);
      } else {
        sorders.push(order);
      }
    }); 

    // Highest first.
    borders.sort((a, b) => a.price > b.price ? -1 : 1);
    // Lowest first.
    sorders.sort((a, b) => a.price > b.price ? 1 : -1);

    let batch_buy = []
    let batch_sell = [];

    let amt, tcost, ecost;

    ecost = 0;
    tcost = 0;
    amt = 0;
    _.some(borders, order => {
      batch_buy.push(order);

      if (amt + order.amount >= batch_size) {
        ecost += game.market().calcTransactionCost(
          batch_size - amt,
          order.roomName,
          this.room.get_name()
        );
        tcost += order.price * (batch_size - amt);
        amt += order.amount;
        return true;
      }

      amt += order.amount;
      tcost += order.price * order.amount;
      ecost += game.market().calcTransactionCost(
        order.amount,
        order.roomName,
        this.room.get_name()
      );

      return false;
    });

    if (amt < batch_size) {
      return null;
    }

    let buy_eprice = ecost;
    let buy_eff_price = tcost / batch_size;

    tcost = 0;
    amt = 0;
    _.some(sorders, order => {
      batch_sell.push(order);

      if (amt + order.amount >= batch_size) {
        ecost += game.market().calcTransactionCost(
          batch_size - amt,
          order.roomName,
          this.room.get_name()
        );
        tcost += order.price * (batch_size - amt);
        amt += order.amount;
        return true;
      }

      amt += order.amount;
      tcost += order.price * order.amount;
      ecost += game.market().calcTransactionCost(
        order.amount,
        order.roomName,
        this.room.get_name()
      );

      return false;
    });

    if (amt < batch_size) {
      return null;
    }

    let sell_eprice = ecost;
    let sell_eff_price = tcost / batch_size;

    let et = game.time();
    let tt = et - st;

    return {
      // These are the effective prices for buying and selling of
      // the product.
      'cpu_cost': tt,
      'supply_eprice': sell_eprice,
      'demand_eprice': buy_eprice,
      'supply_price': sell_eff_price,
      'demand_price': buy_eff_price,
      // These are the orders to be used to get the effective price.
      'supply_orders': batch_sell,
      'demand_orders': batch_buy,
    };
  }
}

module.exports.Terminal = Terminal;
