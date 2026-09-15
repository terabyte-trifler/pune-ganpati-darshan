import catalogue from '@/content/catalogue.json';

/**
 * The most stops a darshan can hold.
 *
 * Derived, not chosen. A plan is a set of mandals from the catalogue, so
 * the only honest ceiling is how many there are — and a fixed number
 * silently becomes a wrong number the moment a mandal is added.
 *
 * It has been wrong twice already for that reason. It was first
 * MAX_MATRIX_POINTS - 1, which is a property of one routing provider's
 * table endpoint and nothing to do with how many mandals a person may
 * visit; a tenth stop then failed with a bare "Invalid request". It was
 * then 20, which stopped anyone planning the whole city on the one night
 * they might want to.
 *
 * The floor keeps the endpoints usable if the catalogue is ever trimmed,
 * and the cap is what stops this being an unbounded array on a public
 * endpoint: the cost of ordering stops grows with the square of them, and
 * a request for five hundred points is not a darshan.
 */
export const MAX_PLAN_STOPS = Math.max(catalogue.ganpatis.length, 30);
