/**
 * Tests de regresion para src/utils/geometria.js
 *
 * Cubren el nucleo geoespacial de la app (parcelas y pines):
 * areas con turf.js, formato de unidades, serializacion y
 * operaciones de punto-en-poligono. Sin mocks: se prueba el
 * codigo real con datos geograficos conocidos.
 */
import {
  calcularAreaParcela,
  formatearArea,
  verticesToGeoJSON,
  parseGeometria,
  serializeGeometria,
  getCentroide,
  puntoEnPoligono,
} from '../geometria';

// Cuadrado de 1° x 1° sobre el ecuador: 1° ~= 111.32 km,
// por lo que el area geodesica debe estar cerca de 12_400 km².
const CUADRADO_1_GRADO = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 1 },
  { lat: 1, lng: 1 },
  { lat: 1, lng: 0 },
];

describe('calcularAreaParcela', () => {
  test('calcula un area positiva para un triangulo valido', () => {
    const area = calcularAreaParcela([
      { lat: 19.24, lng: -103.72 },
      { lat: 19.25, lng: -103.72 },
      { lat: 19.24, lng: -103.71 },
    ]);

    expect(typeof area).toBe('number');
    expect(area).toBeGreaterThan(0);
  });

  test('un cuadrado de 1° x 1° en el ecuador mide ~12_400 km²', () => {
    const area = calcularAreaParcela(CUADRADO_1_GRADO);

    expect(area).toBeGreaterThan(1.2e10);
    expect(area).toBeLessThan(1.3e10);
  });

  test('duplicar el lado cuadruplica el area (propiedad de escala)', () => {
    const base = calcularAreaParcela(CUADRADO_1_GRADO);
    const doble = calcularAreaParcela([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 2 },
      { lat: 2, lng: 2 },
      { lat: 2, lng: 0 },
    ]);

    expect(doble / base).toBeCloseTo(4, 0);
  });

  test.each([[[]], [[{ lat: 0, lng: 0 }]], [[{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }]], [null], [undefined]])(
    'lanza error con menos de 3 vertices (%p)',
    (vertices) => {
      expect(() => calcularAreaParcela(vertices)).toThrow();
    },
  );
});

describe('formatearArea', () => {
  test('muestra m² por debajo de una hectarea', () => {
    expect(formatearArea(500)).toBe('500.00 m²');
  });

  test('convierte a hectareas desde 10_000 m²', () => {
    expect(formatearArea(10000)).toBe('1.00 ha');
    expect(formatearArea(386014)).toBe('38.60 ha');
  });

  test('9999.99 m² sigue en m² (limite exclusivo)', () => {
    expect(formatearArea(9999.99)).toBe('9999.99 m²');
  });
});

describe('verticesToGeoJSON', () => {
  test('genera un Polygon con anillo cerrado', () => {
    const geojson = verticesToGeoJSON(CUADRADO_1_GRADO);

    expect(geojson.type).toBe('Feature');
    expect(geojson.geometry.type).toBe('Polygon');
    const anillo = geojson.geometry.coordinates[0];
    expect(anillo).toHaveLength(CUADRADO_1_GRADO.length + 1);
    expect(anillo[0]).toEqual(anillo[anillo.length - 1]);
  });

  test('convierte {lat, lng} a orden GeoJSON [lng, lat]', () => {
    const geojson = verticesToGeoJSON([{ lat: 19.24, lng: -103.72 }, { lat: 19.25, lng: -103.71 }, { lat: 19.26, lng: -103.7 }]);

    expect(geojson.geometry.coordinates[0][0]).toEqual([-103.72, 19.24]);
  });
});

describe('serializeGeometria / parseGeometria', () => {
  test('round-trip conserva los vertices', () => {
    const vertices = [
      { lat: 19.24, lng: -103.72 },
      { lat: 19.25, lng: -103.71 },
      { lat: 19.26, lng: -103.7 },
    ];

    expect(parseGeometria(serializeGeometria(vertices))).toEqual(vertices);
  });

  test('parseGeometria lanza con JSON invalido', () => {
    expect(() => parseGeometria('no-es-json')).toThrow();
  });

  test('parseGeometria lanza con menos de 3 vertices', () => {
    expect(() => parseGeometria(JSON.stringify([{ lat: 0, lng: 0 }]))).toThrow();
  });
});

describe('getCentroide', () => {
  test('el centroide de un cuadrado simetrico es su centro', () => {
    const centroide = getCentroide(CUADRADO_1_GRADO);

    expect(centroide.lat).toBeCloseTo(0.5, 5);
    expect(centroide.lng).toBeCloseTo(0.5, 5);
  });
});

describe('puntoEnPoligono', () => {
  test('un punto interior devuelve true', () => {
    expect(puntoEnPoligono(CUADRADO_1_GRADO, { lat: 0.5, lng: 0.5 })).toBe(true);
  });

  test('un punto exterior devuelve false', () => {
    expect(puntoEnPoligono(CUADRADO_1_GRADO, { lat: 5, lng: 5 })).toBe(false);
  });
});
