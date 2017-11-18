﻿var db = require('../utils/db');

var rooms = {};
var creatingRooms = {};

var userLocation = {};
var totalRooms = 0;

var JU_SHU_COST = [2,3];

function generateRoomId(){
	var roomId = "";
	for(var i = 0; i < 6; ++i){
		roomId += Math.floor(Math.random()*10);
	}
	return roomId;
}

function constructRoomFromDb(dbdata){
	var roomInfo = {
		uuid:dbdata.uuid,
		id:dbdata.id,
		numOfGames:dbdata.num_of_turns,
		createTime:dbdata.create_time,
		nextButton:dbdata.next_button,
		fengxiang:dbdata.fengxiang,
		beginButton:dbdata.begin_button,
		seats:new Array(4),
		conf:JSON.parse(dbdata.base_info)
	};


	roomInfo.gameMgr = require("./gamemgr_" + roomInfo.conf.type);
	var roomId = roomInfo.id;

	for(var i = 0; i < 4; ++i){
		var s = roomInfo.seats[i] = {};
		s.userId = dbdata["user_id" + i];
		s.score = dbdata["user_score" + i];
		s.name = dbdata["user_name" + i];
		s.ready = false;
		s.seatIndex = i;
		s.numZiMo = 0;
		s.numJiePao = 0;
		s.numDianPao = 0;
		s.numAnGang = 0;
		s.numMingGang = 0;
		s.numChaJiao = 0;

		if(s.userId > 0){
			userLocation[s.userId] = {
				roomId:roomId,
				seatIndex:i
			};
		}
	}
	rooms[roomId] = roomInfo;
	totalRooms++;
	return roomInfo;
}

exports.createRoom = function(creator,roomConf,gems,ip,port,callback){
	//验证创建房间参数合法性 每个游戏需要的选项不一样
	switch(roomConf.type) {
		case "ddh":
			if(
				roomConf.type == null
				|| roomConf.koufei == null
				|| roomConf.quanshu == null){
				callback(1,null);
				return;
			}
			break;
		case "yzmj":
			if(
				roomConf.type == null
				|| roomConf.koufei == null
				|| roomConf.quanshu == null
				|| roomConf.difen == null){
				callback(1,null);
				return;
			}
			break;
	}

	//圈数 012 表示 局数为4局 8局 16局


	if(roomConf.koufei < 0 || roomConf.koufei > 1){
		callback(1,null);
		return;
	}

	if(roomConf.quanshu < 0 || roomConf.quanshu > 1){
		callback(1,null);
		return;
	}

	if(roomConf.difen && (roomConf.jiesuan < 0 || roomConf.quanshu > 1)){
		callback(1,null);
		return;
	}


	//房主出資
	if( roomConf.koufei == 0 ) {
		//半圈
		if(roomConf.quanshu == 0 && gems < 3) {callback( 2222 , null );return;}
		//一圈
		if(roomConf.quanshu == 1 && gems < 6) {callback( 2222 , null );return;}
	}
	//玩家平分
	else if ( roomConf.koufei == 1 ) {
		//半圈
		if(roomConf.quanshu == 0 && gems < 1) {callback( 2222 , null );return;}
		//一圈
		if(roomConf.quanshu == 1 && gems < 2) {callback( 2222 , null );return;}
	}

	var fnCreate = function() {
		var roomId = generateRoomId();
		if(rooms[roomId] != null || creatingRooms[roomId] != null){
			fnCreate();
		}
		else{
			creatingRooms[roomId] = true;
			db.is_room_exist(roomId, function(ret) {

				if(ret){
					delete creatingRooms[roomId];
					fnCreate();
				}
				else{
					//相当于掷色子定庄家
					var beginButton = parseInt(Math.random()*4);
					var createTime = Math.ceil(Date.now()/1000);
					var roomInfo = {
						uuid:"",
						id:roomId,
						numOfGames:1,
						fengxiang:0,//风向 0123 东南西北
						fengxiangju:1,
						createTime:createTime,
						beginButton:beginButton,
						nextButton:beginButton,
						seats:[],
						//標記是否結算
						ifPayed: false,
						conf:{
							type:roomConf.type,
							koufei:roomConf.koufei,
							quanshu:roomConf.quanshu,
							difen:roomConf.difen,
							creator:creator,
						}
					};

					if(roomConf.type == "ddh"){
						roomInfo.gameMgr = require("./gamemgr_ddh");
					}else if(roomConf.type == "yzmj"){
						roomInfo.gameMgr = require("./gamemgr_yzmj");
					}

					for(var i = 0; i < 4; ++i){
						roomInfo.seats.push({
							userId:0,
							score:0,
							name:"",
							ready:false,
							seatIndex:i,
							numZiMo:0,
							numJiePao:0,
							numDianPao:0,
							numAnGang:0,
							numMingGang:0,
						});
					}


					//写入数据库
					var conf = roomInfo.conf;
					db.create_room(roomInfo.id,roomInfo.conf,ip,port,createTime,function(uuid){
						delete creatingRooms[roomId];
						if(uuid != null){
							roomInfo.uuid = uuid;
							console.log(uuid);
							rooms[roomId] = roomInfo;
							totalRooms++;
							callback(0,roomId);
						}
						else{
							callback(3,null);
						}
					});
				}
			});
		}
	}
	fnCreate();
};

