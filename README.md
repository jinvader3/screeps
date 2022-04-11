## JInvader3/Screeps

This is a personal Screeps bot.

### Commands

The bot is controlled from the console. I know some people use flags but I find those problematic if you want to parameterize them. For example, you drop a flag and you want to set some settings for it. You still need a way to edit some kind of configuration. Also, there could be some really good solutions using external tools. But, I wanted to keep everything as native client as possible. Therefore, I use JavaScript console commands. At a later time, one could extend the console to an external tool and it could just call these commands directly if it needed.

* `Game.ops_list()`
  * Displays a list of current active operations.
* `Game.ops_del(home_room, mod_name, index)`
  * Delete an active operation using its home room, module name, and index from the list.
* `Game.autobuild_on(room_name)`
  * Activates version one (obsolete) autobuild. Does not always build labs correctly!
* `Game.autobuild_off(room_name)`
* `Game.autobuild2(room_name, true_or_false)`
  * Using `true_or_false` it activates or deactivates version two of autobuild.

### Design

#### Tasks

The bot uses a task based approach. It uses tasks for error isolation and CPU usage control. Both errors and run-away CPU usage cause important functions not to execute which causes a problem that might only effect the industrial portion of a single room to crash all rooms which is bad. So, isolating different units of code in tasks helps keep errors from propogating or cascading. Also, sometimes code can be buggy or just simply need to be CPU heavy but if left uncontrolled it can cause rooms to crash out by draining the CPU bucket, thus, the entire A.I. starts to fail. To remedy this, the tasks have CPU/credit accounts and these help catch runaway or heavy tasks before they crash everything.

#### Room Planner

The room is an independent highest level planner. There might be one more level above the room added at a later time. If it is then it will control colonizing new rooms and maybe even expeditions to grab resources out on the highways. Until then, the room controls all functions and the the creeps tick/execute to carry out the orders. The interface between the room and most of the creeps is a decision tree. Other creeps may use a single order simplier form such as : miners.

#### AutoBuild

There are two versions of the component known as auto-build. The version one, obsolete, `autobuild.js` and the version two `autobuild2.js`. Both, automatically create the construction sites to facilitate base building. The difference is that version two has more reliable and better labratory building support. Version one tries to build labs in groups of three but there are cases where it can get stuck and can't build a group of three when it should have. Version two attempts to improve on version one by building all ten labs in a chain so that they can be linked together in an assembly line fashion if desired. Also, version two preplans the entire room so its simple to check and see exactly where things will be built.

Both auto-builds use a honeycomb pattern. This pattern seems to have a good balance between being easy to code and flexible enough for most any room. I hope later on to be able to support some of the other patterns that I see other players using.

#### Decision Tree

The decision tree is just an easier more compact way to write a lot of conditional code. It makes mistakes less likely, allows repeating logic easier, and it is a lot easier to view and digest as it is compact. There are two decision trees. One for grabbing energy and another for putting it somewhere.

#### Spawn Management Task

The spawning code started as a simple no-operation type loop. It just built the first thing to be requested. This made it biased to order of calls for creating a creep which is bad. The spawning code now runs as a task and has its own API for which parts of the code base call when needing to create a creep. The spawn task runs as a low priority so it is one of the very last tasks to run and at this point it reviews all of the creep spawn requests and chooses the highest priority. It also ignores repeated requests for the same creep _until_ that creep is near to dying. This allows creeps to roll out of the spawn as soon as the creep it is replacing dies. It also prevents other creep production from blocking higher priority creep production.

#### Industry

The industry is currently implemented but only supports three labs. It will be trivial to support all fix. I had to stop working on the code base for a little while so I was not able to finish the implemented. It currently does market scans, determines the most profitable product the produce, buys anything it needs, and creates it. Then sells what it has to maintain a certain number of credits.

_I currently have it coded to build things at a small loss in credits!_

#### Decision Tree Versus State Machine Creep Versus General Worker

For some clarification of:
  - `statemachinecreep.js` module
  - `creepgw.js` module
  - `room.js`'s dt_ functions

The `creepgw.js` module just implements a basic go put something here or get something from there autonomy for a creep. It allows a fire and forget approach for which the creep will accomplish some of the most basic tasks until completed _or attempted at least once with a oneshot flag set_.

The decision tree logic is implemented in `room.js` under the `dt_*` family of functions for which `creepgw` (general worker) creep recives two functions and calling either one presents a target. Therefore, the general worker creep does not know or udnerstand decision trees as they are purely a concept and feature of the room planner itself. The general worker only understands targets and actions it should go and perform until exhausted or energy or full of energy.

The `statemachinecreep.js` module builds a creep that can be issues multiple orders for which these are accomplished in the order they were given. This is important because for industry work a complete whole operation might consist of moving a few things to different places and it is a lot easier to issue all these separate instructions and have them executed autonomously than poll each tick, using a general worker, and check if it has finished. However, it is possible I could have used a general worker under the hood! I am not sure the best way.

_The statemachinecreep is relatively new. I am still trying to flush out the exact way it will work._ 

#### What is a room crash?

If you don't know. A room crash isn't just when the code fails with an error or does not execute. It also involves failure of the room to reach its objective. A good example of a room crash that may not be obvious is when all the creeps happen to die because the spawner couldn't replace them fast enough. This is in effect almost the same as if the A.I./script simply stopped running for some amount of time- thus I call it a crash.

One of the challenges of keeping your creeps going is not letting the rooms crash by having any starvation or blocking of needed facilities such as your spawn. Or, having any logic problems where all your energy gets dumped somewhere and there is not enough to run for example your spawn, upgrade your controller before it downgrades, and so forth. I call these events room crashes because the end result is usually an empty room with no creeps.
