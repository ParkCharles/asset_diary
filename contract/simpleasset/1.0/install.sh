#!/bin/bash
set -x

# 1. 설치
docker exec cli peer chaincode install -n simpleasset -v 1.0 -p github.com/simpleasset/1.1

# 2. 업그레이드
docker exec cli peer chaincode instantiate -n simpleasset -v 1.0 -c '{"Args":["a","100"]}' -C mychannel -P 'AND ("Org1MSP.member")'
sleep 3

# 3. 인보크: set a, set b, transfer
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["set","a","150"]}'
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["set","b","200"]}'
sleep 3 # 블록 간의 차이를 보여주기 위해 시간차를 두는 것

# 4. 쿼리: get a, get b, history b
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["get","a"]}'
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["get","b"]}'