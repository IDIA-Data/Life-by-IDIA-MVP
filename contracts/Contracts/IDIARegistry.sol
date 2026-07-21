// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IDIARegistry
 * @author IDIA Data Inc.
 * @notice Jurisdictional registry that maps location identifiers to their
 *         corresponding Localized Community Pool addresses.
 *
 * @dev The Synapse Engine (circular-settlement edge function) interrogates
 *      this registry to determine where the 10% "War Chest" fee routes.
 *      - If a location is registered → funds route to that pool.
 *      - If unregistered → caller falls back to the Global War Chest.
 *
 *      Location identifiers follow the format: "City_State_Country"
 *      (e.g., "Cincinnati_OH_US", "London_England_UK").
 *
 *      Only the Multi-sig (owner) can register or update pool mappings,
 *      enforcing the Constitutional constraint that humans provide metadata
 *      but cannot redirect treasury logic outside registered paths.
 */
contract IDIARegistry is Ownable {

    // ── Errors ──────────────────────────────────────────────
    error Registry__ZeroAddress();
    error Registry__EmptyLocation();
    error Registry__LocationNotRegistered(string location);

    // ── Events ──────────────────────────────────────────────
    event LocationRegistered(string indexed locationHash, string location, address pool);
    event LocationRemoved(string indexed locationHash, string location);
    event LocationUpdated(string indexed locationHash, string location, address oldPool, address newPool);

    // ── State ───────────────────────────────────────────────
    mapping(string => address) private _pools;
    string[] private _registeredLocations;
    mapping(string => uint256) private _locationIndex; // 1-indexed (0 = not present)

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert Registry__ZeroAddress();
    }

    // ── External: Read ──────────────────────────────────────

    /**
     * @notice Look up the pool address for a given location.
     * @dev Returns address(0) if the location is not registered.
     *      The caller (edge function) is responsible for fallback to
     *      the Global War Chest when address(0) is returned.
     * @param location The jurisdictional identifier (e.g., "Cincinnati_OH_US").
     */
    function getPoolByLocation(string calldata location)
        external view returns (address)
    {
        return _pools[location];
    }

    /**
     * @notice Check if a location is registered.
     */
    function isRegistered(string calldata location)
        external view returns (bool)
    {
        return _pools[location] != address(0);
    }

    /**
     * @notice Return count of registered locations.
     */
    function registeredCount() external view returns (uint256) {
        return _registeredLocations.length;
    }

    /**
     * @notice Return all registered location strings.
     * @dev Use for off-chain enumeration. May be gas-heavy on-chain
     *      for large registries — intended for view calls only.
     */
    function getAllLocations() external view returns (string[] memory) {
        return _registeredLocations;
    }

    // ── External: Write (Owner only) ────────────────────────

    /**
     * @notice Register a new location → pool mapping.
     * @param location The jurisdictional identifier.
     * @param pool     The deployed IDIA_LocalizedPool address.
     */
    function registerLocation(string calldata location, address pool)
        external onlyOwner
    {
        if (bytes(location).length == 0) revert Registry__EmptyLocation();
        if (pool == address(0)) revert Registry__ZeroAddress();

        address existing = _pools[location];
        if (existing != address(0)) {
            // Update existing
            emit LocationUpdated(location, location, existing, pool);
        } else {
            // New registration
            _registeredLocations.push(location);
            _locationIndex[location] = _registeredLocations.length; // 1-indexed
            emit LocationRegistered(location, location, pool);
        }

        _pools[location] = pool;
    }

    /**
     * @notice Batch-register multiple locations in a single transaction.
     * @param locations Array of location identifiers.
     * @param pools     Array of corresponding pool addresses.
     */
    function batchRegister(
        string[] calldata locations,
        address[] calldata pools
    ) external onlyOwner {
        require(locations.length == pools.length, "Length mismatch");
        for (uint256 i = 0; i < locations.length; i++) {
            if (bytes(locations[i]).length == 0) revert Registry__EmptyLocation();
            if (pools[i] == address(0)) revert Registry__ZeroAddress();

            if (_pools[locations[i]] == address(0)) {
                _registeredLocations.push(locations[i]);
                _locationIndex[locations[i]] = _registeredLocations.length;
                emit LocationRegistered(locations[i], locations[i], pools[i]);
            }
            _pools[locations[i]] = pools[i];
        }
    }

    /**
     * @notice Remove a location from the registry.
     * @param location The jurisdictional identifier to remove.
     */
    function removeLocation(string calldata location)
        external onlyOwner
    {
        if (_pools[location] == address(0)) {
            revert Registry__LocationNotRegistered(location);
        }

        delete _pools[location];

        // Swap-and-pop from the array
        uint256 idx = _locationIndex[location];
        if (idx > 0) {
            uint256 lastIdx = _registeredLocations.length;
            if (idx != lastIdx) {
                string memory lastLoc = _registeredLocations[lastIdx - 1];
                _registeredLocations[idx - 1] = lastLoc;
                _locationIndex[lastLoc] = idx;
            }
            _registeredLocations.pop();
            delete _locationIndex[location];
        }

        emit LocationRemoved(location, location);
    }
}
