import algosdk from "algosdk";
import {
    algodClient,
    indexerClient,
    marketplaceNote,
    minRound,
    myAlgoConnect,
    numGlobalBytes,
    numGlobalInts,
    numLocalBytes,
    numLocalInts
} from "./constants";
/* eslint import/no-webpack-loader-syntax: off */
import approvalProgram from "!!raw-loader!../contracts/books_approval.teal";
import clearProgram from "!!raw-loader!../contracts/books_clear.teal";
import {base64ToUTF8String, utf8ToBase64String} from "./conversions";

class Book {
    constructor(name, image, description, price, sold, likes, dislikes, appId, owner,book) {
        this.name = name;
        this.image = image;
        this.description = description;
        this.price = price;
        this.sold = sold;
        this.likes = likes;
        this.dislikes = dislikes;
        this.appId = appId;
        this.owner = owner;
        this.book = book;
    }
}

// Compile smart contract in .teal format to program
const compileProgram = async (programSource) => {
    let encoder = new TextEncoder();
    let programBytes = encoder.encode(programSource);
    let compileResponse = await algodClient.compile(programBytes).do();
    return new Uint8Array(Buffer.from(compileResponse.result, "base64"));
}

// CREATE Book: ApplicationCreateTxn
export const createBookAction = async (senderAddress, book) => {
    console.log("Adding book...")
    console.log(book.price);

    let params = await algodClient.getTransactionParams().do();
    params.fee = algosdk.ALGORAND_MIN_TX_FEE;
    params.flatFee = true;

    // Compile programs
    const compiledApprovalProgram = await compileProgram(approvalProgram)
    const compiledClearProgram = await compileProgram(clearProgram)

    // Build note to identify transaction later and required app args as Uint8Arrays
    let note = new TextEncoder().encode(marketplaceNote);
    let name = new TextEncoder().encode(book.name);
    let image = new TextEncoder().encode(book.image);
    let description = new TextEncoder().encode(book.description);
    let price = algosdk.encodeUint64(book.price);

    let appArgs = [name, image, description, price]

    // Create ApplicationCreateTxn
    let txn = algosdk.makeApplicationCreateTxnFromObject({
        from: senderAddress,
        suggestedParams: params,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        approvalProgram: compiledApprovalProgram,
        clearProgram: compiledClearProgram,
        numLocalInts: numLocalInts,
        numLocalByteSlices: numLocalBytes,
        numGlobalInts: numGlobalInts,
        numGlobalByteSlices: numGlobalBytes,
        note: note,
        appArgs: appArgs
    });

    // Get transaction ID
    let txId = txn.txID().toString();

    // Sign & submit the transaction
    let signedTxn = await myAlgoConnect.signTransaction(txn.toByte());
    console.log("Signed transaction with txID: %s", txId);
    await algodClient.sendRawTransaction(signedTxn.blob).do();

    // Wait for transaction to be confirmed
    let confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4);

    // Get the completed Transaction
    console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);

    // Get created application id and notify about completion
    let transactionResponse = await algodClient.pendingTransactionInformation(txId).do();
    let appId = transactionResponse['application-index'];
    console.log("Created new app-id: ", appId);
    return appId;
}

// BUY BOOK: Group transaction consisting of ApplicationCallTxn and PaymentTxn
export const buyBookAction = async (senderAddress, book, count) => {
    console.log("Buying book...");

    let params = await algodClient.getTransactionParams().do();

    // Build required app args as Uint8Array
    let buyArg = new TextEncoder().encode("buy")
    let countArg = algosdk.encodeUint64(count);
    let appArgs = [buyArg, countArg]

    // Create ApplicationCallTxn
    let appCallTxn = algosdk.makeApplicationCallTxnFromObject({
        from: senderAddress,
        appIndex: book.appId,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        suggestedParams: params,
        appArgs: appArgs
    })

    // Create PaymentTxn
    let paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddress,
        to: book.owner,
        amount: book.price * count,
        suggestedParams: params
    })

    let txnArray = [appCallTxn, paymentTxn]

    // Create group transaction out of previously build transactions
    let groupID = algosdk.computeGroupID(txnArray)
    for (let i = 0; i < 2; i++) txnArray[i].group = groupID;

    // Sign & submit the group transaction
    let signedTxn = await myAlgoConnect.signTransaction(txnArray.map(txn => txn.toByte()));
    console.log("Signed group transaction");
    let tx = await algodClient.sendRawTransaction(signedTxn.map(txn => txn.blob)).do();

    // Wait for group transaction to be confirmed
    let confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);

    // Notify about completion
    console.log("Group transaction " + tx.txId + " confirmed in round " + confirmedTxn["confirmed-round"]);
}

// Like     Book: Group transaction consisting of ApplicationCallTxn and PaymentTxn
export const likeAction = async (senderAddress, book) => {
    console.log("Likes book...");
  
    let params = await algodClient.getTransactionParams().do();
  
    // Build required app args as Uint8Array
    let likesArg = new TextEncoder().encode("like");
  
    let appArgs = [likesArg];
  
    // Create ApplicationCallTxn
    let appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: senderAddress,
      appIndex: book.appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      suggestedParams: params,
      appArgs: appArgs,
    });
  
    let txnArray = [appCallTxn];
  
    // Create group transaction out of previously build transactions
    let groupID = algosdk.computeGroupID(txnArray);
    for (let i = 0; i < 1; i++) txnArray[i].group = groupID;
  
    // Sign & submit the group transaction
    let signedTxn = await myAlgoConnect.signTransaction(
      txnArray.map((txn) => txn.toByte())
    );
    console.log("Signed group transaction");
    let tx = await algodClient
      .sendRawTransaction(signedTxn.map((txn) => txn.blob))
      .do();
  
    // Wait for group transaction to be confirmed
    let confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);
  
    // Notify about completion
    console.log(
      "Group transaction " +
        tx.txId +
        " confirmed in round " +
        confirmedTxn["confirmed-round"]
    );
  };
  
  // Dislikes Book: Group transaction consisting of ApplicationCallTxn and PaymentTxn
