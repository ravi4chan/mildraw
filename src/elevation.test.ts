import {describe,it,expect} from 'vitest';
import {decodeElevation,elevationPixel} from './elevation';
describe('terrain elevation',()=>{
 it('decodes positive, sea-level and negative Terrarium samples',()=>{
  expect(decodeElevation(137,219,68)).toBeCloseTo(2523.265625);
  expect(decodeElevation(128,0,0)).toBe(0);
  expect(decodeElevation(127,255,0)).toBe(-1);
  expect(decodeElevation(0,0,0)).toBeNull();
 });
 it('addresses the equator and wraps longitude',()=>{
  expect(elevationPixel([0,0])).toEqual({z:12,x:2048,y:2048,px:0,py:0});
  expect(elevationPixel([180,0])).toEqual(elevationPixel([-180,0]));
 });
 it('rejects invalid latitude without issuing tile requests',()=>{
  expect(elevationPixel([0,90])).toBeNull();
  expect(elevationPixel([NaN,0])).toBeNull();
 });
});
