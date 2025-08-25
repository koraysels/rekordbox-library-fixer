import { describe, it, expect } from 'vitest';

describe('Simple Test', () => {
  it('should pass basic arithmetic', () => {
    expect(2 + 2).toBe(4);
  });
  
  it('should verify string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
  });
});