var roomMgr = require("./roommgr");
var userMgr = require("./usermgr");
var mjutils = require('./mjutils');
var db = require("../utils/db");
var crypto = require("../utils/crypto");
var checkHu = require("./actions/checkHu")
var judge = require("./actions/judge")
var yangzhou = require("./actions/yangzhou")

var games = {};
var gamesIdBase = 0;

var ACTION_CHUPAI = 1;
var ACTION_MOPAI = 2;
var ACTION_PENG = 3;
var ACTION_GANG = 4;
var ACTION_CHI = 7;
var ACTION_HU = 5;
var ACTION_ZIMO = 6;
var ACTION_BUHUA = 8;

var gameSeatsOfUsers = {};

function getMJType(id){
    if(id >= 0 && id < 9){
        //筒
        return 0;
    }
    else if(id >= 9 && id < 18){
        //条
        return 1;
    }
    else if(id >= 18 && id < 27){
        //万
        return 2;
    }else{
        return 3;
    }
}

//洗牌 （已完成）
function shuffle(game) {



    /*
     * 0-8 為一到九筒
     * 9-17為一到九條
     * 18-26為一到九萬
     * 27、28、29為 中 發 白
     * 30 31 32 33 為 東 南 西 北 （是 東西南北 不是 東南西北！）
     * 34 35 36 37 為 春 夏 秋 冬
     * 38 39 40 41 為 梅 蘭 竹 菊
     * */

    var mahjongs = game.mahjongs;

    //筒 (0 ~ 8 表示筒子
    var index = 0;
    for(var i = 0; i < 9; ++i){
        for(var c = 0; c < 4; ++c){
            mahjongs[index] = i;
            index++;
        }
    }

    //条 9 ~ 17表示条子
    for(var i = 9; i < 18; ++i){
        for(var c = 0; c < 4; ++c){
            mahjongs[index] = i;
            index++;
        }
    }

    //万
    //条 18 ~ 26表示万
    for(var i = 18; i < 27; ++i){
        for(var c = 0; c < 4; ++c){
            mahjongs[index] = i;
            index++;
        }
    }

    //东南西北中发白
    for(var i = 27; i < 34; ++i){
        for(var c = 0; c < 4; ++c){
            mahjongs[index] = i;
            index++;
        }
    }

    //打亂順序
    for(var i = 0; i < mahjongs.length; ++i){
        var lastIndex = mahjongs.length - 1 - i;
        var index = Math.floor(Math.random() * lastIndex);
        var t = mahjongs[index];
        mahjongs[index] = mahjongs[lastIndex];
        mahjongs[lastIndex] = t;
    }

    // 有板子的时候去掉一个板子拍
    if(game.ban) {
      var index = mahjongs.indexOf(game.ban);
      if (index > -1) mahjongs.splice(index, 1);
    }

    // arr1 = [0,1,2,3,4,5,6,7,8,9,13,14,15,10] ; //7dui
    // arr2 =[0,1,2,3,4,5,6,7,8,10,10,12,12,13] ;// fengqing + 7dui
    // arr3 = [0,1,2,3,4,5,6,7,8,9,10,11,12,13] ;
    // arr4 =[0,1,2,3,4,5,6,7,8,9,11,11,11,13] ;
    //
    // arr = []
    // for ( var i = 0 ; i < 14 ; i++ ) {
    //   arr.push(arr1[i])
    //   arr.push(arr2[i]);
    //   arr.push(arr3[i]);
    //   arr.push(arr4[i]);
    // }
    // arr.push(12);
    // arr = arr.concat(mahjongs)
    // game.mahjongs = arr
}

//摸牌 （已完成）
function mopai(game,seatIndex) {
    if(game.currentIndex >= game.mahjongs.length){
        return -1;
    }
    var data = game.gameSeats[seatIndex];
    var mahjongs = data.holds;
    var pai = game.mahjongs[game.currentIndex];
    mahjongs.push(pai);
    //统计牌的数目 ，用于快速判定（空间换时间）
    var c = data.countMap[pai];
    if(c == null) {
        c = 0;
    }
    data.countMap[pai] = c + 1;
    game.currentIndex ++;
    return pai;
}

//发牌 （已完成）
function deal(game){
    //强制清0
    game.currentIndex = 0;

    //每人13张 一共 13*4 ＝ 52张 庄家多一张 53张
    var seatIndex = game.button;
    for(var i = 0; i < 52; ++i){
        var mahjongs = game.gameSeats[seatIndex].holds;
        if(mahjongs == null){
            mahjongs = [];
            game.gameSeats[seatIndex].holds = mahjongs;
        }
        mopai(game,seatIndex);
        seatIndex ++;
        seatIndex %= 4;

    }
    //庄家多摸最后一张
    mopai(game,game.button);
    //当前轮设置为庄家
    game.turn = game.button;
}

//检查是否可以碰
function checkCanPeng(game,seatData,targetPai) {
    var count = seatData.countMap[targetPai];
    // if(count != null && count == 2 && targetPai == game.ban){
    //     return
    // }
    if(count != null && count >= 2){
        seatData.canPeng = true;
    }
}

//检查是否可以点杠
function checkCanDianGang(game,seatData,targetPai){
    //检查玩家手上的牌
    //如果没有牌了，则不能再杠
    if(game.mahjongs.length <= game.currentIndex){
        return;
    }
    if(getMJType(targetPai) == seatData.que){
        return;
    }
    var count = seatData.countMap[targetPai];
    if(count != null && count >= 3){
        seatData.canGang = true;
        seatData.gangPai.push(targetPai);
        return;
    }
    // if( count != null && count >= 2 && targetPai == game.ban ){
    //     seatData.canGang = true;
    //     seatData.gangPai.push(targetPai);
    //     return;
    // }
}

//检查是否可以暗杠
function checkCanAnGang(game,seatData){
    //如果没有牌了，则不能再杠
    if(game.mahjongs.length <= game.currentIndex){
        return;
    }

    for(var key in seatData.countMap){
        var pai = parseInt(key);
        if(getMJType(pai) != seatData.que){
            var c = seatData.countMap[key];
            if(c != null && c == 4){
                seatData.canGang = true;
                seatData.gangPai.push(pai);
            }
            if(c != null && c == 3 && pai==game.ban){
                seatData.canGang = true;
                seatData.gangPai.push(pai);
            }
        }
    }
}

//检查是否可以弯杠(自己摸起来的时候)
function checkCanWanGang(game,seatData){
    //如果没有牌了，则不能再杠
    if(game.mahjongs.length <= game.currentIndex){
        return;
    }

    //从碰过的牌中选
    for(var i = 0; i < seatData.pengs.length; ++i){
        var pai = seatData.pengs[i];
        if(seatData.countMap[pai] == 1){
            seatData.canGang = true;
            seatData.gangPai.push(pai);
        }
    }
}

function checkCanHu(game,seatData,targetPai) {
    //如果放炮的人低于底分则不能胡
    if(seatData.seatIndex != game.turn) {
      if(game.conf.difen==0
      && game.gameSeats[game.turn].totalscore <= -20){
        return
      }
      if(game.conf.difen==1
      && game.gameSeats[game.turn].totalscore <= -30){
        return
      }
      if(game.conf.difen==2
      && game.gameSeats[game.turn].totalscore <= -50){
        return
      }
    }

    game.lastHuPaiSeat = -1;
    seatData.canHu = false;
    for(var k in seatData.tingMap){
        if(targetPai == k){
            seatData.canHu = true;
        }
    }
}

