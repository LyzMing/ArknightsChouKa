import assert from "node:assert/strict";
import "../lottery-system.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const lottery = globalThis.AKLottery.create(memoryStorage());
let state = lottery.snapshot();
assert.deepEqual(state.prizes.map(prize => prize.remaining), [1, 51, 35, 162]);
assert.equal(state.prizes.reduce((sum, prize) => sum + prize.remaining, 0), 249);

const dynamicRates = lottery.probabilities();
assert.ok(Math.abs(dynamicRates.find(item => item.id === "grand").probability - 1 / 249) < 1e-12);
assert.ok(Math.abs(dynamicRates.reduce((sum, item) => sum + item.probability, 0) - 1) < 1e-12);

const plan = lottery.planDraw();
const firstCommit = lottery.commitDraw(plan);
const secondCommit = lottery.commitDraw(plan);
assert.deepEqual(secondCommit, firstCommit, "重复提交必须幂等");
assert.equal(firstCommit.roll, plan.roll, "记录应保留随机数以便审计");
state = lottery.snapshot();
assert.equal(state.history.length, 1);
assert.equal(state.prizes.reduce((sum, prize) => sum + prize.remaining, 0), 248);

lottery.updateConfig({
  mode: "fixed",
  prizes: state.prizes.map(prize => ({
    ...prize,
    fixedRate: { grand: 0.01, first: 0.09, second: 0.30, third: 0.60 }[prize.id],
  })),
});
const fixedRates = Object.fromEntries(lottery.probabilities().map(item => [item.id, item.probability]));
if (lottery.snapshot().prizes.find(item => item.id === "grand").remaining > 0)
  assert.ok(Math.abs(fixedRates.grand - 0.01) < 1e-12);

assert.throws(() => lottery.updateConfig({
  mode: "fixed",
  prizes: lottery.snapshot().prizes.map(prize => ({ ...prize, fixedRate: 0.1 })),
}), /100%/);

lottery.resetInventory();
state = lottery.snapshot();
assert.deepEqual(state.prizes.map(prize => prize.remaining), [1, 51, 35, 162]);
assert.equal(state.history.length, 1, "补满库存不应删除审计记录");

console.log("lottery-system: all tests passed");
