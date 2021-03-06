// ExpressJS Setup
const express = require('express');
const app = express();

// Hyperledger Bridge
const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const ccpPath = path.resolve(__dirname, 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON); // unmarshal

// constants
const PORT = 8080;
const HOST = 'localhost';

// use static file
app.use(express.static(__dirname + ''));
// configure app to use body-parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// allows you to ejs view engine
app.set('view engine', 'ejs');

// importing .env file
require('dotenv').config();

// Using jsonwebtoken module
const jwt = require("jsonwebtoken");

// use cookie-parser
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// importing user schema
const User = require('./module/User');

// importing auth function
const { auth } = require('./module/authMiddleware');

// importing db function that connects with MongoDB
const { db } = require('./module/db');

// importing bcrypt module to encrypt user password
const bcrypt = require('bcrypt');
// declaring saltRounds to decide cost factor of salt function
const saltRounds = 10;

// MongoDB user info DB
db();

// server
const server = app.listen(PORT, HOST, function() {
    console.log(`Running on http://${HOST}:${PORT}`)
});

// HTML Routing
// login.html + home.ejs
app.get('/', auth, function(req, res) {
    const user = req.decoded;
    if(user) {
        return res.render(__dirname + '/views/home.ejs', {user:user.docs});
    } else {
        return res.sendFile(__dirname + '/views/login.html');
    }
});

// wallet_CA.html
app.get('/wallet_CA', auth, function(req, res) {
    res.sendFile(__dirname + '/views/wallet_CA.html');
})

// wallet_ASSET.html
app.get('/wallet_ASSET', auth, function(req, res) {
    res.sendFile(__dirname + '/views/wallet_ASSET.html');
})

// create.html
app.get('/create', auth, function(req, res) {
    res.sendFile(__dirname + '/views/create.html');
})

// query.html
app.get('/query', auth, function(req, res) {
    res.sendFile(__dirname + '/views/query.html');
})

// transfer.html
app.get('/transfer', auth, function(req, res) { 
    res.sendFile(__dirname + '/views/transfer.html');
})

// REST API Routing
// LogOut
app.get('/logOut', function(req, res) {
    return res.clearCookie('user').end();
});

// LogIn 
app.post('/:logInid/:logInpw', function(req, res, next) {
    console.log('req.body: ', req.body);
    // initializing user variable using schema
    let user = new User(req.body);
    User.findOne({id:(user.id)}, function(err, docs) {
        if(err) throw err;
        else if(docs == null) { // Entered ID does not exist.
            return console.log('Entered ID does not exist.');
        } else {  // when entered ID matches.
            bcrypt.compare(user.pw, docs.pw, function (err, answer) {
                if (err) throw err;
                if(answer) { // req.user variable can be used in next middleware
                    req.user = docs;
                    return next();
                } else {
                    return res.send('Your password does not match with your ID.');
                }
            })
        }
    })
});

app.post('/:logInid/:logInpw', function(req, res) {
    const docs = req.user;
    const payload = { // putting data into a payload
        docs,
    };
    // generating json web token and sending it
    jwt.sign(
    payload, // payload into jwt.sign method
    process.env.SECRET_KEY, // secret key value
    { expiresIn: "30m" }, // token expiration time
    (err, token) => {
        if (err) throw err;
        else {
            return res
            .cookie('user', token,{maxAge:30*60 * 1000}) // 1000 is a sec
            .end();
        }
    })
});