function clearAllOptions(game,seatData){
    var fnClear = function(sd){
        sd.canPeng = false;
        sd.canGang = false;
        sd.canChi = false;
        sd.gangPai = [];
        sd.canHu = false;
        sd.lastFangGangSeat = -1;
    }
    if(seatData){
        fnClear(seatData);
    }
    else{
        game.qiangGangContext = null;
        for(var i = 0; i < game.gameSeats.length; ++i){
            fnClear(game.gameSeats[i]);
        }
    }
}

//检查听牌
function checkCanTingPai(game,seatData){
    seatData.tingMap = {};

    //检查是否是七对 前提是没有碰，也没有杠 ，即手上拥有13张牌
    // if(seatData.holds.length == 13){
    //     //有5对牌
    //     var hu = false;
    //     var danPai = -1;
    //     var pairCount = 0;
    //     for(var k in seatData.countMap){
    //         var c = seatData.countMap[k];
    //         if( c == 2 || c == 3){
    //             pairCount++;
    //         }
    //         else if(c == 4){
    //             pairCount += 2;
    //         }
    //
    //         if(c == 1 || c == 3){
    //             //如果已经有单牌了，表示不止一张单牌，并没有下叫。直接闪
    //             if(danPai >= 0){
    //                 break;
    //             }
    //             danPai = k;
    //         }
    //     }
    //
    //     //检查是否有6对 并且单牌是不是目标牌
    //     if(pairCount == 6){
    //         //七对只能和一张，就是手上那张单牌
    //         //七对的番数＝ 2番+N个4个牌（即龙七对）
    //         seatData.tingMap[danPai] = {
    //             fan : 2,
    //             pattern : "7pairs"
    //         };
    //         //如果是，则直接返回咯
    //     }
    // }
    //检查是否是对对胡  由于四川麻将没有吃，所以只需要检查手上的牌
    //对对胡叫牌有两种情况
    //1、N坎 + 1张单牌
    //2、N-1坎 + 两对牌
    // var singleCount = 0;
    // var colCount = 0;
    // var pairCount = 0;
    // var arr = [];
    // for(var k in seatData.countMap){
    //     var c = seatData.countMap[k];
    //     if(c == 1){
    //         singleCount++;
    //         arr.push(k);
    //     }
    //     else if(c == 2){
    //         pairCount++;
    //         arr.push(k);
    //     }
    //     else if(c == 3){
    //         colCount++;
    //     }
    //     else if(c == 4){
    //         //手上有4个一样的牌，在四川麻将中是和不了对对胡的 随便加点东西
    //         singleCount++;
    //         pairCount+=2;
    //     }
    // }
    //
    // if((pairCount == 2 && singleCount == 0)
    // || (pairCount == 0 && singleCount == 1) ){
    //     for(var i = 0; i < arr.length; ++ i){
    //         //对对胡1番
    //         var p = arr[i];
    //         if(seatData.tingMap[p] == null){
    //             seatData.tingMap[p] = {
    //                 //pattern:"duidui",
    //                 fan:1
    //             };
    //         }
    //     }
    // }
    //检查是不是平胡
    // if(seatData.que != 0){
    //     mjutils.checkTingPai(seatData,0,9);
    // }
    //
    // if(seatData.que != 1){
    //     mjutils.checkTingPai(seatData,9,18);
    // }
    //
    // if(seatData.que != 2){
    //     mjutils.checkTingPai(seatData,18,27);
    // }

    checkHu.checkTingPai(seatData,0,34,game.hun);
    userMgr.sendMsg(seatData.userId,'game_tingmap_push',seatData.tingMap);
}

function getSeatIndex(userId){
    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }
    return seatIndex;
}

function getGameByUserID(userId){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return null;
    }
    var game = games[roomId];
    return game;
}

function hasOperations(seatData){
    if(seatData.canGang || seatData.canPeng || seatData.canHu || seatData.canChi){
        return true;
    }
    return false;
}

function sendOperations(game,seatData,pai) {
    if(hasOperations(seatData)){
        if(pai == -1){
            pai = seatData.holds[seatData.holds.length - 1];
        }

        var data = {
            pai:pai,
            hu:seatData.canHu,
            peng:seatData.canPeng,
            gang:seatData.canGang,
            gangpai:seatData.gangPai,
            chi:seatData.canChi,
            chitype:seatData.chitype
        };

        //如果可以有操作，则进行操作
        userMgr.sendMsg(seatData.userId,'game_action_push',data);
        console.log("game_action_pushing");

        data.si = seatData.seatIndex;
    }
    else{
        userMgr.sendMsg(seatData.userId,'game_action_push');
    }
}

function moveToNextUser(game,nextSeat){
    game.fangpaoshumu = 0;
    //找到下一个没有和牌的玩家
    if(nextSeat == null){
        while(true){
            game.turn ++;
            game.turn %= 4;
            var turnSeat = game.gameSeats[game.turn];
            if(turnSeat.hued == false){
                return;
            }
        }
    }
    else{
        game.turn = nextSeat;
    }
}

function doUserMoPai(game){
    game.chuPai = -1;
    var turnSeat = game.gameSeats[game.turn];
    turnSeat.lastFangGangSeat = -1;
    turnSeat.guoHuFan = -1;
    var pai = mopai(game,game.turn);
    //牌摸完了，结束
    if(pai == -1){
        doGameOver(game,turnSeat.userId);
        return;
    }
    else{
        var numOfMJ = game.mahjongs.length - game.currentIndex;
        userMgr.broacastInRoom('mj_count_push',numOfMJ,turnSeat.userId,true);
    }

    recordGameAction(game,game.turn,ACTION_MOPAI,pai);

    //通知前端新摸的牌
    userMgr.sendMsg(turnSeat.userId,'game_mopai_push',pai);
    //检查是否可以暗杠或者胡
    //检查胡，直杠，弯杠
    checkCanAnGang(game,turnSeat);
    checkCanWanGang(game,turnSeat,pai);

    //检查看是否可以和
    checkCanHu(game,turnSeat,pai);

    //广播通知玩家出牌方
    turnSeat.canChuPai = true;
    userMgr.broacastInRoom('game_chupai_push',turnSeat.userId,turnSeat.userId,true);

    //通知玩家做对应操作
    sendOperations(game,turnSeat,game.chuPai);
}

function isSameType(type,arr){
    for(var i = 0; i < arr.length; ++i){
        var t = getMJType(arr[i]);
        if(type != -1 && type != t){
            return false;
        }
        type = t;
    }
    return true;
}

/*********************************************************************
 *
 *
 *
 * ******************************************************************/

