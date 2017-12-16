/**
 * @fileoverview Particle Object
 * @Junze Liu junzel2@illinois.edu
 */

class Particle {
	constructor(p, v, a, c, r, t) {
		this.p = p; // position
		this.v = v; // velocity
		this.a = a; // acceleration
		this.c = c; // color
		this.r = r; // radius
		this.t = t; // time this particle gets generated
	}
}