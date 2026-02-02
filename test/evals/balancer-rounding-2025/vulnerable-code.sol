// SPDX-License-Identifier: GPL-3.0-or-later
// Source: Balancer V2 ComposableStablePool (pre-patch)
// Exploit: November 3, 2025 — $128M drained via rounding error
// Reference: https://research.checkpoint.com/2025/how-an-attacker-drained-128m-from-balancer-through-rounding-error-exploitation/

pragma solidity ^0.7.0;

import "./FixedPoint.sol";

/**
 * VULNERABILITY: _upscaleArray uses mulDown which rounds down.
 * When balances are small (8-9 wei), rounding error is ~10% relative.
 * Attacker batched 65 micro-swaps to compound precision loss,
 * suppressing BPT price and extracting value via arbitrage.
 *
 * MISSING SAFEGUARDS:
 * 1. No minimum balance check before scaling
 * 2. No invariant change validation after swaps
 * 3. No bounds on relative precision loss
 */
contract ComposableStablePoolMath {
    using FixedPoint for uint256;

    // VULNERABLE FUNCTION
    function _upscaleArray(
        uint256[] memory amounts,
        uint256[] memory scalingFactors
    ) private pure returns (uint256[] memory) {
        for (uint256 i = 0; i < amounts.length; i++) {
            // BUG: mulDown rounds down. At 8-9 wei, causes ~10% precision loss
            amounts[i] = FixedPoint.mulDown(amounts[i], scalingFactors[i]);
        }
        return amounts;
    }

    function _calculateInvariant(
        uint256[] memory balances,
        uint256[] memory scalingFactors,
        uint256 amplificationParameter
    ) internal pure returns (uint256) {
        // Precision loss from _upscaleArray propagates here
        uint256[] memory scaledBalances = _upscaleArray(balances, scalingFactors);
        
        // Invariant D is underestimated when rounding errors accumulate
        uint256 invariant = _computeStableInvariant(scaledBalances, amplificationParameter);
        
        // BUG: No validation that invariant change is within acceptable bounds
        return invariant;
    }

    function _computeStableInvariant(
        uint256[] memory balances,
        uint256 amp
    ) internal pure returns (uint256) {
        // Curve StableSwap invariant calculation
        // D represents total pool value
        // BPT price = D / totalSupply
        // When D is underestimated, BPT price drops artificially
        uint256 sum = 0;
        for (uint256 i = 0; i < balances.length; i++) {
            sum = sum + balances[i];
        }
        
        if (sum == 0) return 0;
        
        uint256 prevD;
        uint256 D = sum;
        uint256 nA = amp * balances.length;
        
        for (uint256 j = 0; j < 255; j++) {
            uint256 D_P = D;
            for (uint256 k = 0; k < balances.length; k++) {
                // BUG: Division here can compound rounding errors
                D_P = D_P * D / (balances[k] * balances.length);
            }
            prevD = D;
            D = (nA * sum + D_P * balances.length) * D / 
                ((nA - 1) * D + (balances.length + 1) * D_P);
            
            if (D > prevD) {
                if (D - prevD <= 1) break;
            } else {
                if (prevD - D <= 1) break;
            }
        }
        
        return D;
    }

    // WHAT WAS MISSING - Example fix:
    function _upscaleArraySafe(
        uint256[] memory amounts,
        uint256[] memory scalingFactors
    ) private pure returns (uint256[] memory) {
        for (uint256 i = 0; i < amounts.length; i++) {
            // FIX: Require minimum balance to prevent rounding exploitation
            require(amounts[i] >= 1e6, "Balance too small");
            amounts[i] = FixedPoint.mulDown(amounts[i], scalingFactors[i]);
        }
        return amounts;
    }
}
