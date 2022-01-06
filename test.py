import screepsapi
import json
import os.path
import argparse
import curses
import time
import logging
import threading
import queue

class MySocket(screepsapi.Socket):
  def __init__(self, user, pw, eque):
    super().__init__(user=user, password=pw, secure=True)
    self.eque = eque

  def set_subscriptions(self):
    self.subscribe_user('console')
    self.subscribe('room:shard3/E53S13')

  def process_log(self, ws, msg, shard):
    self.eque.put({ 'topic': 'log', 'msg': msg, 'shard': shard })

  def process_log_seperator(self, ws, shard):
    self.eque.put({ 'topic': 'log-seperator', 'shard': shard })

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
    self.cpanel = 'help'
    self.panels = ['help', 'log', 'room'] 
    self.cpanels_ndx = 0
    self.user = user
    self.pw = pw
    self.log = []
    self.objs_by_room = {}
    self.rooms_ndx = 0
    
  def cleanup(self):
    curses.nocbreak()
    self.win.keypad(False)
    curses.echo()

  def input_entry(self, event_que):
    while True:
      key = self.win.getkey()
      event_que.put({ 'topic': 'key', 'key': key })

  def main(self):
    event_que = queue.Queue()

    ws = MySocket(self.user, self.pw, event_que)
    wsth = threading.Thread(target=ws.start)
    wsth.start()

    ith = threading.Thread(target=self.input_entry, args=(event_que,))
    ith.start()

    lkey = None
    while True:
      if self.cpanel == 'help':
        self.show_panel_help(lkey)
      elif self.cpanel == 'log':
        self.show_panel_log(lkey)
      elif self.cpanel == 'room':
        self.show_panel_room(lkey)
      self.win.refresh()

      lkey = None

      e = event_que.get()

      if e['topic'] != 'key':
          if e['topic'] == 'log':
            self.log.append(e['msg'])
          elif e['topic'] == 'log-seperator':
            self.log.append('')
          elif e['topic'] == 'obj':
            xid = e['shard'] + ':' + e['room']
            self.objs_by_room[xid] = self.objs_by_room.get(xid, {})
            self.objs_by_room[xid][e['id']] = e['obj']
          continue

      logging.info('%s' % e)
      key = e['key']

      logging.info('key: ' + key)

      if key == 'q':
        return
      elif key == 'a':
        self.cpanels_ndx = (self.cpanels_ndx - 1) % len(self.panels)
        self.cpanel = self.panels[self.cpanels_ndx]
        logging.info('cpanel changes to %s' % self.cpanel)
      elif key == 'd':
        self.cpanels_ndx = (self.cpanels_ndx + 1) % len(self.panels)
        self.cpanel = self.panels[self.cpanels_ndx]
        logging.info('cpanel changes to %s' % self.cpanel)

      lkey = key

  def show_panel_bar(self):
    items = [
      'HELP',
      'LOG',
      'ROOM',
    ]

    pstr = []
    for i in items:
      if self.cpanel == i.lower():
        pstr.append('[%s]' % i)
      else:
        pstr.append('%s' % i)
    pstr = ' '.join(pstr)

    self.win.addstr(0, 0, pstr)

  def show_panel_help(self, key):
    self.win.clear()
    self.show_panel_bar()
    self.win.addnstr(2, 0, 'Welcome to the Help panel.', 40)

  def show_panel_log(self, key):
    #self.win.clear()
    self.win.noutrefresh()
    self.show_panel_bar()

    h, w = self.win.getmaxyx()
    
    log_sect = self.log[-(h-1):][::-1]

    for x in range(0, len(log_sect)):
        msg = log_sect[x][0:w]
        msg = msg + (' ' * (w - len(msg) - 1))
        self.win.addnstr(1 + x, 0, msg, w)
        self.win.noutrefresh()

  def show_panel_room(self, key):
    self.win.clear()
    self.show_panel_bar()
    h, w = self.win.getmaxyx()
    # self.objs_by_room['<shard>:<room>']['<objid>'] = obj
    rooms = list(self.objs_by_room.keys())

    if len(rooms) == 0:
        return

    rooms_str = []

    for x in range(0, len(rooms)):
        if x == self.rooms_ndx:
            rooms_str.append('[%s]' % rooms[x])
        else:
            rooms_str.append(rooms[x])
    self.win.addnstr(1, 0, ' '.join(rooms_str), w)

    croom = self.objs_by_room[rooms[self.rooms_ndx]]

    for oid in croom:
        obj = croom[oid]
        x = obj['x']
        y = obj['y']
        logging.info('obj %s' % obj)
        if x > w or x < 0 or y > h - 2 or y < 0: continue
        logging.info('adding object at y=%s x=%s' % (obj['y'], obj['x']))
        self.win.addch(obj['y'], obj['x'], 'X')

def main(win, args):
  args = args[0]

  logging.info(args)
  logging.info('a')
  logging.info('b')
  
  try:
   
    logging.info('c')

    p = Program(
      win = win,
      user = args.user,
      pw = args.pw
    )

    p.main()
  except Exception as e:
    logging.warning('[EXCEPTION]')
    logging.warning(str(e))

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
