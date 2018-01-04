function checkSingle(seatData, hun){
	var holds = seatData.holds;
	var selected = -1;
	var c = 0;
  var map = seatData.countMap
	console.log("start")
	for(var i = 0; i < holds.length; ++i){
		var pai = holds[i];
		c = seatData.countMap[pai];
		if(c != 0 && pai != hun){
			selected = pai;
			break;
		}
	}
	console.log(selected)
	console.log(seatData)
	//如果没有找到剩余牌，则表示匹配成功了
	if(selected == -1){
    if(map[hun]>=3) seatData.kanzi.push([hun,hun,hun])
		return true;
	}

  //否则，进行匹配
  //AAA
  if(map[selected]>=3) {
    seatData.countMap[selected] -=3;
    var ret = checkSingle(seatData,hun);
    seatData.countMap[selected] +=3;
		if(ret == true){
			seatData.kanzi.push([selected,selected,selected]);
			return true;
		}
  }
  //AAH
  if(map[selected]>=2 && map[hun]>=1) {
    map[selected] -=2;
    map[hun] -=1;
    var ret = checkSingle(seatData,hun);
    map[selected] +=2;
    map[hun] +=1;
		if(ret == true){
			seatData.kanzi.push([selected,selected,hun]);
			return true;
		}
  }
  //AH A-1
  if(map[selected]>=1
    && map[selected-1]>=1
    && map[hun]>=1
    && selected != 0
    && selected != 9
    && selected != 18
    && selected <27
  ) {
    map[selected] -=1;
    map[selected-1] -=1;
    map[hun] -=1;
    var ret = checkSingle(seatData,hun);
    map[selected] +=1;
    map[selected-1] +=1;
    map[hun] +=1;
    if(ret == true){
      seatData.kanzi.push([selected-1,selected,hun]);
      return true;
    }
  }
  //AH A-2
  if(map[selected]>=1
    && map[selected-2]>=1
    && map[hun]>=1
    && selected != 0
    && selected != 1
    && selected != 9
    && selected != 10
    && selected != 18
    && selected != 19
    && selected <27
  ){
    map[selected] -=1;
    map[selected-2] -=1;
    map[hun] -=1;
    var ret = checkSingle(seatData,hun);
    map[selected] +=1;
    map[selected-2] +=1;
    map[hun] +=1;
    if(ret == true){
      seatData.kanzi.push([selected-2,hun,selected]);
      return true;
    }
  }
  //AH A+1
  if(map[selected]>=1
    && map[selected+1]>=1
    && map[hun]>=1
    && selected != 8
    && selected != 17
    && selected != 26
    && selected <27
  ){
    map[selected] -=1;
    map[selected+1] -=1;
    map[hun] -=1;
    var ret = checkSingle(seatData,hun);
    map[selected] +=1;
    map[selected+1] +=1;
    map[hun] +=1;
    if(ret == true){
      seatData.kanzi.push([selected,selected+1,hun]);
      return true;
    }
  }
  //AH A+2
  if(map[selected]>=1
    && map[selected+2]>=1
    && map[hun]>=1
    && selected != 8
    && selected != 7
    && selected != 17
    && selected != 16
    && selected != 26
    && selected != 25
    && selected <27
  ){
    map[selected] -=1;
    map[selected+2] -=1;
    map[hun] -=1;
    var ret = checkSingle(seatData,hun);
    map[selected] +=1;
    map[selected+2] +=1;
    map[hun] +=1;
    if(ret == true){
      seatData.kanzi.push([selected,hun,selected+2]);
      return true;
    }
  }
  //A A-1 A+1
  if(map[selected]>=1
    && map[selected-1]>=1
    && map[selected+1]>=1
    && selected != 0
    && selected != 8
    && selected != 9
    && selected != 17
    && selected != 18
    && selected != 26
    && selected <27
  ){
    map[selected]   -=1;
    map[selected-1] -=1;
    map[selected+1] -=1;
    var ret = checkSingle(seatData,hun);
    map[selected]   +=1;
    map[selected-1] +=1;
    map[selected+1] +=1;
    if(ret == true){
      seatData.kanzi.push([selected-1,selected,selected+1]);
      return true;
    }
  }
  //A A-1 A-2
  if(map[selected]>=1
    && map[selected-1]>=1
    && map[selected-2]>=1
    && selected != 0
    && selected != 1
    && selected != 9
    && selected != 10
    && selected != 27
    && selected != 28
    && selected <27
  ){
    map[selected]   -=1;
    map[selected-1] -=1;
    map[selected-2] -=1;
    var ret = checkSingle(seatData,hun);
    map[selected]   +=1;
    map[selected-1] +=1;
    map[selected-2] +=1;
    if(ret == true){
      seatData.kanzi.push([selected-2,selected-1,selected]);
      return true;
    }
  }
  //A A+1 A+2
  if(map[selected]>=1
    && map[selected+1]>=1
    && map[selected+2]>=1
    && selected != 7
    && selected != 8
    && selected != 16
    && selected != 17
    && selected != 25
    && selected != 26
    && selected <27
  ){
    map[selected]   -=1;
    map[selected+1] -=1;
    map[selected+2] -=1;
    var ret = checkSingle(seatData,hun);
    map[selected]   +=1;
    map[selected+1] +=1;
    map[selected+2] +=1;
    if(ret == true){
      seatData.kanzi.push([selected,selected+1,selected+2]);
      return true;
    }
  }

  return false
}

