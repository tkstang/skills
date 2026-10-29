import { ToolkitError } from './domain.js';
/** Local calendar days and relative donor search bounds; upper day bound is exclusive. */
export function timeBound(
  value: string | undefined,
  upper: boolean,
  now = new Date(),
): number | undefined {
  if (value === undefined) return undefined;
  const relative = /^(\d+)([hdw])$/u.exec(value);
  if (relative && Number(relative[1]) > 0)
    return (
      now.getTime() -
      Number(relative[1]) *
        { h: 3_600_000, d: 86_400_000, w: 604_800_000 }[relative[2]]!
    );
  let day: Date | undefined;
  if (value === 'today' || value === 'yesterday') {
    day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (value === 'yesterday' ? 1 : 0),
    );
  } else if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    day = new Date(y, m - 1, d);
    if (
      day.getFullYear() !== y ||
      day.getMonth() !== m - 1 ||
      day.getDate() !== d
    )
      day = undefined;
  } else if (
    /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
    Number.isFinite(Date.parse(value))
  )
    return Date.parse(value);
  if (!day)
    throw new ToolkitError(
      'E_USAGE',
      'Invalid time bound.',
      'Use Nh, Nd, Nw, today, yesterday, YYYY-MM-DD or an ISO instant.',
    );
  if (upper) day.setDate(day.getDate() + 1);
  return day.getTime();
}
