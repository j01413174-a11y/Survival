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

    event TokensPurchased(address indexed buyer, uint256 amountSpent, uint256 tokensReceived);
    event RateUpdated(uint256 oldRate, uint256 newRate);

    constructor(uint256 _initialSupply, uint256 _initialRate) 
        ERC20("Survival Gold Coin", "SGC") 
        Ownable(msg.sender) 
    {
        _mint(msg.sender, _initialSupply * 10 ** decimals());
        buyRate = _initialRate;
    }

    /**
     * @dev Sets a new exchange rate.
     */
    function setBuyRate(uint256 _newRate) external onlyOwner {
        emit RateUpdated(buyRate, _newRate);
        buyRate = _newRate;
    }

    /**
     * @dev Mint new SGC tokens. Reserved for authorized game backend / mechanics.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Purchase tokens directly with Ether / MATIC.
     */
    function purchaseTokens() external payable whenNotPaused {
        require(msg.value > 0, "Must send native currency to purchase");
        uint256 tokensToReceive = msg.value * buyRate;
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
