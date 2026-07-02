import { describe, it, expect } from 'vitest';
import { extractSizeToAddress } from '../extractSizeToAddress';

describe('extractSizeToAddress', () => {
  it("'Apartment' → buildingType='apartment' + roomKind='apartment_room' (size なし)", () => {
    expect(extractSizeToAddress('Apartment')).toEqual({
      buildingType: 'apartment',
      roomKind: 'apartment_room',
    });
  });

  it("'PrivateRoom' → buildingType='house' + roomKind='private_chamber'", () => {
    expect(extractSizeToAddress('PrivateRoom')).toEqual({
      buildingType: 'house',
      roomKind: 'private_chamber',
    });
  });

  it("'S' → buildingType='house' + size='S' (roomKind なし)", () => {
    expect(extractSizeToAddress('S')).toEqual({
      buildingType: 'house',
      size: 'S',
    });
  });

  it("'M' → buildingType='house' + size='M'", () => {
    expect(extractSizeToAddress('M')).toEqual({
      buildingType: 'house',
      size: 'M',
    });
  });

  it("'L' → buildingType='house' + size='L'", () => {
    expect(extractSizeToAddress('L')).toEqual({
      buildingType: 'house',
      size: 'L',
    });
  });
});
