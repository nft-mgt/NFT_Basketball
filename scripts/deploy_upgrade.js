const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const addr = "0xF699e0F974b1C9c54e2928F9Bd8BF62032C91c82";
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