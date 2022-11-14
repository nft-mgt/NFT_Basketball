const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const addr = "0x07aec8b03f1e0bda03a7e5593b2444104b3e43f0";
  const BASKETBALLNFT = await ethers.getContractFactory("BASKETBALLNFT");
  const bb = await upgrades.upgradeProxy(addr, BASKETBALLNFT);
  console.log("BASKETBALLNFT upgrade to:", bb.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});