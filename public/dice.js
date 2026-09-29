// Die faces drawn with CSS (a 3×3 grid of pip slots), plus the face colours.

// Okabe–Ito palette: distinguishable for common forms of colour blindness.
export const FACE_COLORS = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00'];

// Pip positions in a 3×3 grid, numbered 0–8 row by row.
const PIPS = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Returns a <span class="die"> element showing the given face. */
export function dieFace(value) {
  const die = document.createElement('span');
  die.className = 'die';
  die.dataset.face = value;
  die.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('span');
    if (PIPS[value].includes(i)) slot.className = 'pip';
    die.append(slot);
  }
  return die;
}
