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


class Panel:
    def __init__(self, prog):
        pass

    def on_show(self, win):
        pass

    def update (self, win, lkey):
        pass

    def get_menu_title(self):
        raise Exception('The panel implementation forgot to implement this.')

class HelpPanel(Panel):
    def update(self, win, lkey):
        win.erase()
        win.addstr(0, 0, 'Welcome to the help panel!')

    def get_menu_title(self):
        return 'Help'

class RoomPanel(Panel):
    def __init__(self, prog, room_name):
        super().__init__(prog)

class RoomTechPanel(Panel):
    def __init__(self, prog, room_name):
        super().__init__(prog)

        prog.reg_hook_room_change(self.room_change_handler)
        prog.reg_hook_room_updates(self.room_update_handler)

        self.room_name = room_name
        self.data = {}
        self.ox = 0

    def room_change_handler(self, new_room_name):
        pass

    def room_update_handler(self, oid, obj):
        if oid not in self.data:
            self.data[oid] = {}

        for k in obj:
            self.data[oid][k] = obj[k]

    def update(self, win, lkey):
        if lkey == 'KEY_RIGHT':
            self.ox += 1
        elif lkey == 'KEY_LEFT':
            self.ox -= 1
            if self.ox < 0:
                self.ox = 0

        h, w = win.getmaxyx()
        win.erase()
        win.addstr(0, 0, 'Name: %s' % (self.room_name))

        oids = list(self.data.keys())

        y = 0
        for oid in oids:
            line = '%s: %s' % (oid, str(self.data[oid]))
            win.addnstr(1 + y, 0, line[self.ox:], w)
            y += 1

    def get_menu_title(self):
        return 'Room'

class OverviewPanel(Panel):
    def __init__(self, prog):
        super().__init__(prog)
        self.ovdata = prog.api.overview()

    def get_menu_title(self):
        return 'Overview'

    def update(self, win, lkey):
        win.erase()
        shard_data = self.ovdata['shards']
        for shard_name in shard_data:
            logging.info('d=%s' % shard_data[shard_name]);
            rooms = shard_data[shard_name].get('rooms', [])
            stats = shard_data[shard_name].get('stats', {})
            for room_name in rooms:
                logging.info('shard=%s room=%s' % (shard_name, room_name))
            for room_name in stats:
                room_stats = stats[room_name]
                logging.info('shard=%s room=%s stats=%s' % (
                    shard_name, room_name, room_stats
                ))

class LogPanel(Panel):
    def __init__(self, prog):
        super().__init__(prog)
        prog.reg_hook_whole_log(self.whole_log_handler)
        self.wlogs = []
        self.wndx = 0
        self.ondx = None
        self.lndx = 0
        logging.info('recreated log panel')

    def get_menu_title(self):
        return 'Log'

    def whole_log_handler(self, wlog):
        self.wlogs.append(wlog)

    def update(self, win, lkey):
        win.erase()
        h, w = win.getmaxyx()
   
        if lkey == 'w':
            self.lndx = 0
            if self.ondx is None:
                self.ondx = len(self.wlogs) - 1
            self.wndx += 1
        elif lkey == 's':
            self.lndx = 0
            if self.ondx is None:
                self.ondx = len(self.wlogs) - 1
            self.wndx -= 1
            if self.wndx < 0: 
                self.wndx = 0
            if self.wndx == 0:
                self.ondx = None
        elif lkey == 'KEY_DOWN':
            self.lndx += 1
        elif lkey == 'KEY_UP':
            self.lndx -= 1

        logging.info('self.wndx=%s' % self.wndx)

        if self.wndx == 0:
            cndx = len(self.wlogs) - 1
        else :
            cndx = self.ondx - self.wndx

        win.addnstr(0, 0, 'Showing tick log %s/%s [%s]. At line %s.' % (
            cndx, len(self.wlogs) - 1, self.wndx, self.lndx
        ), w)

        yoff = 1
        sh = h - yoff

        if cndx < 0 or cndx >= len(self.wlogs):
            win.addnstr(1, 0, "[This log does not exist.]", w)
            return

        logs = self.wlogs[cndx]

        for y in range(0, sh):
            try:
                line = logs[len(logs) - sh + y + self.lndx]
            except IndexError:
                line = ''
            win.addnstr(y + yoff, 0, line, w)
            win.noutrefresh()

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

