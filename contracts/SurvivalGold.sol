// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SurvivalGold
 * @dev ERC20 token representing the in-game currency "Survival Gold Coin" (SGC).
 * Supports public purchasing using native blockchain currency (ETH/MATIC) and authorized gaming engine minting.
 */
contract SurvivalGold is ERC20, ERC20Burnable, Pausable, Ownable {
    // Exchange rate: How many SGC tokens per 1 Native Coin (Wei)
    // E.g., if rate is 100,000, then 1 ETH/MATIC buys 100,000 SGC (scaled by 18 decimals)
    uint256 public buyRate;
    
    // Maximum total supply cap
    uint256 public maxSupply;
    
    // Authorized minters (gaming engine backend)
    mapping(address => bool) public authorizedMinters;

    event TokensPurchased(address indexed buyer, uint256 amountSpent, uint256 tokensReceived);
    event RateUpdated(uint256 oldRate, uint256 newRate);
    event AuthorizedMinterUpdated(address indexed minter, bool authorized);

    constructor(uint256 _initialSupply, uint256 _initialRate) 
        ERC20("Survival Gold Coin", "SGC") 
        Ownable(msg.sender) 
    {
        require(_initialSupply > 0, "Initial supply must be greater than 0");
        require(_initialRate > 0, "Initial rate must be greater than 0");
        
        uint256 initialAmount = _initialSupply * 10 ** decimals();
        maxSupply = initialAmount;
        _mint(msg.sender, initialAmount);
        buyRate = _initialRate;
        
        // Owner is an authorized minter by default
        authorizedMinters[msg.sender] = true;
    }

    /**
     * @dev Sets a new exchange rate.
     */
    function setBuyRate(uint256 _newRate) external onlyOwner {
        require(_newRate > 0, "Rate must be greater than 0");
        emit RateUpdated(buyRate, _newRate);
        buyRate = _newRate;
    }

    /**
     * @dev Authorize or revoke minting permissions for an address.
     */
    function setAuthorizedMinter(address _minter, bool _authorized) external onlyOwner {
        require(_minter != address(0), "Invalid minter address");
        authorizedMinters[_minter] = _authorized;
        emit AuthorizedMinterUpdated(_minter, _authorized);
    }

    /**
     * @dev Mint new SGC tokens. Reserved for authorized game backend / mechanics.
     */
    function mint(address to, uint256 amount) external {
        require(authorizedMinters[msg.sender], "Not authorized to mint");
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @dev Purchase tokens directly with Ether / MATIC.
     * Correctly handles decimal scaling for token amount calculation.
     */
    function purchaseTokens() external payable whenNotPaused {
        require(msg.value > 0, "Must send native currency to purchase");
        
        // Calculate tokens with proper decimal scaling: (native amount * rate) / 10^18
        uint256 tokensToReceive = (msg.value * buyRate) / (10 ** decimals());
        require(tokensToReceive > 0, "Purchase amount too small for current rate");
        require(totalSupply() + tokensToReceive <= maxSupply, "Exceeds max supply");
        
        _mint(msg.sender, tokensToReceive);
        emit TokensPurchased(msg.sender, msg.value, tokensToReceive);
    }

    /**
     * @dev Allows the owner to withdraw the collected native currency from the contract.
     */
    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
