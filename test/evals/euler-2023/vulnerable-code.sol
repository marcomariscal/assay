// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IERC20 {
	function transferFrom(address from, address to, uint256 amount) external returns (bool);
	function balanceOf(address account) external view returns (uint256);
}

// Minimalized EToken-style snippet highlighting the donateToReserves + liquidation manipulation pattern.
contract EulerLikeEToken {
	IERC20 public immutable asset;
	mapping(address => uint256) public balanceOf;
	uint256 public totalSupply;
	uint256 public totalBorrows;
	uint256 public reserves;

	constructor(IERC20 _asset) {
		asset = _asset;
	}

	// Vulnerability: burns the caller's eTokens and shifts value into reserves
	// without re-checking account health or liquidity.
	function donateToReserves(uint256 amount) external {
		asset.transferFrom(msg.sender, address(this), amount);
		balanceOf[msg.sender] -= amount;
		totalSupply -= amount;
		reserves += amount;
		// Missing: health check to prevent undercollateralization after donation.
	}

	function exchangeRate() public view returns (uint256) {
		if (totalSupply == 0) return 1e18;
		return (totalUnderlying() * 1e18) / totalSupply;
	}

	function totalUnderlying() public view returns (uint256) {
		// reserves are included, so donations can inflate the exchange rate.
		return asset.balanceOf(address(this)) + totalBorrows + reserves;
	}

	// Liquidation uses the manipulated exchange rate to compute seize amount.
	function liquidate(address violator, uint256 repayAmount) external {
		uint256 rate = exchangeRate();
		uint256 seizeTokens = (repayAmount * rate) / 1e18;
		_transfer(violator, msg.sender, seizeTokens);
	}

	function _transfer(address from, address to, uint256 amount) internal {
		balanceOf[from] -= amount;
		balanceOf[to] += amount;
	}
}
