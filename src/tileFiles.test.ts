import { tileFileName } from './tileFiles';

describe('tileFileName', () => {
  it('names a tile after its URL, with the image type', () => {
    const a = tileFileName('https://mapy.geoportal.gov.pl/wss/service/x?z=15&x=1&y=2');
    expect(a).toMatch(/^[0-9a-f]{14}\.png$/);
    expect(tileFileName('https://mapy.geoportal.gov.pl/wss/service/x?z=15&x=1&y=2')).toBe(a);
    expect(tileFileName('https://mapy.geoportal.gov.pl/wss/service/x?z=15&x=1&y=3')).not.toBe(a);
    expect(tileFileName('u', 'image/jpeg')).toMatch(/\.jpg$/);
  });
});
