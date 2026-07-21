// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IDIA_LocalizedPool.sol";
import "./IDIARegistry.sol";

/**
 * @title IDIAPoolFactory
 * @author IDIA Data Inc.
 * @notice Factory contract that deploys IDIA_LocalizedPool instances and
 *         automatically registers them in the IDIARegistry.
 *
 * @dev Ensures deterministic pool creation:
 *      1. Deploy a new IDIA_LocalizedPool for the given location.
 *      2. Register the pool address in the IDIARegistry.
 *      3. Return the pool address for off-chain reference.
 *
 *      The factory must be the owner of the Registry (or have been granted
 *      registration rights) to auto-register pools.
 */
contract IDIAPoolFactory is Ownable {

    // ── Errors ──────────────────────────────────────────────
    error Factory__ZeroAddress();
    error Factory__LocationAlreadyDeployed(string location);

    // ── Events ──────────────────────────────────────────────
    event PoolDeployed(
        string indexed locationHash,
        string location,
        address pool,
        address owner
    );

    // ── State ───────────────────────────────────────────────
    IERC20 public immutable idiaToken;
    IDIARegistry public immutable registry;

    /// @notice Maps location string → deployed pool address
    mapping(string => address) public deployedPools;
    /// @notice All deployed pool addresses (for enumeration)
    address[] public allPools;

    constructor(
        address _idiaToken,
        address _registry,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_idiaToken == address(0)) revert Factory__ZeroAddress();
        if (_registry == address(0)) revert Factory__ZeroAddress();

        idiaToken = IERC20(_idiaToken);
        registry = IDIARegistry(_registry);
    }

    // ── External ────────────────────────────────────────────

    /**
     * @notice Deploy a new localized pool for a jurisdiction.
     * @param location   The jurisdictional identifier (e.g., "Cincinnati_OH_US").
     * @param poolOwner  The address that will control the pool
     *                   (Multi-sig or regional Governor).
     * @return pool      The address of the newly deployed pool.
     */
    function deployPool(string calldata location, address poolOwner)
        external onlyOwner
        returns (address pool)
    {
        if (poolOwner == address(0)) revert Factory__ZeroAddress();
        if (deployedPools[location] != address(0)) {
            revert Factory__LocationAlreadyDeployed(location);
        }

        // Deploy the pool
        IDIA_LocalizedPool newPool = new IDIA_LocalizedPool(
            location,
            address(idiaToken),
            poolOwner
        );

        pool = address(newPool);
        deployedPools[location] = pool;
        allPools.push(pool);

        // Auto-register in the registry
        registry.registerLocation(location, pool);

        emit PoolDeployed(location, location, pool, poolOwner);
    }

    /**
     * @notice Batch-deploy pools for multiple locations.
     * @param locations  Array of jurisdictional identifiers.
     * @param poolOwners Array of owner addresses (one per pool).
     * @return pools     Array of deployed pool addresses.
     */
    function batchDeployPools(
        string[] calldata locations,
        address[] calldata poolOwners
    ) external onlyOwner returns (address[] memory pools) {
        require(locations.length == poolOwners.length, "Length mismatch");
        pools = new address[](locations.length);

        for (uint256 i = 0; i < locations.length; i++) {
            if (poolOwners[i] == address(0)) revert Factory__ZeroAddress();
            if (deployedPools[locations[i]] != address(0)) {
                revert Factory__LocationAlreadyDeployed(locations[i]);
            }

            IDIA_LocalizedPool newPool = new IDIA_LocalizedPool(
                locations[i],
                address(idiaToken),
                poolOwners[i]
            );

            pools[i] = address(newPool);
            deployedPools[locations[i]] = pools[i];
            allPools.push(pools[i]);

            registry.registerLocation(locations[i], pools[i]);

            emit PoolDeployed(locations[i], locations[i], pools[i], poolOwners[i]);
        }
    }

    /**
     * @notice Total number of deployed pools.
     */
    function poolCount() external view returns (uint256) {
        return allPools.length;
    }
}
