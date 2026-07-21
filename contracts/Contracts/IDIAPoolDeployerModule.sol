// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDIAPoolDeployerModule
 * @author IDIA Data Inc.
 *
 * @dev Gnosis Safe Module that allows authorized operators (the relayer)
 *      to deploy localized pools through the existing PoolFactory WITHOUT
 *      requiring a multisig approval for each deployment.
 *
 *      How it works:
 *        1. Safe enables this module: safe.enableModule(thisAddress)
 *        2. Safe grants OPERATOR to the relayer: authorizeOperator(relayer)
 *        3. Relayer calls deployPoolForLocation("Louisville-KY-US")
 *        4. This module calls safe.execTransactionFromModule(...)
 *        5. Safe calls poolFactory.deployPool(location, safe) as msg.sender
 *        6. PoolFactory sees the Safe as caller → onlyOwner passes
 *        7. Pool is deployed and registered in the Registry
 *
 *      Security:
 *        - Operators can ONLY deploy pools. No other Safe action is possible.
 *        - Pool owner is ALWAYS forced to the Safe. Operators cannot set
 *          arbitrary owners.
 *        - The Safe can revoke the operator at any time.
 *        - The Safe can disable the module entirely at any time.
 *
 * Compiler: 0.8.24, cancun, optimization 200
 */

interface IGnosisSafe {
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation // 0 = Call, 1 = DelegateCall
    ) external returns (bool success);
}

interface IPoolFactory {
    function deployPool(string calldata location, address poolOwner)
        external returns (address pool);
    function deployedPools(string calldata location)
        external view returns (address);
}

contract IDIAPoolDeployerModule {

    // ── Errors ──────────────────────────────────────────────
    error NotSafe();
    error NotAuthorized();
    error ZeroAddress();
    error PoolAlreadyExists(string location);
    error ModuleExecutionFailed();
    error Paused();

    // ── Events ──────────────────────────────────────────────
    event PoolDeployedViaModule(string location, address operator);
    event OperatorAuthorized(address indexed operator);
    event OperatorRevoked(address indexed operator);
    event ModulePaused();
    event ModuleUnpaused();

    // ── State ───────────────────────────────────────────────

    IGnosisSafe public immutable safe;
    IPoolFactory public immutable poolFactory;

    mapping(address => bool) public authorizedOperators;
    bool public paused;

    // ── Constructor ─────────────────────────────────────────

    constructor(address _safe, address _poolFactory) {
        if (_safe == address(0) || _poolFactory == address(0)) revert ZeroAddress();
        safe = IGnosisSafe(_safe);
        poolFactory = IPoolFactory(_poolFactory);
    }

    modifier onlySafe() {
        if (msg.sender != address(safe)) revert NotSafe();
        _;
    }

    modifier onlyOperator() {
        if (!authorizedOperators[msg.sender] && msg.sender != address(safe)) revert NotAuthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    // ── Operator Management (Safe only) ─────────────────────

    function authorizeOperator(address operator) external onlySafe {
        if (operator == address(0)) revert ZeroAddress();
        authorizedOperators[operator] = true;
        emit OperatorAuthorized(operator);
    }

    function revokeOperator(address operator) external onlySafe {
        authorizedOperators[operator] = false;
        emit OperatorRevoked(operator);
    }

    function pause() external onlySafe { paused = true; emit ModulePaused(); }
    function unpause() external onlySafe { paused = false; emit ModuleUnpaused(); }

    // ── Pool Deployment (Operator or Safe) ──────────────────

    /**
     * @notice Deploy a localized pool for a new location.
     * @param location  Jurisdictional identifier (e.g., "Louisville-KY-US")
     *
     * @dev The pool owner is ALWAYS the Safe — operators cannot override this.
     *      The module encodes the call to poolFactory.deployPool(location, safe)
     *      and executes it through the Safe, so msg.sender at the PoolFactory
     *      is the Safe address (passes onlyOwner check).
     */
    function deployPoolForLocation(string calldata location) external onlyOperator whenNotPaused {
        // Pre-check: don't waste gas if pool already exists
        address existing = poolFactory.deployedPools(location);
        if (existing != address(0)) revert PoolAlreadyExists(location);

        // Encode the call: poolFactory.deployPool(location, safe)
        bytes memory callData = abi.encodeWithSelector(
            IPoolFactory.deployPool.selector,
            location,
            address(safe) // Pool owner is always the Safe
        );

        // Execute through the Safe — to the PoolFactory, msg.sender = Safe
        bool success = safe.execTransactionFromModule(
            address(poolFactory),
            0,          // no ETH value
            callData,
            0           // Call (not DelegateCall)
        );

        if (!success) revert ModuleExecutionFailed();

        emit PoolDeployedViaModule(location, msg.sender);
    }
}