function calculateResult(game){
    console.log('calculateResult')
    var baseScore = game.conf.baseScore;
    var numOfHued = 0;
    for(var i = 0; i < game.gameSeats.length; ++i){
        var thisseat = game.gameSeats[i];
        //对对胡 混一色 清一色 炸7对 混7对 qing7队 混龙 清龙
        thisseat.duiduihu = false;
        thisseat.hunyise = false;
        thisseat.qingyise = false;
        thisseat.qidui = false;
        thisseat.zhaqidui = false;
        thisseat.long = false;
        thisseat.fengqing = false;
        if(game.gameSeats[i].hued == true){
            numOfHued++;
            var ret = checkHu.checkCanHu(thisseat,game.hun)
            var ret2 = checkHu.check7Pairs(thisseat,game.hun)
            var score  = 0
            if(judge.isQingYiSe(thisseat,game.hun)) {thisseat.qingyise = true;score +=8}
            if(judge.isHunYiSe(thisseat,game.hun)) {thisseat.hunyise = true;score +=4}
            if(game.conf.yitiaolong && judge.isLong(thisseat,game.hun)) {thisseat.long = true;score +=4}
            if(game.conf.fengqing && judge.isFengQing(thisseat,game.hun)) {thisseat.fengqing = true;score +=32}
            if(ret){
              thisseat.kanzi = ret;
              if(judge.isDuiDuiHu(thisseat,game.hun)) {thisseat.duiduihu = true;score +=4}
            }
            if(ret2) {
              thisseat.kanzi = ret2;
              thisseat.qidui = true;
              score +=4;
              if(judge.isZha7dui(thisseat,game.hun)) {thisseat.zhaqidui = true;  thisseat.qidui = false;score +=4}
            }
            if(score == 0 ) score = 2;
            if(thisseat.iszimo){
              // thisseat.score += score * 4
              // for(var i = 0; i < game.gameSeats.length; ++i){
              //    game.gameSeats[i].score -=score
              // }
              for(var j=0;j<4;j++){
                if(j!=i) yangzhou.koufen(game,i,j,score);
              }

            }else{
              // thisseat.score += score
              // game.gameSeats[game.fangpaoindex].score -=score
              yangzhou.koufen(game,i,game.fangpaoindex,score);
            }
        }
    }
}

function doGameOver(game,userId,forceEnd){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }

    var results = [];
    var dbresult = [0,0,0,0];

    var fnNoticeResult = function(isEnd){
        var endinfo = null;
        if(isEnd){
            endinfo = [];
            for(var i = 0; i < roomInfo.seats.length; ++i){
                var rs = roomInfo.seats[i];
                endinfo.push({
                    numzimo:rs.numZiMo,
                    numjiepao:rs.numJiePao,
                    numdianpao:rs.numDianPao,
                    numangang:rs.numAnGang,
                    numminggang:rs.numMingGang,
                    numchadajiao:rs.numChaJiao,
                });
            }
        }
        userMgr.broacastInRoom('game_over_push',{
          results:results,
          endinfo:endinfo
        },userId,true);
        //如果局数已够，则进行整体结算，并关闭房间
        if(isEnd){
            setTimeout(function(){
                if (roomInfo.numOfGames > 1) {
                    store_history(roomInfo);
                }

                userMgr.kickAllInRoom(roomId);
                roomMgr.destroy(roomId);


                db.archive_games(roomInfo.uuid);
            },1500);
        }
    };

    if(game != null){
        if(!forceEnd){
            //记录改局
            db.save_gamecp(game);
            calculateResult(game,roomInfo);
        }

        //判斷是否打完一局
        var isEnd = false;
        //记录所有人的总分以计算是否满足2家分数小于底分
        var alltotalscores = [];

        for(var i = 0; i < roomInfo.seats.length; ++i){
            var rs = roomInfo.seats[i];
            var sd = game.gameSeats[i];
            //rs为全局数据 sd为当前局数据 需要做加法。TODO：逻辑写完以后这里都需要加上
            rs.ready = false;
            rs.score = sd.totalscore;
            console.log(alltotalscores);
            console.log(rs.score)
            alltotalscores.push(rs.score);
            (sd.iszimo) ? rs.numZiMo ++ :{};
            (sd.hued && !sd.iszimo) ? rs.numJiePao ++ : {};
            (game.fangpaoindex == sd.seatIndex) ? rs.numDianPao ++ : {} ;
            rs.numAnGang += sd.angangs.length;
            rs.numMingGang += sd.diangangs.length + sd.wangangs.length;

            var userRT = {
                userId:sd.userId,
                pengs:sd.pengs,
                actions:[],
                wangangs:sd.wangangs,
                diangangs:sd.diangangs,
                angangs:sd.angangs,
                numofgen:sd.numofgen,
                holds:sd.holds,
                score:sd.score,
                totalscore:rs.score,
                qingyise:sd.qingyise,
                duiduihu:sd.duiduihu,
                hunyise:sd.hunyise,
                long:sd.long,
                fengqing : sd.fengqing,
                qidui:sd.qidui,
                zhaqidui:sd.zhaqidui,
                //pattern:sd.pattern,
                //isganghu:sd.isGangHu,
                //menqing:sd.isMenQing,
                //zhongzhang:sd.isZhongZhang,
                //jingouhu:sd.isJinGouHu,
                //haidihu:sd.isHaiDiHu,
                //tianhu:sd.isTianHu,
                //dihu:sd.isDiHu,
                huorder:game.hupaiList.indexOf(i),

                //舟山麻将需要发送当前局数 和 圈数
                gameindex:game.gameIndex,
                fengxiang:game.conf.fengxiang,
                fengxiangju:game.conf.fengxiangju,
            };

            //推入庄
            if(roomInfo.nextButton == i){
                userRT.button = true ;
            }else{
                userRT.button = false ;
            }

            for(var k in sd.actions){
                userRT.actions[k] = {
                    type:sd.actions[k].type,
                };
            }
            results.push(userRT);


            dbresult[i] = sd.score;
            delete gameSeatsOfUsers[sd.userId];
        }
        //扬州麻将底分逻辑
        if(yangzhou.isEndofDifen(game.conf.difen, alltotalscores)) isEnd = true;

        delete games[roomId];

        var old = roomInfo.nextButton;
        var quanshu = game.conf.quanshu;

        //風圈 風向變化
        //换庄逻辑 庄家赢或者留局则不换装，firstHupai为-1表示没人胡
        if(game.firstHupai != old && game.firstHupai!=-1) {
            roomInfo.nextButton = (old + 1) % 4;
            if(roomInfo.nextButton==roomInfo.beginButton){
                roomInfo.fengxiang = (roomInfo.fengxiang+1)%4;
                roomInfo.fengxiangju = 1
            }else{
                roomInfo.fengxiangju += 1
            }
        }



        var totaljus = roomInfo.fengxiangju + roomInfo.fengxiang * 4;

        //如果打一圈： 012 4局 8局 16局
        if(game.conf.quanshu==0 && totaljus>4) isEnd = true;
        if(game.conf.quanshu==1 && totaljus>8) isEnd = true;
        if(game.conf.quanshu==2 && totaljus>16) isEnd = true;

        roomInfo.numOfGames++;
        //庄家赢或者留局则不换装，firstHupai为
        if(old != roomInfo.nextButton){
            db.update_next_button(roomId,roomInfo.nextButton);
        }
    }

    if(forceEnd || game == null){
        fnNoticeResult(true);
    }
    else{
        //保存游戏
        store_game(game,function(ret){

            db.update_game_result(roomInfo.uuid,game.gameIndex,dbresult);

            //记录打牌信息
            var str = JSON.stringify(game.actionList);
            db.update_game_action_records(roomInfo.uuid,game.gameIndex,str);

            //保存游戏局数
            db.update_num_of_turns(roomId,roomInfo.numOfGames);

            //保存游戏风向
            db.update_fengxiang(roomId,roomInfo.fengxiang);

            //TODO 增加保存风圈局
            db.update_fengxiangju

            //保存开始的庄
            db.update_begin_button(roomId,roomInfo.beginButton);

            //扣除鑽石 TODO：
            if(roomInfo.ifPayed == false) {
                roomInfo.ifPayed = true;
                //房主出資 8盤為3鉆 一圈為6鉆； 玩家平分 8盤每位1鉆 一圈每位2鉆
                //房主出資
                if (roomInfo.conf.koufei == 0) {
                    //4局 房主扣4鉆
                    if (roomInfo.conf.quanshu == 0) {
                        db.cost_gems(roomInfo.conf.creator, 3);
                    }
                    //8局
                    if (roomInfo.conf.quanshu == 1) {
                        db.cost_gems(roomInfo.conf.creator, 7);
                    }
                    //16局
                    if (roomInfo.conf.quanshu == 2) {
                        db.cost_gems(roomInfo.conf.creator, 15);
                    }
                }
                //玩家平分
                else if (roomInfo.conf.koufei == 1) {
                    //4局 每位1鉆
                    if (roomInfo.conf.quanshu == 0) {
                        for (var i = 0; i < 4; i++) {
                            db.cost_gems(game.gameSeats[i].userId, 1);
                        }
                    }
                    //
                    if (roomInfo.conf.quanshu == 1) {
                        for (var i = 0; i < 4; i++) {
                            db.cost_gems(game.gameSeats[i].userId, 2);
                        }
                    }
                    //
                    if (roomInfo.conf.quanshu == 2) {
                        for (var i = 0; i < 4; i++) {
                            db.cost_gems(game.gameSeats[i].userId, 4);
                        }
                    }
                }
            }

            //var isEnd = (roomInfo.numOfGames >= roomInfo.conf.maxGames);
            fnNoticeResult(isEnd);
        });
    }
}