// SignUp 
app.post('/:signUpid/:signUppw/:signUppwc', function(req, res, next) {
    let user = new User(req.body);
    // ????????? ?????? ?????? ??????
    const pattern = /^[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/i;
    if (pattern.test(user.id) == false) {
        return res.send('Please enter valid email address.');
    }
    // 'pw'??? 'pwc' ?????? ?????????, ?????? ????????? client??? ????????? middleware ??????
    if (user.pw!==user.pwc) {
        return res.send('Your password and password confirmation have to be same.');
    }
    // 'MongoDB'??? 'findOne' ???????????? ???????????? user??? 'id'??? ???????????? ????????????, 'docs' ????????? ??????
    // 'User.findOne'?????? ?????? 'User'????????? ????????? import??? 'schema'??? 'User'
    User.findOne({ id:(user.id) }, function(err, docs) {
        if (err) throw err; // ?????? ????????? // 'docs'?????? ?????????, ???????????? id??? ????????? ????????????
        // id??? ????????? email ?????? ?????? ??????
        else if(docs == null) { // Entered ID is available
            // id, pw, pwc??? ?????? ????????? ??????(?????? ??????)
            if (user.id&&user.pw&&user.pwc) {   // Enter adding a new account step
                // middleware??? 'next()' ?????????
                // middleware?????? next ????????? ???????????? ???????????? ????????????
                // ?????? POST????????? ?????? ????????? '?????? ??????' middleware??? ??????
                return next();
            } else return res.send('Please enter all the blanks.');
        } else { // ???????????? docs ?????? ?????? ???????????? ????????? id??? ??????
            return res.send('Your entered email address already exists.');
        }
    })
});

app.post('/:signUpid/:signUppw/:signUppwc', function(req, res) {
    // user ?????? ?????? ??????
    let user = new User(req.body);
    // salt ??????
    bcrypt.genSalt(saltRounds, function(err, salt) {
        if (err) throw err;
        // ????????? salt?????? hash????????? pw??? ?????? ??????
        // pw??? hash??? ????????? hash????????? ??????
        bcrypt.hash(user.pw, salt, function(err, hash) {
            if (err) throw err;
            // user.pw??? ????????? hash ??????
            user.pw = hash;
            // MongoDB??? ??????
            user.save();
            return res.send('You have just created your new account!');
        })
    })
});


// CA + ASSET
app.post('/user', async(req, res)=>{
    const mode = req.body.mode;
    console.log('/user-post-'+mode);

    if(mode == 1)   // CA
    {
        const id = req.body.id;
        const pw = req.body.pw;
        console.log('/user-post-'+id+' '+pw);

        try {
            // Create a new CA client for interacting with the CA.
            const caURL = ccp.certificateAuthorities['ca.example.com'].url;
            const ca = new FabricCAServices(caURL);

            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (!adminExists) {
                console.log('An identity for the admin user does not exists in the wallet');
                // ???????????? to ???????????????
                const obj = JSON.parse('An identity for the admin user does not exists in the wallet');
                res.status(400).json(obj);
            }

            //Enroll the admin user, and import the new identity into the wallet.
            const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: pw });
            const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            await wallet.import(id, identity);
            console.log('Successfully enrolled admin user and imported it into the wallet');
            const obj = JSON.parse('{"PAYLOAD":"Successfully enrolled admin user and imported it into the wallet"}');
            res.status(200).json(obj);

        } catch (error) {
            console.error(`Failed to enroll admin user ${id}: ${error}`);
            // process.exit(1);
            // ???????????? to ???????????????
            const obj = JSON.parse(`{"ERR_MSG":"Failed to enroll admin user ${id} : ${error}"}`);
            res.status(400).json(obj);
        }
        
    }
    else if (mode == 2) // ASSET
    {
        const id = req.body.id;
        const role = req.body.role;
        console.log('/user-post-'+id+' '+role);

        try {
            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(__dirname, 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);
            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(id);
            if (userExists) {
                console.log(`An identity for the user ${id} already exists in the wallet`);
                const obj = JSON.parse(`{"ERR_MSG":"An identity for the user ${id} already exists in the wallet"}`);
                res.status(400).json(obj);
            }
            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists(id);
            if (adminExists) {
                console.log(`An identity for the admin user ${id} already exists in the wallet`);
                const obj = JSON.parse(`{"ERR_MSG":"An identity for the admin user ${id} already exists in the wallet"}`);
                res.status(400).json(obj);
            }
            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } });
            // Get the CA client object from the gateway for interacting with the CA.
            const ca = gateway.getClient().getCertificateAuthority();
            const adminIdentity = gateway.getCurrentIdentity();

            // Register the user, enroll the user, and import the new identity into the wallet.
            const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: id, role: role }, adminIdentity);
            const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: secret });
            const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            wallet.import(id, userIdentity);
            console.log(`Successfully registered and enrolled user ${id} and imported it into the wallet`);
            const obj = JSON.parse(`{"PAYLOAD":"Successfully registered and enrolled user ${id} and imported it into the wallet"}`);
            res.status(200).json(obj);
    
        } catch (error) {
            console.error(`Failed to register user ${id}: ${error}`);
            const obj = JSON.parse(`{"ERR_MSG":"Failed to register user ${id} : ${error}"}`);
            res.status(400).json(obj);
        }
    }
})

