﻿var socketio = require('socket.io');
var pg = require('pg');
var conString = "tcp://admin:admin@localhost:5432/chat_db"
var client = new pg.Client(conString);
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function (server) {
    io = socketio.listen(server);
    io.set('log level', 1);
    io.sockets.on('connection', function (socket) {
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        joinRoom(socket, 'Lobby');
        handleMessageBroadcasting(socket, nickNames);
        handleLogin(socket, nickNames);
        handleAddUser(socket, nickNames);
        handleUpdateUser(socket, nickNames);
        //handleDeleteUser(socket, nickNames);
        handleRoomJoining(socket);
        socket.on('rooms', function () {
            socket.emit('rooms', io.sockets.manager.rooms);
        });
        getAllRooms(socket);
        getUsersInCurrentRoom(socket);
        handleClientDisconnection(socket, nickNames, namesUsed);
    });
}

function getAllRooms(socket) {
    socket.on('getAllRooms', function () {
        socket.emit('getAllRooms', io.sockets.manager.rooms);
    });
}

function getUsersInCurrentRoom(socket) {
    socket.on('getUsersInCurrentRoom', function (room) {
        var usersInRoom = io.sockets.clients(room);
        var usersInRoomSummary = [];
            for (var index in usersInRoom) {
                var userSocketId = usersInRoom[index].id
                if (userSocketId != socket.id) {
                    usersInRoomSummary.push(nickNames[userSocketId]);
            };
        };
            socket.emit('getUsersInCurrentRoom', { usersInRoom: usersInRoomSummary });        
    });
}

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    var name = 'Guest' + guestNumber;
    nickNames[socket.id] = name;
    socket.emit('nameResult', {
        success: true,
        name: name
    });
    namesUsed.push(name);
    return guestNumber + 1;
}

function joinRoom(socket, room) {
    socket.join(room);
    currentRoom[socket.id] = room;
    socket.emit('joinResult', { room: room });
    socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + ' has joined ' + room + '.'
    });

    var usersInRoom = io.sockets.clients(room);
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = 'Users currently in ' + room + ': ';
        for (var index in usersInRoom) {
            var userSocketId = usersInRoom[index].id;
            if (userSocketId != socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ', ';
                }
                usersInRoomSummary += nickNames[userSocketId];
            }
        }
        usersInRoomSummary += '.';
        socket.emit('message', {text: usersInRoomSummary });
    }
}

function handleLogin(socket, nickNames) { 
    socket.on('login', function (name, password) {
        pg.connect(conString, function (err, client) {
                if (err) {
                    console.log(err);
                } else {
                    client.query('SELECT * FROM "CHAT_USER"', function (err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            for(var i = 0; i < result.rows.length; i++){
                                var row = result.rows[i];
                                var loginSuccessFlg = false;
                                if (row.UserName !== name) continue;
                                if(row.Password !== password) break;
                                loginSuccessFlg = true; // ユーザ名・パスワードが一致した場合
                                break;
                            }
                            if(loginSuccessFlg){
                                nickNames[socket.id] = name;
                            socket.emit('loginResult', {
                                success: true,
                                userId: row.UserId,
                                name: row.UserName
                            });
                                socket.broadcast.to(currentRoom[socket.id]).emit('message', {
                                    text: name + ' logined successfully .'
                                });
                            } else {
                                socket.emit('loginResult', {
                                    success: false,
                                    message: 'ユーザ名またはパスワードが一致しません'
                                });
                            }
                        }
                    })
            }
        });
    });
}

function handleAddUser(socket, nickNames) {
    socket.on('addUser', function (name, password) {
        pg.connect(conString, function (err, client) {
            if (err) {
                console.log(err);
            } else {
                client.query('INSERT INTO "CHAT_USER"\("UserId", "UserName", "Password"\) VALUES \($1, $2, $3\);', 
                    [name,name,password], function (err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        socket.emit('addUserResult', {
                            success: true,
                            userName:name,
                            message: 'ユーザの作成に成功しました'
                        });
                    }
                })
            }
        });
    });
}

function handleUpdateUser(socket, nickNames) {
    socket.on('updateUser', function (nameId, name, password) {
        pg.connect(conString, function (err, client) {
            if (err) {
                console.log(err);
            } else {
                client.query('UPDATE "CHAT_USER" SET "UserName"=$2, "Password"=$3 WHERE "UserId"=$1;',
                    [nameId,name,password], function (err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        socket.emit('updateUserResult', {
                            success: true,
                            message: 'ユーザ/パスワードの変更に成功しました'
                        });
                    }
                })
            }
        });
    });
}

function handleMessageBroadcasting(socket) {
    socket.on('message', function (message) {
        socket.broadcast.to(message.room).emit('message', {
            userName: nickNames[socket.id],
            text: message.text
        });
    });
}

function handleRoomJoining(socket) {
    socket.on('join', function (room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    });
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function () {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}