function recordUserAction(game,seatData,type,target){
    var d = {type:type,targets:[]};
    if(target != null){
        if(typeof(target) == 'number'){
            d.targets.push(target);
        }
        else{
            d.targets = target;
        }
    }
    else{
        for(var i = 0; i < game.gameSeats.length; ++i){
            var s = game.gameSeats[i];
            if(i != seatData.seatIndex && s.hued == false){
                d.targets.push(i);
            }
        }
    }

    seatData.actions.push(d);
    return d;
}

function recordGameAction(game,si,action,pai,other){
    game.actionList.push(si);
    game.actionList.push(action);
    if(pai != null){
        game.actionList.push(pai);
    }
    if(other != null){
        game.actionList.push([].concat(other));
    }
}

exports.setReady = function(userId,callback){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }

    roomMgr.setReady(userId,true);

    var game = games[roomId];
    if(game == null){
        if(roomInfo.seats.length == 4){
            for(var i = 0; i < roomInfo.seats.length; ++i){
                var s = roomInfo.seats[i];
                if(s.ready == false || userMgr.isOnline(s.userId)==false){
                    return;
                }
            }
            //4个人到齐了，并且都准备好了，则开始新的一局
            exports.begin(roomId);
        }
    }
    else{
        var numOfMJ = game.mahjongs.length - game.currentIndex;
        var remainingGames = roomInfo.conf.maxGames - roomInfo.numOfGames;

        var data = {
            fengxiang:roomInfo.fengxiang,
            fengxiangju:roomInfo.fengxiangju,
            hun:game.hun,
            ban:game.ban,
            state:game.state,
            numofmj:numOfMJ,
            button:game.button,
            turn:game.turn,
            chuPai:game.chuPai,
            huanpaimethod:game.huanpaiMethod
        };

        data.seats = [];
        var seatData = null;
        for(var i = 0; i < 4; ++i){
            var sd = game.gameSeats[i];


            var s = {
                userid:sd.userId,
                folds:sd.folds,
                angangs:sd.angangs,
                chis:sd.chis,
                huas:sd.huas,
                diangangs:sd.diangangs,
                wangangs:sd.wangangs,
                pengs:sd.pengs,
                que:sd.que,
                hued:sd.hued,
                iszimo:sd.iszimo,
            }
            if(sd.userId == userId){
                s.holds = sd.holds;
                s.huanpais = sd.huanpais;
                seatData = sd;
            }
            else{
                s.huanpais = sd.huanpais? []:null;
            }
            data.seats.push(s);
        }

        //同步整个信息给客户端
        userMgr.sendMsg(userId,'game_sync_push',data);
        sendOperations(game,seatData,game.chuPai);
    }
}

function store_single_history(userId,history){
    db.get_user_history(userId,function(data){
        if(data == null){
            data = [];
        }
        while(data.length >= 10){
            data.shift();
        }
        data.push(history);
        db.update_user_history(userId,data);
    });
}

function store_history(roomInfo){
    var seats = roomInfo.seats;
    var history = {
        uuid:roomInfo.uuid,
        id:roomInfo.id,
        time:roomInfo.createTime,
        seats:new Array(4)
    };

    for(var i = 0; i < seats.length; ++i){
        var rs = seats[i];
        var hs = history.seats[i] = {};
        hs.userid = rs.userId;
        hs.name = crypto.toBase64(rs.name);
        hs.score = rs.score;
    }

    for(var i = 0; i < seats.length; ++i){
        var s = seats[i];
        store_single_history(s.userId,history);
    }
}

function construct_game_base_info(game){
    var baseInfo = {
        type:game.conf.type,
        button:game.button,
        index:game.gameIndex,
        mahjongs:game.mahjongs,
        game_seats:new Array(4)
    }

    for(var i = 0; i < 4; ++i){
        baseInfo.game_seats[i] = game.gameSeats[i].holds;
    }
    game.baseInfoJson = JSON.stringify(baseInfo);
}

function store_game(game,callback){
    db.create_game(game.roomInfo.uuid,game.gameIndex,game.baseInfoJson,callback);
}

function checkCanQiangGang(game,turnSeat,seatData,pai){
    var hasActions = false;
    for(var i = 0; i < game.gameSeats.length; ++i){
        //杠牌者不检查
        if(seatData.seatIndex == i){
            continue;
        }
        var ddd = game.gameSeats[i];
        //已经和牌的不再检查
        if(ddd.hued){
            continue;
        }

        checkCanHu(game,ddd,pai);
        if(ddd.canHu){
            sendOperations(game,ddd,pai);
            hasActions = true;
        }
    }
    if(hasActions){
        game.qiangGangContext = {
            turnSeat:turnSeat,
            seatData:seatData,
            pai:pai,
            isValid:true,
        }
    }
    else{
        game.qiangGangContext = null;
    }
    return game.qiangGangContext != null;
}