function checkCanHu(seatData, hun){
  //克隆seatData对象
  var sd = cloneNewSeatData(seatData)
  //如果有混子
  if(hun){
    //这里讨论混子和拍作为将对的情况
    //那么有两种  HH | HA |AA
    if(sd.countMap[hun]>=2){
      // HH 混混将对
      sd.countMap[hun] -= 2;
      if(checkSingle(sd,hun) ){
        sd.kanzi.push([hun,hun])
        return sd.kanzi;
      }
      sd.countMap[hun] += 2;
    }
    if(sd.countMap[hun]>=1){
      // HA 混牌将对
      for(var key in sd.countMap){
        var count = sd.countMap[key]
        if(count && count>0 && key!=hun){
          sd.countMap[hun] -= 1;
          sd.countMap[key] -= 1;
          if(checkSingle(sd,hun)) {
            sd.kanzi.push([hun,Number(key)])
            return sd.kanzi;
          }
          sd.countMap[hun] += 1;
          sd.countMap[key] += 1;
        }
      }
    }
  }
  for(var k in sd.countMap){
    k = parseInt(k);
    var c = sd.countMap[k];
    if(c < 2){
      continue;
    }
		// console.log(k)
    //如果当前牌大于等于２，则将它选为将牌
    sd.countMap[k] -= 2;
    var ret = checkSingle(sd,hun);
    sd.countMap[k] += 2;
    if(ret){
      sd.kanzi.push([k,k])
      return sd.kanzi;
    }
  }
  return false;
}

function checkPairs (seatData, hun) {
  var holds = seatData.holds;
  var selected = -1;
  var map = seatData.countMap
  for(var i = 0; i < holds.length; ++i){
    var pai = holds[i];
    c = seatData.countMap[pai];
    if(c != 0 && pai != hun){
      selected = pai;
      break;
    }
  }
  //如果没有找到剩余牌，则表示匹配成功了
  if(selected == -1){
    if(map[hun]==2) seatData.kanzi.push([hun,hun])
    if(map[hun]==4) seatData.kanzi.push([hun,hun],[hun,hun])
    return true;
  }

  if(map[selected]>=2) {
    seatData.countMap[selected] -=2;
    var ret = checkPairs(seatData,hun);
    seatData.countMap[selected] +=2;
    if(ret == true){
      seatData.kanzi.push([selected,selected]);
      return true;
    }
  }
  if(map[selected]>=1 && map[hun]>=1) {
    seatData.countMap[selected] -=1;
    seatData.countMap[hun] -=1;
    var ret = checkPairs(seatData,hun);
    seatData.countMap[selected] +=1;
    seatData.countMap[hun] -=1;
    if(ret == true){
      seatData.kanzi.push([selected,hun]);
      return true;
    }
  }
  return false
}

function check7Pairs (seatData,hun) {
  if(seatData.holds.length != 14) return false
  //克隆seatData对象
  var sd = cloneNewSeatData(seatData)
  var ret = checkPairs(sd, hun)
  if(ret){
    return sd.kanzi
  }else{
    return false
  }
}

function cloneNewSeatData(seatData){
  var sd = {}
  sd.countMap = {}
  for (var key in seatData.countMap){
    sd.countMap[key] = seatData.countMap[key]
  }
  sd.holds = [].concat(seatData.holds)
  sd.kanzi = []
  return sd
}

function checkTingPai(seatData,begin,end,hun){
	for(var i = begin; i < end; ++i){
		//如果这牌已经在和了，就不用检查了
		if(seatData.tingMap[i] != null){
			continue;
		}
		//将牌加入到计数中
		var old = seatData.countMap[i];
		if(old == null){
			old = 0;
			seatData.countMap[i] = 1;
		}
		else{
			seatData.countMap[i] ++;
		}

		seatData.holds.push(i);
		//逐个判定手上的牌
		var ret = checkCanHu(seatData,hun);
		if(seatData.game.conf.qidui){
			var ret2 = check7Pairs(seatData,hun);
		}
		if(ret){
			//平胡
			seatData.tingMap[i] = {
				pattern:"normal",
			};
		}
		if(ret2){
			//zha7dui
			seatData.tingMap[i] = {
				pattern:"7pairs",
			};
		}

		//搞完以后，撤消刚刚加的牌
		seatData.countMap[i] = old;
		seatData.holds.pop();
	}
	console.log(seatData.tingMap)
}



exports.checkCanHu = checkCanHu
exports.check7Pairs = check7Pairs
exports.checkTingPai = checkTingPai


// mahjongs = [18,19,20,21,22,23,25,26,27,27,30,30,24,7]
// mahjongs =  [ 27, 27, 21, 19, 30, 30, 20, 7, 26, 25, 22, 18, 23, 24 ]
// for(var i = 0; i < mahjongs.length; ++i){
// 		var lastIndex = mahjongs.length - 1 - i;
// 		var index = Math.floor(Math.random() * lastIndex);
// 		var t = mahjongs[index];
// 		mahjongs[index] = mahjongs[lastIndex];
// 		mahjongs[lastIndex] = t;
// }
// var sd = {
// 	countMap:{18:1,19:1,20:1,21:1,22:1,23:1,25:1,26:1,27:2,30:2,24:1,7:1},
// 	holds:mahjongs,
// 	kanzi:[]
// }
// console.log(sd)
// console.log(checkCanHu(sd,7))