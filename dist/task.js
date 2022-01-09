const game = require('./game');
const _ = game._;

class Task {
  constructor (parent, priority, name, f, payer, te) {
    this.parent = parent;
    this.priority = priority;
    this.name = name;
    this.payer = payer;
    this.f = f;
    this.te = te;
  }

  spawn (priority, name, f) {
    let nt = new Task(this, priority, name, f, this.payer, this.te);
    this.te.queue_task(nt);
    return nt;
  }

  spawn_isolated (priority, name, f) {
    let nt = new Task(this, priority, name, f, this, this.te);
    this.te.queue_task(nt);
    return nt;
  }

  get_credit () {
    let fname = this.get_full_name();
    let tasks = game.memory().tasks;
    if (tasks[fname] === undefined) {
      return 0;
    }
    return tasks[fname];
  }

  set_credit (amount) {
    let fname = this.get_full_name();
    tasks[fname] = amount;
  }

  credit (amount, maxcap) {
    let v = this.get_credit();
    if (v + amount > maxcap) {
      this.set_credit(maxcap);
    } else {
      this.set_credit(v + amount);
    }
  }

  get_full_name () {
    let parts = [this.name];
    let cur = this.parent;
    while (cur !== null) {
      parts.unshift(cur.name);
      cur = cur.parent;
    }
    return parts.join('/');
  }

  run () {
    console.log('task:running[' + this.get_full_name() + ']');
    try {
      this.f(this);
      return null;
    } catch (err) {
      console.log('err:' + err);
      return err;
    }
  }
}

class TaskEngine {
  constructor () {
    this.pend_tasks = [];
    this.root_task = new Task(null, 0, 'root', null);
  }

  queue_task (task) {
    this.pend_tasks.push(task);
  }

  spawn (priority, name, f) {
    let nt = this.root_task.spawn(priority, name, f, this);
    this.pend_tasks.push(nt);
    return nt;
  }

  pending_tasks () {
    return this.pend_tasks.length > 0;
  }

  run_tasks () {
    _.each(this.pend_tasks, task => {
      task.run();
    });
  }
}

module.exports.TaskEngine = TaskEngine;