function doGang(game,turnSeat,seatData,gangtype,numOfCnt,pai){
    var seatIndex = seatData.seatIndex;
    var gameTurn = turnSeat.seatIndex;

    var isZhuanShouGang = false;
    if(gangtype == "wangang"){
        var idx = seatData.pengs.indexOf(pai);
        if(idx >= 0){
            seatData.pengs.splice(idx,1);
        }

        //如果最后一张牌不是杠的牌，则认为是转手杠
        if(seatData.holds[seatData.holds.length - 1] != pai){
            isZhuanShouGang = true;
        }
    }
    //进行碰牌处理
    //扣掉手上的牌
    //从此人牌中扣除
    for(var i = 0; i < numOfCnt; ++i){
        var index = seatData.holds.indexOf(pai);
        if(index == -1){
            console.log("can't find mj.");
            return;
        }
        seatData.holds.splice(index,1);
        seatData.countMap[pai] --;
    }

    recordGameAction(game,seatData.seatIndex,ACTION_GANG,pai);

    //记录下玩家的杠牌
    if(gangtype == "angang"){
        seatData.angangs.push(pai);
        var ac = recordUserAction(game,seatData,"angang");
        ac.score = game.conf.baseScore*2;

        //收每家两份
        for(var i=0;i<4;i++){
          if(i!=seatIndex) yangzhou.koufen(game,seatIndex,i,2);
        }
        if(pai == game.ban) {
          yangzhou.koufen(game,seatIndex,i,2);
        }
    }
    else if(gangtype == "diangang"){
        seatData.diangangs.push(pai);
        var ac = recordUserAction(game,seatData,"diangang",gameTurn);
        ac.score = game.conf.baseScore*2;
        var fs = turnSeat;
        recordUserAction(game,fs,"fanggang",seatIndex);
        //收2分-
        yangzhou.koufen(game,seatIndex,gameTurn,2);
    }
    else if(gangtype == "wangang"){
        seatData.wangangs.push(pai);
        if(isZhuanShouGang == false){
            var ac = recordUserAction(game,seatData,"wangang");
            ac.score = game.conf.baseScore;
        }
        else{
            recordUserAction(game,seatData,"zhuanshougang");
        }
        //收每家1份
        for(var i=0;i<4;i++){
          if(i!=seatIndex) yangzhou.koufen(game,seatIndex,i,1);
        }
    }

    //到达底分则结算解散
    if(yangzhou.isEndofDifen0(game)){
      return doGameOver(game,game.roomInfo.seats[0].userId,true);
    }

    checkCanTingPai(game,seatData);
    //通知其他玩家，有人杠了牌
    userMgr.broacastInRoom('gang_notify_push',{userid:seatData.userId,pai:pai,gangtype:gangtype},seatData.userId,true);
    //通知其他玩家，gang分数变化
    userMgr.broacastInRoom('total_score_push',{totalscores:[
      game.gameSeats[0].totalscore,
      game.gameSeats[1].totalscore,
      game.gameSeats[2].totalscore,
      game.gameSeats[3].totalscore,
    ]},seatData.userId,true);

    //变成自己的轮子
    moveToNextUser(game,seatIndex);
    //标记刚刚杠过
    seatData.ifJustGanged = 1;
    //再次摸牌
    if(numOfCnt!=3 || pai!=game.ban) { doUserMoPai(game); }
    else {
      //广播通知玩家出牌方
      seatData.canChuPai = true;
      userMgr.broacastInRoom('game_chupai_push',seatData.userId,seatData.userId,true);
    }

    //只能放在这里。因为过手就会清除杠牌标记
    seatData.lastFangGangSeat = gameTurn;
}

/***********************************************************************
 *
 *  客户端发送事件侦听
 *
 * ********************************************************************/

 //开始新的一局
exports.begin = function(roomId) {
     var roomInfo = roomMgr.getRoom(roomId);
     if(roomInfo == null) return;

     //获取板子和混
     var ar = yangzhou.getBanZiAndPeiZi();
     var ban = ar[0]
     var hun = ar[1]
     if(!roomInfo.conf.peizi){
       ban=-1;
       hun=-1;
     }
     //
     // ban=12
     // hun=13


     var seats = roomInfo.seats;
     var game = {
         conf:roomInfo.conf,
         roomInfo:roomInfo,
         gameIndex:roomInfo.numOfGames,
         button:roomInfo.nextButton,
         fengxiang:roomInfo.fengxiang,
         fengxiangju:roomInfo.fengxiangju,
         mahjongs:new Array(136),
         currentIndex:0,
         gameSeats:new Array(4),
         turn:roomInfo.nextButton,
         ban:ban,
         hun:hun,
         chuPai:-1,
         state:"idle",
         firstHupai:-1,
         yipaoduoxiang:-1,
         actionList:[],
         hupaiList:[],
         chupaiCnt:0,
         fangpaoindex:-1,
     };

     for(var i = 0; i < 4; ++i){
         var data = game.gameSeats[i] = {};
         data.game = game;
         data.seatIndex = i;
         data.userId = seats[i].userId;
         //做的风位置
         data.feng = (4-game.button+i)%4
         //持有的牌
         data.holds= [];
         //打出的牌
         data.folds = [];
         //暗杠的牌
         data.angangs = [];
         //点杠的牌
         data.diangangs = [];
         //弯杠的牌
         data.wangangs = [];
         //碰了的牌
         data.pengs  = [];
         //是否刚刚杠过 (用于判断杠上花) 杠时会被重置为1，每次摸牌-1，如果胡的时候是0，则表示是杠上花
         data.ifJustGanged = -1;
         //玩家手上的牌的数目，用于快速判定碰杠
         data.countMap = {};
         //玩家听牌，用于快速判定胡了的番数
         data.tingMap = {};
         data.pattern = "";
         //是否可以杠
         data.canGang = false;
         //用于记录玩家可以杠的牌
         data.gangPai = [];
         //是否可以碰
         data.canPeng = false;
         //是否可以胡
         data.canHu = false;
         //是否可以出牌
         data.canChuPai = false;
         //记录所有坎子,如果胡牌了这里才会有
         data.kanzi = [];
         //如果guoHuFan >=0 表示处于过胡状态
         data.guoHuFan = -1;
         //是否胡了
         data.hued = false;
         //是否是自摸
         data.iszimo = false;
         data.isGangHu = false;
         data.actions = [];
         data.score = 0;
         data.totalscore = roomInfo.seats[i].score;
         //统计信息
         data.numZiMo = 0;
         data.numJiePao = 0;
         data.numDianPao = 0;
         data.numAnGang = 0;
         data.numMingGang = 0;
         data.numChaJiao = 0;
         gameSeatsOfUsers[data.userId] = data;
     }
     games[roomId] = game;
     //洗牌
     shuffle(game);
     //发牌
     deal(game);

     var numOfMJ = game.mahjongs.length - game.currentIndex;

     for(var i = 0; i < seats.length; ++i){
         //开局时，通知前端必要的数据
         var s = seats[i];
         //通知玩家手牌
         console.log(game.gameSeats[i].holds)
         //通知当前搬子
         userMgr.sendMsg(s.userId,'game_ban_push',game.ban);
         //通知当前混子
         userMgr.sendMsg(s.userId,'game_hun_push',game.hun);
         //通知当前风向开始
         userMgr.sendMsg(s.userId,'game_feng_push',game.roomInfo.fengxiang);
         userMgr.sendMsg(s.userId,'game_holds_push',game.gameSeats[i].holds);
         //通知还剩多少张牌
         userMgr.sendMsg(s.userId,'mj_count_push',numOfMJ);
         //通知当前是某风圈第几局
         userMgr.sendMsg(s.userId,'game_num_push',roomInfo.fengxiangju);
         //通知游戏开始
         userMgr.sendMsg(s.userId,'game_begin_push',game.button);

     }

     var seatData = gameSeatsOfUsers[seats[1].userId];
     construct_game_base_info(game);
     userMgr.broacastInRoom('game_playing_push',null,seatData.userId,true);

     //进行听牌检查
     for(var i = 0; i < game.gameSeats.length; ++i){
         var duoyu = -1;
         var gs = game.gameSeats[i];
         if(gs.holds.length == 14){
             duoyu = gs.holds.pop();
             gs.countMap[duoyu] -= 1;
         }
         checkCanTingPai(game,gs);
         if(duoyu >= 0){
             gs.holds.push(duoyu);
             gs.countMap[duoyu] ++;
         }
     }



     var turnSeat = game.gameSeats[game.turn];
     game.state = "playing";
     //通知玩家出牌方
     turnSeat.canChuPai = true;
     userMgr.broacastInRoom('game_chupai_push',turnSeat.userId,turnSeat.userId,true);
     //检查是否可以暗杠或者胡
     //直杠
     checkCanAnGang(game,turnSeat);
     //检查胡 用最后一张来检查
     checkCanHu(game,turnSeat,turnSeat.holds[turnSeat.holds.length - 1]);
     //通知前端
     sendOperations(game,turnSeat,game.chuPai);
 };

