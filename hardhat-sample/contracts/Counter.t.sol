// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Counter } from "./Counter.sol";
import { Test } from "forge-std/Test.sol";

/// @title CounterTest
/// @notice Hardhat 3 Solidityテスト（Foundry互換）
contract CounterTest is Test {
    Counter counter;
    address owner;
    address other;

    function setUp() public {
        owner = address(this);
        other = makeAddr("other");
        counter = new Counter();
    }

    // ─── 初期状態 ───────────────────────────────────────────

    function test_InitialValue() public view {
        assertEq(counter.x(), 0);
    }

    function test_OwnerIsDeployer() public view {
        assertEq(counter.owner(), owner);
    }

    // ─── inc() ──────────────────────────────────────────────

    function test_Inc() public {
        counter.inc();
        assertEq(counter.x(), 1);
    }

    function test_Inc_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit Counter.Incremented(1);
        counter.inc();
    }

    function test_Inc_Reverts_IfNotOwner() public {
        vm.prank(other);
        vm.expectRevert(Counter.OnlyOwner.selector);
        counter.inc();
    }

    // ─── incBy() ────────────────────────────────────────────

    function test_IncBy() public {
        counter.incBy(5);
        assertEq(counter.x(), 5);
    }

    function test_IncBy_Reverts_IfZero() public {
        vm.expectRevert(Counter.ZeroAmount.selector);
        counter.incBy(0);
    }

    function test_IncBy_Reverts_IfNotOwner() public {
        vm.prank(other);
        vm.expectRevert(Counter.OnlyOwner.selector);
        counter.incBy(10);
    }

    /// @notice ファズテスト: 任意のamountでincByが正しく動作する
    function testFuzz_IncBy(uint128 amount) public {
        vm.assume(amount > 0);
        counter.incBy(amount);
        assertEq(counter.x(), amount);
    }

    // ─── reset() ────────────────────────────────────────────

    function test_Reset() public {
        counter.incBy(42);
        counter.reset();
        assertEq(counter.x(), 0);
    }

    function test_Reset_Reverts_IfNotOwner() public {
        vm.prank(other);
        vm.expectRevert(Counter.OnlyOwner.selector);
        counter.reset();
    }

    // ─── 複合シナリオ ────────────────────────────────────────

    function test_MultipleIncs() public {
        counter.inc();
        counter.inc();
        counter.incBy(3);
        assertEq(counter.x(), 5);
    }
}
