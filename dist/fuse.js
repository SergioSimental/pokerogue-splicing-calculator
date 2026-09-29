/**
 * Fusion rules live here so they are easy to update if the game changes.
 * - Each base stat is the average of head and body, rounded up.
 * - Primary type is the head's primary type.
 * - Secondary type is the body's secondary type (or its primary if it has none),
 *   falling back to the head's secondary type when it would duplicate the primary.
 */
export function fuse(head, body) {
    const stats = head.stats.map((v, i) => Math.ceil((v + (body.stats[i] ?? 0)) / 2));
    const primary = head.types[0];
    let secondary = body.types[1] ?? body.types[0];
    if (secondary === primary)
        secondary = head.types[1];
    const types = secondary ? [primary, secondary] : [primary];
    return { stats, types };
}
