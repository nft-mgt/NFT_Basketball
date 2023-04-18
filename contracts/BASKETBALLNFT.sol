// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract BASKETBALLNFT is ERC721AUpgradeable, OwnableUpgradeable {
    enum SetIndex {
        ModelChangeSeries,
        StarCard
    }

    enum RarityIndex {
        Legendary,
        Epic,
        Rare,
        Common
    }

    enum SeriesIndex {
        Basketball_frame_A,
        Basketball_frame_B,
        Bitcoin,
        Mini_Uniform,
        Anime_characters,
        Card_Box,
        Science_fiction,
        Dollars,
        Virtual_Sneakers,
        Figure_box,
        Monkeys,
        Switching_Card,
        Science_Card,
        Gold_Card,
        Card_Circles,
        Card_Red,
        Card_White
    }

    struct Attributes {
        uint8 set;
        uint8 rarity;
        uint32 player;
        uint8 series;
    }

    struct AirdropUser {
        Attributes[] attributes;
        uint256 amount;
        uint256[] tokenIDs;
        address receiver;
    }

    struct AirdropKOL {
        Attributes[] attributes;
        uint256 amount;
        address receiver;
    }

    uint256 public maxSupply;
    // vault
    address public vault;
    address public vaultForDrop;
    // airdrop
    mapping(uint256 => bool) public claimed;

    // reveal
    string public blindBoxBaseURI;
    uint256[] public stageIDs;
    mapping(uint256 => string) public revealedBaseURI;

    string[] public Set;
    string[] public Rarity;
    string[] public Series;
    uint32[] public Player;

    uint32[] public playerList;

    mapping(uint256 => Attributes) public attribute;
    // player => rarity => set => series => number
    mapping(uint32 => mapping(uint8 => mapping(uint8 => mapping(uint8 => uint32))))
        public cardNumber;

    // sell nft
    uint64 public saleStartTime;
    uint64 public saleEndTime;
    uint64 public timeoutLimit;
    uint64 public price; // 1 = 0.001 ether, 1000 = 1 ether
    mapping(uint256 => bool) public usedSalt;

    // swap switch
    uint128 public swapStartTime;
    uint128 public swapEndTime;
    // swap limit
    mapping(uint32 => uint32) public swapLimit;
    uint32 public constant SWAP_SERVING = 2124;
    uint32 public constant SWAP_TRANSFERRED = 2128;

    function initialize(
        string memory name,
        string memory symbol,
        address _vault,
        address _vaultForDrop
    ) public initializerERC721A initializer {
        __ERC721A_init(name, symbol);
        __Ownable_init();

        maxSupply = 10000;
        Set = ["Model Change", "Star Card"];
        Rarity = ["Legendary", "Epic", "Rare", "Common"];
        Series = [
            "Basketball_frame_A",
            "Basketball_frame_B",
            "Bitcoin",
            "Mini_Uniform",
            "Anime_characters",
            "Card_Box",
            "Science_fiction",
            "Dollars",
            "Virtual_Sneakers",
            "Figure_box",
            "Monkeys",
            "Switching_Card",
            "Science_Card",
            "Gold_Card",
            "Card_Circles",
            "Card_Red",
            "Card_White"
        ];
        // 210, 212, 213, 214, 215, 217, 2123, 2124 active players
        // 211, 218, 2110, 2128 transfer player (Can only be used for airdrops)
        Player = [
            210,
            212,
            213,
            214,
            215,
            217,
            2123,
            2124,
            211,
            218,
            2110,
            2128
        ];
        // 214 does not belong to this exchange reserve collection
        playerList = [210, 212, 213, 215, 217, 2123, 2124];

        vault = _vault;
        vaultForDrop = _vaultForDrop;

        for (uint256 i = 0; i < playerList.length; i++) {
            cardNumber[playerList[i]][uint8(RarityIndex.Rare)][
                uint8(SetIndex.StarCard)
            ][uint8(SeriesIndex.Gold_Card)] = 133;
        }
    }

    event BlindBoxOpen(uint256 tokenId, string baseURI);
    event ChangeBaseURI(uint256 tokenId, string baseURI);
    event Exchange(uint256 newTokenID, uint256 player, address sender);
    event MintBatch(uint256 firstTokenID, uint256 amount, address sender);
    event Claimed(uint256 airdropID, uint256[] tokenIDs);
    event Bought(
        address indexed user,
        uint256 indexed tokenId,
        uint256 indexed salt
    );

    /* --------------- swap --------------- */

    /// @notice The user uses any 3 Star Card Set and common NFTs and 1 transfer player NFT to replace any Rare NFT.
    /// @dev A player will be randomly selected from the Player as the NFT player attribute.
    /// @dev If a player's NFT is exhausted, the player will be skipped.
    /// @dev Approve is not required because there is no external call, msg.sender is owner of NFT.
    /// @param payTokenIDs 3 common NFTs's tokenIDs
    /// @param payDropTokenID transfer player NFT's tokenID
    function exchange(
        uint256[] calldata payTokenIDs,
        uint256 payDropTokenID
    ) public {
        require(
            block.timestamp >= swapStartTime && block.timestamp <= swapEndTime,
            "time error"
        );
        require(
            swapLimit[SWAP_SERVING] != 0 || swapLimit[SWAP_TRANSFERRED] != 0,
            "swap card used out"
        );
        uint256 length = payTokenIDs.length;
        require(length == 3, "param length error");
        // Transfer Player NFT Verification
        uint32 player = attribute[payDropTokenID].player;
        require(
            (player == 211 ||
                player == 218 ||
                player == 2110 ||
                player == 2128) &&
                attribute[payDropTokenID].set == uint8(SetIndex.StarCard) &&
                attribute[payDropTokenID].rarity == uint8(RarityIndex.Common),
            "drop error"
        );
        for (uint256 i = 0; i < length; i++) {
            // must be common and StarCard NFT
            require(
                attribute[payTokenIDs[i]].set == uint8(SetIndex.StarCard) &&
                    attribute[payTokenIDs[i]].rarity ==
                    uint8(RarityIndex.Common),
                "pay token error"
            );
            transferFrom(msg.sender, vault, payTokenIDs[i]);
        }
        transferFrom(msg.sender, vaultForDrop, payDropTokenID);

        // Pick a player at random
        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    blockhash(block.number - 1),
                    payDropTokenID,
                    msg.sender
                )
            )
        );

        // transferred NFT -> 2128 | active NFT -> 2124(only for swap)
        uint256 index = randomNumber % 2;
        uint32 plyer;
        if (index == 0) {
            // serving nft
            if (swapLimit[SWAP_SERVING] != 0) {
                plyer = SWAP_SERVING;
                swapLimit[SWAP_SERVING]--;
            } else {
                plyer = SWAP_TRANSFERRED;
                swapLimit[SWAP_TRANSFERRED]--;
            }
        } else {
            // transferred nft
            if (swapLimit[SWAP_TRANSFERRED] != 0) {
                plyer = SWAP_TRANSFERRED;
                swapLimit[SWAP_TRANSFERRED]--;
            } else {
                plyer = SWAP_SERVING;
                swapLimit[SWAP_SERVING]--;
            }
        }

        uint256 tokenID = totalSupply();
        attribute[tokenID] = Attributes({
            set: uint8(SetIndex.StarCard),
            rarity: uint8(RarityIndex.Rare),
            player: plyer,
            series: uint8(SeriesIndex.Gold_Card)
        });

        // mint
        _safeMint(msg.sender, 1);
        emit Exchange(tokenID, plyer, msg.sender);
    }

    function setSwapTime(uint128 startTime, uint128 endTime) public onlyOwner {
        swapStartTime = startTime;
        swapEndTime = endTime;
    }

    function setSwapLimit(uint32 transferred, uint32 serving) public onlyOwner {
        swapLimit[SWAP_TRANSFERRED] = transferred;
        swapLimit[SWAP_SERVING] = serving;
    }

    function setVaults(
        address _vaultForActivity,
        address _vaultForDrop
    ) public onlyOwner {
        vault = _vaultForActivity;
        vaultForDrop = _vaultForDrop;
    }

    /* --------------- airdrop --------------- */

    /// @notice According to the NFT data held by the users, the project party subjectively distributes the airdrop to user. Users must hold NFTs that have not been airdropped.
    /// @dev The smaller index in attributes, the smaller the minted NFT's tokenID corresponding to the element.
    /// @param dropData Airdrop data.
    function airdropToUser(
        uint256 airdropID,
        AirdropUser[] calldata dropData
    ) public onlyOwner {
        require(dropData.length <= 50, "to much drop");
        uint256 leng;
        for (uint256 i; i < dropData.length; i++) {
            leng += dropData[i].tokenIDs.length;
        }
        uint256[] memory claimedTokenIDs = new uint256[](leng);
        uint256 len;

        for (uint256 i; i < dropData.length; i++) {
            AirdropUser memory data = dropData[i];
            require(data.attributes.length == data.amount, "param error");
            require(data.tokenIDs.length != 0, "tokenIDs error");
            for (uint256 j; j < data.tokenIDs.length; j++) {
                require(
                    ownerOf(data.tokenIDs[j]) == data.receiver,
                    "receiver is not owner of the tokenID"
                );
                claimedTokenIDs[len] = data.tokenIDs[j];
                len++;
            }
            uint256 totalSupply_ = totalSupply();
            for (uint256 j; j < data.amount; j++) {
                attribute[totalSupply_ + j] = data.attributes[j];
            }
            _safeMint(data.receiver, data.amount);
        }
        emit Claimed(airdropID, claimedTokenIDs);
    }

    /// @notice The project party subjectively distributes the airdrop to KOL.
    /// @dev The average number of airdrops per KOL does not exceed 5 because of the block gas limit.
    /// @param dropData Airdrop data.
    function airdropToKOL(AirdropKOL[] calldata dropData) public onlyOwner {
        require(dropData.length <= 50, "to much drop");
        for (uint256 i; i < dropData.length; i++) {
            AirdropKOL memory data = dropData[i];
            require(data.attributes.length == data.amount, "param error");

            uint256 totalSupply_ = totalSupply();
            for (uint256 j; j < data.amount; j++) {
                attribute[totalSupply_ + j] = data.attributes[j];
            }
            _safeMint(data.receiver, data.amount);
        }
    }

    /* --------------- binance --------------- */

    /// @notice The project party mint batch NFTs to binance.
    /// @param amount The number of NFTs minted.
    /// @param receiver Binance's address for receiving NFTs.
    function mintBatch(uint256 amount, address receiver) public onlyOwner {
        uint256 firstTokenID = totalSupply();
        _safeMint(receiver, amount);
        emit MintBatch(firstTokenID, amount, receiver);
    }

    /* --------------- nft card parameters --------------- */

    /// @notice The owner reset playerList for new exchange rule.
    /// @param playerList_ New playerList value.
    function setPlayerList(uint32[] calldata playerList_) public onlyOwner {
        playerList = playerList_;
    }

    /* --------------- mint --------------- */
    /// @notice This method can buy nft
    /// @dev nft can only be purchased if block.timestamp is between saleStartTime and saleEndTime
    /// @param _salt Used to bind tokenId, need to confirm metadata information through _salt
    /// @dev _salt : uint256(bytes16(time) + bytes16(random))
    function buy(uint256 _salt, Attributes calldata attr) external payable {
        address sender_ = _msgSender();
        require(block.timestamp >= saleStartTime, "Not Started");
        require(block.timestamp <= saleEndTime, "End of sale");
        uint256 timestamp_ = uint256(uint128(bytes16(bytes32(_salt))));
        uint256 minimum;
        unchecked {
            minimum = block.timestamp - timeoutLimit;
        }
        // Time out
        require(minimum <= timestamp_, "Time out");
        require(
            timestamp_ <= block.timestamp + 60,
            "Timestamp exceeds block.timestamp"
        );
        require(msg.value == uint256(price) * 1e15, "Invalid amount");
        require(tx.origin == sender_, "Invalid sender");
        require(!usedSalt[_salt], "Salt has been used");

        uint256 tokenID = totalSupply();
        _safeMint(sender_, 1);
        usedSalt[_salt] = true;
        attribute[tokenID] = attr;
        emit Bought(sender_, tokenID, _salt);
    }

    function setMintParams(
        uint64 saleStartTime_,
        uint64 saleEndTime_,
        uint64 timeoutLimit_,
        uint64 price_
    ) public onlyOwner {
        saleStartTime = saleStartTime_;
        saleEndTime = saleEndTime_;
        timeoutLimit = timeoutLimit_;
        price = price_;
    }

    /* --------------- owner config --------------- */
    function setSet(uint256 index, string memory value) public onlyOwner {
        Set[index] = value;
    }

    function setRarity(uint256 index, string memory value) public onlyOwner {
        Rarity[index] = value;
    }

    function setSeries(uint256 index, string memory value) public onlyOwner {
        Series[index] = value;
    }

    function setPlayer(uint256 index, uint32 value) public onlyOwner {
        Player[index] = value;
    }

    /* --------------- reveal --------------- */

    /// @notice When opening the blind box, the owner sets the properties of the NFT.
    /// @dev The length of the two parameters must be the same and cannot exceed 200.
    /// @param tokenIDs The TokenID of the NFT to be set.
    /// @param attributes The attributes of the NFT to be set.
    function setAttributes(
        uint256[] calldata tokenIDs,
        Attributes[] calldata attributes
    ) public onlyOwner {
        require(tokenIDs.length <= 200, "too much params");
        require(tokenIDs.length == attributes.length, "params length error");
        for (uint256 i = 0; i < tokenIDs.length; i++) {
            attribute[tokenIDs[i]] = attributes[i];
        }
    }

    /// @notice Get the properties of the NFT and display it in a human readable form.
    /// @param tokenID The tokenID of the NFT to be queried.
    function getTokenAttributes(
        uint256 tokenID
    )
        public
        view
        returns (string memory set, string memory rarity, string memory series)
    {
        Attributes memory attr = attribute[tokenID];
        return (Set[attr.set], Rarity[attr.rarity], Series[attr.series]);
    }

    /// @notice The owner set blindbox baseURI.
    function setBlindBoxURI(string memory _blindBoxBaseURI) public onlyOwner {
        blindBoxBaseURI = _blindBoxBaseURI;
    }

    /// @notice Open blind boxes in batches. Each time it is called, (${id last call}, id] baseURI is set.
    /// @param id The maximum tokenID currently opened.
    /// @param baseURI_ The baseURI of the latest set interval.
    function setBaseURI(uint256 id, string memory baseURI_) public onlyOwner {
        uint256 len = stageIDs.length;
        if (len == 0) {
            stageIDs.push(id);
        } else if (id > stageIDs[len - 1]) {
            stageIDs.push(id);
        } else {
            uint256 i; // index for new id
            for (i = len - 1; i >= 0; i--) {
                require(id != stageIDs[i], "same stageID error");
                if ((i != 0 && id > stageIDs[i - 1]) || i == 0) break;
            }
            // push lastest element
            stageIDs.push(stageIDs[len - 1]);
            // move other element
            for (uint256 j = len - 1; j > i; j--) {
                stageIDs[j] = stageIDs[j - 1];
            }
            // insert new element
            stageIDs[i] = id;
        }
        revealedBaseURI[id] = baseURI_;
        emit BlindBoxOpen(id, baseURI_);
    }

    /// @notice Used to modify the wrong parameters passed in by setBaseURI.
    function changeURI(uint256 id, string memory baseURI_) public onlyOwner {
        require(
            bytes(revealedBaseURI[id]).length != 0,
            "URI corresponding to id should not be empty"
        );
        revealedBaseURI[id] = baseURI_;
        emit ChangeBaseURI(id, baseURI_);
    }

    /// @notice Query the URI of NFT metadata, which conforms to the ERC721 protocol.
    /// @dev Because the baseURI of each interval where the tokenID is located is different, the binary search method is used here to improve the query efficiency.
    /// @dev Except for 0, tokenIDs are divided in the way of opening and closing before, eg: (x,y].
    /// @param tokenId The tokenID of the NFT to be queried.
    /// @return The URI of the NFT to be queried.
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_exists(tokenId), "token id is not exist.");
        string memory baseURI_;
        uint256 len = stageIDs.length;
        // binary search
        if (len == 0) {
            baseURI_ = blindBoxBaseURI;
        } else {
            uint256 left;
            uint256 right = len - 1;

            // (x,y]
            for (; left <= right; ) {
                uint256 midIndex = (left + right) / 2;
                if (midIndex == 0) {
                    if (tokenId <= stageIDs[0]) {
                        baseURI_ = revealedBaseURI[stageIDs[0]];
                        break;
                    } else if (len == 1) {
                        baseURI_ = blindBoxBaseURI;
                        break;
                    } else {
                        if (tokenId <= stageIDs[1]) {
                            baseURI_ = revealedBaseURI[stageIDs[1]];
                            break;
                        } else {
                            baseURI_ = blindBoxBaseURI;
                            break;
                        }
                    }
                }

                if (tokenId <= stageIDs[midIndex]) {
                    if (tokenId > stageIDs[midIndex - 1]) {
                        baseURI_ = revealedBaseURI[stageIDs[midIndex]];
                        break;
                    }
                    right = midIndex - 1;
                } else {
                    left = midIndex;
                    if (midIndex == right - 1) {
                        if (tokenId > stageIDs[right]) {
                            baseURI_ = blindBoxBaseURI;
                            break;
                        }
                        left = right;
                    }
                }
            }
        }

        return
            bytes(baseURI_).length > 0
                ? string(abi.encodePacked(baseURI_, _toString(tokenId)))
                : string(abi.encodePacked(blindBoxBaseURI, _toString(tokenId)));
    }

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal override {
        if (from == address(0)) {
            require(
                totalSupply() + quantity <= maxSupply,
                "exceeded maximum supply"
            );
        }
    }

    function setMaxSupply(uint256 maxSupply_) public onlyOwner {
        maxSupply = maxSupply_;
    }
    /* --------------- modifiers --------------- */
}