exports.chuPai = function(userId,pai){

    pai = Number.parseInt(pai);
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;
    var seatIndex = seatData.seatIndex;
    //如果不该他出，则忽略
    if(game.turn != seatData.seatIndex){
        console.log("not your turn.");
        return;
    }

    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }

    if(seatData.canChuPai == false){
        console.log('no need chupai.');
        return;
    }

    if(hasOperations(seatData)){
        console.log('plz guo before you chupai.');
        return;
    }

    //从此人牌中扣除
    var index = seatData.holds.indexOf(pai);
    if(index == -1){
        console.log("can't find mj." + pai);
        return;
    }

    seatData.canChuPai = false;
    game.chupaiCnt ++;
    seatData.guoHuFan = -1;

    seatData.holds.splice(index,1);
    seatData.countMap[pai] --;
    game.chuPai = pai;
    recordGameAction(game,seatData.seatIndex,ACTION_CHUPAI,pai);
    checkCanTingPai(game,seatData);

    userMgr.broacastInRoom('game_chupai_notify_push',{userId:seatData.userId,pai:pai},seatData.userId,true);

    //如果出的牌可以胡，则算过胡
    if(seatData.tingMap[game.chuPai]){
        seatData.guoHuFan = seatData.tingMap[game.chuPai].fan;
    }

    //检查是否有人要胡，要碰 要杠
    var hasActions = false;
    for(var i = 0; i < game.gameSeats.length; ++i){
        //玩家自己不检查
        if(game.turn == i){
            continue;
        }
        var ddd = game.gameSeats[i];
        //已经和牌的不再检查
        if(ddd.hued){
            continue;
        }
        if(!ddd.countMap[game.hun] || ddd.countMap[game.hun] == 0)
        checkCanHu(game,ddd,pai);
        if(seatData.lastFangGangSeat == -1){
            if(ddd.canHu && ddd.guoHuFan >= 0 && ddd.tingMap[pai].fan <= ddd.guoHuFan){
                console.log("ddd.guoHuFan:" + ddd.guoHuFan);
                ddd.canHu = false;
                userMgr.sendMsg(ddd.userId,'guohu_push');
            }
        }
        checkCanPeng(game,ddd,pai);
        checkCanDianGang(game,ddd,pai);
        //checkCanChi(game,ddd,pai);
        if(hasOperations(ddd)){
            sendOperations(game,ddd,game.chuPai);
            hasActions = true;
        }
    }

    //如果没有人有操作，则向下一家发牌，并通知他出牌
    if(!hasActions){
        setTimeout(function(){
            userMgr.broacastInRoom('guo_notify_push',{userId:seatData.userId,pai:game.chuPai},seatData.userId,true);
            seatData.folds.push(game.chuPai);
            game.chuPai = -1;
            moveToNextUser(game);
            doUserMoPai(game);
        },500);
    }
};

exports.peng = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;



    //如果是他出的牌，则忽略
    if(game.turn == seatData.seatIndex){
        console.log("it's your turn.");
        return;
    }



    //如果没有碰的机会，则不能再碰
    if(seatData.canPeng == false){
        console.log("seatData.peng == false");
        return;
    }

    //和的了，就不要再来了
    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }

    //如果有人可以胡牌，则需要等待
    var i = game.turn;
    while(true){
        var i = (i + 1)%4;
        if(i == game.turn){
            break;
        }
        else{
            var ddd = game.gameSeats[i];
            if(ddd.canHu && i != seatData.seatIndex){
                return;
            }
        }
    }


    clearAllOptions(game);

    //验证手上的牌的数目
    var pai = game.chuPai;
    var c = seatData.countMap[pai];
    if(c == null || c < 2){
        console.log("lack of mj.");
        return;
    }

    //进行碰牌处理
    //扣掉手上的牌
    //从此人牌中扣除
    for(var i = 0; i < 2; ++i){
        var index = seatData.holds.indexOf(pai);
        if(index == -1){
            console.log("can't find mj.");
            return;
        }
        seatData.holds.splice(index,1);
        seatData.countMap[pai] --;
    }
    seatData.pengs.push(pai);
    game.chuPai = -1;

    if(pai == game.ban) {
      yangzhou.koufen(game,seatData.seatIndex,game.turn,2)
    }
    //到达底分则结算解散
    if(yangzhou.isEndofDifen0(game)){
      return doGameOver(game,game.roomInfo.seats[0].userId,true);
    }
    //通知其他玩家，gang分数变化
    userMgr.broacastInRoom('total_score_push',{totalscores:[
      game.gameSeats[0].totalscore,
      game.gameSeats[1].totalscore,
      game.gameSeats[2].totalscore,
      game.gameSeats[3].totalscore,
    ]},seatData.userId,true);

    recordGameAction(game,seatData.seatIndex,ACTION_PENG,pai);

    //广播通知其它玩家
    userMgr.broacastInRoom('peng_notify_push',{userid:seatData.userId,pai:pai},seatData.userId,true);

    //碰的玩家打牌
    moveToNextUser(game,seatData.seatIndex);

    //广播通知玩家出牌方
    seatData.canChuPai = true;
    userMgr.broacastInRoom('game_chupai_push',seatData.userId,seatData.userId,true);




    //检查是否有人要胡，要碰 要杠s
    var hasActions = false;
    var ddd = seatData;
    //已经和牌的不再检查
    if(!ddd.hued){
        checkCanWanGang(game,ddd);
        if(hasOperations(ddd)){
            sendOperations(game,ddd,game.chuPai);
            hasActions = true;
        }
    }
    if(!hasActions) {
        //碰的玩家打牌
        moveToNextUser(game, seatData.seatIndex);
        //广播通知玩家出牌方
        seatData.canChuPai = true;
        userMgr.broacastInRoom('game_chupai_push', seatData.userId, seatData.userId, true);
    }
};

