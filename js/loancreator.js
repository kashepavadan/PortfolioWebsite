const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
const loanCreatorAddress = "0x90Ebfccef2AB1f8418e12455dB60a22E8C90281f";
const loanCreatorABI = [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "creationTime",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "expirationTime",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "interest",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "borrower",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "loanKey",
				"type": "uint256"
			}
		],
		"name": "BorrowEvent",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_borrower",
				"type": "address"
			}
		],
		"name": "guaranteeLoan",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_loanKey",
				"type": "uint256"
			}
		],
		"name": "liquidate",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "time",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "borrower",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "loanKey",
				"type": "uint256"
			}
		],
		"name": "LiquidationEvent",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint8",
				"name": "_interest",
				"type": "uint8"
			},
			{
				"internalType": "uint256",
				"name": "_term",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_value",
				"type": "uint256"
			}
		],
		"name": "loanRequest",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "loanRequestDelete",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "time",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "borrower",
				"type": "address"
			}
		],
		"name": "LoanRequestDeleteEvent",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "creationTime",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint8",
				"name": "interest",
				"type": "uint8"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "term",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "borrower",
				"type": "address"
			}
		],
		"name": "LoanRequestEvent",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_loanKey",
				"type": "uint256"
			}
		],
		"name": "repay",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "time",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newValue",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "borrower",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "loanKey",
				"type": "uint256"
			}
		],
		"name": "RepayEvent",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "credit",
		"outputs": [
			{
				"internalType": "int256",
				"name": "",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint8",
				"name": "_interest",
				"type": "uint8"
			},
			{
				"internalType": "uint256",
				"name": "_term",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_value",
				"type": "uint256"
			}
		],
		"name": "getFinalValue",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_loanKey",
				"type": "uint256"
			}
		],
		"name": "getLoanInterestValue",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_loanKey",
				"type": "uint256"
			}
		],
		"name": "isLoanExpired",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "loanRequests",
		"outputs": [
			{
				"internalType": "uint8",
				"name": "interest",
				"type": "uint8"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "time",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "guarantor",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "loans",
		"outputs": [
			{
				"internalType": "uint8",
				"name": "interest",
				"type": "uint8"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "time",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "guarantor",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]

var loanCreator;
var userAccount = 0;
var signer;

async function startApp() {
	try {
		signer = provider.getSigner();
		loanCreator = new ethers.Contract(loanCreatorAddress, loanCreatorABI, signer);
		var userAccounts = await provider.send("eth_requestAccounts", []);
		userAccount = userAccounts[0];
		await getLoanRequests();
		await getMyLoans();

		loanCreator.on("LoanRequestEvent", async (creationTime, interest, term, value, borrower, event) => {
			await getLoanRequests();
		});

		loanCreator.on("LoanRequestDeleteEvent", async (time, borrower, event) => {
			await getLoanRequests();
		});

		loanCreator.on("BorrowEvent", async (creationTime, expirationTime, interest, value, borrower, guarantor, event) => {
			await getMyLoans();
		});

		loanCreator.on("RepayEvent", async (creationTime, expirationTime, interest, value, borrower, guarantor, event) => {
			await getMyLoans();
		});

		loanCreator.on("LiquidationEvent", async (time, value, borrower) => {
			await getMyLoans();
		});
	} catch (err) {
		alert(err);
		return false;
	}
}

async function createLoanRequest() {
	var lrinterestValue;
	var lrtermValue;
	var lrvalueValue;
	try {
		lrinterestValue = parseFloat(document.getElementById("lrinterest").value);
		lrtermValue = parseFloat(document.getElementById("lrterm").value) * 86400;
		lrvalueValue = await ethers.utils.parseEther(document.getElementById("lrvalue").value);

		if (lrinterestValue == 0 || lrtermValue == 0 || lrvalueValue == 0) {
			alert("Use non-zero values!");
			return false;
		}
	} catch (err) {
		alert("Wrong input format!", err);
		return false;
	}

	try {
		await loanCreator.loanRequest(lrinterestValue, lrtermValue, lrvalueValue);
	} catch (err) {
		alert("Loan request creation failed ", err);
		return false;
	}
}

async function deleteLoanRequest() {
	try {
		await loanCreator.loanRequestDelete();
	} catch (err) {
		alert("Loan request deletion failed ", err);
		return false;
	}
}

async function getLoanRequests() {
	try {
		var finalLRs = [];
		var myLR = {};
		let lrfilter = loanCreator.filters.LoanRequestEvent();
		var loanRequests = await loanCreator.queryFilter(lrfilter);
		for (lr of loanRequests) {
			var deletesFilter = loanCreator.filters.LoanRequestDeleteEvent(null, lr.args.borrower);
			var deletes = await loanCreator.queryFilter(deletesFilter);
			var active = true;
			for (d of deletes) {
				if (d.args.time > lr.args.creationTime) {
					active = false;
					break;
				}
			}
			if (active) {
				finalLRs.push(lr);
				if (lr.args.borrower.toLowerCase().localeCompare(userAccount.toLowerCase()) == 0) {
					myLR = lr;
				}
				break;
			}
		}

		document.getElementById("loanrequestslist").innerHTML = "";
		document.getElementById("loanrequestslist").style.background = "rgb(30, 30, 30)";
		document.getElementById("myloanrequest").innerHTML = "";
		document.getElementById("myloanrequest").style.background = "rgb(55, 55, 55)";

		if (finalLRs.length == 0) {
			document.getElementById("myloanrequest").innerHTML =
				`<h3>Create a Loan Request</h3>`
				+ `<ul class="dappul"><li class="dappli"><label for="lrinterest">Annual interest rate (%) </label>`
				+ `<input type="text" id="lrinterest"/></li>`
				+ `<li class="dappli"><label for="lrterm">Loan term (days) </label>`
				+ `<input type="text" id="lrterm"/></li>`
				+ `<li class="dappli"><label for="lrvalue">Loan value (ETH) </label>`
				+ `<input type="text" id="lrvalue"/></li></ul>`
				+ `<button class="infobox-button" onClick="createLoanRequest()">Create</button>`;
			return;
		} else {
			document.getElementById("loanrequestslist").innerHTML = "<h3>Open Loan Requests</h3>";
			document.getElementById("loanrequestslist").style.background = "rgb(55, 55, 55)";
		}

		if (JSON.stringify(myLR) !== "{}") {
			var lrValue = await ethers.utils.formatEther(myLR.args.value);
			document.getElementById("myloanrequest").innerHTML =
				`<h3>Your Loan Request</h3>`
				+ `<ul class="dappul"><li class="dappli">Interest: ${myLR.args.interest}%</li>`
				+ `<li class="dappli">Term: ${myLR.args.term / 86400} days</li>`
				+ `<li class="dappli">Value: ${lrValue} ETH</li></ul>`
				+ `<button class="infobox-button" onClick="deleteLoanRequest()">Delete Loan Request</button>`;
		} else {
			document.getElementById("myloanrequest").innerHTML =
				`<h3>Create a Loan Request</h3>`
				+ `<ul class="dappul"><li class="dappli"><label for="lrinterest">Annual interest rate (%) </label>`
				+ `<input type="text" id="lrinterest"/></li>`
				+ `<li class="dappli"><label for="lrterm">Loan term (days) </label>`
				+ `<input type="text" id="lrterm"/></li>`
				+ `<li class="dappli"><label for="lrvalue">Loan value (ETH) </label>`
				+ `<input type="text" id="lrvalue"/></li></ul>`
				+ `<button class="infobox-button" onClick="createLoanRequest()">Create</button>`;
		}

		for (flr of finalLRs) {
			var credit = await loanCreator.credit(flr.args.borrower);
			var finalValue = await loanCreator.getFinalValue(flr.args.interest, flr.args.term, flr.args.value);
			var finalValueETH = await ethers.utils.formatEther(finalValue);
			var lrValue = await ethers.utils.formatEther(flr.args.value);
			var reward = (finalValue.sub(flr.args.value)).mul(2);
			var maxReward = await ethers.utils.formatEther(reward);

			document.getElementById("loanrequestslist").innerHTML +=
				`<ul class="dappul"><li class="dappli">Interest: ${flr.args.interest}%</li>`
				+ `<li class="dappli">Term: ${flr.args.term / 86400} days</li>`
				+ `<li class="dappli">Value: ${lrValue} ETH</li>`
				+ `<li class="dappli">Required Deposit: ${finalValueETH} ETH</li>`
				+ `<li class="dappli">Maximum Reward: ${maxReward} ETH</li>`
				+ `<li class="dappli">Borrower Credit Score: ${credit}</li></ul>`
				+ `<button class="infobox-button" onClick="guaranteeLoan('${flr.args.borrower}')">Guarantee Loan</button>`;
		}
	} catch (err) {
		alert(err);
		return false;
	}
}

async function guaranteeLoan(borrower) {
	try {
		var address = await ethers.utils.getAddress(borrower);
		var loanRequest = await loanCreator.loanRequests(address);
		var finalValue = await loanCreator.getFinalValue(loanRequest.interest, loanRequest.time, loanRequest.value);
		await loanCreator.guaranteeLoan(borrower, { value: finalValue });
	} catch (err) {
		alert(err);
		return false;
	}
}

async function getMyLoans() {
	try {
		var expiredLoans = [];
		var myLoans = [];
		let loanfilter = loanCreator.filters.BorrowEvent();
		var loans = await loanCreator.queryFilter(loanfilter);
		for (loan of loans) {
			var deletesFilter = loanCreator.filters.LiquidationEvent(null, null, null, loan.args.loanKey);
			var deletes = await loanCreator.queryFilter(deletesFilter);
			if (deletes.length > 0) {
				continue;
			}
			
			if (loan.args.borrower.toLowerCase().localeCompare(userAccount.toLowerCase()) == 0) {
				myLoans.push(loan);
			}

			var isLoanExpired = await loanCreator.isLoanExpired(loan.args.loanKey);
			if (isLoanExpired) {
				expiredLoans.push(loan);
				break;
			}
		}

		document.getElementById("myloans").innerHTML = "";
		document.getElementById("expiredloans").innerHTML = "";
		document.getElementById("myloans").style.background = "rgb(30, 30, 30)";
		document.getElementById("expiredloans").style.background = "rgb(30, 30, 30)";

		if (myLoans.length > 0) {
			document.getElementById("myloans").innerHTML = `<h3>Your Loans</h3>`;
			document.getElementById("myloans").style.background = "rgb(55, 55, 55)";
		}
		if (expiredLoans.length > 0) {
			document.getElementById("expiredloans").innerHTML = `<h3>Loan Liquidation Opportunities</h3>`;
			document.getElementById("expiredloans").style.background = "rgb(55, 55, 55)";
		}

		for (loan of myLoans) {
			var finalValue = await loanCreator.getFinalValue(loan.args.interest, loan.args.expirationTime - loan.args.creationTime, loan.args.value);
			finalValueETH = await ethers.utils.formatEther(finalValue);
			var blockTimestamp = (await provider.getBlock('latest')).timestamp;

			if (expiredLoans.includes(loan)) {
				document.getElementById("myloans").innerHTML +=
					`<ul class="dappul"><li class="dappli">${finalValueETH} ETH Loan Expired ${(blockTimestamp - loan.args.expirationTime) / 86400} Days Ago!</li></ul>`;
			} else {
				var currentValue = await loanCreator.getLoanInterestValue(loan.args.loanKey);
				var currentValueETH = await ethers.utils.formatEther(currentValue);

				document.getElementById("myloans").innerHTML +=
					`<ul class="dappul"><li class="dappli">Interest: ${loan.args.interest}%</li>`
					+ `<li class="dappli">Expiration Time: ${(loan.args.expirationTime - blockTimestamp) / 86400} days from now</li>`
					+ `<li class="dappli">Total Debt: ${currentValueETH} ETH</li>`
					+ `<li class="dappli"><label for="repay">Amount to Repay (ETH) </label>`
					+ `<input type="text" id="repayamount"/></li></ul>`
					+ `<button class="infobox-button" onClick="repayLoan('${loan.args.loanKey}')">Repay Loan</button>`;
			}
		}

		for (loan of expiredLoans) {
			var finalValue = await loanCreator.getFinalValue(loan.args.interest, loan.args.expirationTime - loan.args.creationTime, loan.args.value);
			var blockTimestamp = (await provider.getBlock('latest')).timestamp;
			var reward = (finalValue.sub(loan.args.value)).mul(2);
			var maxReward = await ethers.utils.formatEther(reward);

			document.getElementById("expiredloans").innerHTML +=
				`<ul class="dappul"><li class="dappli">Liquidation Reward: ${maxReward} Ether</li></ul>`
				+ `<button class="infobox-button" onClick="liquidateLoan('${loan.args.loanKey}')">Liquidate Loan</button>`;
		}
	} catch (err) {
		alert(err);
		return false;
	}
}

async function repayLoan(loanKey) {
	try {
		var repayment = await ethers.utils.parseEther(document.getElementById("repayamount").value);
		if (repayment == 0) {
			alert("Invalid input!");
			return false;
		}
		await loanCreator.repay(loanKey, { value: repayment });
	} catch (err) {
		alert(err);
		return false;
	}
}

async function liquidateLoan(loanKey) {
	try {
		await loanCreator.liquidate(loanKey);
	} catch (err) {
		alert(err);
		return false;
	}
}

// Following MetaMask code largely copied from rareskills.io

// Function to check if MetaMask is available
async function checkMetaMaskAvailability() {
	if (window.ethereum) {
		try {
			// Request access to MetaMask accounts
			await window.ethereum.request({ method: "eth_requestAccounts" });

			var chain = (await provider.getNetwork()).chainId;
			if (chain != 11155111) {
				alert("You must use the Sepolia Testnet");
				return false;
			}

			return true;
		} catch (err) {
			alert("Failed to connect to MetaMask:", err);
			return false;
		}
	} else {
		alert("MetaMask not found");
		return false;
	}
}

// Event listener for MetaMask button
document.getElementById("metamask").addEventListener("click", async () => {
	const metaMaskAvailable = await checkMetaMaskAvailability();
	if (metaMaskAvailable) {
		await ConnectWallet();
	} else {
		// MetaMask not available
		alert("MetaMask not found");
		// Update status
		document.getElementById("metamask").innerText = "MetaMask not found";
		document.getElementById("metamask").style.color = "red";
	}
});

//Function to connect to MetaMask
async function ConnectWallet() {
	try {
		// Request access to MetaMask accounts
		await window.ethereum.request({ method: "eth_requestAccounts" });
		// Update status
		document.getElementById("metamask").innerText = "Connected to MetaMask";
		document.getElementById("metamask").style.color = "green";
		startApp();

		provider.on("network", (newNetwork, oldNetwork) => {
			// When a Provider makes its initial connection, it emits a "network"
			// event with a null oldNetwork along with the newNetwork. So, if the
			// oldNetwork exists, it represents a changing network
			if (oldNetwork) {
				window.location.reload();
			}
		});
	} catch (err) {
		// Handle error
		alert("Failed to connect to MetaMask:", err);
		// Update status
		document.getElementById("metamask").innerText = "Failed to connect to MetaMask";
		document.getElementById("metamask").style.color = "red";
	}
}