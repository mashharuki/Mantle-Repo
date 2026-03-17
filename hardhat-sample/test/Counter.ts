import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import type { WalletClient } from "viem";

/**
 * Counter TypeScript テスト（Viem + node:test）
 *
 * Hardhat 3の新しいAPIを使ったTypeScriptテストの例。
 * - `network.connect()` でブロックチェーン状態を取得
 * - `viem.deployContract()` で型安全なコントラクトインスタンスを取得
 * - `counter.write.*()` で状態変更、`counter.read.*()` で参照
 */
describe("Counter (TypeScript + Viem)", async function () {
  const { viem, networkHelpers } = await network.connect();

  // ─── フィクスチャ ─────────────────────────────────────────

  async function deployFixture() {
    const [owner, other] = await viem.getWalletClients();
    const counter = await viem.deployContract("Counter");
    return { counter, owner, other };
  }

  // ─── 初期状態 ─────────────────────────────────────────────

  describe("初期状態", async function () {
    it("カウント初期値は0", async function () {
      const { counter } = await networkHelpers.loadFixture(deployFixture);
      assert.equal(await counter.read.x(), 0n);
    });

    it("デプロイヤーがオーナーになる", async function () {
      const { counter, owner } = await networkHelpers.loadFixture(deployFixture);
      const ownerAddr = await counter.read.owner();
      assert.equal(ownerAddr.toLowerCase(), owner.account.address.toLowerCase());
    });
  });

  // ─── inc() ────────────────────────────────────────────────

  describe("inc()", async function () {
    it("カウントが1増える", async function () {
      const { counter } = await networkHelpers.loadFixture(deployFixture);
      await counter.write.inc();
      assert.equal(await counter.read.x(), 1n);
    });

    it("複数回インクリメント", async function () {
      const { counter } = await networkHelpers.loadFixture(deployFixture);
      await counter.write.inc();
      await counter.write.inc();
      await counter.write.inc();
      assert.equal(await counter.read.x(), 3n);
    });

    it("非オーナーはrevertされる", async function () {
      const { counter, other } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        counter.write.inc({ account: other.account }),
        /OnlyOwner/,
      );
    });
  });

  // ─── incBy() ──────────────────────────────────────────────

  describe("incBy()", async function () {
    it("指定量だけ増える", async function () {
      const { counter } = await networkHelpers.loadFixture(deployFixture);
      await counter.write.incBy([10n]);
      assert.equal(await counter.read.x(), 10n);
    });

    it("amount=0はrevertされる", async function () {
      const { counter } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        counter.write.incBy([0n]),
        /ZeroAmount/,
      );
    });

    it("非オーナーはrevertされる", async function () {
      const { counter, other } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        counter.write.incBy([5n], { account: other.account }),
        /OnlyOwner/,
      );
    });
  });

  // ─── reset() ──────────────────────────────────────────────

  describe("reset()", async function () {
    it("カウントが0に戻る", async function () {
      const { counter } = await networkHelpers.loadFixture(deployFixture);
      await counter.write.incBy([42n]);
      await counter.write.reset();
      assert.equal(await counter.read.x(), 0n);
    });

    it("非オーナーはrevertされる", async function () {
      const { counter, other } = await networkHelpers.loadFixture(deployFixture);
      await assert.rejects(
        counter.write.reset({ account: other.account }),
        /OnlyOwner/,
      );
    });
  });
});