exports.chi = function(userId,data){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;

    //如果是他出的牌，则忽略
    if(game.turn == seatData.seatIndex){
        console.log("it's your turn.");
        return;
    }

    //如果没有碰的机会，则不能再吃
    if(seatData.canChi == false){
        console.log("seatData.chi == false");
        return;
    }
    //和的了，就不要再来了
    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }
    //如果有人可以胡牌，碰或杠，则需要等待
    var i = game.turn;
    while(true){
        var i = (i + 1)%4;
        if(i == game.turn){
            break;
        }
        else{
            var ddd = game.gameSeats[i];
            if(ddd.canPeng && i != seatData.seatIndex){
                return;
            }
            if(ddd.canGang && i != seatData.seatIndex){
                return;
            }
            if(ddd.canHu && i != seatData.seatIndex){
                return;
            }
        }
    }

    clearAllOptions(game);

    //验证手上的牌的数目
    var pai = game.chuPai;
    //吃牌数组
    var chigroup = new Array(2);
    if(data == "left"){
        chigroup[0] = pai+1;
        chigroup[1] = pai+2;
    }else if(data == "mid"){
        chigroup[0] = pai-1;
        chigroup[1] = pai+1;
    }else if(data == "right"){
        chigroup[0] = pai-2;
        chigroup[1] = pai-1;
    }
    var holds = seatData.holds;
    var ifHas = function(holds,pai){
        for(var i=0; i<holds.length; i++){
            if(holds[i] == pai) return true;
        }
        return false;
    }
    if(!ifHas(holds,chigroup[0]) || !ifHas(holds,chigroup[1])){
        return;
    }


    //进行吃牌处理
    //扣掉手上的牌
    //从此人牌中扣除
    for(var i = 0; i < 2; ++i){
        var index = seatData.holds.indexOf(chigroup[i]);
        if(index == -1){
            console.log("can't find mj.");
            return;
        }
        seatData.holds.splice(index,1);
        seatData.countMap[chigroup[i]] --;
    }
    chigroup[2] = pai;
    seatData.chis.push(chigroup);
    game.chuPai = -1;

    recordGameAction(game,seatData.seatIndex,ACTION_CHI,pai,chigroup);
    //广播通知其它玩家
    userMgr.broacastInRoom('chi_notify_push',{userid:seatData.userId,pai:pai,chigroup:chigroup},seatData.userId,true);
    //检查是否有人要胡，要碰 要杠s
    var hasActions = false;
    var ddd = seatData;
    //已经和牌的不再检查
    if(!ddd.hued){
        checkCanWanGang(game,ddd);
        if(hasOperations(ddd)){
            sendOperations(game,ddd,game.chuPai);
            hasActions = true;
        }
    }
    if(!hasActions) {
        //吃的玩家打牌
        moveToNextUser(game, seatData.seatIndex);
        //广播通知玩家出牌方
        seatData.canChuPai = true;
        userMgr.broacastInRoom('game_chupai_push', seatData.userId, seatData.userId, true);
    }
};

exports.isPlaying = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        return false;
    }

    var game = seatData.game;

    if(game.state == "idle"){
        return false;
    }
    return true;
};

exports.gang = function(userId,pai){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //如果没有杠的机会，则不能再杠
    if(seatData.canGang == false) {
        console.log("seatData.gang == false");
        return;
    }

    //和的了，就不要再来了
    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }

    if(seatData.gangPai.indexOf(pai) == -1){
        console.log("the given pai can't be ganged.");
        return;
    }

    //如果有人可以胡牌，则需要等待
    var i = game.turn;
    while(true){
        var i = (i + 1)%4;
        if(i == game.turn){
            break;
        }
        else{
            var ddd = game.gameSeats[i];
            if(ddd.canHu && i != seatData.seatIndex){
                return;
            }
        }
    }

    var numOfCnt = seatData.countMap[pai];

    var gangtype = ""
    //弯杠 去掉碰牌
    if(numOfCnt == 1){
        gangtype = "wangang"
    }
    else if(numOfCnt == 3  && pai!=game.ban){
        gangtype = "diangang"
    }
    else if(numOfCnt == 4 || (numOfCnt == 3 && pai==game.ban) ){
        gangtype = "angang";
    }
    else{
        console.log("invalid pai count.");
        return;
    }

    game.chuPai = -1;
    clearAllOptions(game);
    seatData.canChuPai = false;

    userMgr.broacastInRoom('hangang_notify_push',seatIndex,seatData.userId,true);

    //如果是弯杠，则需要检查是否可以抢杠
    var turnSeat = game.gameSeats[game.turn];
    if(numOfCnt == 1){
        var canQiangGang = checkCanQiangGang(game,turnSeat,seatData,pai);
        if(canQiangGang){
            return;
        }
    }

    doGang(game,turnSeat,seatData,gangtype,numOfCnt,pai);
};

