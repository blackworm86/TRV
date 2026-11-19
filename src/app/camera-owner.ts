// One owner of the camera (design/gdd/camera-director.md §A.9, §B.9): during a scene only the
// director moves the camera. The map view, a zoom on a car and the replay ask for it instead of
// moving it on their own: while a scene is filmed they wait, and get it when the director lets go.
// The player's own hand is the exception: touching or zooming the table gives the view back at
// once, and the director takes it again only at its next scene.
// Pure (unit-tested in tests/unit/app/scenes.test.ts).

/** Who may move the camera. */
export type CameraUser = 'director' | 'player' | 'map' | 'zoom' | 'replay';

/** Who holds the camera, and who waits for it. */
export class CameraOwner {
  /** Who moves the camera now (null: no one, the view stays as it is). */
  owner: CameraUser | null = null;
  /** Requests waiting for the director to let go, oldest first (each user once). */
  private readonly waiting: CameraUser[] = [];

  /**
   * `who` asks for the camera; true when it has it now. The director takes it at the start of each
   * scene and the player whenever they touch the table; the others get it unless the director is
   * filming, and then they wait for it.
   */
  take(who: CameraUser): boolean {
    if (this.owner === who) return true;
    if (who === 'director' || who === 'player') { this.owner = who; return true; }
    if (this.owner === 'director') {
      if (!this.waiting.includes(who)) this.waiting.push(who);
      return false;
    }
    this.owner = who;
    return true;
  }

  /** `who` lets the camera go (or stops waiting for it); the oldest request waiting gets it. Returns the new owner. */
  release(who: CameraUser): CameraUser | null {
    const i = this.waiting.indexOf(who);
    if (i >= 0) this.waiting.splice(i, 1);
    if (this.owner !== who) return this.owner;
    this.owner = this.waiting.shift() ?? null;
    return this.owner;
  }

  /** Whether `who` may move the camera now. */
  holds(who: CameraUser): boolean { return this.owner === who; }
  /** The requests waiting for the camera. */
  pending(): readonly CameraUser[] { return this.waiting; }
}