exports.destroy = function(roomId){
	var roomInfo = rooms[roomId];
	if(roomInfo == null){
		return;
	}

	for(var i = 0; i < 4; ++i){
		var userId = roomInfo.seats[i].userId;
		if(userId > 0){
			delete userLocation[userId];
			db.set_room_id_of_user(userId,null);
		}
	}

	delete rooms[roomId];
	totalRooms--;
	db.delete_room(roomId);
}

exports.getTotalRooms = function(){
	return totalRooms;
}

exports.getRoom = function(roomId){
	return rooms[roomId];
};

exports.isCreator = function(roomId,userId){
	var roomInfo = rooms[roomId];
	if(roomInfo == null){
		return false;
	}
	return roomInfo.conf.creator == userId;
};

exports.enterRoom = function(roomId,userId,userName,callback){
	db.getRoomConfById(roomId,function(conf){
		if(conf){
			var koufei = conf.koufei;
			var quanshu = conf.quanshu;
			var gems = 0;
			db.getGemsById(userId,function(data){
				gems = data;

				if(koufei==1){
					if(quanshu==0 && gems < 1){
						callback(5);
						return;
					}
					if(quanshu==1 && gems < 2){
						callback(5);
						return;
					}
				}

				var fnTakeSeat = function(room){
					if(exports.getUserRoom(userId) == roomId){
						//已存在
						return 0;
					}

					for(var i = 0; i < 4; ++i){
						var seat = room.seats[i];
						if(seat.userId <= 0){
							seat.userId = userId;
							seat.name = userName;
							userLocation[userId] = {
								roomId:roomId,
								seatIndex:i
							};
							db.update_seat_info(roomId,i,seat.userId,"",seat.name);
							//正常
							return 0;
						}
					}
					//房间已满
					return 1;
				};
				var room = rooms[roomId];
				if(room){
					var ret = fnTakeSeat(room);
					callback(ret);
				}
				else{
					db.get_room_data(roomId,function(dbdata){
						if(dbdata == null){
							//找不到房间
							callback(2);
						}
						else{
							//construct room.
							room = constructRoomFromDb(dbdata);
							//
							var ret = fnTakeSeat(room);
							callback(ret);
						}
					});
				}
			});
		}else{
			callback(2);
		}
	});



};

exports.setReady = function(userId,value){
	var roomId = exports.getUserRoom(userId);
	if(roomId == null){
		return;
	}

	var room = exports.getRoom(roomId);
	if(room == null){
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if(seatIndex == null){
		return;
	}

	var s = room.seats[seatIndex];
	s.ready = value;
}

exports.isReady = function(userId){
	var roomId = exports.getUserRoom(userId);
	if(roomId == null){
		return;
	}

	var room = exports.getRoom(roomId);
	if(room == null){
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if(seatIndex == null){
		return;
	}

	var s = room.seats[seatIndex];
	return s.ready;
}

exports.getUserRoom = function(userId){
	var location = userLocation[userId];
	if(location != null){
		return location.roomId;
	}
	return null;
};

exports.getUserSeat = function(userId){
	var location = userLocation[userId];
	if(location != null){
		return location.seatIndex;
	}
	return null;
};

exports.getUserLocations = function(){
	return userLocation;
};

exports.exitRoom = function(userId){
	var location = userLocation[userId];
	if(location == null)
		return;

	var roomId = location.roomId;
	var seatIndex = location.seatIndex;
	var room = rooms[roomId];
	delete userLocation[userId];
	if(room == null || seatIndex == null) {
		return;
	}

	var seat = room.seats[seatIndex];
	seat.userId = 0;
	seat.name = "";

	var numOfPlayers = 0;
	for(var i = 0; i < room.seats.length; ++i){
		if(room.seats[i].userId > 0){
			numOfPlayers++;
		}
	}

	db.set_room_id_of_user(userId,null);

	if(numOfPlayers == 0){
		exports.destroy(roomId);
	}
};