exports.hu = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //如果他不能和牌，那和个啥啊
    if(seatData.canHu == false){
        console.log("invalid request.");
        return;
    }

    //和的了，就不要再来了
    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }

    //逆时针往前 如果有其他人可以胡，则不能胡
    var turn = game.turn;
    var si = (seatIndex+4-1)%4;
    while(si!=turn) {
        if(game.gameSeats[si].canHu){
            console.log('others can hu first');
            return;
        }
        si = (si+4-1)%4;
    }

    //标记为和牌
    seatData.hued = true;
    //其他能胡的人也标记为胡
    for(var i=0;i<4;i++){
      if(game.gameSeats[i].canHu && !game.gameSeats[i].hued) {
        game.gameSeats[i].hued = true;
        game.gameSeats[i].holds.push(game.chuPai)
        if(game.gameSeats[i].countMap[game.chuPai]){
            game.gameSeats[i].countMap[game.chuPai]++;
        }
        else{
            game.gameSeats[i].countMap[game.chuPai] = 1;
        }
        recordUserAction(game,game.gameSeats[i],"hu",game.turn)
      }
    }
    var hupai = game.chuPai;
    var isZimo = false;

    var turnSeat = game.gameSeats[game.turn];
    seatData.isGangHu = turnSeat.lastFangGangSeat >= 0;
    var notify = -1;

    if(game.qiangGangContext != null){
        var gangSeat = game.qiangGangContext.seatData;
        hupai = game.qiangGangContext.pai;
        notify = hupai;
        var ac = recordUserAction(game,seatData,"qiangganghu",gangSeat.seatIndex);
        ac.iszimo = true;
        recordGameAction(game,seatIndex,ACTION_HU,hupai);
        seatData.isQiangGangHu = true;
        game.fangpaoindex = game.turn
        game.qiangGangContext.isValid = false;


        var idx = gangSeat.holds.indexOf(hupai);
        if(idx != -1){
            gangSeat.holds.splice(idx,1);
            gangSeat.countMap[hupai]--;
            userMgr.sendMsg(gangSeat.userId,'game_holds_push',gangSeat.holds);
        }
        //将牌添加到玩家的手牌列表，供前端显示
        seatData.holds.push(hupai);
        if(seatData.countMap[hupai]){
            seatData.countMap[hupai]++;
        }
        else{
            seatData.countMap[hupai] = 1;
        }

        recordUserAction(game,gangSeat,"beiqianggang",seatIndex);
    }
    else if(game.chuPai == -1){
        hupai = seatData.holds[seatData.holds.length - 1];
        notify = -1;
        if(seatData.isGangHu){
            if(turnSeat.lastFangGangSeat == seatIndex){
                var ac = recordUserAction(game,seatData,"ganghua");
                ac.iszimo = true;
            }
            else{
                var diangganghua_zimo = game.conf.dianganghua == 1;
                if(diangganghua_zimo){
                    var ac = recordUserAction(game,seatData,"dianganghua");
                    ac.iszimo = true;
                }
                else{
                    var ac = recordUserAction(game,seatData,"dianganghua",turnSeat.lastFangGangSeat);
                    ac.iszimo = false;
                }
            }
        }
        else{
            var ac = recordUserAction(game,seatData,"zimo");
            ac.iszimo = true;
        }

        isZimo = true;
        recordGameAction(game,seatIndex,ACTION_ZIMO,hupai);
    }
    else{
        notify = game.chuPai;
        //将牌添加到玩家的手牌列表，供前端显示
        seatData.holds.push(game.chuPai);
        if(seatData.countMap[game.chuPai]){
            seatData.countMap[game.chuPai]++;
        }
        else{
            seatData.countMap[game.chuPai] = 1;
        }

        console.log(seatData.holds);

        var at = "hu";
        //炮胡
        if(turnSeat.lastFangGangSeat >= 0){
            at = "gangpaohu";
        }

        var ac = recordUserAction(game,seatData,at,game.turn);
        ac.iszimo = false;

        //毛转雨
        if(turnSeat.lastFangGangSeat >= 0){
            for(var i = turnSeat.actions.length-1; i >= 0; --i){
                var t = turnSeat.actions[i];
                if(t.type == "diangang" || t.type == "wangang" || t.type == "angang"){
                    t.state = "nop";
                    t.payTimes = 0;

                    var nac = {
                        type:"maozhuanyu",
                        owner:turnSeat,
                        ref:t
                    }
                    seatData.actions.push(nac);
                    break;
                }
            }
        }

        //记录玩家放炮信息
        var fs = game.gameSeats[game.turn];
        //记录点炮的玩家：
        game.fangpaoindex = game.turn;
        recordUserAction(game,fs,"fangpao",seatIndex);

        recordGameAction(game,seatIndex,ACTION_HU,hupai);

        game.fangpaoshumu++;

        if(game.fangpaoshumu > 1){
            game.yipaoduoxiang = seatIndex;
        }
    }

    if(game.firstHupai < 0){
        game.firstHupai = seatIndex;
    }

    //保存番数
    var ti = seatData.tingMap[hupai];
    seatData.fan = ti.fan;
    seatData.pattern = ti.pattern;
    seatData.iszimo = isZimo;
    //如果是最后一张牌，则认为是海底胡
    seatData.isHaiDiHu = game.currentIndex == game.mahjongs.length;
    game.hupaiList.push(seatData.seatIndex);

    if(game.conf.tiandihu){
        if(game.chupaiCnt == 0 && game.button == seatData.seatIndex && game.chuPai == -1){
            seatData.isTianHu = true;
        }
        else if(game.chupaiCnt == 1 && game.turn == game.button && game.button != seatData.seatIndex && game.chuPai != -1){
            seatData.isDiHu = true;
        }
    }

    clearAllOptions(game,seatData);

    //通知前端，有人和牌了
    userMgr.broacastInRoom('hu_push',{seatindex:seatIndex,iszimo:isZimo,hupai:notify},seatData.userId,true);

    //
    if(game.lastHuPaiSeat == -1){
        game.lastHuPaiSeat = seatIndex;
    }
    else{
        var lp = (game.lastFangGangSeat - game.turn + 4) % 4;
        var cur = (seatData.seatIndex - game.turn + 4) % 4;
        if(cur > lp){
            game.lastHuPaiSeat = seatData.seatIndex;
        }
    }

    doGameOver(game,seatData.userId);
    return;

    //清空所有非胡牌操作
    for(var i = 0; i < game.gameSeats.length; ++i){
        var ddd = game.gameSeats[i];
        ddd.canPeng = false;
        ddd.canGang = false;
        ddd.canChuPai = false;
        sendOperations(game,ddd,hupai);
    }

    //如果还有人可以胡牌，则等待
    for(var i = 0; i < game.gameSeats.length; ++i){
        var ddd = game.gameSeats[i];
        if(ddd.canHu){
            return;
        }
    }

    //和牌的下家继续打
    clearAllOptions(game);
    //TODO 这里改成正常逻辑
    // game.turn = game.lastHuPaiSeat;
    // moveToNextUser(game);
    // doUserMoPai(game);
};

exports.guo = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //如果玩家没有对应的操作，则也认为是非法消息
    if((seatData.canGang || seatData.canPeng || seatData.canHu || seatData.canChi) == false){
        console.log("no need guo.");
        return;
    }

    //如果是玩家自己的轮子，不是接牌，则不需要额外操作
    var doNothing = game.chuPai == -1 && game.turn == seatIndex;

    userMgr.sendMsg(seatData.userId,"guo_result");
    clearAllOptions(game,seatData);

    //这里还要处理过胡的情况
    if(game.chuPai >= 0 && seatData.canHu){
        seatData.guoHuFan = seatData.tingMap[game.chuPai].fan;
    }

    if(doNothing){
        return;
    }

    //如果还有人可以操作，则等待
    for(var i = 0; i < game.gameSeats.length; ++i){
        var ddd = game.gameSeats[i];
        if(hasOperations(ddd)){
            return;
        }
    }

    //如果是已打出的牌，则需要通知。
    if(game.chuPai >= 0){
        var uid = game.gameSeats[game.turn].userId;
        userMgr.broacastInRoom('guo_notify_push',{userId:uid,pai:game.chuPai},seatData.userId,true);
        seatData.folds.push(game.chuPai);
        game.chuPai = -1;
    }


    var qiangGangContext = game.qiangGangContext;
    //清除所有的操作
    clearAllOptions(game);

    if(qiangGangContext != null && qiangGangContext.isValid){
        doGang(game,qiangGangContext.turnSeat,qiangGangContext.seatData,"wangang",1,qiangGangContext.pai);
    }
    else{
        //下家摸牌
        moveToNextUser(game);
        doUserMoPai(game);
    }
};

exports.hasBegan = function(roomId){
    var game = games[roomId];
    if(game != null){
        return true;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo != null){
        return roomInfo.numOfGames > 0;
    }
    return false;
};

var dissolvingList = [];

exports.doDissolve = function(roomId){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }
    var game = games[roomId];
    doGameOver(game,roomInfo.seats[0].userId,true);
};

exports.dissolveRequest = function(roomId,userId){
  console.log("dissolveRequest")
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }

    if(roomInfo.dr != null){
        return null;
    }

    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }

    //不满4人直接结束
    console.log(roomInfo.seats)
    var readys = 0
    for(var i=0;i<roomInfo.seats.length;i++){
      if(roomInfo.seats[i].ready) readys++
    }
    console.log(readys)
    if(readys < 4){
      this.doDissolve(roomId);
      return
    }

    roomInfo.dr = {
        endTime:Date.now() + 30000,
        states:[false,false,false,false]
    };
    roomInfo.dr.states[seatIndex] = true;

    dissolvingList.push(roomId);

    return roomInfo;
};

exports.dissolveAgree = function(roomId,userId,agree){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }

    if(roomInfo.dr == null){
        return null;
    }

    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }

    if(agree){
        roomInfo.dr.states[seatIndex] = true;
    }
    else{
        roomInfo.dr = null;
        var idx = dissolvingList.indexOf(roomId);
        if(idx != -1){
            dissolvingList.splice(idx,1);
        }
    }
    return roomInfo;
};

/***********************************************************************
 *
 *
 *
 * *************************************************************************/

function update() {
    for(var i = dissolvingList.length - 1; i >= 0; --i){
        var roomId = dissolvingList[i];

        var roomInfo = roomMgr.getRoom(roomId);
        if(roomInfo != null && roomInfo.dr != null){
            if(Date.now() > roomInfo.dr.endTime){
                console.log("delete room and games");
                exports.doDissolve(roomId);
                dissolvingList.splice(i,1);
            }
        }
        else{
            dissolvingList.splice(i,1);
        }
    }
}

setInterval(update,1000);
