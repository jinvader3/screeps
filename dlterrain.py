from screepsapi import API
import argparse
import json

ap = argparse.ArgumentParser()
ap.add_argument('--user', type=str, required=True)
ap.add_argument('--pass', type=str, required=True)
ap.add_argument('--room', type=str, required=True)
ap.add_argument('--shard', type=str, required=True)

args = ap.parse_args()

api = API(u='b5g6m9@mail.com', p='3x@j469mAZhe49', secure=True)
t = api.room_terrain(args.room, shard=args.shard)
print(json.dumps(t))
