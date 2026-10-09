/* 社团抽奖库存与概率引擎。无框架、无网络依赖，状态保存在 localStorage。 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "aklottery.v1.state";
  // 2：2026 秋季紧急换奖，四档总库存整体改为 1 / 51 / 35 / 162。
  // 旧版本存下的库存作废，但抽奖记录作为历史日志保留。
  const VERSION = 2;
  const DEFAULT_PRIZES = [
    { id: "grand",  name: "特等奖", total: 1,   weight: 1, fixedRate: 1 / 249 },
    { id: "first",  name: "一等奖", total: 51,  weight: 1, fixedRate: 51 / 249 },
    { id: "second", name: "二等奖", total: 35,  weight: 1, fixedRate: 35 / 249 },
    { id: "third",  name: "三等奖", total: 162, weight: 1, fixedRate: 162 / 249 },
  ];

  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = (value, fallback) => Number.isFinite(+value) ? +value : fallback;
  const int = (value, fallback) => Math.max(0, Math.floor(finite(value, fallback)));

  function freshState() {
    return {
      version: VERSION,
      mode: "dynamic",
      prizes: DEFAULT_PRIZES.map(prize => ({
        ...prize,
        remaining: prize.total,
      })),
      history: [],
      lastCommittedDraw: null,
      updatedAt: new Date().toISOString(),
    };
  }

  function normalize(raw) {
    const base = freshState();
    if (!raw || typeof raw !== "object") return base;
    // 换奖后版本号变了：四档总库存按新奖品重置，旧记录留作历史日志。
    if (raw.version !== VERSION) {
      base.history = Array.isArray(raw.history) ? raw.history.slice(-10000) : [];
      return base;
    }
    base.mode = raw.mode === "fixed" ? "fixed" : "dynamic";
    base.prizes = DEFAULT_PRIZES.map(defaultPrize => {
      const saved = Array.isArray(raw.prizes)
        ? raw.prizes.find(prize => prize && prize.id === defaultPrize.id)
        : null;
      const total = int(saved?.total, defaultPrize.total);
      return {
        id: defaultPrize.id,
        name: defaultPrize.name,
        total,
        remaining: Math.min(total, int(saved?.remaining, total)),
        weight: Math.max(0, finite(saved?.weight, defaultPrize.weight)),
        fixedRate: Math.max(0, finite(saved?.fixedRate, defaultPrize.fixedRate)),
      };
    });
    base.history = Array.isArray(raw.history) ? raw.history.slice(-10000) : [];
    base.lastCommittedDraw = raw.lastCommittedDraw || null;
    base.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt;
    return base;
  }

  function secureRandom() {
    if (global.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      global.crypto.getRandomValues(value);
      return value[0] / 4294967296;
    }
    return Math.random();
  }

  function createLotterySystem(storage) {
    const store = storage || global.localStorage;
    let state;

    function load() {
      try { state = normalize(JSON.parse(store.getItem(STORAGE_KEY))); }
      catch { state = freshState(); }
      return snapshot();
    }

    function save() {
      state.updatedAt = new Date().toISOString();
      store.setItem(STORAGE_KEY, JSON.stringify(state));
      return snapshot();
    }

    function snapshot() { return clone(state); }

    function probabilities() {
      const scores = state.prizes.map(prize => {
        if (prize.remaining <= 0) return 0;
        return state.mode === "fixed"
          ? prize.fixedRate
          : prize.remaining * prize.weight;
      });
      const sum = scores.reduce((total, score) => total + score, 0);
      return state.prizes.map((prize, index) => ({
        id: prize.id,
        name: prize.name,
        probability: sum > 0 ? scores[index] / sum : 0,
      }));
    }

    function planDraw() {
      const rates = probabilities();
      if (!rates.some(item => item.probability > 0)) return null;
      const roll = secureRandom();
      let cursor = 0;
      let chosen = rates[rates.length - 1];
      for (const item of rates) {
        cursor += item.probability;
        if (roll < cursor) { chosen = item; break; }
      }
      return {
        token: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        prizeId: chosen.id,
        prizeName: chosen.name,
        plannedAt: new Date().toISOString(),
        roll,
        probability: chosen.probability,
        mode: state.mode,
        probabilitySnapshot: Object.fromEntries(rates.map(item => [item.id, item.probability])),
      };
    }

    function commitDraw(plan) {
      if (!plan?.token || !plan?.prizeId) throw new Error("无效的抽奖计划");
      // 同一 token 即使因浏览器事件重复触发，也只扣一次库存。
      const existing = state.history.find(item => item.token === plan.token);
      if (existing) return clone(existing);
      const prize = state.prizes.find(item => item.id === plan.prizeId);
      if (!prize || prize.remaining <= 0) throw new Error("该奖项库存已耗尽，请重新抽取");
      prize.remaining -= 1;
      const record = {
        token: plan.token,
        prizeId: prize.id,
        prizeName: prize.name,
        committedAt: new Date().toISOString(),
        mode: plan.mode,
        roll: plan.roll,
        probability: plan.probability,
        probabilitySnapshot: plan.probabilitySnapshot,
        remainingAfter: prize.remaining,
      };
      state.history.push(record);
      if (state.history.length > 10000) state.history.shift();
      state.lastCommittedDraw = record;
      save();
      return clone(record);
    }

    function updateConfig(config) {
      if (!config || !Array.isArray(config.prizes)) throw new Error("配置格式错误");
      const nextMode = config.mode === "fixed" ? "fixed" : "dynamic";
      const next = state.prizes.map(current => {
        const incoming = config.prizes.find(item => item.id === current.id);
        if (!incoming) return current;
        const total = int(incoming.total, current.total);
        return {
          ...current,
          total,
          remaining: Math.min(total, int(incoming.remaining, current.remaining)),
          weight: Math.max(0, finite(incoming.weight, current.weight)),
          fixedRate: Math.max(0, finite(incoming.fixedRate, current.fixedRate)),
        };
      });
      if (!next.some(prize => prize.remaining > 0 &&
        (nextMode === "fixed" ? prize.fixedRate > 0 : prize.weight > 0))) {
        throw new Error("至少要有一个仍有库存且概率大于 0 的奖项");
      }
      if (nextMode === "fixed") {
        const sum = next.reduce((total, prize) => total + prize.fixedRate, 0);
        if (Math.abs(sum - 1) > 0.0005) throw new Error("固定概率合计必须为 100%");
      }
      state.mode = nextMode;
      state.prizes = next;
      return save();
    }

    function resetInventory() {
      state.prizes.forEach(prize => { prize.remaining = prize.total; });
      state.lastCommittedDraw = null;
      return save();
    }

    function resetAll() {
      state = freshState();
      return save();
    }

    function exportData() {
      return JSON.stringify(snapshot(), null, 2) + "\n";
    }

    load();
    return { snapshot, probabilities, planDraw, commitDraw, updateConfig,
      resetInventory, resetAll, exportData, reload: load, storageKey: STORAGE_KEY };
  }

  global.AKLottery = { create: createLotterySystem, defaults: clone(DEFAULT_PRIZES) };
})(typeof window !== "undefined" ? window : globalThis);