class Program:
    def __init__(self, win, user, pw):
        self.win = win
        #curses.noecho()
        #curses.cbreak()
        #self.stdscr.keypad(True)
        #self.stdscr.start_color()

        self.cshard_ndx = 0
        self.cpanels_ndx = 0

        self.user = user
        self.pw = pw
        self.hooks_whole_log = []
        self.hooks_room_update = []
        self.hooks_room_change = []
        self.panels = {}
        self.cur_room_subscription = None

    def ensure_panels_for_shard(self, shard):
        if shard in self.panels:
            return

        self.panels[shard] = [
            LogPanel(self),
            HelpPanel(self),
        ]

    def cleanup(self):
        curses.nocbreak()
        self.win.keypad(False)
        curses.echo()

    def input_entry(self, event_que):
        while True:
            key = self.win.getkey()
            event_que.put({ 'topic': 'key', 'key': key })
    
    def reg_hook_whole_log(self, handler):
        self.hooks_whole_log.append(handler)

    def reg_hook_room_updates(self, handler):
        self.hooks_room_update.append(handler)

    def reg_hook_room_change(self, handler):
        self.hooks_room_change.append(handler)

    def change_room(self, shard, room_name):
        #self.subscribe('room:shard3/E56S31')
        if self.cur_room_subscription is not None:
            prev_shard = self.cur_room_subscription[0]
            prev_room_name = self.cur_room_subscription[1]
            self.ws.unsubscribe('room:%s/%s' % (prev_shard, prev_room_name))
        self.ws.subscribe('room:%s/%s' % (shard, room_name))
        self.cur_room_subscription = (shard, room_name)

    def main(self):
        event_que = queue.Queue()

        self.ws = MySocket(self.user, self.pw, event_que)
        wsth = threading.Thread(target=self.ws.start)
        wsth.daemon = True
        wsth.start()

        self.api = screepsapi.API(u=self.user, p=self.pw, secure=True)

        self.panels['#main'] = []
        self.panels['#main'].append(OverviewPanel(self))

        ith = threading.Thread(target=self.input_entry, args=(event_que,))
        ith.daemon = True
        ith.start()

        lkey = None

        while True:
            self.show_shard_bar()
            self.show_menu_bar()
            h, w = self.win.getmaxyx()
            swin = self.win.derwin(2, 0)
            if len(list(self.panels.keys())) > 0:
                # During bootup. We have no panels because we don't know
                # about any shards. We have to wait until the server sends
                # something about a shard.
                cshard = list(self.panels.keys())[self.cshard_ndx]
                self.cpanels_ndx = self.cpanels_ndx % len(self.panels[cshard])
                cpanel = self.panels[cshard][self.cpanels_ndx]
                cpanel.update(swin, lkey)
            else:
                # Just let the user know we are waiting to load up the
                # shards and associated panels for each shard.
                self.win.addnstr(0, 0, '[waiting for server event]', w)
            self.win.refresh()

            panels = self.get_cshard_panels()

            lkey = None
            e = event_que.get()
            # hooks_room_update
            if e['topic'] != 'key':
                self.ensure_panels_for_shard(e['shard'])

                if e['topic'] == 'log-whole':
                    for handler in self.hooks_whole_log:
                        handler(e['msgs'])
                elif e['topic'] == 'obj':
                    for handler in self.hooks_room_update:
                        handler(e['id'], e['obj'])
            else:
                key = e['key']

                if key == 'q':
                    self.cleanup()
                    return
                elif key == 'a' and panels is not None:
                    self.cpanels_ndx = (self.cpanels_ndx - 1) % len(panels)
                    panels[self.cpanels_ndx].on_show(swin)
                elif key == 'd' and panels is not None:
                    self.cpanels_ndx = (self.cpanels_ndx + 1) % len(panels)
                    panels[self.cpanels_ndx].on_show(swin)
                elif key == 'z':
                    self.increment_cshard_ndx(-1)
                elif key == 'c':
                    self.increment_cshard_ndx(1)

                lkey = key

    def show_shard_bar(self):
        pstr = []

        shards = list(self.panels.keys())

        for x in range(0, len(shards)):
            if self.cshard_ndx == x:
                pstr.append('[%s]' % shards[x])
            else:
                pstr.append(shards[x])

        self.win.addstr(0, 0, ' '.join(pstr))


    def increment_cshard_ndx(self, amount):
        shards = list(self.panels.keys())
        self.cshard_ndx = (self.cshard_ndx + amount) % len(shards)

    def get_cshard_panels(self):
        shards = list(self.panels.keys())
        if len(shards) == 0:
            return None
        return self.panels[shards[self.cshard_ndx]]

    def show_menu_bar(self):
        panels = self.get_cshard_panels()
        if panels is None:
            return

        pstr = []

        for x in range(0, len(panels)):
            panel = panels[x]
            title = panel.get_menu_title()
            if x == self.cpanels_ndx:
                pstr.append('[%s]' % title)
            else:
                pstr.append(title)

        self.win.addstr(1, 0, ' '.join(pstr))

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
