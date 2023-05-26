import { vec2, vec3 } from 'gl-matrix/esm/index.js';


// --- Transformations

export function opShift(p, d) {
    return vec3.sub(vec3.create(), p, d);
}

export function opRotateY(p, phi) {
    const cosPhi = Math.cos(-phi);
    const sinPhi = Math.sin(-phi);
    return vec3.fromValues(
        cosPhi * p[0] + sinPhi * p[2],
        p[1],
        -sinPhi * p[0] + cosPhi * p[2]
    );
}

export function opRotateZ(p, phi) {
    const cosPhi = Math.cos(-phi);
    const sinPhi = Math.sin(-phi);
    return vec3.fromValues(
        cosPhi * p[0] + sinPhi * p[1],
        -sinPhi * p[0] + cosPhi * p[1],
        p[2]
    );
}

export function opElongateZ(p, h) {
    const qz = Math.max(Math.abs(p[2]) - h, 0.0);
    return vec3.fromValues(p[0], p[1], qz);
}

export function opRepeatFinite(p, s, lim_a, lim_b) {
    let t = vec3.create();
    vec3.div(t, p, s);
    vec3.round(t, t);
    vec3.max(t, t, lim_a);
    vec3.min(t, t, lim_b);
    vec3.mul(t, t, s);
    vec3.sub(t, p, t);
    return t; // = p - s * clamp(round(p/s), lim_a, lim_b)
}


// --- SDFs for different primitives

export function sdSphere(p, r) {
    return vec3.len(p) - r;
}

export function sdTorus(p, c, r) {
    let q = vec2.fromValues(p[1], vec2.len(vec2.fromValues(p[0], p[2]))); // q = vec2(p.y, length(p.xz))
    return vec2.len(vec2.sub(q, q, c)) - r; // = length(q - c) - r
}

export function sdYPlane(p, y) {
    return Math.abs(p[1] - y);
}

export function sdBox(p, s) {
    let q = vec3.fromValues(
        Math.abs(p[0]) - s[0],
        Math.abs(p[1]) - s[1],
        Math.abs(p[2]) - s[2]
    ); // q = abs(p) - s
    return vec3.len(vec3.max(vec3.create(), q, vec3.fromValues(0.0, 0.0, 0.0))) + Math.min(Math.max(q[0], q[1], q[2]), 0.0); // = length(max(q, 0)) + min(max(q.x, q.y, q.z), 0);
}

export function sdCylinder(p, r, h) {
    const len_xz      = Math.sqrt(p[0]*p[0] + p[2]*p[2]);
    const d_xz        = len_xz  - r;
    const d_y         = Math.abs(p[1]) - h;
    const d_xz_clamp  = Math.max(d_xz, 0.0);
    const d_y_clamp   = Math.max(d_y, 0.0);
    const len_d_clamp = Math.sqrt(d_xz_clamp*d_xz_clamp + d_y_clamp * d_y_clamp);
    return Math.min(Math.max(d_xz, d_y), 0.0) + len_d_clamp;
}

export function sdCylinderRounded(p, r, h, d) {
    return sdCylinder(p, r - d, h - d) - d;
}
