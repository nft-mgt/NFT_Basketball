// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const vaultForExchange = "0xBCcC2073ADfC46421308f62cfD9868dF00D339a8";
  const vaultForTransfer = "0xBCcC2073ADfC46421308f62cfD9868dF00D339a8";

  // We get the contract to deploy
  const BASKETBALLNFT = await hre.ethers.getContractFactory("BASKETBALLNFT");
  const basketball = await hre.upgrades.deployProxy(BASKETBALLNFT, ["Dragramflies Hiroshima", "DFK", vaultForExchange, vaultForTransfer]);

  await basketball.deployed();

  console.log("BASKETBALLNFT deployed to:", basketball.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
