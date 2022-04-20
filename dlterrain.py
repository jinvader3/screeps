from screepsapi import API
import argparse
import json

ap = argparse.ArgumentParser()
ap.add_argument('--u', type=str, required=True)
ap.add_argument('--p', type=str, required=True)
ap.add_argument('--room', type=str, required=True)
ap.add_argument('--shard', type=str, required=True)

args = ap.parse_args()

api = API(u=args.u, p=args.p, secure=True)
t = api.room_terrain(args.room, shard=args.shard)
print(json.dumps(t))
