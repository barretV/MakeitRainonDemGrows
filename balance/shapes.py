"""Print the silhouette of each island so the shapes can be checked."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from game_constants import WORLDS, GLOBE_WORLD, island_shore, TILE

WIDTH = 76


def show(world: int) -> None:
    cols, rows, mc, mr, hp, pay = WORLDS[world]
    if world == GLOBE_WORLD:
        print(f"world {world}: the globe")
        return
    w = cols * TILE
    h = rows * TILE
    radius = min(w, h) * 0.42
    cx = -TILE / 2 + w * 0.5
    cz = -TILE / 2 + h * 0.5
    height = max(8, int(WIDTH * (h / w) * 0.5))
    print(f"world {world} ({WORLDS[world][0]}x{WORLDS[world][1]} tiles)")
    for row in range(height):
        line = []
        for col in range(WIDTH):
            x = ((col + 0.5) / WIDTH) * w - TILE / 2
            z = ((row + 0.5) / height) * h - TILE / 2
            line.append("#" if island_shore(world, x - cx, z - cz, radius) < 0 else ".")
        print("".join(line))
    print()


for world in range(4):
    show(world)
