import { nextTableName } from './table-naming';

describe('nextTableName', () => {
  it('should take the smallest free T number', () => {
    expect(nextTableName([])).toBe('T1');
    expect(nextTableName(['T1', 'T3'])).toBe('T2');
  });

  it('should ignore case and spaces when looking for a free number', () => {
    expect(nextTableName(['t1 ', 'T2'])).toBe('T3');
  });
});
