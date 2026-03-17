// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Counter
/// @notice Mantle Network Hardhat 3 チュートリアル用サンプルコントラクト
/// @dev オーナーのみインクリメント可能なシンプルなカウンター
contract Counter {
    /// @notice 現在のカウント値
    uint256 public x;

    /// @notice コントラクトオーナー
    address public owner;

    /// @notice カウント変更時のイベント
    /// @param newValue インクリメント後の新しい値
    event Incremented(uint256 newValue);

    /// @notice オーナーのみ実行可能なエラー
    error OnlyOwner();

    /// @notice ゼロ増分エラー
    error ZeroAmount();

    constructor() {
        owner = msg.sender;
        x = 0;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /// @notice カウントを1増やす
    function inc() external onlyOwner {
        x += 1;
        emit Incremented(x);
    }

    /// @notice カウントを指定量増やす
    /// @param amount 増やす量（0は不可）
    function incBy(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        x += amount;
        emit Incremented(x);
    }

    /// @notice カウントをリセット
    function reset() external onlyOwner {
        x = 0;
        emit Incremented(0);
    }
}