// ASSET POST
app.post('/asset', async(req, res)=>{
    // ?????????????????? ?????????????????? ???????????? ????????? ( POST method????????? body?????? ?????? )
    const id    = req.body.id;
    const key   = req.body.key;
    const value = req.body.value;
    console.log('/asset-post-'+key+'-'+value);
    // ??????????????? -> user1
    const walletPath = path.join(process.cwd(), 'wallet') // ~/dev/first-project/application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists) {
        console.log(`An identity for the user ${id} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        // ????????????????????? ???????????? ?????? ?????? HTML??? ???????????? ???
        res.status(401).sendFile(__dirname + '/views/unauth.html');
        return;
    }
    // ?????????????????????
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } });
    // ?????? ??????
    const network = await gateway.getNetwork('mychannel');
    // ???????????? ??????
    const contract = network.getContract('simpleasset');
    // ??????????????????
    await contract.submitTransaction('set', key, value);
    console.log('Transaction has been submitted');
    // ????????????????????? ??????
    await gateway.disconnect();
    // ?????? ?????????????????? ??????
    // result.html?????? 
    const resultPath = path.join(process.cwd(), '/views/result.html');
    var resultHTML = fs.readFileSync(resultPath, 'utf8');
    resultHTML = resultHTML.replace("<div></div>", "<div><p>Transaction has been submitted</p></div>");
    res.status(200).send(resultHTML);
})
// ASSET GET /get
app.get('/asset', async(req, res)=>{
    // ?????????????????? ?????????????????? ???????????? ????????? ( POST method????????? query?????? ?????? )
    const key   = req.query.key;
    const id    = req.query.id;

    console.log('/asset-get-'+key);
    // ??????????????? -> user1
    const walletPath = path.join(process.cwd(), 'wallet') // ~/dev/first-project/application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists) {
        console.log(`An identity for the user ${id} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        // ????????????????????? ???????????? ?????? ?????? HTML??? ???????????? ???
        // res.status(401).sendFile(__dirname + '/unauth.html');
        const obj = JSON.parse(`{"ERR_MSG":"An identity for the user ${id} does not exist in the wallet"}`);
        res.status(400).json(obj);
        return;
    }

    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } });

    const network = await gateway.getNetwork('mychannel');
    
    const contract = network.getContract('simpleasset');
    
    const txresult = await contract.evaluateTransaction('get', key);
    console.log('Transaction has been evaluated: '+txresult);
    
    await gateway.disconnect();
    // ?????? ?????????????????? ??????
    // result.html?????? 
    // const resultPath = path.join(process.cwd(), '/views/result.html')
    // var resultHTML = fs.readFileSync(resultPath, 'utf8');
    // resultHTML = resultHTML.replace("<div></div>", `<div><p>Transaction has been evaluated: ${txresult}</p></div>`);
    // res.status(200).send(resultHTML);
    const obj = JSON.parse(txresult);
    res.status(200).json(obj);
})

// ASSET GET /history
app.get('/assets', async(req, res)=>{
    // ?????????????????? ?????????????????? ???????????? ????????? ( POST method????????? query?????? ?????? )
    const key   = req.query.key;
    const id    = req.query.id;
    console.log('/assets-get-'+key);
    // ??????????????? -> user1
    const walletPath = path.join(process.cwd(), 'wallet') // ~/dev/first-project/application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists) {
        console.log(`An identity for the user ${id} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        // ????????????????????? ???????????? ?????? ?????? HTML??? ???????????? ???
        res.status(401).sendFile(__dirname + '/views/unauth.html');
        return;
    }
    
    const gateway = new Gateway(); 
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('simpleasset'); 
    const txresult = await contract.evaluateTransaction('history', key);
    console.log('Transaction has been submitted: '+txresult);

    // [{TxID
    // Value -> null or {key, value)
    // TimeStamp
    // IsDelete}]

    await gateway.disconnect();
    // ?????? ?????????????????? ??????
    // result.html?????? 
    const resultPath = path.join(process.cwd(), '/views/result.html')
    var resultHTML = fs.readFileSync(resultPath, 'utf8');

    var tableHTML="\n<table class=\"table table-bordered\">";
    
    const txs = JSON.parse(txresult);
    
    for(var i=0 ; i<txs.length; i++)
    {
        tableHTML+="<tr><td>TxId</td>";
        tableHTML=tableHTML+"<td>"+txs[i].TxId+"</td></tr>";
        tableHTML+="<tr><td>Timestamp</td>";
        tableHTML=tableHTML+"<td>"+txs[i].Timestamp+"</td></tr>";
        tableHTML+="\n";
    }
    tableHTML="</table>\n";

    resultHTML = resultHTML.replace("<div></div>", `<div><p>Transaction has been evaluated:</p><br> ${txresult}</p></div>\n`);
    res.status(200).send(resultHTML);
    // const obj = JSON.parse(txresult);
    // res.status(200).json(obj);
})

app.post('/tx', async(req, res)=>{
    const id    = req.body.id;
    const from  = req.body.from;
    const to    = req.body.to;
    const value    = req.body.value;
    console.log('/tx-post-'+id+'-'+from+'-'+to+'-'+value);
    // ??????????????? -> id
    const walletPath = path.join(process.cwd(), 'wallet')
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists) {
        console.log(`An identity for the user ${id} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        // ????????????????????? ???????????? ?????? ?????? HTML??? ???????????? ???
        res.status(401).sendFile(__dirname + '/views/unauth.html');
        return;
    }
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id , discovery: { enabled: false } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('simpleasset');
    await contract.submitTransaction('transfer', from, to, value);
    console.log('Transaction has been submitted');
    await gateway.disconnect();
 
    const resultPath = path.join(process.cwd(), '/views/result.html')
    var resultHTML = fs.readFileSync(resultPath, 'utf8');
    resultHTML = resultHTML.replace("<div></div>", "<div><p>Transaction has been submitted</p></div>");
    res.status(200).send(resultHTML);
})
