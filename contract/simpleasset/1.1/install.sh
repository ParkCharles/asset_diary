#!/bin/bash
set -x

if [ $# -ne 4 ]; then
    echo "not enough parameters"
    echo "ex) ./install.sh simpleasset 1.1 instantiate mychannel"
    echo "ex) ./install.sh simpleasset 1.1.1 upgrade mychannel"

    exit 1
fi

ccname=$1
version=$2
instruction=$3  #instantiate / upgrade
chname=$4

# 1. 설치
docker exec cli peer chaincode install -n $ccname -v $version -p github.com/$ccname/1.1
docker exec -e "CORE_PEER_ADDRESS=peer0.org3.example.com:7051" -e "CORE_PEER_LOCALMSPID=Org3MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp" cli peer chaincode install -n $ccname -v $version -p github.com/$ccname/1.1

# 2. 배포/업그레이드
docker exec cli peer chaincode $instruction -n $ccname -v $version -c '{"Args":[]}' -C $chname -P 'OR ("Org1MSP.member", "Org3MSP.member")'
sleep 3
# 3. 인보크 set a, set b, transfer
docker exec cli peer chaincode invoke -n $ccname -C $chname -c '{"Args":["set","c","300"]}'
docker exec cli peer chaincode invoke -n $ccname -C $chname -c '{"Args":["set","d","400"]}'
sleep 3
docker exec cli peer chaincode invoke -n $ccname -C $chname -c '{"Args":["transfer","c","d","50"]}'
sleep 3
# 4. 쿼리: get a, get b, history b
docker exec cli peer chaincode query -n $ccname -C $chname -c '{"Args":["get","c"]}'
docker exec cli peer chaincode query -n $ccname -C $chname -c '{"Args":["get","d"]}'
docker exec cli peer chaincode query -n $ccname -C $chname -c '{"Args":["history","d"]}'

# 5. 삭제와 확인: del b, get b, history b
docker exec cli peer chaincode invoke -n $ccname -C $chname -c '{"Args":["del","d"]}'
sleep 3
docker exec cli peer chaincode query -n $ccname -C $chname -c '{"Args":["get","d"]}'
docker exec cli peer chaincode query -n $ccname -C $chname -c '{"Args":["history","d"]}'