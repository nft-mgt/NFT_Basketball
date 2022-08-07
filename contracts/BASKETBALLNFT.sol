// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC721AStorage} from "erc721a-upgradeable/contracts/ERC721AStorage.sol";

contract BASKETBALLNFT is ERC721AUpgradeable, OwnableUpgradeable {
    using ERC721AStorage for ERC721AStorage.Layout;

    struct BatchConfig {
        uint256 startID;
        uint256 endID;
        uint256 price;
        uint64 startTime;
        uint64 endTime;
        uint64 amountPerUser;
        bool forPublic;
    }

    //  receive ETH
    address public copyright;
    address public project;

    uint64 public maxSupply;

    // reveal
    string private baseURI;
    string public blindBoxBaseURI;
    string private contractURI_;
    uint256[] public stageIDs;
    mapping(uint256 => string) public revealedBaseURI;

    // wl
    mapping(address => bool) public whitelistNoBatch;
    // batch index => user address => ok
    mapping(uint256 => mapping(address => bool)) public whitelist;

    // batch index => config
    mapping(uint256 => BatchConfig) public batchConfigs;
    // batch index => current tokenID
    mapping(uint256 => uint256) public batchCurrentTokenID;
    // user address => batch index => minted amount
    mapping(address => mapping(uint256 => uint64)) public minted;

    function initialize() public initializerERC721A initializer {
        __ERC721A_init("Binance Regular NFT", "BRNFT");
        __Ownable_init();
    }

    function adminMint(uint256 quantity, address reciever)
        external
        payable
        onlyOwner
    {
        _mint(reciever, quantity);
    }

    function setNameSymbol(string calldata name_, string calldata symbol_)
        external
        onlyOwner
    {
        ERC721AStorage.layout()._name = name_;
        ERC721AStorage.layout()._symbol = symbol_;
    }

    /* --------------- ETH receiver --------------- */

    function setProject(address _project) public onlyOwner {
        project = _project;
    }

    function setCopyright(address _copyright) public onlyOwner {
        copyright = _copyright;
    }

    // copyrights 5% and project 95%
    function withdraw() public {
        require(
            msg.sender == copyright || msg.sender == project,
            "have no rights do this"
        );
        // TODO: Proportion
        uint256 copyrights = (address(this).balance * 5) / 100;
        payable(project).transfer(address(this).balance - copyrights);
        payable(copyright).transfer(copyrights);
    }
}
