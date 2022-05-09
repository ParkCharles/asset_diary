# asset_diary

## Hyperledger Fabric Network
network/
### generate network
./generate.sh
### start network
./start.sh

## Hyperledger Fabric Chaincode (Smart Contract)
contract/simpleasset/1.1/
### install chaincode
./install.sh simpleasset 1.1 instantiate mychannel

## Web Service (nodeJS)
app/
### CA, Wallet
node enrollAdmin.js<br>
node registerUser.js
### start server
npm start
### connect browser
localhost:8080

# please see below for details
https://charlespark.notion.site/Asset-Diary-db656b5bb7944316851722a954e87508
