import { union } from '@jscad/modeling/src/operations/booleans';
import { translate } from '@jscad/modeling/src/operations/transforms';

import { Params, Vent } from '../params';
import { hole } from './holes';

/** Create a repeated grille of rectangular cutters using the normal hole geometry. */
export const vent = (params: Params, ventParams: Vent) => {
  const pitch = ventParams.holeWidth + ventParams.supportWidth;
  const count = Math.max(1, Math.floor((ventParams.width + ventParams.supportWidth) / pitch));
  const occupiedWidth = count * ventParams.holeWidth + (count - 1) * ventParams.supportWidth;
  const firstOffset = -occupiedWidth / 2 + ventParams.holeWidth / 2;

  const stripes = Array.from({ length: count }, (_, index) =>
    translate(
      [firstOffset + index * pitch, 0, 0],
      hole(params, {
        id: `${ventParams.id}-stripe-${index}`,
        shape: 'rectangle',
        diameter: 0,
        width: ventParams.holeWidth,
        length: ventParams.length,
        surface: ventParams.surface,
        x: 0,
        y: 0,
        rounded: ventParams.rounded,
        cornerRadius: ventParams.cornerRadius,
      }),
    ),
  );

  return union(stripes);
};