export const dislikesAction = async (senderAddress, book) => {
    console.log("dislikes book...");
  
    let params = await algodClient.getTransactionParams().do();
  
    // Build required app args as Uint8Array
    let dislikesArg = new TextEncoder().encode("dislike");
  
    let appArgs = [dislikesArg];
  
    // Create ApplicationCallTxn
    let appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: senderAddress,
      appIndex: book.appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      suggestedParams: params,
      appArgs: appArgs,
    });
  
    let txnArray = [appCallTxn];
  
    // Create group transaction out of previously build transactions
    let groupID = algosdk.computeGroupID(txnArray);
    for (let i = 0; i < 1; i++) txnArray[i].group = groupID;
  
    // Sign & submit the group transaction
    let signedTxn = await myAlgoConnect.signTransaction(
      txnArray.map((txn) => txn.toByte())
    );
    console.log("Signed group transaction");
    let tx = await algodClient
      .sendRawTransaction(signedTxn.map((txn) => txn.blob))
      .do();
  
    // Wait for group transaction to be confirmed
    let confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);
  
    // Notify about completion
    console.log(
      "Group transaction " +
        tx.txId +
        " confirmed in round " +
        confirmedTxn["confirmed-round"]
    );
  };

// DELETE   BOOK: ApplicationDeleteTxn
export const deleteBookAction = async (senderAddress, index) => {
    console.log("Deleting application...");

    let params = await algodClient.getTransactionParams().do();

    // Create ApplicationDeleteTxn
    let txn = algosdk.makeApplicationDeleteTxnFromObject({
        from: senderAddress, suggestedParams: params, appIndex: index,
    });

    // Get transaction ID
    let txId = txn.txID().toString();

    // Sign & submit the transaction
    let signedTxn = await myAlgoConnect.signTransaction(txn.toByte());
    console.log("Signed transaction with txID: %s", txId);
    await algodClient.sendRawTransaction(signedTxn.blob).do();

    // Wait for transaction to be confirmed
    const confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4);

    // Get the completed Transaction
    console.log("Transaction " + txId + " confirmed in round " + confirmedTxn["confirmed-round"]);

    // Get application id of deleted application and notify about completion
    let transactionResponse = await algodClient.pendingTransactionInformation(txId).do();
    let appId = transactionResponse['txn']['txn'].apid;
    console.log("Deleted app-id: ", appId);
}

// GET BOOKS: Use indexer
export const getBooksAction = async () => {
    console.log("Fetching books...")
    let note = new TextEncoder().encode(marketplaceNote);
    let encodedNote = Buffer.from(note).toString("base64");

    // Step 1: Get all transactions by notePrefix (+ minRound filter for performance)
    let transactionInfo = await indexerClient.searchForTransactions()
        .notePrefix(encodedNote)
        .txType("appl")
        .minRound(minRound)
        .do();
    let books = []
    for (const transaction of transactionInfo.transactions) {
        let appId = transaction["created-application-index"]
        if (appId) {
            // Step 2: Get each application by application id
            let book = await getApplication(appId)
            if (book) {
                books.push(book)
            }
        }
    }
    console.log("Books fetched.")
    return books
}

const getApplication = async (appId) => {
    try {
        // 1. Get application by appId
        let response = await indexerClient.lookupApplications(appId).includeAll(true).do();
        if (response.application.deleted) {
            return null;
        }
        let globalState = response.application.params["global-state"]

        // 2. Parse fields of response and return book
        let owner = response.application.params.creator
        let name = ""
        let image = ""
        let description = ""
        let price = 0
        let sold = 0
        let likes = 0;
        let dislikes = 0;

        const getField = (fieldName, globalState) => {
            return globalState.find(state => {
                return state.key === utf8ToBase64String(fieldName);
            })
        }

        if (getField("NAME", globalState) !== undefined) {
            let field = getField("NAME", globalState).value.bytes
            name = base64ToUTF8String(field)
        }

        if (getField("IMAGE", globalState) !== undefined) {
            let field = getField("IMAGE", globalState).value.bytes
            image = base64ToUTF8String(field)
        }

        if (getField("DESCRIPTION", globalState) !== undefined) {
            let field = getField("DESCRIPTION", globalState).value.bytes
            description = base64ToUTF8String(field)
        }

        if (getField("PRICE", globalState) !== undefined) {
            price = getField("PRICE", globalState).value.uint
        }

        if (getField("SOLD", globalState) !== undefined) {
            sold = getField("SOLD", globalState).value.uint
        }
        if (getField("LIKES", globalState) !== undefined) {
            likes = getField("LIKES", globalState).value.uint;
          }
      
          if (getField("DISLIKES", globalState) !== undefined) {
            dislikes = getField("DISLIKES", globalState).value.uint;
          }

        return new Book(name, image, description, price, sold, likes, dislikes, appId, owner)
    } catch (err) {
        return null;
    }
}
