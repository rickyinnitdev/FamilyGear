export interface AceLighting { effect: number; color: string; rainbow: boolean; brightness?: number; speed?: number; direction?: number }
export interface LightingSnapshot { settings: Uint8Array; base: Uint8Array; profile: number; firmware: string }
export const LIGHT_EFFECTS = [
  [3, 'Static'], [4, 'Breathing'], [1, 'Rainbow cycle'], [6, 'Horizontal wave'], [7, 'Vertical wave'],
  [8, 'Center spread'], [9, 'Star twinkle'], [5, 'Disco'], [2, 'Linear gradient'], [11, 'Bottom up'],
  [12, 'Reciprocating rebound'], [10, 'Center spin'], [18, 'Diagonal flow'], [19, 'Laser rain'],
  [20, 'Dot twinkle'], [21, 'Fireworks'], [22, 'Triangle bounce'], [14, 'Solid ripple'],
  [13, 'Key ripple'], [15, 'Key trail'], [16, 'Key fireworks'], [17, 'Key beam'],
].map(([value, label]) => ({ value: Number(value), label: String(label) }));

export function decodeLighting(settings: Uint8Array, profile: number): AceLighting {
  const offset = profile * 64;
  if (settings.length !== 256 || !Number.isInteger(profile) || profile < 0 || profile > 3 || settings[offset + 2] !== 0xaa || settings[offset + 3] !== 0xbb) throw new Error('Unknown Pro lighting layout.');
  return { effect: settings[offset + 8], brightness: settings[offset + 9], speed: 4 - settings[offset + 10], direction: settings[offset + 11], rainbow: settings[offset + 12] !== 0, color: '#' + Array.from(settings.slice(offset + 14, offset + 17), b => b.toString(16).padStart(2, '0')).join('') };
}
export function updateLighting(settings: Uint8Array, profile: number, value: AceLighting): Uint8Array {
  decodeLighting(settings, profile);
  if (!LIGHT_EFFECTS.some(e => e.value === value.effect) || !/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error('Choose a supported lighting effect and RGB color.');
  const next = settings.slice(), offset = profile * 64;
  next[offset + 8] = value.effect;
  if (value.brightness !== undefined) {
    if (!Number.isInteger(value.brightness) || value.brightness < 0 || value.brightness > 100) throw new Error('Brightness must be between 0 and 100 percent.');
    next[offset + 9] = value.brightness;
  }
  if (value.speed !== undefined) {
    if (!Number.isInteger(value.speed) || value.speed < 1 || value.speed > 4) throw new Error('Animation speed must be between 1 and 4.');
    next[offset + 10] = 4 - value.speed;
  }
  next[offset + 12] = value.rainbow || value.effect === 1 ? 1 : 0;
  for (let i = 0; i < 3; i++) next[offset + 14 + i] = parseInt(value.color.slice(1 + i * 2, 3 + i * 2), 16);
  return next;
}
