import screepsapi
import json
import os.path
import argparse
import curses
import time
import logging
import threading
import queue
import traceback
import sys
import pprint

class MySocket(screepsapi.Socket):
    def __init__(self, user, pw, eque):
        super().__init__(user=user, password=pw, secure=True)
        self.eque = eque

    def set_subscriptions(self):
        self.subscribe_user('console')

    def process_log(self, ws, msg, shard):
        self.eque.put({ 'topic': 'log', 'msg': msg, 'shard': shard })

    def process_log_seperator(self, ws, shard):
        self.eque.put({ 'topic': 'log-seperator', 'shard': shard })

    def process_whole_log(self, ws, msgs, shard):
        self.eque.put({ 'topic': 'log-whole', 'msgs': msgs, 'shard': shard })

    def process_error(self, ws, msg, shard):
        self.eque.put({ 'topic': 'log', 'msg': msg, 'shard': shard })

    def process_room_object(self, ws, obj_id, obj, room, shard):
        self.eque.put({
          'topic': 'obj', 
          'id': obj_id, 
          'obj': obj, 
          'room': room, 
          'shard': shard
        })

class ShardOverview:
    def __init__(self):
        pass

class RouteRoomObjects:
    pass

class RouteRoomView:
    pass

class RouteMap:
    pass

class RouteConsole:
    def __init__(self, prog, shard):
        self.shard = shard
        prog.subscribe_user('console')
        self.log = []

    def on_event(self, e, prog, win, addlink):
        if e['topic'] != 'log':
            return

        if e['shard'] != self.shard:
            return

        self.log.append(e['msg'])

        win.clear()
        prog.clear_links()

        h, w = win.getmaxyx()

        lines = []

        for x in range(0, h):
            try:
                line = self.log[len(self.log) - h + x]
            except IndexError:
                line = ''
            while len(line) > w:
                nline = line[:w]
                lines.append(nline)
                line = line[w:]
            lines.append(line)
    
        for x in range(0, h):
            try:
                line = lines[len(lines) - h + x]
            except IndexError:
                line = ''
            win.addstr(0 + x, 0, line)

class RouteOverview:
    def __init__(self, prog, shard):
        self.shard = shard
        overview = prog.api.overview()
        totals = overview['totals']
        self.creepsProduced = totals['creepsProduced']
        self.energyCreeps = totals['energyCreeps']
        self.energyControl = totals['energyControl']
        self.energyHarvested = totals['energyHarvested']
        shards = overview['shards']
        self.rooms = shards[self.shard]['rooms']
        logging.info('overview %s' % overview)

        self.cpu = -1

    def on_event(self, e, prog, win, addlink):
        if e['topic'] != 'init': 
            return

        win.clear()
        prog.clear_links()

        logging.info('route-overview event %s' % e)

        win.addstr(0, 0, 'Overview')
        win.addstr(1, 0, 'Global Control Level')
        win.addstr(2, 0, 'Rooms: %s' % self.rooms);
        win.addstr(3, 0, 'CPU: %s' % self.cpu);

        a = 'Control Points'.ljust(20)
        b = 'Energy Harvested'.ljust(20)
        c = 'Energy on Construct'.ljust(20)
        d = 'Energy on Creeps'.ljust(20)

        e = 'Creeps Produced'.ljust(20)
        f = 'Creeps Lost'.ljust(20)
        g = 'Power Processed'.ljust(20)

        av = str(self.energyControl).ljust(20)
        bv = str(self.energyHarvested).ljust(20)
        cv = str(-1).ljust(20)
        dv = str(self.energyCreeps).ljust(20)

        ev = str(self.creepsProduced).ljust(20)
        fv = str(-1).ljust(20)
        gv = str(-1).ljust(20)

        win.addstr(5, 0, a + b + c + d)
        win.addstr(6, 0, av + bv + cv + dv)
        win.addstr(7, 0, e + f + g)
        win.addstr(8, 0, ev + fv + gv)

        addlink(9, 0, '[View Console]', '/console', {
            'shard': self.shard,
        })

        y = 10
        for room in self.rooms:
            win.addstr(y, 0, self.shard + '#' + room)
            addlink(y + 1, 0, '[View Room Objects]', '/roomobjs', {
                'shard': self.shard,
                'room': room,
            })
            addlink(y + 2, 0, '[View Room]', '/roomview', {
                'shard': self.shard,
                'room': room,
            })
            y += 3

