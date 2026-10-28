import {describe,it,expect} from 'vitest';
import {parseMapCoordinate} from './MapSearch';
describe('map coordinate search',()=>{
 it('accepts latitude, longitude and returns map longitude, latitude',()=>{
  expect(parseMapCoordinate('30.7, 76.9')).toEqual([76.9,30.7]);
  expect(parseMapCoordinate('-33.86 151.2')).toEqual([151.2,-33.86]);
 });
 it('rejects invalid coordinates and treats place names as searches',()=>{
  expect(parseMapCoordinate('91, 76')).toBeNull();
  expect(parseMapCoordinate('30, 181')).toBeNull();
  expect(parseMapCoordinate('Chandigarh')).toBeNull();
 });
});
