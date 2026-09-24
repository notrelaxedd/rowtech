/** Where the model is heading: the view the scene eases toward. Radians. */
export type Rig = { targetYaw: number; targetPitch: number };

export type Note3D = {
  id: string;
  label: string;
  body: string;
  /** The point on the model the leader line goes to (model units). */
  anchor: [number, number, number];
  /** Which column the note sits in, beside the model. */
  side: "left" | "right";
  /** How the model turns to show this part: [yaw, pitch]. */
  view: [number, number];
  /** The part, outlined while the note is active. */
  outline: Array<[number, number, number]>;
};
