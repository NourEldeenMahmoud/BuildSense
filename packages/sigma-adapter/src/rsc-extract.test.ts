import { describe, expect, it } from 'vitest';
import { extractRscPayloads } from './rsc-extract.js';

describe('extractRscPayloads', () => {
  it('preserves a closing delimiter inside a string payload', () => {
    const html = `<script>self.__next_f.push([1,"text ]) still in string"])</script>`;

    expect(extractRscPayloads(html)).toEqual(['text ]) still in string']);
  });

  it('preserves escaped quotes and nested arrays in a payload', () => {
    const escapedQuote = `\\${'"'}`;
    const html = `<script>self.__next_f.push([1,{"message":"A ${escapedQuote}quoted${escapedQuote} value", "items":[1,2]}])</script>`;

    expect(extractRscPayloads(html)).toEqual([{ message: 'A "quoted" value', items: [1, 2] }]);
  });
});
