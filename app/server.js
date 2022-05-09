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
    // 이메일 주소 형식 체크
    const pattern = /^[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/i;
    if (pattern.test(user.id) == false) {
        return res.send('Please enter valid email address.');
    }
    // 'pw'와 'pwc' 값이 다르면, 해당 문구를 client로 보내고 middleware 종료
    if (user.pw!==user.pwc) {
        return res.send('Your password and password confirmation have to be same.');
    }
    // 'MongoDB'의 'findOne' 메소드를 사용해서 user의 'id'를 기준으로 검색하고, 'docs' 변수에 리턴
    // 'User.findOne'에서 앞의 'User'부분은 위에서 import한 'schema'의 'User'
    User.findOne({ id:(user.id) }, function(err, docs) {
        if (err) throw err; // 에러 던지기 // 'docs'값이 없다면, 중복되는 id가 없어서 사용가능
        // id로 입력된 email 주소 형식 체크
        else if(docs == null) { // Entered ID is available
            // id, pw, pwc가 모두 있는지 확인(빈값 확인)
            if (user.id&&user.pw&&user.pwc) {   // Enter adding a new account step
                // middleware의 'next()' 메소드
                // middleware에서 next 인자를 세번째에 선언해야 사용가능
                // 같은 POST타입의 같은 경로의 '바로 다음' middleware로 이동
                return next();
            } else return res.send('Please enter all the blanks.');
        } else { // 리턴받은 docs 값이 이미 존재해서 중복된 id일 경우
            return res.send('Your entered email address already exists.');
        }
    })
});

app.post('/:signUpid/:signUppw/:signUppwc', function(req, res) {
    // user 정보 다시 넣기
    let user = new User(req.body);
    // salt 생성
    bcrypt.genSalt(saltRounds, function(err, salt) {
        if (err) throw err;
        // 생성한 salt값을 hash함수에 pw와 함께 넣음
        // pw는 hash화 되어서 hash변수로 리턴
        bcrypt.hash(user.pw, salt, function(err, hash) {
            if (err) throw err;
            // user.pw에 리턴된 hash 넣기
            user.pw = hash;
            // MongoDB에 저장
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
                // 오류전송 to 클라이언트
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
            // 오류전송 to 클라이언트
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
    // 어플리케이션 요청문서에서 파라미터 꺼내기 ( POST method에서는 body에서 꺼냄 )
    const id    = req.body.id;
    const key   = req.body.key;
    const value = req.body.value;
    console.log('/asset-post-'+key+'-'+value);
    // 인증서작업 -> user1
    const walletPath = path.join(process.cwd(), 'wallet') // ~/dev/first-project/application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists) {
        console.log(`An identity for the user ${id} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        // 클라이언트에서 인증서에 관한 안내 HTML을 보내줘야 함
        res.status(401).sendFile(__dirname + '/views/unauth.html');
        return;
    }
    // 게이트웨이연결
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } });
    // 채널 연결
    const network = await gateway.getNetwork('mychannel');
    // 체인코드 연결
    const contract = network.getContract('simpleasset');
    // 트랜젝션처리
    await contract.submitTransaction('set', key, value);
    console.log('Transaction has been submitted');
    // 게이트웨이연결 해제
    await gateway.disconnect();
    // 결과 클라이언트에 전송
    // result.html수정 
    const resultPath = path.join(process.cwd(), '/views/result.html');
    var resultHTML = fs.readFileSync(resultPath, 'utf8');
    resultHTML = resultHTML.replace("<div></div>", "<div><p>Transaction has been submitted</p></div>");
    res.status(200).send(resultHTML);
})
// ASSET GET /get
app.get('/asset', async(req, res)=>{
    // 어플리케이션 요청문서에서 파라미터 꺼내기 ( POST method에서는 query에서 꺼냄 )
    const key   = req.query.key;
    const id    = req.query.id;

    console.log('/asset-get-'+key);
    // 인증서작업 -> user1
    const walletPath = path.join(process.cwd(), 'wallet') // ~/dev/first-project/application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists) {
        console.log(`An identity for the user ${id} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        // 클라이언트에서 인증서에 관한 안내 HTML을 보내줘야 함
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
    // 결과 클라이언트에 전송
    // result.html수정 
    // const resultPath = path.join(process.cwd(), '/views/result.html')
    // var resultHTML = fs.readFileSync(resultPath, 'utf8');
    // resultHTML = resultHTML.replace("<div></div>", `<div><p>Transaction has been evaluated: ${txresult}</p></div>`);
    // res.status(200).send(resultHTML);
    const obj = JSON.parse(txresult);
    res.status(200).json(obj);
})

// ASSET GET /history
app.get('/assets', async(req, res)=>{
    // 어플리케이션 요청문서에서 파라미터 꺼내기 ( POST method에서는 query에서 꺼냄 )
    const key   = req.query.key;
    const id    = req.query.id;
    console.log('/assets-get-'+key);
    // 인증서작업 -> user1
    const walletPath = path.join(process.cwd(), 'wallet') // ~/dev/first-project/application/wallet
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists) {
        console.log(`An identity for the user ${id} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        // 클라이언트에서 인증서에 관한 안내 HTML을 보내줘야 함
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
    // 결과 클라이언트에 전송
    // result.html수정 
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
    // 인증서작업 -> id
    const walletPath = path.join(process.cwd(), 'wallet')
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);
    const userExists = await wallet.exists(id);
    if(!userExists) {
        console.log(`An identity for the user ${id} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        // 클라이언트에서 인증서에 관한 안내 HTML을 보내줘야 함
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
