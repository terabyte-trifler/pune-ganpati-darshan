import { redirect } from 'next/navigation';

/**
 * The route builder moved into the planner.
 *
 * Building a route and then managing it were two pages and a navigation,
 * and they are one task: you build it, look at it, and start reordering.
 * The split also meant the wizard's result and the planner showed the same
 * route in two layouts with two sets of numbers.
 *
 * This route stays because it is linked from the home page, the routes
 * index, the sitemap and anywhere anyone has shared it. `?build=1` is what
 * keeps the meaning intact: it opens the builder even for someone who
 * already has a plan saved, which is exactly what "Build my route" should
 * do for them.
 */
export default function StartPage() {
  redirect('/plan?build=1');
}
