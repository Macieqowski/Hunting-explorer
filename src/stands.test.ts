import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { classifyStand, parseKml, kmlFromKmz, standsFromFile, encodeStands, parseStands, sortStands, parseLatLng, nextStandName } from './stands';

// Made-up points, in the shape Google My Maps exports.
const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Zwyzki</name>
    <Style id="icon-1"><IconStyle><Icon><href>images/icon-1.png</href></Icon></IconStyle></Style>
    <Placemark>
      <name>1</name>
      <styleUrl>#icon-1</styleUrl>
      <Point>
        <coordinates>
          21.0001,52.0001,0
        </coordinates>
      </Point>
    </Placemark>
    <Placemark><name>Powalona zwyżka 11A</name><Point><coordinates>21.0002,52.0002,0</coordinates></Point></Placemark>
    <Placemark><name>Ambona</name><Point><coordinates>21.0003,52.0003</coordinates></Point></Placemark>
    <Placemark><name><![CDATA[Jan & syn]]></name><Point><coordinates>21.0004,52.0004,0</coordinates></Point></Placemark>
    <Placemark><name>Droga</name><LineString><coordinates>21,52,0 21.1,52.1,0</coordinates></LineString></Placemark>
    <Folder>
      <name>Ambony</name>
      <Placemark><name>7</name><Point><coordinates>21.0005,52.0005,0</coordinates></Point></Placemark>
      <Placemark><Point><coordinates>21.0006,52.0006,0</coordinates></Point></Placemark>
    </Folder>
    <Placemark><name>Las &amp; pole</name><Point><coordinates>21.0007,52.0007,0</coordinates></Point></Placemark>
  </Document>
</kml>`;

/** A minimal zip with the given files, deflated like Google Earth does. */
function zip(files: Record<string, string>): ArrayBuffer {
  const enc = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name);
    const data = new Uint8Array(deflateRawSync(enc.encode(text)));
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(8, 8, true);
    lh.setUint32(18, data.length, true);
    lh.setUint16(26, n.length, true);
    local.push(new Uint8Array(lh.buffer), n, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(10, 8, true);
    ch.setUint32(20, data.length, true);
    ch.setUint16(28, n.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const cdSize = central.reduce((s, x) => s + x.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of parts) {
    out.set(x, p);
    p += x.length;
  }
  return out.buffer;
}

describe('classifyStand', () => {
  it('tells ambony from zwyżki and spots fallen ones', () => {
    expect(classifyStand('12')).toEqual({ kind: 'zwyzka', broken: false });
    expect(classifyStand('Ambona przy łące')).toEqual({ kind: 'ambona', broken: false });
    expect(classifyStand('Powalona zwyżka')).toEqual({ kind: 'zwyzka', broken: true });
    expect(classifyStand('5', 'Ambony')).toEqual({ kind: 'ambona', broken: false });
    expect(classifyStand('Zwyżka 5', 'Ambony').kind).toBe('zwyzka');
  });
});

describe('parseKml', () => {
  it('reads named points and skips lines', () => {
    const ss = parseKml(KML);
    expect(ss.map((s) => s.name)).toEqual(['1', 'Powalona zwyżka 11A', 'Ambona', 'Jan & syn', '7', 'Ambona 1', 'Las & pole']);
    expect(ss[0]).toEqual({ name: '1', kind: 'zwyzka', broken: false, lat: 52.0001, lng: 21.0001 });
    expect(ss[1].broken).toBe(true);
    expect(ss[2].kind).toBe('ambona');
    expect(ss[4].kind).toBe('ambona'); // from the folder
    expect(ss[6].kind).toBe('zwyzka'); // after the folder closed
  });
  it('ignores bad coordinates', () => {
    expect(parseKml('<Placemark><name>x</name><Point><coordinates>200,52</coordinates></Point></Placemark>')).toEqual([]);
    expect(parseKml('<Placemark><name>x</name><Point><coordinates>abc</coordinates></Point></Placemark>')).toEqual([]);
  });
});

describe('KMZ', () => {
  it('finds doc.kml inside the archive', async () => {
    const kmz = zip({ 'images/icon-1.png': 'png', 'doc.kml': KML });
    expect(await kmlFromKmz(kmz)).toBe(KML);
    expect((await standsFromFile(kmz)).length).toBe(7);
  });
  it('also takes plain KML and rejects other files', async () => {
    expect((await standsFromFile(new TextEncoder().encode(KML).buffer)).length).toBe(7);
    await expect(kmlFromKmz(zip({ 'a.txt': 'x' }))).rejects.toThrow();
    await expect(kmlFromKmz(new ArrayBuffer(10))).rejects.toThrow();
  });
});

describe('storage', () => {
  it('round-trips in file order', () => {
    const ss = parseKml(KML);
    const enc = encodeStands(ss);
    expect(Object.keys(enc)[0]).toBe('s000');
    expect(enc.s001).toEqual({ n: 'Powalona zwyżka 11A', k: 'zwyzka', lat: 52.0002, lng: 21.0002, b: true });
    expect(parseStands(enc)).toEqual(ss);
    expect(parseStands({ x: { n: 'a', k: 'bunker', lat: 1, lng: 2 } })).toEqual([]);
    expect(parseStands(null)).toEqual([]);
  });
  it('sorts numbers naturally', () => {
    expect(sortStands([{ name: '10' }, { name: '9A' }, { name: 'Ambona' }, { name: '2' }, { name: '9' }]).map((s) => s.name)).toEqual(['2', '9', '9A', '10', 'Ambona']);
  });
});

describe('editing helpers', () => {
  it('reads typed coordinates', () => {
    expect(parseLatLng('54.012345, 18.5843')).toEqual({ lat: 54.012345, lng: 18.5843 });
    expect(parseLatLng(' 54.01 18.58 ')).toEqual({ lat: 54.01, lng: 18.58 });
    expect(parseLatLng('54,01; 18,58')).toEqual({ lat: 54.01, lng: 18.58 });
    expect(parseLatLng('54.01,18.58')).toEqual({ lat: 54.01, lng: 18.58 });
    expect(parseLatLng('54.01')).toBeNull();
    expect(parseLatLng('95, 18')).toBeNull();
    expect(parseLatLng('abc')).toBeNull();
  });
  it('numbers new seats after the highest one', () => {
    expect(nextStandName([{ name: '9A' }, { name: '24' }, { name: 'Ambona' }])).toBe('25');
    expect(nextStandName([])).toBe('1');
  });
});