class Program:
    def __init__(self, win, user, pw):
        self.win = win
        #curses.noecho()
        #curses.cbreak()
        #self.stdscr.keypad(True)
        #self.stdscr.start_color()
        curses.start_color()

        self.user = user
        self.pw = pw
        self.hooks_whole_log = []
        self.hooks_room_update = []
        self.hooks_room_change = []
        self.panels = {}
        self.cur_room_subscription = None

        self.link_ndx = 0

        self.routes = {
            '/': RouteOverview,
            '/overview': RouteOverview,
            '/roomobjs': RouteRoomObjects,
            '/roomview': RouteRoomView,
            '/map': RouteMap,
            '/console': RouteConsole,
        }

        self.route_object = None
        self.route = '/'
        self.route_args = { 'shard': 'shard3' }
        self.links = []

        curses.init_pair(1, 3, 4)
        curses.init_pair(2, 5, 6)

        self.subs = []

    def navigate(self, route, args):
        self.route = route
        self.route_args = args

    def cleanup(self):
        curses.nocbreak()
        self.win.keypad(False)
        curses.echo()

    def input_entry(self, event_que):
        while True:
            key = self.win.getkey()
            event_que.put({ 'topic': 'key', 'key': key })

    def subscribe(self, watchpoint):
        self.subs.append(('nonuser', watchpoint))
        self.ws.subscribe(watchpoint)

    def subscribe_user(self, watchpoint):
        self.subs.append(('user', watchpoint))
        self.ws.subscribe_user(watchpoint)

    def clear_subscriptions(self):
        for sub in self.subs:
            sub_type = sub[0]
            sub_watchpoint = sub[1]
            if sub_type == 'nonuser':
                self.ws.unsubscribe(sub_watchpoint)
            else:
                self.ws.unsubscribe_user(sub_watchpoint)

    def change_room(self, shard, room_name):
        #self.subscribe('room:shard3/E56S31')
        if self.cur_room_subscription is not None:
            prev_shard = self.cur_room_subscription[0]
            prev_room_name = self.cur_room_subscription[1]
            self.ws.unsubscribe('room:%s/%s' % (prev_shard, prev_room_name))
        self.ws.subscribe('room:%s/%s' % (shard, room_name))
        self.cur_room_subscription = (shard, room_name)

    def clear_links(self):
        self.links = []

    def addlink(self, swin, y, x, text, route, args):
        swin.addstr(y, x, text)
        self.links.append((y, x, text, route, args))

    def follow_selected_link(self):
        if len(self.links) == 0:
            return
        lndx = self.link_ndx % len(self.links)
        logging.info('following selected link %s (%s)' % (lndx, self.link_ndx))
        link_info = self.links[lndx]
        logging.info('link_info = %s' % (link_info,))
        self.route_object = None
        self.route = link_info[3]
        self.route_args = link_info[4]

    def colorize_selected_link(self, swin):
        if len(self.links) == 0:
            return
        lndx = self.link_ndx % len(self.links)
        logging.info('lndx is %s (%s)' % (lndx, self.link_ndx))
        for x in range(0, len(self.links)):
            link_info = self.links[x];
            if x == lndx:
                swin.addstr(link_info[0], link_info[1], link_info[2], curses.color_pair(1))
            else:
                swin.addstr(link_info[0], link_info[1], link_info[2], curses.color_pair(2))

    def main(self):
        event_que = queue.Queue()

        self.ws = MySocket(self.user, self.pw, event_que)
        wsth = threading.Thread(target=self.ws.start)
        wsth.daemon = True
        wsth.start()

        self.api = screepsapi.API(u=self.user, p=self.pw, secure=True)

        ith = threading.Thread(target=self.input_entry, args=(event_que,))
        ith.daemon = True
        ith.start()

        lkey = None

        while True:
            h, w = self.win.getmaxyx()
            swin = self.win.derwin(2, 0)

            addlink = lambda y, x, text, route, args: self.addlink(
                swin, y, x, text, route, args
            )

            if self.route_object is None:
                logging.info('creating route object %s:%s' % (
                    self.route, self.route_args
                ))
                self.clear_subscriptions()
                self.route_object = self.routes[self.route](self, **self.route_args)
                self.route_object.on_event({ 'topic': 'init' }, self, swin, addlink)
                self.colorize_selected_link(swin)
                swin.refresh()

            lkey = None
            e = event_que.get()

            if e['topic'] != 'key':
                self.route_object.on_event(e, self, swin, addlink)
                self.colorize_selected_link(swin)
                swin.refresh()
            else:
                key = e['key']
                logging.info('key pressed %s' % key)
                if key == 'q':
                    self.cleanup()
                    return
                elif key == '\n':
                    self.follow_selected_link()
                    self.link_ndx = 0
                    swin.refresh()
                elif key == 'KEY_UP':
                    self.link_ndx -= 1
                    self.colorize_selected_link(swin)
                    swin.refresh()
                elif key == 'KEY_DOWN':
                    self.link_ndx += 1
                    self.colorize_selected_link(swin)
                    swin.refresh()
                else:
                    self.route_object.on_event(e, self, swin, addlink)
                    self.colorize_selected_link(swin)
                    swin.refresh()

def main(win, args):
    args = args[0]

    try:
        p = Program(
            win = win,
            user = args.user,
            pw = args.pw
        )

        p.main()
    except Exception as e:
        logging.warning('[EXCEPTION]')
        logging.warning(str(e))
        exc_type, exc_value, exc_tb = sys.exc_info()
        for line in traceback.format_list(traceback.extract_tb(exc_tb)):
            logging.warning(line)

    exit()

if __name__ == '__main__':
    logging.basicConfig(
        filename='log.txt', 
        filemode='w', 
        level=logging.INFO
    )

    logging.info('Logging has started.')
    ap = argparse.ArgumentParser()
    ap.add_argument('--user', type=str, required=True)
    ap.add_argument('--pw', type=str, required=True)
    args = ap.parse_args()
    curses.wrapper(main, args=(args,))
