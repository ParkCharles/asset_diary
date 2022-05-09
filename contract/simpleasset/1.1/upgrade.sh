#!/bin/bash
set -x

# 1. 설치
docker exec cli peer chaincode install -n simpleasset -v 1.1.1 -p github.com/simpleasset/1.1

# 2. 업그레이드
docker exec cli peer chaincode upgrade -n simpleasset -v 1.1.1 -c '{"Args":[]}' -C mychannel -P 'AND ("Org1MSP.member")'
sleep 3

# 3. 인보크: set a, set b, transfer
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["set","c","300"]}'
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["set","d","400"]}'
sleep 3 # 블록 간의 차이를 보여주기 위해 시간차를 두는 것
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["transfer","c","d","50"]}'

# 4. 쿼리: get a, get b, history b
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["get","c"]}'
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["get","d"]}'
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["history","d"]}'

# 5. 삭제와 확인: del b, get b, history b
docker exec cli peer chaincode invoke -n simpleasset -C mychannel -c '{"Args":["del","d"]}'
sleep 3
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["get","d"]}'
docker exec cli peer chaincode query -n simpleasset -C mychannel -c '{"Args":["history","d"]}'
