/*
Copyright Zhigui.com. All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

package main

import (
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"encoding/json"
  "strconv"
)

var logger = shim.NewLogger("mqtt")

type MQTTMessage struct {
  Id       uint64 `json:"id"`
  Sn       uint64 `json:"sn"`
  Time     uint64 `json:"time"`
  DeviceId uint32 `json:"deviceId"`
	Opened   bool   `json:"opened"`
  CodeType uint32 `json:"codeType"`
}

type MQTT struct {
}

func (mqtt *MQTT) Init(stub shim.ChaincodeStubInterface) pb.Response {
	// add the initialization logic and process
	return shim.Success(nil)
}

func (mqtt *MQTT) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
  // dispatch the function invocation to different methods
	function, args := stub.GetFunctionAndParameters()

  switch function {
  case "add":
    return mqtt.add(stub, args)
  default:
    return shim.Error("Invalid function name.")
  }
}

func (mqtt *MQTT) add(stub shim.ChaincodeStubInterface, args []string) pb.Response {
  if len(args) != 6 {
		return shim.Error("Incorrect number of arguments. Expecting 6.")
	}

  id, err := strconv.ParseUint(args[0], 10, 64)
  if err != nil {
    return shim.Error(err.Error())
  }
  sn, err := strconv.ParseUint(args[1], 10, 64)
  if err != nil {
    return shim.Error(err.Error())
  }
  time, err := strconv.ParseUint(args[2], 10, 64)
  if err != nil {
    return shim.Error(err.Error())
  }
  deviceId, err := strconv.ParseUint(args[3], 10, 32)
  if err != nil {
    return shim.Error(err.Error())
  }
  opened, err := strconv.ParseBool(args[4])
  if err != nil {
    return shim.Error(err.Error())
  }
  codeType, err := strconv.ParseUint(args[5], 10, 32)
  if err != nil {
    return shim.Error(err.Error())
  }

  mqttMessage := MQTTMessage {
    Id: id,
    Sn: sn,
    Time: time,
    DeviceId: uint32(deviceId),
    Opened: opened,
    CodeType: uint32(codeType),
  }
  jsonValue, err := json.Marshal(mqttMessage)
  if err != nil {
    return shim.Error(err.Error())
  }

  if errState := stub.PutState(strconv.FormatUint(id, 10), jsonValue); errState != nil {
    return shim.Error(errState.Error())
  }
  return shim.Success(jsonValue)
}

func main() {
  err := shim.Start(new(MQTT))
  if err != nil {
    fmt.Printf("Error starting MQTT chaincode: %s", err)
  }
}
