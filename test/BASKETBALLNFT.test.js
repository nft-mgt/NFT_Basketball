const hre = require("hardhat");
const { currentTime, getEthBalance, fastForward } = require('./utils')();
const { assert } = require('./common');
const { utils, Wallet, BigNumber, toBigNumber } = require("ethers") ;

describe("BASKETBALLNFT", async function () {
	let basketball_nft, testsell;

	let owner, copyright, project, user1, user2, vault, vaultDrop;

	/* --------- constructor args --------- */
	const symbol = "DFK";
	const name = "Dragramflies Hiroshima";
	const DAY = 86400;
	// define enum
	const SetIndex = {
		"ModelChangeSeries": 0,
		"StarCard": 1
	}
	const RarityIndex = {
		"Legendary": 0,
		"Epic": 1,
		"Rare": 2,
		"Common": 3
	}
	const SeriesIndex = {
		"Basketball_frame_A": 0,
		"Basketball_frame_B": 1,
		"Bitcoin": 2,
		"Mini_Uniform": 3,
		"Anime_characters": 4,
		"Card_Box": 5,
		"Science_fiction": 6,
		"Dollars": 7,
		"Virtual_Sneakers": 8,
		"Figure_box": 9,
		"Monkeys": 10,
		"Switching_Card": 11,
		"Science_Card": 12,
		"Gold_Card": 13,
		"Card_Circles": 14,
		"Card_Red": 15,
		"Card_White": 16,
	}

	beforeEach(async function () {
		[owner, copyright, project, user1, user2, vault, vaultDrop] = await hre.ethers.getSigners();

		// basketball_nft
		const BASKETBALLNFT = await hre.ethers.getContractFactory("BASKETBALLNFT");
		basketball_nft = await hre.upgrades.deployProxy(BASKETBALLNFT, [name, symbol, vault.address, vaultDrop.address]);
		await basketball_nft.deployed();

		// test sell
		const TestSell = await hre.ethers.getContractFactory("TestSell");
		testsell = await TestSell.deploy(basketball_nft.address, vault.address);
		await testsell.deployed();
	});

	it('constructor should be success: ', async () => {
		assert.equal(await basketball_nft.name(), name);
		assert.equal(await basketball_nft.symbol(), symbol);

		// assert.equal(await basketball_nft.copyright(), copyright.address);
		// assert.equal(await basketball_nft.project(), project.address);
	});

	it('mintBatch test', async () => {
		await assert.revert(basketball_nft.connect(user1).mintBatch(100, user1.address), "Ownable: caller is not the owner");
		await basketball_nft.connect(owner).mintBatch(100, user2.address);
		assert.equal(await basketball_nft.balanceOf(user2.address), 100);
	})
	/* ------------ buy ------------ */
	it('setMintParams test', async () => {
		const startTime = await currentTime();
		const endTime = startTime + 3600;
		const timeoutLimit = 600;
		const price = 1000000;
		await assert.revert(basketball_nft.connect(user1).setMintParams(
			startTime,endTime,timeoutLimit,price), "Ownable: caller is not the owner");
		await basketball_nft.connect(owner).setMintParams(
			startTime,endTime,timeoutLimit,price);
		assert.equal(await basketball_nft.saleStartTime(), startTime);
		assert.equal(await basketball_nft.saleEndTime(), endTime);
		assert.equal(await basketball_nft.timeoutLimit(), timeoutLimit);
		assert.equal(await basketball_nft.price(), price);
	})

	it('buy test', async () => {
		let startTime = await currentTime();
		let endTime = startTime + 3600;
		const timeoutLimit = 600;
		const price = 1000;

    const salt1 = getSalt(Math.floor(Date.now() / 1000));
		const attr = [1,1,1,1];
		await assert.revert(basketball_nft.connect(user1).buy(salt1, attr,{value: 0}), "End of sale");
		
		await basketball_nft.connect(owner).setMintParams(endTime, endTime, timeoutLimit, price);
		await assert.revert(basketball_nft.connect(user1).buy(salt1, attr,{value: 0}), "Not Started");

		await basketball_nft.connect(owner).setMintParams(startTime, endTime, timeoutLimit, price);
		await fastForward(timeoutLimit + 100);
		await assert.revert(basketball_nft.connect(user1).buy(salt1, attr,{value: 0}), "Time out");

		startTime = await currentTime();
		endTime = startTime + 3600;
		await basketball_nft.connect(owner).setMintParams(startTime, endTime, timeoutLimit, price);

    const salt2 = getSalt(startTime + 100);
		await assert.revert(basketball_nft.connect(user1).buy(salt2, attr,{value: 0}), "Timestamp exceeds block.timestamp");

		const salt3 = getSalt(startTime);
		await assert.revert(basketball_nft.connect(user1).buy(salt3, attr,{value: 0}), "Invalid amount");

		await basketball_nft.connect(user1).buy(salt3, attr,{value: utils.parseEther("1")});
		await assert.revert(basketball_nft.connect(user1).buy(salt3, attr,{value: utils.parseEther("1")}), "Salt has been used");

		// console.log(await basketball_nft.totalSupply());
	})

	function getSalt(timestamp) {
		return BigNumber.from(
			BigNumber.from(timestamp).toHexString() +
				"xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
					const r = (Math.random() * 16) | 0;
					const v = c === "x" ? r : (r & 0x3) | 0x8;
					return v.toString(16);
				})
		);
	}

	/* ------------ airdrop ------------ */
	it('airdropToUser test', async () => {
		const airdropID = 1;
		const attributes = [[0, 3, 210, SeriesIndex.Gold_Card], [1, 1, 215, SeriesIndex.Gold_Card], [0, 2, 2124, SeriesIndex.Gold_Card]];
		const amount = 3;
		const amountErr = 4;
		const tokenIDs = [0, 1, 2];
		const tokenIDsUser2 = [3, 4, 5];
		let dropData = [attributes, amount, tokenIDs, user1.address];
		let dropDataUser2 = [attributes, amount, tokenIDsUser2, user2.address];

		// mint some nft to user
		await basketball_nft.connect(owner).mintBatch(3, user1.address);
		await basketball_nft.connect(owner).mintBatch(3, user2.address);

		await assert.revert(basketball_nft.connect(user1).airdropToUser(airdropID, [dropData, dropDataUser2]), "Ownable: caller is not the owner");

		dropData[1] = amountErr;
		await assert.revert(basketball_nft.connect(owner).airdropToUser(airdropID, [dropData, dropDataUser2]), "param error");
		dropData[1] = amount;

		dropData[2] = [];
		await assert.revert(basketball_nft.connect(owner).airdropToUser(airdropID, [dropData, dropDataUser2]), "tokenIDs error");

		dropData[2] = tokenIDsUser2;
		await assert.revert(basketball_nft.connect(owner).airdropToUser(airdropID, [dropData, dropDataUser2]), "receiver is not owner of the tokenID");
		dropData[2] = tokenIDs;

		await basketball_nft.connect(owner).airdropToUser(airdropID, [dropData, dropDataUser2]);
		assert.equal(await basketball_nft.balanceOf(user1.address), amount + 3);
		assert.equal(await basketball_nft.ownerOf(6), user1.address);
		assert.equal(await basketball_nft.ownerOf(7), user1.address);
		assert.equal(await basketball_nft.ownerOf(8), user1.address);
		assert.equal(await basketball_nft.balanceOf(user2.address), amount + 3);
		assert.equal(await basketball_nft.ownerOf(9), user2.address);
		assert.equal(await basketball_nft.ownerOf(10), user2.address);
		assert.equal(await basketball_nft.ownerOf(11), user2.address);

		assert.deepEqual(await basketball_nft.attribute(6), [0, 3, 210]);
		assert.deepEqual(await basketball_nft.attribute(7), [1, 1, 215]);
		assert.deepEqual(await basketball_nft.attribute(8), [0, 2, 2124]);
		assert.deepEqual(await basketball_nft.attribute(9), [0, 3, 210]);
		assert.deepEqual(await basketball_nft.attribute(10), [1, 1, 215]);
		assert.deepEqual(await basketball_nft.attribute(11), [0, 2, 2124]);

		let dataArr = [];
		for (let i = 0; i < 51; i++) {
			dataArr.push(dropData);
		}
		await assert.revert(basketball_nft.connect(owner).airdropToUser(airdropID, dataArr), "to much drop");
	})

	it('airdropToKOL test', async () => {
		const attributes = [[0, 3, 210, SeriesIndex.Gold_Card], [1, 1, 215, SeriesIndex.Gold_Card], [0, 2, 2124, SeriesIndex.Gold_Card]];
		const amount = 3;
		const amountErr = 4;
		let dropData = [attributes, amount, user1.address];
		let dropDataUser2 = [attributes, amount, user2.address];

		await assert.revert(basketball_nft.connect(user1).airdropToKOL([dropData, dropDataUser2]), "Ownable: caller is not the owner");

		dropData[1] = amountErr;
		await assert.revert(basketball_nft.connect(owner).airdropToKOL([dropData, dropDataUser2]), "param error");
		dropData[1] = amount;

		await basketball_nft.connect(owner).airdropToKOL([dropData, dropDataUser2]);
		assert.equal(await basketball_nft.balanceOf(user1.address), amount);
		assert.equal(await basketball_nft.ownerOf(0), user1.address);
		assert.equal(await basketball_nft.ownerOf(1), user1.address);
		assert.equal(await basketball_nft.ownerOf(2), user1.address);
		assert.equal(await basketball_nft.balanceOf(user2.address), amount);
		assert.equal(await basketball_nft.ownerOf(3), user2.address);
		assert.equal(await basketball_nft.ownerOf(4), user2.address);
		assert.equal(await basketball_nft.ownerOf(5), user2.address);

		assert.deepEqual(await basketball_nft.attribute(0), [0, 3, 210]);
		assert.deepEqual(await basketball_nft.attribute(1), [1, 1, 215]);
		assert.deepEqual(await basketball_nft.attribute(2), [0, 2, 2124]);
		assert.deepEqual(await basketball_nft.attribute(3), [0, 3, 210]);
		assert.deepEqual(await basketball_nft.attribute(4), [1, 1, 215]);
		assert.deepEqual(await basketball_nft.attribute(5), [0, 2, 2124]);

		let dataArr = [];
		for (let i = 0; i < 51; i++) {
			dataArr.push(dropData);
		}
		await assert.revert(basketball_nft.connect(owner).airdropToKOL(dataArr), "to much drop");
	})

	/* ------------ exchange ------------ */
	it('exchange test', async () => {
		// mint some NFT with atttibutes（30 common nfts and 10 transfer player nfts）
		let tokenIDsCommon = [];
		let attrCommon = [];
		let tokenIDsAirdrop = [];
		let attrAirdrop = [];
		const attributesCommon = [
			[SetIndex.StarCard, RarityIndex.Common, 210, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 212, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 213, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 215, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 217, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 2123, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 2124, SeriesIndex.Gold_Card],
		];
		const attributesAirdrop = [
			[SetIndex.StarCard, RarityIndex.Common, 211, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 218, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 2110, SeriesIndex.Gold_Card],
			[SetIndex.StarCard, RarityIndex.Common, 2128, SeriesIndex.Gold_Card],
		];
		await basketball_nft.connect(owner).mintBatch(40, user1.address);
		assert.equal(await basketball_nft.balanceOf(user1.address), 40);

		const amountSwap = 100;
		await basketball_nft.connect(owner).setSwapLimit(amountSwap, amountSwap);
		await basketball_nft.connect(owner).setSwapTime(0, 10000000000);

		// attach attributes to NFTs
		for (let i = 0; i < 40; i++) {
			if (i < 30) {
				tokenIDsCommon.push(i);
				// let attr = attributesCommon[i % attributesCommon.length];
				// copy deeply
				let attr = JSON.parse(JSON.stringify(attributesCommon[i % attributesCommon.length]));
				if (i == 29) attr[0] = 0;
				attrCommon.push(attr);
			} else {
				tokenIDsAirdrop.push(i);
				let attr = JSON.parse(JSON.stringify(attributesAirdrop[i % attributesAirdrop.length]));
				if (i == 39) attr[0] = 0;
				attrAirdrop.push(attr);
			}
		}
		await basketball_nft.connect(owner).setAttributes(tokenIDsCommon, attrCommon);
		await basketball_nft.connect(owner).setAttributes(tokenIDsAirdrop, attrAirdrop);

		// exchange test start
		await assert.revert(basketball_nft.connect(user1).exchange([0, 1, 2, 3], 30), "param length error");
		await assert.revert(basketball_nft.connect(user1).exchange([0, 1], 30), "param length error");

		// other user exchange
		await assert.revert(basketball_nft.connect(user2).exchange([0, 1, 2], 30), 'TransferFromIncorrectOwner()');
		// await assert.revert(basketball_nft.connect(user1).exchange([0, 1, 2], 40), 'TransferFromIncorrectOwner()');
		// attribute error(1. Normal NFT attribute error 2. Airdrop NFT attribute error)
		await assert.revert(basketball_nft.connect(user1).exchange([0, 1, 29], 30), 'pay token error');
		await assert.revert(basketball_nft.connect(user1).exchange([0, 1, 2], 39), 'drop error');

		await basketball_nft.connect(user1).exchange([0, 1, 2], 30);

		// Check the owner of the NFT
		assert.equal(await basketball_nft.ownerOf(40), user1.address);
		assert.equal(await basketball_nft.ownerOf(0), vault.address);
		assert.equal(await basketball_nft.ownerOf(1), vault.address);
		assert.equal(await basketball_nft.ownerOf(2), vault.address);
		assert.equal(await basketball_nft.ownerOf(30), vaultDrop.address);
		// What are the properties of the randomly generated NFT?
		const resultAttr = await basketball_nft.attribute(40);
		assert.deepEqual(resultAttr, [SetIndex.StarCard, RarityIndex.Rare, resultAttr.player, SeriesIndex.Gold_Card])
		// Is the corresponding number reduced?
		const SWAP_SERVING = 2124;
		const SWAP_TRANSFERRED = 2128;
		if (resultAttr.player == SWAP_SERVING) {
			assert.equal(await basketball_nft.swapLimit(SWAP_SERVING), amountSwap - 1);
		} else if (resultAttr.player == SWAP_TRANSFERRED) {
			assert.equal(await basketball_nft.swapLimit(SWAP_TRANSFERRED), amountSwap - 1);
		}

		// test sellExchanged
		await basketball_nft.connect(vault).setApprovalForAll(testsell.address, true);
		assert.equal(await basketball_nft.ownerOf(0), vault.address);
		assert.equal(await basketball_nft.isApprovedForAll(vault.address, testsell.address), true);
		await testsell.connect(user2).sellExchanged(0);

	})

	it('exchange all NFT test', async () => {
		const amountSwap = 100;
		await basketball_nft.connect(owner).setSwapLimit(amountSwap, amountSwap);
		await basketball_nft.connect(owner).setSwapTime(0, 10000000000);
		// mint exceed all 100 * 2 = 200 , need 800 common nfts

		await basketball_nft.connect(owner).mintBatch(4000, user1.address);

		let tokenIDsCommon = [];
		let attrCommon = [];
		let tokenIDsAirdrop = [];
		let attrAirdrop = [];
		for (let i = 0; i < 3000; i++) {
			tokenIDsCommon.push(i);
			attrCommon.push([SetIndex.StarCard, RarityIndex.Common, 210, SeriesIndex.Gold_Card]);
		}
		for (let i = 3000; i < 4000; i++) {
			tokenIDsAirdrop.push(i);
			attrAirdrop.push([SetIndex.StarCard, RarityIndex.Common, 211, SeriesIndex.Gold_Card]);
		}
		for (let i = 0; i < 15; i++) {
			const indexPre = 200 * i;
			const indexLast = 200 * (i + 1);
			await basketball_nft.connect(owner).setAttributes(tokenIDsCommon.slice(indexPre, indexLast), attrCommon.slice(indexPre, indexLast));

			if (i < 5) {
				// console.log(indexPre, indexLast);
				await basketball_nft.connect(owner).setAttributes(tokenIDsAirdrop.slice(indexPre, indexLast), attrAirdrop.slice(indexPre, indexLast));
			}
		}

		let resultSet = [];
		for (let i = 0; i < 1000; i++) {
			if (i < 200) {
				await basketball_nft.connect(user1).exchange([3 * i, 3 * i + 1, 3 * i + 2], 3000 + i);
				resultSet.push(await basketball_nft.attribute(4000 + i));
			} else {
				await assert.revert(basketball_nft.connect(user1).exchange([3 * i, 3 * i + 1, 3 * i + 2], 3000 + i), 'swap card used out');
			}
		}
		// console.log(resultSet);

		let a = 0; let b = 0; let c = 0; let d = 0; let e = 0; let f = 0; let g = 0;
		for (let i = 0; i < resultSet.length; i++) {
			switch (resultSet[i].player) {
				case 2128:
					f++;
					break;
				case 2124:
					g++;
					break;
				default:
			}

		}
		assert.equal(f, 100);
		assert.equal(g, 100);
	})

	/* ------------ reveal ------------ */

	it('setAttributes test', async () => {
		const tokenIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8];
		const tokenIDsErr = [];
		for (let i = 0; i < 201; i++) {
			tokenIDsErr[i] = i;
		}
		const attributes = [
			[0, 3, 210, SeriesIndex.Gold_Card], [1, 1, 215, SeriesIndex.Gold_Card], [0, 2, 2124, SeriesIndex.Gold_Card],
			[0, 3, 212, SeriesIndex.Gold_Card], [1, 1, 217, SeriesIndex.Gold_Card], [0, 2, 2124, SeriesIndex.Gold_Card],
			[0, 3, 213, SeriesIndex.Gold_Card], [1, 1, 215, SeriesIndex.Gold_Card], [0, 2, 2123, SeriesIndex.Gold_Card]
		];
		const attributesErr = [
			[0, 3, 210, SeriesIndex.Gold_Card], [1, 1, 215, SeriesIndex.Gold_Card], [0, 2, 2124, SeriesIndex.Gold_Card],
			[0, 3, 210, SeriesIndex.Gold_Card], [1, 1, 215, SeriesIndex.Gold_Card], [0, 2, 2124, SeriesIndex.Gold_Card],
			[0, 3, 210, SeriesIndex.Gold_Card], [1, 1, 215, SeriesIndex.Gold_Card]
		];

		await assert.revert(basketball_nft.connect(user1).setAttributes(tokenIDs, attributes), "Ownable: caller is not the owner");
		await assert.revert(basketball_nft.connect(owner).setAttributes(tokenIDsErr, attributes), "too much params");
		await assert.revert(basketball_nft.connect(owner).setAttributes(tokenIDs, attributesErr), "params length error");
		await basketball_nft.connect(owner).setAttributes(tokenIDs, attributes);

		for (let i = 0; i < tokenIDs.length; i++) {
			const id = tokenIDs[i];
			assert.deepEqual(await basketball_nft.attribute(id), attributes[i]);
		}
		console.log(await basketball_nft.getTokenAttributes(0));
	})

	it('setBlindBoxURI test', async () => {
		const blindBoxURI = "http://BlindBoxURI.html";
		await assert.revert(basketball_nft.connect(user1).setBlindBoxURI(blindBoxURI), "Ownable: caller is not the owner");
		await basketball_nft.connect(owner).setBlindBoxURI(blindBoxURI);
		assert.equal(await basketball_nft.blindBoxBaseURI(), blindBoxURI);
	});

	it('setBaseURI test', async () => {
		/* 
		1. 
		*/

		await basketball_nft.connect(owner).mintBatch(300, user2.address);

		// check owner permission 
		let id = 100;
		const testURI0 = "http://test.html";
		await assert.revert(basketball_nft.connect(user1).setBaseURI(id, testURI0), "Ownable: caller is not the owner");
		await basketball_nft.connect(owner).setBaseURI(id, testURI0);
		assert.equal(await basketball_nft.tokenURI(0), testURI0 + 0);

		// insert id = 50 < 100
		id = 50;
		const testURI1 = "http://test.html1";
		await basketball_nft.connect(owner).setBaseURI(id, testURI1);
		assert.equal(await basketball_nft.tokenURI(0), testURI1 + 0);
		assert.equal(await basketball_nft.tokenURI(51), testURI0 + 51);

		// insert id = 70  > 50 && < 100
		id = 70;
		const testURI2 = "http://test.html2";
		await basketball_nft.connect(owner).setBaseURI(id, testURI2);
		assert.equal(await basketball_nft.tokenURI(71), testURI0 + 71);
		assert.equal(await basketball_nft.tokenURI(0), testURI1 + 0);
		assert.equal(await basketball_nft.tokenURI(51), testURI2 + 51);

		// insert id = 120  > 100
		id = 120;
		const testURI3 = "http://test.html3";
		await basketball_nft.connect(owner).setBaseURI(id, testURI3);
		assert.equal(await basketball_nft.tokenURI(71), testURI0 + 71);
		assert.equal(await basketball_nft.tokenURI(0), testURI1 + 0);
		assert.equal(await basketball_nft.tokenURI(51), testURI2 + 51);
		assert.equal(await basketball_nft.tokenURI(120), testURI3 + 120);
	});

	it('changeURI test', async () => {
		await basketball_nft.connect(owner).mintBatch(300, user2.address);

		const id = 100;
		const testURI1 = "http://test1.html";
		const testURI2 = "http://test2.html";
		await basketball_nft.connect(owner).setBaseURI(id, testURI1);
		await assert.revert(basketball_nft.connect(user1).changeURI(id, testURI2), "Ownable: caller is not the owner");
		await assert.revert(basketball_nft.connect(owner).changeURI(id + 1, testURI2), "URI corresponding to id should not be empty");
		await basketball_nft.connect(owner).changeURI(id, testURI2);

		assert.equal(await basketball_nft.tokenURI(0), testURI2 + 0);
	});

	it('tokenURI test', async () => {
		//	mint 300 nfts
		await basketball_nft.connect(owner).mintBatch(400, user2.address);

		const blindBoxURI = "http://BlindBoxURI.html/";
		await basketball_nft.connect(owner).setBlindBoxURI(blindBoxURI);

		assert.equal(await basketball_nft.tokenURI(0), blindBoxURI + 0);

		// set five base URI
		/* 
		1. http://baseURI_01	0 - 50
		2. http://baseURI_02	51 - 151
		3. http://baseURI_03	152 - 199
		4. http://baseURI_04	200 - 240
		5. http://baseURI_05	241 - 299
		*/
		const baseURI01 = "http://baseURI_01/";
		const baseURI02 = "http://baseURI_02/";
		const baseURI03 = "http://baseURI_03/";
		const baseURI04 = "http://baseURI_04/";
		const baseURI05 = "http://baseURI_05/";
		await basketball_nft.setBaseURI(50, baseURI01);
		assert.equal(await basketball_nft.tokenURI(51), blindBoxURI + 51);

		await basketball_nft.setBaseURI(151, baseURI02);
		assert.equal(await basketball_nft.tokenURI(152), blindBoxURI + 152);

		await basketball_nft.setBaseURI(199, baseURI03);
		await basketball_nft.setBaseURI(240, baseURI04);
		await basketball_nft.setBaseURI(299, baseURI05);

		// get tokenURI
		assert.equal(await basketball_nft.tokenURI(0), baseURI01 + 0);
		assert.equal(await basketball_nft.tokenURI(50), baseURI01 + 50);
		assert.equal(await basketball_nft.tokenURI(25), baseURI01 + 25);
		assert.equal(await basketball_nft.tokenURI(51), baseURI02 + 51);
		assert.equal(await basketball_nft.tokenURI(151), baseURI02 + 151);
		assert.equal(await basketball_nft.tokenURI(125), baseURI02 + 125);
		assert.equal(await basketball_nft.tokenURI(152), baseURI03 + 152);
		assert.equal(await basketball_nft.tokenURI(199), baseURI03 + 199);
		assert.equal(await basketball_nft.tokenURI(180), baseURI03 + 180);
		assert.equal(await basketball_nft.tokenURI(200), baseURI04 + 200);
		assert.equal(await basketball_nft.tokenURI(240), baseURI04 + 240);
		assert.equal(await basketball_nft.tokenURI(225), baseURI04 + 225);
		assert.equal(await basketball_nft.tokenURI(241), baseURI05 + 241);
		assert.equal(await basketball_nft.tokenURI(299), baseURI05 + 299);
		assert.equal(await basketball_nft.tokenURI(275), baseURI05 + 275);

		assert.equal(await basketball_nft.tokenURI(300), blindBoxURI + 300);
	})
})
