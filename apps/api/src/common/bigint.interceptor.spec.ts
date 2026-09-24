import { of } from 'rxjs';
import { BigIntInterceptor } from './bigint.interceptor';

const run = async (payload: unknown) => {
  const interceptor = new BigIntInterceptor();
  const result = interceptor.intercept({} as never, {
    handle: () => of(payload),
  });

  // subscribe(resolve) sem handler de erro nunca rejeitaria: o RxJS 7 agenda
  // erro não tratado via setTimeout (reportUnhandledError), então a promise
  // ficaria pendente para sempre e o teste estouraria por timeout.
  return new Promise((resolve, reject) =>
    result.subscribe({ next: resolve, error: reject }),
  );
};

describe('BigIntInterceptor', () => {
  it('converts a top-level BigInt to a number', async () => {
    await expect(run({ amount_cents: 125000n })).resolves.toEqual({
      amount_cents: 125000,
    });
  });

  it('converts BigInt nested in arrays and objects', async () => {
    await expect(
      run({ data: [{ amount_cents: 1n }, { amount_cents: 2n }] }),
    ).resolves.toEqual({
      data: [{ amount_cents: 1 }, { amount_cents: 2 }],
    });
  });

  it('survives JSON.stringify afterwards', async () => {
    const converted = await run({ amount_cents: 875049n });
    expect(() => JSON.stringify(converted)).not.toThrow();
  });

  it('throws when a BigInt exceeds the safe integer range', async () => {
    await expect(run({ amount_cents: 2n ** 60n })).rejects.toThrow(
      /safe integer/i,
    );
  });

  it('throws when a BigInt is below the negative safe integer range', async () => {
    await expect(run({ amount_cents: -(2n ** 60n) })).rejects.toThrow(
      /safe integer/i,
    );
  });

  it('converts boundary-safe BigInt values instead of throwing', async () => {
    await expect(run({ a: 0n, b: -1n, c: 9007199254740991n })).resolves.toEqual(
      {
        a: 0,
        b: -1,
        c: 9007199254740991,
      },
    );
  });

  it('converts BigInt in a bare top-level array response', async () => {
    await expect(
      run([{ amount_cents: 1n }, { amount_cents: 2n }]),
    ).resolves.toEqual([{ amount_cents: 1 }, { amount_cents: 2 }]);
  });

  it('leaves Date, null and undefined untouched', async () => {
    const date = new Date('2026-09-18T14:00:00-03:00');
    await expect(
      run({ paid_at: date, a: null, b: undefined }),
    ).resolves.toEqual({
      paid_at: date,
      a: null,
      b: undefined,
    });
  });
});
