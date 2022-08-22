// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a-upgradeable/contracts/IERC721AUpgradeable.sol";

contract TestSell  {
    address public nft;
    address public vault;

    constructor(address _nft,address _vault){
        nft = _nft;
        vault = _vault;
    }

    /* --------------- sell --------------- */
    function sellExchanged(uint256 tokenID) public payable {
        // require(msg.value >= 1, "Not enough ETH");
        IERC721AUpgradeable(nft).transferFrom(address(vault), msg.sender, tokenID);
    }
}