"use strict";
cc._RFpush(module, '7f553G0boRH6KrTE7wACaXx', 'ReConnect');
// scripts/components/ReConnect.js

cc.Class({
    "extends": cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        _reconnect: null,
        _lblTip: null,
        _lastPing: 0
    },

    // use this for initialization
    onLoad: function onLoad() {
        this._reconnect = cc.find("Canvas/reconnect");
        this._lblTip = cc.find("Canvas/reconnect/tip").getComponent(cc.Label);
        var self = this;

        var fnTestServerOn = function fnTestServerOn() {
            cc.vv.net.test(function (ret) {
                if (ret) {
                    var roomId = cc.vv.userMgr.oldRoomId;
                    if (roomId != null) {
                        cc.vv.userMgr.oldRoomId = null;
                        cc.vv.userMgr.enterRoom(roomId);
                    } else {
                        cc.director.loadScene('hall');
                    }
                    //cc.director.loadScene('hall'); 
                    //cc.director.loadScene('mjgame');
                } else {
                        setTimeout(fnTestServerOn, 10000);
                    }
            });
        };

        var fn = function fn(data) {
            self.node.off('disconnect', fn);
            self._reconnect.active = true;
            fnTestServerOn();
        };
        console.log("adasfdasdfsdf");
        this.node.on('disconnect', fn);
    },
    // called every frame, uncomment this function to activate update callback
    update: function update(dt) {
        if (this._reconnect.active) {
            var t = Math.floor(Date.now() / 1000) % 4;
            this._lblTip.string = "与服务器断开连接，正在尝试重连";
            for (var i = 0; i < t; ++i) {
                this._lblTip.string += '.';
            }
        }
    }
});

cc._RFpop();